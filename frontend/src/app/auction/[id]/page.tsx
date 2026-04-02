"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AuctionDetail } from "@/api/generated";
import { AuctionStatus, LotType } from "@/api/generated";
import { api } from "@/api/client";
import { useAuth } from "@/context/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const LOT_TYPE_LABEL: Record<string, string> = {
  [LotType.physical_item]: "Physical Item",
  [LotType.information]: "Information",
  [LotType.physical_service]: "Physical Service",
  [LotType.digital_service]: "Digital Service",
};

export default function AuctionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState("");

  const auctionId = Number(params.id);
  const isOwner = user && auction && user.id === auction.owner_id;
  const isWinner = user && auction && user.id === auction.winner_id;
  const isActive = auction?.status === AuctionStatus.active;
  const deadlinePassed =
    auction && new Date(auction.deadline).getTime() < Date.now();

  useEffect(() => {
    api
      .getAuctionApiAuctionsAuctionIdGet(auctionId)
      .then(setAuction)
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [auctionId, router]);

  const handleBid = async () => {
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= (auction?.current_price ?? 0)) {
      setError("Bid must be higher than current price");
      return;
    }
    setError("");
    setBidding(true);
    try {
      await api.createBidApiAuctionsAuctionIdBidsPost(auctionId, {
        amount,
        auction_id: auctionId,
        signature: "test-sig",
      });
      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId);
      setAuction(updated);
      setBidAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setBidding(false);
    }
  };

  const handleStatusUpdate = async (status: AuctionStatus) => {
    try {
      await api.updateAuctionStatusApiAuctionsAuctionIdStatusPatch(auctionId, {
        status,
        tx_signature: "test-sig",
      });
      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId);
      setAuction(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  }

  if (!auction) return null;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{auction.title}</h1>
            <Badge>{auction.status}</Badge>
          </div>
          <Badge variant="outline" className="mt-2">
            {LOT_TYPE_LABEL[auction.lot_type ?? LotType.physical_item]}
          </Badge>
        </div>

        {auction.description && (
          <p className="text-muted-foreground">{auction.description}</p>
        )}

        {auction.hidden_content && (isOwner || isWinner) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hidden Content</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{auction.hidden_content}</p>
            </CardContent>
          </Card>
        )}

        <Separator />

        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Bids ({auction.bids?.length ?? 0})
          </h2>
          {auction.bids && auction.bids.length > 0 ? (
            <div className="space-y-2">
              {[...auction.bids]
                .sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime(),
                )
                .map((bid) => (
                  <div
                    key={bid.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span className="font-mono text-muted-foreground">
                      User #{bid.user_id}
                    </span>
                    <div className="text-right">
                      <span className="font-semibold">
                        {bid.amount.toFixed(2)} SOL
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {new Date(bid.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No bids yet</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Current Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {auction.current_price.toFixed(2)}{" "}
              <span className="text-lg text-muted-foreground">SOL</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Started at {auction.starting_price.toFixed(2)} SOL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Deadline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {new Date(auction.deadline).toLocaleString()}
            </p>
            {deadlinePassed && (
              <Badge variant="destructive" className="mt-1">
                Ended
              </Badge>
            )}
          </CardContent>
        </Card>

        {user && isActive && !isOwner && !deadlinePassed && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Place a Bid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="bid">Amount (SOL)</Label>
                <Input
                  id="bid"
                  type="number"
                  step="0.01"
                  min={auction.current_price + 0.01}
                  placeholder={`Min ${(auction.current_price + 0.01).toFixed(2)}`}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleBid}
                disabled={bidding}
              >
                {bidding ? "Placing bid..." : "Place Bid"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isOwner && isActive && deadlinePassed && (
          <Button
            className="w-full"
            onClick={() => handleStatusUpdate(AuctionStatus.finished)}
          >
            Finish Auction
          </Button>
        )}

        {isOwner && auction.status === AuctionStatus.finished && (
          <Button
            className="w-full"
            onClick={() => handleStatusUpdate(AuctionStatus.cancelled)}
            variant="destructive"
          >
            Cancel Auction
          </Button>
        )}

        {!user && isActive && (
          <p className="text-center text-sm text-muted-foreground">
            Connect wallet to place a bid
          </p>
        )}
      </div>
    </div>
  );
}
