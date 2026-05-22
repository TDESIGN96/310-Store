<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Plus,
  Search,
  Pencil,
  Copy,
  FilePlus2,
  Trash2,
  Loader2,
  Filter,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { QuotationListItem } from '@/stores/quotations'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { loadActiveWarehouses } = useInvoiceWarehouses()
const { canAccess, canCreate, canEdit, canDelete } = usePermissions()
const quotationsStore = useQuotationsStore()
const invoicesStore = useInvoicesStore()

const canViewQuotations = computed(() => canAccess('quotations'))
const canCreateQuotation = computed(() => canCreate('quotations'))
const canEditQuotation = computed(() => canEdit('quotations'))
const canDeleteQuotation = computed(() => canDelete('quotations'))

const search = ref('')
const filterStatus = ref<'all' | 'active' | 'expired'>('all')
const issueFrom = ref('')
const dueFrom = ref('')
const currentPage = ref(1)
const deleteTarget = ref<QuotationListItem | null>(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const copyingId = ref<number | null>(null)
const convertingId = ref<number | null>(null)
const conversionWarehouseId = ref<number | null>(null)
const selectedIds = ref<Set<number>>(new Set())
const bulkDeleteConfirmOpen = ref(false)
const bulkDeleteLoading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(
  () =>
    search.value.trim().length > 0
    || filterStatus.value !== 'all'
    || Boolean(issueFrom.value)
    || Boolean(dueFrom.value),
)
const isAllSelected = computed(
  () => sortedList.value.length > 0 && sortedList.value.every(row => selectedIds.value.has(row.id)),
)
const isIndeterminate = computed(
  () => sortedList.value.some(row => selectedIds.value.has(row.id)) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)

const toggleSelectAll = () => {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) sortedList.value.forEach(row => next.delete(row.id))
  else sortedList.value.forEach(row => next.add(row.id))
  selectedIds.value = next
}

const toggleSelect = (id: number) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const list = computed(() => quotationsStore.list)
const sortedList = computed(() => {
  return [...list.value].sort((a, b) => {
    const aTime = new Date(a.created_at || a.issue_date).getTime()
    const bTime = new Date(b.created_at || b.issue_date).getTime()
    return bTime - aTime
  })
})
const pagination = computed(() => quotationsStore.pagination)
const loading = computed(() => quotationsStore.listLoading)

const fmtDate = (value?: string) => {
  return formatDisplayDate(value)
}
const normalizePickerDate = (value: string): string | undefined => {
  const raw = value.trim()
  if (!raw) return undefined
  // DD-MM-YYYY (flatpickr output format)
  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  // YYYY-MM-DD fallback
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!isoMatch) return undefined
  const year = Number(isoMatch[1])
  const month = Number(isoMatch[2])
  const day = Number(isoMatch[3])
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const toIsoDateTimeStart = (value: string): string | undefined => {
  const normalized = normalizePickerDate(value)
  if (!normalized) return undefined
  return `${normalized}T00:00:00.000Z`
}
const fmtMoney = (value?: number) => Number(value ?? 0).toFixed(2)

const isEditable = (row: QuotationListItem) => {
  return row.status === 'active' || row.status === 'expired'
}
const isDeletable = (row: QuotationListItem) => {
  return row.status === 'active' || row.status === 'expired'
}
const canEditRow = (row: QuotationListItem) => canEditQuotation.value && isEditable(row)

const loadRows = async (page = currentPage.value) => {
  if (!canViewQuotations.value) return
  currentPage.value = page
  const params: Record<string, string | number | undefined> = {
    page,
    sort: '-created_at',
    search: search.value.trim() || undefined,
    reference_number: search.value.trim() || undefined,
    customer_name: search.value.trim() || undefined,
    issue_date: toIsoDateTimeStart(issueFrom.value),
    expiry_date: toIsoDateTimeStart(dueFrom.value),
    status: filterStatus.value === 'all' ? undefined : filterStatus.value,
  }
  await quotationsStore.loadList(params)
  selectedIds.value = new Set()
}

const resetFilters = async () => {
  search.value = ''
  filterStatus.value = 'all'
  issueFrom.value = ''
  dueFrom.value = ''
  await loadRows(1)
}

const requestDelete = (row: QuotationListItem) => {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await quotationsStore.deleteQuotation(deleteTarget.value.id)
    toast.success(t('quotations_page.delete_success'))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('quotations_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

const confirmBulkDelete = async () => {
  if (selectedIds.value.size === 0) return
  bulkDeleteConfirmOpen.value = false
  bulkDeleteLoading.value = true
  try {
    const ids = [...selectedIds.value]
    await Promise.all(ids.map(id => quotationsStore.deleteQuotation(id)))
    toast.success(t('common.bulk_deleted_success', { count: ids.length }))
    selectedIds.value = new Set()
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('quotations_page.delete_error'))
  }
  finally {
    bulkDeleteLoading.value = false
  }
}

const extractCreatedQuotationId = (response: unknown): number | null => {
  if (!response || typeof response !== 'object') return null
  const root = response as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const quotation = (nested?.quotation ?? root.quotation ?? null) as Record<string, unknown> | null
  const id = Number(quotation?.id ?? 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

const toFiniteNumberOrUndefined = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const resolveQuotationDeliveryFeesForConvert = (quotation: Record<string, unknown>): number => {
  const nestedDistrict = (quotation.district && typeof quotation.district === 'object')
    ? quotation.district as Record<string, unknown>
    : null
  const fromQuotation = toFiniteNumberOrUndefined(quotation.delivery_fees)
    ?? toFiniteNumberOrUndefined(quotation.delivery_fee)
    ?? toFiniteNumberOrUndefined(nestedDistrict?.delivery_fee)
  if (fromQuotation !== undefined) return Math.max(0, fromQuotation)

  const fallback = Number(quotation.grand_total ?? 0) - Number(quotation.subtotal ?? 0) + Number(quotation.total_discount ?? 0)
  return Number.isFinite(fallback) ? Math.max(0, fallback) : 0
}

const ensureConversionWarehouseCandidates = async (): Promise<number[]> => {
  const warehouses = await loadActiveWarehouses()
  const ids = warehouses
    .map(warehouse => Number(warehouse.id))
    .filter(id => Number.isFinite(id) && id > 0)
  if (conversionWarehouseId.value && !ids.includes(conversionWarehouseId.value)) {
    return [conversionWarehouseId.value, ...ids]
  }
  return conversionWarehouseId.value ? [conversionWarehouseId.value, ...ids.filter(id => id !== conversionWarehouseId.value)] : ids
}

const validateQuotationConversion = async (quotationId: number, warehouseId: number): Promise<{ canConvert: boolean, message: string }> => {
  try {
    const endpoint = String(`/quotations/${quotationId}/validate-conversion-to-invoice`)
    const res = await (($api as unknown) as (url: string, options: { method: string, body?: Record<string, unknown> }) => Promise<unknown>)(endpoint, {
      method: 'POST',
      body: { warehouse_id: warehouseId },
    }) as Record<string, unknown>

    const nested = (res.data && typeof res.data === 'object') ? res.data as Record<string, unknown> : null
    const canConvert = Boolean(nested?.can_convert ?? res.can_convert)
    const returnedMessage = typeof res.message === 'string' ? res.message.trim() : ''

    return {
      canConvert,
      message: returnedMessage || t('quotations_page.convert_error'),
    }
  }
  catch (error: unknown) {
    return {
      canConvert: false,
      message: getErrorMessage(error) || t('quotations_page.convert_error'),
    }
  }
}

const resolveConvertibleWarehouse = async (
  quotationId: number,
): Promise<{ warehouseId: number | null, message: string }> => {
  const candidates = await ensureConversionWarehouseCandidates()
  if (!candidates.length) {
    return {
      warehouseId: null,
      message: t('invoices_page.warehouse_required'),
    }
  }

  let lastMessage = t('quotations_page.convert_error')
  for (const warehouseId of candidates) {
    const result = await validateQuotationConversion(quotationId, warehouseId)
    if (result.canConvert) {
      conversionWarehouseId.value = warehouseId
      return { warehouseId, message: '' }
    }
    if (result.message) lastMessage = result.message
  }

  return {
    warehouseId: null,
    message: lastMessage,
  }
}

const cloneQuotation = async (row: QuotationListItem) => {
  if (!canCreateQuotation.value) return
  copyingId.value = row.id
  try {
    const source = await quotationsStore.loadById(row.id)
    if (!source) {
      toast.error(t('quotations_page.copy_error'))
      return
    }

    // Start from existing draft mapper so items/totals stay aligned with create/edit forms.
    quotationsStore.hydrateDraftFromQuotation(source)
    const today = new Date().toISOString().slice(0, 10)
    const sourceRef = String(source.reference_number ?? row.reference_number ?? `#${row.id}`)
    const copyNote = t('quotations_page.copied_from_note', { ref: sourceRef })
    const previousNotes = String(quotationsStore.draft.notes ?? '').trim()

    quotationsStore.draft.id = null
    quotationsStore.draft.reference_number = ''
    quotationsStore.draft.issue_date = today
    quotationsStore.draft.expiry_date = today
    quotationsStore.draft.notes = previousNotes ? `${previousNotes}\n${copyNote}` : copyNote

    const payload = {
      ...quotationsStore.buildPayload(),
      status: 'active',
    }
    const created = await $api('/quotations', {
      method: 'POST',
      body: payload,
    })
    const createdId = extractCreatedQuotationId(created)
    if (!createdId) {
      toast.error(t('quotations_page.copy_error'))
      return
    }

    toast.success(t('quotations_page.copy_success'))
    await loadRows(1)
    await navigateTo(`/quotations/edit/${createdId}`)
  }
  catch {
    toast.error(t('quotations_page.copy_error'))
  }
  finally {
    copyingId.value = null
  }
}

const convertToInvoice = async (row: QuotationListItem) => {
  convertingId.value = row.id
  try {
    const warehouseResolution = await resolveConvertibleWarehouse(row.id)
    const warehouseId = warehouseResolution.warehouseId
    if (!warehouseId) {
      toast.error(warehouseResolution.message || t('quotations_page.convert_error'))
      return
    }

    const source = await quotationsStore.loadById(row.id)
    if (!source) {
      toast.error(t('quotations_page.convert_error'))
      return
    }

    invoicesStore.hydrateDraftFromQuotationForConvert(source)
    const resolvedDeliveryFees = resolveQuotationDeliveryFeesForConvert(source)
    invoicesStore.draft.delivery_fees = resolvedDeliveryFees
    invoicesStore.draft.warehouse_id = warehouseId
    toast.success(t('quotations_page.convert_success'))
    await navigateTo({
      path: '/invoices/create',
      query: {
        source: 'quotation',
        source_id: String(row.id),
      },
    })
  }
  catch {
    toast.error(t('quotations_page.convert_error'))
  }
  finally {
    convertingId.value = null
  }
}

watch(
  [search, filterStatus, issueFrom, dueFrom],
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => loadRows(1), 300)
  },
  { deep: true },
)

onMounted(async () => {
  await loadRows(1)
})

const goToPage = (page: number) => {
  if (page < 1 || page > pagination.value.last_page) return
  loadRows(page)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('quotations_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{
            t('quotations_page.subtitle_total', {
              count: pagination.total ?? sortedList.length,
            })
          }}
        </p>
      </div>
    </div>

    <div
      v-if="!canViewQuotations"
      class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800"
    >
      {{ t('quotations_page.no_permission') }}
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2 flex-1">
          <div class="relative min-w-[200px] max-w-sm">
            <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="search"
              :placeholder="t('quotations_page.list_search_placeholder')"
              class="h-9 pr-9"
            />
            <Loader2
              v-if="loading && search.trim()"
              class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          </div>

          <Select v-model="filterStatus">
            <SelectTrigger class="h-9 w-[200px] gap-2">
              <Filter class="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue :placeholder="t('quotations_page.filter_status')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('quotations_page.filter_status_all') }}</SelectItem>
              <SelectItem value="active">{{ t('quotations_page.filter_status_active') }}</SelectItem>
              <SelectItem value="expired">{{ t('quotations_page.filter_status_expired') }}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            size="sm"
            class="h-9 gap-1.5 text-muted-foreground"
            :disabled="loading"
            @click="resetFilters"
          >
            <X class="size-3.5" />
            {{ t('quotations_page.reset_filters') }}
          </Button>
        </div>

        <Button
          v-if="canCreateQuotation"
          class="h-9 gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030] shrink-0"
          as-child
        >
          <NuxtLink to="/quotations/create">
            <Plus class="size-4" />
            {{ t('quotations_page.new_quotation') }}
          </NuxtLink>
        </Button>
      </div>

      <div class="flex flex-col gap-4 rounded-lg border bg-card/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">{{ t('quotations_page.issue_date') }}</span>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">{{ t('quotations_page.issue_date_from') }}</label>
            <DatePickerInput v-model="issueFrom" class="w-full" />
          </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">{{ t('quotations_page.col_due_date') }}</span>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">{{ t('quotations_page.due_date_from') }}</label>
            <DatePickerInput v-model="dueFrom" class="w-full" />
          </div>
        </div>
      </div>
      <div
        v-if="selectedCount > 0"
        class="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/70 px-4 py-2.5 flex-wrap"
      >
        <span class="text-sm font-medium text-red-700">
          {{ t('common.bulk_delete_only_notice', { count: selectedCount }) }}
        </span>
        <div class="flex items-center gap-2 ms-auto">
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-red-600 border-red-300 hover:bg-red-100"
            :disabled="bulkDeleteLoading"
            @click="bulkDeleteConfirmOpen = true"
          >
            {{ t('common.delete') }}
          </Button>
          <Button variant="ghost" size="sm" class="h-8 text-muted-foreground" @click="selectedIds = new Set()">
            {{ t('common.deselect') }}
          </Button>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="w-10 text-center">
                <Checkbox
                  :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                  class="mt-0.5 mx-4"
                  @update:model-value="toggleSelectAll"
                />
              </TableHead>
              <TableHead class="text-start font-medium min-w-[120px]">
                {{ t('quotations_page.col_ref_id') }}
              </TableHead>
              <TableHead class="text-start font-medium min-w-[140px]">
                {{ t('quotations_page.col_customer') }}
              </TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('quotations_page.col_issue_date') }}
              </TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('quotations_page.col_due_date') }}
              </TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('quotations_page.col_status') }}
              </TableHead>
              <TableHead class="text-end font-medium whitespace-nowrap">
                {{ t('quotations_page.col_discount_amount') }}
              </TableHead>
              <TableHead class="text-end font-medium whitespace-nowrap">
                {{ t('quotations_page.col_total') }}
              </TableHead>
              <TableHead class="text-end font-medium min-w-[200px]">
                {{ t('quotations_page.col_actions') }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell :colspan="9" class="py-14 text-center">
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  {{ t('common.loading') }}…
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!sortedList.length">
              <TableCell :colspan="9" class="py-14 text-center text-sm text-muted-foreground">
                {{ t('quotations_page.empty') }}
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in sortedList"
              :key="row.id"
              class="hover:bg-muted/30 transition-colors align-middle"
              :class="{ 'bg-muted/20': selectedIds.has(row.id) }"
            >
              <TableCell class="w-10">
                <Checkbox
                  :model-value="selectedIds.has(row.id)"
                  class="mt-0.5 mx-4"
                  @update:model-value="toggleSelect(row.id)"
                />
              </TableCell>
              <TableCell class="text-sm font-medium">
                <NuxtLink
                  :to="`/quotations/show/${row.id}`"
                  class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
                >
                  {{ row.reference_number || `#${row.id}` }}
                </NuxtLink>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                <div class="flex flex-col gap-0.5">
                  <span>{{ row.customer_name || '—' }}</span>
                  <span class="text-xs text-muted-foreground/80">
                    {{ t('quotations_page.district') }}: {{ row.district_name || t('quotations_page.district_unassigned') }}
                  </span>
                </div>
              </TableCell>
              <TableCell class="text-sm tabular-nums">{{ fmtDate(row.issue_date) }}</TableCell>
              <TableCell class="text-sm tabular-nums">{{ fmtDate(row.expiry_date) }}</TableCell>
              <TableCell>
                <Badge :variant="row.status === 'active' ? 'outline' : 'secondary'">
                  {{
                    row.status === 'active'
                      ? t('quotations_page.filter_status_active')
                      : row.status === 'expired'
                        ? t('quotations_page.filter_status_expired')
                        : String(row.status || '—')
                  }}
                </Badge>
              </TableCell>
              <TableCell class="text-end text-sm tabular-nums">{{ fmtMoney(row.total_discount) }}</TableCell>
              <TableCell class="text-end text-sm tabular-nums">{{ fmtMoney(row.grand_total) }}</TableCell>
              <TableCell class="text-end">
                <TableRowActions
                  :actions="[
                    { key: `edit-${row.id}`, label: t('common.edit'), type: canEditRow(row) ? 'link' : 'button', to: canEditRow(row) ? `/quotations/edit/${row.id}` : undefined, icon: Pencil, tone: 'default', disabled: !canEditRow(row) },
                    { key: `copy-${row.id}`, label: t('common.copy'), type: 'button', icon: Copy, tone: 'default', visible: canCreateQuotation, disabled: copyingId === row.id || loading, loading: copyingId === row.id, onClick: () => cloneQuotation(row) },
                    { key: `convert-${row.id}`, label: t('quotations_page.action_convert'), type: 'button', icon: FilePlus2, tone: 'default', disabled: convertingId === row.id || loading, loading: convertingId === row.id, onClick: () => convertToInvoice(row) },
                    { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', disabled: !canDeleteQuotation || !isDeletable(row), onClick: () => requestDelete(row) },
                  ]"
                  variant="invoice"
                  align="end"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div
        v-if="pagination.last_page > 1"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg px-4 py-3"
      >
        <p class="text-xs text-muted-foreground">
          {{
            t('common.showing_range', {
              from: pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0,
              to: pagination.total ? Math.min(currentPage * pagination.per_page, pagination.total) : 0,
              total: pagination.total,
            })
          }}
        </p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loading"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        >
          <span class="text-sm text-muted-foreground px-2 tabular-nums">
            {{
              t('common.page_of', {
                current: currentPage,
                total: pagination.last_page,
              })
            }}
          </span>
        </PaginationArrowButtons>
      </div>
    </template>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('quotations_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('quotations_page.delete_body', { ref: deleteTarget?.reference_number || `#${deleteTarget?.id || ''}` }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction class="bg-red-600 text-white hover:bg-red-700" :disabled="deleting" @click="confirmDelete">
            <Loader2 v-if="deleting" class="me-2 size-4 animate-spin" />
            {{ t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="bulkDeleteConfirmOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('common.bulk_delete_selected_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('common.bulk_delete_selected_body', { count: selectedCount }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="bulkDeleteLoading">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction class="bg-red-600 text-white hover:bg-red-700" :disabled="bulkDeleteLoading" @click="confirmBulkDelete">
            <Loader2 v-if="bulkDeleteLoading" class="me-2 size-4 animate-spin" />
            {{ t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
