export function normalizePickerDate(value: string): string | undefined {
  const raw = value.trim()
  if (!raw) return undefined

  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!isoMatch) return undefined
  const year = Number(isoMatch[1])
  const month = Number(isoMatch[2])
  const day = Number(isoMatch[3])
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function toIsoDateTimeStart(value: string): string | undefined {
  const normalized = normalizePickerDate(value)
  if (!normalized) return undefined
  return `${normalized}T00:00:00.000Z`
}

export function toIsoDateTimeEnd(value: string): string | undefined {
  const normalized = normalizePickerDate(value)
  if (!normalized) return undefined
  return `${normalized}T23:59:59.999Z`
}

export function todayNormalizedDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isFuturePickerDate(value: string): boolean {
  const normalized = normalizePickerDate(value)
  if (!normalized) return false
  return normalized > todayNormalizedDate()
}

export function isFromAfterToPickerDate(from: string, to: string): boolean {
  const fromNorm = normalizePickerDate(from)
  const toNorm = normalizePickerDate(to)
  if (!fromNorm || !toNorm) return false
  return fromNorm > toNorm
}
