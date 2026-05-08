interface FormatDisplayDateOptions {
  withTime?: boolean
  fallback?: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDisplayDate(
  value: unknown,
  options: FormatDisplayDateOptions = {},
): string {
  const fallback = options.fallback ?? '—'

  if (value == null || value === '') {
    return fallback
  }

  const raw = String(value).trim()
  if (!raw) {
    return fallback
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return raw
  }

  const day = pad2(date.getDate())
  const month = pad2(date.getMonth() + 1)
  const year = String(date.getFullYear())

  if (!options.withTime) {
    return `${day}-${month}-${year}`
  }

  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  return `${day}-${month}-${year} ${hours}:${minutes}`
}
