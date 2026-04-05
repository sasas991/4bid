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
import { useAuth } from "@/context/auth";
import { api } from "@/api/client";
import { AXIOS_INSTANCE } from "@/api/axios-instance";
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
      let activeWallet = wallet.wallet;

      if (!activeWallet) {
        const installedWallet = wallet.wallets.find(
          (candidate: { readyState?: string }) => candidate.readyState === "Installed",
        );
        const fallbackWallet = installedWallet ?? wallet.wallets[0];

        if (!fallbackWallet) {
          throw new Error("No wallet adapter is available");
        }

        wallet.select(fallbackWallet.adapter.name);
        activeWallet = fallbackWallet;
      }

      if (!activeWallet) {
        throw new Error("Wallet selection failed");
      }

      if (!activeWallet.adapter.publicKey) {
        await activeWallet.adapter.connect();
      }

      const publicKey = activeWallet.adapter.publicKey;

      if (!publicKey) {
        throw new Error("Wallet did not provide a public key");
      }

      const signMessage = activeWallet.adapter.signMessage;

      if (!signMessage) {
        throw new Error("Connected wallet does not support message signing");
      }

      const walletAddress = publicKey.toBase58();
      const { nonce } = await api.getNonceApiAuthNonceWalletAddressGet(walletAddress);

      const messageBytes = new TextEncoder().encode(nonce);
      const signed = await signMessage(messageBytes);
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
          <DialogTitle>Sign In</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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

          <p className="text-sm text-gray-600">
            Critical auction actions are signed and executed on-chain.
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
