export interface WarehouseMovementReferenceInput {
  type?: string | null
  id?: number | null
}

/**
 * Maps warehouse movement reference.type + id to an in-app detail route.
 * Returns null when the type is unknown or id is invalid.
 */
export function warehouseMovementReferencePath(
  reference: WarehouseMovementReferenceInput | null | undefined,
): string | null {
  if (!reference) return null
  const id = Number(reference.id)
  if (!Number.isFinite(id) || id <= 0) return null

  const type = String(reference.type ?? '').trim().toLowerCase().replace(/-/g, '_')

  if (type.includes('purchase')) return `/purchase-bills/show/${id}`
  if (type.includes('transport') || type.includes('distributor')) return `/transport-invoices/show/${id}`
  if (type.includes('damage')) return `/damage-records/show/${id}`
  if (type.includes('return')) return `/invoice-returns/show/${id}`
  if (type.includes('sale') || type === 'invoice' || type.includes('sales_invoice')) return `/invoices/show/${id}`
  if (type.includes('reassign')) return null

  return null
}
