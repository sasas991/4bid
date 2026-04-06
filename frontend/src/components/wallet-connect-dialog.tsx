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

type Step = "sign-in" | "link-wallet";

interface WalletConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: Step;
}

export function WalletConnectDialog({
  open,
  onOpenChange,
  initialStep = "sign-in",
}: WalletConnectDialogProps) {
  const { login, logout, refreshUser } = useAuth();
  const wallet = useWallet();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>(initialStep);

  const resetAndClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep(initialStep);
      setError("");
    }
    onOpenChange(isOpen);
  };

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

  const connectAndSign = async () => {
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

  const handleConnect = async () => {
    setError("");
    setLoading(true);

    try {
      const { publicKey, signMessage } = await connectAndSign();
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
      resetAndClose(false);
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
      setStep("link-wallet");
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
      const { publicKey, signMessage } = await connectAndSign();
      const walletAddress = publicKey.toBase58();

      const { nonce } = await api.getLinkWalletNonceApiAuthLinkWalletNonceWalletAddressGet(walletAddress);

      const messageBytes = new TextEncoder().encode(nonce);
      const signed = await signMessage(messageBytes);
      const signature = bs58.encode(signed);

      await api.linkWalletApiAuthLinkWalletPost({
        wallet_address: walletAddress,
        signature,
        nonce,
      });

      await refreshUser();
      resetAndClose(false);
    } catch (err) {
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
        setError(err instanceof Error ? err.message : "Failed to link wallet");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setError("");
    setLoading(true);

    try {
      await wallet.disconnect();
    } finally {
      logout();
      resetAndClose(false);
    }
  };

  if (step === "link-wallet") {
    return (
      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Solflare Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Connect your Solflare wallet to sign on-chain transactions such as bids, deposits, and withdrawals.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" onClick={handleLinkWallet} disabled={loading}>
              {loading ? "Connecting..." : "Connect Solflare"}
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => resetAndClose(false)}
              disabled={loading}
            >
              Skip for now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        {step === "sign-in" && (
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

        {step === "link-wallet" && (
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
