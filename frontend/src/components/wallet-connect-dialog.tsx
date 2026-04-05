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
import type { MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";
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

  const isWalletReady = (readyState?: string) =>
    readyState === "Installed" || readyState === "Loadable";

  const handleConnect = async () => {
    setError("");
    setLoading(true);

    try {
      // Use selected wallet only if it is ready; otherwise switch to a ready one.
      let selectedWallet = wallet.wallet;
      if (!selectedWallet || !isWalletReady(selectedWallet.readyState)) {
        const ready = wallet.wallets.find(
          (w: { readyState?: string }) =>
            isWalletReady(w.readyState),
        );
        if (!ready) {
          throw new Error(
            "No Solana wallet detected. Please install Phantom or Solflare.",
          );
        }
        if (!selectedWallet || selectedWallet.adapter.name !== ready.adapter.name) {
          wallet.select(ready.adapter.name);
        }
        selectedWallet = ready;
      }

      const adapter = selectedWallet.adapter;

      if (!adapter.publicKey) {
        await adapter.connect();
      }

      const publicKey = adapter.publicKey;
      if (!publicKey) {
        throw new Error("Wallet did not provide a public key after connecting");
      }

      // Use the adapter's own signMessage to avoid stale React hook state.
      if (!("signMessage" in adapter)) {
        throw new Error("Connected wallet does not support message signing");
      }
      const signer = adapter as unknown as MessageSignerWalletAdapter;

      const walletAddress = publicKey.toBase58();
      const { nonce } = await api.getNonceApiAuthNonceWalletAddressGet(walletAddress);

      const messageBytes = new TextEncoder().encode(nonce);
      const signed = await signer.signMessage(messageBytes);
      const signature = bs58.encode(signed);

      const { access_token } = await api.loginApiAuthLoginPost({
        wallet_address: walletAddress,
        signature,
        nonce,
      });

      await login(access_token);
      onOpenChange(false);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        (err as { name?: string }).name === "WalletNotReadyError"
      ) {
        setError("Wallet is not ready. Open/unlock the wallet extension and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
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
