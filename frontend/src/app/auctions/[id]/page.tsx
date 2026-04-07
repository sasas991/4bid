"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ClockIcon,
  GavelIcon,
  ShieldCheckIcon,
  WalletIcon,
  CheckCircleIcon,
  PackageIcon,
  TruckIcon,
  XCircleIcon,
  ChevronDownIcon,
  InfoIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { AuctionDetail } from "@/api/generated"
import { AuctionStatus, LotType } from "@/api/generated"
import { api } from "@/api/client"
import { useAuth } from "@/context/auth"
import { cn } from "@/lib/utils"
import { formatDateTimeRu, formatTimeLeftRu } from "@/lib/date"
import { AXIOS_INSTANCE } from "@/api/axios-instance"

const LOT_LABEL: Record<string, string> = {
  [LotType.physical_item]: "Physical",
  [LotType.information]: "Knowledge",
  [LotType.physical_service]: "Service",
  [LotType.digital_service]: "Digital",
}

type LifecycleStep = { icon: React.ReactNode; label: string; status: AuctionStatus[] }
function getLifecycleSteps(lotType: LotType): LifecycleStep[] {
  const base: LifecycleStep[] = [
    { icon: <GavelIcon className="h-4 w-4" />, label: "Bidding", status: [AuctionStatus.active] },
    { icon: <CheckCircleIcon className="h-4 w-4" />, label: "Winner Selected", status: [AuctionStatus.finished] },
    { icon: <WalletIcon className="h-4 w-4" />, label: "Payment", status: [AuctionStatus.paid] },
  ]

  if (lotType === LotType.information) {
    // Information is revealed immediately after payment — no extra steps
    base[2] = { ...base[2], label: "Payment & Access", status: [AuctionStatus.paid, AuctionStatus.completed] }
    return base
  }

  if (lotType === LotType.physical_service || lotType === LotType.digital_service) {
    return [
      ...base,
      { icon: <CheckCircleIcon className="h-4 w-4" />, label: "Service Provided", status: [AuctionStatus.shipped] },
      { icon: <PackageIcon className="h-4 w-4" />, label: "Confirmed", status: [AuctionStatus.completed] },
    ]
  }

  // physical_item — default with shipping
  return [
    ...base,
    { icon: <TruckIcon className="h-4 w-4" />, label: "Shipping", status: [AuctionStatus.shipped] },
    { icon: <PackageIcon className="h-4 w-4" />, label: "Completed", status: [AuctionStatus.completed] },
  ]
}

function lifecycleIndex(steps: LifecycleStep[], status: AuctionStatus): number {
  const idx = steps.findIndex((s) => s.status.includes(status))
  return idx === -1 ? 0 : idx
}

export default function AuctionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState("")
  const [bidPlaced, setBidPlaced] = useState(false)
  const [bidding, setBidding] = useState(false)
  const biddingRef = useRef(false)
  const [finishing, setFinishing] = useState(false)
  const finishingRef = useRef(false)
  const [cancelling, setCancelling] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [error, setError] = useState("")

  const auctionId = Number(params.id)

  useEffect(() => {
    api
      .getAuctionApiAuctionsAuctionIdGet(auctionId)
      .then(setAuction)
      .catch(() => router.push("/auctions"))
      .finally(() => setLoading(false))
  }, [auctionId, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </main>
    )
  }

  if (!auction) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Auction not found</h1>
          <Link href="/auctions">
            <Button className="bg-[#3665F3] hover:bg-[#2952d4]">Browse Auctions</Button>
          </Link>
        </div>
      </main>
    )
  }

  const { label: timeLabel, urgent } = formatTimeLeftRu(auction.deadline)
  const bids = [...(auction.bids ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const minBid = auction.current_price + 0.0001
  const isOwner = user && user.id === auction.owner_id
  const isWinner = user && user.id === auction.winner_id
  const highestBid = auction.bids?.length
    ? [...auction.bids].sort((a, b) => b.amount - a.amount)[0]
    : null
  const isLeadingBidder = !!(user && highestBid && highestBid.user_id === user.id)
  const hasBid = !!(user && auction.bids?.some((b) => b.user_id === user.id))
  const isActive = auction.status === AuctionStatus.active
  const biddingClosed = !isActive || new Date(auction.deadline).getTime() <= Date.now()
  const lotType = auction.lot_type ?? LotType.physical_item
  const lifecycleSteps = getLifecycleSteps(lotType)
  const currentStep = lifecycleIndex(lifecycleSteps, auction.status)
  const lotLabel = LOT_LABEL[lotType]

  const handleBid = async () => {
    if (biddingRef.current) return
    if (biddingClosed) {
      setError("Auction is already ended")
      return
    }
    const amount = parseFloat(bidAmount)
    if (!amount || amount < minBid) {
      setError(`Minimum bid is ${minBid.toFixed(4)} SOL`)
      return
    }
    setError("")
    biddingRef.current = true
    setBidding(true)
    try {
      await api.createBidApiAuctionsAuctionIdBidsPost(auctionId, {
        amount,
        auction_id: auctionId,
        signature: "backend-managed",
      })

      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId)
      setAuction(updated)
      setBidAmount("")
      setBidPlaced(true)
      setTimeout(() => setBidPlaced(false), 4000)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || (err instanceof Error ? err.message : "Bid failed"))
    } finally {
      biddingRef.current = false
      setBidding(false)
    }
  }

  const handleFinishAuction = async () => {
    if (finishingRef.current) return
    setError("")
    finishingRef.current = true
    setFinishing(true)
    try {
      await AXIOS_INSTANCE.post(`/api/auctions/${auctionId}/cancel`)

      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId)
      setAuction(updated)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || (err instanceof Error ? err.message : "Не удалось завершить аукцион"))
    } finally {
      finishingRef.current = false
      setFinishing(false)
    }
  }

  const handleFinalizeAuction = async () => {
    if (finishingRef.current) return
    setError("")
    finishingRef.current = true
    setFinishing(true)
    try {
      await AXIOS_INSTANCE.post(`/api/auctions/${auctionId}/finalize`)

      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId)
      setAuction(updated)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || (err instanceof Error ? err.message : "Не удалось финализировать аукцион"))
    } finally {
      finishingRef.current = false
      setFinishing(false)
    }
  }

  const handleCancelBid = async () => {
    setError("")
    setCancelling(true)
    try {
      await api.cancelBidApiAuctionsAuctionIdBidsDelete(auctionId)
      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId)
      setAuction(updated)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || (err instanceof Error ? err.message : "Не удалось отменить ставку"))
    } finally {
      setCancelling(false)
    }
  }

  const handleStatusUpdate = async () => {
    setStatusUpdating(true)
    setError("")
    try {
      await AXIOS_INSTANCE.post(`/api/auctions/${auctionId}/pay`)
      const updated = await api.getAuctionApiAuctionsAuctionIdGet(auctionId)
      setAuction(updated)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || (err instanceof Error ? err.message : "Не удалось выполнить операцию"))
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="border-b bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-[#3665F3]">Home</Link>
          <span>/</span>
          <Link href="/auctions" className="hover:text-[#3665F3]">Auctions</Link>
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
          <div className="lg:col-span-2 space-y-6">
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
                <Badge>{lotLabel}</Badge>
              </div>
              <p className="text-gray-600 leading-relaxed">{auction.description}</p>
            </div>

            {auction.hidden_content && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-800">Hidden Content (visible to owner/winner)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-green-700">{auction.hidden_content}</p>
                </CardContent>
              </Card>
            )}

            {/* Lifecycle tracker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaction Lifecycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  {lifecycleSteps.map((step, i) => (
                    <div key={step.label} className="flex flex-1 items-center">
                      <div className={cn("flex flex-col items-center gap-1 flex-1",
                        i <= currentStep ? "text-[#3665F3]" : "text-gray-300"
                      )}>
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full",
                          i <= currentStep ? "bg-[#3665F3] text-white" : "bg-gray-100 text-gray-400"
                        )}>
                          {step.icon}
                        </div>
                        <span className="text-xs font-medium text-center leading-tight">{step.label}</span>
                      </div>
                      {i < lifecycleSteps.length - 1 && (
                        <div className={cn("flex-1 h-0.5 mb-4", i < currentStep ? "bg-[#3665F3]" : "bg-gray-100")} />
                      )}
                    </div>
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
                              U{bid.user_id}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-gray-700">User #{bid.user_id}</span>
                              {i === 0 && (
                                <Badge className="text-xs bg-green-100 text-green-700">Leading</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{formatDateTimeRu(bid.timestamp)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            {bid.amount.toFixed(4)}{" "}
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

          {/* Right: Bid panel */}
          <div className="space-y-4">
            <Card className="border-2 border-[#3665F3]/20 shadow-md">
              <CardContent className="p-6">
                <div className="mb-1 text-sm text-gray-500">Current Bid</div>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">
                    {auction.current_price.toFixed(4)}
                  </span>
                  <span className="text-xl font-bold text-[#9945FF]">SOL</span>
                </div>

                <div className={cn(
                  "mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                  urgent ? "bg-red-50 text-red-700" : "bg-blue-50 text-[#3665F3]"
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
                ) : !user ? (
                  <p className="text-center text-sm text-gray-500 py-4">
                    Connect your wallet to place a bid
                  </p>
                ) : isOwner ? (
                  <div className="space-y-3">
                    <p className="text-center text-sm text-gray-500 py-1">
                      Вы владелец этого аукциона
                    </p>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {auction.status === AuctionStatus.finished && auction.winner_id && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                        <CheckCircleIcon className="mx-auto h-6 w-6 text-green-500 mb-1" />
                        <p className="text-sm font-semibold text-green-700">Победитель определён!</p>
                        <p className="text-xs text-green-600 mt-1">
                          Выигрышная ставка: {auction.current_price.toFixed(4)} SOL
                        </p>
                      </div>
                    )}
                    {isActive && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleFinishAuction}
                        disabled={finishing}
                      >
                        {finishing ? "Отменяем..." : "Отменить аукцион"}
                      </Button>
                    )}
                    {auction.status === AuctionStatus.paid && lotType !== LotType.information && (
                      <Button
                        className="w-full bg-[#3665F3] hover:bg-[#2952d4]"
                        onClick={handleStatusUpdate}
                        disabled={statusUpdating}
                      >
                        {lotType === LotType.physical_item ? (
                          <TruckIcon className="mr-2 h-4 w-4" />
                        ) : (
                          <CheckCircleIcon className="mr-2 h-4 w-4" />
                        )}
                        {statusUpdating
                          ? "Подтверждаем..."
                          : lotType === LotType.physical_item
                            ? "Подтвердить отправку"
                            : "Подтвердить оказание услуги"}
                      </Button>
                    )}
                  </div>
                ) : isWinner ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                      <CheckCircleIcon className="mx-auto h-8 w-8 text-green-500 mb-2" />
                      <p className="font-bold text-green-700 text-lg">Вы выиграли!</p>
                      <p className="text-sm text-green-600 mt-1">
                        Ваша ставка {auction.current_price.toFixed(4)} SOL оказалась лучшей
                      </p>
                    </div>
                    {auction.status === AuctionStatus.finished && (
                      <Button
                        className="w-full bg-[#3665F3] hover:bg-[#2952d4]"
                        onClick={handleStatusUpdate}
                        disabled={statusUpdating}
                      >
                        <WalletIcon className="mr-2 h-4 w-4" />
                        {statusUpdating ? "Оплачиваем..." : `Оплатить ${auction.current_price.toFixed(4)} SOL`}
                      </Button>
                    )}
                    {auction.status === AuctionStatus.shipped && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={handleStatusUpdate}
                        disabled={statusUpdating}
                      >
                        <PackageIcon className="mr-2 h-4 w-4" />
                        {statusUpdating
                          ? "Подтверждаем..."
                          : lotType === LotType.physical_item
                            ? "Подтвердить получение"
                            : "Подтвердить выполнение"}
                      </Button>
                    )}
                    {auction.status === AuctionStatus.paid && lotType !== LotType.information && (
                      <p className="text-center text-sm text-gray-500">
                        {lotType === LotType.physical_item
                          ? "Ожидайте отправку от продавца"
                          : "Ожидайте выполнения услуги"}
                      </p>
                    )}
                  </div>
                ) : biddingClosed ? (
                  <p className="text-center text-sm text-gray-500 py-4">
                    {auction.status === AuctionStatus.cancelled ? "Аукцион отменён" : "Аукцион завершён"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 font-medium flex items-center gap-1.5">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Wallet connected:
                      {user.wallet_address
                        ? ` ${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-3)}`
                        : " linked account"}
                    </div>
                    <div>
                      <Label className="mb-1.5 text-sm">Your Bid (SOL)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min={minBid}
                        placeholder={`Min ${minBid.toFixed(4)} SOL`}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="h-11 text-base"
                      />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button
                      className="w-full h-11 bg-[#3665F3] text-base font-semibold hover:bg-[#2952d4]"
                      onClick={handleBid}
                      disabled={bidding}
                    >
                      <GavelIcon className="mr-2 h-4 w-4" />
                      {bidding ? "Placing..." : "Place Bid"}
                    </Button>
                    {hasBid && (
                      <Button
                        variant="outline"
                        className="w-full text-red-600 border-red-200 hover:bg-red-50"
                        onClick={handleCancelBid}
                        disabled={cancelling}
                      >
                        <XCircleIcon className="mr-2 h-4 w-4" />
                        {cancelling ? "Отменяем..." : "Отменить ставку"}
                      </Button>
                    )}
                  </div>
                )}
                {error && !isActive && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </CardContent>
            </Card>

            <Card>
              <button
                onClick={() => setInfoOpen((v) => !v)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <InfoIcon className="h-4 w-4" />
                  Подробная информация
                </span>
                <ChevronDownIcon className={cn("h-4 w-4 text-gray-400 transition-transform", infoOpen && "rotate-180")} />
              </button>
              {infoOpen && (
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Starting price</span>
                    <span className="font-medium">{auction.starting_price.toFixed(4)} SOL</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Current price</span>
                    <span className="font-bold">{auction.current_price.toFixed(4)} SOL</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Lot type</span>
                    <Badge className="text-xs">{lotLabel}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status</span>
                    <Badge variant="outline" className="text-xs capitalize">{auction.status}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total bids</span>
                    <span className="font-medium">{bids.length}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Ends at</span>
                    <span className="font-medium text-xs">{formatDateTimeRu(auction.deadline)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Created</span>
                    <span className="font-medium text-xs">{formatDateTimeRu(auction.created_at)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Auction ID</span>
                    <span className="font-mono text-xs text-gray-600">#{auction.id}</span>
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
                  {auction.winner_id && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Winner</span>
                        <span className="font-mono text-xs">User #{auction.winner_id}</span>
                      </div>
                    </>
                  )}
                  {auction.escrow && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Escrow</span>
                        <Badge variant="outline" className="text-xs capitalize">{auction.escrow.status}</Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Seller</div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-[#9945FF] to-[#3665F3] text-white text-xs font-mono">
                      #{auction.owner_id}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-mono text-sm text-gray-700">Owner #{auction.owner_id}</div>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <ShieldCheckIcon className="h-3 w-3" />
                      Verified wallet
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
