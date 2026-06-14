<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ClipboardList,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  X,
  XCircle,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { DatePickerInput } from '@/components/ui/date-picker'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import { useDamageRecordsStore, type DamageReason } from '@/stores/damageRecords'
import { useInvoiceWarehouses, type InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { can, canCreate } = usePermissions()
const { getErrorMessage } = useApiError()
const router = useRouter()
const damageStore = useDamageRecordsStore()
const { loadActiveWarehouses } = useInvoiceWarehouses()

const canView = computed(() => can('damage.view'))
const canCreateDamage = computed(() => canCreate('damage'))
const canEditDamage = computed(() => can('damage.edit'))
const canApproveDamage = computed(() => can('damage.approve'))
const canDisposition = computed(() => can('damage.disposition'))

// ─── Approve dialog (index) ───────────────────────────────────────────────────
const indexApproveOpen = ref(false)
const indexApproveRowId = ref<string>('')
const indexApproveSubmitting = ref(false)
const indexApproveError = ref('')

// ─── Reject dialog (index) ────────────────────────────────────────────────────
const indexRejectOpen = ref(false)
const indexRejectRowId = ref<string>('')
const indexRejectSubmitting = ref(false)
const indexRejectReason = ref('')
const indexRejectError = ref('')

const openIndexApprove = (rowId: string) => {
  indexApproveRowId.value = rowId
  indexApproveError.value = ''
  indexApproveOpen.value = true
}

const confirmIndexApprove = async () => {
  indexApproveSubmitting.value = true
  indexApproveError.value = ''
  try {
    await damageStore.approveRecord(indexApproveRowId.value)
    indexApproveOpen.value = false
    toast.success(t('damage_records_page.approve_success'))
    await loadRows()
  }
  catch (err) {
    indexApproveError.value = getErrorMessage(err)
  }
  finally {
    indexApproveSubmitting.value = false
  }
}

const openIndexReject = (rowId: string) => {
  indexRejectRowId.value = rowId
  indexRejectReason.value = ''
  indexRejectError.value = ''
  indexRejectOpen.value = true
}

const confirmIndexReject = async () => {
  indexRejectError.value = ''
  const reason = indexRejectReason.value.trim()
  if (!reason) {
    indexRejectError.value = t('damage_records_page.reject_reason_required')
    return
  }
  if (reason.length > 250) {
    indexRejectError.value = t('damage_records_page.reject_reason_max')
    return
  }
  indexRejectSubmitting.value = true
  try {
    await damageStore.rejectRecord(indexRejectRowId.value, reason)
    indexRejectOpen.value = false
    toast.success(t('damage_records_page.reject_success'))
    await loadRows()
  }
  catch (err) {
    indexRejectError.value = getErrorMessage(err)
  }
  finally {
    indexRejectSubmitting.value = false
  }
}

type SortBy = 'reference_id' | 'created_at' | 'damaged_quantity' | 'estimated_loss' | 'status'
type SortDir = 'asc' | 'desc'

const DAMAGE_REASONS: { value: DamageReason; labelKey: string }[] = [
  { value: 'manufacturing_defect', labelKey: 'damage_records_page.reason_manufacturing_defect' },
  { value: 'storage_damage', labelKey: 'damage_records_page.reason_storage_damage' },
  { value: 'transport_damage', labelKey: 'damage_records_page.reason_transport_damage' },
  { value: 'expired_material', labelKey: 'damage_records_page.reason_expired_material' },
  { value: 'customer_return_damaged', labelKey: 'damage_records_page.reason_customer_return_damaged' },
  { value: 'other', labelKey: 'damage_records_page.reason_other' },
]

const ALL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled']

// ─── Filter state ─────────────────────────────────────────────────────────────
const search = ref('')
const filterStatuses = ref<string[]>([])
const filterWarehouseId = ref<'all' | string>('all')
const filterReason = ref<DamageReason | ''>('')
const dateFrom = ref('')
const dateTo = ref('')
const dateRangeError = ref('')

// ─── Sort state ───────────────────────────────────────────────────────────────
const sortBy = ref<SortBy>('created_at')
const sortDir = ref<SortDir>('desc')

// ─── Pagination ───────────────────────────────────────────────────────────────
const currentPage = ref(1)

// ─── Warehouses ───────────────────────────────────────────────────────────────
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ─── Store bindings ───────────────────────────────────────────────────────────
const list = computed(() => damageStore.list)
const pagination = computed(() => damageStore.pagination)
const loading = computed(() => damageStore.listLoading)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMoney = (value?: number) => Number(value ?? 0).toFixed(2)

const warehouseOptionLabel = (warehouse: InvoiceWarehouseOption) =>
  locale.value === 'ar'
    ? (warehouse.name_ar || warehouse.name_en || `#${warehouse.id}`)
    : (warehouse.name_en || warehouse.name_ar || `#${warehouse.id}`)

const reasonLabel = (slug: string) => {
  const match = DAMAGE_REASONS.find(r => r.value === slug)
  if (match) return t(match.labelKey)
  return slug || '—'
}

const statusLabel = (status: string) => {
  const key = `damage_records_page.status_${status}` as Parameters<typeof t>[0]
  const translated = t(key)
  return translated === key ? status : translated
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
    case 'cancelled': return 'bg-slate-100 text-slate-700 border-slate-200'
    default: return ''
  }
}

// ─── Active filters check ─────────────────────────────────────────────────────
const hasActiveFilters = computed(() =>
  search.value.trim().length > 0
  || filterStatuses.value.length > 0
  || filterWarehouseId.value !== 'all'
  || Boolean(filterReason.value)
  || Boolean(dateFrom.value)
  || Boolean(dateTo.value),
)

// ─── Date helpers ─────────────────────────────────────────────────────────────
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
  return raw
}

const toIsoDateTimeStart = (value: string): string | undefined => {
  const normalized = normalizePickerDate(value)
  return normalized ? `${normalized}T00:00:00.000Z` : undefined
}

const toIsoDateTimeEnd = (value: string): string | undefined => {
  const normalized = normalizePickerDate(value)
  return normalized ? `${normalized}T23:59:59.999Z` : undefined
}

// ─── loadRows ─────────────────────────────────────────────────────────────────
const loadRows = async (page = currentPage.value) => {
  if (!canView.value) return

  // Validate date range
  if (dateFrom.value && dateTo.value) {
    const from = normalizePickerDate(dateFrom.value)
    const to = normalizePickerDate(dateTo.value)
    if (from && to && from > to) {
      dateRangeError.value = t('damage_records_page.filter_date_range_error')
      return
    }
  }
  dateRangeError.value = ''
  currentPage.value = page

  const params: Record<string, string | number | string[] | undefined> = {
    page,
    per_page: pagination.value.per_page || 15,
    sort_by: sortBy.value,
    sort_dir: sortDir.value,
    search: search.value.trim() || undefined,
    warehouse_id: filterWarehouseId.value !== 'all' ? Number(filterWarehouseId.value) : undefined,
    damage_reason: filterReason.value || undefined,
    date_from: toIsoDateTimeStart(dateFrom.value),
    date_to: toIsoDateTimeEnd(dateTo.value),
    'status[]': filterStatuses.value.length ? filterStatuses.value : undefined,
  }

  try {
    await damageStore.loadList(params)
  }
  catch (err) {
    console.error(getErrorMessage(err))
  }
}

// ─── Sort toggle ──────────────────────────────────────────────────────────────
const toggleSort = (column: SortBy) => {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortBy.value = column
    sortDir.value = 'desc'
  }
  loadRows(1)
}

const sortIcon = (column: SortBy) => {
  if (sortBy.value !== column) return ArrowUpDown
  return sortDir.value === 'asc' ? ArrowUp : ArrowDown
}

// ─── Status multi-select toggle ───────────────────────────────────────────────
const toggleStatus = (status: string) => {
  const idx = filterStatuses.value.indexOf(status)
  if (idx === -1) filterStatuses.value.push(status)
  else filterStatuses.value.splice(idx, 1)
}

const selectedStatusesLabel = computed(() => {
  if (!filterStatuses.value.length) return t('damage_records_page.filter_status')
  if (filterStatuses.value.length === 1) return statusLabel(filterStatuses.value[0]!)
  return `${t('damage_records_page.filter_status')} (${filterStatuses.value.length})`
})

// ─── Reset ─────────────────────────────────────────────────────────────────────
const resetFilters = async () => {
  search.value = ''
  filterStatuses.value = []
  filterWarehouseId.value = 'all'
  filterReason.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  dateRangeError.value = ''
  await loadRows(1)
}

const goToPage = (page: number) => loadRows(page)

// ─── Watch search with debounce ───────────────────────────────────────────────
watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadRows(1), 300)
})

watch([filterWarehouseId, filterReason, filterStatuses], () => {
  loadRows(1)
}, { deep: true })

watch([dateFrom, dateTo], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadRows(1), 500)
})

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  warehouseOptions.value = await loadActiveWarehouses()
  await loadRows(1)
})
</script>

<template>
  <div class="p-6 space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <AlertTriangle class="w-5 h-5 text-muted-foreground" />
        <h1 class="text-2xl font-bold tracking-tight">
          {{ t('damage_records_page.title') }}
        </h1>
      </div>
      <Button
        v-if="canCreateDamage"
        as-child
      >
        <NuxtLink to="/damage-records/create">
          <Plus class="w-4 h-4 me-2" />
          {{ t('common.add_new') }}
        </NuxtLink>
      </Button>
    </div>

    <!-- No permission -->
    <div
      v-if="!canView"
      class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800"
    >
      {{ t('damage_records_page.no_permission') }}
    </div>

    <template v-else>
      <!-- Filter bar -->
      <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
        <!-- Search -->
        <div class="relative w-full sm:min-w-[200px] sm:max-w-xs">
          <Search class="pointer-events-none absolute top-1/2 start-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="search"
            class="h-9 ps-9"
            :placeholder="t('common.search')"
          />
          <Loader2
            v-if="loading && search.trim()"
            class="absolute top-1/2 end-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        </div>

        <!-- Status multi-select -->
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="h-9 gap-2 w-full sm:w-auto"
            >
              <Filter class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="truncate max-w-[140px] text-sm">{{ selectedStatusesLabel }}</span>
              <Badge
                v-if="filterStatuses.length"
                class="ms-1 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center"
              >
                {{ filterStatuses.length }}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-48 p-1">
            <div
              v-for="status in ALL_STATUSES"
              :key="status"
              class="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
              @click="toggleStatus(status)"
            >
              <Checkbox
                :model-value="filterStatuses.includes(status)"
                class="pointer-events-none"
              />
              <span class="text-sm">{{ statusLabel(status) }}</span>
            </div>
          </PopoverContent>
        </Popover>

        <!-- Warehouse -->
        <Select v-model="filterWarehouseId">
          <SelectTrigger class="h-9 w-full sm:w-[200px] gap-2">
            <Filter class="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue :placeholder="t('damage_records_page.filter_warehouse')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {{ t('common.all') }}
            </SelectItem>
            <SelectItem
              v-for="warehouse in warehouseOptions"
              :key="warehouse.id"
              :value="String(warehouse.id)"
            >
              {{ warehouseOptionLabel(warehouse) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Damage Reason -->
        <Select
          :model-value="filterReason"
          @update:model-value="(val) => { filterReason = (val === 'all' ? '' : val) as DamageReason | '' }"
        >
          <SelectTrigger class="h-9 w-full sm:w-[200px] gap-2">
            <Filter class="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue :placeholder="t('damage_records_page.filter_reason')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {{ t('common.all') }}
            </SelectItem>
            <SelectItem
              v-for="reason in DAMAGE_REASONS"
              :key="reason.value"
              :value="reason.value"
            >
              {{ t(reason.labelKey) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Clear filters -->
        <Button
          v-if="hasActiveFilters"
          variant="ghost"
          size="sm"
          class="w-full sm:w-auto h-9 gap-1.5 text-muted-foreground"
          :disabled="loading"
          @click="resetFilters"
        >
          <X class="size-3.5" />
          {{ t('damage_records_page.clear_filters') }}
        </Button>
      </div>

      <!-- Date range -->
      <div class="flex flex-col sm:flex-row gap-3 rounded-lg border bg-card/30 p-4 sm:items-end">
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs text-muted-foreground">{{ t('damage_records_page.filter_date_from') }}</label>
          <DatePickerInput
            v-model="dateFrom"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-xs text-muted-foreground">{{ t('damage_records_page.filter_date_to') }}</label>
          <DatePickerInput
            v-model="dateTo"
            class="w-full"
          />
        </div>
        <p
          v-if="dateRangeError"
          class="text-xs text-destructive sm:self-center"
        >
          {{ dateRangeError }}
        </p>
      </div>

      <!-- Table -->
      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader class="hidden md:table-header-group">
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <!-- Record ID -->
              <TableHead
                class="text-start font-medium min-w-[120px] cursor-pointer select-none whitespace-nowrap"
                @click="toggleSort('reference_id')"
              >
                <span class="inline-flex items-center gap-1">
                  {{ t('damage_records_page.col_reference_id') }}
                  <component
                    :is="sortIcon('reference_id')"
                    class="size-3.5 text-muted-foreground"
                  />
                </span>
              </TableHead>
              <!-- Product -->
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('damage_records_page.col_product') }}
              </TableHead>
              <!-- SKU -->
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('damage_records_page.col_sku') }}
              </TableHead>
              <!-- Warehouse -->
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('damage_records_page.col_warehouse') }}
              </TableHead>
              <!-- Quantity -->
              <TableHead
                class="text-start font-medium whitespace-nowrap cursor-pointer select-none"
                @click="toggleSort('damaged_quantity')"
              >
                <span class="inline-flex items-center gap-1">
                  {{ t('damage_records_page.col_quantity') }}
                  <component
                    :is="sortIcon('damaged_quantity')"
                    class="size-3.5 text-muted-foreground"
                  />
                </span>
              </TableHead>
              <!-- Reason -->
              <TableHead class="text-start font-medium whitespace-nowrap">
                {{ t('damage_records_page.col_reason') }}
              </TableHead>
              <!-- Estimated Loss -->
              <TableHead
                class="text-start font-medium whitespace-nowrap cursor-pointer select-none"
                @click="toggleSort('estimated_loss')"
              >
                <span class="inline-flex items-center gap-1">
                  {{ t('damage_records_page.col_estimated_loss') }}
                  <component
                    :is="sortIcon('estimated_loss')"
                    class="size-3.5 text-muted-foreground"
                  />
                </span>
              </TableHead>
              <!-- Status -->
              <TableHead
                class="text-start font-medium whitespace-nowrap cursor-pointer select-none"
                @click="toggleSort('status')"
              >
                <span class="inline-flex items-center gap-1">
                  {{ t('damage_records_page.col_status') }}
                  <component
                    :is="sortIcon('status')"
                    class="size-3.5 text-muted-foreground"
                  />
                </span>
              </TableHead>
              <!-- Created Date -->
              <TableHead
                class="text-start font-medium whitespace-nowrap cursor-pointer select-none"
                @click="toggleSort('created_at')"
              >
                <span class="inline-flex items-center gap-1">
                  {{ t('damage_records_page.col_created_at') }}
                  <component
                    :is="sortIcon('created_at')"
                    class="size-3.5 text-muted-foreground"
                  />
                </span>
              </TableHead>
              <!-- Actions -->
              <TableHead class="w-28" />
            </TableRow>
          </TableHeader>

          <TableBody>
            <!-- Loading -->
            <TableRow v-if="loading">
              <TableCell
                colspan="10"
                class="py-14 text-center"
              >
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  {{ t('common.loading') }}…
                </div>
              </TableCell>
            </TableRow>

            <!-- Empty state -->
            <TableRow v-else-if="!list.length">
              <TableCell
                colspan="10"
                class="py-14 text-center text-sm text-muted-foreground"
              >
                {{ hasActiveFilters ? t('damage_records_page.no_records_filtered') : t('damage_records_page.no_records') }}
              </TableCell>
            </TableRow>

            <!-- Data rows -->
            <TableRow
              v-for="row in list"
              :key="row.id"
              class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm
                     md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none
                     hover:bg-muted/30 transition-colors cursor-pointer align-middle"
              @click="router.push(`/damage-records/show/${row.id}`)"
            >
              <!-- Record ID -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_reference_id') }}
                </span>
                <span class="text-sm font-medium text-primary">{{ row.reference_id || `#${row.id}` }}</span>
              </TableCell>

              <!-- Product -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_product') }}
                </span>
                <div class="text-end md:text-start">
                  <p class="text-sm">
                    {{ row.product_name || '—' }}
                  </p>
                  <p
                    v-if="row.variation_name"
                    class="text-xs text-muted-foreground"
                  >
                    {{ row.variation_name }}
                  </p>
                </div>
              </TableCell>

              <!-- SKU -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_sku') }}
                </span>
                <span class="text-sm font-mono text-muted-foreground">{{ row.sku || '—' }}</span>
              </TableCell>

              <!-- Warehouse -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_warehouse') }}
                </span>
                <span class="text-sm text-muted-foreground">{{ row.warehouse_name || '—' }}</span>
              </TableCell>

              <!-- Quantity -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_quantity') }}
                </span>
                <span class="text-sm tabular-nums">{{ row.damaged_quantity }}</span>
              </TableCell>

              <!-- Reason -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_reason') }}
                </span>
                <span class="text-sm text-muted-foreground">{{ row.damage_reason_label || reasonLabel(row.damage_reason) }}</span>
              </TableCell>

              <!-- Estimated Loss -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_estimated_loss') }}
                </span>
                <span class="text-sm tabular-nums">{{ fmtMoney(row.estimated_loss) }}</span>
              </TableCell>

              <!-- Status -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_status') }}
                </span>
                <Badge
                  variant="outline"
                  :class="statusBadgeClass(row.status)"
                >
                  {{ row.status_label || statusLabel(row.status) }}
                </Badge>
              </TableCell>

              <!-- Created Date -->
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">
                  {{ t('damage_records_page.col_created_at') }}
                </span>
                <span class="text-sm tabular-nums text-muted-foreground">{{ formatDisplayDate(row.created_at) }}</span>
              </TableCell>

              <!-- Actions -->
              <TableCell
                class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end"
                @click.stop
              >
                <TableRowActions
                  :actions="[
                    { key: `edit-${row.id}`, label: t('damage_records_page.action_edit'), type: 'link', to: `/damage-records/edit/${row.id}`, icon: Pencil, tone: 'default', visible: canEditDamage && row.status === 'pending' },
                    { key: `approve-${row.id}`, label: t('damage_records_page.action_approve'), type: 'button', icon: Check, tone: 'success', visible: canApproveDamage && row.status === 'pending', onClick: () => openIndexApprove(row.id) },
                    { key: `reject-${row.id}`, label: t('damage_records_page.action_reject'), type: 'button', icon: XCircle, tone: 'danger', visible: canApproveDamage && row.status === 'pending', onClick: () => openIndexReject(row.id) },
                    { key: `disposition-${row.id}`, label: row.has_disposition ? t('damage_records_page.action_edit_disposition') : t('damage_records_page.action_record_disposition'), type: 'link', to: `/damage-records/disposition/${row.id}`, icon: ClipboardList, tone: 'default', visible: canDisposition && row.status === 'approved' },
                  ]"
                  variant="invoice"
                  align="end"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
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

    <!-- ─── Index Approve Dialog ─────────────────────────────────────────────── -->
    <AlertDialog :open="indexApproveOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('damage_records_page.approve_confirm_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('damage_records_page.approve_confirm_desc') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <div
          v-if="indexApproveError"
          class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {{ indexApproveError }}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="indexApproveSubmitting"
            @click="indexApproveOpen = false; indexApproveError = ''"
          >
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="indexApproveSubmitting"
            class="bg-emerald-600 hover:bg-emerald-700"
            @click.prevent="confirmIndexApprove"
          >
            <Loader2
              v-if="indexApproveSubmitting"
              class="mr-2 size-4 animate-spin"
            />
            {{ t('damage_records_page.action_approve') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ─── Index Reject Dialog ───────────────────────────────────────────────── -->
    <AlertDialog :open="indexRejectOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('damage_records_page.reject_dialog_title') }}</AlertDialogTitle>
        </AlertDialogHeader>
        <div class="space-y-2">
          <label class="text-sm font-medium">
            {{ t('damage_records_page.reject_reason_label') }}
            <span class="text-destructive ms-0.5">*</span>
          </label>
          <textarea
            v-model="indexRejectReason"
            rows="3"
            maxlength="250"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            :placeholder="t('damage_records_page.reject_reason_placeholder')"
            :class="{ 'border-destructive': indexRejectError }"
          />
          <p
            v-if="indexRejectError"
            class="text-xs text-destructive"
          >
            {{ indexRejectError }}
          </p>
          <p class="text-xs text-muted-foreground text-end">
            {{ indexRejectReason.length }} / 250
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="indexRejectSubmitting"
            @click="indexRejectOpen = false"
          >
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="indexRejectSubmitting"
            class="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            @click.prevent="confirmIndexReject"
          >
            <Loader2
              v-if="indexRejectSubmitting"
              class="mr-2 size-4 animate-spin"
            />
            {{ t('damage_records_page.action_reject') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
