export const CURRENCY_STEP = 250

export function roundDownToCurrencyStep(value: number): number {
  const safe = Math.max(0, value)
  if (!Number.isFinite(safe)) return 0
  return Math.floor(safe / CURRENCY_STEP) * CURRENCY_STEP
}
