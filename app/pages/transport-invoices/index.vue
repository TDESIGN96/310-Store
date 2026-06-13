<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search,
  RotateCcw,
  Loader2,
  Filter,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TransportInvoiceListItem } from '@/stores/transportInvoices'
import { useTransportInvoicesStore } from '@/stores/transportInvoices'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { canAccess } = usePermissions()
const { $api } = useApi()
const invoicesStore = useTransportInvoicesStore()

const canViewInvoices = computed(() => canAccess('invoices'))

const search = ref('')
const filterStatus = ref<'all' | 'pending' | 'in_delivery' | 'complete'>('all')
const invoiceDate = ref('')
const supplyDate = ref('')
const currentPage = ref(1)
const shipmentSyncLoading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(
  () => search.value.trim().length > 0 || filterStatus.value !== 'all' || Boolean(invoiceDate.value) || Boolean(supplyDate.value),
)

const list = computed(() => invoicesStore.list)
const sortedList = computed(() => {
  return [...list.value].sort((a, b) => {
    const aTime = new Date(a.invoice_date).getTime()
    const bTime = new Date(b.invoice_date).getTime()
    return bTime - aTime
  })
})
const pagination = computed(() => invoicesStore.pagination)
const loading = computed(() => invoicesStore.listLoading)

const fmtDate = (value?: string) => {
  return formatDisplayDate(value)
}
const normalizePickerDate = (value: string): string | undefined => {
  const raw = value.trim()
  if (!raw) return undefined
  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
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
const warehouseLabel = (row: TransportInvoiceListItem) => {
  const nameAr = row.warehouse_name_ar || ''
  const nameEn = row.warehouse_name_en || ''
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
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
    status: filterStatus.value === 'all' ? undefined : filterStatus.value,
  }
  await invoicesStore.loadList(params)
}

const resetFilters = async () => {
  search.value = ''
  filterStatus.value = 'all'
  invoiceDate.value = ''
  supplyDate.value = ''
  await loadRows(1)
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

watch(
  [search, filterStatus, invoiceDate, supplyDate],
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
          <Select v-model="filterStatus">
            <SelectTrigger class="h-9 w-full sm:w-[220px] gap-2"><Filter class="size-3.5 shrink-0 text-muted-foreground" /><SelectValue :placeholder="t('transport_invoices_page.filter_status')" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('transport_invoices_page.filter_status_all') }}</SelectItem>
              <SelectItem value="pending">{{ t('transport_invoices_page.status_pending') }}</SelectItem>
              <SelectItem value="in_delivery">{{ t('transport_invoices_page.status_in_delivery') }}</SelectItem>
              <SelectItem value="complete">{{ t('transport_invoices_page.status_complete') }}</SelectItem>
            </SelectContent>
          </Select>
          <Button v-if="hasActiveFilters" variant="ghost" size="sm" class="h-9 gap-1.5 text-muted-foreground w-full sm:w-auto" :disabled="loading" @click="resetFilters"><X class="size-3.5" />{{ t('transport_invoices_page.reset_filters') }}</Button>
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

      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader class="hidden md:table-header-group">
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="text-start font-medium min-w-[120px]">{{ t('transport_invoices_page.col_ref_id') }}</TableHead>
              <TableHead class="text-start font-medium min-w-[140px]">{{ t('transport_invoices_page.col_customer') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_invoice_date') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_supply_date') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.warehouse') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_shipment_status') }}</TableHead>
              <TableHead class="rtl:text-start text-end font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_discount_amount') }}</TableHead>
              <TableHead class="rtl:text-start text-end font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_total') }}</TableHead>
              <TableHead class="rtl:text-start text-start font-medium whitespace-nowrap">{{ t('transport_invoices_page.col_return_id') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading" class="md:table-row"><TableCell :colspan="9" class="py-14 text-center"><div class="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 class="size-4 animate-spin" />{{ t('common.loading') }}…</div></TableCell></TableRow>
            <TableRow v-else-if="!sortedList.length" class="md:table-row"><TableCell :colspan="9" class="py-14 text-center text-sm text-muted-foreground">{{ t('transport_invoices_page.empty') }}</TableCell></TableRow>
            <TableRow v-for="row in sortedList" :key="row.id" class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none hover:bg-muted/30 transition-colors align-middle">
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_ref_id') }}</span>
                <NuxtLink
                  :to="`/invoices/show/${row.id}`"
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
                <span class="text-sm tabular-nums text-end md:rtl:text-start">{{ fmtMoney(row.grand_total) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('transport_invoices_page.col_return_id') }}</span>
                <span class="text-sm rtl:text-start">{{ row.return_reference || row.return_reference_number || '—' }}</span>
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
  </div>
</template>
