"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Auction, Bid } from "@/api/generated";
import { api } from "@/api/client";
import { useAuth } from "@/context/auth";
import { AuctionCard } from "@/components/auction-card";
import { formatDateTimeRu } from "@/lib/date";

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
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-gray-500">Connect your wallet to see your auctions.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">My Auctions</h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-10">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Created by me</h2>
          {auctions.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-sm text-gray-500">You haven&apos;t created any auctions yet.</p>
              <Link href="/create" className="mt-2 inline-block text-sm text-[#3665F3] hover:underline">
                Create your first auction
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {auctions.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">My Bids</h2>
          {bids.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-sm text-gray-500">You haven&apos;t placed any bids yet.</p>
              <Link href="/auctions" className="mt-2 inline-block text-sm text-[#3665F3] hover:underline">
                Browse auctions
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {bids.map((bid) => (
                <Link key={bid.id} href={`/auctions/${bid.auction_id}`}>
                  <div className="flex items-center justify-between rounded-xl border bg-white p-4 text-sm transition-colors hover:border-[#3665F3]/30">
                    <span className="font-medium text-gray-900">Auction #{bid.auction_id}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900">
                        {bid.amount.toFixed(2)}{" "}
                        <span className="text-[#9945FF] font-semibold">SOL</span>
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDateTimeRu(bid.timestamp)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
