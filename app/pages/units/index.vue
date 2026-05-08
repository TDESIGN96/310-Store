<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search, Plus, Pencil, Trash2, Loader2, ShieldAlert,
  LoaderCircle, Filter,
  Eye, Download, ArrowUp, ArrowDown, ArrowUpDown,
  UserX, UserCheck, X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t, tm, locale } = useI18n()
const { getErrorMessage } = useApiError()

// ── Types ──────────────────────────────────────────────────────────────────────

interface UnitAuthor {
  id: number
  name: string
  email?: string
}

interface UnitItem {
  id: number
  name_ar: string
  name_en: string
  symbol: string
  status: 'active' | 'inactive' | 'deleted' | string
  created_by?: UnitAuthor | number | null
  updated_by?: UnitAuthor | number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface UnitsPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface UnitsResponse {
  units?: UnitItem[]
  pagination?: UnitsPagination
  data?: {
    units?: UnitItem[]
    pagination?: UnitsPagination
  }
  status?: string
  status_code?: number
  message?: string | null
}

type SortField = 'name_ar' | 'name_en' | 'symbol' | 'created_at' | 'status'

// ── State ──────────────────────────────────────────────────────────────────────

const { $api } = useApi()

const { canCreate: cCreate, canEdit: cEdit, canDelete: cDelete, can } = usePermissions()
const canCreateUnit = computed(() => cCreate('units'))
const canEditUnit = computed(() => cEdit('units'))
const canDeleteUnit = computed(() => cDelete('units'))
const canShowUnit = computed(() => can('units.show'))

const units = ref<UnitItem[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('units_page')
const pagination = ref<UnitsPagination | null>(null)
const currentPage = ref(1)

// Search & Filters
const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Sorting
const sortBy = ref<SortField | ''>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

const toggleSortName = () => {
  const field: SortField = locale.value === 'ar' ? 'name_ar' : 'name_en'
  toggleSort(field)
}

const isNameSortActive = computed(
  () => sortBy.value === 'name_ar' || sortBy.value === 'name_en',
)

// Bulk selection
const selectedIds = ref<Set<number>>(new Set())

const isAllSelected = computed(
  () => units.value.length > 0 && units.value.every(u => selectedIds.value.has(u.id)),
)
const isIndeterminate = computed(
  () => units.value.some(u => selectedIds.value.has(u.id)) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)

const toggleSelectAll = () => {
  const s = new Set(selectedIds.value)
  if (isAllSelected.value) {
    units.value.forEach(u => s.delete(u.id))
  } else {
    units.value.forEach(u => s.add(u.id))
  }
  selectedIds.value = s
}

const toggleSelect = (id: number) => {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

// ── API Loading ────────────────────────────────────────────────────────────────

const loadUnits = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()
  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.name = query
    }
    if (filterStatus.value !== 'all') {
      params['filters[0][column]'] = 'status'
      params['filters[0][value]'] = filterStatus.value
      params['filters[0][condition]'] = '='
      params['filters[0][operator]'] = 'and'
    }
    if (sortBy.value) {
      params['sortBy[column]'] = sortBy.value
      params['sortBy[direction]'] = sortOrder.value
    }

    const data = await $api<UnitsResponse>('/units', { params })
    const list = data.units ?? data.data?.units ?? []
    const paginationData = data.pagination ?? data.data?.pagination ?? null

    units.value = list
    pagination.value = paginationData
    currentPage.value = paginationData?.current_page ?? page
    selectedIds.value = new Set()
  }
  catch (error: unknown) {
    setListLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadUnits(page)
}

const resetPageAndLoad = () => {
  currentPage.value = 1
  loadUnits(1, search.value.trim())
}

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadUnits(1, value.trim())
  }, 1000)
})

const onStatusFilterChange = (value: unknown) => {
  const v = String(value ?? 'all')
  filterStatus.value = (['active', 'inactive'] as const).includes(v as any)
    ? (v as typeof filterStatus.value)
    : 'all'
  resetPageAndLoad()
}

const hasActiveFilters = computed(
  () => filterStatus.value !== 'all',
)

const clearAllFilters = () => {
  filterStatus.value = 'all'
  search.value = ''
  sortBy.value = ''
  sortOrder.value = 'asc'
  loadUnits(1, '')
}

// ── Sorting ────────────────────────────────────────────────────────────────────

const toggleSort = (field: SortField) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  resetPageAndLoad()
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string | null | undefined) => {
  return formatDisplayDate(dateStr)
}

const authorDisplay = (value?: UnitAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const unitDisplayName = (unit: UnitItem) => {
  if (locale.value === 'ar')
    return unit.name_ar?.trim() || unit.name_en?.trim() || '—'
  return unit.name_en?.trim() || unit.name_ar?.trim() || '—'
}

const statusConfig = (status: string) => {
  switch (status) {
    case 'active':
      return { label: t('common.active'), class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' }
    case 'inactive':
      return { label: t('common.inactive'), class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' }
    case 'deleted':
      return { label: t('common.deleted'), class: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' }
    default:
      return { label: status || '—', class: 'bg-muted text-muted-foreground' }
  }
}

// ── Row Actions ────────────────────────────────────────────────────────────────

const handleEdit = (unit: UnitItem) => navigateTo(`/units/edit/${unit.id}`)
const handleView = (unit: UnitItem) => navigateTo(`/units/show/${unit.id}`)

/** PUT /units/{id} expects full resource; backend validates required fields on every update. */
const buildUnitStatusBody = (unit: UnitItem, status: 'active' | 'inactive') => ({
  name_ar: String(unit.name_ar ?? '').trim(),
  name_en: String(unit.name_en ?? '').trim(),
  symbol: String(unit.symbol ?? '').trim(),
  status,
})

// Delete (soft)
const deletingId = ref<number | null>(null)
const unitToDelete = ref<UnitItem | null>(null)

const confirmDelete = async () => {
  if (!unitToDelete.value) return
  const unit = unitToDelete.value
  deletingId.value = unit.id
  unitToDelete.value = null
  try {
    await $api(`/units/${unit.id}`, { method: 'DELETE' })
    toast.success(t('units_page.delete_success', { name: unitDisplayName(unit) }))
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('units_page.delete_error'))
    }
  }
  finally {
    deletingId.value = null
  }
}

// Activate / Deactivate (single)
const togglingId = ref<number | null>(null)
const unitToDeactivate = ref<UnitItem | null>(null)
const unitToActivate = ref<UnitItem | null>(null)

const confirmDeactivate = async () => {
  const unit = unitToDeactivate.value
  if (!unit) return
  togglingId.value = unit.id
  unitToDeactivate.value = null
  try {
    await $api(`/units/${unit.id}`, {
      method: 'PUT',
      body: buildUnitStatusBody(unit, 'inactive'),
    })
    toast.success(t('units_page.deactivate_success', { name: unitDisplayName(unit) }))
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('units_page.deactivate_error'))
    }
  }
  finally {
    togglingId.value = null
  }
}

const confirmActivate = async () => {
  const unit = unitToActivate.value
  if (!unit) return
  togglingId.value = unit.id
  unitToActivate.value = null
  try {
    await $api(`/units/${unit.id}`, {
      method: 'PUT',
      body: buildUnitStatusBody(unit, 'active'),
    })
    toast.success(t('units_page.activate_success', { name: unitDisplayName(unit) }))
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('units_page.activate_error'))
    }
  }
  finally {
    togglingId.value = null
  }
}

// ── Bulk Actions ───────────────────────────────────────────────────────────────

const bulkActionLoading = ref(false)
const bulkConfirmType = ref<'activate' | 'deactivate' | null>(null)
const bulkDeleteConfirmOpen = ref(false)

const openBulkConfirm = (type: 'activate' | 'deactivate') => {
  if (selectedIds.value.size === 0) return
  bulkConfirmType.value = type
}

const confirmBulkAction = async () => {
  const type = bulkConfirmType.value
  if (!type || selectedIds.value.size === 0) return
  bulkConfirmType.value = null
  bulkActionLoading.value = true

  const ids = [...selectedIds.value]
  const newStatus = type === 'activate' ? 'active' : 'inactive'

  try {
    const rows = ids
      .map(id => units.value.find(u => u.id === id))
      .filter((u): u is UnitItem => u != null)
    if (rows.length !== ids.length) {
      toast.error(t('units_page.bulk_resolve_error'))
      return
    }
    await Promise.all(
      rows.map(unit =>
        $api(`/units/${unit.id}`, {
          method: 'PUT',
          body: buildUnitStatusBody(unit, newStatus),
        }),
      ),
    )
    toast.success(
      type === 'activate'
        ? t('units_page.bulk_activated_n', { count: ids.length })
        : t('units_page.bulk_deactivated_n', { count: ids.length }),
    )
    selectedIds.value = new Set()
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || (type === 'activate' ? t('units_page.bulk_activate_failed') : t('units_page.bulk_deactivate_failed')))
    }
  }
  finally {
    bulkActionLoading.value = false
  }
}

const confirmBulkDelete = async () => {
  if (selectedIds.value.size === 0) return
  bulkDeleteConfirmOpen.value = false
  bulkActionLoading.value = true
  const ids = [...selectedIds.value]
  try {
    await Promise.all(ids.map(id => $api(`/units/${id}`, { method: 'DELETE' })))
    toast.success(t('units_page.bulk_delete_success', { count: ids.length }))
    selectedIds.value = new Set()
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('units_page.bulk_delete_error'))
    }
  }
  finally {
    bulkActionLoading.value = false
  }
}

// ── Export (client-side) ───────────────────────────────────────────────────────

const buildExportRows = (source: UnitItem[]) =>
  source.map(u => ({
    id: u.id,
    name_ar: u.name_ar,
    name_en: u.name_en,
    symbol: u.symbol,
    status: statusConfig(u.status).label,
    created_by: authorDisplay(u.created_by),
    created_at: formatDate(u.created_at),
  }))

const exportCSV = () => {
  const selectedUnits = units.value.filter(u => selectedIds.value.has(u.id))
  if (selectedUnits.length === 0) {
    toast.error(t('common.export_min_one'))
    return
  }
  const headers = tm('units_page.export_headers') as unknown as string[]
  const rows = buildExportRows(selectedUnits).map(r => [
    r.id, r.name_ar, r.name_en, r.symbol, r.status,
    r.created_by, r.created_at,
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `units-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success(t('common.export_success'))
}

const shouldHandleErrorLocally = (error: unknown) => {
  const e = error as { response?: { status?: number }, statusCode?: number, status?: number }
  const status = e?.response?.status ?? e?.statusCode ?? e?.status
  return status === 404 || status === 422
}

onMounted(() => loadUnits())
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('units_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('units_page.subtitle') }}
        </p>
      </div>
      
    </div>

    <!-- Toolbar: Search + Filters + Export -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Search -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            :placeholder="t('units_page.search_placeholder')"
            class="pr-9 h-9"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
          />
        </div>

        <!-- Status Filter -->
        <Select :key="`unit-status-${locale}`" :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-[min(100%,11rem)] h-9">
            <Filter class="size-3.5 shrink-0 text-muted-foreground ml-1" />
            <SelectValue :placeholder="t('common.status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('common.all_statuses') }}</SelectItem>
            <SelectItem value="active">{{ t('common.active') }}</SelectItem>
            <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
          </SelectContent>
        </Select>

        <!-- Clear filters -->
        <Button
          v-if="hasActiveFilters || search"
          variant="ghost"
          size="sm"
          class="h-9 gap-1.5 text-muted-foreground"
          @click="clearAllFilters"
        >
          <X class="size-3.5" />
          {{ t('common.clear_filters') }}
        </Button>

     
       
        <!-- Export Buttons -->
        <Button variant="outline" size="sm" class="h-9 gap-2" @click="exportCSV">
          <Download class="size-3.5" />
          CSV
        </Button>
        <div class="flex-1" />
        <Button
          v-if="canCreateUnit"
          class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]"
          as-child
        >
        <NuxtLink to="/units/create">
          <Plus class="size-4" />
          {{ t('units_page.create') }}
        </NuxtLink>
      </Button>
      </div>

      <!-- Bulk Action Bar (visible when items are selected) -->
      <div
        v-if="selectedCount > 0"
        class="flex items-center gap-3 rounded-lg border border-[#215260]/30 bg-[#215260]/5 px-4 py-2.5 flex-wrap"
      >
        <span class="text-sm font-medium text-[#215260]">
          {{ t('units_page.bulk_selected', { count: selectedCount }) }}
        </span>
        <div class="flex items-center gap-2 mr-auto">
          <Button
            v-if="canEditUnit"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
            :disabled="bulkActionLoading"
            @click="openBulkConfirm('activate')"
          >
            <LoaderCircle v-if="bulkActionLoading" class="size-3.5 animate-spin" />
            <UserCheck v-else class="size-3.5" />
            {{ t('units_page.bulk_activate') }}
          </Button>
          <Button
            v-if="canEditUnit"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
            :disabled="bulkActionLoading"
            @click="openBulkConfirm('deactivate')"
          >
            <LoaderCircle v-if="bulkActionLoading" class="size-3.5 animate-spin" />
            <UserX v-else class="size-3.5" />
            {{ t('units_page.bulk_deactivate') }}
          </Button>
          <Button
            v-if="canDeleteUnit"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
            :disabled="bulkActionLoading"
            @click="bulkDeleteConfirmOpen = true"
          >
            <LoaderCircle v-if="bulkActionLoading" class="size-3.5 animate-spin" />
            <Trash2 v-else class="size-3.5" />
            {{ t('units_page.bulk_delete') }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-muted-foreground"
            @click="selectedIds = new Set()"
          >
            {{ t('common.deselect') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-lg border overflow-hidden ">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40 ">
            <!-- Bulk Checkbox -->
            <TableHead class="w-10 text-center ">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>

            <!-- Sortable Columns -->
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSortName"
            >
              <div class="flex items-center gap-1.5">
                {{ locale === 'ar' ? t('units_page.col_name_ar') : t('units_page.col_name_en') }}
                <ArrowUp v-if="isNameSortActive && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="isNameSortActive && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('symbol')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('units_page.col_symbol') }}
                <ArrowUp v-if="sortBy === 'symbol' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'symbol' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('status')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('units_page.col_status') }}
                <ArrowUp v-if="sortBy === 'status' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'status' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-start font-medium">{{ t('common.added_by') }}</TableHead>

            <TableHead
              class="text-end font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('created_at')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('common.created_at') }}
                <ArrowUp v-if="sortBy === 'created_at' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'created_at' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-end font-medium">{{ t('units_page.col_actions') }}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <!-- Loading -->
          <TableRow v-if="loading" >
            <TableCell :colspan="7" class="py-14 text-center ">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground ">
                <Loader2 class="size-4 animate-spin" />
                {{ t('units_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <!-- Error -->
          <TableRow v-else-if="listLoadError">
            <TableCell :colspan="7" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadUnits()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <!-- Empty -->
          <TableRow v-else-if="units.length === 0">
            <TableCell :colspan="7" class="py-14 text-center text-sm text-muted-foreground">
              {{
                search || hasActiveFilters
                  ? t('units_page.no_results')
                  : t('units_page.no_units')
              }}
            </TableCell>
          </TableRow>

          <!-- Data Rows -->
          <TableRow
            v-for="unit in units"
            v-else
            :key="unit.id"
            class="hover:bg-muted/30 transition-colors "
            :class="{ 'bg-muted/20': selectedIds.has(unit.id) }"
          >
            <!-- Checkbox -->
            <TableCell class="w-10">
              <Checkbox
                :model-value="selectedIds.has(unit.id)"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelect(unit.id)"
              />
            </TableCell>

            <!-- Arabic Name (clickable → view) -->
            <TableCell class="font-medium">
              <button
                v-if="canShowUnit"
                type="button"
                class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-start"
                @click="handleView(unit)"
              >
                {{ unitDisplayName(unit) }}
              </button>
              <span v-else>{{ unitDisplayName(unit) }}</span>
            </TableCell>

            <!-- Symbol -->
            <TableCell>
              <span class="inline-flex items-center justify-center rounded bg-muted px-2 py-0.5 text-sm font-mono font-medium">
                {{ unit.symbol || '—' }}
              </span>
            </TableCell>

            <!-- Status Badge -->
            <TableCell>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                :class="statusConfig(unit.status).class"
              >
                {{ statusConfig(unit.status).label }}
              </span>
            </TableCell>

            <!-- Created By -->
            <TableCell class="text-sm text-muted-foreground">
              {{ authorDisplay(unit.created_by) }}
            </TableCell>

            <!-- Created At -->
            <TableCell class="text-end text-sm text-muted-foreground tabular-nums">
              {{ formatDate(unit.created_at) }}
            </TableCell>

            <!-- Actions -->
            <TableCell class="text-end">
              <TableRowActions
                :actions="[
                  { key: `edit-${unit.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canEditUnit, onClick: () => handleEdit(unit) },
                  { key: `deactivate-${unit.id}`, label: t('common.deactivate'), type: 'button', icon: UserX, tone: 'warning', visible: canEditUnit && unit.status === 'active', disabled: togglingId === unit.id || deletingId === unit.id, loading: togglingId === unit.id, onClick: () => { unitToDeactivate = unit } },
                  { key: `activate-${unit.id}`, label: t('common.activate'), type: 'button', icon: UserCheck, tone: 'success', visible: canEditUnit && unit.status === 'inactive', disabled: togglingId === unit.id || deletingId === unit.id, loading: togglingId === unit.id, onClick: () => { unitToActivate = unit } },
                  { key: `delete-${unit.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteUnit && unit.status !== 'deleted', disabled: deletingId === unit.id || togglingId === unit.id, loading: deletingId === unit.id, onClick: () => { unitToDelete = unit } },
                ]"
                variant="link"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">
          {{
            t('units_page.pagination', {
              from: (currentPage - 1) * pagination.per_page + 1,
              to: Math.min(currentPage * pagination.per_page, pagination.total),
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

          <template v-for="page in pagination.last_page" :key="page">
            <Button
              v-if="page === 1 || page === pagination.last_page || Math.abs(page - currentPage) <= 1"
              :variant="page === currentPage ? 'default' : 'outline'"
              size="icon"
              class="size-8 text-xs"
              :disabled="loading"
              @click="goToPage(page)"
            >
              {{ page }}
            </Button>
            <span
              v-else-if="page === 2 && currentPage > 3"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
            <span
              v-else-if="page === pagination.last_page - 1 && currentPage < pagination.last_page - 2"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
          </template>

        </PaginationArrowButtons>
      </div>

      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('units_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>
  </div>

  <!-- ── Confirmation Dialogs ─────────────────────────────────────────────────── -->

  <!-- Delete Single -->
  <AlertDialog :open="!!unitToDelete" @update:open="val => { if (!val) unitToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('units_page.delete_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right">
          {{ t('units_page.delete_dialog_body', { name: unitToDelete ? unitDisplayName(unitToDelete) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="!!deletingId"
          @click="confirmDelete"
        >
          <LoaderCircle v-if="deletingId" class="size-4 animate-spin ml-2" />
          {{ t('units_page.confirm_yes_delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Deactivate Single -->
  <AlertDialog :open="!!unitToDeactivate" @update:open="val => { if (!val) unitToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('units_page.deactivate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>
            {{ t('units_page.deactivate_dialog_body', { name: unitToDeactivate ? unitDisplayName(unitToDeactivate) : '' }) }}
          </p>
          <p>{{ t('units_page.deactivate_dialog_hint') }}</p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-amber-600 hover:bg-amber-700 text-white"
          :disabled="!!togglingId"
          @click="confirmDeactivate"
        >
          <LoaderCircle v-if="togglingId" class="size-4 animate-spin ml-2" />
          {{ t('units_page.confirm_yes_deactivate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Activate Single -->
  <AlertDialog :open="!!unitToActivate" @update:open="val => { if (!val) unitToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('units_page.activate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('units_page.activate_dialog_body', { name: unitToActivate ? unitDisplayName(unitToActivate) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-green-600 hover:bg-green-700 text-white"
          :disabled="!!togglingId"
          @click="confirmActivate"
        >
          <LoaderCircle v-if="togglingId" class="size-4 animate-spin ml-2" />
          {{ t('units_page.confirm_yes_activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Bulk Activate/Deactivate -->
  <AlertDialog
    :open="!!bulkConfirmType"
    @update:open="val => { if (!val) bulkConfirmType = null }"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            bulkConfirmType === 'activate'
              ? t('units_page.bulk_activate_title')
              : t('units_page.bulk_deactivate_title')
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            bulkConfirmType === 'activate'
              ? t('units_page.bulk_activate_body', { count: selectedCount })
              : t('units_page.bulk_deactivate_body', { count: selectedCount })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          :class="bulkConfirmType === 'activate' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'"
          :disabled="bulkActionLoading"
          @click="confirmBulkAction"
        >
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin ml-2" />
          {{
            bulkConfirmType === 'activate'
              ? t('units_page.bulk_confirm_activate')
              : t('units_page.bulk_confirm_deactivate')
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Bulk Delete -->
  <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="val => { bulkDeleteConfirmOpen = val }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('units_page.bulk_delete_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('units_page.bulk_delete_body', { count: selectedCount }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="bulkActionLoading"
          @click="confirmBulkDelete"
        >
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin ml-2" />
          {{ t('units_page.bulk_confirm_delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
