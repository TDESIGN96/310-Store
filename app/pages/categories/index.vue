<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search, Plus, Pencil, Trash2, Loader2, ShieldAlert,
  LoaderCircle, Filter,
  Download, ArrowUp, ArrowDown, ArrowUpDown,
  UserX, UserCheck, X, Tag,
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
import { fetchAllCategoriesPages, type CategoriesApi } from '@/utils/categoryList'

definePageMeta({ layout: 'default' })

const { t, tm, locale } = useI18n()
const { navigateRow } = useMobileRowNavigate()

// ── Types ──────────────────────────────────────────────────────────────────────

interface CategoryAuthor {
  id: number
  name: string
  email?: string
}

interface ParentCategory {
  id: number
  name_ar: string
  name_en: string
}

interface CategoryItem {
  id: number
  name_ar: string
  name_en: string
  description?: string | null
  status: 'active' | 'inactive' | 'deleted' | string
  parent?: ParentCategory | null
  parent_id?: number | null
  created_by?: CategoryAuthor | number | null
  updated_by?: CategoryAuthor | number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface CategoriesPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface CategoriesResponse {
  categories?: CategoryItem[]
  pagination?: CategoriesPagination
  data?: {
    categories?: CategoryItem[]
    pagination?: CategoriesPagination
  }
  status?: string
  status_code?: number
  message?: string | null
}

interface ParentFilterItem {
  id: number
  name_ar: string
  name_en: string
}

type SortField = 'name_ar' | 'name_en' | 'created_at' | 'status'

// ── State ──────────────────────────────────────────────────────────────────────

const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canCreate: canCreateCat, canEdit: canEditCat, canDelete: canDeleteCat, can: canPerm } = usePermissions()
const canCreate = computed(() => canCreateCat('categories'))
const canUpdate = computed(() => canEditCat('categories'))
const canDestroy = computed(() => canDeleteCat('categories'))
const canShow = computed(() => canPerm('categories.show'))

const categories = ref<CategoryItem[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('categories_page')
const pagination = ref<CategoriesPagination | null>(null)
const currentPage = ref(1)

// Search & Filters
const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const filterParentId = ref<string>('all')
const parentsForFilter = ref<ParentFilterItem[]>([])
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Sorting
const sortBy = ref<SortField | ''>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// Bulk selection
const selectedIds = ref<Set<number>>(new Set())

const isAllSelected = computed(
  () => categories.value.length > 0 && categories.value.every(c => selectedIds.value.has(c.id)),
)
const isIndeterminate = computed(
  () => categories.value.some(c => selectedIds.value.has(c.id)) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)

const toggleSelectAll = () => {
  const s = new Set(selectedIds.value)
  if (isAllSelected.value) {
    categories.value.forEach(c => s.delete(c.id))
  }
  else {
    categories.value.forEach(c => s.add(c.id))
  }
  selectedIds.value = s
}

const toggleSelect = (id: number) => {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

// ── Load parent list for filter dropdown ───────────────────────────────────────

/** Only categories that are parents (at least one child references them as parent_id). */
const loadParentsForFilter = async () => {
  try {
    const all = await fetchAllCategoriesPages<CategoryItem>($api as CategoriesApi)
    const idsThatAreParents = new Set<number>()
    for (const c of all) {
      if (c.parent_id != null) idsThatAreParents.add(c.parent_id)
    }
    parentsForFilter.value = all
      .filter(c => idsThatAreParents.has(c.id))
      .map(({ id, name_ar, name_en }) => ({ id, name_ar, name_en }))
      .sort((a, b) => {
        const aName = locale.value === 'ar' ? (a.name_ar || a.name_en) : (a.name_en || a.name_ar)
        const bName = locale.value === 'ar' ? (b.name_ar || b.name_en) : (b.name_en || b.name_ar)
        return String(aName).localeCompare(String(bName), locale.value === 'ar' ? 'ar' : 'en')
      })
  }
  catch {
    parentsForFilter.value = []
  }
}

// ── API Loading ────────────────────────────────────────────────────────────────

const loadCategories = async (page = currentPage.value, query = search.value.trim()) => {
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
    if (filterParentId.value !== 'all') {
      params['filters[1][column]'] = 'parent_id'
      params['filters[1][value]'] = filterParentId.value
      params['filters[1][condition]'] = '='
      params['filters[1][operator]'] = 'and'
    }
    if (sortBy.value) {
      params['sortBy[column]'] = sortBy.value
      params['sortBy[direction]'] = sortOrder.value
    }

    const data = await $api<CategoriesResponse>('/categories', { params })
    const list = data.categories ?? data.data?.categories ?? []
    const paginationData = data.pagination ?? data.data?.pagination ?? null

    categories.value = list
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
  loadCategories(page)
}

const resetPageAndLoad = () => {
  currentPage.value = 1
  loadCategories(1, search.value.trim())
}

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadCategories(1, value.trim())
  }, 1000)
})

watch(locale, () => {
  loadParentsForFilter()
})

const onStatusFilterChange = (value: unknown) => {
  const v = String(value ?? 'all')
  filterStatus.value = (['active', 'inactive'] as const).includes(v as any)
    ? (v as typeof filterStatus.value)
    : 'all'
  resetPageAndLoad()
}

const onParentFilterChange = (value: unknown) => {
  filterParentId.value = value != null && value !== '' ? String(value) : 'all'
  resetPageAndLoad()
}

const hasActiveFilters = computed(
  () => filterStatus.value !== 'all' || filterParentId.value !== 'all',
)

const clearAllFilters = () => {
  filterStatus.value = 'all'
  filterParentId.value = 'all'
  search.value = ''
  sortBy.value = ''
  sortOrder.value = 'asc'
  loadCategories(1, '')
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

const toggleSortName = () => {
  const field: SortField = locale.value === 'ar' ? 'name_ar' : 'name_en'
  toggleSort(field)
}

const isNameSortActive = computed(
  () => sortBy.value === 'name_ar' || sortBy.value === 'name_en',
)

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string | null | undefined) => {
  return formatDisplayDate(dateStr)
}

const authorDisplay = (value?: CategoryAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const categoryPrimaryName = (category: Pick<CategoryItem, 'name_ar' | 'name_en'>) =>
  locale.value === 'ar'
    ? (category.name_ar || category.name_en || '—')
    : (category.name_en || category.name_ar || '—')

const parentFilterLabel = (parent: ParentFilterItem) =>
  locale.value === 'ar'
    ? (parent.name_ar || parent.name_en || `#${parent.id}`)
    : (parent.name_en || parent.name_ar || `#${parent.id}`)

const parentDisplay = (category: CategoryItem) => {
  if (!category.parent && !category.parent_id) return '—'
  if (category.parent) {
    return locale.value === 'ar'
      ? (category.parent.name_ar || category.parent.name_en || `#${category.parent.id}`)
      : (category.parent.name_en || category.parent.name_ar || `#${category.parent.id}`)
  }
  return `#${category.parent_id}`
}

/** Truncate description to first 5 words followed by ellipsis */
const truncateDescription = (text: string | null | undefined) => {
  if (!text) return '—'
  const words = text.trim().split(/\s+/)
  if (words.length <= 5) return text
  return words.slice(0, 5).join(' ') + '...'
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

const handleEdit = (cat: CategoryItem) => navigateTo(`/categories/edit/${cat.id}`)
const handleView = (cat: CategoryItem) => navigateTo(`/categories/show/${cat.id}`)

/** PUT /categories/{id} expects full resource on every update */
const buildCategoryStatusBody = (cat: CategoryItem, status: 'active' | 'inactive') => ({
  name_ar: String(cat.name_ar ?? '').trim(),
  name_en: String(cat.name_en ?? '').trim(),
  status,
  ...(cat.description != null ? { description: cat.description } : {}),
  ...(cat.parent_id != null ? { parent_id: cat.parent_id } : {}),
})

// Delete (soft)
const deletingId = ref<number | null>(null)
const categoryToDelete = ref<CategoryItem | null>(null)

const confirmDelete = async () => {
  if (!categoryToDelete.value) return
  const cat = categoryToDelete.value
  deletingId.value = cat.id
  categoryToDelete.value = null
  try {
    await $api(`/categories/${cat.id}`, { method: 'DELETE' })
    toast.success(t('categories_page.delete_success', { name: categoryPrimaryName(cat) }))
    await loadCategories(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('categories_page.delete_error'))
  }
  finally {
    deletingId.value = null
  }
}

// Activate / Deactivate (single)
const togglingId = ref<number | null>(null)
const categoryToDeactivate = ref<CategoryItem | null>(null)
const categoryToActivate = ref<CategoryItem | null>(null)

const confirmDeactivate = async () => {
  const cat = categoryToDeactivate.value
  if (!cat) return
  togglingId.value = cat.id
  categoryToDeactivate.value = null
  try {
    await $api(`/categories/${cat.id}`, {
      method: 'PUT',
      body: buildCategoryStatusBody(cat, 'inactive'),
    })
    toast.success(t('categories_page.deactivate_success', { name: categoryPrimaryName(cat) }))
    await loadCategories(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('categories_page.deactivate_error'))
  }
  finally {
    togglingId.value = null
  }
}

const confirmActivate = async () => {
  const cat = categoryToActivate.value
  if (!cat) return
  togglingId.value = cat.id
  categoryToActivate.value = null
  try {
    await $api(`/categories/${cat.id}`, {
      method: 'PUT',
      body: buildCategoryStatusBody(cat, 'active'),
    })
    toast.success(t('categories_page.activate_success', { name: categoryPrimaryName(cat) }))
    await loadCategories(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('categories_page.activate_error'))
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
      .map(id => categories.value.find(c => c.id === id))
      .filter((c): c is CategoryItem => c != null)
    if (rows.length !== ids.length) {
      toast.error(t('categories_page.bulk_resolve_error'))
      return
    }
    await Promise.all(
      rows.map(cat =>
        $api(`/categories/${cat.id}`, {
          method: 'PUT',
          body: buildCategoryStatusBody(cat, newStatus),
        }),
      ),
    )
    toast.success(
      type === 'activate'
        ? t('categories_page.bulk_activated_n', { count: ids.length })
        : t('categories_page.bulk_deactivated_n', { count: ids.length }),
    )
    selectedIds.value = new Set()
    await loadCategories(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(
      getErrorMessage(error)
      || (type === 'activate' ? t('categories_page.bulk_activate_failed') : t('categories_page.bulk_deactivate_failed')),
    )
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
    await Promise.all(ids.map(id => $api(`/categories/${id}`, { method: 'DELETE' })))
    toast.success(t('categories_page.bulk_delete_success', { count: ids.length }))
    selectedIds.value = new Set()
    await loadCategories(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('categories_page.bulk_delete_error'))
  }
  finally {
    bulkActionLoading.value = false
  }
}

// ── Export (client-side, selection-based) ─────────────────────────────────────

const buildExportRows = (source: CategoryItem[]) =>
  source.map(c => ({
    id: c.id,
    name_ar: c.name_ar,
    name_en: c.name_en,
    parent: parentDisplay(c),
    description: c.description || '—',
    status: statusConfig(c.status).label,
    created_by: authorDisplay(c.created_by),
    created_at: formatDate(c.created_at),
  }))

const getExportRows = () =>
  buildExportRows(categories.value.filter(c => selectedIds.value.has(c.id)))
    .map(r => [r.id, r.name_ar, r.name_en, r.parent, r.description, r.status, r.created_by, r.created_at])

const exportCSV = () => {
  const rows = getExportRows()
  if (rows.length === 0) {
    toast.error(t('common.export_min_one'))
    return
  }
  const exportHeaders = tm('categories_page.export_headers') as unknown as string[]
  const csv = [exportHeaders, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `categories-${formatDisplayDate(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success(t('common.export_success'))
}

onMounted(() => {
  loadCategories()
  loadParentsForFilter()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('categories_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('categories_page.subtitle') }}
        </p>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row items-center gap-2 flex-wrap">
        <!-- Search -->
        <div class="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            :placeholder="t('categories_page.search_placeholder')"
            class="pr-9 h-9"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
          />
        </div>

        <!-- Status Filter -->
        <Select :key="`status-${locale}`" :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-full sm:w-[11rem] h-9">
            <Filter class="size-3.5 shrink-0 text-muted-foreground ml-1" />
            <SelectValue :placeholder="t('common.status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('common.all_statuses') }}</SelectItem>
            <SelectItem value="active">{{ t('common.active') }}</SelectItem>
            <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
          </SelectContent>
        </Select>

        <!-- Parent Category Filter -->
        <Select :key="`parent-${locale}`" :model-value="filterParentId" @update:model-value="onParentFilterChange">
          <SelectTrigger class="w-full sm:w-[13rem] h-9">
            <Tag class="size-3.5 shrink-0 text-muted-foreground ml-1" />
            <SelectValue :placeholder="t('categories_page.filter_parent')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('categories_page.all_parents') }}</SelectItem>
            <SelectItem
              v-for="parent in parentsForFilter"
              :key="parent.id"
              :value="String(parent.id)"
            >
              {{ parentFilterLabel(parent) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Clear filters -->
        <Button
          v-if="hasActiveFilters || search"
          variant="ghost"
          size="sm"
          class="w-full sm:w-auto h-9 gap-1.5 text-muted-foreground"
          @click="clearAllFilters"
        >
          <X class="size-3.5" />
          {{ t('common.clear_filters') }}
        </Button>

        <!-- Export Buttons -->
        <Button variant="outline" size="sm" class="w-full sm:w-auto h-9 gap-2" @click="exportCSV">
          <Download class="size-3.5" />
          CSV
        </Button>

        <div class="hidden sm:block sm:flex-1" />

        <Button v-if="canCreate" class="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white" as-child>
          <NuxtLink to="/categories/create">
            <Plus class="size-4" />
            {{ t('categories_page.create') }}
        </NuxtLink>
        </Button>
      </div>

      <!-- Bulk Action Bar -->
      <div
        v-if="selectedCount > 0"
        class="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 flex-wrap"
      >
        <span class="text-sm font-medium text-primary">
          {{ t('categories_page.bulk_selected', { count: selectedCount }) }}
        </span>
        <div class="flex items-center gap-2 mr-auto">
          <Button
            v-if="canUpdate"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
            :disabled="bulkActionLoading"
            @click="openBulkConfirm('activate')"
          >
            <LoaderCircle v-if="bulkActionLoading" class="size-3.5 animate-spin" />
            <UserCheck v-else class="size-3.5" />
            {{ t('categories_page.bulk_activate') }}
          </Button>
          <Button
            v-if="canUpdate"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
            :disabled="bulkActionLoading"
            @click="openBulkConfirm('deactivate')"
          >
            <LoaderCircle v-if="bulkActionLoading" class="size-3.5 animate-spin" />
            <UserX v-else class="size-3.5" />
            {{ t('categories_page.bulk_deactivate') }}
          </Button>
          <Button
            v-if="canDestroy"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
            :disabled="bulkActionLoading"
            @click="bulkDeleteConfirmOpen = true"
          >
            <LoaderCircle v-if="bulkActionLoading" class="size-3.5 animate-spin" />
            <Trash2 v-else class="size-3.5" />
            {{ t('categories_page.bulk_delete') }}
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
    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader class="hidden md:table-header-group">
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <!-- Bulk Checkbox -->
            <TableHead class="w-10 text-center">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>

            <!-- Sortable: Arabic Name -->
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSortName"
            >
              <div class="flex items-center gap-1.5">
                {{ locale === 'ar' ? t('categories_page.col_name_ar') : t('categories_page.col_name_en') }}
                <ArrowUp v-if="isNameSortActive && sortOrder === 'asc'" class="size-3.5 text-primary" />
                <ArrowDown v-else-if="isNameSortActive && sortOrder === 'desc'" class="size-3.5 text-primary" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-start font-medium">{{ t('categories_page.col_parent') }}</TableHead>
            <TableHead class="text-start font-medium">{{ t('categories_page.col_description') }}</TableHead>

            <!-- Sortable: Status -->
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('status')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('categories_page.col_status') }}
                <ArrowUp v-if="sortBy === 'status' && sortOrder === 'asc'" class="size-3.5 text-primary" />
                <ArrowDown v-else-if="sortBy === 'status' && sortOrder === 'desc'" class="size-3.5 text-primary" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-start font-medium">{{ t('common.added_by') }}</TableHead>

            <!-- Sortable: Created At -->
            <TableHead
              class="text-end font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('created_at')"
            >
              <div class="flex items-center gap-1.5">
                {{ t('common.created_at') }}
                <ArrowUp v-if="sortBy === 'created_at' && sortOrder === 'asc'" class="size-3.5 text-primary" />
                <ArrowDown v-else-if="sortBy === 'created_at' && sortOrder === 'desc'" class="size-3.5 text-primary" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-end font-medium">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <!-- Loading -->
          <TableRow v-if="loading" class="md:table-row">
            <TableCell :colspan="8" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('categories_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <!-- Error -->
          <TableRow v-else-if="listLoadError" class="md:table-row">
            <TableCell :colspan="8" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadCategories()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <!-- Empty -->
          <TableRow v-else-if="categories.length === 0" class="md:table-row">
            <TableCell :colspan="8" class="py-14 text-center text-sm text-muted-foreground">
              {{
                search || hasActiveFilters
                  ? t('categories_page.no_results')
                  : t('categories_page.no_categories')
              }}
            </TableCell>
          </TableRow>

          <!-- Data Rows -->
          <TableRow
            v-for="cat in categories"
            v-else
            :key="cat.id"
            class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm
                   md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none
                   hover:bg-muted/30 transition-colors align-middle cursor-pointer md:cursor-default"
            :class="{ 'bg-muted/20': selectedIds.has(cat.id) }"
            @click="navigateRow(`/categories/show/${cat.id}`)"
          >
            <!-- Checkbox -->
            <TableCell class="flex items-center justify-between gap-2 py-1.5 border-b md:w-10 md:table-cell md:border-0 md:py-4" @click.stop>
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.select') }}</span>
              <Checkbox
                :model-value="selectedIds.has(cat.id)"
                class="md:mt-0.5 md:mx-4"
                @update:model-value="toggleSelect(cat.id)"
              />
            </TableCell>

            <!-- Name -->
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">
                {{ locale === 'ar' ? t('categories_page.col_name_ar') : t('categories_page.col_name_en') }}
              </span>
              <div class="font-medium text-start">
                <button
                  v-if="canShow"
                  type="button"
                  class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-start cursor-pointer"
                  @click="handleView(cat)"
                >
                  {{ categoryPrimaryName(cat) }}
                </button>
                <span v-else>{{ categoryPrimaryName(cat) }}</span>
              </div>
            </TableCell>

            <!-- Parent -->
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('categories_page.col_parent') }}</span>
              <span class="text-sm text-muted-foreground">
                {{ parentDisplay(cat) }}
              </span>
            </TableCell>

            <!-- Description (truncated to 5 words) -->
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('categories_page.col_description') }}</span>
              <span class="text-sm text-muted-foreground">
                {{ truncateDescription(cat.description) }}
              </span>
            </TableCell>

            <!-- Status Badge -->
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('categories_page.col_status') }}</span>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                :class="statusConfig(cat.status).class"
              >
                {{ statusConfig(cat.status).label }}
              </span>
            </TableCell>

            <!-- Created By -->
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.added_by') }}</span>
              <span class="text-sm text-muted-foreground">
                {{ authorDisplay(cat.created_by) }}
              </span>
            </TableCell>

            <!-- Created At -->
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.created_at') }}</span>
              <span class="text-sm text-muted-foreground tabular-nums">
                {{ formatDate(cat.created_at) }}
              </span>
            </TableCell>

            <!-- Actions -->
            <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end" @click.stop>
              <TableRowActions
                :actions="[
                  { key: `edit-${cat.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canUpdate, onClick: () => handleEdit(cat) },
                  { key: `deactivate-${cat.id}`, label: t('common.deactivate'), type: 'button', icon: UserX, tone: 'warning', visible: canUpdate && cat.status === 'active', disabled: togglingId === cat.id || deletingId === cat.id, loading: togglingId === cat.id, onClick: () => { categoryToDeactivate = cat } },
                  { key: `activate-${cat.id}`, label: t('common.activate'), type: 'button', icon: UserCheck, tone: 'success', visible: canUpdate && cat.status === 'inactive', disabled: togglingId === cat.id || deletingId === cat.id, loading: togglingId === cat.id, onClick: () => { categoryToActivate = cat } },
                  { key: `delete-${cat.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDestroy && cat.status !== 'deleted', disabled: deletingId === cat.id || togglingId === cat.id, loading: deletingId === cat.id, onClick: () => { categoryToDelete = cat } },
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
            t('categories_page.pagination', {
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
        <p class="text-xs text-muted-foreground">{{ t('categories_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>
  </div>

  <!-- ── Confirmation Dialogs ─────────────────────────────────────────────────── -->

  <!-- Delete Single -->
  <AlertDialog :open="!!categoryToDelete" @update:open="val => { if (!val) categoryToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('categories_page.delete_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right">
          {{ t('categories_page.delete_dialog_body', { name: categoryToDelete ? categoryPrimaryName(categoryToDelete) : '' }) }}
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
          {{ t('categories_page.confirm_yes_delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Deactivate Single -->
  <AlertDialog :open="!!categoryToDeactivate" @update:open="val => { if (!val) categoryToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('categories_page.deactivate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>
            {{ t('categories_page.deactivate_dialog_body', { name: categoryToDeactivate ? categoryPrimaryName(categoryToDeactivate) : '' }) }}
          </p>
          <p>{{ t('categories_page.deactivate_dialog_hint') }}</p>
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
          {{ t('categories_page.confirm_yes_deactivate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Activate Single -->
  <AlertDialog :open="!!categoryToActivate" @update:open="val => { if (!val) categoryToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('categories_page.activate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('categories_page.activate_dialog_body', { name: categoryToActivate ? categoryPrimaryName(categoryToActivate) : '' }) }}
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
          {{ t('categories_page.confirm_yes_activate') }}
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
              ? t('categories_page.bulk_activate_title')
              : t('categories_page.bulk_deactivate_title')
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            bulkConfirmType === 'activate'
              ? t('categories_page.bulk_activate_body', { count: selectedCount })
              : t('categories_page.bulk_deactivate_body', { count: selectedCount })
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
              ? t('categories_page.bulk_confirm_activate')
              : t('categories_page.bulk_confirm_deactivate')
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Bulk Delete -->
  <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="val => { bulkDeleteConfirmOpen = val }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('categories_page.bulk_delete_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('categories_page.bulk_delete_body', { count: selectedCount }) }}
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
          {{ t('categories_page.bulk_confirm_delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>


</template>
