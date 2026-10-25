import { signedRoundDownToCurrencyStep } from '@/utils/currencyRounding'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

interface FormatLedgerAmountOptions {
  fallback?: string
  roundToCurrencyStep?: boolean
}

export function formatLedgerAmount(
  value: unknown,
  fallbackOrOptions: string | FormatLedgerAmountOptions = '—',
): string {
  const options: FormatLedgerAmountOptions = typeof fallbackOrOptions === 'string'
    ? { fallback: fallbackOrOptions }
    : fallbackOrOptions
  const fallback = options.fallback ?? '—'

  if (value == null || value === '') {
    return fallback
  }

  let num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  if (options.roundToCurrencyStep) {
    num = signedRoundDownToCurrencyStep(num)
  }

  const formatted = formatDisplayNumber(Math.abs(num))

  if (num > 0) {
    return `+${formatted}`
  }
  if (num < 0) {
    return `-${formatted}`
  }

  return formatted
}

export function ledgerAmountClass(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) {
    return 'tabular-nums text-foreground'
  }
  if (num > 0) {
    return 'tabular-nums text-green-700 dark:text-green-400'
  }

  return 'tabular-nums text-red-700 dark:text-red-400'
}
