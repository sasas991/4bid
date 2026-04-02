"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { WalletConnectDialog } from "@/components/wallet-connect-dialog";
import { useState } from "react";

export function Header() {
  const { user, isLoading, logout } = useAuth();
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          4bid
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Auctions
          </Link>
          {user && (
            <>
              <Link
                href="/my/auctions"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                My Auctions
              </Link>
              <Link
                href="/create"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Create
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          ) : user ? (
            <>
              <Link href="/profile">
                <Button variant="ghost" size="sm">
                  {user.username ??
                    `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`}
                </Button>
              </Link>
              <span className="text-xs text-muted-foreground">
                {user.balance.toFixed(2)} SOL
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setConnectOpen(true)}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>

      <WalletConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
      />
    </header>
  );
}
