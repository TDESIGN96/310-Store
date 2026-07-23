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

export function toPickerDate(normalizedYmd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedYmd.trim())
  if (!match) return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

export function todayPickerDate(): string {
  return toPickerDate(todayNormalizedDate())
}

const localDateFromNormalized = (normalizedYmd: string): Date => {
  const [year, month, day] = normalizedYmd.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

const formatLocalNormalized = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addLocalDays = (normalizedYmd: string, days: number): string => {
  const date = localDateFromNormalized(normalizedYmd)
  date.setDate(date.getDate() + days)
  return formatLocalNormalized(date)
}

export const REPORT_DATE_PRESETS = [
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_year',
  'previous_year',
] as const

export type ReportDatePresetId = typeof REPORT_DATE_PRESETS[number]

export interface ReportDatePresetRange {
  from: string
  to: string
}

export function getReportDatePresetRange(id: ReportDatePresetId): ReportDatePresetRange {
  const today = todayNormalizedDate()
  const todayLocal = localDateFromNormalized(today)
  const year = todayLocal.getFullYear()

  if (id === 'today') {
    return { from: toPickerDate(today), to: toPickerDate(today) }
  }
  if (id === 'yesterday') {
    const yesterday = addLocalDays(today, -1)
    return { from: toPickerDate(yesterday), to: toPickerDate(yesterday) }
  }
  if (id === 'last_7_days') {
    return { from: toPickerDate(addLocalDays(today, -6)), to: toPickerDate(today) }
  }
  if (id === 'last_30_days') {
    return { from: toPickerDate(addLocalDays(today, -29)), to: toPickerDate(today) }
  }
  if (id === 'this_year') {
    return {
      from: toPickerDate(`${year}-01-01`),
      to: toPickerDate(today),
    }
  }

  const previousYear = year - 1
  return {
    from: toPickerDate(`${previousYear}-01-01`),
    to: toPickerDate(`${previousYear}-12-31`),
  }
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
