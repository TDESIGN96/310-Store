<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Copy,
  RotateCcw,
  Trash2,
  Loader2,
  Filter,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { InvoiceListItem } from '@/stores/invoices'
import { useInvoicesStore } from '@/stores/invoices'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { canAccess, canCreate, canEdit, canDelete } = usePermissions()
const invoicesStore = useInvoicesStore()

const canViewInvoices = computed(() => canAccess('invoices'))
const canCreateInvoice = computed(() => canCreate('invoices'))
const canEditInvoice = computed(() => canEdit('invoices'))
const canDeleteInvoice = computed(() => canDelete('invoices'))

const search = ref('')
const filterStatus = ref<'all' | 'issued' | 'paid' | 'partially_returned' | 'returned'>('all')
const invoiceDateFrom = ref('')
const invoiceDateTo = ref('')
const currentPage = ref(1)
const deleteTarget = ref<InvoiceListItem | null>(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const copyingId = ref<number | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(
  () => search.value.trim().length > 0 || filterStatus.value !== 'all' || Boolean(invoiceDateFrom.value) || Boolean(invoiceDateTo.value),
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
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
const fmtMoney = (value?: number) => Number(value ?? 0).toFixed(2)
const warehouseLabel = (row: InvoiceListItem) => {
  const nameAr = row.warehouse_name_ar || ''
  const nameEn = row.warehouse_name_en || ''
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
}

const statusLabel = (status: string) => {
  if (status === 'issued') return t('invoices_page.status_issued')
  if (status === 'paid') return t('invoices_page.status_paid')
  if (status === 'partially_returned') return t('invoices_page.status_partially_returned')
  if (status === 'returned') return t('invoices_page.status_returned')
  return status || '—'
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
    invoice_date_from: invoiceDateFrom.value || undefined,
    invoice_date_to: invoiceDateTo.value || undefined,
    status: filterStatus.value === 'all' ? undefined : filterStatus.value,
  }
  await invoicesStore.loadList(params)
}

const resetFilters = async () => {
  search.value = ''
  filterStatus.value = 'all'
  invoiceDateFrom.value = ''
  invoiceDateTo.value = ''
  await loadRows(1)
}

const requestDelete = (row: InvoiceListItem) => {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await invoicesStore.deleteInvoice(deleteTarget.value.id)
    toast.success(t('invoices_page.delete_success'))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('invoices_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

const showReturnStub = () => {
  toast.info(t('invoices_page.return_unavailable'))
}

const extractCreatedInvoiceId = (response: unknown): number | null => {
  if (!response || typeof response !== 'object') return null
  const root = response as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const invoice = (nested?.invoice ?? root.invoice ?? null) as Record<string, unknown> | null
  const id = Number(invoice?.id ?? 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

const cloneInvoice = async (row: InvoiceListItem) => {
  if (!canCreateInvoice.value) return
  copyingId.value = row.id
  try {
    const source = await invoicesStore.loadById(row.id)
    if (!source) {
      toast.error(t('invoices_page.copy_error'))
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
      toast.error(t('invoices_page.copy_error'))
      return
    }
    toast.success(t('invoices_page.copy_success'))
    await loadRows(1)
    await navigateTo(`/invoices/edit/${createdId}`)
  }
  catch {
    toast.error(t('invoices_page.copy_error'))
  }
  finally {
    copyingId.value = null
  }
}

watch(
  [search, filterStatus, invoiceDateFrom, invoiceDateTo],
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('invoices_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('invoices_page.subtitle_total', { count: pagination.total ?? sortedList.length }) }}</p>
      </div>
    </div>

    <div v-if="!canViewInvoices" class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">{{ t('invoices_page.no_permission') }}</div>

    <template v-else>
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2 flex-1">
          <div class="relative min-w-[200px] max-w-sm">
            <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" :placeholder="t('invoices_page.list_search_placeholder')" class="h-9 pr-9" />
            <Loader2 v-if="loading && search.trim()" class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          </div>
          <Select v-model="filterStatus">
            <SelectTrigger class="h-9 w-[220px] gap-2"><Filter class="size-3.5 shrink-0 text-muted-foreground" /><SelectValue :placeholder="t('invoices_page.filter_status')" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('invoices_page.filter_status_all') }}</SelectItem>
              <SelectItem value="issued">{{ t('invoices_page.status_issued') }}</SelectItem>
              <SelectItem value="paid">{{ t('invoices_page.status_paid') }}</SelectItem>
              <SelectItem value="partially_returned">{{ t('invoices_page.status_partially_returned') }}</SelectItem>
              <SelectItem value="returned">{{ t('invoices_page.status_returned') }}</SelectItem>
            </SelectContent>
          </Select>
          <Button v-if="hasActiveFilters" variant="ghost" size="sm" class="h-9 gap-1.5 text-muted-foreground" :disabled="loading" @click="resetFilters"><X class="size-3.5" />{{ t('invoices_page.reset_filters') }}</Button>
        </div>
        <Button v-if="canCreateInvoice" class="h-9 gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030] shrink-0" as-child>
          <NuxtLink to="/invoices/create"><Plus class="size-4" />{{ t('invoices_page.new_invoice') }}</NuxtLink>
        </Button>
      </div>

      <div class="flex flex-col gap-4 rounded-lg border bg-card/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">{{ t('invoices_page.invoice_date') }}</span>
          <div class="grid gap-2 sm:grid-cols-2">
            <div class="space-y-1"><label class="text-xs text-muted-foreground">{{ t('invoices_page.issue_date_from') }}</label><Input v-model="invoiceDateFrom" type="date" class="h-9 w-full" /></div>
            <div class="space-y-1"><label class="text-xs text-muted-foreground">{{ t('invoices_page.issue_date_to') }}</label><Input v-model="invoiceDateTo" type="date" class="h-9 w-full" /></div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="font-medium min-w-[120px]">{{ t('invoices_page.col_ref_id') }}</TableHead>
              <TableHead class="font-medium min-w-[140px]">{{ t('invoices_page.col_customer') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap">{{ t('invoices_page.col_invoice_date') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap">{{ t('invoices_page.col_supply_date') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap">{{ t('invoices_page.warehouse') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap">{{ t('invoices_page.col_status') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap text-end">{{ t('invoices_page.col_discount_amount') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap text-end">{{ t('invoices_page.col_total') }}</TableHead>
              <TableHead class="font-medium whitespace-nowrap">{{ t('invoices_page.col_return_id') }}</TableHead>
              <TableHead class="font-medium min-w-[220px] text-end">{{ t('invoices_page.col_actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading"><TableCell :colspan="10" class="py-14 text-center"><div class="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 class="size-4 animate-spin" />{{ t('common.loading') }}…</div></TableCell></TableRow>
            <TableRow v-else-if="!sortedList.length"><TableCell :colspan="10" class="py-14 text-center text-sm text-muted-foreground">{{ t('invoices_page.empty') }}</TableCell></TableRow>
            <TableRow v-for="row in sortedList" :key="row.id" class="hover:bg-muted/30 transition-colors align-middle">
              <TableCell class="text-sm font-medium">{{ row.reference_number || `#${row.id}` }}</TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ row.customer_name || '—' }}</TableCell>
              <TableCell class="text-sm tabular-nums">{{ fmtDate(row.invoice_date) }}</TableCell>
              <TableCell class="text-sm tabular-nums">{{ fmtDate(row.supply_date) }}</TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ warehouseLabel(row) }}</TableCell>
              <TableCell><Badge variant="outline">{{ statusLabel(row.status) }}</Badge></TableCell>
              <TableCell class="text-end text-sm tabular-nums">{{ fmtMoney(row.total_discount) }}</TableCell>
              <TableCell class="text-end text-sm tabular-nums">{{ fmtMoney(row.grand_total) }}</TableCell>
              <TableCell class="text-sm">{{ row.return_reference_number || '—' }}</TableCell>
              <TableCell class="text-right">
                <div class="flex flex-wrap items-center gap-1 justify-end">
                  <Button variant="outline" size="sm" class="h-8 gap-1 px-2" as-child><NuxtLink :to="`/invoices/show/${row.id}`"><Eye class="size-3.5" />{{ t('common.view') }}</NuxtLink></Button>
                  <Button variant="outline" size="sm" class="h-8 gap-1 px-2" :disabled="!canEditInvoice" as-child><NuxtLink :to="`/invoices/edit/${row.id}`"><Pencil class="size-3.5" />{{ t('invoices_page.action_edit') }}</NuxtLink></Button>
                  <Button v-if="canCreateInvoice" variant="outline" size="sm" class="h-8 gap-1 px-2" :disabled="copyingId === row.id || loading" @click="cloneInvoice(row)"><Loader2 v-if="copyingId === row.id" class="size-3.5 animate-spin" /><Copy v-else class="size-3.5" />{{ t('invoices_page.action_copy') }}</Button>
                  <Button variant="outline" size="sm" class="h-8 gap-1 px-2" @click="showReturnStub"><RotateCcw class="size-3.5" />{{ t('invoices_page.action_return') }}</Button>
                  <Button variant="outline" size="sm" class="h-8 gap-1 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30" :disabled="!canDeleteInvoice" @click="requestDelete(row)"><Trash2 class="size-3.5" />{{ t('invoices_page.action_delete') }}</Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div v-if="pagination.last_page > 1" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('common.showing_range', { from: pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0, to: pagination.total ? Math.min(currentPage * pagination.per_page, pagination.total) : 0, total: pagination.total }) }}</p>
        <div class="flex items-center gap-1">
          <Button variant="outline" size="icon" class="size-8" :disabled="currentPage <= 1 || loading" @click="goToPage(currentPage - 1)"><ChevronRight class="size-4" /></Button>
          <span class="text-sm text-muted-foreground px-2 tabular-nums">{{ t('common.page_of', { current: currentPage, total: pagination.last_page }) }}</span>
          <Button variant="outline" size="icon" class="size-8" :disabled="currentPage >= pagination.last_page || loading" @click="goToPage(currentPage + 1)"><ChevronLeft class="size-4" /></Button>
        </div>
      </div>
    </template>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('invoices_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('invoices_page.delete_body') }}</AlertDialogDescription>
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
  </div>
</template>
