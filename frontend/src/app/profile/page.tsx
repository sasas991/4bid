"use client"

import * as React from "react"
import Link from "next/link"
import {
  WalletIcon,
  GavelIcon,
  PackageIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  TrendingUpIcon,
  CopyIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  PlusCircleIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AuctionCard } from "@/components/auction-card"
import { MOCK_AUCTIONS, formatTimeLeft } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// Mock data for the profile
const WALLET_ADDRESS = "7xKp9mNvQwRsLt3uYfEjHcBdAoG6ZiVn"
const WALLET_SHORT = "7xKp...iVn"
const WALLET_BALANCE = "12.45"

const MY_BIDS = [
  {
    id: "b-1",
    auctionId: "1",
    auctionTitle: "MacBook Pro M3 Max 16-inch",
    amount: 28.4,
    status: "leading",
    endsAt: MOCK_AUCTIONS[0].endsAt,
    imageColor: MOCK_AUCTIONS[0].imageColor,
    imageIcon: MOCK_AUCTIONS[0].imageIcon,
  },
  {
    id: "b-2",
    auctionId: "3",
    auctionTitle: "Solana Smart Contract Masterclass",
    amount: 3.2,
    status: "leading",
    endsAt: MOCK_AUCTIONS[2].endsAt,
    imageColor: MOCK_AUCTIONS[2].imageColor,
    imageIcon: MOCK_AUCTIONS[2].imageIcon,
  },
  {
    id: "b-3",
    auctionId: "4",
    auctionTitle: "Sony A7R V Full-Frame Camera",
    amount: 17.0,
    status: "outbid",
    endsAt: MOCK_AUCTIONS[3].endsAt,
    imageColor: MOCK_AUCTIONS[3].imageColor,
    imageIcon: MOCK_AUCTIONS[3].imageIcon,
  },
]

const MY_LISTINGS = MOCK_AUCTIONS.filter((a) =>
  ["2", "5", "7"].includes(a.id)
)

type OrderStatus = "payment_pending" | "paid" | "shipped" | "delivered" | "completed"

const MY_ORDERS: {
  id: string
  auctionTitle: string
  amount: number
  role: "buyer" | "seller"
  status: OrderStatus
  counterparty: string
  updatedAt: string
  imageIcon: string
  imageColor: string
}[] = [
  {
    id: "ord-1",
    auctionTitle: "Vintage Mechanical Keyboard (IBM Model M)",
    amount: 1.85,
    role: "buyer",
    status: "shipped",
    counterparty: "8rFv...Kl",
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    imageIcon: "⌨️",
    imageColor: "from-amber-600 to-yellow-800",
  },
  {
    id: "ord-2",
    auctionTitle: "UI/UX Design System Package",
    amount: 2.1,
    role: "seller",
    status: "payment_pending",
    counterparty: "7yUi...Er",
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    imageIcon: "🎨",
    imageColor: "from-pink-500 to-rose-800",
  },
  {
    id: "ord-3",
    auctionTitle: "Full-Stack Web App Development",
    amount: 12.8,
    role: "seller",
    status: "delivered",
    counterparty: "8vTy...DF",
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    imageIcon: "⚙️",
    imageColor: "from-blue-600 to-indigo-800",
  },
]

const ORDER_LIFECYCLE: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: "payment_pending", label: "Awaiting Payment", icon: <WalletIcon className="h-3.5 w-3.5" /> },
  { key: "paid", label: "Paid", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  { key: "shipped", label: "Shipped", icon: <TruckIcon className="h-3.5 w-3.5" /> },
  { key: "delivered", label: "Delivered", icon: <PackageIcon className="h-3.5 w-3.5" /> },
  { key: "completed", label: "Completed", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
]

const STATUS_ORDER: OrderStatus[] = ["payment_pending", "paid", "shipped", "delivered", "completed"]

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; variant: "warning" | "info" | "success" | "default" | "secondary" }> = {
    payment_pending: { label: "Awaiting Payment", variant: "warning" },
    paid: { label: "Paid", variant: "info" },
    shipped: { label: "Shipped", variant: "info" },
    delivered: { label: "Delivered", variant: "success" },
    completed: { label: "Completed", variant: "success" },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant} className="text-xs">{label}</Badge>
}

function OrderLifecycleBar({ status }: { status: OrderStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(status)
  return (
    <div className="flex items-center gap-1 mt-3">
      {ORDER_LIFECYCLE.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className={cn(
            "flex flex-col items-center gap-0.5",
            i <= currentIdx ? "text-[#3665F3]" : "text-gray-300"
          )}>
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              i < currentIdx ? "bg-[#3665F3] text-white" :
              i === currentIdx ? "ring-2 ring-[#3665F3] text-[#3665F3] bg-white" :
              "bg-gray-100 text-gray-400"
            )}>
              {step.icon}
            </div>
            <span className="text-[9px] font-medium text-center leading-tight hidden sm:block">
              {step.label}
            </span>
          </div>
          {i < ORDER_LIFECYCLE.length - 1 && (
            <div className={cn(
              "flex-1 h-0.5 mb-3",
              i < currentIdx ? "bg-[#3665F3]" : "bg-gray-200"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function ProfilePage() {
  const [walletConnected, setWalletConnected] = React.useState(true)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(WALLET_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leadingBids = MY_BIDS.filter((b) => b.status === "leading")
  const outbidCount = MY_BIDS.filter((b) => b.status === "outbid").length

  if (!walletConnected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm text-center p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3665F3]/10">
            <WalletIcon className="h-7 w-7 text-[#3665F3]" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Connect Your Wallet</h2>
          <p className="mb-6 text-sm text-gray-500">
            Connect your Solana wallet to view your profile, bids, and orders.
          </p>
          <Button className="w-full bg-[#3665F3] hover:bg-[#2952d4]" onClick={() => setWalletConnected(true)}>
            <WalletIcon className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Profile header */}
      <div className="bg-gradient-to-r from-[#3665F3] to-[#2044c7] px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-16 w-16 ring-4 ring-white/30">
              <AvatarFallback className="bg-gradient-to-br from-[#9945FF] to-[#3665F3] text-white text-xl font-bold">
                {WALLET_ADDRESS.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{WALLET_SHORT}</h1>
                <Badge className="border-white/30 bg-white/10 text-white text-xs" variant="outline">
                  <ShieldCheckIcon className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <span className="font-mono text-xs">{WALLET_ADDRESS}</span>
                <button onClick={handleCopy} className="hover:text-white transition-colors">
                  {copied
                    ? <CheckCircleIcon className="h-3.5 w-3.5 text-green-400" />
                    : <CopyIcon className="h-3.5 w-3.5" />
                  }
                </button>
                <a
                  href={`https://explorer.solana.com/address/${WALLET_ADDRESS}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            {/* Stats */}
            <div className="flex gap-6 sm:gap-8">
              {[
                { label: "Balance", value: `${WALLET_BALANCE} SOL` },
                { label: "Active Bids", value: leadingBids.length },
                { label: "Listings", value: MY_LISTINGS.length },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-xl font-bold text-[#14F195]">{stat.value}</div>
                  <div className="text-xs text-blue-200">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6">
        {/* Alert for outbid */}
        {outbidCount > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            <TrendingUpIcon className="h-4 w-4 shrink-0" />
            <span>
              You've been outbid on <strong>{outbidCount}</strong> auction{outbidCount > 1 ? "s" : ""}.{" "}
              <Link href="/auctions" className="underline hover:no-underline">Browse to rebid</Link>
            </span>
          </div>
        )}

        <Tabs defaultValue="bids">
          <TabsList className="mb-6 w-full sm:w-auto bg-white border border-gray-200 p-1">
            <TabsTrigger value="bids" className="gap-1.5 text-sm">
              <GavelIcon className="h-3.5 w-3.5" />
              My Bids
              {leadingBids.length > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#3665F3] text-[10px] text-white font-bold">
                  {leadingBids.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="listings" className="gap-1.5 text-sm">
              <PackageIcon className="h-3.5 w-3.5" />
              My Listings
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 text-sm">
              <TruckIcon className="h-3.5 w-3.5" />
              Orders
            </TabsTrigger>
          </TabsList>

          {/* MY BIDS */}
          <TabsContent value="bids">
            <div className="space-y-3">
              {MY_BIDS.length === 0 ? (
                <Card className="p-10 text-center">
                  <GavelIcon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-600">No bids yet</p>
                  <p className="text-sm text-gray-400 mt-1">Find something you like and place your first bid.</p>
                  <Link href="/auctions">
                    <Button className="mt-4 bg-[#3665F3] hover:bg-[#2952d4]">Browse Auctions</Button>
                  </Link>
                </Card>
              ) : (
                MY_BIDS.map((bid) => {
                  const { label: timeLabel, urgent } = formatTimeLeft(bid.endsAt)
                  return (
                    <Link key={bid.id} href={`/auctions/${bid.auctionId}`}>
                      <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-px cursor-pointer border-gray-200">
                        <CardContent className="p-0">
                          <div className="flex items-center gap-4 p-4">
                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${bid.imageColor} text-2xl`}>
                              {bid.imageIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-sm text-gray-900 line-clamp-1">{bid.auctionTitle}</h3>
                                <Badge
                                  variant={bid.status === "leading" ? "success" : "warning"}
                                  className="shrink-0 text-xs"
                                >
                                  {bid.status === "leading" ? "Leading" : "Outbid"}
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                <span className="font-bold text-gray-900">
                                  {bid.amount.toFixed(2)}{" "}
                                  <span className="text-[#9945FF]">SOL</span>
                                </span>
                                <span className={cn("flex items-center gap-1", urgent && "text-red-600 font-medium")}>
                                  <ClockIcon className="h-3 w-3" />
                                  {timeLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              )}
            </div>
          </TabsContent>

          {/* MY LISTINGS */}
          <TabsContent value="listings">
            <div className="mb-4 flex justify-end">
              <Link href="/create">
                <Button className="bg-[#3665F3] hover:bg-[#2952d4] gap-1.5">
                  <PlusCircleIcon className="h-4 w-4" />
                  New Listing
                </Button>
              </Link>
            </div>
            {MY_LISTINGS.length === 0 ? (
              <Card className="p-10 text-center">
                <PackageIcon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="font-medium text-gray-600">No listings yet</p>
                <Link href="/create">
                  <Button className="mt-4 bg-[#3665F3] hover:bg-[#2952d4]">Create Listing</Button>
                </Link>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {MY_LISTINGS.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders">
            <div className="space-y-4">
              {MY_ORDERS.length === 0 ? (
                <Card className="p-10 text-center">
                  <TruckIcon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-600">No orders yet</p>
                </Card>
              ) : (
                MY_ORDERS.map((order) => (
                  <Card key={order.id} className="overflow-hidden border-gray-200">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${order.imageColor} text-xl`}>
                          {order.imageIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-gray-900 line-clamp-1">{order.auctionTitle}</h3>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {order.role === "buyer" ? "Buying" : "Selling"}
                              </Badge>
                              <OrderStatusBadge status={order.status} />
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                            <span className="font-bold text-gray-900">
                              {order.amount.toFixed(2)}{" "}
                              <span className="text-[#9945FF]">SOL</span>
                            </span>
                            <span>with {order.counterparty}</span>
                            <span>· {formatDate(order.updatedAt)}</span>
                          </div>

                          <OrderLifecycleBar status={order.status} />

                          {/* Action button */}
                          <div className="mt-3">
                            {order.status === "payment_pending" && order.role === "buyer" && (
                              <Button size="sm" className="h-8 bg-[#3665F3] text-xs hover:bg-[#2952d4] gap-1.5">
                                <WalletIcon className="h-3.5 w-3.5" />
                                Pay {order.amount.toFixed(2)} SOL
                              </Button>
                            )}
                            {order.status === "shipped" && order.role === "buyer" && (
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-green-500 text-green-600 hover:bg-green-50">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Confirm Delivery
                              </Button>
                            )}
                            {order.status === "paid" && order.role === "seller" && (
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50">
                                <TruckIcon className="h-3.5 w-3.5" />
                                Mark as Shipped
                              </Button>
                            )}
                            {order.status === "delivered" && (
                              <div className="flex items-center gap-1.5 text-xs text-green-600">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Awaiting final confirmation from {order.role === "buyer" ? "seller" : "buyer"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-8" />

        {/* Wallet info card */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <WalletIcon className="h-4 w-4 text-[#3665F3]" />
              Wallet Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Address", value: WALLET_SHORT, mono: true },
              { label: "Network", value: "Solana Devnet" },
              { label: "Balance", value: `${WALLET_BALANCE} SOL` },
              { label: "Authentication", value: "Wallet signature (no password)" },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className={cn("font-medium text-gray-900", mono && "font-mono text-xs")}>{value}</span>
              </div>
            ))}
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
              onClick={() => setWalletConnected(false)}
            >
              Disconnect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
