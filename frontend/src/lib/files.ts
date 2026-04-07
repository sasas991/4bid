import type { FileRecord } from "@/api/generated"

const isServer = typeof window === "undefined"
const BASE_URL = isServer
  ? (process.env.INTERNAL_API_URL ?? "http://backend:8000")
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")

/**
 * Resolve the display URL for a file.
 *
 * Priority:
 *   1. S3-uploaded file (image_file / avatar_file) → proxied through backend download endpoint
 *   2. Legacy/external image_url or avatar_url string
 *   3. null if neither is set
 *
 * The backend redirects /api/files/download?key=… to a fresh presigned S3 URL,
 * so the browser follows the redirect transparently for <img src={...}>.
 */
export function resolveFileUrl(
  file: Pick<FileRecord, "s3_key"> | null | undefined,
  fallbackUrl: string | null | undefined,
): string | null {
  if (file?.s3_key) {
    return `${BASE_URL}/api/files/download?key=${encodeURIComponent(file.s3_key)}`
  }
  return fallbackUrl ?? null
}
