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
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { BN } from "@coral-xyz/anchor"
import { createAuctionOnChain } from "@/lib/chain/tokenization-client"
import { AXIOS_INSTANCE } from "@/api/axios-instance"

const MIN_AUCTION_MINUTES = 1
const MAX_AUCTION_DAYS = 30

const LOT_TYPES = [
  { value: LotType.physical_item, label: "Physical Good", desc: "Electronics, clothing, collectibles, etc.", icon: "📦" },
  { value: LotType.physical_service, label: "Service", desc: "Design, development, consulting, etc.", icon: "⚙️" },
  { value: LotType.information, label: "Knowledge", desc: "Courses, mentoring, access to content", icon: "📚" },
  { value: LotType.digital_service, label: "Digital Service", desc: "Software, bots, scripts, etc.", icon: "💻" },
]

const DURATIONS = [
  { value: "1", label: "1 час" },
  { value: "6", label: "6 часов" },
  { value: "12", label: "12 часов" },
  { value: "24", label: "1 день" },
  { value: "72", label: "3 дня" },
  { value: "168", label: "7 дней" },
]

export default function CreateAuctionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { connection } = useConnection()
  const wallet = useWallet()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState("")

  const [form, setForm] = useState({
    title: "",
    description: "",
    lotType: "" as LotType | "",
    startingPrice: "",
    duration: "24",
    customDeadline: "",
    useCustomDeadline: false,
    hiddenContent: "",
    imageUrl: "",         // manual URL input
    imageFileId: null as number | null,  // S3 upload result
    imagePreviewUrl: "", // presigned URL returned by the upload endpoint
  })
  const [uploadingImage, setUploadingImage] = useState(false)

  const updateForm = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const canProceedStep1 = form.title.trim().length >= 1 && form.lotType !== ""

  const canProceedStep2 =
    form.startingPrice &&
    parseFloat(form.startingPrice) > 0 &&
    (form.useCustomDeadline ? form.customDeadline !== "" : true)

  const parseLocalDatetime = (value: string): Date => {
    const [datePart, timePart] = value.split("T")
    const [year, month, day] = datePart.split("-").map(Number)
    const [hour, minute] = timePart.split(":").map(Number)
    return new Date(year, month - 1, day, hour, minute, 0, 0)
  }

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

  const getDeadline = (): string => {
    if (form.useCustomDeadline && form.customDeadline) {
      return parseLocalDatetime(form.customDeadline).toISOString()
    }
    return new Date(Date.now() + parseInt(form.duration) * 3_600_000).toISOString()
  }

  const validateDeadline = (): string | null => {
    const deadline = new Date(getDeadline()).getTime()
    const minAllowed = Date.now() + MIN_AUCTION_MINUTES * 60_000
    const maxAllowed = Date.now() + MAX_AUCTION_DAYS * 24 * 60 * 60_000

    if (deadline < minAllowed) return `Минимальная длительность аукциона: ${MIN_AUCTION_MINUTES} минута`
    if (deadline > maxAllowed) return `Максимальная длительность аукциона: ${MAX_AUCTION_DAYS} дней`
    return null
  }

  const handleImageUpload = async (file: File | null) => {
    if (!file) return
    setImageError("")

    if (!file.type.startsWith("image/")) {
      setImageError("Можно загрузить только изображение")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setImageError("Максимальный размер изображения: 10MB")
      return
    }

    setUploadingImage(true)
    try {
      const result = await api.uploadFileApiFilesUploadPost(file)
      setForm((prev) => ({
        ...prev,
        imageUrl: "",
        imageFileId: result.id,
        imagePreviewUrl: result.url,
      }))
    } catch {
      setImageError("Ошибка загрузки файла. Попробуйте ещё раз.")
    } finally {
      setUploadingImage(false)
    }
  }

  const getDeadlineLabel = (): string => {
    if (form.useCustomDeadline && form.customDeadline) {
      return new Date(form.customDeadline).toLocaleString("ru-RU")
    }
    return DURATIONS.find((d) => d.value === form.duration)?.label ?? ""
  }

  const handleSubmit = async () => {
    if (!form.lotType) return
    setError("")
    const deadlineError = validateDeadline()
    if (deadlineError) {
      setError(deadlineError)
      return
    }
    setSubmitting(true)
    let createdAuctionId: number | null = null
    try {
      const ensureConnectedWallet = async () => {
        const selected = wallet.wallet
        const selectedName = selected?.adapter.name?.toLowerCase() ?? ""
        const selectedReady = selected?.readyState === "Installed"

        if (!selected || !selectedReady || !selectedName.includes("solflare")) {
          const solflare = wallet.wallets.find(
            (w) =>
              w.adapter.name.toLowerCase().includes("solflare") &&
              w.readyState === "Installed",
          )
          if (!solflare) {
            throw new Error("Solflare extension is not installed or locked")
          }
          if (wallet.wallet?.adapter.name !== solflare.adapter.name) {
            wallet.select(solflare.adapter.name)
          }
        }

        if (!wallet.connected) {
          await wallet.connect()
        }

        const pubkey = wallet.publicKey ?? wallet.wallet?.adapter.publicKey
        if (!pubkey) {
          throw new Error("Connect wallet before creating an on-chain auction")
        }
        if (user.wallet_address && user.wallet_address !== pubkey.toBase58()) {
          throw new Error("Connected wallet does not match your authenticated account")
        }
      }

      await ensureConnectedWallet()

      const auction = await api.createAuctionApiAuctionsPost({
        title: form.title,
        description: form.description || undefined,
        lot_type: form.lotType,
        starting_price: parseFloat(form.startingPrice),
        deadline: getDeadline(),
        hidden_content: form.hiddenContent || undefined,
        image_file_id: form.imageFileId ?? undefined,
        image_url: !form.imageFileId ? (form.imageUrl || undefined) : undefined,
      })
      createdAuctionId = auction.id

      const chain = await createAuctionOnChain({
        connection,
        wallet,
        title: form.title,
        metadataUri: form.imageUrl || `ipfs://4bid/${auction.id}`,
        realWorldRef: `auction:${auction.id}`,
        minBidLamports: new BN(Math.floor(parseFloat(form.startingPrice) * 1_000_000_000)),
        commitDurationSec: 120,
        revealDurationSec: 120,
      })

      await AXIOS_INSTANCE.post(`/api/auctions/${auction.id}/chain/sync`, {
        auction_pubkey: chain.auctionPda,
        asset_pubkey: chain.assetPda,
        mint_pubkey: chain.mint,
        seller_pubkey: chain.sellerPubkey,
        chain_status: chain.chainStatus,
        current_price_lamports: Math.floor(parseFloat(form.startingPrice) * 1_000_000_000),
        last_synced_slot: await connection.getSlot("confirmed"),
      })

      router.push(`/auctions/${auction.id}`)
    } catch (err) {
      const base = err instanceof Error ? err.message : "Failed to create auction"
      if (createdAuctionId) {
        setError(`${base}. Auction #${createdAuctionId} exists in backend, but on-chain initialization failed.`)
      } else {
        setError(base)
      }
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
                <Label htmlFor="desc" className="mb-1.5 block">Description</Label>
                <textarea
                  id="desc"
                  rows={4}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Describe your item in detail..."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Image</Label>
                <div className="space-y-2">
                  {/* File upload — takes priority */}
                  <div>
                    <Label htmlFor="imageUpload" className="mb-1 block text-xs text-gray-500">Upload file (max 10 MB)</Label>
                    <Input
                      id="imageUpload"
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={(e) => void handleImageUpload(e.target.files?.[0] ?? null)}
                      className="h-10"
                    />
                    {uploadingImage && <p className="mt-1 text-xs text-[#3665F3]">Uploading...</p>}
                    {form.imageFileId && !uploadingImage && (
                      <p className="mt-1 text-xs text-green-600">✓ File uploaded</p>
                    )}
                  </div>
                  {/* Manual URL — only if no file uploaded */}
                  {!form.imageFileId && (
                    <div>
                      <Label htmlFor="imageUrl" className="mb-1 block text-xs text-gray-500">Or paste an image URL</Label>
                      <Input
                        id="imageUrl"
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={form.imageUrl}
                        onChange={(e) => updateForm("imageUrl", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  )}
                  {form.imageFileId && (
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => setForm((prev) => ({ ...prev, imageFileId: null, imagePreviewUrl: "" }))}
                    >
                      Remove uploaded file
                    </button>
                  )}
                </div>
                {imageError && <p className="mt-2 text-sm text-red-600">{imageError}</p>}
                {(form.imagePreviewUrl || form.imageUrl) && (
                  <div className="mt-2 rounded-lg overflow-hidden border max-h-48">
                    <img
                      src={form.imagePreviewUrl || form.imageUrl}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                )}
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
                <div className="flex items-center justify-between mb-2">
                  <Label className="block">Duration</Label>
                  <button
                    type="button"
                    className="text-xs text-[#3665F3] hover:underline"
                    onClick={() => updateForm("useCustomDeadline", !form.useCustomDeadline)}
                  >
                    {form.useCustomDeadline ? "Use preset duration" : "Set exact date"}
                  </button>
                </div>

                {form.useCustomDeadline ? (
                  <Input
                    type="datetime-local"
                    value={form.customDeadline}
                    onChange={(e) => updateForm("customDeadline", e.target.value)}
                    className="h-10"
                  />
                ) : (
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
                )}
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
              {(form.imagePreviewUrl || form.imageUrl) && (
                <div className="rounded-xl overflow-hidden border max-h-48">
                  <img src={form.imagePreviewUrl || form.imageUrl} alt={form.title} className="w-full h-48 object-cover" />
                </div>
              )}

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
                  <span className="text-gray-500">Ends</span>
                  <span className="font-medium">{getDeadlineLabel()}</span>
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
                Connected as{" "}
                {user.wallet_address
                  ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
                  : (user.email ?? user.username ?? "Dev User")}
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
