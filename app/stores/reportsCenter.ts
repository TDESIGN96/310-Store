import { defineStore } from 'pinia'

export interface ReportsCenterPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface ReportsCenterLabelValue {
  value: string
  label: string
}

export interface ReportsCenterItem {
  id: number
  name: string
  report_type: ReportsCenterLabelValue | null
  format: ReportsCenterLabelValue | null
  status: ReportsCenterLabelValue | null
  filters: unknown[]
  download_url: string
  generated_on: string
  expires_on: string
}

/** Statuses that mean "still working" — export/delete must stay disabled while these are active. */
const PROCESSING_STATUS_VALUES = new Set([
  'pending',
  'processing',
  'queued',
  'in_progress',
  'generating',
])

const REPORTS_CENTER_ENDPOINT = '/reports-center'

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export const normalizeReportsCenterLabelValue = (raw: unknown): ReportsCenterLabelValue | null => {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const value = String(obj.value ?? '')
  const label = String(obj.label ?? value)
  if (!value && !label) return null
  return { value, label }
}

/** Shared with `app/stores/reports.ts` — the report export endpoints return the same shape as a Reports Center record. */
export const normalizeReportsCenterItem = (raw: unknown): ReportsCenterItem | null => {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const id = toNumber(obj.id, 0)
  if (!id) return null
  return {
    id,
    name: String(obj.name ?? ''),
    report_type: normalizeReportsCenterLabelValue(obj.report_type),
    format: normalizeReportsCenterLabelValue(obj.format),
    status: normalizeReportsCenterLabelValue(obj.status),
    filters: Array.isArray(obj.filters) ? obj.filters.filter(f => f !== null && f !== undefined) : [],
    download_url: String(obj.download_url ?? ''),
    generated_on: String(obj.generated_on ?? ''),
    expires_on: String(obj.expires_on ?? ''),
  }
}

export const useReportsCenterStore = defineStore('reportsCenter', () => {
  const { $api } = useApi()

  const list = ref<ReportsCenterItem[]>([])
  const listLoading = ref(false)
  const pagination = ref<ReportsCenterPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })

  const extractList = (payload: unknown): ReportsCenterItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (nested?.records ?? root.records ?? []) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows.map(normalizeReportsCenterItem).filter((x): x is ReportsCenterItem => Boolean(x))
  }

  const extractPagination = (payload: unknown): ReportsCenterPagination | null => {
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

  /** Report is still being generated — export/delete must stay disabled. */
  const isReportProcessing = (item: ReportsCenterItem): boolean => {
    const statusValue = item.status?.value?.toLowerCase() ?? ''
    if (PROCESSING_STATUS_VALUES.has(statusValue)) return true
    return !item.download_url
  }

  const loadList = async (params: Record<string, string | number | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api(REPORTS_CENTER_ENDPOINT, { params })
      list.value = extractList(response)
      const nextPagination = extractPagination(response)
      if (nextPagination) pagination.value = nextPagination
      return list.value
    }
    finally {
      listLoading.value = false
    }
  }

  const deleteReport = async (id: number | string) => {
    return await $api(`${REPORTS_CENTER_ENDPOINT}/${id}`, { method: 'DELETE' })
  }

  return {
    list,
    listLoading,
    pagination,
    isReportProcessing,
    loadList,
    deleteReport,
  }
})
