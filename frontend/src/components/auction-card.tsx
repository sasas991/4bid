"use client"

import Link from "next/link"
import { ClockIcon, TrendingUpIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Auction } from "@/api/generated"
import { LotType } from "@/api/generated"
import { cn } from "@/lib/utils"

const LOT_STYLE: Record<string, { label: string; icon: string; color: string }> = {
  [LotType.physical_item]: { label: "Physical", icon: "📦", color: "from-slate-600 to-slate-900" },
  [LotType.information]: { label: "Knowledge", icon: "📚", color: "from-purple-600 to-violet-900" },
  [LotType.physical_service]: { label: "Service", icon: "⚙️", color: "from-blue-600 to-indigo-800" },
  [LotType.digital_service]: { label: "Digital", icon: "💻", color: "from-teal-500 to-emerald-800" },
}

function formatTimeLeft(deadline: string): { label: string; urgent: boolean } {
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return { label: "Ended", urgent: true }
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h < 2) return { label: `${h}h ${m}m left`, urgent: true }
  if (h < 24) return { label: `${h}h ${m}m left`, urgent: false }
  const d = Math.floor(h / 24)
  return { label: `${d}d ${h % 24}h left`, urgent: false }
}

interface AuctionCardProps {
  auction: Auction
  className?: string
}

export function AuctionCard({ auction, className }: AuctionCardProps) {
  const { label: timeLabel, urgent } = formatTimeLeft(auction.deadline)
  const style = LOT_STYLE[auction.lot_type ?? LotType.physical_item]

  return (
    <Link href={`/auctions/${auction.id}`}>
      <Card
        className={cn(
          "group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer border-gray-200",
          className
        )}
      >
        <div
          className={cn(
            "relative flex h-44 items-center justify-center bg-gradient-to-br text-5xl",
            style.color
          )}
        >
          <span>{style.icon}</span>
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge className="text-xs">{style.label}</Badge>
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-900 leading-snug group-hover:text-[#3665F3] transition-colors">
            {auction.title}
          </h3>

          <div className="mb-3 flex items-baseline gap-1">
            <span className="text-xs text-gray-500">Current bid</span>
            <span className="ml-auto text-lg font-bold text-gray-900">
              {auction.current_price.toFixed(2)}
              <span className="ml-1 text-sm font-semibold text-[#9945FF]">SOL</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className={cn("flex items-center gap-1 text-xs", urgent ? "text-red-600" : "text-gray-500")}>
              <ClockIcon className="h-3 w-3" />
              <span className="font-medium">{timeLabel}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUpIcon className="h-3 w-3" />
              <span>{auction.status}</span>
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
