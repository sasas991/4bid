"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { api } from "@/api/client";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

interface WalletConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletConnectDialog({
  open,
  onOpenChange,
}: WalletConnectDialogProps) {
  const { login, logout } = useAuth();
  const wallet = useWallet();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setError("");
    setLoading(true);

    try {
      if (!wallet.connected) {
        await wallet.connect();
      }

      if (!wallet.publicKey) {
        throw new Error("Wallet did not provide a public key");
      }
      if (!wallet.signMessage) {
        throw new Error("Connected wallet does not support message signing");
      }

      const walletAddress = wallet.publicKey.toBase58();
      const { nonce } = await api.getNonceApiAuthNonceWalletAddressGet(walletAddress);

      const messageBytes = new TextEncoder().encode(nonce);
      const signed = await wallet.signMessage(messageBytes);
      const signature = bs58.encode(signed);

      const { access_token } = await api.loginApiAuthLoginPost({
        wallet_address: walletAddress,
        signature,
        nonce,
      });

      await login(access_token);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setError("");
    try {
      await wallet.disconnect();
    } finally {
      logout();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Critical auction actions are signed and executed on-chain. Connect your wallet to continue.
          </p>
          {wallet.publicKey && (
            <p className="text-xs text-gray-500 font-mono">{wallet.publicKey.toBase58()}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!wallet.connected ? (
            <Button className="w-full" onClick={handleConnect} disabled={loading}>
              {loading ? "Connecting..." : "Connect & Sign"}
            </Button>
          ) : (
            <Button className="w-full" variant="outline" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
