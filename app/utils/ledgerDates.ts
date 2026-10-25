export function isoDateFromPicker(value: string): string | undefined {
  const raw = value.trim()
  if (!raw) {
    return undefined
  }

  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) {
      return undefined
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!isoMatch) {
    return undefined
  }

  return raw
}

export function pickerDateFromIso(value: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!isoMatch) {
    return value
  }

  return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`
}

export function todayPickerDate(): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String(now.getFullYear())

  return `${day}-${month}-${year}`
}
