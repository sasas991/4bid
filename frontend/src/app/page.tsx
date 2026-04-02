"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Auction } from "@/api/generated";
import { AuctionStatus, LotType } from "@/api/generated";
import { api } from "@/api/client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LOT_TYPE_LABEL: Record<string, string> = {
  [LotType.physical_item]: "Physical Item",
  [LotType.information]: "Information",
  [LotType.physical_service]: "Physical Service",
  [LotType.digital_service]: "Digital Service",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  [AuctionStatus.active]: "default",
  [AuctionStatus.finished]: "secondary",
  [AuctionStatus.paid]: "secondary",
  [AuctionStatus.completed]: "outline",
  [AuctionStatus.cancelled]: "destructive",
};

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

export default function HomePage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAuctionsApiAuctionsGet({ limit: 50 })
      .then(setAuctions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        No auctions yet. Be the first to create one!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Active Auctions</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {auctions.map((auction) => (
          <Link key={auction.id} href={`/auction/${auction.id}`}>
            <Card className="h-full transition-colors hover:border-foreground/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-base">
                    {auction.title}
                  </CardTitle>
                  <Badge variant={STATUS_VARIANT[auction.status] ?? "secondary"}>
                    {auction.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {auction.description || "No description"}
                </p>
                <Badge variant="outline" className="mt-2">
                  {LOT_TYPE_LABEL[auction.lot_type ?? LotType.physical_item]}
                </Badge>
              </CardContent>
              <CardFooter className="flex justify-between text-sm">
                <span className="font-semibold">
                  {auction.current_price.toFixed(2)} SOL
                </span>
                <span className="text-muted-foreground">
                  {timeLeft(auction.deadline)}
                </span>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
