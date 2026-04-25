export interface TieredPriceRow {
  quantity_from?: string | number
  quantity_to?: string | number
  price?: string | number
}

const toNumber = (value: string | number | undefined | null, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/**
 * Returns the best unit price for the given quantity:
 * - first matching tier price (inclusive range)
 * - otherwise base price
 */
export const getTieredUnitPrice = (
  qty: string | number | undefined,
  basePrice: string | number | undefined,
  tiers: TieredPriceRow[] | undefined,
): number => {
  const quantity = Math.max(0, toNumber(qty, 0))
  const fallbackPrice = Math.max(0, toNumber(basePrice, 0))
  if (!Array.isArray(tiers) || !tiers.length) return fallbackPrice

  for (const tier of tiers) {
    const from = Math.max(0, toNumber(tier.quantity_from, 0))
    const to = Math.max(from, toNumber(tier.quantity_to, from))
    if (quantity >= from && quantity <= to) {
      return Math.max(0, toNumber(tier.price, fallbackPrice))
    }
  }

  return fallbackPrice
}
