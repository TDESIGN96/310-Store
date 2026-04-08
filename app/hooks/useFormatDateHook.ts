export type FormatDateInput = string | number | Date | null | undefined

/**
 * Returns an ISO 8601 string with date and time in UTC (e.g. 2026-04-08T14:30:00.000Z), or null if missing/invalid.
 */
export default function formatDateToIso(input: FormatDateInput): string | null {
  if (input === null || input === undefined || input === '') {
    return null
  }

  const d = input instanceof Date ? input : new Date(input)

  if (Number.isNaN(d.getTime())) {
    return null
  }

  return d.toISOString()
}
