"use client";

import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
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
import { AXIOS_INSTANCE } from "@/api/axios-instance";

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

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError("Google sign-in failed: no token received");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data } = await AXIOS_INSTANCE.post<{ access_token: string; token_type: string }>(
        "/api/auth/google",
        { token: idToken },
      );
      await login(data.access_token);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Google Sign-In */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in failed")}
              width="100%"
              theme="outline"
              size="large"
              text="signin_with"
            />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or connect wallet
              </span>
            </div>
          </div>

          {/* Wallet Connect */}
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
            {loading ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
