export interface QuotationLineMathInput {
  qty: string | number | undefined
  unitPrice: string | number | undefined
  discountPercent: string | number | undefined
}

export interface QuotationLineMathResult {
  gross: number
  lineDiscount: number
  rowTotal: number
}

const toNumber = (value: string | number | undefined | null, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const calculateLineTotals = (line: QuotationLineMathInput): QuotationLineMathResult => {
  const qty = Math.max(0, toNumber(line.qty, 0))
  const unitPrice = Math.max(0, toNumber(line.unitPrice, 0))
  const discountPercent = clamp(toNumber(line.discountPercent, 0), 0, 100)
  const gross = qty * unitPrice
  const lineDiscount = gross * (discountPercent / 100)
  const rowTotal = gross - lineDiscount
  return {
    gross,
    lineDiscount,
    rowTotal,
  }
}

export interface QuotationSummaryInput {
  rows: QuotationLineMathInput[]
  deliveryFees: string | number | undefined
}

export interface QuotationSummaryResult {
  subtotal: number
  totalDiscount: number
  grandTotal: number
}

export const calculateQuotationSummary = (
  input: QuotationSummaryInput,
): QuotationSummaryResult => {
  const totals = input.rows.reduce(
    (acc, row) => {
      const line = calculateLineTotals(row)
      acc.subtotal += line.gross
      acc.totalDiscount += line.lineDiscount
      return acc
    },
    { subtotal: 0, totalDiscount: 0 },
  )
  const deliveryFees = Math.max(0, toNumber(input.deliveryFees, 0))
  const grandTotal = totals.subtotal - totals.totalDiscount + deliveryFees
  return {
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    grandTotal,
  }
}

/**
 * A row unit price is auto-managed unless the user manually overrides it.
 */
export const shouldAutoUpdateUnitPrice = (isManualOverride: boolean): boolean => !isManualOverride
