import { ref } from 'vue'
import type { ReportsCenterItem } from '@/stores/reportsCenter'
import { normalizeReportsCenterItem } from '@/stores/reportsCenter'

export type ReportExportFormat = 'excel' | 'pdf'

export type ReportExportSlug =
  | 'sales-summary'
  | 'purchase-summary'
  | 'sales-returns'
  | 'damage-analysis'
  | 'product-profitability'
  | 'distributor-performance'
  | 'warehouse-movement'

export interface SalesSummaryWarehouse {
  id: number
  name_ar: string
  name_en: string
}

export interface SalesSummaryDistributor {
  id: number
  name_ar: string
  name_en: string
}

export interface SalesSummaryRecord {
  id: number
  reference_number: string
  invoice_date: string
  warehouse: SalesSummaryWarehouse | null
  distributor: SalesSummaryDistributor | null
  total: number
  items_count: number
  returns_total: number
}

export interface SalesSummarySummary {
  total_invoices: string | number
  total_sales: number
  total_returns: number
  net_sales: number
  average_order_value: number
  total_items_sold: number
}

export interface SalesSummaryFiltersEcho {
  from_date: string
  to_date: string
  warehouse_ids: Array<number | null>
  include_distributor_invoices: boolean
}

export interface SalesSummaryPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface LoadSalesSummaryParams {
  from_date: string
  to_date: string
  include_distributor_invoices: boolean
  warehouse_ids?: number[]
  page?: number
  per_page?: number
}

export interface PurchaseSummaryWarehouse {
  id: number
  name_ar: string
  name_en: string
}

export interface PurchaseSummaryRecord {
  id: number
  reference_number: string
  bill_date: string
  warehouse: PurchaseSummaryWarehouse | null
  supplier_name: string
  total: number
  items_count: number
}

export interface PurchaseSummarySummary {
  total_purchase_invoices: string | number
  total_purchases: number
  average_purchase_order_value: number
  total_items_purchased: number
}

export interface PurchaseSummaryFiltersEcho {
  from_date: string
  to_date: string
  warehouse_ids: Array<number | null>
}

export interface PurchaseSummaryPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface LoadPurchaseSummaryParams {
  from_date: string
  to_date: string
  warehouse_ids?: number[]
  page?: number
  per_page?: number
}

export interface SalesReturnsProduct {
  id: number
  name_ar: string
  name_en: string
}

export interface SalesReturnsCategory {
  id: number
  name_ar: string
  name_en: string
}

export interface SalesReturnsRecord {
  key: string
  product: SalesReturnsProduct | null
  category: SalesReturnsCategory | null
  return_reason: string
  quantity_sold: number
  quantity_returned: number
  returned_value: number
  return_rate: number
}

export interface SalesReturnsSummary {
  total_returned_items: number
  total_returned_value: number
  total_sales_value: number
  overall_return_rate: number
}

export interface SalesReturnsFiltersEcho {
  from_date: string
  to_date: string
  warehouse_ids: Array<number | null>
  distributor_ids: Array<number | null>
  category_ids: Array<number | null>
}

export interface LoadSalesReturnsAnalysisParams {
  from_date: string
  to_date: string
  warehouse_ids?: number[]
  distributor_ids?: number[]
  category_ids?: number[]
  page?: number
  per_page?: number
}

export type DamageAnalysisReasonValue =
  | 'manufacturing_defect'
  | 'storage_damage'
  | 'transport_damage'
  | 'expired_material'
  | 'customer_return_damaged'
  | 'other'

export interface DamageAnalysisProduct {
  id: number
  name_ar: string
  name_en: string
}

export interface DamageAnalysisWarehouse {
  id: number
  name_ar: string
  name_en: string
}

export interface DamageAnalysisReason {
  value: string
  label_ar: string
  label_en: string
  specified: string
}

export interface DamageAnalysisRecord {
  key: string
  product: DamageAnalysisProduct | null
  warehouse: DamageAnalysisWarehouse | null
  reason: DamageAnalysisReason | null
  damaged_quantity: number
  cost_price: number
  financial_loss: number
  percentage_of_total_loss: number
}

export interface DamageAnalysisSummary {
  total_damaged_items: number
  total_financial_loss: number
  total_inventory_value: number
  damage_rate: number
}

export interface DamageAnalysisFiltersEcho {
  from_date: string
  to_date: string
  warehouse_ids: Array<number | null>
  reasons: Array<string | null>
}

export interface LoadDamageAnalysisParams {
  from_date: string
  to_date: string
  warehouse_ids?: number[]
  reasons?: DamageAnalysisReasonValue[]
  page?: number
  per_page?: number
}

export interface ProductProfitabilityProduct {
  id: number
  name_ar: string
  name_en: string
}

export interface ProductProfitabilityCategory {
  id: number
  name_ar: string
  name_en: string
}

export interface ProductProfitabilityRecord {
  key: string
  product: ProductProfitabilityProduct | null
  category: ProductProfitabilityCategory | null
  average_cost_price: number
  average_selling_price: number
  profit_margin: number
  total_quantity_sold: number
  total_profit: number
}

export interface ProductProfitabilityFiltersEcho {
  from_date: string
  to_date: string
  warehouse_ids: Array<number | null>
  category_ids: Array<number | null>
}

export interface LoadProductProfitabilityParams {
  from_date: string
  to_date: string
  warehouse_ids?: number[]
  category_ids?: number[]
  page?: number
  per_page?: number
}

export interface DistributorPerformanceDistributor {
  id: number
  name_ar: string
  name_en: string
}

export interface DistributorPerformanceRecord {
  key: string
  distributor: DistributorPerformanceDistributor | null
  total_invoices: number
  total_sales: number
  total_returns: number
  return_rate: number
  net_sales: number
  average_order_value: number
}

export interface DistributorPerformanceFiltersEcho {
  from_date: string
  to_date: string
  warehouse_ids: Array<number | null>
  distributor_ids: Array<number | null>
}

export interface LoadDistributorPerformanceParams {
  from_date: string
  to_date: string
  warehouse_ids?: number[]
  distributor_ids?: number[]
  page?: number
  per_page?: number
}

export type WarehouseMovementType = 'all' | 'in' | 'out'

export interface WarehouseMovementLabelValue {
  value: string
  label: string
}

export interface WarehouseMovementReference {
  number: string
  type: string
  id: number
}

export interface WarehouseMovementProduct {
  id: number
  name_ar: string
  name_en: string
}

export interface WarehouseMovementExecutedBy {
  id: number
  name: string
}

export interface WarehouseMovementRecord {
  key: string
  id: number
  date: string
  movement_type: WarehouseMovementLabelValue | null
  source: WarehouseMovementLabelValue | null
  reference: WarehouseMovementReference | null
  product: WarehouseMovementProduct | null
  quantity: number
  executed_by: WarehouseMovementExecutedBy | null
}

export interface WarehouseMovementSummary {
  total_in: number
  total_out: number
  net_movement: number
}

export interface WarehouseMovementFiltersEcho {
  from_date: string
  to_date: string
  warehouse_id: number
  movement_type: string
  product_ids: Array<number | null>
}

export interface LoadWarehouseMovementParams {
  from_date: string
  to_date: string
  warehouse_id: number
  movement_type?: WarehouseMovementType
  product_ids?: number[]
  page?: number
  per_page?: number
}

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const defaultSummary = (): SalesSummarySummary => ({
  total_invoices: 0,
  total_sales: 0,
  total_returns: 0,
  net_sales: 0,
  average_order_value: 0,
  total_items_sold: 0,
})

const defaultPagination = (): SalesSummaryPagination => ({
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
})

const extractData = (payload: unknown): Record<string, unknown> | null => {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  if (root.data && typeof root.data === 'object') return root.data as Record<string, unknown>
  return root
}

const extractSummary = (data: Record<string, unknown> | null): SalesSummarySummary => {
  if (!data?.summary || typeof data.summary !== 'object') return defaultSummary()
  const summary = data.summary as Record<string, unknown>
  return {
    total_invoices: summary.total_invoices ?? 0,
    total_sales: toNumber(summary.total_sales),
    total_returns: toNumber(summary.total_returns),
    net_sales: toNumber(summary.net_sales),
    average_order_value: toNumber(summary.average_order_value),
    total_items_sold: toNumber(summary.total_items_sold),
  }
}

const extractRecords = (data: Record<string, unknown> | null): SalesSummaryRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row) => {
    const record = row as Record<string, unknown>
    const warehouse = record.warehouse && typeof record.warehouse === 'object'
      ? record.warehouse as Record<string, unknown>
      : null
    const distributor = record.distributor && typeof record.distributor === 'object'
      ? record.distributor as Record<string, unknown>
      : null
    return {
      id: toNumber(record.id),
      reference_number: String(record.reference_number ?? ''),
      invoice_date: String(record.invoice_date ?? ''),
      warehouse: warehouse
        ? {
            id: toNumber(warehouse.id),
            name_ar: String(warehouse.name_ar ?? ''),
            name_en: String(warehouse.name_en ?? ''),
          }
        : null,
      distributor: distributor
        ? {
            id: toNumber(distributor.id),
            name_ar: String(distributor.name_ar ?? ''),
            name_en: String(distributor.name_en ?? ''),
          }
        : null,
      total: toNumber(record.total),
      items_count: toNumber(record.items_count),
      returns_total: toNumber(record.returns_total),
    }
  })
}

const extractPagination = (data: Record<string, unknown> | null): SalesSummaryPagination => {
  if (!data?.pagination || typeof data.pagination !== 'object') return defaultPagination()
  const pagination = data.pagination as Record<string, unknown>
  return {
    current_page: toNumber(pagination.current_page, 1),
    last_page: toNumber(pagination.last_page, 1),
    per_page: toNumber(pagination.per_page, 15),
    total: toNumber(pagination.total, 0),
  }
}

const toBoolean = (value: unknown): boolean => {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return Boolean(value)
}

const extractFilters = (data: Record<string, unknown> | null): SalesSummaryFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
    include_distributor_invoices: toBoolean(filters.include_distributor_invoices),
  }
}

const defaultPurchaseSummary = (): PurchaseSummarySummary => ({
  total_purchase_invoices: 0,
  total_purchases: 0,
  average_purchase_order_value: 0,
  total_items_purchased: 0,
})

const extractPurchaseSummary = (data: Record<string, unknown> | null): PurchaseSummarySummary => {
  if (!data?.summary || typeof data.summary !== 'object') return defaultPurchaseSummary()
  const summary = data.summary as Record<string, unknown>
  return {
    total_purchase_invoices: summary.total_purchase_invoices ?? 0,
    total_purchases: toNumber(summary.total_purchases),
    average_purchase_order_value: toNumber(summary.average_purchase_order_value),
    total_items_purchased: toNumber(summary.total_items_purchased),
  }
}

const extractPurchaseRecords = (data: Record<string, unknown> | null): PurchaseSummaryRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row) => {
    const record = row as Record<string, unknown>
    const warehouse = record.warehouse && typeof record.warehouse === 'object'
      ? record.warehouse as Record<string, unknown>
      : null
    return {
      id: toNumber(record.id),
      reference_number: String(record.reference_number ?? ''),
      bill_date: String(record.bill_date ?? ''),
      warehouse: warehouse
        ? {
            id: toNumber(warehouse.id),
            name_ar: String(warehouse.name_ar ?? ''),
            name_en: String(warehouse.name_en ?? ''),
          }
        : null,
      supplier_name: String(record.supplier_name ?? ''),
      total: toNumber(record.total),
      items_count: toNumber(record.items_count),
    }
  })
}

const extractPurchaseFilters = (data: Record<string, unknown> | null): PurchaseSummaryFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
  }
}

const defaultSalesReturnsSummary = (): SalesReturnsSummary => ({
  total_returned_items: 0,
  total_returned_value: 0,
  total_sales_value: 0,
  overall_return_rate: 0,
})

const extractSalesReturnsSummary = (data: Record<string, unknown> | null): SalesReturnsSummary => {
  if (!data?.summary || typeof data.summary !== 'object') return defaultSalesReturnsSummary()
  const summary = data.summary as Record<string, unknown>
  return {
    total_returned_items: toNumber(summary.total_returned_items),
    total_returned_value: toNumber(summary.total_returned_value),
    total_sales_value: toNumber(summary.total_sales_value),
    overall_return_rate: toNumber(summary.overall_return_rate),
  }
}

const parseSalesReturnsEntity = (
  entity: Record<string, unknown> | null,
): SalesReturnsProduct | SalesReturnsCategory | null => {
  if (!entity) return null
  return {
    id: toNumber(entity.id),
    name_ar: String(entity.name_ar ?? ''),
    name_en: String(entity.name_en ?? ''),
  }
}

const extractSalesReturnsRecords = (data: Record<string, unknown> | null): SalesReturnsRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row, index) => {
    const record = row as Record<string, unknown>
    const productRaw = record.product && typeof record.product === 'object'
      ? record.product as Record<string, unknown>
      : null
    const categoryRaw = record.category && typeof record.category === 'object'
      ? record.category as Record<string, unknown>
      : null

    const product = parseSalesReturnsEntity(productRaw) as SalesReturnsProduct | null
    const category = parseSalesReturnsEntity(categoryRaw) as SalesReturnsCategory | null

    const reasonRaw = record.reason ?? record.return_reason
    const returnReason = reasonRaw != null && String(reasonRaw).trim() !== ''
      ? String(reasonRaw)
      : ''

    const productId = product?.id ?? index
    const reasonKey = returnReason || '__no_reason__'

    return {
      key: `${productId}-${reasonKey}-${index}`,
      product,
      category,
      return_reason: returnReason,
      quantity_sold: toNumber(record.quantity_sold),
      quantity_returned: toNumber(record.quantity_returned),
      returned_value: toNumber(record.returned_value),
      return_rate: toNumber(record.return_rate),
    }
  })
}

const extractSalesReturnsFilters = (data: Record<string, unknown> | null): SalesReturnsFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
    distributor_ids: Array.isArray(filters.distributor_ids) ? filters.distributor_ids as Array<number | null> : [],
    category_ids: Array.isArray(filters.category_ids) ? filters.category_ids as Array<number | null> : [],
  }
}

const defaultDamageAnalysisSummary = (): DamageAnalysisSummary => ({
  total_damaged_items: 0,
  total_financial_loss: 0,
  total_inventory_value: 0,
  damage_rate: 0,
})

const extractDamageAnalysisSummary = (data: Record<string, unknown> | null): DamageAnalysisSummary => {
  if (!data?.summary || typeof data.summary !== 'object') return defaultDamageAnalysisSummary()
  const summary = data.summary as Record<string, unknown>
  return {
    total_damaged_items: toNumber(summary.total_damaged_items),
    total_financial_loss: toNumber(summary.total_financial_loss),
    total_inventory_value: toNumber(summary.total_inventory_value),
    damage_rate: toNumber(summary.damage_rate),
  }
}

const parseDamageAnalysisEntity = (
  entity: Record<string, unknown> | null,
): DamageAnalysisProduct | DamageAnalysisWarehouse | null => {
  if (!entity) return null
  return {
    id: toNumber(entity.id),
    name_ar: String(entity.name_ar ?? ''),
    name_en: String(entity.name_en ?? ''),
  }
}

const parseDamageReason = (reasonRaw: Record<string, unknown> | null): DamageAnalysisReason | null => {
  if (!reasonRaw) return null
  return {
    value: String(reasonRaw.value ?? ''),
    label_ar: String(reasonRaw.label_ar ?? ''),
    label_en: String(reasonRaw.label_en ?? ''),
    specified: String(reasonRaw.specified ?? ''),
  }
}

const extractDamageAnalysisRecords = (data: Record<string, unknown> | null): DamageAnalysisRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row, index) => {
    const record = row as Record<string, unknown>
    const productRaw = record.product && typeof record.product === 'object'
      ? record.product as Record<string, unknown>
      : null
    const warehouseRaw = record.warehouse && typeof record.warehouse === 'object'
      ? record.warehouse as Record<string, unknown>
      : null
    const reasonRaw = record.reason && typeof record.reason === 'object'
      ? record.reason as Record<string, unknown>
      : null

    const product = parseDamageAnalysisEntity(productRaw) as DamageAnalysisProduct | null
    const warehouse = parseDamageAnalysisEntity(warehouseRaw) as DamageAnalysisWarehouse | null
    const reason = parseDamageReason(reasonRaw)
    const reasonKey = reason?.value || '__no_reason__'

    return {
      key: `${product?.id ?? index}-${warehouse?.id ?? index}-${reasonKey}-${index}`,
      product,
      warehouse,
      reason,
      damaged_quantity: toNumber(record.damaged_quantity),
      cost_price: toNumber(record.cost_price),
      financial_loss: toNumber(record.financial_loss),
      percentage_of_total_loss: toNumber(record.percentage_of_total_loss),
    }
  })
}

const extractDamageAnalysisFilters = (data: Record<string, unknown> | null): DamageAnalysisFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
    reasons: Array.isArray(filters.reasons) ? filters.reasons as Array<string | null> : [],
  }
}

const parseProductProfitabilityEntity = (
  entity: Record<string, unknown> | null,
): ProductProfitabilityProduct | ProductProfitabilityCategory | null => {
  if (!entity) return null
  return {
    id: toNumber(entity.id),
    name_ar: String(entity.name_ar ?? ''),
    name_en: String(entity.name_en ?? ''),
  }
}

const extractProductProfitabilityRecords = (data: Record<string, unknown> | null): ProductProfitabilityRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row, index) => {
    const record = row as Record<string, unknown>
    const productRaw = record.product && typeof record.product === 'object'
      ? record.product as Record<string, unknown>
      : null
    const categoryRaw = record.category && typeof record.category === 'object'
      ? record.category as Record<string, unknown>
      : null

    const product = parseProductProfitabilityEntity(productRaw) as ProductProfitabilityProduct | null
    const category = parseProductProfitabilityEntity(categoryRaw) as ProductProfitabilityCategory | null

    return {
      key: `${product?.id ?? index}-${index}`,
      product,
      category,
      average_cost_price: toNumber(record.average_cost_price),
      average_selling_price: toNumber(record.average_selling_price),
      profit_margin: toNumber(record.profit_margin),
      total_quantity_sold: toNumber(record.total_quantity_sold),
      total_profit: toNumber(record.total_profit),
    }
  })
}

const extractProductProfitabilityFilters = (data: Record<string, unknown> | null): ProductProfitabilityFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
    category_ids: Array.isArray(filters.category_ids) ? filters.category_ids as Array<number | null> : [],
  }
}

const parseDistributorPerformanceDistributor = (
  entity: Record<string, unknown> | null,
): DistributorPerformanceDistributor | null => {
  if (!entity) return null
  return {
    id: toNumber(entity.id),
    name_ar: String(entity.name_ar ?? ''),
    name_en: String(entity.name_en ?? ''),
  }
}

const extractDistributorPerformanceRecords = (data: Record<string, unknown> | null): DistributorPerformanceRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row, index) => {
    const record = row as Record<string, unknown>
    const distributorRaw = record.distributor && typeof record.distributor === 'object'
      ? record.distributor as Record<string, unknown>
      : null
    const distributor = parseDistributorPerformanceDistributor(distributorRaw)

    return {
      key: `${distributor?.id ?? index}-${index}`,
      distributor,
      total_invoices: toNumber(record.total_invoices),
      total_sales: toNumber(record.total_sales),
      total_returns: toNumber(record.total_returns),
      return_rate: toNumber(record.return_rate),
      net_sales: toNumber(record.net_sales),
      average_order_value: toNumber(record.average_order_value),
    }
  })
}

const extractDistributorPerformanceFilters = (data: Record<string, unknown> | null): DistributorPerformanceFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
    distributor_ids: Array.isArray(filters.distributor_ids) ? filters.distributor_ids as Array<number | null> : [],
  }
}

const defaultWarehouseMovementSummary = (): WarehouseMovementSummary => ({
  total_in: 0,
  total_out: 0,
  net_movement: 0,
})

const parseWarehouseMovementLabelValue = (
  raw: Record<string, unknown> | null,
): WarehouseMovementLabelValue | null => {
  if (!raw) return null
  return {
    value: String(raw.value ?? ''),
    label: String(raw.label ?? ''),
  }
}

const parseWarehouseMovementReference = (
  raw: Record<string, unknown> | null,
): WarehouseMovementReference | null => {
  if (!raw) return null
  return {
    number: String(raw.number ?? ''),
    type: String(raw.type ?? ''),
    id: toNumber(raw.id),
  }
}

const parseWarehouseMovementProduct = (
  entity: Record<string, unknown> | null,
): WarehouseMovementProduct | null => {
  if (!entity) return null
  return {
    id: toNumber(entity.id),
    name_ar: String(entity.name_ar ?? ''),
    name_en: String(entity.name_en ?? ''),
  }
}

const parseWarehouseMovementExecutedBy = (
  raw: Record<string, unknown> | null,
): WarehouseMovementExecutedBy | null => {
  if (!raw) return null
  return {
    id: toNumber(raw.id),
    name: String(raw.name ?? ''),
  }
}

const extractWarehouseMovementSummary = (data: Record<string, unknown> | null): WarehouseMovementSummary => {
  if (!data?.summary || typeof data.summary !== 'object') return defaultWarehouseMovementSummary()
  const summary = data.summary as Record<string, unknown>
  return {
    total_in: toNumber(summary.total_in),
    total_out: toNumber(summary.total_out),
    net_movement: toNumber(summary.net_movement),
  }
}

const extractWarehouseMovementRecords = (data: Record<string, unknown> | null): WarehouseMovementRecord[] => {
  if (!Array.isArray(data?.records)) return []
  return data.records.map((row, index) => {
    const record = row as Record<string, unknown>
    const movementTypeRaw = record.movement_type && typeof record.movement_type === 'object'
      ? record.movement_type as Record<string, unknown>
      : null
    const sourceRaw = record.source && typeof record.source === 'object'
      ? record.source as Record<string, unknown>
      : null
    const referenceRaw = record.reference && typeof record.reference === 'object'
      ? record.reference as Record<string, unknown>
      : null
    const productRaw = record.product && typeof record.product === 'object'
      ? record.product as Record<string, unknown>
      : null
    const executedByRaw = record.executed_by && typeof record.executed_by === 'object'
      ? record.executed_by as Record<string, unknown>
      : null

    const id = toNumber(record.id, index)

    return {
      key: `${id}-${index}`,
      id,
      date: String(record.date ?? ''),
      movement_type: parseWarehouseMovementLabelValue(movementTypeRaw),
      source: parseWarehouseMovementLabelValue(sourceRaw),
      reference: parseWarehouseMovementReference(referenceRaw),
      product: parseWarehouseMovementProduct(productRaw),
      quantity: toNumber(record.quantity),
      executed_by: parseWarehouseMovementExecutedBy(executedByRaw),
    }
  })
}

const extractWarehouseMovementFilters = (data: Record<string, unknown> | null): WarehouseMovementFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_id: toNumber(filters.warehouse_id),
    movement_type: String(filters.movement_type ?? 'all'),
    product_ids: Array.isArray(filters.product_ids) ? filters.product_ids as Array<number | null> : [],
  }
}

export const useReportsStore = defineStore('reports', () => {
  const { $api } = useApi()
  const SALES_SUMMARY_ENDPOINT = '/reports/sales-summary'
  const PURCHASE_SUMMARY_ENDPOINT = '/reports/purchase-summary'
  const SALES_RETURNS_ENDPOINT = '/reports/sales-returns'
  const DAMAGE_ANALYSIS_ENDPOINT = '/reports/damage-analysis'
  const PRODUCT_PROFITABILITY_ENDPOINT = '/reports/product-profitability'
  const DISTRIBUTOR_PERFORMANCE_ENDPOINT = '/reports/distributor-performance'
  const WAREHOUSE_MOVEMENT_ENDPOINT = '/reports/warehouse-movement'

  const REPORT_EXPORT_ENDPOINTS: Record<ReportExportSlug, string> = {
    'sales-summary': SALES_SUMMARY_ENDPOINT,
    'purchase-summary': PURCHASE_SUMMARY_ENDPOINT,
    'sales-returns': SALES_RETURNS_ENDPOINT,
    'damage-analysis': DAMAGE_ANALYSIS_ENDPOINT,
    'product-profitability': PRODUCT_PROFITABILITY_ENDPOINT,
    'distributor-performance': DISTRIBUTOR_PERFORMANCE_ENDPOINT,
    'warehouse-movement': WAREHOUSE_MOVEMENT_ENDPOINT,
  }

  const salesSummaryLoading = ref(false)
  const salesSummaryGenerated = ref(false)
  const salesSummary = ref<SalesSummarySummary>(defaultSummary())
  const salesSummaryRecords = ref<SalesSummaryRecord[]>([])
  const salesSummaryPagination = ref<SalesSummaryPagination>(defaultPagination())
  const salesSummaryFilters = ref<SalesSummaryFiltersEcho | null>(null)

  const purchaseSummaryLoading = ref(false)
  const purchaseSummaryGenerated = ref(false)
  const purchaseSummary = ref<PurchaseSummarySummary>(defaultPurchaseSummary())
  const purchaseSummaryRecords = ref<PurchaseSummaryRecord[]>([])
  const purchaseSummaryPagination = ref<PurchaseSummaryPagination>(defaultPagination())
  const purchaseSummaryFilters = ref<PurchaseSummaryFiltersEcho | null>(null)

  const salesReturnsLoading = ref(false)
  const salesReturnsGenerated = ref(false)
  const salesReturnsSummary = ref<SalesReturnsSummary>(defaultSalesReturnsSummary())
  const salesReturnsRecords = ref<SalesReturnsRecord[]>([])
  const salesReturnsPagination = ref<SalesSummaryPagination>(defaultPagination())
  const salesReturnsFilters = ref<SalesReturnsFiltersEcho | null>(null)

  const damageAnalysisLoading = ref(false)
  const damageAnalysisGenerated = ref(false)
  const damageAnalysisSummary = ref<DamageAnalysisSummary>(defaultDamageAnalysisSummary())
  const damageAnalysisRecords = ref<DamageAnalysisRecord[]>([])
  const damageAnalysisPagination = ref<SalesSummaryPagination>(defaultPagination())
  const damageAnalysisFilters = ref<DamageAnalysisFiltersEcho | null>(null)

  const productProfitabilityLoading = ref(false)
  const productProfitabilityGenerated = ref(false)
  const productProfitabilityRecords = ref<ProductProfitabilityRecord[]>([])
  const productProfitabilityPagination = ref<SalesSummaryPagination>(defaultPagination())
  const productProfitabilityFilters = ref<ProductProfitabilityFiltersEcho | null>(null)

  const distributorPerformanceLoading = ref(false)
  const distributorPerformanceGenerated = ref(false)
  const distributorPerformanceRecords = ref<DistributorPerformanceRecord[]>([])
  const distributorPerformancePagination = ref<SalesSummaryPagination>(defaultPagination())
  const distributorPerformanceFilters = ref<DistributorPerformanceFiltersEcho | null>(null)

  const warehouseMovementLoading = ref(false)
  const warehouseMovementGenerated = ref(false)
  const warehouseMovementSummary = ref<WarehouseMovementSummary>(defaultWarehouseMovementSummary())
  const warehouseMovementRecords = ref<WarehouseMovementRecord[]>([])
  const warehouseMovementPagination = ref<SalesSummaryPagination>(defaultPagination())
  const warehouseMovementFilters = ref<WarehouseMovementFiltersEcho | null>(null)

  const resetSalesSummary = () => {
    salesSummaryGenerated.value = false
    salesSummary.value = defaultSummary()
    salesSummaryRecords.value = []
    salesSummaryPagination.value = defaultPagination()
    salesSummaryFilters.value = null
  }

  const loadSalesSummary = async (params: LoadSalesSummaryParams) => {
    salesSummaryLoading.value = true
    try {
      const query: Record<string, string | number | boolean | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        include_distributor_invoices: params.include_distributor_invoices === true ? 1 : 0,
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'warehouse_ids[]': params.warehouse_ids?.length
          ? params.warehouse_ids.map(String)
          : undefined,
      }

      const response = await $api(SALES_SUMMARY_ENDPOINT, { params: query })
      const data = extractData(response)
      salesSummary.value = extractSummary(data)
      salesSummaryRecords.value = extractRecords(data)
      salesSummaryPagination.value = extractPagination(data)
      salesSummaryFilters.value = extractFilters(data)
      salesSummaryGenerated.value = true
      return data
    }
    finally {
      salesSummaryLoading.value = false
    }
  }

  const resetPurchaseSummary = () => {
    purchaseSummaryGenerated.value = false
    purchaseSummary.value = defaultPurchaseSummary()
    purchaseSummaryRecords.value = []
    purchaseSummaryPagination.value = defaultPagination()
    purchaseSummaryFilters.value = null
  }

  const loadPurchaseSummary = async (params: LoadPurchaseSummaryParams) => {
    purchaseSummaryLoading.value = true
    try {
      const query: Record<string, string | number | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'warehouse_ids[]': params.warehouse_ids?.length
          ? params.warehouse_ids.map(String)
          : undefined,
      }

      const response = await $api(PURCHASE_SUMMARY_ENDPOINT, { params: query })
      const data = extractData(response)
      purchaseSummary.value = extractPurchaseSummary(data)
      purchaseSummaryRecords.value = extractPurchaseRecords(data)
      purchaseSummaryPagination.value = extractPagination(data)
      purchaseSummaryFilters.value = extractPurchaseFilters(data)
      purchaseSummaryGenerated.value = true
      return data
    }
    finally {
      purchaseSummaryLoading.value = false
    }
  }

  const resetSalesReturnsAnalysis = () => {
    salesReturnsGenerated.value = false
    salesReturnsSummary.value = defaultSalesReturnsSummary()
    salesReturnsRecords.value = []
    salesReturnsPagination.value = defaultPagination()
    salesReturnsFilters.value = null
  }

  const loadSalesReturnsAnalysis = async (params: LoadSalesReturnsAnalysisParams) => {
    salesReturnsLoading.value = true
    try {
      const query: Record<string, string | number | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'warehouse_ids[]': params.warehouse_ids?.length
          ? params.warehouse_ids.map(String)
          : undefined,
        'distributor_ids[]': params.distributor_ids?.length
          ? params.distributor_ids.map(String)
          : undefined,
        'category_ids[]': params.category_ids?.length
          ? params.category_ids.map(String)
          : undefined,
      }

      const response = await $api(SALES_RETURNS_ENDPOINT, { params: query })
      const data = extractData(response)
      salesReturnsSummary.value = extractSalesReturnsSummary(data)
      salesReturnsRecords.value = extractSalesReturnsRecords(data)
      salesReturnsPagination.value = extractPagination(data)
      salesReturnsFilters.value = extractSalesReturnsFilters(data)
      salesReturnsGenerated.value = true
      return data
    }
    finally {
      salesReturnsLoading.value = false
    }
  }

  const resetDamageAnalysis = () => {
    damageAnalysisGenerated.value = false
    damageAnalysisSummary.value = defaultDamageAnalysisSummary()
    damageAnalysisRecords.value = []
    damageAnalysisPagination.value = defaultPagination()
    damageAnalysisFilters.value = null
  }

  const loadDamageAnalysis = async (params: LoadDamageAnalysisParams) => {
    damageAnalysisLoading.value = true
    try {
      const query: Record<string, string | number | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'warehouse_ids[]': params.warehouse_ids?.length
          ? params.warehouse_ids.map(String)
          : undefined,
        'reasons[]': params.reasons?.length
          ? params.reasons
          : undefined,
      }

      const response = await $api(DAMAGE_ANALYSIS_ENDPOINT, { params: query })
      const data = extractData(response)
      damageAnalysisSummary.value = extractDamageAnalysisSummary(data)
      damageAnalysisRecords.value = extractDamageAnalysisRecords(data)
      damageAnalysisPagination.value = extractPagination(data)
      damageAnalysisFilters.value = extractDamageAnalysisFilters(data)
      damageAnalysisGenerated.value = true
      return data
    }
    finally {
      damageAnalysisLoading.value = false
    }
  }

  const resetProductProfitability = () => {
    productProfitabilityGenerated.value = false
    productProfitabilityRecords.value = []
    productProfitabilityPagination.value = defaultPagination()
    productProfitabilityFilters.value = null
  }

  const loadProductProfitability = async (params: LoadProductProfitabilityParams) => {
    productProfitabilityLoading.value = true
    try {
      const query: Record<string, string | number | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'warehouse_ids[]': params.warehouse_ids?.length
          ? params.warehouse_ids.map(String)
          : undefined,
        'category_ids[]': params.category_ids?.length
          ? params.category_ids.map(String)
          : undefined,
      }

      const response = await $api(PRODUCT_PROFITABILITY_ENDPOINT, { params: query })
      const data = extractData(response)
      productProfitabilityRecords.value = extractProductProfitabilityRecords(data)
      productProfitabilityPagination.value = extractPagination(data)
      productProfitabilityFilters.value = extractProductProfitabilityFilters(data)
      productProfitabilityGenerated.value = true
      return data
    }
    finally {
      productProfitabilityLoading.value = false
    }
  }

  const resetDistributorPerformance = () => {
    distributorPerformanceGenerated.value = false
    distributorPerformanceRecords.value = []
    distributorPerformancePagination.value = defaultPagination()
    distributorPerformanceFilters.value = null
  }

  const loadDistributorPerformance = async (params: LoadDistributorPerformanceParams) => {
    distributorPerformanceLoading.value = true
    try {
      const query: Record<string, string | number | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'warehouse_ids[]': params.warehouse_ids?.length
          ? params.warehouse_ids.map(String)
          : undefined,
        'distributor_ids[]': params.distributor_ids?.length
          ? params.distributor_ids.map(String)
          : undefined,
      }

      const response = await $api(DISTRIBUTOR_PERFORMANCE_ENDPOINT, { params: query })
      const data = extractData(response)
      distributorPerformanceRecords.value = extractDistributorPerformanceRecords(data)
      distributorPerformancePagination.value = extractPagination(data)
      distributorPerformanceFilters.value = extractDistributorPerformanceFilters(data)
      distributorPerformanceGenerated.value = true
      return data
    }
    finally {
      distributorPerformanceLoading.value = false
    }
  }

  const resetWarehouseMovement = () => {
    warehouseMovementGenerated.value = false
    warehouseMovementSummary.value = defaultWarehouseMovementSummary()
    warehouseMovementRecords.value = []
    warehouseMovementPagination.value = defaultPagination()
    warehouseMovementFilters.value = null
  }

  const loadWarehouseMovement = async (params: LoadWarehouseMovementParams) => {
    warehouseMovementLoading.value = true
    try {
      const query: Record<string, string | number | string[] | undefined> = {
        from_date: params.from_date,
        to_date: params.to_date,
        warehouse_id: params.warehouse_id,
        movement_type: params.movement_type ?? 'all',
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        'product_ids[]': params.product_ids?.length
          ? params.product_ids.map(String)
          : undefined,
      }

      const response = await $api(WAREHOUSE_MOVEMENT_ENDPOINT, { params: query })
      const data = extractData(response)
      warehouseMovementSummary.value = extractWarehouseMovementSummary(data)
      warehouseMovementRecords.value = extractWarehouseMovementRecords(data)
      warehouseMovementPagination.value = extractPagination(data)
      warehouseMovementFilters.value = extractWarehouseMovementFilters(data)
      warehouseMovementGenerated.value = true
      return data
    }
    finally {
      warehouseMovementLoading.value = false
    }
  }

  /** Queues an async server-side export job; response is the created Reports Center record (status starts as processing). */
  const exportReport = async (
    slug: ReportExportSlug,
    format: ReportExportFormat,
    params: Record<string, unknown> = {},
  ): Promise<ReportsCenterItem | null> => {
    const endpoint = REPORT_EXPORT_ENDPOINTS[slug]
    const response = await $api(`${endpoint}/export/${format}`, {
      method: 'POST',
      body: params,
    })
    const data = extractData(response)
    return data ? normalizeReportsCenterItem(data) : null
  }

  return {
    exportReport,
    salesSummaryLoading,
    salesSummaryGenerated,
    salesSummary,
    salesSummaryRecords,
    salesSummaryPagination,
    salesSummaryFilters,
    resetSalesSummary,
    loadSalesSummary,
    purchaseSummaryLoading,
    purchaseSummaryGenerated,
    purchaseSummary,
    purchaseSummaryRecords,
    purchaseSummaryPagination,
    purchaseSummaryFilters,
    resetPurchaseSummary,
    loadPurchaseSummary,
    salesReturnsLoading,
    salesReturnsGenerated,
    salesReturnsSummary,
    salesReturnsRecords,
    salesReturnsPagination,
    salesReturnsFilters,
    resetSalesReturnsAnalysis,
    loadSalesReturnsAnalysis,
    damageAnalysisLoading,
    damageAnalysisGenerated,
    damageAnalysisSummary,
    damageAnalysisRecords,
    damageAnalysisPagination,
    damageAnalysisFilters,
    resetDamageAnalysis,
    loadDamageAnalysis,
    productProfitabilityLoading,
    productProfitabilityGenerated,
    productProfitabilityRecords,
    productProfitabilityPagination,
    productProfitabilityFilters,
    resetProductProfitability,
    loadProductProfitability,
    distributorPerformanceLoading,
    distributorPerformanceGenerated,
    distributorPerformanceRecords,
    distributorPerformancePagination,
    distributorPerformanceFilters,
    resetDistributorPerformance,
    loadDistributorPerformance,
    warehouseMovementLoading,
    warehouseMovementGenerated,
    warehouseMovementSummary,
    warehouseMovementRecords,
    warehouseMovementPagination,
    warehouseMovementFilters,
    resetWarehouseMovement,
    loadWarehouseMovement,
  }
})
