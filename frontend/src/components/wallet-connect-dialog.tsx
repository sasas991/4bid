"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";
import { api } from "@/api/client";

interface WalletConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletConnectDialog({
  open,
  onOpenChange,
}: WalletConnectDialogProps) {
  const { login } = useAuth();
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!wallet.trim()) return;
    setError("");
    setLoading(true);

    try {
      const { nonce } = await api.getNonceApiAuthNonceWalletAddressGet(
        wallet.trim(),
      );

      // In production, sign with Phantom/Solflare wallet
      // For dev, backend accepts "test-sig" as valid signature
      const signature = "test-sig";

      const { access_token } = await api.loginApiAuthLoginPost({
        wallet_address: wallet.trim(),
        signature,
        nonce,
      });

      await login(access_token);
      onOpenChange(false);
      setWallet("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet">Wallet Address</Label>
            <Input
              id="wallet"
              placeholder="Enter Solana wallet address"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={loading || !wallet.trim()}
          >
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
