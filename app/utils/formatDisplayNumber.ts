import { roundDownToCurrencyStep } from '@/utils/currencyRounding'

interface FormatDisplayNumberOptions {
  locale?: string
  fallback?: string
}

export function formatDisplayNumber(
  value: unknown,
  options: FormatDisplayNumberOptions = {},
): string {
  const fallback = options.fallback ?? '—'

  if (value == null || value === '') {
    return fallback
  }

  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  // Always Western digits (0-9) and en-US grouping, regardless of UI language.
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    numberingSystem: 'latn',
  }).format(num)
}

export function formatDisplayGrandTotal(
  value: unknown,
  options: FormatDisplayNumberOptions = {},
): string {
  const fallback = options.fallback ?? '—'

  if (value == null || value === '') {
    return fallback
  }

  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  return formatDisplayNumber(roundDownToCurrencyStep(num), options)
}
