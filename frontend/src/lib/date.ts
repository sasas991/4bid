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
