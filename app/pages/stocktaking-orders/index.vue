<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search,
  Loader2,
  Filter,
  X,
  Play,
  Ban,
  Plus,
  ClipboardCheck,
  ClipboardList,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { StocktakingOrderListItem } from '@/stores/stocktakingOrders'
import { useStocktakingOrdersStore } from '@/stores/stocktakingOrders'
import { useInvoiceWarehouses, type InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const router = useRouter()
const { t, locale } = useI18n()
const { can, canCreate } = usePermissions()
const { getErrorMessage } = useApiError()
const stocktakingOrdersStore = useStocktakingOrdersStore()
const { loadActiveWarehouses } = useInvoiceWarehouses()

const canViewStocktaking = computed(() => can('stocktaking.view'))
const canCreateStocktaking = computed(() => canCreate('stocktaking'))
const canStartStocktaking = computed(() => can('stocktaking.count'))
const canCancelStocktaking = computed(() => can('stocktaking.cancel'))
const canReviewStocktaking = computed(() => can('stocktaking.review'))

const search = ref('')
const filterStatus = ref<'all' | 'scheduled' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled'>('all')
const filterType = ref<'all' | 'full' | 'partial'>('all')
const filterWarehouseId = ref<'all' | string>('all')
const dateFrom = ref('')
const dateTo = ref('')
const currentPage = ref(1)
const cancelTarget = ref<StocktakingOrderListItem | null>(null)
const cancelDialogOpen = ref(false)
const cancelling = ref(false)
const actionLoadingId = ref<number | null>(null)
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(
  () =>
    search.value.trim().length > 0
    || filterStatus.value !== 'all'
    || filterType.value !== 'all'
    || filterWarehouseId.value !== 'all'
    || Boolean(dateFrom.value)
    || Boolean(dateTo.value),
)

const list = computed(() => stocktakingOrdersStore.list)
const sortedList = computed(() => {
  return [...list.value].sort((a, b) => {
    const aTime = new Date(a.created_at || a.stocktaking_date).getTime()
    const bTime = new Date(b.created_at || b.stocktaking_date).getTime()
    return bTime - aTime
  })
})
const pagination = computed(() => stocktakingOrdersStore.pagination)
const loading = computed(() => stocktakingOrdersStore.listLoading)

const fmtDate = (value?: string) => formatDisplayDate(value)

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

const toIsoDateTimeEnd = (value: string): string | undefined => {
  const normalized = normalizePickerDate(value)
  if (!normalized) return undefined
  return `${normalized}T23:59:59.999Z`
}

const warehouseLabel = (row: StocktakingOrderListItem) => {
  const nameAr = row.warehouse_name_ar || ''
  const nameEn = row.warehouse_name_en || ''
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
}

const warehouseOptionLabel = (warehouse: InvoiceWarehouseOption) => {
  return locale.value === 'ar'
    ? (warehouse.name_ar || warehouse.name_en || `#${warehouse.id}`)
    : (warehouse.name_en || warehouse.name_ar || `#${warehouse.id}`)
}

const typeLabel = (row: StocktakingOrderListItem) => {
  if (row.type_label) return row.type_label
  if (row.type === 'full') return t('stocktaking_orders_page.type_full')
  if (row.type === 'partial') return t('stocktaking_orders_page.type_partial')
  return row.type || '—'
}

const statusLabel = (row: StocktakingOrderListItem) => {
  if (row.status_label) return row.status_label
  const key = `stocktaking_orders_page.status_${row.status}` as const
  const translated = t(key)
  return translated === key ? (row.status || '—') : translated
}

const statusBadgeClass = (row: StocktakingOrderListItem) => {
  switch (row.status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'in_progress': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'pending_review': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
    default: return ''
  }
}

const canStartRow = (row: StocktakingOrderListItem) =>
  row.status === 'scheduled' && canStartStocktaking.value

const canCountRow = (row: StocktakingOrderListItem) =>
  row.status === 'in_progress' && canStartStocktaking.value

const canReviewRow = (row: StocktakingOrderListItem) =>
  row.status === 'pending_review' && canReviewStocktaking.value

const canCancelRow = (row: StocktakingOrderListItem) =>
  (row.status === 'scheduled' || row.status === 'in_progress') && canCancelStocktaking.value

const loadRows = async (page = currentPage.value) => {
  if (!canViewStocktaking.value) return
  currentPage.value = page
  const query = search.value.trim()
  const params: Record<string, string | number | string[] | undefined> = {
    page,
    per_page: pagination.value.per_page || 15,
    search: query || undefined,
    type: filterType.value === 'all' ? undefined : filterType.value,
    warehouse_id: filterWarehouseId.value === 'all' ? undefined : Number(filterWarehouseId.value),
    date_from: toIsoDateTimeStart(dateFrom.value),
    date_to: toIsoDateTimeEnd(dateTo.value),
    'status[]': filterStatus.value === 'all' ? undefined : [filterStatus.value],
  }
  await stocktakingOrdersStore.loadList(params)
}

const resetFilters = async () => {
  search.value = ''
  filterStatus.value = 'all'
  filterType.value = 'all'
  filterWarehouseId.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
  await loadRows(1)
}

const startOrder = async (row: StocktakingOrderListItem) => {
  if (!canStartRow(row) || actionLoadingId.value) return
  actionLoadingId.value = row.id
  try {
    await stocktakingOrdersStore.startOrder(row.id)
    toast.success(t('stocktaking_orders_page.start_success'))
    await router.push(`/stocktaking-orders/count/${row.id}`)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_orders_page.start_error'))
  }
  finally {
    actionLoadingId.value = null
  }
}

const requestCancel = (row: StocktakingOrderListItem) => {
  cancelTarget.value = row
  cancelDialogOpen.value = true
}

const confirmCancel = async () => {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await stocktakingOrdersStore.cancelOrder(cancelTarget.value.id)
    toast.success(t('stocktaking_orders_page.cancel_success'))
    cancelDialogOpen.value = false
    cancelTarget.value = null
    await loadRows(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_orders_page.cancel_error'))
  }
  finally {
    cancelling.value = false
  }
}

watch(
  [search, filterStatus, filterType, filterWarehouseId, dateFrom, dateTo],
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => loadRows(1), 300)
  },
  { deep: true },
)

onMounted(async () => {
  if (canViewStocktaking.value) {
    warehouseOptions.value = await loadActiveWarehouses()
    await loadRows(1)
  }
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('stocktaking_orders_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('stocktaking_orders_page.subtitle_total', { count: pagination.total ?? sortedList.length }) }}
        </p>
      </div>
      <Button
        v-if="canCreateStocktaking"
        class="h-9 gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]"
        as-child
      >
        <NuxtLink to="/stocktaking-orders/create">
          <Plus class="size-4" />
          {{ t('stocktaking_orders_page.new_stocktaking_order') }}
        </NuxtLink>
      </Button>
    </div>

    <div v-if="!canViewStocktaking" class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">
      {{ t('stocktaking_orders_page.no_permission') }}
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2 flex-1">
          <div class="relative min-w-[200px] max-w-sm">
            <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="search"
              :placeholder="t('stocktaking_orders_page.list_search_placeholder')"
              class="h-9 pr-9"
            />
            <Loader2
              v-if="loading && search.trim()"
              class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          </div>
          <Select v-model="filterStatus">
            <SelectTrigger class="h-9 w-[220px] gap-2">
              <Filter class="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue :placeholder="t('stocktaking_orders_page.filter_status')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('stocktaking_orders_page.filter_status_all') }}</SelectItem>
              <SelectItem value="scheduled">{{ t('stocktaking_orders_page.status_scheduled') }}</SelectItem>
              <SelectItem value="in_progress">{{ t('stocktaking_orders_page.status_in_progress') }}</SelectItem>
              <SelectItem value="pending_review">{{ t('stocktaking_orders_page.status_pending_review') }}</SelectItem>
              <SelectItem value="completed">{{ t('stocktaking_orders_page.status_completed') }}</SelectItem>
              <SelectItem value="cancelled">{{ t('stocktaking_orders_page.status_cancelled') }}</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterType">
            <SelectTrigger class="h-9 w-[200px] gap-2">
              <Filter class="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue :placeholder="t('stocktaking_orders_page.filter_type')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('stocktaking_orders_page.filter_type_all') }}</SelectItem>
              <SelectItem value="full">{{ t('stocktaking_orders_page.type_full') }}</SelectItem>
              <SelectItem value="partial">{{ t('stocktaking_orders_page.type_partial') }}</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterWarehouseId">
            <SelectTrigger class="h-9 w-[220px] gap-2">
              <Filter class="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue :placeholder="t('stocktaking_orders_page.filter_warehouse')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('stocktaking_orders_page.filter_warehouse_all') }}</SelectItem>
              <SelectItem
                v-for="warehouse in warehouseOptions"
                :key="warehouse.id"
                :value="String(warehouse.id)"
              >
                {{ warehouseOptionLabel(warehouse) }}
              </SelectItem>
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
            {{ t('stocktaking_orders_page.reset_filters') }}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-4 rounded-lg border bg-card/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">{{ t('stocktaking_orders_page.date_range') }}</span>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">{{ t('stocktaking_orders_page.date_from') }}</label>
            <DatePickerInput v-model="dateFrom" class="w-full" />
          </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[240px]">
          <span class="text-sm font-medium text-foreground">&nbsp;</span>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">{{ t('stocktaking_orders_page.date_to') }}</label>
            <DatePickerInput v-model="dateTo" class="w-full" />
          </div>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="text-start font-medium min-w-[120px]">{{ t('stocktaking_orders_page.col_ref_id') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('stocktaking_orders_page.col_warehouse') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('stocktaking_orders_page.col_type') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('stocktaking_orders_page.col_date') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('stocktaking_orders_page.col_status') }}</TableHead>
              <TableHead class="font-medium min-w-[220px] text-end">{{ t('stocktaking_orders_page.col_actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell :colspan="6" class="py-14 text-center">
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  {{ t('common.loading') }}…
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!sortedList.length">
              <TableCell :colspan="6" class="py-14 text-center text-sm text-muted-foreground">
                {{ t('stocktaking_orders_page.empty') }}
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in sortedList"
              :key="row.id"
              class="hover:bg-muted/30 transition-colors align-middle"
            >
              <TableCell class="text-sm font-medium">
                <NuxtLink
                  :to="`/stocktaking-orders/show/${row.id}`"
                  class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
                >
                  {{ row.reference_number || `#${row.id}` }}
                </NuxtLink>
              </TableCell>
              <TableCell class="rtl:text-start text-sm text-muted-foreground">{{ warehouseLabel(row) }}</TableCell>
              <TableCell class="rtl:text-start text-sm">{{ typeLabel(row) }}</TableCell>
              <TableCell class="rtl:text-start text-sm tabular-nums">{{ fmtDate(row.stocktaking_date) }}</TableCell>
              <TableCell><Badge variant="outline" :class="statusBadgeClass(row)">{{ statusLabel(row) }}</Badge></TableCell>
              <TableCell class="text-end">
                <TableRowActions
                  :actions="[
                    {
                      key: `start-${row.id}`,
                      label: t('stocktaking_orders_page.action_start'),
                      type: 'button',
                      icon: Play,
                      tone: 'success',
                      visible: canStartRow(row),
                      disabled: actionLoadingId === row.id,
                      loading: actionLoadingId === row.id,
                      onClick: () => startOrder(row),
                    },
                    {
                      key: `count-${row.id}`,
                      label: t('stocktaking_orders_page.action_count'),
                      type: 'link',
                      to: `/stocktaking-orders/count/${row.id}`,
                      icon: ClipboardCheck,
                      tone: 'default',
                      visible: canCountRow(row),
                    },
                    {
                      key: `review-${row.id}`,
                      label: t('stocktaking_orders_page.action_review'),
                      type: 'link',
                      to: `/stocktaking-orders/review/${row.id}`,
                      icon: ClipboardList,
                      tone: 'default',
                      visible: canReviewRow(row),
                    },
                    {
                      key: `cancel-${row.id}`,
                      label: t('stocktaking_orders_page.action_cancel'),
                      type: 'button',
                      icon: Ban,
                      tone: 'danger',
                      visible: canCancelRow(row),
                      disabled: cancelling,
                      onClick: () => requestCancel(row),
                    },
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
          {{ t('common.showing_range', {
            from: pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0,
            to: pagination.total ? Math.min(currentPage * pagination.per_page, pagination.total) : 0,
            total: pagination.total,
          }) }}
        </p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loading"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        >
          <span class="text-sm text-muted-foreground px-2 tabular-nums">
            {{ t('common.page_of', { current: currentPage, total: pagination.last_page }) }}
          </span>
        </PaginationArrowButtons>
      </div>
    </template>

    <AlertDialog :open="cancelDialogOpen" @update:open="cancelDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('stocktaking_orders_page.cancel_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('stocktaking_orders_page.cancel_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="cancelling">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-red-600 text-white hover:bg-red-700"
            :disabled="cancelling"
            @click="confirmCancel"
          >
            <Loader2 v-if="cancelling" class="me-2 size-4 animate-spin" />
            {{ t('stocktaking_orders_page.action_cancel') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
