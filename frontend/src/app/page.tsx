import Link from "next/link"
import { ArrowRightIcon, ShieldCheckIcon, ZapIcon, GlobeIcon, TrendingUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AuctionCard } from "@/components/auction-card"
import { getFeaturedAuctions, MOCK_AUCTIONS } from "@/lib/mock-data"

const CATEGORY_CARDS = [
  { id: "electronics", label: "Electronics", icon: "💻", color: "from-slate-600 to-slate-900", count: 142 },
  { id: "services", label: "Services", icon: "⚙️", color: "from-blue-600 to-indigo-800", count: 89 },
  { id: "knowledge", label: "Knowledge", icon: "📚", color: "from-purple-600 to-violet-900", count: 56 },
  { id: "collectibles", label: "Collectibles", icon: "🏆", color: "from-amber-500 to-orange-800", count: 34 },
]

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
  const featured = getFeaturedAuctions()
  const endingSoon = MOCK_AUCTIONS.filter((a) => a.status === "ending_soon")

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
            cryptographically-signed bids, and settle in SOL — no banks, no accounts, no middlemen.
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

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { value: "321+", label: "Active Auctions" },
              { value: "1,240+", label: "Bids Placed" },
              { value: "842 SOL", label: "Volume Traded" },
              { value: "0%", label: "Platform Fee" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-[#14F195]">{stat.value}</div>
                <div className="text-sm text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Browse by Category</h2>
            <Link href="/auctions" className="text-sm text-[#3665F3] hover:underline flex items-center gap-1">
              See all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CATEGORY_CARDS.map((cat) => (
              <Link key={cat.id} href={`/auctions?category=${cat.id}`}>
                <div className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${cat.color} p-6 text-white transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer`}>
                  <div className="mb-2 text-3xl">{cat.icon}</div>
                  <div className="font-semibold">{cat.label}</div>
                  <div className="text-sm text-white/70">{cat.count} items</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Ending Soon */}
      {endingSoon.length > 0 && (
        <section className="bg-red-50 px-4 py-10 border-y border-red-100">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-xl font-bold text-gray-900">Ending Soon</h2>
              </div>
              <Link href="/auctions?filter=ending_soon" className="text-sm text-[#3665F3] hover:underline flex items-center gap-1">
                View all <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {endingSoon.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Auctions */}
      <section className="bg-white px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Featured Auctions</h2>
            <Link href="/auctions" className="text-sm text-[#3665F3] hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* How it works */}
      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900">How 4BID Works</h2>
            <p className="mt-2 text-gray-500">Decentralized auction in 4 simple steps</p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 ring-2 ring-gray-100">
                  {feature.icon}
                </div>
                <h3 className="mb-1.5 font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-[#9945FF] to-[#3665F3] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-3 text-2xl font-bold">Ready to start bidding?</h2>
          <p className="mb-6 text-purple-100">
            Connect your Solana wallet and join thousands of users already trading on 4BID.
          </p>
          <Link href="/auctions">
            <Button size="lg" className="h-12 bg-white px-10 text-[#3665F3] font-semibold hover:bg-gray-50">
              Explore Auctions
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-900 px-4 py-8 text-gray-400">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3665F3]">
                <ZapIcon className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-white">
                <span className="text-[#3665F3]">4</span>BID
              </span>
              <span className="text-xs text-gray-600 ml-1">Decentralized Auction on Solana</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/auctions" className="hover:text-white transition-colors">Browse</Link>
              <Link href="/create" className="hover:text-white transition-colors">Sell</Link>
              <Link href="/profile" className="hover:text-white transition-colors">Profile</Link>
            </div>
          </div>
          <Separator className="my-6 bg-gray-800" />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600">
            <span>© 2025 4BID. Decentralized. No platform fees.</span>
            <span>Built on Solana Devnet</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
