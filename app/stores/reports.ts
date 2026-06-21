import { ref } from 'vue'

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

const extractFilters = (data: Record<string, unknown> | null): SalesSummaryFiltersEcho | null => {
  if (!data?.filters || typeof data.filters !== 'object') return null
  const filters = data.filters as Record<string, unknown>
  return {
    from_date: String(filters.from_date ?? ''),
    to_date: String(filters.to_date ?? ''),
    warehouse_ids: Array.isArray(filters.warehouse_ids) ? filters.warehouse_ids as Array<number | null> : [],
    include_distributor_invoices: Boolean(filters.include_distributor_invoices),
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

export const useReportsStore = defineStore('reports', () => {
  const { $api } = useApi()
  const SALES_SUMMARY_ENDPOINT = '/reports/sales-summary'
  const PURCHASE_SUMMARY_ENDPOINT = '/reports/purchase-summary'

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
        include_distributor_invoices: params.include_distributor_invoices,
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

  return {
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
  }
})
