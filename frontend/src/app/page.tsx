"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, ShieldCheckIcon, ZapIcon, GlobeIcon, TrendingUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AuctionCard } from "@/components/auction-card"
import type { Auction } from "@/api/generated"
import { api } from "@/api/client"

const FEATURES = [
  {
    icon: <ShieldCheckIcon className="h-6 w-6 text-[#3665F3]" />,
    title: "Wallet-Based Identity",
    desc: "No registration, no email. Connect your Solana wallet and start bidding instantly.",
  },
  {
    icon: <ZapIcon className="h-6 w-6 text-[#9945FF]" />,
    title: "Signed Bids",
    desc: "Every bid is cryptographically signed with your private key. Tamper-proof and verifiable.",
  },
  {
    icon: <GlobeIcon className="h-6 w-6 text-[#14F195]" />,
    title: "SOL Payments",
    desc: "Pay directly in SOL. Payments verified on-chain via Solana RPC. No banks, no cards.",
  },
  {
    icon: <TrendingUpIcon className="h-6 w-6 text-orange-500" />,
    title: "Transparent Lifecycle",
    desc: "Track every stage from bid to delivery. Full on-chain audit trail for all parties.",
  },
]

export default function HomePage() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getAuctionsApiAuctionsGet({ limit: 50 })
      .then(setAuctions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3665F3] via-[#2952d4] to-[#1a3aa8] px-4 py-16 text-white">
        <div className="relative mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border-white/30 bg-white/10 text-white backdrop-blur-sm" variant="outline">
            <ZapIcon className="mr-1 h-3 w-3" />
            Powered by Solana Blockchain
          </Badge>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Bid, Win, and Pay
            <br />
            <span className="text-[#14F195]">Without Intermediaries</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-blue-100">
            The first decentralized auction platform on Solana. Connect your wallet, place
            cryptographically-signed bids, and settle in SOL — no banks, no middlemen.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/auctions">
              <Button size="lg" className="h-12 bg-white px-8 text-[#3665F3] font-semibold hover:bg-blue-50">
                Browse Auctions
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/create">
              <Button size="lg" className="h-12 bg-white px-8 text-[#3665F3] font-semibold hover:bg-blue-50">
                List Your Item
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Auctions */}
      <section className="bg-white px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Latest Auctions</h2>
            <Link href="/auctions" className="text-sm text-[#3665F3] hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : auctions.length === 0 ? (
            <div className="rounded-xl border bg-gray-50 p-12 text-center">
              <div className="text-4xl mb-3">🏷️</div>
              <h3 className="font-semibold text-gray-900">No auctions yet</h3>
              <p className="mt-1 text-sm text-gray-500">Be the first to create one!</p>
              <Link href="/create">
                <Button className="mt-4 bg-[#3665F3] hover:bg-[#2952d4]">Create Auction</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* How it works */}
      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">How It Works</h2>
          <p className="mb-10 text-gray-500">Four pillars of a trustless auction system</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border p-6 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50">
                  {f.icon}
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
