"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, CheckCircleIcon, WalletIcon, ZapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const LOT_TYPES = [
  { value: "physical", label: "Physical Good", desc: "Electronics, clothing, collectibles, etc.", icon: "📦" },
  { value: "service", label: "Service", desc: "Design, development, consulting, etc.", icon: "⚙️" },
  { value: "knowledge", label: "Knowledge", desc: "Courses, mentoring, access to content", icon: "📚" },
]

const DURATIONS = [
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "1 day" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
]

export default function CreateAuctionPage() {
  const [step, setStep] = React.useState(1)
  const [submitted, setSubmitted] = React.useState(false)
  const [walletConnected, setWalletConnected] = React.useState(false)

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    lotType: "",
    category: "",
    startingPrice: "",
    duration: "24",
  })

  const updateForm = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const canProceedStep1 =
    form.title.trim().length >= 5 &&
    form.description.trim().length >= 20 &&
    form.lotType

  const canProceedStep2 =
    form.category &&
    form.startingPrice &&
    parseFloat(form.startingPrice) > 0

  const handleSubmit = () => {
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Auction Created!</h2>
          <p className="mb-2 text-gray-500">
            Your auction <strong>{form.title}</strong> has been listed.
          </p>
          <Badge variant="success" className="mb-6">Listed on Solana Devnet</Badge>
          <div className="flex flex-col gap-3">
            <Link href="/auctions">
              <Button className="w-full bg-[#3665F3] hover:bg-[#2952d4]">Browse Auctions</Button>
            </Link>
            <Button variant="outline" className="w-full" onClick={() => { setSubmitted(false); setStep(1); setForm({ title: "", description: "", lotType: "", category: "", startingPrice: "", duration: "24" }) }}>
              Create Another
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="border-b bg-white px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <Link href="/auctions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3665F3] mb-4 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Browse
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">List Your Item</h1>
          <p className="mt-1 text-sm text-gray-500">Create a decentralized auction on Solana in minutes.</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-3">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${s <= step ? "text-[#3665F3]" : "text-gray-400"}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  s < step ? "bg-[#3665F3] text-white" :
                  s === step ? "border-2 border-[#3665F3] text-[#3665F3]" :
                  "border-2 border-gray-200 text-gray-400"
                }`}>
                  {s < step ? "✓" : s}
                </div>
                <span className={`hidden sm:inline text-sm font-medium ${s === step ? "text-[#3665F3]" : s < step ? "text-gray-700" : "text-gray-400"}`}>
                  {s === 1 ? "Item Details" : s === 2 ? "Auction Settings" : "Review & List"}
                </span>
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${s < step ? "bg-[#3665F3]" : "bg-gray-200"}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Item details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
              <CardDescription>Tell buyers what you're offering.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Lot type */}
              <div>
                <Label className="mb-2 block">Lot Type *</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {LOT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => updateForm("lotType", type.value)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        form.lotType === type.value
                          ? "border-[#3665F3] bg-[#3665F3]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="mb-1 text-2xl">{type.icon}</div>
                      <div className="font-semibold text-sm text-gray-900">{type.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title" className="mb-1.5 block">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. MacBook Pro M3, Logo design service, React course..."
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  className="h-10"
                />
                <p className="mt-1 text-xs text-gray-400">{form.title.length}/80 characters</p>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="desc" className="mb-1.5 block">Description *</Label>
                <textarea
                  id="desc"
                  rows={5}
                  placeholder="Describe your item in detail. Include condition, specifications, what's included, delivery method, etc."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
                />
                <p className="mt-1 text-xs text-gray-400">{form.description.length} characters (min 20)</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  className="bg-[#3665F3] hover:bg-[#2952d4]"
                  disabled={!canProceedStep1}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Auction settings */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Auction Settings</CardTitle>
              <CardDescription>Set pricing and duration for your auction.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Category */}
              <div>
                <Label className="mb-1.5 block">Category *</Label>
                <Select value={form.category} onValueChange={(v) => updateForm("category", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                    <SelectItem value="Knowledge">Knowledge</SelectItem>
                    <SelectItem value="Collectibles">Collectibles</SelectItem>
                    <SelectItem value="Fashion">Fashion</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Starting price */}
              <div>
                <Label htmlFor="price" className="mb-1.5 block">Starting Price (SOL) *</Label>
                <div className="relative">
                  <Input
                    id="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.5"
                    value={form.startingPrice}
                    onChange={(e) => updateForm("startingPrice", e.target.value)}
                    className="h-10 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#9945FF]">
                    SOL
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  This is the minimum opening bid. Winners pay in SOL directly.
                </p>
              </div>

              {/* Duration */}
              <div>
                <Label className="mb-1.5 block">Auction Duration *</Label>
                <Select value={form.duration} onValueChange={(v) => updateForm("duration", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="bg-[#3665F3] hover:bg-[#2952d4]"
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                >
                  Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Listing</CardTitle>
                <CardDescription>Check everything before publishing to the blockchain.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
                  {[
                    { label: "Title", value: form.title },
                    { label: "Lot Type", value: LOT_TYPES.find((t) => t.value === form.lotType)?.label },
                    { label: "Category", value: form.category },
                    { label: "Starting Price", value: `${form.startingPrice} SOL` },
                    { label: "Duration", value: DURATIONS.find((d) => d.value === form.duration)?.label },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-900">{item.value}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="text-sm">
                    <span className="text-gray-500">Description</span>
                    <p className="mt-1 text-gray-700 text-xs leading-relaxed line-clamp-3">{form.description}</p>
                  </div>
                </div>

                {/* Wallet */}
                {!walletConnected ? (
                  <Button
                    className="w-full h-11 bg-[#3665F3] hover:bg-[#2952d4]"
                    onClick={() => setWalletConnected(true)}
                  >
                    <WalletIcon className="mr-2 h-4 w-4" />
                    Connect Wallet to Publish
                  </Button>
                ) : (
                  <>
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 font-medium flex items-center gap-1.5">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Wallet connected: 7xKp...iVn · Ready to sign
                    </div>
                    <Button
                      className="w-full h-11 bg-[#3665F3] text-base font-semibold hover:bg-[#2952d4]"
                      onClick={handleSubmit}
                    >
                      <ZapIcon className="mr-2 h-4 w-4" />
                      Sign & Publish Auction
                    </Button>
                    <p className="text-center text-xs text-gray-400">
                      Your wallet will sign the listing. No SOL required to list.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back to Settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
