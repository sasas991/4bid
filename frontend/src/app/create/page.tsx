"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LotType } from "@/api/generated";
import { api } from "@/api/client";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LOT_TYPES = [
  { value: LotType.physical_item, label: "Physical Item" },
  { value: LotType.information, label: "Information" },
  { value: LotType.physical_service, label: "Physical Service" },
  { value: LotType.digital_service, label: "Digital Service" },
];

export default function CreateAuctionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lotType, setLotType] = useState<LotType>(LotType.physical_item);
  const [startingPrice, setStartingPrice] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hiddenContent, setHiddenContent] = useState("");

  if (!user) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Connect your wallet to create an auction.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const auction = await api.createAuctionApiAuctionsPost({
        title,
        description: description || undefined,
        lot_type: lotType,
        starting_price: parseFloat(startingPrice),
        deadline: new Date(deadline).toISOString(),
        hidden_content: hiddenContent || undefined,
      });
      router.push(`/auction/${auction.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Create Auction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Lot Type</Label>
            <Select
              value={lotType}
              onValueChange={(v) => setLotType(v as LotType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="price">Starting Price (SOL)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {lotType === LotType.information && (
            <div className="space-y-1">
              <Label htmlFor="hidden">
                Hidden Content (visible to winner only)
              </Label>
              <Textarea
                id="hidden"
                rows={2}
                value={hiddenContent}
                onChange={(e) => setHiddenContent(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Auction"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
