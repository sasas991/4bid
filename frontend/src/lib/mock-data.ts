export type LotType = "physical" | "service" | "knowledge"
export type AuctionStatus = "active" | "ending_soon" | "ended" | "pending"

export interface Bid {
  id: string
  bidder: string
  bidderShort: string
  amount: number
  timestamp: string
}

export interface Auction {
  id: string
  title: string
  description: string
  lotType: LotType
  status: AuctionStatus
  startingPrice: number
  currentBid: number
  bids: Bid[]
  endsAt: string
  seller: string
  sellerShort: string
  imageColor: string
  imageIcon: string
  category: string
  featured?: boolean
}

const now = Date.now()

export const MOCK_AUCTIONS: Auction[] = [
  {
    id: "1",
    title: "MacBook Pro M3 Max 16-inch",
    description:
      "Like new MacBook Pro M3 Max with 128GB RAM, 8TB SSD. Purchased 3 months ago, selling because upgraded to workstation. Includes original box, charger, and accessories.",
    lotType: "physical",
    status: "ending_soon",
    startingPrice: 5,
    currentBid: 28.4,
    endsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    seller: "7xKp9mNvQwRsLt3uYfEjHcBdAoG6ZiVn",
    sellerShort: "7xKp...iVn",
    imageColor: "from-slate-700 to-slate-900",
    imageIcon: "💻",
    category: "Electronics",
    featured: true,
    bids: [
      { id: "b1", bidder: "3aRt5kLmPqWx", bidderShort: "3aRt...Wx", amount: 28.4, timestamp: new Date(now - 15 * 60 * 1000).toISOString() },
      { id: "b2", bidder: "9mNvQwRsLtYf", bidderShort: "9mNv...Yf", amount: 26.1, timestamp: new Date(now - 45 * 60 * 1000).toISOString() },
      { id: "b3", bidder: "2cHjBdAoGZiV", bidderShort: "2cHj...iV", amount: 22.0, timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      { id: "b4", bidder: "5pEfKqUyXnMs", bidderShort: "5pEf...Ms", amount: 18.5, timestamp: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "2",
    title: "Full-Stack Web App Development (40h)",
    description:
      "Professional full-stack development service. 40 hours of work, React/Next.js frontend + FastAPI backend. Includes deployment setup on VPS. Previous clients include 3 funded startups.",
    lotType: "service",
    status: "active",
    startingPrice: 2,
    currentBid: 12.8,
    endsAt: new Date(now + 18 * 60 * 60 * 1000).toISOString(),
    seller: "4nFrPsKgCxZbMw",
    sellerShort: "4nFr...Mw",
    imageColor: "from-blue-600 to-indigo-800",
    imageIcon: "⚙️",
    category: "Services",
    featured: true,
    bids: [
      { id: "b5", bidder: "8vTyUiOpAsDF", bidderShort: "8vTy...DF", amount: 12.8, timestamp: new Date(now - 30 * 60 * 1000).toISOString() },
      { id: "b6", bidder: "1qWeRtYuIoPl", bidderShort: "1qWe...Pl", amount: 10.5, timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "3",
    title: "Solana Smart Contract Masterclass",
    description:
      "Lifetime access to comprehensive Solana development course. 60+ hours of content covering Anchor framework, DeFi protocols, NFT programs, and more. Includes Discord community access.",
    lotType: "knowledge",
    status: "active",
    startingPrice: 0.5,
    currentBid: 3.2,
    endsAt: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
    seller: "6yHjKlMnBvCxZ",
    sellerShort: "6yHj...xZ",
    imageColor: "from-purple-600 to-violet-900",
    imageIcon: "📚",
    category: "Knowledge",
    featured: true,
    bids: [
      { id: "b7", bidder: "0zXcVbNmAsQw", bidderShort: "0zXc...Qw", amount: 3.2, timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString() },
      { id: "b8", bidder: "7uYtRePwQaZx", bidderShort: "7uYt...Zx", amount: 2.8, timestamp: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
      { id: "b9", bidder: "3sSdFgHjKlZx", bidderShort: "3sSd...Zx", amount: 2.0, timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "4",
    title: "Sony A7R V Full-Frame Camera",
    description:
      "Sony A7R V mirrorless camera body only. 61MP sensor, excellent condition, ~5k shutter count. Includes original packaging and accessories. Shutter count verified.",
    lotType: "physical",
    status: "active",
    startingPrice: 3,
    currentBid: 19.7,
    endsAt: new Date(now + 8 * 60 * 60 * 1000).toISOString(),
    seller: "2mNbVcXzLkJhG",
    sellerShort: "2mNb...hG",
    imageColor: "from-gray-600 to-gray-900",
    imageIcon: "📷",
    category: "Electronics",
    bids: [
      { id: "b10", bidder: "9pOiUyTrEwQa", bidderShort: "9pOi...Qa", amount: 19.7, timestamp: new Date(now - 20 * 60 * 1000).toISOString() },
      { id: "b11", bidder: "4sAzXcVbNmQw", bidderShort: "4sAz...Qw", amount: 17.0, timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "5",
    title: "1-on-1 DeFi Strategy Mentoring (5 sessions)",
    description:
      "5 one-hour mentoring sessions with a DeFi analyst with 4+ years experience. Topics: yield farming, liquidity provision, risk management, on-chain analytics. Via Google Meet.",
    lotType: "service",
    status: "active",
    startingPrice: 1,
    currentBid: 6.5,
    endsAt: new Date(now + 52 * 60 * 60 * 1000).toISOString(),
    seller: "5tGbHnJmKlOi",
    sellerShort: "5tGb...Oi",
    imageColor: "from-teal-500 to-emerald-800",
    imageIcon: "🧑‍💼",
    category: "Services",
    bids: [
      { id: "b12", bidder: "1wErTyUiOpAs", bidderShort: "1wEr...As", amount: 6.5, timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "6",
    title: "Vintage Mechanical Keyboard (IBM Model M)",
    description:
      "Original IBM Model M keyboard from 1989, fully functional. Buckling spring switches, legendary typing feel. Cleaned and tested. USB adapter included.",
    lotType: "physical",
    status: "ending_soon",
    startingPrice: 0.2,
    currentBid: 1.85,
    endsAt: new Date(now + 1.5 * 60 * 60 * 1000).toISOString(),
    seller: "8rFvGbHnJmKl",
    sellerShort: "8rFv...Kl",
    imageColor: "from-amber-600 to-yellow-800",
    imageIcon: "⌨️",
    category: "Collectibles",
    bids: [
      { id: "b13", bidder: "6tYuIoPlKjHg", bidderShort: "6tYu...Hg", amount: 1.85, timestamp: new Date(now - 10 * 60 * 1000).toISOString() },
      { id: "b14", bidder: "2qWeRtYuIoPa", bidderShort: "2qWe...Pa", amount: 1.5, timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString() },
      { id: "b15", bidder: "9oPlKjHgFdSa", bidderShort: "9oPl...Sa", amount: 1.0, timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "7",
    title: "UI/UX Design System Package",
    description:
      "Complete Figma design system with 400+ components, 12 themes, mobile + desktop variants. Previously sold for $299. Includes lifetime updates and commercial license.",
    lotType: "knowledge",
    status: "active",
    startingPrice: 0.3,
    currentBid: 2.1,
    endsAt: new Date(now + 72 * 60 * 60 * 1000).toISOString(),
    seller: "3eDcRfVtGbHn",
    sellerShort: "3eDc...Hn",
    imageColor: "from-pink-500 to-rose-800",
    imageIcon: "🎨",
    category: "Knowledge",
    bids: [
      { id: "b16", bidder: "7yUiOpAsQwEr", bidderShort: "7yUi...Er", amount: 2.1, timestamp: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "8",
    title: "Nvidia RTX 5090 Founders Edition",
    description:
      "Brand new in box Nvidia RTX 5090 FE. Retail price $1999. Selling because building a new workstation. Sealed box, full warranty.",
    lotType: "physical",
    status: "active",
    startingPrice: 8,
    currentBid: 42.0,
    endsAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    seller: "1sWxEdCrFvTg",
    sellerShort: "1sWx...Tg",
    imageColor: "from-green-500 to-emerald-900",
    imageIcon: "🖥️",
    category: "Electronics",
    featured: true,
    bids: [
      { id: "b17", bidder: "5rTyUiOpAsQw", bidderShort: "5rTy...Qw", amount: 42.0, timestamp: new Date(now - 5 * 60 * 1000).toISOString() },
      { id: "b18", bidder: "8eWrTyUiOpAs", bidderShort: "8eWr...As", amount: 38.5, timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      { id: "b19", bidder: "2sAzXcVbNmQw", bidderShort: "2sAz...Qw", amount: 35.0, timestamp: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
    ],
  },
]

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "electronics", label: "Electronics" },
  { id: "services", label: "Services" },
  { id: "knowledge", label: "Knowledge" },
  { id: "collectibles", label: "Collectibles" },
]

export function getAuction(id: string): Auction | undefined {
  return MOCK_AUCTIONS.find((a) => a.id === id)
}

export function getFeaturedAuctions(): Auction[] {
  return MOCK_AUCTIONS.filter((a) => a.featured)
}

export function getAuctionsByCategory(category: string): Auction[] {
  if (category === "all") return MOCK_AUCTIONS
  return MOCK_AUCTIONS.filter(
    (a) => a.category.toLowerCase() === category.toLowerCase()
  )
}

export function formatTimeLeft(endsAt: string): { label: string; urgent: boolean } {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return { label: "Ended", urgent: true }
  const h = Math.floor(ms / (1000 * 60 * 60))
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (h < 2) return { label: `${h}h ${m}m left`, urgent: true }
  if (h < 24) return { label: `${h}h ${m}m left`, urgent: false }
  const d = Math.floor(h / 24)
  return { label: `${d}d ${h % 24}h left`, urgent: false }
}

export function lotTypeLabel(type: LotType): string {
  return { physical: "Physical", service: "Service", knowledge: "Knowledge" }[type]
}
