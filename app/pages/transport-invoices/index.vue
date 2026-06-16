<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Plus,
  Search,
  Pencil,
  Copy,
  RotateCcw,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { TransportInvoiceListItem } from '@/stores/transportInvoices'
import { useInvoicesStore } from '@/stores/invoices'
import { useTransportInvoicesStore } from '@/stores/transportInvoices'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber, formatDisplayGrandTotal } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { canAccess, canCreate, canEdit, canDelete, can } = usePermissions()
const invoicesStore = useInvoicesStore()
const transportInvoicesStore = useTransportInvoicesStore()
const { $api } = useApi()

const canViewInvoices = computed(() => canAccess('invoices'))
const canCreateInvoice = computed(() => canCreate('invoices'))
const canEditInvoice = computed(() => canEdit('invoices'))
const canDeleteInvoice = computed(() => canDelete('invoices'))
const canCreateInvoiceReturn = computed(() => can('invoice_returns.store'))

const search = ref('')
// const filterStatus = ref<'all' | 'pending' | 'in_delivery' | 'complete'>('all')
const invoiceDate = ref('')
const supplyDate = ref('')
const currentPage = ref(1)
const deleteTarget = ref<TransportInvoiceListItem | null>(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const copyingId = ref<number | null>(null)
const selectedIds = ref<Set<number>>(new Set())
const bulkDeleteConfirmOpen = ref(false)
const bulkDeleteLoading = ref(false)
const shipmentSyncLoading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// const hasActiveFilters = computed(
//   () => search.value.trim().length > 0 || filterStatus.value !== 'all' || Boolean(invoiceDate.value) || Boolean(supplyDate.value),
// )
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

const list = computed(() => transportInvoicesStore.list)
const sortedList = computed(() => {
  return [...list.value].sort((a, b) => {
    const aTime = new Date(a.invoice_date).getTime()
    const bTime = new Date(b.invoice_date).getTime()
    return bTime - aTime
  })
})
const pagination = computed(() => transportInvoicesStore.pagination)
const loading = computed(() => transportInvoicesStore.listLoading)

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
const toIsoDateTimeEnd = (value: string): string | undefined => {
  const normalized = normalizePickerDate(value)
  if (!normalized) return undefined
  return `${normalized}T23:59:59.999Z`
}
const fmtMoney = (value?: number) => formatDisplayNumber(value ?? 0, { locale: locale.value })
const fmtGrandTotal = (value?: number) => formatDisplayGrandTotal(value ?? 0, { locale: locale.value })
const warehouseLabel = (row: TransportInvoiceListItem) => {
  const nameAr = row.warehouse_name_ar || ''
  const nameEn = row.warehouse_name_en || ''
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
}

const statusLabel = (row: TransportInvoiceListItem) => {
  if (row.status_label) return row.status_label
  if (row.status === 'pending') return t('transport_invoices_page.status_pending')
  if (row.status === 'in_delivery') return t('transport_invoices_page.status_in_delivery')
  if (row.status === 'complete') return t('transport_invoices_page.status_complete')
  return row.status || '—'
}

const loadRows = async (page = currentPage.value) => {
  if (!canViewInvoices.value) return
  currentPage.value = page
  const query = search.value.trim()
  const params: Record<string, string | number | undefined> = {
    page,
    sort: '-created_at',
    search: query || undefined,
    reference_number: query || undefined,
    customer_name: query || undefined,
    invoice_date: toIsoDateTimeStart(invoiceDate.value),
    supply_date: toIsoDateTimeStart(supplyDate.value),
    // status: filterStatus.value === 'all' ? undefined : filterStatus.value,
  }
  await transportInvoicesStore.loadList(params)
  selectedIds.value = new Set()
}

const resetFilters = async () => {
  search.value = ''
  // filterStatus.value = 'all'
  invoiceDate.value = ''
  supplyDate.value = ''
  await loadRows(1)
}

const requestDelete = (row: TransportInvoiceListItem) => {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await invoicesStore.deleteInvoice(deleteTarget.value.id)
    toast.success(t('transport_invoices_page.delete_success'))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('transport_invoices_page.delete_error'))
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
    await Promise.all(ids.map(id => invoicesStore.deleteInvoice(id)))
    toast.success(t('common.bulk_deleted_success', { count: ids.length }))
    selectedIds.value = new Set()
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('transport_invoices_page.delete_error'))
  }
  finally {
    bulkDeleteLoading.value = false
  }
}

const syncShipmentStatus = async () => {
  shipmentSyncLoading.value = true
  try {
    await $api('/invoices/sync-shipment-status', { method: 'POST' })
    toast.success(t('transport_invoices_page.shipment_sync_success'))
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('transport_invoices_page.shipment_sync_error'))
  }
  finally {
    shipmentSyncLoading.value = false
  }
}

const extractCreatedInvoiceId = (response: unknown): number | null => {
  if (!response || typeof response !== 'object') return null
  const root = response as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const invoice = (nested?.invoice ?? root.invoice ?? null) as Record<string, unknown> | null
  const id = Number(invoice?.id ?? 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

const cloneInvoice = async (row: TransportInvoiceListItem) => {
  if (!canCreateInvoice.value) return
  copyingId.value = row.id
  try {
    const source = await invoicesStore.loadById(row.id)
    if (!source) {
      toast.error(t('transport_invoices_page.copy_error'))
      return
    }
    invoicesStore.hydrateDraftFromInvoice(source)
    const today = new Date().toISOString().slice(0, 10)
    invoicesStore.draft.id = null
    invoicesStore.draft.reference_number = ''
    invoicesStore.draft.invoice_date = today
    invoicesStore.draft.supply_date = today

    const created = await invoicesStore.createInvoice()
    const createdId = extractCreatedInvoiceId(created)
    if (!createdId) {
      toast.error(t('transport_invoices_page.copy_error'))
      return
    }
    toast.success(t('transport_invoices_page.copy_success'))
    await loadRows(1)
    await navigateTo(`/transport-invoices/edit/${createdId}`)
  }
  catch {
    toast.error(t('transport_invoices_page.copy_error'))
  }
  finally {
    copyingId.value = null
  }
}

// watch(
//   [search, filterStatus, invoiceDate, supplyDate],
//   () => {
//     if (debounceTimer) clearTimeout(debounceTimer)
//     debounceTimer = setTimeout(() => loadRows(1), 300)
//   },
//   { deep: true },
// )

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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('transport_invoices_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('transport_invoices_page.subtitle_total', { count: pagination.total ?? sortedList.length }) }}</p>
      </div>
    </div>

    <div v-if="!canViewInvoices" class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">{{ t('transport_invoices_page.no_permission') }}</div>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:flex-1">
          <div class="relative w-full sm:min-w-[200px] sm:max-w-sm">
            <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" :placeholder="t('transport_invoices_page.list_search_placeholder')" class="h-9 pr-9 w-full" />
            <Loader2 v-if="loading && search.trim()" class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          </div>
          <!-- <Select v-model="filterStatus">
            <SelectTrigger class="h-9 w-full sm:w-[220px] gap-2"><Filter class="size-3.5 shrink-0 text-muted-foreground" /><SelectValue :placeholder="t('transport_invoices_page.filter_status')" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('transport_invoices_page.filter_status_all') }}</SelectItem>
              <SelectItem value="pending">{{ t('transport_invoices_page.status_pending') }}</SelectItem>
              <SelectItem value="in_delivery">{{ t('transport_invoices_page.status_in_delivery') }}</SelectItem>
              <SelectItem value="complete">{{ t('transport_invoices_page.status_complete') }}</SelectItem>
            </SelectContent>
          </Select> -->
          <!-- <Button v-if="hasActiveFilters" variant="ghost" size="sm" class="h-9 gap-1.5 text-muted-foreground w-full sm:w-auto" :disabled="loading" @click="resetFilters"><X class="size-3.5" />{{ t('transport_invoices_page.reset_filters') }}</Button> -->
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Button
            class="h-9 gap-2 w-full sm:w-auto"
            variant="outline"
            :disabled="shipmentSyncLoading || loading"
            @click="syncShipmentStatus"
          >
            <Loader2 v-if="shipmentSyncLoading" class="size-4 animate-spin" />
            <RotateCcw v-else class="size-4" />
            <span class="hidden sm:inline">{{ t('transport_invoices_page.shipment_status_sync') }}</span>
            <span class="sm:hidden">{{ t('transport_invoices_page.sync_status') }}</span>
          </Button>
          <Button v-if="canCreateInvoice" class="h-9 gap-2 bg-primary hover:bg-primary/90 text-white w-full sm:w-auto" as-child>
            <NuxtLink to="/transport-invoices/create"><Plus class="size-4" />{{ t('transport_invoices_page.new_invoice') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-4 rounded-lg border bg-card/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">{{ t('transport_invoices_page.invoice_date') }}</span>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">{{ t('transport_invoices_page.invoice_date') }}</label>
            <DatePickerInput v-model="invoiceDate" class="w-full" />
          </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">{{ t('transport_invoices_page.supply_date') }}</span>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">{{ t('transport_invoices_page.supply_date') }}</label>
            <DatePickerInput v-model="supplyDate" class="w-full" />
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
          <TableHeader class="hidden md:table-header-group">
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="w-10 text-center">
                <Checkbox
                  :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                  class="mt-0.5 mx-4"
                  @update:model-value="toggleSelectAll"
                />
              </TableHead>
              <TableHead class="text-start font-medium min-w-[120px]">{{ t('transport_invoices_page.col_ref_id') }}</TableHead>
              <TableHead class="text-start font-medium min-w-[140px]">{{ t('transport_invoices_page.col_customer') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_invoice_date') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_supply_date') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.warehouse') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_shipment_status') }}</TableHead>
              <TableHead class="rtl:text-start  text-end font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_discount_amount') }}</TableHead>
              <TableHead class="rtl:text-start ltr:text-start text-end font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_total') }}</TableHead>
              <TableHead class="rtl:text-start text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_return_id') }}</TableHead>
              <TableHead class="font-medium min-w-[220px] text-end">{{ t('transport_invoices_page.col_actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading" class="md:table-row"><TableCell :colspan="12" class="py-14 text-center"><div class="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 class="size-4 animate-spin" />{{ t('common.loading') }}…</div></TableCell></TableRow>
            <TableRow v-else-if="!sortedList.length" class="md:table-row"><TableCell :colspan="12" class="py-14 text-center text-sm text-muted-foreground">{{ t('transport_invoices_page.empty') }}</TableCell></TableRow>
            <TableRow v-for="row in sortedList" :key="row.id" class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none hover:bg-muted/30 transition-colors align-middle" :class="{ 'bg-muted/20': selectedIds.has(row.id) }">
              <TableCell class="flex items-center justify-between gap-2 py-1.5 border-b md:w-10 md:table-cell md:py-4 md:border-0">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.select') }}</span>
                <Checkbox :model-value="selectedIds.has(row.id)" class="md:mt-0.5 md:mx-4" @update:model-value="toggleSelect(row.id)" />
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_ref_id') }}</span>
                <NuxtLink
                  :to="`/transport-invoices/show/${row.id}`"
                  class="text-sm font-medium text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
                >
                  {{ row.reference_number || `#${row.id}` }}
                </NuxtLink>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_customer') }}</span>
                <div class="flex flex-col gap-0.5 text-end md:text-start">
                  <span class="text-sm text-muted-foreground">{{ row.customer_name || '—' }}</span>
                  <span class="text-xs text-muted-foreground/80">
                    {{ t('transport_invoices_page.district') }}: {{ row.district_name || t('transport_invoices_page.district_unassigned') }}
                  </span>
                </div>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_invoice_date') }}</span>
                <span class="text-sm tabular-nums rtl:text-start">{{ fmtDate(row.invoice_date) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_supply_date') }}</span>
                <span class="text-sm tabular-nums rtl:text-start">{{ fmtDate(row.supply_date) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.warehouse') }}</span>
                <span class="text-sm text-muted-foreground rtl:text-start">{{ warehouseLabel(row) }}</span>
              </TableCell>
              
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_shipment_status') }}</span>
                <span class="text-sm text-muted-foreground rtl:text-start">{{ row.shipment_status_label || '—' }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_discount_amount') }}</span>
                <span class="text-sm tabular-nums text-end md:rtl:text-start">{{ fmtMoney(row.total_discount) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_total') }}</span>
                <span class="text-sm tabular-nums text-end md:rtl:text-start">{{ fmtGrandTotal(row.grand_total) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_return_id') }}</span>
                <span class="text-sm rtl:text-start">{{ row.return_reference || row.return_reference_number || '—' }}</span>
              </TableCell>
              <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
                <TableRowActions
                  :actions="[
                    { key: `edit-${row.id}`, label: t('transport_invoices_page.action_edit'), type: 'link', to: `/transport-invoices/edit/${row.id}`, icon: Pencil, tone: 'default', visible: canEditInvoice && row.can_be_edited },
                    { key: `copy-${row.id}`, label: t('transport_invoices_page.action_copy'), type: 'button', icon: Copy, tone: 'default', visible: false, disabled: copyingId === row.id || loading, loading: copyingId === row.id, onClick: () => cloneInvoice(row) },
                    { key: `return-${row.id}`, label: t('transport_invoices_page.action_return'), type: 'button', icon: RotateCcw, tone: 'default', visible: canCreateInvoiceReturn && row.status !== 'returned', onClick: () => navigateTo(`/transport-invoices/return/${row.id}`) },
                    { key: `delete-${row.id}`, label: t('transport_invoices_page.action_delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteInvoice && row.can_be_deleted, onClick: () => requestDelete(row) },
                  ]"
                  variant="invoice"
                  align="end"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div v-if="pagination.last_page > 1" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('common.showing_range', { from: pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0, to: pagination.total ? Math.min(currentPage * pagination.per_page, pagination.total) : 0, total: pagination.total }) }}</p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loading"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        >
          <span class="text-sm text-muted-foreground px-2 tabular-nums">{{ t('common.page_of', { current: currentPage, total: pagination.last_page }) }}</span>
        </PaginationArrowButtons>
      </div>
    </template>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('transport_invoices_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('transport_invoices_page.delete_body') }}</AlertDialogDescription>
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
