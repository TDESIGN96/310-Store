import { defineStore } from 'pinia'

export interface StocktakingOrderPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type StocktakingOrderStatus =
  | 'scheduled'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'cancelled'
  | string

export type StocktakingOrderType = 'full' | 'partial' | string

export interface StocktakingDraft {
  warehouse_id: number | null
  type: 'full' | 'partial'
  stocktaking_date: string
  show_registered_quantities: boolean
  first_reminder_days: number | null
  second_reminder_days: number | null
  notes: string
  counter_ids: number[]
  selected_variation_ids: number[]
}

export interface CreateStocktakingOrderPayload {
  warehouse_id: number
  type: string
  stocktaking_date: string
  show_registered_quantities: boolean
  first_reminder_days?: number | null
  second_reminder_days?: number | null
  notes?: string | null
  counter_ids: number[]
  variation_ids?: number[]
}

export interface StocktakingOrderListItem {
  id: number
  reference_number: string
  warehouse_id: number | null
  warehouse_name_ar: string
  warehouse_name_en: string
  type: StocktakingOrderType
  type_label: string
  stocktaking_date: string
  status: StocktakingOrderStatus
  status_label: string
  created_at: string
}

export interface StocktakingSimplifiedUser {
  id: number
  name: string
}

export type StocktakingItemCountStatus = 'in_progress' | 'done' | string

export interface StocktakingCountItem {
  id: number
  stocktaking_order_id: number
  product_id: number
  product_name_ar: string
  product_name_en: string
  variation_id: number
  variation_label: string
  sku: string
  barcode: string
  snapshot_quantity: number | null
  system_quantity: number | null
  counted_quantity: number | null
  variance: number
  counted_by: StocktakingSimplifiedUser | null
  counted_at: string | null
  count_status: StocktakingItemCountStatus
}

export interface StocktakingCountState {
  id: number
  reference_id: string
  warehouse_name_ar: string
  warehouse_name_en: string
  type: StocktakingOrderType
  type_label: string
  status: StocktakingOrderStatus
  status_label: string
  show_registered_quantities: boolean
  progress_percentage: number
  total_items: number
  counted_items: number
  items: StocktakingCountItem[]
}

export interface StartOrderResult {
  id: number
  status: StocktakingOrderStatus
}

export interface SubmitCountResult {
  id: number
  reference_id: string
  status: StocktakingOrderStatus
  submitted_at: string | null
}

export type StocktakingItemDecision = 'accepted' | 'rejected' | 'recount_requested' | null

export interface StocktakingVarianceSummary {
  total_products: number
  matched: number
  surplus: number
  shortage: number
  pending_decision: number
}

export interface StocktakingReviewItem extends StocktakingCountItem {
  decision: StocktakingItemDecision
  reviewer_note: string | null
  recount_requested_at: string | null
  recount_count: number
  reviewed_by: StocktakingSimplifiedUser | null
  reviewed_at: string | null
}

export interface StocktakingReviewState {
  id: number
  reference_id: string
  warehouse_name_ar: string
  warehouse_name_en: string
  type: StocktakingOrderType
  type_label: string
  status: StocktakingOrderStatus
  status_label: string
  stocktaking_date: string
  summary: StocktakingVarianceSummary
  items: StocktakingReviewItem[]
}

export interface SubmitReviewResult {
  id: number
  reference_id: string
  status: StocktakingOrderStatus
  completed_at: string | null
}

export interface StocktakingActivity {
  id: number
  action: string
  user: StocktakingSimplifiedUser | null
  created_at: string
}

export interface StocktakingOrderDetail {
  id: number
  reference_id: string
  warehouse_name_ar: string
  warehouse_name_en: string
  type: StocktakingOrderType
  type_label: string
  status: StocktakingOrderStatus
  status_label: string
  stocktaking_date: string
  show_registered_quantities: boolean
  notes: string
  created_at: string
  submitted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  counters: StocktakingSimplifiedUser[]
  created_by: StocktakingSimplifiedUser | null
  submitted_by: StocktakingSimplifiedUser | null
  cancelled_by: StocktakingSimplifiedUser | null
  activities: StocktakingActivity[]
  counting: {
    progress_percentage: number
    total_items: number
    counted_items: number
    items: StocktakingCountItem[]
  }
  variance: {
    summary: StocktakingVarianceSummary
    items: StocktakingReviewItem[]
  }
}

export const useStocktakingOrdersStore = defineStore('stocktakingOrders', () => {
  const { $api } = useApi()
  const STOCKTAKING_ORDERS_ENDPOINT = '/stocktaking-orders'
  const list = ref<StocktakingOrderListItem[]>([])
  const listLoading = ref(false)
  const pagination = ref<StocktakingOrderPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const submitting = ref(false)
  const countLoading = ref(false)
  const countSaving = ref(false)
  const countSubmitting = ref(false)
  const countState = ref<StocktakingCountState | null>(null)
  const reviewLoading = ref(false)
  const reviewSubmitting = ref(false)
  const reviewState = ref<StocktakingReviewState | null>(null)
  const detailLoading = ref(false)
  const detailState = ref<StocktakingOrderDetail | null>(null)

  const createDefaultDraft = (): StocktakingDraft => ({
    warehouse_id: null,
    type: 'full',
    stocktaking_date: '',
    show_registered_quantities: true,
    first_reminder_days: null,
    second_reminder_days: null,
    notes: '',
    counter_ids: [],
    selected_variation_ids: [],
  })

  const draft = ref<StocktakingDraft>(createDefaultDraft())

  const resetDraft = () => {
    draft.value = createDefaultDraft()
  }

  const toNumber = (value: unknown, fallback = 0): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  const normalizeStatus = (value: unknown): StocktakingOrderStatus => {
    const status = String(value ?? '').toLowerCase()
    if (
      status === 'scheduled'
      || status === 'in_progress'
      || status === 'pending_review'
      || status === 'completed'
      || status === 'cancelled'
    ) return status
    return status || 'scheduled'
  }

  const normalizeType = (value: unknown): StocktakingOrderType => {
    const type = String(value ?? '').toLowerCase()
    if (type === 'full' || type === 'partial') return type
    return type || 'full'
  }

  const extractPagination = (payload: unknown): StocktakingOrderPagination | null => {
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

  const normalizeListItem = (payload: Record<string, unknown>): StocktakingOrderListItem => {
    const warehouse = (
      payload.warehouse && typeof payload.warehouse === 'object' ? payload.warehouse : null
    ) as Record<string, unknown> | null
    const type = normalizeType(payload.type ?? payload.stocktaking_type)
    const status = normalizeStatus(payload.status)
    return {
      id: toNumber(payload.id, 0),
      reference_number: String(payload.reference_number ?? payload.reference_id ?? ''),
      warehouse_id: toNumber(payload.warehouse_id ?? warehouse?.id, 0) || null,
      warehouse_name_ar: String(warehouse?.name_ar ?? payload.warehouse_name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? payload.warehouse_name_en ?? ''),
      type,
      type_label: String(payload.type_label ?? payload.stocktaking_type_label ?? type),
      stocktaking_date: String(
        payload.stocktaking_date
        ?? payload.stocktakingDate
        ?? payload.date
        ?? '',
      ),
      status,
      status_label: String(payload.status_label ?? status),
      created_at: String(payload.created_at ?? payload.stocktaking_date ?? ''),
    }
  }

  const extractList = (payload: unknown): StocktakingOrderListItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (
      nested?.stocktaking_orders
      ?? root.stocktaking_orders
      ?? nested?.orders
      ?? root.orders
      ?? []
    ) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows
      .map(row => normalizeListItem((row ?? {}) as Record<string, unknown>))
      .filter(row => row.id > 0)
  }

  const loadList = async (params: Record<string, string | number | string[] | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api(STOCKTAKING_ORDERS_ENDPOINT, { params })
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

  const extractDataRoot = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    return nested ?? root
  }

  const normalizeSimplifiedUser = (raw: unknown): StocktakingSimplifiedUser | null => {
    if (!raw || typeof raw !== 'object') return null
    const user = raw as Record<string, unknown>
    const id = toNumber(user.id, 0)
    if (id <= 0) return null
    return {
      id,
      name: String(user.name ?? ''),
    }
  }

  const normalizeCountStatus = (value: unknown, countedQuantity: number | null): StocktakingItemCountStatus => {
    const status = String(value ?? '').toLowerCase()
    if (status === 'done' || status === 'completed') return 'done'
    if (status === 'in_progress' || status === 'pending') return 'in_progress'
    if (countedQuantity != null && Number.isFinite(countedQuantity)) return 'done'
    return 'in_progress'
  }

  const normalizeCountItem = (raw: Record<string, unknown>): StocktakingCountItem => {
    const product = (
      raw.product && typeof raw.product === 'object' ? raw.product : null
    ) as Record<string, unknown> | null
    const variation = (
      raw.variation && typeof raw.variation === 'object' ? raw.variation : null
    ) as Record<string, unknown> | null
    const countedQuantityRaw = raw.counted_quantity
    const countedQuantity = countedQuantityRaw == null || countedQuantityRaw === ''
      ? null
      : toNumber(countedQuantityRaw, 0)
    const snapshotRaw = raw.snapshot_quantity ?? raw.system_quantity
    const snapshotQuantity = snapshotRaw == null || snapshotRaw === ''
      ? null
      : toNumber(snapshotRaw, 0)
    const systemRaw = raw.system_quantity ?? raw.snapshot_quantity
    const systemQuantity = systemRaw == null || systemRaw === ''
      ? null
      : toNumber(systemRaw, 0)

    return {
      id: toNumber(raw.id, 0),
      stocktaking_order_id: toNumber(raw.stocktaking_order_id, 0),
      product_id: toNumber(raw.product_id ?? product?.id, 0),
      product_name_ar: String(product?.name_ar ?? ''),
      product_name_en: String(product?.name_en ?? ''),
      variation_id: toNumber(raw.variation_id ?? variation?.id, 0),
      variation_label: String(raw.variation_label ?? variation?.label ?? variation?.sku ?? ''),
      sku: String(raw.sku ?? variation?.sku ?? product?.sku ?? ''),
      barcode: String(raw.barcode ?? variation?.barcode ?? product?.barcode ?? ''),
      snapshot_quantity: snapshotQuantity,
      system_quantity: systemQuantity,
      counted_quantity: countedQuantity,
      variance: toNumber(raw.variance, 0),
      counted_by: normalizeSimplifiedUser(raw.counted_by),
      counted_at: raw.counted_at != null ? String(raw.counted_at) : null,
      count_status: normalizeCountStatus(raw.count_status, countedQuantity),
    }
  }

  const normalizeCountState = (payload: unknown): StocktakingCountState | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const order = (
      data.order && typeof data.order === 'object' ? data.order : data
    ) as Record<string, unknown>
    const warehouse = (
      order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null
    ) as Record<string, unknown> | null
    const type = normalizeType(order.type ?? order.stocktaking_type)
    const status = normalizeStatus(order.status)
    const itemsRaw = (
      order.items
      ?? data.items
      ?? (data.counting && typeof data.counting === 'object'
        ? (data.counting as Record<string, unknown>).items
        : null)
      ?? []
    ) as unknown[]
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map(row => normalizeCountItem((row ?? {}) as Record<string, unknown>))
          .filter(item => item.id > 0)
      : []
    const totalItems = toNumber(order.total_items ?? items.length, items.length)
    const countedItems = toNumber(
      order.counted_items
      ?? items.filter(item => item.counted_quantity != null).length,
      0,
    )
    const progressPercentage = toNumber(
      order.progress_percentage
      ?? (totalItems > 0 ? (countedItems / totalItems) * 100 : 0),
      0,
    )
    const id = toNumber(order.id, 0)
    if (id <= 0) return null

    return {
      id,
      reference_id: String(order.reference_id ?? order.reference_number ?? ''),
      warehouse_name_ar: String(warehouse?.name_ar ?? order.warehouse_name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? order.warehouse_name_en ?? ''),
      type,
      type_label: String(order.type_label ?? order.stocktaking_type_label ?? type),
      status,
      status_label: String(order.status_label ?? status),
      show_registered_quantities: order.show_registered_quantities === true
        || order.show_registered_quantities === 1
        || order.show_registered_quantities === '1'
        || order.show_registered_quantities === 'true',
      progress_percentage: Math.min(100, Math.max(0, progressPercentage)),
      total_items: totalItems,
      counted_items: countedItems,
      items,
    }
  }

  const extractStartOrderResult = (payload: unknown): StartOrderResult | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const order = (
      data.order && typeof data.order === 'object' ? data.order : data
    ) as Record<string, unknown>
    const id = toNumber(order.id, 0)
    if (id <= 0) return null
    return {
      id,
      status: normalizeStatus(order.status),
    }
  }

  const extractSubmitCountResult = (payload: unknown): SubmitCountResult | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const order = (
      data.order && typeof data.order === 'object' ? data.order : data
    ) as Record<string, unknown>
    const id = toNumber(order.id, 0)
    if (id <= 0) return null
    return {
      id,
      reference_id: String(order.reference_id ?? order.reference_number ?? ''),
      status: normalizeStatus(order.status),
      submitted_at: order.submitted_at != null ? String(order.submitted_at) : null,
    }
  }

  const extractScanItemId = (payload: unknown): number | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const item = (
      data.item
      ?? (data.items && Array.isArray(data.items) ? data.items[0] : null)
      ?? data
    ) as Record<string, unknown> | null
    if (!item || typeof item !== 'object') return null
    const id = toNumber(item.id ?? item.stocktaking_order_item_id, 0)
    return id > 0 ? id : null
  }

  const startOrder = async (id: string | number): Promise<StartOrderResult | null> => {
    const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/start`, { method: 'PATCH' })
    return extractStartOrderResult(response)
  }

  const getCount = async (id: string | number): Promise<StocktakingCountState> => {
    countLoading.value = true
    try {
      const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/count`)
      const normalized = normalizeCountState(response)
      if (!normalized) throw new Error('INVALID_COUNT_RESPONSE')
      countState.value = normalized
      return normalized
    }
    finally {
      countLoading.value = false
    }
  }

  const scanBarcode = async (id: string | number, barcode: string) => {
    const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/count/scan`, {
      method: 'POST',
      body: { barcode: barcode.trim() },
    })
    return {
      response,
      itemId: extractScanItemId(response),
    }
  }

  const updateItemQuantity = async (
    orderId: string | number,
    itemId: string | number,
    countedQuantity: number,
  ) => {
    const response = await $api(
      `${STOCKTAKING_ORDERS_ENDPOINT}/${orderId}/count/items/${itemId}`,
      {
        method: 'PUT',
        body: { counted_quantity: countedQuantity },
      },
    )
    const data = extractDataRoot(response)
    const itemRaw = (
      data?.item
      ?? (data?.items && Array.isArray(data.items) ? data.items[0] : null)
      ?? data
    ) as Record<string, unknown> | null
    if (itemRaw && typeof itemRaw === 'object' && toNumber(itemRaw.id, 0) > 0) {
      return normalizeCountItem(itemRaw)
    }
    if (countState.value) {
      const idx = countState.value.items.findIndex(item => item.id === Number(itemId))
      if (idx >= 0) {
        const existing = countState.value.items[idx]!
        const updated = {
          ...existing,
          counted_quantity: countedQuantity,
          count_status: 'done' as StocktakingItemCountStatus,
        }
        countState.value.items[idx] = updated
        return updated
      }
    }
    return null
  }

  const saveProgress = async (id: string | number) => {
    countSaving.value = true
    try {
      return await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/count/save-progress`, {
        method: 'POST',
      })
    }
    finally {
      countSaving.value = false
    }
  }

  const submitCount = async (id: string | number): Promise<SubmitCountResult | null> => {
    countSubmitting.value = true
    try {
      const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/count/submit`, {
        method: 'POST',
      })
      return extractSubmitCountResult(response)
    }
    finally {
      countSubmitting.value = false
    }
  }

  const applyCountItemUpdate = (item: StocktakingCountItem) => {
    if (!countState.value) return
    const idx = countState.value.items.findIndex(row => row.id === item.id)
    if (idx < 0) return
    countState.value.items[idx] = item
    const total = countState.value.total_items
    const counted = countState.value.items.filter(row => row.counted_quantity != null).length
    countState.value.counted_items = counted
    countState.value.progress_percentage = total > 0
      ? Math.min(100, Math.round((counted / total) * 100))
      : 0
  }

  const normalizeDecision = (value: unknown): StocktakingItemDecision => {
    const decision = String(value ?? '').toLowerCase()
    if (decision === 'accepted' || decision === 'accept') return 'accepted'
    if (decision === 'rejected' || decision === 'reject') return 'rejected'
    if (decision === 'recount_requested' || decision === 'recount') return 'recount_requested'
    return null
  }

  const normalizeVarianceSummary = (raw: unknown): StocktakingVarianceSummary => {
    const summary = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
      total_products: toNumber(summary.total_products, 0),
      matched: toNumber(summary.matched, 0),
      surplus: toNumber(summary.surplus, 0),
      shortage: toNumber(summary.shortage, 0),
      pending_decision: toNumber(summary.pending_decision, 0),
    }
  }

  const normalizeReviewItem = (raw: Record<string, unknown>): StocktakingReviewItem => {
    const base = normalizeCountItem(raw)
    return {
      ...base,
      decision: normalizeDecision(raw.decision),
      reviewer_note: raw.reviewer_note != null ? String(raw.reviewer_note) : null,
      recount_requested_at: raw.recount_requested_at != null ? String(raw.recount_requested_at) : null,
      recount_count: toNumber(raw.recount_count, 0),
      reviewed_by: normalizeSimplifiedUser(raw.reviewed_by),
      reviewed_at: raw.reviewed_at != null ? String(raw.reviewed_at) : null,
    }
  }

  const normalizeReviewState = (payload: unknown): StocktakingReviewState | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const order = (
      data.order && typeof data.order === 'object' ? data.order : data
    ) as Record<string, unknown>
    const warehouse = (
      order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null
    ) as Record<string, unknown> | null
    const type = normalizeType(order.type ?? order.stocktaking_type)
    const status = normalizeStatus(order.status)
    const itemsRaw = (
      order.items
      ?? data.items
      ?? (data.variance && typeof data.variance === 'object'
        ? (data.variance as Record<string, unknown>).items
        : null)
      ?? []
    ) as unknown[]
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map(row => normalizeReviewItem((row ?? {}) as Record<string, unknown>))
          .filter(item => item.id > 0)
      : []
    const summaryRaw = (
      order.summary
      ?? data.summary
      ?? (data.variance && typeof data.variance === 'object'
        ? (data.variance as Record<string, unknown>).summary
        : null)
    )
    const id = toNumber(order.id, 0)
    if (id <= 0) return null

    return {
      id,
      reference_id: String(order.reference_id ?? order.reference_number ?? ''),
      warehouse_name_ar: String(warehouse?.name_ar ?? order.warehouse_name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? order.warehouse_name_en ?? ''),
      type,
      type_label: String(order.type_label ?? order.stocktaking_type_label ?? type),
      status,
      status_label: String(order.status_label ?? status),
      stocktaking_date: String(
        order.stocktaking_date
        ?? order.stocktakingDate
        ?? order.date
        ?? '',
      ),
      summary: normalizeVarianceSummary(summaryRaw),
      items,
    }
  }

  const extractSubmitReviewResult = (payload: unknown): SubmitReviewResult | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const order = (
      data.order && typeof data.order === 'object' ? data.order : data
    ) as Record<string, unknown>
    const id = toNumber(order.id, 0)
    if (id <= 0) return null
    return {
      id,
      reference_id: String(order.reference_id ?? order.reference_number ?? ''),
      status: normalizeStatus(order.status),
      completed_at: order.completed_at != null ? String(order.completed_at) : null,
    }
  }

  const applyReviewUpdate = (payload: unknown) => {
    if (!reviewState.value) return
    const data = extractDataRoot(payload)
    if (!data) return
    if (data.summary) {
      reviewState.value.summary = normalizeVarianceSummary(data.summary)
    }
    if (data.status) {
      reviewState.value.status = normalizeStatus(data.status)
      reviewState.value.status_label = String(data.status)
    }
    const itemsRaw = data.items
    if (Array.isArray(itemsRaw)) {
      const updatedItems = itemsRaw
        .map(row => normalizeReviewItem((row ?? {}) as Record<string, unknown>))
        .filter(item => item.id > 0)
      for (const updated of updatedItems) {
        const idx = reviewState.value.items.findIndex(row => row.id === updated.id)
        if (idx >= 0) reviewState.value.items[idx] = updated
      }
    }
  }

  const getReview = async (id: string | number): Promise<StocktakingReviewState> => {
    reviewLoading.value = true
    try {
      const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/review`)
      const normalized = normalizeReviewState(response)
      if (!normalized) throw new Error('INVALID_REVIEW_RESPONSE')
      reviewState.value = normalized
      return normalized
    }
    finally {
      reviewLoading.value = false
    }
  }

  const updateReviewItem = async (
    orderId: string | number,
    itemId: string | number,
    payload: { decision: StocktakingItemDecision, reviewer_note?: string | null },
  ) => {
    const response = await $api(
      `${STOCKTAKING_ORDERS_ENDPOINT}/${orderId}/review/items/${itemId}`,
      {
        method: 'PUT',
        body: {
          decision: payload.decision,
          reviewer_note: payload.reviewer_note ?? null,
        },
      },
    )
    applyReviewUpdate(response)
    const data = extractDataRoot(response)
    const itemRaw = (
      data?.item
      ?? (data?.items && Array.isArray(data.items)
        ? data.items.find((row: unknown) => toNumber((row as Record<string, unknown>)?.id, 0) === Number(itemId))
        : null)
    ) as Record<string, unknown> | null
    if (itemRaw && typeof itemRaw === 'object' && toNumber(itemRaw.id, 0) > 0) {
      return normalizeReviewItem(itemRaw)
    }
    return reviewState.value?.items.find(item => item.id === Number(itemId)) ?? null
  }

  const submitReview = async (id: string | number): Promise<SubmitReviewResult | null> => {
    reviewSubmitting.value = true
    try {
      const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/review/submit`, {
        method: 'POST',
      })
      const result = extractSubmitReviewResult(response)
      if (result && reviewState.value) {
        reviewState.value.status = result.status
        reviewState.value.status_label = result.status
      }
      return result
    }
    finally {
      reviewSubmitting.value = false
    }
  }

  const normalizeActivity = (raw: Record<string, unknown>): StocktakingActivity => {
    const action = String(
      raw.action
      ?? raw.description
      ?? raw.event
      ?? raw.log_name
      ?? '',
    )
    return {
      id: toNumber(raw.id, 0),
      action,
      user: normalizeSimplifiedUser(raw.user ?? raw.causer ?? raw.actor ?? raw.created_by),
      created_at: String(raw.created_at ?? raw.createdAt ?? ''),
    }
  }

  const normalizeOrderDetail = (payload: unknown): StocktakingOrderDetail | null => {
    const data = extractDataRoot(payload)
    if (!data) return null
    const order = (
      data.order && typeof data.order === 'object' ? data.order : data
    ) as Record<string, unknown>
    const warehouse = (
      order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null
    ) as Record<string, unknown> | null
    const id = toNumber(order.id, 0)
    if (id <= 0) return null

    const counting = (
      order.counting && typeof order.counting === 'object'
        ? order.counting
        : data.counting && typeof data.counting === 'object'
          ? data.counting
          : null
    ) as Record<string, unknown> | null
    const countingItemsRaw = (counting?.items ?? []) as unknown[]
    const countingItems = Array.isArray(countingItemsRaw)
      ? countingItemsRaw
          .map(row => normalizeCountItem((row ?? {}) as Record<string, unknown>))
          .filter(item => item.id > 0)
      : []
    const countingTotal = toNumber(counting?.total_items ?? countingItems.length, countingItems.length)
    const countingCounted = toNumber(
      counting?.counted_items
      ?? countingItems.filter(item => item.counted_quantity != null).length,
      0,
    )
    const countingProgress = toNumber(
      counting?.progress_percentage
      ?? (countingTotal > 0 ? (countingCounted / countingTotal) * 100 : 0),
      0,
    )

    const variance = (
      order.variance && typeof order.variance === 'object'
        ? order.variance
        : data.variance && typeof data.variance === 'object'
          ? data.variance
          : null
    ) as Record<string, unknown> | null
    const varianceItemsRaw = (variance?.items ?? []) as unknown[]
    const varianceItems = Array.isArray(varianceItemsRaw)
      ? varianceItemsRaw
          .map(row => normalizeReviewItem((row ?? {}) as Record<string, unknown>))
          .filter(item => item.id > 0)
      : []

    const countersRaw = (order.counters ?? []) as unknown[]
    const counters = Array.isArray(countersRaw)
      ? countersRaw
          .map(row => normalizeSimplifiedUser(row))
          .filter((user): user is StocktakingSimplifiedUser => user != null)
      : []

    const activitiesRaw = (order.activities ?? data.activities ?? []) as unknown[]
    const activities = Array.isArray(activitiesRaw)
      ? activitiesRaw.map(row => normalizeActivity((row ?? {}) as Record<string, unknown>))
      : []

    const status = normalizeStatus(order.status)
    const type = normalizeType(order.type ?? order.stocktaking_type)

    return {
      id,
      reference_id: String(order.reference_id ?? order.reference_number ?? ''),
      warehouse_name_ar: String(warehouse?.name_ar ?? order.warehouse_name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? order.warehouse_name_en ?? ''),
      type,
      type_label: String(order.type_label ?? order.stocktaking_type_label ?? type),
      status,
      status_label: String(order.status_label ?? status),
      stocktaking_date: String(order.stocktaking_date ?? order.date ?? ''),
      show_registered_quantities: order.show_registered_quantities === true
        || order.show_registered_quantities === 1
        || order.show_registered_quantities === '1'
        || order.show_registered_quantities === 'true',
      notes: String(order.notes ?? ''),
      created_at: String(order.created_at ?? ''),
      submitted_at: order.submitted_at != null ? String(order.submitted_at) : null,
      completed_at: order.completed_at != null ? String(order.completed_at) : null,
      cancelled_at: order.cancelled_at != null ? String(order.cancelled_at) : null,
      counters,
      created_by: normalizeSimplifiedUser(order.created_by),
      submitted_by: normalizeSimplifiedUser(order.submitted_by),
      cancelled_by: normalizeSimplifiedUser(order.cancelled_by),
      activities,
      counting: {
        progress_percentage: Math.min(100, Math.max(0, countingProgress)),
        total_items: countingTotal,
        counted_items: countingCounted,
        items: countingItems,
      },
      variance: {
        summary: normalizeVarianceSummary(variance?.summary),
        items: varianceItems,
      },
    }
  }

  const getOrderDetail = async (id: string | number): Promise<StocktakingOrderDetail> => {
    detailLoading.value = true
    try {
      const response = await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}`)
      const normalized = normalizeOrderDetail(response)
      if (!normalized) throw new Error('INVALID_DETAIL_RESPONSE')
      detailState.value = normalized
      return normalized
    }
    finally {
      detailLoading.value = false
    }
  }

  const cancelOrder = async (id: string | number) => {
    return await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}/cancel`, { method: 'PATCH' })
  }

  const deleteOrder = async (id: string | number) => {
    return await $api(`${STOCKTAKING_ORDERS_ENDPOINT}/${id}`, { method: 'DELETE' })
  }

  const extractCreatedOrderId = (payload: unknown): number | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const order = (
      nested?.stocktaking_order
      ?? root.stocktaking_order
      ?? nested?.order
      ?? root.order
      ?? nested
      ?? root
    ) as Record<string, unknown> | null
    const id = Number(order?.id ?? root.id)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  const createOrder = async (payload: CreateStocktakingOrderPayload) => {
    submitting.value = true
    try {
      const response = await $api(STOCKTAKING_ORDERS_ENDPOINT, {
        method: 'POST',
        body: payload,
      })
      return {
        response,
        id: extractCreatedOrderId(response),
      }
    }
    finally {
      submitting.value = false
    }
  }

  return {
    list,
    listLoading,
    pagination,
    submitting,
    countLoading,
    countSaving,
    countSubmitting,
    countState,
    reviewLoading,
    reviewSubmitting,
    reviewState,
    detailLoading,
    detailState,
    draft,
    loadList,
    startOrder,
    cancelOrder,
    deleteOrder,
    getCount,
    scanBarcode,
    updateItemQuantity,
    saveProgress,
    submitCount,
    applyCountItemUpdate,
    getReview,
    updateReviewItem,
    submitReview,
    getOrderDetail,
    resetDraft,
    createOrder,
  }
})
