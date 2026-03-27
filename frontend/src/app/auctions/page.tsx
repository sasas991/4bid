"use client"

import * as React from "react"
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AuctionCard } from "@/components/auction-card"
import { MOCK_AUCTIONS, CATEGORIES, type LotType } from "@/lib/mock-data"

const LOT_TYPE_FILTERS: { id: LotType | "all"; label: string }[] = [
  { id: "all", label: "All Types" },
  { id: "physical", label: "Physical" },
  { id: "service", label: "Service" },
  { id: "knowledge", label: "Knowledge" },
]

export default function AuctionsPage() {
  const [search, setSearch] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [selectedType, setSelectedType] = React.useState<LotType | "all">("all")
  const [sortBy, setSortBy] = React.useState("ending_soon")

  const filtered = React.useMemo(() => {
    let results = [...MOCK_AUCTIONS]

    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      )
    }

    if (selectedCategory !== "all") {
      results = results.filter(
        (a) => a.category.toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    if (selectedType !== "all") {
      results = results.filter((a) => a.lotType === selectedType)
    }

    switch (sortBy) {
      case "ending_soon":
        results.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
        break
      case "highest_bid":
        results.sort((a, b) => b.currentBid - a.currentBid)
        break
      case "lowest_bid":
        results.sort((a, b) => a.currentBid - b.currentBid)
        break
      case "most_bids":
        results.sort((a, b) => b.bids.length - a.bids.length)
        break
    }

    return results
  }, [search, selectedCategory, selectedType, sortBy])

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="border-b bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Browse Auctions</h1>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search items, services, knowledge..."
                className="pl-9 h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button className="h-10 bg-[#3665F3] hover:bg-[#2952d4]">
              <SearchIcon className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Search</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap gap-4 items-start">
          {/* Sidebar filters */}
          <aside className="w-full sm:w-56 shrink-0">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SlidersHorizontalIcon className="h-4 w-4" />
                Filters
              </div>

              {/* Category */}
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Category
                </div>
                <div className="flex flex-col gap-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        selectedCategory === cat.id
                          ? "bg-[#3665F3] text-white font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lot type */}
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Lot Type
                </div>
                <div className="flex flex-col gap-1">
                  {LOT_TYPE_FILTERS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedType(t.id)}
                      className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        selectedType === t.id
                          ? "bg-[#3665F3] text-white font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {(selectedCategory !== "all" || selectedType !== "all" || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-gray-500"
                  onClick={() => {
                    setSelectedCategory("all")
                    setSelectedType("all")
                    setSearch("")
                  }}
                >
                  Reset filters
                </Button>
              )}
            </div>
          </aside>

          {/* Results */}
          <div className="min-w-0 flex-1">
            {/* Sort bar */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-medium text-gray-900">{filtered.length}</span> results
                {selectedCategory !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCategory}
                  </Badge>
                )}
                {selectedType !== "all" && (
                  <Badge variant="info" className="text-xs">
                    {selectedType}
                  </Badge>
                )}
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ending_soon">Ending Soon</SelectItem>
                  <SelectItem value="highest_bid">Highest Bid</SelectItem>
                  <SelectItem value="lowest_bid">Lowest Bid</SelectItem>
                  <SelectItem value="most_bids">Most Bids</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border bg-white p-12 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <h3 className="font-semibold text-gray-900">No auctions found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search query.</p>
                <Button
                  className="mt-4 bg-[#3665F3] hover:bg-[#2952d4]"
                  onClick={() => {
                    setSelectedCategory("all")
                    setSelectedType("all")
                    setSearch("")
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
