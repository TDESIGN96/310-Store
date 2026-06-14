import { ref } from 'vue'
import { defineStore } from 'pinia'

export type DamageReason =
  | 'manufacturing_defect'
  | 'storage_damage'
  | 'transport_damage'
  | 'expired_material'
  | 'customer_return_damaged'
  | 'other'

export interface DamageDraft {
  variation_id: number | null
  warehouse_id: number | null
  damaged_quantity: number
  damage_reason: DamageReason | ''
  damage_reason_specified: string
  photo_urls: string[]
  notes: string
}

export interface DamageRecordListItem {
  id: string
  reference_id: string
  product_name: string
  variation_name: string
  warehouse_name: string
  sku: string
  damaged_quantity: number
  damage_reason: string
  damage_reason_label: string
  estimated_loss: number
  status: string
  status_label: string
  created_at: string
  has_disposition: boolean
}

export interface DamageRecordPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface CreateDamageRecordPayload {
  variation_id: number
  warehouse_id: number
  damaged_quantity: number
  damage_reason: DamageReason
  damage_reason_specified?: string | null
  notes?: string | null
  photo_urls?: string[] | null
}

export interface UpdateDamageRecordPayload {
  product_id: number
  variation_id: number
  warehouse_id: number
  damaged_quantity: number
  damage_reason: DamageReason
  damage_reason_specified?: string | null
  notes?: string | null
  photo_urls?: string[] | null
}

export interface DamageRecordUser {
  id: number
  name: string
}

export type DispositionAction =
  | 'discard'
  | 'return_to_supplier'
  | 'sell_at_discount'
  | 'other'

export interface DamageRecordDisposition {
  id: number
  damage_record_id: number
  action_taken: DispositionAction
  action_taken_label: string
  action_taken_specified: string | null
  notes: string | null
  recorded_by: DamageRecordUser | null
  recorded_at: string | null
}

export interface DispositionPayload {
  action_taken: DispositionAction
  action_taken_specified?: string | null
  notes?: string | null
}

export interface DamageRecordDetail {
  id: number
  reference_id: string
  product_id: number
  product_name: string
  variation_id: number
  variation_name: string
  sku: string
  warehouse_id: number
  warehouse_name: string
  available_quantity: number
  damaged_quantity: number
  damage_reason: DamageReason
  damage_reason_label: string
  damage_reason_specified: string | null
  estimated_loss: number
  status: string
  status_label: string
  notes: string | null
  photo_urls: string[]
  created_by: DamageRecordUser | null
  created_at: string
  approved_by: DamageRecordUser | null
  approved_at: string | null
  rejected_by: DamageRecordUser | null
  rejection_reason: string | null
  rejected_at: string | null
  cancelled_by: DamageRecordUser | null
  cancellation_reason: string | null
  cancelled_at: string | null
  disposition: DamageRecordDisposition | null
}

const createDefaultDraft = (): DamageDraft => ({
  variation_id: null,
  warehouse_id: null,
  damaged_quantity: 0,
  damage_reason: '',
  damage_reason_specified: '',
  photo_urls: [],
  notes: '',
})

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeListItem = (raw: Record<string, unknown>): DamageRecordListItem => ({
  id: String(raw.id ?? ''),
  reference_id: String(raw.reference_id ?? ''),
  product_name: String(raw.product_name ?? ''),
  variation_name: String(raw.variation_name ?? ''),
  warehouse_name: String(raw.warehouse_name ?? ''),
  sku: String(raw.sku ?? ''),
  damaged_quantity: toNumber(raw.damaged_quantity),
  damage_reason: String(raw.damage_reason ?? ''),
  damage_reason_label: String(raw.damage_reason_label ?? raw.damage_reason ?? ''),
  estimated_loss: toNumber(raw.estimated_loss),
  status: String(raw.status ?? ''),
  status_label: String(raw.status_label ?? raw.status ?? ''),
  created_at: String(raw.created_at ?? ''),
  has_disposition: Boolean(raw.has_disposition ?? (raw.disposition !== null && raw.disposition !== undefined && typeof raw.disposition === 'object')),
})

const extractList = (payload: unknown): DamageRecordListItem[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const candidates = [nested?.damage_records, root.damage_records, nested?.data, root.data]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .filter(item => item && typeof item === 'object')
        .map(item => normalizeListItem(item as Record<string, unknown>))
    }
  }
  return []
}

const extractPagination = (payload: unknown): DamageRecordPagination | null => {
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

export const useDamageRecordsStore = defineStore('damageRecords', () => {
  const { $api } = useApi()
  const ENDPOINT = '/damage-records'

  const draft = ref<DamageDraft>(createDefaultDraft())
  const submitting = ref(false)
  const list = ref<DamageRecordListItem[]>([])
  const pagination = ref<DamageRecordPagination>({ current_page: 1, last_page: 1, per_page: 15, total: 0 })
  const listLoading = ref(false)

  const resetDraft = () => {
    draft.value = createDefaultDraft()
  }

  const loadList = async (params: Record<string, string | number | string[] | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api(ENDPOINT, { params })
      list.value = extractList(response)
      const nextPagination = extractPagination(response)
      if (nextPagination) pagination.value = nextPagination
      return list.value
    }
    finally {
      listLoading.value = false
    }
  }

  const createRecord = async (payload: CreateDamageRecordPayload) => {
    submitting.value = true
    try {
      const response = await $api(ENDPOINT, { method: 'POST', body: payload })
      return response
    }
    finally {
      submitting.value = false
    }
  }

  const extractDamageRecord = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const record = (nested?.record ?? nested?.damage_record ?? root.record ?? root.damage_record ?? null) as Record<string, unknown> | null
    return record?.id ? record : null
  }

  const normalizePhotoUrls = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter(v => typeof v === 'string' && v)
    if (typeof value === 'string' && value) return [value]
    return []
  }

  const extractUser = (val: unknown): DamageRecordUser | null => {
    if (!val || typeof val !== 'object') return null
    const u = val as Record<string, unknown>
    return { id: toNumber(u.id), name: String(u.name ?? '') }
  }

  const extractDisposition = (val: unknown): DamageRecordDisposition | null => {
    if (!val || typeof val !== 'object') return null
    const d = val as Record<string, unknown>
    if (!d.id) return null
    return {
      id: toNumber(d.id),
      damage_record_id: toNumber(d.damage_record_id),
      action_taken: (d.action_taken as DispositionAction) ?? 'discard',
      action_taken_label: String(d.action_taken_label ?? d.action_taken ?? ''),
      action_taken_specified: d.action_taken_specified ? String(d.action_taken_specified) : null,
      notes: d.notes ? String(d.notes) : null,
      recorded_by: extractUser(d.recorded_by),
      recorded_at: d.recorded_at ? String(d.recorded_at) : null,
    }
  }

  const loadById = async (id: string | number): Promise<DamageRecordDetail | null> => {
    const response = await $api<Record<string, unknown>>(`${ENDPOINT}/${id}`)
    const raw = extractDamageRecord(response)
    if (!raw) return null
    return {
      id: toNumber(raw.id),
      reference_id: String(raw.reference_id ?? ''),
      product_id: toNumber(raw.product_id),
      product_name: String(raw.product_name ?? ''),
      variation_id: toNumber(raw.variation_id),
      variation_name: String(raw.variation_name ?? ''),
      sku: String(raw.sku ?? ''),
      warehouse_id: toNumber(raw.warehouse_id),
      warehouse_name: String(raw.warehouse_name ?? ''),
      available_quantity: toNumber(raw.available_quantity),
      damaged_quantity: toNumber(raw.damaged_quantity),
      damage_reason: (raw.damage_reason as DamageReason) ?? 'other',
      damage_reason_label: String(raw.damage_reason_label ?? raw.damage_reason ?? ''),
      damage_reason_specified: raw.damage_reason_specified ? String(raw.damage_reason_specified) : null,
      estimated_loss: toNumber(raw.estimated_loss),
      status: String(raw.status ?? ''),
      status_label: String(raw.status_label ?? raw.status ?? ''),
      notes: raw.notes ? String(raw.notes) : null,
      photo_urls: normalizePhotoUrls(raw.photo_urls),
      created_by: extractUser(raw.created_by),
      created_at: String(raw.created_at ?? ''),
      approved_by: extractUser(raw.approved_by),
      approved_at: raw.approved_at ? String(raw.approved_at) : null,
      rejected_by: extractUser(raw.rejected_by),
      rejection_reason: raw.rejection_reason ? String(raw.rejection_reason) : null,
      rejected_at: raw.rejected_at ? String(raw.rejected_at) : null,
      cancelled_by: extractUser(raw.cancelled_by),
      cancellation_reason: raw.cancellation_reason ? String(raw.cancellation_reason) : null,
      cancelled_at: raw.cancelled_at ? String(raw.cancelled_at) : null,
      disposition: extractDisposition(
        (response as Record<string, unknown>)?.data && typeof (response as Record<string, unknown>).data === 'object'
          ? ((response as Record<string, unknown>).data as Record<string, unknown>).disposition
          : null,
      ),
    }
  }

  const approveRecord = (id: string | number) =>
    $api(`${ENDPOINT}/${id}/approve`, { method: 'PATCH' })

  const rejectRecord = (id: string | number, rejection_reason: string) =>
    $api(`${ENDPOINT}/${id}/reject`, { method: 'PATCH', body: { rejection_reason } })

  const cancelRecord = (id: string | number, cancellation_reason: string) =>
    $api(`${ENDPOINT}/${id}/cancel`, { method: 'PATCH', body: { cancellation_reason } })

  const createDisposition = (id: string | number, payload: DispositionPayload) =>
    $api(`${ENDPOINT}/${id}/disposition`, { method: 'POST', body: payload })

  const updateDisposition = (id: string | number, payload: DispositionPayload) =>
    $api(`${ENDPOINT}/${id}/disposition`, { method: 'PUT', body: payload })

  const updateRecord = async (id: string | number, payload: UpdateDamageRecordPayload) => {
    submitting.value = true
    try {
      return await $api(`${ENDPOINT}/${id}`, { method: 'PUT', body: payload })
    }
    finally {
      submitting.value = false
    }
  }

  return {
    draft,
    submitting,
    list,
    pagination,
    listLoading,
    resetDraft,
    loadList,
    createRecord,
    loadById,
    updateRecord,
    approveRecord,
    rejectRecord,
    cancelRecord,
    createDisposition,
    updateDisposition,
  }
})
