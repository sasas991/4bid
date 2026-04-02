"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Auction, Bid } from "@/api/generated";
import { api } from "@/api/client";
import { useAuth } from "@/context/auth";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MyAuctionsPage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getMyAuctionsApiAuctionsMyAuctionsGet(),
      api.getMyBidsApiAuctionsMyBidsGet(),
    ])
      .then(([a, b]) => {
        setAuctions(a);
        setBids(b);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Connect your wallet to see your auctions.
      </div>
    );
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">My Auctions</h1>
        {auctions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t created any auctions yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => (
              <Link key={a.id} href={`/auction/${a.id}`}>
                <Card className="transition-colors hover:border-foreground/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <Badge>{a.status}</Badge>
                  </CardContent>
                  <CardFooter>
                    <span className="font-semibold">
                      {a.current_price.toFixed(2)} SOL
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">My Bids</h2>
        {bids.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t placed any bids yet.
          </p>
        ) : (
          <div className="space-y-2">
            {bids.map((bid) => (
              <Link key={bid.id} href={`/auction/${bid.auction_id}`}>
                <div className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted">
                  <span>Auction #{bid.auction_id}</span>
                  <div>
                    <span className="font-semibold">
                      {bid.amount.toFixed(2)} SOL
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(bid.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
