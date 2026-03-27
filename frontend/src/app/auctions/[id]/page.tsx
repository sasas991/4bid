"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeftIcon,
  ClockIcon,
  GavelIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  WalletIcon,
  CheckCircleIcon,
  PackageIcon,
  TruckIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getAuction, MOCK_AUCTIONS, formatTimeLeft, lotTypeLabel } from "@/lib/mock-data"
import { AuctionCard } from "@/components/auction-card"
import { cn } from "@/lib/utils"

const LIFECYCLE_STEPS = [
  { icon: <GavelIcon className="h-4 w-4" />, label: "Bidding", key: "bidding" },
  { icon: <CheckCircleIcon className="h-4 w-4" />, label: "Winner Selected", key: "won" },
  { icon: <WalletIcon className="h-4 w-4" />, label: "Payment", key: "payment" },
  { icon: <TruckIcon className="h-4 w-4" />, label: "Shipping", key: "shipping" },
  { icon: <PackageIcon className="h-4 w-4" />, label: "Delivered", key: "delivered" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AuctionDetailPage() {
  const params = useParams()
  const auction = getAuction(params.id as string)

  const [bidAmount, setBidAmount] = React.useState("")
  const [bidPlaced, setBidPlaced] = React.useState(false)
  const [walletConnected, setWalletConnected] = React.useState(false)
  const [bids, setBids] = React.useState(auction?.bids ?? [])

  if (!auction) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Auction not found</h1>
          <p className="text-gray-500 mb-6">This auction may have ended or doesn't exist.</p>
          <Link href="/auctions">
            <Button className="bg-[#3665F3] hover:bg-[#2952d4]">Browse Auctions</Button>
          </Link>
        </div>
      </main>
    )
  }

  const { label: timeLabel, urgent } = formatTimeLeft(auction.endsAt)
  const minBid = bids.length > 0 ? Math.max(...bids.map((b) => b.amount)) + 0.1 : auction.startingPrice
  const currentBid = bids.length > 0 ? Math.max(...bids.map((b) => b.amount)) : auction.startingPrice

  const handleBid = () => {
    const amount = parseFloat(bidAmount)
    if (isNaN(amount) || amount < minBid) return
    const newBid = {
      id: `new-${Date.now()}`,
      bidder: "7xKp9mNvQwRsLt3uYfEjHcBdAoG6ZiVn",
      bidderShort: "7xKp...iVn",
      amount,
      timestamp: new Date().toISOString(),
    }
    setBids([newBid, ...bids])
    setBidPlaced(true)
    setBidAmount("")
    setTimeout(() => setBidPlaced(false), 4000)
  }

  const relatedAuctions = MOCK_AUCTIONS.filter(
    (a) => a.id !== auction.id && a.category === auction.category
  ).slice(0, 4)

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Breadcrumb */}
      <div className="border-b bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-[#3665F3]">Home</Link>
          <span>/</span>
          <Link href="/auctions" className="hover:text-[#3665F3]">Auctions</Link>
          <span>/</span>
          <Link href={`/auctions?category=${auction.category.toLowerCase()}`} className="hover:text-[#3665F3]">
            {auction.category}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium line-clamp-1 max-w-xs">{auction.title}</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6">
        <Link href="/auctions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3665F3] mb-6 transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Browse
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Image + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image */}
            <div className={`relative flex h-72 sm:h-96 items-center justify-center rounded-2xl bg-gradient-to-br ${auction.imageColor} text-8xl overflow-hidden`}>
              <span>{auction.imageIcon}</span>
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                <Badge variant={auction.lotType === "physical" ? "default" : auction.lotType === "service" ? "info" : "secondary"}>
                  {lotTypeLabel(auction.lotType)}
                </Badge>
                {auction.status === "ending_soon" && (
                  <Badge variant="warning" className="animate-pulse">Ending Soon</Badge>
                )}
              </div>
            </div>

            {/* Title and meta */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{auction.title}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <GavelIcon className="h-4 w-4" />
                  {bids.length} bid{bids.length !== 1 ? "s" : ""}
                </span>
                <span className={cn("flex items-center gap-1", urgent && "text-red-600 font-medium")}>
                  <ClockIcon className="h-4 w-4" />
                  {timeLabel}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheckIcon className="h-4 w-4 text-green-500" />
                  Verified on-chain
                </span>
              </div>
              <p className="text-gray-600 leading-relaxed">{auction.description}</p>
            </div>

            {/* Lifecycle tracker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaction Lifecycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  {LIFECYCLE_STEPS.map((step, i) => (
                    <React.Fragment key={step.key}>
                      <div className={cn(
                        "flex flex-col items-center gap-1 flex-1",
                        i === 0 ? "text-[#3665F3]" : "text-gray-300"
                      )}>
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          i === 0 ? "bg-[#3665F3] text-white" : "bg-gray-100 text-gray-400"
                        )}>
                          {step.icon}
                        </div>
                        <span className="text-xs font-medium text-center leading-tight">
                          {step.label}
                        </span>
                      </div>
                      {i < LIFECYCLE_STEPS.length - 1 && (
                        <div className={cn("flex-1 h-0.5 mb-4", i === 0 ? "bg-gray-200" : "bg-gray-100")} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bid history */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bid History ({bids.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {bids.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-gray-500">No bids yet. Be the first!</p>
                ) : (
                  <div className="divide-y">
                    {bids.map((bid, i) => (
                      <div key={bid.id} className="flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-[#3665F3]/10 text-[#3665F3] text-xs font-mono">
                              {bid.bidderShort.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-gray-700">{bid.bidderShort}</span>
                              {i === 0 && (
                                <Badge variant="success" className="text-xs">Leading</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{formatDate(bid.timestamp)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            {bid.amount.toFixed(2)}{" "}
                            <span className="font-semibold text-[#9945FF] text-sm">SOL</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Bid panel + Seller */}
          <div className="space-y-4">
            {/* Current bid card */}
            <Card className="border-2 border-[#3665F3]/20 shadow-md">
              <CardContent className="p-6">
                <div className="mb-1 text-sm text-gray-500">Current Bid</div>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">
                    {currentBid.toFixed(2)}
                  </span>
                  <span className="text-xl font-bold text-[#9945FF]">SOL</span>
                </div>

                <div className={cn(
                  "mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                  urgent
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-[#3665F3]"
                )}>
                  <ClockIcon className="h-4 w-4" />
                  {timeLabel}
                </div>

                <Separator className="mb-4" />

                {bidPlaced ? (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                    <CheckCircleIcon className="mx-auto h-8 w-8 text-green-500 mb-2" />
                    <div className="font-semibold text-green-700">Bid Placed!</div>
                    <div className="text-xs text-green-600 mt-1">Your bid has been signed and submitted.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!walletConnected && (
                      <Button
                        className="w-full h-11 bg-[#3665F3] hover:bg-[#2952d4]"
                        onClick={() => setWalletConnected(true)}
                      >
                        <WalletIcon className="mr-2 h-4 w-4" />
                        Connect Wallet to Bid
                      </Button>
                    )}
                    {walletConnected && (
                      <>
                        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 font-medium flex items-center gap-1.5">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Wallet connected: 7xKp...iVn
                        </div>
                        <div>
                          <Label className="mb-1.5 text-sm">Your Bid (SOL)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min={minBid}
                            placeholder={`Min ${minBid.toFixed(2)} SOL`}
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="h-11 text-base"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Minimum: {minBid.toFixed(2)} SOL
                          </p>
                        </div>
                        <Button
                          className="w-full h-11 bg-[#3665F3] text-base font-semibold hover:bg-[#2952d4]"
                          onClick={handleBid}
                          disabled={
                            !bidAmount ||
                            parseFloat(bidAmount) < minBid ||
                            isNaN(parseFloat(bidAmount))
                          }
                        >
                          <GavelIcon className="mr-2 h-4 w-4" />
                          Place Bid
                        </Button>
                        <p className="text-center text-xs text-gray-400">
                          Bid will be signed by your wallet
                        </p>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seller info */}
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Seller</div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-[#9945FF] to-[#3665F3] text-white text-xs font-mono">
                      {auction.sellerShort.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-mono text-sm text-gray-700">{auction.sellerShort}</div>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <ShieldCheckIcon className="h-3 w-3" />
                      Verified wallet
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Starting price</span>
                  <span className="font-medium">{auction.startingPrice} SOL</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Lot type</span>
                  <Badge variant={auction.lotType === "physical" ? "default" : auction.lotType === "service" ? "info" : "secondary"} className="text-xs">
                    {lotTypeLabel(auction.lotType)}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ends at</span>
                  <span className="font-medium text-xs">{formatDate(auction.endsAt)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment</span>
                  <span className="font-medium text-[#9945FF]">SOL on Solana</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Platform fee</span>
                  <span className="font-medium text-green-600">0%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Related */}
        {relatedAuctions.length > 0 && (
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Similar Auctions</h2>
              <Link href={`/auctions?category=${auction.category.toLowerCase()}`} className="text-sm text-[#3665F3] hover:underline flex items-center gap-1">
                <TrendingUpIcon className="h-3 w-3" />
                See all in {auction.category}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedAuctions.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
