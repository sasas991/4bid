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

type Step = "sign-in" | "link-wallet";

export function WalletConnectDialog({
  open,
  onOpenChange,
}: WalletConnectDialogProps) {
  const { user, login, refreshUser } = useAuth();
  const wallet = useWallet();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("sign-in");

  // If dialog opens and user is logged in but has no wallet — go straight to link step
  const effectiveStep = user && !user.wallet_address ? "link-wallet" : step;

  const isWalletReady = (readyState?: string) =>
    readyState === "Installed";

  const isSolflareWallet = (name?: string) =>
    typeof name === "string" && name.toLowerCase().includes("solflare");

  const supportsSignMessage = (
    adapter: unknown,
  ): adapter is MessageSignerWalletAdapter =>
    !!adapter &&
    typeof adapter === "object" &&
    "signMessage" in adapter &&
    typeof (adapter as { signMessage?: unknown }).signMessage === "function";

  const connectSolflare = async () => {
    let selectedWallet = wallet.wallet;
    if (
      !selectedWallet ||
      !isSolflareWallet(selectedWallet.adapter.name) ||
      !isWalletReady(selectedWallet.readyState)
    ) {
      const solflare = wallet.wallets.find(
        (w) =>
          isSolflareWallet(w.adapter.name) &&
          isWalletReady(w.readyState),
      );

      if (!solflare) {
        throw new Error("No Solflare wallet detected. Please install/unlock Solflare extension.");
      }

      if (!selectedWallet || selectedWallet.adapter.name !== solflare.adapter.name) {
        wallet.select(solflare.adapter.name);
      }

      selectedWallet = solflare;
    }

    const adapter = selectedWallet.adapter;

    if (!wallet.connected && !adapter.connected) {
      await adapter.connect();
    }
    const publicKey = adapter.publicKey ?? wallet.publicKey;

    if (!publicKey) {
      throw new Error("Wallet did not provide a public key after connecting");
    }

    const signMessage = wallet.signMessage
      ? wallet.signMessage.bind(wallet)
      : supportsSignMessage(adapter)
        ? adapter.signMessage.bind(adapter)
        : null;

    if (!signMessage) {
      throw new Error("Connected wallet does not support message signing");
    }

    return { publicKey, signMessage };
  };

  const handleWalletError = (err: unknown) => {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "WalletNotReadyError"
    ) {
      setError("Wallet is not ready. Open/unlock the wallet extension and try again.");
    } else if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "WalletConnectionError"
    ) {
      setError("Failed to connect wallet. Open Solflare and approve the connection request.");
    } else {
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleConnect = async () => {
    setError("");
    setLoading(true);

    try {
      const { publicKey, signMessage } = await connectSolflare();

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
      handleWalletError(err);
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
      // Don't close dialog — if user has no wallet, effectiveStep will switch to "link-wallet"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkWallet = async () => {
    setError("");
    setLoading(true);

    try {
      const { publicKey, signMessage } = await connectSolflare();

      const walletAddress = publicKey.toBase58();

      // Get nonce for linking (stored on current user)
      const { data: nonceData } = await AXIOS_INSTANCE.get<{ nonce: string }>(
        "/api/auth/link-wallet/nonce",
      );

      const messageBytes = new TextEncoder().encode(nonceData.nonce);
      const signed = await signMessage(messageBytes);
      const signature = bs58.encode(signed);

      await AXIOS_INSTANCE.post("/api/auth/link-wallet", {
        wallet_address: walletAddress,
        signature,
        nonce: nonceData.nonce,
      });

      await refreshUser();
      onOpenChange(false);
    } catch (err) {
      handleWalletError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("sign-in");
      setError("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {effectiveStep === "sign-in" && (
          <>
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
              <Button className="w-full" onClick={handleConnect} disabled={loading}>
                {loading ? "Connecting..." : "Connect & Sign"}
              </Button>
            </div>
          </>
        )}

        {effectiveStep === "link-wallet" && (
          <>
            <DialogHeader>
              <DialogTitle>Connect Wallet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your Solflare wallet to complete account setup. It will be linked to your Google account.
              </p>
              {wallet.publicKey && (
                <p className="text-xs text-gray-500 font-mono">{wallet.publicKey.toBase58()}</p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleLinkWallet} disabled={loading}>
                {loading ? "Connecting..." : "Connect Solflare"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
