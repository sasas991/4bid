"use client"

import Link from "next/link"
import { ClockIcon, GavelIcon, TrendingUpIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type Auction, formatTimeLeft, lotTypeLabel } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface AuctionCardProps {
  auction: Auction
  className?: string
}

export function AuctionCard({ auction, className }: AuctionCardProps) {
  const { label: timeLabel, urgent } = formatTimeLeft(auction.endsAt)

  return (
    <Link href={`/auctions/${auction.id}`}>
      <Card
        className={cn(
          "group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer border-gray-200",
          className
        )}
      >
        {/* Image */}
        <div
          className={cn(
            "relative flex h-44 items-center justify-center bg-gradient-to-br text-5xl",
            auction.imageColor
          )}
        >
          <span>{auction.imageIcon}</span>
          {/* Badges overlay */}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge
              variant={auction.lotType === "physical" ? "default" : auction.lotType === "service" ? "info" : "secondary"}
              className="text-xs"
            >
              {lotTypeLabel(auction.lotType)}
            </Badge>
            {auction.status === "ending_soon" && (
              <Badge variant="warning" className="text-xs animate-pulse">
                Ending Soon
              </Badge>
            )}
          </div>
          {/* Bid count badge */}
          <div className="absolute right-2 top-2">
            <Badge variant="outline" className="bg-black/40 text-white border-white/20 backdrop-blur-sm text-xs">
              <GavelIcon className="mr-1 h-3 w-3" />
              {auction.bids.length} bid{auction.bids.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4">
          {/* Title */}
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-900 leading-snug group-hover:text-[#3665F3] transition-colors">
            {auction.title}
          </h3>

          {/* Price */}
          <div className="mb-3 flex items-baseline gap-1">
            <span className="text-xs text-gray-500">Current bid</span>
            <span className="ml-auto text-lg font-bold text-gray-900">
              {auction.currentBid.toFixed(2)}
              <span className="ml-1 text-sm font-semibold text-[#9945FF]">SOL</span>
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className={cn("flex items-center gap-1 text-xs", urgent ? "text-red-600" : "text-gray-500")}>
              <ClockIcon className="h-3 w-3" />
              <span className="font-medium">{timeLabel}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUpIcon className="h-3 w-3" />
              <span>{auction.sellerShort}</span>
            </div>
          </div>

          <Button
            className="mt-3 w-full h-8 bg-[#3665F3] text-xs hover:bg-[#2952d4]"
            onClick={(e) => {
              e.preventDefault()
              window.location.href = `/auctions/${auction.id}`
            }}
          >
            Place Bid
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}
