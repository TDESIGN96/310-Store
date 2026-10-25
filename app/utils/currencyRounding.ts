export const CURRENCY_STEP = 250

export function roundDownToCurrencyStep(value: number): number {
  const safe = Math.max(0, value)
  if (!Number.isFinite(safe)) return 0
  return Math.floor(safe / CURRENCY_STEP) * CURRENCY_STEP
}

export function signedRoundDownToCurrencyStep(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return 0
  }

  const sign = value < 0 ? -1 : 1
  return sign * roundDownToCurrencyStep(Math.abs(value))
}
