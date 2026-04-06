export function formatSolBalance(balance: number): string {
  if (!Number.isFinite(balance)) return "0"

  const absBalance = Math.abs(balance)
  if (absBalance === 0) return "0"

  // Keep tiny balances visible instead of rounding to 0.00
  if (absBalance < 0.01) {
    return balance.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
  }

  return balance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}