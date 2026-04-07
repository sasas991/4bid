const RU_LOCALE = "ru-RU"

/** Backend returns naive UTC datetimes without Z suffix — ensure UTC parsing */
function parseUTC(iso: string): Date {
  if (!iso.endsWith("Z") && !iso.includes("+") && !/\d{2}-\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso + "Z")
  }
  return new Date(iso)
}

export function formatDateTimeRu(iso: string) {
  return parseUTC(iso).toLocaleString(RU_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateRu(iso: string) {
  return parseUTC(iso).toLocaleDateString(RU_LOCALE)
}

export function formatTimeLeftRu(deadline: string): { label: string; urgent: boolean } {
  const ms = parseUTC(deadline).getTime() - Date.now()
  if (ms <= 0) return { label: "Завершен", urgent: true }

  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return { label: `${days}д ${hours}ч`, urgent: false }
  if (hours > 0) return { label: `${hours}ч ${minutes}м`, urgent: hours < 2 }
  return { label: `${minutes}м`, urgent: true }
}

/** Returns milliseconds remaining until deadline (0 if expired). */
export function getDeadlineMs(deadline: string): number {
  return Math.max(0, parseUTC(deadline).getTime() - Date.now())
}

/**
 * Format a countdown from remaining milliseconds.
 * - >= 1 hour: HH:MM:SS
 * - >= 1 minute: MM:SS
 * - < 1 minute: 0:SS
 * - expired: "Завершён"
 */
export function formatCountdown(ms: number): { label: string; urgent: boolean; expired: boolean } {
  if (ms <= 0) return { label: "Завершён", urgent: true, expired: true }

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => String(n).padStart(2, "0")

  if (hours > 0) {
    return { label: `${hours}:${pad(minutes)}:${pad(seconds)}`, urgent: false, expired: false }
  }
  return {
    label: `${minutes}:${pad(seconds)}`,
    urgent: minutes < 1,
    expired: false,
  }
}
