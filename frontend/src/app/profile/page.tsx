"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateRu } from "@/lib/date";
import { resolveFileUrl } from "@/lib/files";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import type { MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarFileId, setAvatarFileId] = useState<number | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Connect your wallet to view your profile.
      </div>
    );
  }

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) {
      setAvatarError("Only images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Max avatar size: 5 MB");
      return;
    }
    setAvatarUploading(true);
    try {
      const result = await api.uploadFileApiFilesUploadPost({ file });
      setAvatarFileId(result.id);
      setAvatarPreviewUrl(result.url);
    } catch {
      setAvatarError("Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateUserMeApiUsersMePatch({
        username: username || undefined,
        bio: bio || undefined,
        avatar_file_id: avatarFileId ?? undefined,
      });
      await refreshUser();
      setEditing(false);
      setAvatarFileId(null);
      setAvatarPreviewUrl(null);
    } catch {
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDeposit = async () => {
    setError("");
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid deposit amount");
      return;
    }
    const adapter = wallet.wallet?.adapter;
    const pubkey = wallet.publicKey ?? adapter?.publicKey;
    if (!pubkey || !adapter) {
      setError("Connect your Solflare wallet first");
      return;
    }
    const treasury = process.env.NEXT_PUBLIC_PROTOCOL_TREASURY;
    if (!treasury) {
      setError("Platform treasury is not configured");
      return;
    }

    setDepositing(true);
    try {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: pubkey,
          toPubkey: new PublicKey(treasury),
          lamports,
        }),
      );
      tx.feePayer = pubkey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash("confirmed")
      ).blockhash;

      if (!("signTransaction" in adapter) || typeof adapter.signTransaction !== "function") {
        throw new Error("Wallet does not support transaction signing");
      }
      const signed = await (adapter as unknown as { signTransaction: (tx: Transaction) => Promise<Transaction> }).signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      await api.depositFundsApiUsersDepositPost({
        amount,
        signature,
      });
      await refreshUser();
      setDepositAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    setError("");
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid withdraw amount");
      return;
    }
    const adapter = wallet.wallet?.adapter;
    if (!wallet.publicKey || !adapter) {
      setError("Connect your Solflare wallet first");
      return;
    }

    const signMessage =
      wallet.signMessage ??
      (adapter &&
        "signMessage" in adapter &&
        typeof (adapter as MessageSignerWalletAdapter).signMessage === "function"
          ? (adapter as MessageSignerWalletAdapter).signMessage.bind(adapter)
          : null);

    if (!signMessage) {
      setError("Connected wallet does not support message signing");
      return;
    }

    setWithdrawing(true);
    try {
      const message = `Withdraw ${amount} SOL from 4bid`;
      const messageBytes = new TextEncoder().encode(message);
      const signed = await signMessage(messageBytes);
      const signature = bs58.encode(signed);

      await api.withdrawFundsApiUsersWithdrawPost({
        amount,
        signature,
      });
      await refreshUser();
      setWithdrawAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile</CardTitle>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUsername(user.username ?? "");
                  setBio(user.bio ?? "");
                  setAvatarFileId(null);
                  setAvatarPreviewUrl(null);
                  setAvatarError("");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            {(() => {
              const url = avatarPreviewUrl ?? resolveFileUrl(user.avatar_file, user.avatar_url);
              return url ? (
                <img src={url} alt="avatar" className="h-16 w-16 rounded-full object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground select-none">
                  {(user.username ?? user.email ?? "?")[0].toUpperCase()}
                </div>
              );
            })()}
            {editing && (
              <div className="flex-1 space-y-1">
                <Label htmlFor="avatarUpload" className="text-xs text-muted-foreground">Change avatar (max 5 MB)</Label>
                <Input
                  id="avatarUpload"
                  type="file"
                  accept="image/*"
                  disabled={avatarUploading}
                  onChange={(e) => void handleAvatarUpload(e.target.files?.[0] ?? null)}
                  className="h-9 text-xs"
                />
                {avatarUploading && <p className="text-xs text-[#3665F3]">Uploading...</p>}
                {avatarFileId && !avatarUploading && <p className="text-xs text-green-600">✓ Ready to save</p>}
                {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
              </div>
            )}
          </div>

          <div>
            <Label className="text-muted-foreground">Wallet</Label>
            <p className="font-mono text-sm">{user.wallet_address}</p>
          </div>

          {editing ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || avatarUploading}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => {
                  setEditing(false);
                  setAvatarFileId(null);
                  setAvatarPreviewUrl(null);
                  setAvatarError("");
                }}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-muted-foreground">Username</Label>
                <p className="text-sm">{user.username ?? "Not set"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Bio</Label>
                <p className="text-sm">{user.bio ?? "Not set"}</p>
              </div>
            </>
          )}

          <div>
            <Label className="text-muted-foreground">Member since</Label>
            <p className="text-sm">
              {formatDateRu(user.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold">
            {user.balance.toFixed(2)}{" "}
            <span className="text-lg text-muted-foreground">SOL</span>
          </p>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="deposit">Deposit (SOL)</Label>
            <div className="flex gap-2">
              <Input
                id="deposit"
                type="number"
                step="0.01"
                min="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button onClick={handleDeposit} disabled={depositing}>
                {depositing ? "..." : "Deposit"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="withdraw">Withdraw (SOL)</Label>
            <div className="flex gap-2">
              <Input
                id="withdraw"
                type="number"
                step="0.01"
                min="0.01"
                max={user.balance}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <Button onClick={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? "..." : "Withdraw"}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
