import { defineStore } from 'pinia'
import type { QuotationProductOption } from '@/composables/useQuotationProducts'
import {
  calculateLineTotals,
  calculateQuotationSummary,
  formatTo2DecimalString,
  shouldAutoUpdateUnitPrice,
  type QuotationLineMathInput,
  type QuotationSummaryResult,
} from '@/utils/quotationMath'
import { getTieredUnitPrice } from '@/utils/tieredUnitPrice'

export interface InvoicePagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type InvoiceStatus = 'issued' | 'paid' | 'partially_returned' | 'returned' | string

export const INVOICE_STATUS_OPTIONS = ['pending', 'printed', 'ready', 'shipped', 'delivered', 'settled', 'returned', 'partially_returned'] as const
export type InvoiceStatusOption = typeof INVOICE_STATUS_OPTIONS[number]

/** Statuses that cannot be selected again once an invoice is returned or partially returned. */
export const RETURNED_LOCKED_STATUS_OPTIONS = ['pending', 'printed', 'ready', 'shipped', 'delivered', 'settled'] as const

const INVOICE_STATUS_RANK: Record<string, number> = {
  pending: 1,
  printed: 2,
  ready: 3,
  shipped: 4,
  delivered: 5,
  settled: 6,
  returned: 7,
  partially_returned: 7,
}

export const isBackwardInvoiceStatusChange = (current: string | undefined, next: string) => {
  const from = current ? INVOICE_STATUS_RANK[current] : undefined
  const to = INVOICE_STATUS_RANK[next]
  if (from === undefined || to === undefined) return false
  return to < from
}

export const isInvoiceStatusOptionDisabled = (
  currentStatus: string | undefined,
  option: string,
): boolean => {
  if (currentStatus !== 'returned' && currentStatus !== 'partially_returned') return false
  return (RETURNED_LOCKED_STATUS_OPTIONS as readonly string[]).includes(option)
}

export type InvoiceReturnStatus = 'returned' | 'partially_returned'

/** Full return when every available line is returned at its full remaining qty. */
export const resolveInvoiceStatusAfterReturn = (
  availableItems: Array<{ invoice_item_id: number; original_qty: number }>,
  returnedItems: Array<{ invoice_item_id: number; qty: number }>,
): InvoiceReturnStatus => {
  if (!availableItems.length || !returnedItems.length) return 'partially_returned'

  const returnedById = new Map<number, number>()
  for (const item of returnedItems) {
    const id = Number(item.invoice_item_id)
    const qty = Number(item.qty)
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) continue
    returnedById.set(id, (returnedById.get(id) ?? 0) + qty)
  }

  const isFullReturn = availableItems.every((item) => {
    const returnedQty = returnedById.get(Number(item.invoice_item_id)) ?? 0
    return returnedQty >= Number(item.original_qty)
  })

  return isFullReturn ? 'returned' : 'partially_returned'
}

export interface InvoiceListItem {
  id: number
  reference_number: string
  warehouse_id: number | null
  warehouse_name_ar: string
  warehouse_name_en: string
  customer_name: string
  district_name: string
  distributor_id: number | null
  distributor_name_ar: string
  distributor_name_en: string
  invoice_date: string
  supply_date: string
  status: InvoiceStatus
  status_label: string
  shipment_code: string
  shipment_status: number | null
  shipment_status_label: string
  total_discount: number
  grand_total: number
  return_reference: string
  return_reference_number: string
  can_be_edited: boolean
  can_be_deleted: boolean
}

export interface InvoiceReturnFormItem {
  invoice_item_id: number
  product_id: number | null
  variation_id: number | null
  description: string
  product_name_ar: string
  product_name_en: string
  variation_label: string
  original_qty: number
}

export interface InvoiceReturnCreateItemPayload {
  invoice_item_id: number
  qty: number
}

export interface InvoiceReturnCreatePayload {
  reason: string | null
  return_date: string | null
  items: InvoiceReturnCreateItemPayload[]
}

export interface InvoiceReturnActor {
  id: number
  name: string
  email: string
}

export interface InvoiceReturnListItem {
  id: number
  return_reference: string
  reference_number: string
  invoice_id: number
  return_date: string
  reason: string
  created_by: InvoiceReturnActor | null
}

export interface InvoiceReturnItem {
  id: number
  invoice_return_id: number
  invoice_item_id: number
  product_id: number
  variation_id: number
  qty: number
  invoice_item: Record<string, unknown> | null
  product: Record<string, unknown> | null
  variation: Record<string, unknown> | null
}

export interface InvoiceReturnRecord {
  id: number
  return_reference: string
  reference_number: string
  invoice_id: number
  reason: string
  return_date: string
  items: InvoiceReturnItem[]
  created_by: InvoiceReturnActor | null
}

export interface InvoiceReturnListResult {
  returns: InvoiceReturnListItem[]
  pagination: InvoicePagination
}

export interface InvoiceDraftItem {
  key: string
  product_id: number | null
  variation_id: number | null
  product: QuotationProductOption | null
  description: string
  qty: number
  unit_price: number
  discount_mode: 'fixed' | 'percentage'
  discount_value: number
  unit_price_manual: boolean
}

export type InvoiceDeliveryBy = 'shipping_company' | 'delivery_agent' | 'other'

export interface InvoiceDraft {
  id: number | null
  reference_number: string
  warehouse_id: number | null
  district_id: number | null
  description: string
  address: string
  customer_name: string
  customer_mobile: string
  customer_email: string
  invoice_date: string
  supply_date: string
  send_to_shipping: boolean
  terms: string
  notes: string
  delivery_fees: number
  other_fees: number
  delivery_by: InvoiceDeliveryBy
  delivery_agent_name: string
  delivery_agent_mobile: string
  attachment_path: string
  items: InvoiceDraftItem[]
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const normalizePercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

const normalizeNonNegative = (value: number, fallback = 0): number => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

const createEmptyItem = (): InvoiceDraftItem => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  product_id: null,
  variation_id: null,
  product: null,
  description: '',
  qty: 1,
  unit_price: 0,
  discount_mode: 'percentage',
  discount_value: 0,
  unit_price_manual: false,
})

const createEmptyDraft = (): InvoiceDraft => ({
  id: null,
  reference_number: '',
  warehouse_id: null,
  district_id: null,
  description: '',
  address: '',
  customer_name: '',
  customer_mobile: '',
  customer_email: '',
  invoice_date: todayIso(),
  supply_date: todayIso(),
  send_to_shipping: false,
  terms: '',
  notes: '',
  delivery_fees: 0,
  other_fees: 0,
  delivery_by: 'shipping_company',
  delivery_agent_name: '',
  delivery_agent_mobile: '',
  attachment_path: '',
  items: [createEmptyItem()],
})

const getVariationPrice = (item: InvoiceDraftItem): number => {
  if (!item.product) return 0
  if (!item.variation_id) return item.product.price
  const variation = item.product.variations.find(v => v.id === item.variation_id)
  if (!variation) return item.product.price
  return getTieredUnitPrice(
    item.qty,
    variation.resolved_price || variation.price || item.product.price,
    variation.tiered_prices,
  )
}

export const useInvoicesStore = defineStore('invoices', () => {
  const { $api } = useApi()
  const INVOICES_ENDPOINT = '/v1/invoices'
  const INVOICE_RETURNS_ENDPOINT = '/v1/invoice-returns'
  const draft = ref<InvoiceDraft>(createEmptyDraft())
  const submitting = ref(false)
  const list = ref<InvoiceListItem[]>([])
  const listLoading = ref(false)
  const pagination = ref<InvoicePagination>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const currentInvoice = ref<Record<string, unknown> | null>(null)

  const toNumber = (value: unknown, fallback = 0): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }
  const toFiniteNumberOrUndefined = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined
    if (typeof value === 'string' && value.trim() === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  }

  const resolveSendToShipping = (invoice: Record<string, unknown>): boolean => {
    const shipmentCode = String(invoice.shipment_code ?? '').trim()
    if (!shipmentCode) return false

    const raw = invoice.send_to_shipping
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'boolean') return raw
      if (typeof raw === 'number') return raw !== 0
      if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase()
        if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
        if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
      }
    }
    if (shipmentCode) return true
    if (invoice.shipment_status !== null && invoice.shipment_status !== undefined && String(invoice.shipment_status).trim() !== '') {
      return true
    }
    return false
  }

  const normalizeStatus = (value: unknown): InvoiceStatus => {
    const status = String(value ?? '').toLowerCase()
    if (status === 'issued' || status === 'paid' || status === 'partially_returned' || status === 'returned') return status
    return status || 'issued'
  }

  const normalizeDeliveryBy = (value: unknown): InvoiceDeliveryBy => {
    const raw = String(value ?? '').trim().toLowerCase()
    if (raw === 'delivery_agent' || raw === 'other') return raw
    return 'shipping_company'
  }

  const extractPagination = (payload: unknown): InvoicePagination | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const raw = (nested?.pagination ?? root.pagination ?? null) as Record<string, unknown> | null
    if (!raw) return null
    return {
      current_page: toNumber(raw.current_page, 1),
      last_page: toNumber(raw.last_page, 1),
      per_page: toNumber(raw.per_page, 15),
      total: toNumber(raw.total, 0),
    }
  }

  const normalizeListItem = (payload: Record<string, unknown>): InvoiceListItem => {
    const warehouse = (payload.warehouse && typeof payload.warehouse === 'object' ? payload.warehouse : null) as Record<string, unknown> | null
    const district = (payload.district && typeof payload.district === 'object' ? payload.district : null) as Record<string, unknown> | null
    const distributor = (payload.distributor && typeof payload.distributor === 'object' ? payload.distributor : null) as Record<string, unknown> | null
    const returnEntity = (
      payload.return && typeof payload.return === 'object' ? payload.return : null
    ) as Record<string, unknown> | null
    const shipmentCode = String(payload.shipment_code ?? '').trim()
    const shipmentStatusLabel = String(payload.shipment_status_label ?? '').trim()
    const returnReference = String(
      payload.return_reference
      ?? payload.return_reference_number
      ?? returnEntity?.reference_number
      ?? payload.return_ref_id
      ?? '',
    ).trim()
    return {
      id: toNumber(payload.id, 0),
      reference_number: String(payload.reference_number ?? ''),
      warehouse_id: toNumber(payload.warehouse_id ?? warehouse?.id, 0) || null,
      warehouse_name_ar: String(warehouse?.name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? ''),
      customer_name: String(payload.customer_name ?? ''),
      district_name: String(district?.district ?? payload.district_name ?? ''),
      distributor_id: toNumber(payload.distributor_id ?? distributor?.id, 0) || null,
      distributor_name_ar: String(distributor?.name_ar ?? payload.distributor_name_ar ?? ''),
      distributor_name_en: String(distributor?.name_en ?? payload.distributor_name_en ?? ''),
      invoice_date: String(payload.invoice_date ?? ''),
      supply_date: String(payload.supply_date ?? ''),
      status: normalizeStatus(payload.status),
      status_label: String(payload.status_label ?? payload.status ?? ''),
      shipment_code: shipmentCode,
      shipment_status: toFiniteNumberOrUndefined(payload.shipment_status) ?? null,
      shipment_status_label: shipmentStatusLabel,
      total_discount: toNumber(payload.total_discount, 0),
      grand_total: toNumber(payload.grand_total, 0),
      return_reference: returnReference,
      return_reference_number: returnReference,
      can_be_edited: payload.can_be_edited === true
        || payload.can_be_edited === 1
        || payload.can_be_edited === '1',
      can_be_deleted: payload.can_be_deleted === true
        || payload.can_be_deleted === 1
        || payload.can_be_deleted === '1',
    }
  }

  const extractList = (payload: unknown): InvoiceListItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (nested?.invoices ?? root.invoices ?? []) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows
      .map(row => normalizeListItem((row ?? {}) as Record<string, unknown>))
      .filter(row => row.id > 0)
  }

  const extractInvoice = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const invoice = (nested?.invoice ?? root.invoice ?? null) as Record<string, unknown> | null
    return invoice && typeof invoice === 'object' ? invoice : null
  }

  const extractReturnFormItems = (invoice: Record<string, unknown>): InvoiceReturnFormItem[] => {
    const rows = Array.isArray(invoice.items) ? invoice.items : []
    return rows
      .map((raw) => {
        const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
        const product = (
          item.product && typeof item.product === 'object' ? item.product : null
        ) as Record<string, unknown> | null
        const variation = (
          item.variation && typeof item.variation === 'object' ? item.variation : null
        ) as Record<string, unknown> | null
        return {
          invoice_item_id: toNumber(item.id, 0),
          product_id: toNumber(item.product_id, 0) || null,
          variation_id: toNumber(item.variation_id, 0) || null,
          description: String(item.description ?? ''),
          product_name_ar: String(product?.name_ar ?? ''),
          product_name_en: String(product?.name_en ?? ''),
          variation_label: String(variation?.label ?? variation?.sku ?? ''),
          original_qty: Math.max(0, toNumber(item.qty, 0)),
        }
      })
      .filter(item => item.invoice_item_id > 0 && item.original_qty > 0)
  }

  const normalizeReturnActor = (value: unknown): InvoiceReturnActor | null => {
    if (!value || typeof value !== 'object') return null
    const raw = value as Record<string, unknown>
    const id = toNumber(raw.id, 0)
    const name = String(raw.name ?? '').trim()
    const email = String(raw.email ?? '').trim()
    if (!id && !name && !email) return null
    return { id, name, email }
  }

  const normalizeReturnItem = (value: unknown): InvoiceReturnItem | null => {
    if (!value || typeof value !== 'object') return null
    const raw = value as Record<string, unknown>
    return {
      id: toNumber(raw.id, 0),
      invoice_return_id: toNumber(raw.invoice_return_id, 0),
      invoice_item_id: toNumber(raw.invoice_item_id, 0),
      product_id: toNumber(raw.product_id, 0),
      variation_id: toNumber(raw.variation_id, 0),
      qty: Math.max(0, toNumber(raw.qty, 0)),
      invoice_item: raw.invoice_item && typeof raw.invoice_item === 'object' ? raw.invoice_item as Record<string, unknown> : null,
      product: raw.product && typeof raw.product === 'object' ? raw.product as Record<string, unknown> : null,
      variation: raw.variation && typeof raw.variation === 'object' ? raw.variation as Record<string, unknown> : null,
    }
  }

  const normalizeInvoiceReturnListItem = (value: unknown): InvoiceReturnListItem | null => {
    if (!value || typeof value !== 'object') return null
    const raw = value as Record<string, unknown>
    const id = toNumber(raw.id, 0)
    if (id <= 0) return null
    const returnReference = String(raw.return_reference ?? raw.reference_number ?? '').trim()
    return {
      id,
      return_reference: returnReference,
      reference_number: returnReference,
      invoice_id: toNumber(raw.invoice_id, 0),
      return_date: String(raw.return_date ?? ''),
      reason: String(raw.reason ?? ''),
      created_by: normalizeReturnActor(raw.created_by),
    }
  }

  const normalizeInvoiceReturnRecord = (value: unknown): InvoiceReturnRecord | null => {
    if (!value || typeof value !== 'object') return null
    const raw = value as Record<string, unknown>
    const id = toNumber(raw.id, 0)
    if (id <= 0) return null
    const itemsRaw = Array.isArray(raw.items) ? raw.items : []
    const returnReference = String(raw.return_reference ?? raw.reference_number ?? '').trim()
    return {
      id,
      return_reference: returnReference,
      reference_number: returnReference,
      invoice_id: toNumber(raw.invoice_id, 0),
      reason: String(raw.reason ?? ''),
      return_date: String(raw.return_date ?? ''),
      items: itemsRaw.map(item => normalizeReturnItem(item)).filter((x): x is InvoiceReturnItem => Boolean(x)),
      created_by: normalizeReturnActor(raw.created_by),
    }
  }

  const extractInvoiceReturn = (payload: unknown): InvoiceReturnRecord | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    return normalizeInvoiceReturnRecord(nested?.return ?? root.return ?? null)
  }

  const extractInvoiceReturns = (payload: unknown): InvoiceReturnListItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (nested?.returns ?? root.returns ?? []) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows.map(row => normalizeInvoiceReturnListItem(row)).filter((x): x is InvoiceReturnListItem => Boolean(x))
  }

  const resolveHydratedDiscount = (
    item: Record<string, unknown>,
    qty: number,
  ): { mode: 'fixed' | 'percentage', value: number } => {
    const discountPercent = toNumber(item.discount_percent, NaN)
    if (Number.isFinite(discountPercent)) {
      return { mode: 'percentage', value: normalizePercent(discountPercent) }
    }

    // Fixed discount is now row-level (group qty), so hydrate as total line discount.
    const perUnitDiscount = Math.max(0, toNumber(item.discount, NaN))
    if (Number.isFinite(perUnitDiscount)) {
      return { mode: 'fixed', value: perUnitDiscount * Math.max(1, qty) }
    }

    const lineDiscount = Math.max(0, toNumber(item.line_discount, NaN))
    if (Number.isFinite(lineDiscount)) {
      return { mode: 'fixed', value: lineDiscount }
    }

    return { mode: 'percentage', value: 0 }
  }

  const normalizeVariationOption = (raw: Record<string, unknown>) => ({
    id: toNumber(raw.id, 0),
    sku: String(raw.sku ?? ''),
    barcode: String(raw.barcode ?? ''),
    price: toNumber(raw.price, 0),
    resolved_price: toNumber(raw.resolved_price ?? raw.price, 0),
    is_active: true,
    is_available: true,
    label: String(raw.label ?? raw.sku ?? ''),
    tiered_prices: (Array.isArray(raw.tiered_prices) ? raw.tiered_prices : []).map((tierRaw) => {
      const tier = tierRaw as Record<string, unknown>
      return {
        quantity_from: toNumber(tier.quantity_from, 0),
        quantity_to: toNumber(tier.quantity_to, 0),
        price: toNumber(tier.price, 0),
      }
    }),
  })

  const loadVariationMapForProducts = async (productIds: number[]): Promise<Map<number, ReturnType<typeof normalizeVariationOption>[]>> => {
    const uniqueIds = [...new Set(productIds.filter(id => Number.isFinite(id) && id > 0))]
    const entries = await Promise.all(uniqueIds.map(async (productId) => {
      try {
        const response = await $api(`/products/${productId}/variations`)
        const root = (response && typeof response === 'object') ? response as Record<string, unknown> : {}
        const nested = (root.data && typeof root.data === 'object') ? root.data as Record<string, unknown> : null
        const rows = (nested?.variations ?? root.variations ?? []) as unknown[]
        const mapped = Array.isArray(rows)
          ? rows
            .map(row => normalizeVariationOption((row ?? {}) as Record<string, unknown>))
            .filter(variation => variation.id > 0)
          : []
        return [productId, mapped] as [number, ReturnType<typeof normalizeVariationOption>[]]
      }
      catch {
        return [productId, [] as ReturnType<typeof normalizeVariationOption>[]] as [number, ReturnType<typeof normalizeVariationOption>[]]
      }
    }))
    return new Map(entries)
  }

  const hydrateDraftFromInvoice = (invoice: Record<string, unknown>) => {
    const items = (Array.isArray(invoice.items) ? invoice.items : [])
      .map((rawItem) => {
        const item = rawItem as Record<string, unknown>
        const productRaw = (item.product && typeof item.product === 'object' ? item.product : null) as Record<string, unknown> | null
        const variationRaw = (item.variation && typeof item.variation === 'object' ? item.variation : null) as Record<string, unknown> | null
        const mappedVariations = (Array.isArray(productRaw?.variations) ? productRaw.variations : [])
          .map((rawVariation) => {
            const variation = rawVariation as Record<string, unknown>
            return {
              id: toNumber(variation.id, 0),
              sku: String(variation.sku ?? ''),
              barcode: String(variation.barcode ?? ''),
              price: toNumber(variation.price, 0),
              resolved_price: toNumber(variation.resolved_price ?? variation.price, 0),
              is_active: true,
              is_available: true,
              label: String(variation.label ?? variation.sku ?? ''),
              tiered_prices: (Array.isArray(variation.tiered_prices) ? variation.tiered_prices : []).map((tierRaw) => {
                const tier = tierRaw as Record<string, unknown>
                return {
                  quantity_from: toNumber(tier.quantity_from, 0),
                  quantity_to: toNumber(tier.quantity_to, 0),
                  price: toNumber(tier.price, 0),
                }
              }),
            }
          })
          .filter(v => v.id > 0)

        const selectedVariationId = toNumber(item.variation_id ?? variationRaw?.id, 0)
        const hasSelectedVariation = selectedVariationId > 0 && mappedVariations.some(v => v.id === selectedVariationId)
        if (!hasSelectedVariation && variationRaw && selectedVariationId > 0) {
          mappedVariations.unshift({
            id: selectedVariationId,
            sku: String(variationRaw.sku ?? ''),
            barcode: String(variationRaw.barcode ?? ''),
            price: toNumber(variationRaw.price, 0),
            resolved_price: toNumber(variationRaw.resolved_price ?? variationRaw.price, 0),
            is_active: true,
            is_available: true,
            label: String(variationRaw.label ?? variationRaw.sku ?? ''),
            tiered_prices: (Array.isArray(variationRaw.tiered_prices) ? variationRaw.tiered_prices : []).map((tierRaw) => {
              const tier = tierRaw as Record<string, unknown>
              return {
                quantity_from: toNumber(tier.quantity_from, 0),
                quantity_to: toNumber(tier.quantity_to, 0),
                price: toNumber(tier.price, 0),
              }
            }),
          })
        }

        const product: QuotationProductOption | null = productRaw
          ? {
              id: toNumber(productRaw.id, 0),
              name_ar: String(productRaw.name_ar ?? ''),
              name_en: String(productRaw.name_en ?? ''),
              barcode: String(productRaw.barcode ?? ''),
              price: toNumber(productRaw.price, 0),
              is_available: true,
              is_combo: Boolean(productRaw.is_combo),
              variations: mappedVariations,
            }
          : null

        const qty = Math.max(1, toNumber(item.qty, 1))
        const hydratedDiscount = resolveHydratedDiscount(item, qty)
        return {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          product_id: toNumber(item.product_id ?? product?.id, 0) || null,
          variation_id: selectedVariationId || null,
          product,
          description: String(item.description ?? ''),
          qty,
          unit_price: Math.max(0, toNumber(item.unit_price, 0)),
          discount_mode: hydratedDiscount.mode,
          discount_value: hydratedDiscount.value,
          unit_price_manual: true,
        }
      })
      .filter(item => item.product_id)

    draft.value = {
      id: toNumber(invoice.id, 0) || null,
      reference_number: String(invoice.reference_number ?? ''),
      warehouse_id: toNumber(invoice.warehouse_id ?? ((invoice.warehouse as Record<string, unknown> | null)?.id), 0) || null,
      district_id: toNumber(
        invoice.district_id
        ?? ((invoice.district as Record<string, unknown> | null)?.id),
        0,
      ) || null,
      description: String(invoice.description ?? ''),
      address: String(invoice.address ?? ''),
      customer_name: String(invoice.customer_name ?? ''),
      customer_mobile: String(invoice.customer_mobile ?? ''),
      customer_email: String(invoice.customer_email ?? ''),
      invoice_date: String(invoice.invoice_date ?? todayIso()),
      supply_date: String(invoice.supply_date ?? todayIso()),
      send_to_shipping: resolveSendToShipping(invoice),
      terms: String(invoice.terms ?? ''),
      notes: String(invoice.notes ?? ''),
      delivery_fees: Math.max(
        0,
        toNumber(
          invoice.delivery_fees
          ?? ((invoice.district as Record<string, unknown> | null)?.delivery_fee),
          0,
        ),
      ),
      other_fees: Math.max(
        0,
        toNumber(
          toFiniteNumberOrUndefined(invoice.other_fees)
          ?? toFiniteNumberOrUndefined((invoice.district as Record<string, unknown> | null)?.other_fees),
          0,
        ),
      ),
      delivery_by: normalizeDeliveryBy(invoice.delivery_by),
      delivery_agent_name: String(invoice.delivery_agent_name ?? ''),
      delivery_agent_mobile: String(invoice.delivery_agent_mobile ?? ''),
      attachment_path: '',
      items: items.length ? items : [createEmptyItem()],
    }
    const resolvedAttachment = [invoice.attachment_url, invoice.attachment_path, invoice.attachment]
      .map(value => String(value ?? '').trim())
      .find(Boolean) || ''
    draft.value.attachment_path = resolvedAttachment
  }

  const hydrateDraftFromQuotationForConvert = async (quotation: Record<string, unknown>) => {
    const sourceItems = Array.isArray(quotation.items) ? quotation.items : []
    const productIds = sourceItems
      .map((rawItem) => {
        const item = rawItem as Record<string, unknown>
        const productRaw = (item.product && typeof item.product === 'object' ? item.product : null) as Record<string, unknown> | null
        return toNumber(item.product_id ?? productRaw?.id, 0)
      })
      .filter(id => id > 0)
    const variationMap = await loadVariationMapForProducts(productIds)

    const items = sourceItems
      .map((rawItem) => {
        const item = rawItem as Record<string, unknown>
        const productRaw = (item.product && typeof item.product === 'object' ? item.product : null) as Record<string, unknown> | null
        const variationRaw = (item.variation && typeof item.variation === 'object' ? item.variation : null) as Record<string, unknown> | null
        const productId = toNumber(item.product_id ?? productRaw?.id, 0)
        const fallbackVariations = (Array.isArray(productRaw?.variations) ? productRaw.variations : [])
          .map(rawVariation => normalizeVariationOption(rawVariation as Record<string, unknown>))
          .filter(v => v.id > 0)
        const mappedVariations = [...(variationMap.get(productId) ?? fallbackVariations)]

        const selectedVariationId = toNumber(item.variation_id ?? variationRaw?.id, 0)
        const hasSelectedVariation = selectedVariationId > 0 && mappedVariations.some(v => v.id === selectedVariationId)
        if (!hasSelectedVariation && variationRaw && selectedVariationId > 0) {
          mappedVariations.unshift(normalizeVariationOption(variationRaw))
        }

        const nameAr = String(productRaw?.name_ar ?? item.product_name_ar ?? item.product_name ?? '')
        const nameEn = String(productRaw?.name_en ?? item.product_name_en ?? item.product_name ?? '')
        const product: QuotationProductOption | null = productId > 0
          ? {
              id: productId,
              name_ar: nameAr,
              name_en: nameEn,
              barcode: String(productRaw?.barcode ?? ''),
              price: toNumber(productRaw?.price ?? item.unit_price, 0),
              is_available: true,
              is_combo: Boolean(productRaw?.is_combo),
              variations: mappedVariations,
            }
          : null

        const qty = Math.max(1, toNumber(item.qty, 1))
        const hydratedDiscount = resolveHydratedDiscount(item, qty)
        return {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          product_id: toNumber(item.product_id ?? product?.id, 0) || null,
          variation_id: selectedVariationId || null,
          product,
          description: String(item.description ?? ''),
          qty,
          unit_price: Math.max(0, toNumber(item.unit_price, 0)),
          discount_mode: hydratedDiscount.mode,
          discount_value: hydratedDiscount.value,
          unit_price_manual: true,
        }
      })
      .filter(item => item.product_id)

    const quotationFallbackDelivery = Math.max(
      0,
      toNumber(quotation.grand_total, 0) - toNumber(quotation.subtotal, 0) + toNumber(quotation.total_discount, 0),
    )
    const resolvedConvertedDeliveryFees = toFiniteNumberOrUndefined(quotation.delivery_fees)
      ?? toFiniteNumberOrUndefined(quotation.delivery_fee)
      ?? toFiniteNumberOrUndefined((quotation.district as Record<string, unknown> | null)?.delivery_fee)
      ?? quotationFallbackDelivery
    const resolvedConvertedOtherFees = toFiniteNumberOrUndefined(quotation.other_fees)
      ?? toFiniteNumberOrUndefined((quotation.district as Record<string, unknown> | null)?.other_fees)
      ?? 0

    draft.value = {
      id: null,
      reference_number: '',
      warehouse_id: null,
      district_id: toNumber(
        quotation.district_id
        ?? ((quotation.district as Record<string, unknown> | null)?.id),
        0,
      ) || null,
      description: String(quotation.description ?? ''),
      address: String(quotation.address ?? ''),
      customer_name: String(quotation.customer_name ?? ''),
      customer_mobile: String(quotation.customer_phone ?? ''),
      customer_email: String(quotation.customer_email ?? ''),
      invoice_date: String(quotation.issue_date ?? todayIso()),
      supply_date: String(quotation.expiry_date ?? todayIso()),
      send_to_shipping: false,
      terms: String(quotation.terms ?? ''),
      notes: String(quotation.notes ?? ''),
      delivery_fees: Math.max(0, resolvedConvertedDeliveryFees),
      other_fees: Math.max(0, resolvedConvertedOtherFees),
      delivery_by: 'shipping_company',
      delivery_agent_name: '',
      delivery_agent_mobile: '',
      attachment_path: '',
      items: items.length ? items : [createEmptyItem()],
    }
  }

  const rowMath = (item: InvoiceDraftItem) => calculateLineTotals({
    qty: item.qty,
    unitPrice: item.unit_price,
    discountMode: item.discount_mode,
    discountValue: item.discount_value,
  })

  const summary = computed<QuotationSummaryResult>(() => {
    const rows: QuotationLineMathInput[] = draft.value.items.map(item => ({
      qty: item.qty,
      unitPrice: item.unit_price,
      discountMode: item.discount_mode,
      discountValue: item.discount_value,
    }))
    return calculateQuotationSummary({
      rows,
      deliveryFees: draft.value.delivery_fees,
      otherFees: draft.value.other_fees,
    })
  })

  const resetDraft = () => {
    draft.value = createEmptyDraft()
  }

  const addRow = () => {
    draft.value.items.push(createEmptyItem())
  }

  const clearRow = (index: number) => {
    const current = draft.value.items[index]
    if (!current) return
    draft.value.items[index] = {
      ...createEmptyItem(),
      key: current.key,
    }
  }

  const removeRow = (index: number) => {
    if (draft.value.items.length <= 1) {
      clearRow(index)
      return
    }
    draft.value.items.splice(index, 1)
  }

  const clearAllRows = () => {
    draft.value.items = [createEmptyItem()]
  }

  const setRowProduct = (index: number, product: QuotationProductOption, variationId: number | null = null) => {
    const row = draft.value.items[index]
    if (!row) return
    row.product = product
    row.product_id = product.id
    row.variation_id = variationId
    row.unit_price_manual = false
    if (product.variations.length === 1 && !variationId) {
      row.variation_id = product.variations[0]?.id ?? null
    }
    row.unit_price = getVariationPrice(row)
  }

  const setRowVariation = (index: number, variationId: number | null) => {
    const row = draft.value.items[index]
    if (!row) return
    row.variation_id = variationId
    if (shouldAutoUpdateUnitPrice(row.unit_price_manual)) {
      row.unit_price = getVariationPrice(row)
    }
  }

  const setRowQty = (index: number, qty: number) => {
    const row = draft.value.items[index]
    if (!row) return
    row.qty = normalizeNonNegative(qty, 1) || 1
    if (shouldAutoUpdateUnitPrice(row.unit_price_manual)) {
      row.unit_price = getVariationPrice(row)
    }
  }

  const setRowUnitPrice = (index: number, value: number) => {
    const row = draft.value.items[index]
    if (!row) return
    row.unit_price = normalizeNonNegative(value, 0)
    row.unit_price_manual = true
  }

  const resetRowUnitPrice = (index: number) => {
    const row = draft.value.items[index]
    if (!row) return
    row.unit_price_manual = false
    row.unit_price = getVariationPrice(row)
  }

  const setRowDiscountMode = (index: number, mode: 'fixed' | 'percentage') => {
    const row = draft.value.items[index]
    if (!row) return
    row.discount_mode = mode
  }

  const setRowDiscountValue = (index: number, value: number) => {
    const row = draft.value.items[index]
    if (!row) return
    const n = Number(value)
    row.discount_value = Number.isFinite(n) ? Math.max(0, n) : 0
  }

  const rowDiscountPercentage = (unitPrice: number, discountPerUnit: number): string => {
    if (!(unitPrice > 0)) return formatTo2DecimalString(0)
    return formatTo2DecimalString((discountPerUnit / unitPrice) * 100)
  }

  const buildPayload = () => ({
    reference_number: draft.value.reference_number || undefined,
    warehouse_id: draft.value.warehouse_id,
    district_id: draft.value.district_id || undefined,
    description: draft.value.description || undefined,
    address: draft.value.address || undefined,
    customer_name: draft.value.customer_name || undefined,
    customer_mobile: draft.value.customer_mobile || undefined,
    customer_email: draft.value.customer_email || undefined,
    invoice_date: draft.value.invoice_date,
    supply_date: draft.value.supply_date || undefined,
    send_to_shipping: draft.value.send_to_shipping,
    terms: draft.value.terms || undefined,
    notes: draft.value.notes || undefined,
    delivery_fees: draft.value.delivery_fees || 0,
    other_fees: draft.value.other_fees || 0,
    delivery_by: draft.value.delivery_by,
    delivery_agent_name: draft.value.delivery_by === 'delivery_agent'
      ? (draft.value.delivery_agent_name.trim() || null)
      : null,
    delivery_agent_mobile: draft.value.delivery_by === 'delivery_agent'
      ? (draft.value.delivery_agent_mobile.trim() || null)
      : null,
    attachment_path: draft.value.delivery_by === 'delivery_agent'
      ? (draft.value.attachment_path.trim() || null)
      : null,
    subtotal: summary.value.subtotal,
    total_discount: summary.value.totalDiscount,
    grand_total: summary.value.grandTotal,
    items: draft.value.items
      .filter(item => item.product_id)
      .map((item) => {
        const totals = rowMath(item)
        const discountPercentage = rowDiscountPercentage(item.unit_price, totals.discount)
        return {
          product_id: item.product_id,
          variation_id: item.variation_id,
          description: item.description || undefined,
          qty: item.qty,
          unit_price: item.unit_price,
          discount: formatTo2DecimalString(totals.lineDiscount),
          discount_percentage: discountPercentage,
          row_total: totals.rowTotal,
        }
      }),
  })

  const loadList = async (params: Record<string, string | number | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api(INVOICES_ENDPOINT, { params })
      list.value = extractList(response)
      const nextPagination = extractPagination(response)
      if (nextPagination) pagination.value = nextPagination
      return list.value
    }
    catch (error: unknown) {
      throw error
    }
    finally {
      listLoading.value = false
    }
  }

  const loadById = async (id: string | number) => {
    const response = await $api(`${INVOICES_ENDPOINT}/${id}`)
    const invoice = extractInvoice(response)
    currentInvoice.value = invoice
    return invoice
  }

  const loadDraftById = async (id: string | number) => {
    const invoice = await loadById(id)
    if (!invoice) return null
    hydrateDraftFromInvoice(invoice)
    return invoice
  }

  const createInvoice = async () => {
    const payload = buildPayload()
    return await $api(INVOICES_ENDPOINT, { method: 'POST', body: payload })
  }

  const updateInvoice = async (id: string | number) => {
    const payload = buildPayload()
    return await $api(`${INVOICES_ENDPOINT}/${id}`, { method: 'PUT', body: payload })
  }

  const deleteInvoice = async (id: string | number) => {
    return await $api(`${INVOICES_ENDPOINT}/${id}`, { method: 'DELETE' })
  }

  const updateInvoiceStatus = async (id: string | number, status: InvoiceStatusOption) => {
    return await $api(`${INVOICES_ENDPOINT}/${id}/status`, { method: 'PATCH', body: { status } })
  }

  const bulkPrintInvoices = async (invoiceIds: number[]) => {
    return await $api(`${INVOICES_ENDPOINT}/bulk-print`, {
      method: 'POST',
      body: { invoice_ids: invoiceIds },
    })
  }

  const syncInvoiceStatusInList = (
    invoiceId: string | number,
    status: InvoiceStatusOption,
    statusLabel?: string,
  ) => {
    const id = Number(invoiceId)
    if (!Number.isFinite(id) || id <= 0) return

    const label = statusLabel?.trim() || status
    const row = list.value.find(item => item.id === id)
    if (row) {
      row.status = status
      row.status_label = label
    }

    if (currentInvoice.value && toNumber(currentInvoice.value.id, 0) === id) {
      currentInvoice.value = {
        ...currentInvoice.value,
        status,
        status_label: label,
      }
    }
  }

  const syncStatusAfterReturn = async (
    invoiceId: string | number,
    status: InvoiceReturnStatus,
    statusLabel?: string,
  ) => {
    await updateInvoiceStatus(invoiceId, status)
    syncInvoiceStatusInList(invoiceId, status, statusLabel)
  }

  const createInvoiceReturn = async (invoiceId: string | number, payload: InvoiceReturnCreatePayload) => {
    return await $api(`${INVOICES_ENDPOINT}/${invoiceId}/returns`, {
      method: 'POST',
      body: payload,
    })
  }

  const updateInvoiceReturn = async (invoiceReturnId: string | number, payload: InvoiceReturnCreatePayload) => {
    return await $api(`${INVOICE_RETURNS_ENDPOINT}/${invoiceReturnId}`, {
      method: 'PUT',
      body: payload,
    })
  }

  const deleteInvoiceReturn = async (invoiceReturnId: string | number) => {
    return await $api(`${INVOICE_RETURNS_ENDPOINT}/${invoiceReturnId}`, { method: 'DELETE' })
  }

  const loadInvoiceReturnById = async (invoiceReturnId: string | number) => {
    const response = await $api(`${INVOICE_RETURNS_ENDPOINT}/${invoiceReturnId}`)
    return extractInvoiceReturn(response)
  }

  const loadInvoiceReturnsForInvoice = async (
    invoiceId: string | number,
    params: Record<string, string | number | undefined> = {},
  ): Promise<InvoiceReturnListResult> => {
    try {
      const response = await $api(`${INVOICES_ENDPOINT}/${invoiceId}/returns`, { params })
      const rows = extractInvoiceReturns(response)
      const page = extractPagination(response) ?? {
        current_page: 1,
        last_page: 1,
        per_page: rows.length || 15,
        total: rows.length,
      }
      return {
        returns: rows,
        pagination: page,
      }
    }
    catch (error: unknown) {
      throw error
    }
  }

  return {
    draft,
    submitting,
    list,
    listLoading,
    pagination,
    currentInvoice,
    summary,
    rowMath,
    resetDraft,
    addRow,
    clearRow,
    removeRow,
    clearAllRows,
    setRowProduct,
    setRowVariation,
    setRowQty,
    setRowUnitPrice,
    resetRowUnitPrice,
    setRowDiscountMode,
    setRowDiscountValue,
    buildPayload,
    hydrateDraftFromInvoice,
    hydrateDraftFromQuotationForConvert,
    loadList,
    loadById,
    loadDraftById,
    extractReturnFormItems,
    createInvoice,
    createInvoiceReturn,
    updateInvoiceReturn,
    deleteInvoiceReturn,
    loadInvoiceReturnById,
    loadInvoiceReturnsForInvoice,
    updateInvoice,
    deleteInvoice,
    updateInvoiceStatus,
    bulkPrintInvoices,
    syncInvoiceStatusInList,
    syncStatusAfterReturn,
  }
})
