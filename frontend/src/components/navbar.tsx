"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SearchIcon, WalletIcon, PlusCircleIcon, ZapIcon, LogOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth"
import { WalletConnectDialog } from "@/components/wallet-connect-dialog"

const NAV_LINKS = [
  { href: "/auctions", label: "Browse" },
  { href: "/my/auctions", label: "My Auctions" },
]

export function Navbar() {
  const pathname = usePathname()
  const { user, isLoading, logout } = useAuth()
  const [connectOpen, setConnectOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      {/* Top bar */}
      <div className="border-b border-gray-100 bg-[#3665F3] px-4 py-1">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-xs text-blue-100">
            Powered by Solana · No fees · No intermediaries
          </span>
          <div className="flex items-center gap-4 text-xs text-blue-100">
            {user && (
              <>
                <Link href="/my/auctions" className="hover:text-white transition-colors">
                  My Bids
                </Link>
                <Link href="/profile" className="hover:text-white transition-colors">
                  Profile
                </Link>
                <span className="text-blue-200">
                  {user.balance.toFixed(2)} SOL
                </span>
              </>
            )}
            <Link href="/create" className="hover:text-white transition-colors font-medium">
              + Sell
            </Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3665F3]">
              <ZapIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#3665F3]">4</span>
              <span className="text-gray-900">BID</span>
            </span>
          </Link>

          {/* Search */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search auctions, items, services..."
                className="h-10 rounded-lg border-gray-300 pl-9 text-sm focus-visible:border-[#3665F3] focus-visible:ring-[#3665F3]/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery)
                    window.location.href = `/auctions?q=${encodeURIComponent(searchQuery)}`
                }}
              />
            </div>
            <Button
              className="h-10 bg-[#3665F3] px-5 text-sm hover:bg-[#2952d4]"
              onClick={() => {
                if (searchQuery) window.location.href = `/auctions?q=${encodeURIComponent(searchQuery)}`
              }}
            >
              Search
            </Button>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/create">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-[#3665F3] text-[#3665F3] hover:bg-[#3665F3]/5">
                <PlusCircleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">List Item</span>
              </Button>
            </Link>
            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200" />
            ) : user ? (
              <>
                <Link href="/profile">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 gap-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                  >
                    <WalletIcon className="h-4 w-4" />
                    <span className="hidden sm:inline font-mono text-xs">
                      {user.wallet_address
                        ? `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-3)}`
                        : user.email ?? user.username ?? "Account"}
                    </span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => {
                    if (window.confirm("Выйти из аккаунта?")) logout()
                  }}
                  title="Выйти"
                >
                  <LogOutIcon className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-[#3665F3] text-white hover:bg-[#2952d4]"
                onClick={() => setConnectOpen(true)}
              >
                <WalletIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category nav */}
      <nav className="border-t border-gray-100 px-4">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors hover:text-[#3665F3]",
                pathname === link.href.split("?")[0]
                  ? "border-b-2 border-[#3665F3] text-[#3665F3]"
                  : "text-gray-600"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <WalletConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </header>
  )
}
