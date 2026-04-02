"use client"

import { useState, Fragment } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, CheckCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { LotType } from "@/api/generated"
import { api } from "@/api/client"
import { useAuth } from "@/context/auth"

const LOT_TYPES = [
  { value: LotType.physical_item, label: "Physical Good", desc: "Electronics, clothing, collectibles, etc.", icon: "📦" },
  { value: LotType.physical_service, label: "Service", desc: "Design, development, consulting, etc.", icon: "⚙️" },
  { value: LotType.information, label: "Knowledge", desc: "Courses, mentoring, access to content", icon: "📚" },
  { value: LotType.digital_service, label: "Digital Service", desc: "Software, bots, scripts, etc.", icon: "💻" },
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
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    title: "",
    description: "",
    lotType: "" as LotType | "",
    startingPrice: "",
    duration: "24",
    hiddenContent: "",
  })

  const updateForm = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const canProceedStep1 =
    form.title.trim().length >= 3 &&
    form.description.trim().length >= 10 &&
    form.lotType

  const canProceedStep2 =
    form.startingPrice &&
    parseFloat(form.startingPrice) > 0

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center p-8">
          <h2 className="mb-2 text-xl font-bold text-gray-900">Connect Wallet</h2>
          <p className="text-gray-500 mb-4">You need to connect your wallet to create an auction.</p>
          <Link href="/">
            <Button className="bg-[#3665F3] hover:bg-[#2952d4]">Go Home</Button>
          </Link>
        </Card>
      </main>
    )
  }

  const handleSubmit = async () => {
    if (!form.lotType) return
    setError("")
    setSubmitting(true)
    try {
      const deadline = new Date(Date.now() + parseInt(form.duration) * 3_600_000)
      const auction = await api.createAuctionApiAuctionsPost({
        title: form.title,
        description: form.description || undefined,
        lot_type: form.lotType,
        starting_price: parseFloat(form.startingPrice),
        deadline: deadline.toISOString(),
        hidden_content: form.hiddenContent || undefined,
      })
      router.push(`/auctions/${auction.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auction")
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
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
            <Fragment key={s}>
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
            </Fragment>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
              <CardDescription>Tell buyers what you&apos;re offering.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">Lot Type *</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <div>
                <Label htmlFor="title" className="mb-1.5 block">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. MacBook Pro M3, Logo design service..."
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  className="h-10"
                />
              </div>

              <div>
                <Label htmlFor="desc" className="mb-1.5 block">Description *</Label>
                <textarea
                  id="desc"
                  rows={4}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Describe your item in detail..."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                />
              </div>

              {form.lotType === LotType.information && (
                <div>
                  <Label htmlFor="hidden" className="mb-1.5 block">Hidden Content (visible to winner only)</Label>
                  <textarea
                    id="hidden"
                    rows={2}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Secret link, password, instructions..."
                    value={form.hiddenContent}
                    onChange={(e) => updateForm("hiddenContent", e.target.value)}
                  />
                </div>
              )}

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

        {/* Step 2 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Auction Settings</CardTitle>
              <CardDescription>Set your price and duration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="price" className="mb-1.5 block">Starting Price (SOL) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.startingPrice}
                  onChange={(e) => updateForm("startingPrice", e.target.value)}
                  className="h-10"
                />
              </div>

              <div>
                <Label className="mb-2 block">Duration</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => updateForm("duration", d.value)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                        form.duration === d.value
                          ? "border-[#3665F3] bg-[#3665F3]/5 text-[#3665F3] font-medium"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  className="bg-[#3665F3] hover:bg-[#2952d4]"
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & List</CardTitle>
              <CardDescription>Confirm your auction details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Title</span>
                  <span className="font-medium text-gray-900">{form.title}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">{LOT_TYPES.find((t) => t.value === form.lotType)?.label}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Starting Price</span>
                  <span className="font-bold text-[#9945FF]">{parseFloat(form.startingPrice).toFixed(2)} SOL</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium">{DURATIONS.find((d) => d.value === form.duration)?.label}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Network</span>
                  <Badge variant="outline" className="text-xs">Solana Devnet</Badge>
                </div>
              </div>

              {form.description && (
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-semibold uppercase text-gray-500 mb-2">Description</div>
                  <p className="text-sm text-gray-700">{form.description}</p>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-[#3665F3]">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Connected as {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button
                  className="bg-[#3665F3] hover:bg-[#2952d4]"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "List Auction"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
