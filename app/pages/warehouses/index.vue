<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search, Plus, Pencil, Trash2, Loader2, ShieldAlert, LoaderCircle,
  Filter, UserX, UserCheck, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
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

const { t, locale } = useI18n()
const { navigateRow } = useMobileRowNavigate()
const { getErrorMessage } = useApiError()

interface WarehouseManager {
  id: number
  name: string
  email?: string
}

interface WarehouseAuthor {
  id: number
  name?: string
  email?: string
}

interface WarehouseItem {
  id: number
  name_ar: string
  name_en: string
  location: string
  address?: string
  manager?: WarehouseManager | null
  created_by?: WarehouseAuthor | number | null
  created_at?: string | null
  status: string
}

interface WarehousesPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface WarehousesResponse {
  status?: string
  status_code?: number
  data?: {
    warehouses?: WarehouseItem[]
    pagination?: WarehousesPagination
  }
  message?: string | null
}

type SortField = 'name_ar' | 'name_en' | 'location' | 'status'

const { $api } = useApi()
const { canEdit, canCreate, canDelete, canAccess } = usePermissions()
const canEditWarehouse = computed(() => canEdit('warehouses'))
const canCreateWarehouse = computed(() => canCreate('warehouses'))
const canDeleteWarehouse = computed(() => canDelete('warehouses'))
const canShowWarehouse = computed(() => canAccess('warehouses'))

const warehouses = ref<WarehouseItem[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('warehouses_page')
const pagination = ref<WarehousesPagination | null>(null)
const currentPage = ref(1)

const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const sortBy = ref<SortField | ''>('')
const sortOrder = ref<'asc' | 'desc'>('asc')
const selectedIds = ref<Set<number>>(new Set())
const bulkActivateConfirmOpen = ref(false)
const bulkDeactivateConfirmOpen = ref(false)
const bulkDeleteConfirmOpen = ref(false)
const bulkActionLoading = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const isAllSelected = computed(
  () => warehouses.value.length > 0 && warehouses.value.every(wh => selectedIds.value.has(wh.id)),
)
const isIndeterminate = computed(
  () => warehouses.value.some(wh => selectedIds.value.has(wh.id)) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)
const selectedWarehouses = computed(() => warehouses.value.filter(wh => selectedIds.value.has(wh.id)))

const toggleSelectAll = () => {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) warehouses.value.forEach(wh => next.delete(wh.id))
  else warehouses.value.forEach(wh => next.add(wh.id))
  selectedIds.value = next
}

const toggleSelect = (id: number) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const { bindRow } = useLongPressSelect()

const loadWarehouses = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()
  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.name = query
    }
    if (filterStatus.value !== 'all'){
      params['filters[0][column]'] = 'status'
      params['filters[0][value]'] = filterStatus.value
      params['filters[0][condition]'] = '='
      params['filters[0][operator]'] = 'and'
    }

    if (sortBy.value) {
      params['sortBy[column]'] = sortBy.value
      params['sortBy[direction]'] = sortOrder.value
    }

    const data = await $api<WarehousesResponse>('/warehouses', { params })
    const list = data.data?.warehouses ?? []
    const paginationData = data.data?.pagination ?? null

    warehouses.value = list
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
  loadWarehouses(page)
}

const resetPageAndLoad = () => {
  currentPage.value = 1
  loadWarehouses(1, search.value.trim())
}

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

/** Single name column: sort by Arabic or English column name per API */
const toggleSortName = () => {
  const field: SortField = locale.value === 'ar' ? 'name_ar' : 'name_en'
  toggleSort(field)
}

const isNameSortActive = computed(
  () => sortBy.value === 'name_ar' || sortBy.value === 'name_en',
)

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadWarehouses(1, value.trim())
  }, 1000)
})

const onStatusFilterChange = (value: unknown) => {
  const v = String(value ?? 'all')
  filterStatus.value = (['active', 'inactive'] as const).includes(v as any)
    ? (v as typeof filterStatus.value)
    : 'all'
  resetPageAndLoad()
}

const warehouseDisplayName = (w: WarehouseItem) => {
  if (locale.value === 'ar')
    return w.name_ar?.trim() || w.name_en?.trim() || '—'
  return w.name_en?.trim() || w.name_ar?.trim() || '—'
}

const shouldHandleErrorLocally = (error: unknown) => {
  const e = error as { response?: { status?: number }, statusCode?: number, status?: number }
  const status = e?.response?.status ?? e?.statusCode ?? e?.status
  return status === 404 || status === 422
}

const truncateWarehouseName = (name: string, maxLength = 30) => {
  if (name.length <= maxLength) return name
  return `${name.slice(0, maxLength)}...`
}

const isActiveStatus = (status: string) => String(status).toLowerCase() === 'active'

const statusConfig = (status: string) => {
  const s = String(status).toLowerCase()
  if (s === 'active') {
    return {
      label: t('common.active'),
      class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    }
  }
  if (s === 'inactive') {
    return {
      label: t('common.inactive'),
      class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    }
  }
  return { label: status || '—', class: 'bg-muted text-muted-foreground' }
}

const createdByDisplay = (value?: WarehouseItem['created_by']) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const formatDate = (dateStr: string | null | undefined) => {
  return formatDisplayDate(dateStr)
}

const emptyListMessage = computed(() => {
  if (warehouses.value.length > 0) return ''
  if (loading.value || listLoadError.value) return ''
  if (filterStatus.value !== 'all') return t('warehouses_page.empty_filter')
  if (search.value.trim()) return t('warehouses_page.empty_search')
  return t('warehouses_page.no_warehouses')
})

const handleEdit = (w: WarehouseItem) => {
  navigateTo(`/warehouses/edit/${w.id}`)
}

const handleView = (w: WarehouseItem) => {
  navigateTo(`/warehouses/show/${w.id}`)
}

const buildWarehouseStatusBody = (w: WarehouseItem, status: 'active' | 'inactive') => ({
  name_ar: String(w.name_ar ?? '').trim(),
  name_en: String(w.name_en ?? '').trim(),
  location: String(w.location ?? '').trim(),
  address: String(w.address ?? '').trim(),
  status,
  manager_id: w.manager?.id ?? null,
})
const canActivateSelected = computed(
  () => canEditWarehouse.value && selectedWarehouses.value.some(wh => !isActiveStatus(wh.status)),
)
const canDeactivateSelected = computed(
  () => canEditWarehouse.value && selectedWarehouses.value.some(wh => isActiveStatus(wh.status)),
)
const canDeleteSelected = computed(
  () => canDeleteWarehouse.value && selectedWarehouses.value.length > 0,
)

const togglingId = ref<number | null>(null)
const warehouseToDeactivate = ref<WarehouseItem | null>(null)
const warehouseToActivate = ref<WarehouseItem | null>(null)

const deletingId = ref<number | null>(null)
const warehouseToDelete = ref<WarehouseItem | null>(null)

const confirmDelete = async () => {
  const w = warehouseToDelete.value
  if (!w) return
  deletingId.value = w.id
  warehouseToDelete.value = null
  try {
    await $api(`/warehouses/${w.id}`, { method: 'DELETE' })
    toast.success(t('warehouses_page.delete_success', { name: warehouseDisplayName(w) }))
    await loadWarehouses(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('warehouses_page.delete_error'))
    }
  }
  finally {
    deletingId.value = null
  }
}

const confirmDeactivate = async () => {
  const w = warehouseToDeactivate.value
  if (!w) return
  togglingId.value = w.id
  warehouseToDeactivate.value = null
  try {
    await $api(`/warehouses/${w.id}`, {
      method: 'PUT',
      body: buildWarehouseStatusBody(w, 'inactive'),
    })
    toast.success(t('warehouses_page.deactivate_success', { name: warehouseDisplayName(w) }))
    await loadWarehouses(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('warehouses_page.deactivate_error'))
    }
  }
  finally {
    togglingId.value = null
  }
}

const confirmActivate = async () => {
  const w = warehouseToActivate.value
  if (!w) return
  togglingId.value = w.id
  warehouseToActivate.value = null
  try {
    await $api(`/warehouses/${w.id}`, {
      method: 'PUT',
      body: buildWarehouseStatusBody(w, 'active'),
    })
    toast.success(t('warehouses_page.activate_success', { name: warehouseDisplayName(w) }))
    await loadWarehouses(currentPage.value)
  }
  catch (error: any) {
    if (shouldHandleErrorLocally(error)) {
      toast.error(getErrorMessage(error) || t('warehouses_page.activate_error'))
    }
  }
  finally {
    togglingId.value = null
  }
}

const runBulkActivate = async () => {
  const eligible = selectedWarehouses.value.filter(wh => !isActiveStatus(wh.status))
  if (!eligible.length) return
  bulkActivateConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(
      eligible.map(wh => $api(`/warehouses/${wh.id}`, {
        method: 'PUT',
        body: buildWarehouseStatusBody(wh, 'active'),
      })),
    )
    toast.success(t('common.bulk_activated_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadWarehouses(currentPage.value)
  } catch (error: any) {
    toast.error(getErrorMessage(error) || t('warehouses_page.activate_error'))
  } finally {
    bulkActionLoading.value = false
  }
}

const runBulkDeactivate = async () => {
  const eligible = selectedWarehouses.value.filter(wh => isActiveStatus(wh.status))
  if (!eligible.length) return
  bulkDeactivateConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(
      eligible.map(wh => $api(`/warehouses/${wh.id}`, {
        method: 'PUT',
        body: buildWarehouseStatusBody(wh, 'inactive'),
      })),
    )
    toast.success(t('common.bulk_deactivated_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadWarehouses(currentPage.value)
  } catch (error: any) {
    toast.error(getErrorMessage(error) || t('warehouses_page.deactivate_error'))
  } finally {
    bulkActionLoading.value = false
  }
}

const runBulkDelete = async () => {
  const eligible = selectedWarehouses.value
  if (!eligible.length) return
  bulkDeleteConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(eligible.map(wh => $api(`/warehouses/${wh.id}`, { method: 'DELETE' })))
    toast.success(t('common.bulk_deleted_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadWarehouses(currentPage.value)
  } catch (error: any) {
    toast.error(getErrorMessage(error) || t('warehouses_page.delete_error'))
  } finally {
    bulkActionLoading.value = false
  }
}

onMounted(() => loadWarehouses())
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('warehouses_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('warehouses_page.subtitle') }}
        </p>
      </div>
      <Button
        v-if="canCreateWarehouse"
        class="gap-2 bg-primary hover:bg-primary/90 text-white"
        as-child
      >
        <NuxtLink to="/warehouses/create">
          <Plus class="size-4" />
          {{ t('warehouses_page.create') }}
        </NuxtLink>
      </Button>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <div class="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            :placeholder="t('warehouses_page.search_placeholder')"
            class="pr-9 h-9 w-full"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
          />
        </div>

        <Select :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-full sm:w-[180px] h-9">
            <Filter class="size-4 text-muted-foreground ml-1" />
            <SelectValue :placeholder="t('warehouses_page.filter_status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('common.all') }} — {{ t('common.status') }}</SelectItem>
            <SelectItem value="active">{{ t('common.active') }}</SelectItem>
            <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div
      v-if="selectedCount > 0"
      class="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 flex-wrap"
    >
      <span class="text-sm font-medium text-emerald-700">
        {{ t('common.bulk_status_actions_notice', { count: selectedCount }) }}
      </span>
      <div class="flex items-center gap-2 ms-auto">
        <Button variant="outline" size="sm" class="h-8" :disabled="bulkActionLoading || !canActivateSelected" @click="bulkActivateConfirmOpen = true">
          {{ t('common.activate') }}
        </Button>
        <Button variant="outline" size="sm" class="h-8" :disabled="bulkActionLoading || !canDeactivateSelected" @click="bulkDeactivateConfirmOpen = true">
          {{ t('common.deactivate') }}
        </Button>
        <Button variant="outline" size="sm" class="h-8 text-red-600 border-red-300 hover:bg-red-100" :disabled="bulkActionLoading || !canDeleteSelected" @click="bulkDeleteConfirmOpen = true">
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
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSortName"
            >
              <div class="flex items-center gap-1.5">
                {{ t('warehouses_page.col_name') }}
                <ArrowUp v-if="isNameSortActive && sortOrder === 'asc'" class="size-3.5 text-primary" />
                <ArrowDown v-else-if="isNameSortActive && sortOrder === 'desc'" class="size-3.5 text-primary" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('location')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('warehouses_page.col_location') }}
                <ArrowUp v-if="sortBy === 'location' && sortOrder === 'asc'" class="size-3.5 text-primary" />
                <ArrowDown v-else-if="sortBy === 'location' && sortOrder === 'desc'" class="size-3.5 text-primary" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>
            <TableHead class="text-start font-medium">{{ t('warehouses_page.col_manager') }}</TableHead>
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('status')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('warehouses_page.col_status') }}
                <ArrowUp v-if="sortBy === 'status' && sortOrder === 'asc'" class="size-3.5 text-primary" />
                <ArrowDown v-else-if="sortBy === 'status' && sortOrder === 'desc'" class="size-3.5 text-primary" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>
            <TableHead class="text-start font-medium">{{ t('common.added_by') }}</TableHead>
            <TableHead class="text-end font-medium">{{ t('common.created_at') }}</TableHead>
            
            <TableHead class="text-end font-medium">{{ t('warehouses_page.col_actions') }}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-if="loading" class="md:table-row">
            <TableCell :colspan="8" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('warehouses_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="listLoadError" class="md:table-row">
            <TableCell :colspan="8" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadWarehouses()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="warehouses.length === 0" class="md:table-row">
            <TableCell :colspan="8" class="py-14 text-center text-sm text-muted-foreground">
              {{ emptyListMessage }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="wh in warehouses"
            v-else
            :key="wh.id"
            class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none hover:bg-muted/30 transition-colors align-middle cursor-pointer md:cursor-default"
            :class="{ 'bg-muted/20': selectedIds.has(wh.id) }"
            v-bind="bindRow({ onLongPress: () => toggleSelect(wh.id), onTap: () => (selectedCount > 0 ? toggleSelect(wh.id) : navigateRow(`/warehouses/show/${wh.id}`)) })"
          >
            <TableCell class="flex items-center justify-between gap-2 py-1.5 border-b md:w-10 md:table-cell md:py-4 md:border-0" @click.stop>
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.select') }}</span>
              <Checkbox :model-value="selectedIds.has(wh.id)" class="md:mt-0.5 md:mx-4" @update:model-value="toggleSelect(wh.id)" />
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('warehouses_page.col_name') }}</span>
              <div class="font-medium">
                <button
                  v-if="canShowWarehouse"
                  type="button"
                  class="inline-flex max-w-full min-w-0 text-sm text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-end md:text-start cursor-pointer"
                  @click="handleView(wh)"
                >
                  <span class="min-w-0">{{ truncateWarehouseName(warehouseDisplayName(wh)) }}</span>
                </button>
                <span v-else class="text-sm">{{ truncateWarehouseName(warehouseDisplayName(wh)) }}</span>
              </div>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('warehouses_page.col_location') }}</span>
              <span class="text-sm text-muted-foreground">{{ wh.location || '—' }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('warehouses_page.col_manager') }}</span>
              <span class="text-sm text-muted-foreground">{{ wh.manager?.name || '—' }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('warehouses_page.col_status') }}</span>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                :class="statusConfig(wh.status).class"
              >
                {{ statusConfig(wh.status).label }}
              </span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.added_by') }}</span>
              <span class="text-sm text-muted-foreground">{{ createdByDisplay(wh.created_by) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.created_at') }}</span>
              <span class="text-sm text-muted-foreground tabular-nums">{{ formatDate(wh.created_at) }}</span>
            </TableCell>
            
            <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end" @click.stop>
              <TableRowActions
                :actions="[
                  { key: `edit-${wh.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canEditWarehouse, disabled: deletingId === wh.id, onClick: () => handleEdit(wh) },
                  { key: `deactivate-${wh.id}`, label: t('common.deactivate'), type: 'button', icon: UserX, tone: 'warning', visible: canEditWarehouse && isActiveStatus(wh.status), disabled: togglingId === wh.id || deletingId === wh.id, loading: togglingId === wh.id, onClick: () => { warehouseToDeactivate = wh } },
                  { key: `activate-${wh.id}`, label: t('common.activate'), type: 'button', icon: UserCheck, tone: 'success', visible: canEditWarehouse && !isActiveStatus(wh.status), disabled: togglingId === wh.id || deletingId === wh.id, loading: togglingId === wh.id, onClick: () => { warehouseToActivate = wh } },
                  { key: `delete-${wh.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteWarehouse, disabled: deletingId === wh.id || togglingId === wh.id, loading: deletingId === wh.id, onClick: () => { warehouseToDelete = wh } },
                ]"
                variant="link"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">
          {{
            t('warehouses_page.pagination', {
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
        <p class="text-xs text-muted-foreground">{{ t('warehouses_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>
  </div>

  <AlertDialog :open="!!warehouseToDelete" @update:open="val => { if (!val) warehouseToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('warehouses_page.delete_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right">
          {{
            t('warehouses_page.delete_dialog_body', {
              name: warehouseToDelete ? truncateWarehouseName(warehouseDisplayName(warehouseToDelete)) : '',
            })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="!!deletingId"
          @click="confirmDelete"
        >
          <LoaderCircle v-if="deletingId" class="size-4 animate-spin" />
          {{ t('warehouses_page.confirm_yes_delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!warehouseToDeactivate" @update:open="val => { if (!val) warehouseToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('warehouses_page.deactivate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right space-y-2">
          <span>
            {{ t('warehouses_page.deactivate_dialog_body', { name: warehouseToDeactivate ? warehouseDisplayName(warehouseToDeactivate) : '' }) }}
          </span>
          <span class="block text-muted-foreground">{{ t('warehouses_page.deactivate_dialog_hint') }}</span>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-amber-600 hover:bg-amber-700 text-white"
          :disabled="!!togglingId"
          @click="confirmDeactivate"
        >
          <LoaderCircle v-if="togglingId" class="size-4 animate-spin" />
          {{ t('warehouses_page.confirm_yes_deactivate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!warehouseToActivate" @update:open="val => { if (!val) warehouseToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('warehouses_page.activate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right">
          {{ t('warehouses_page.activate_dialog_body', { name: warehouseToActivate ? warehouseDisplayName(warehouseToActivate) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-green-600 hover:bg-green-700 text-white"
          :disabled="!!togglingId"
          @click="confirmActivate"
        >
          <LoaderCircle v-if="togglingId" class="size-4 animate-spin" />
          {{ t('warehouses_page.confirm_yes_activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <AlertDialog :open="bulkActivateConfirmOpen" @update:open="bulkActivateConfirmOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.bulk_activate_selected_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('common.bulk_activate_selected_body') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-green-600 hover:bg-green-700 text-white" :disabled="bulkActionLoading" @click="runBulkActivate">
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin" />
          {{ t('common.activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <AlertDialog :open="bulkDeactivateConfirmOpen" @update:open="bulkDeactivateConfirmOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.bulk_deactivate_selected_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('common.bulk_deactivate_selected_body') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-amber-600 hover:bg-amber-700 text-white" :disabled="bulkActionLoading" @click="runBulkDeactivate">
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin" />
          {{ t('common.deactivate') }}
        </Button>
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
        <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="bulkActionLoading" @click="runBulkDelete">
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin" />
          {{ t('common.delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
