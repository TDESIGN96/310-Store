<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search, Plus, Pencil, Trash2, Loader2, ShieldAlert,
  ChevronRight, ChevronLeft, LoaderCircle, Filter,
  Download, ArrowUp, ArrowDown, ArrowUpDown,
  UserX, UserCheck, X, FileSpreadsheet, Tag,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
import { fetchAllCategoriesPages, type CategoriesApi } from '@/utils/categoryList'

definePageMeta({ layout: 'default' })

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
const authStore = useAuthStore()

const categories = ref<CategoryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
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
      .sort((a, b) => String(a.name_ar || a.name_en).localeCompare(String(b.name_ar || b.name_en), 'ar'))
  }
  catch {
    parentsForFilter.value = []
  }
}

// ── API Loading ────────────────────────────────────────────────────────────────

const loadCategories = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.name = query
    }
    if (filterStatus.value !== 'all') params.status = filterStatus.value
    if (filterParentId.value !== 'all') params.parent_id = filterParentId.value
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
  catch (error: any) {
    errorMessage.value
      = error?.data?.message?.ar
      ?? error?.data?.message
      ?? 'تعذر تحميل قائمة التصنيفات حالياً'
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  catch {
    return dateStr
  }
}

const authorDisplay = (value?: CategoryAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const parentDisplay = (category: CategoryItem) => {
  if (!category.parent && !category.parent_id) return '—'
  if (category.parent) return category.parent.name_ar || category.parent.name_en || `#${category.parent.id}`
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
      return { label: 'نشط', class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' }
    case 'inactive':
      return { label: 'غير نشط', class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' }
    case 'deleted':
      return { label: 'محذوف', class: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' }
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
    toast.success(`تم حذف "${cat.name_ar}" بنجاح`)
    await loadCategories(currentPage.value)
  }
  catch (error: any) {
    const msg = error?.data?.message?.ar || error?.data?.message || 'تعذر حذف التصنيف حالياً'
    toast.error(msg)
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
    toast.success(`تم إيقاف التصنيف "${cat.name_ar}" بنجاح`)
    await loadCategories(currentPage.value)
  }
  catch (error: any) {
    const msg = error?.data?.message?.ar || error?.data?.message || 'تعذر إيقاف التصنيف حالياً'
    toast.error(msg)
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
    toast.success(`تم تفعيل التصنيف "${cat.name_ar}" بنجاح`)
    await loadCategories(currentPage.value)
  }
  catch (error: any) {
    const msg = error?.data?.message?.ar || error?.data?.message || 'تعذر تفعيل التصنيف حالياً'
    toast.error(msg)
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
  const label = type === 'activate' ? 'تفعيل' : 'إيقاف'

  try {
    const rows = ids
      .map(id => categories.value.find(c => c.id === id))
      .filter((c): c is CategoryItem => c != null)
    if (rows.length !== ids.length) {
      toast.error('تعذر تحديد بعض التصنيفات — أعد تحميل الصفحة وحاول مرة أخرى')
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
    toast.success(`تم ${label} ${ids.length} تصنيف بنجاح`)
    selectedIds.value = new Set()
    await loadCategories(currentPage.value)
  }
  catch (error: any) {
    const msg = error?.data?.message?.ar || error?.data?.message || `تعذر ${label} التصنيفات المحددة`
    toast.error(msg)
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
    toast.success(`تم حذف ${ids.length} تصنيف بنجاح`)
    selectedIds.value = new Set()
    await loadCategories(currentPage.value)
  }
  catch (error: any) {
    const msg = error?.data?.message?.ar || error?.data?.message || 'تعذر حذف التصنيفات المحددة'
    toast.error(msg)
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
    updated_by: authorDisplay(c.updated_by),
    created_at: formatDate(c.created_at),
    updated_at: formatDate(c.updated_at),
  }))

const exportHeaders = ['المعرف', 'الاسم العربي', 'الاسم الإنجليزي', 'التصنيف الأصلي', 'الوصف', 'الحالة', 'أُضيف بواسطة', 'آخر تعديل بواسطة', 'تاريخ الإنشاء', 'تاريخ التعديل']

const getExportRows = () =>
  buildExportRows(categories.value.filter(c => selectedIds.value.has(c.id)))
    .map(r => [r.id, r.name_ar, r.name_en, r.parent, r.description, r.status, r.created_by, r.updated_by, r.created_at, r.updated_at])

const exportCSV = () => {
  const rows = getExportRows()
  if (rows.length === 0) {
    toast.error('يرجى تحديد عنصر واحد على الأقل للتصدير')
    return
  }
  const csv = [exportHeaders, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `categories-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success('تم تصدير الملف CSV بنجاح')
}

const exportExcel = () => {
  const rows = getExportRows()
  if (rows.length === 0) {
    toast.error('يرجى تحديد عنصر واحد على الأقل للتصدير')
    return
  }
  const tableRows = [exportHeaders, ...rows]
    .map(row => `<tr>${row.map(cell => `<td>${String(cell ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`)
    .join('')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">`
    + `<head><meta charset="UTF-8"></head>`
    + `<body><table border="1">${tableRows}</table></body></html>`
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `categories-${new Date().toISOString().slice(0, 10)}.xls`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success('تم تصدير الملف Excel بنجاح')
}

// ── Permissions ────────────────────────────────────────────────────────────────

const canCreate = authStore.hasPermission('categories.store')
const canUpdate = authStore.hasPermission('categories.update')
const canDestroy = authStore.hasPermission('categories.destroy')
const canShow = authStore.hasPermission('categories.show')

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
        <h1 class="text-2xl font-bold tracking-tight">إدارة التصنيفات</h1>
        <p class="text-sm text-muted-foreground mt-1">
          عرض وإدارة تصنيفات المنتجات
        </p>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Search -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            placeholder="ابحث بالاسم العربي أو الإنجليزي..."
            class="pr-9 h-9"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
          />
        </div>

        <!-- Status Filter -->
        <Select :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-[min(100%,11rem)] h-9">
            <Filter class="size-3.5 shrink-0 text-muted-foreground ml-1" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
          </SelectContent>
        </Select>

        <!-- Parent Category Filter -->
        <Select :model-value="filterParentId" @update:model-value="onParentFilterChange">
          <SelectTrigger class="w-[min(100%,13rem)] h-9">
            <Tag class="size-3.5 shrink-0 text-muted-foreground ml-1" />
            <SelectValue placeholder="التصنيف الأصلي" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            <SelectItem
              v-for="parent in parentsForFilter"
              :key="parent.id"
              :value="String(parent.id)"
            >
              {{ parent.name_ar || parent.name_en }}
            </SelectItem>
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
          مسح الفلاتر
        </Button>

        <!-- Export Buttons -->
        <Button variant="outline" size="sm" class="h-9 gap-2" @click="exportCSV">
          <Download class="size-3.5" />
          CSV
        </Button>
        <Button variant="outline" size="sm" class="h-9 gap-2" @click="exportExcel">
          <FileSpreadsheet class="size-3.5" />
          Excel
        </Button>

        <div class="flex-1" />

        <Button v-if="canCreate" class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
          <NuxtLink to="/categories/create">
            <Plus class="size-4" />
            إنشاء تصنيف
          </NuxtLink>
        </Button>
      </div>

      <!-- Bulk Action Bar -->
      <div
        v-if="selectedCount > 0"
        class="flex items-center gap-3 rounded-lg border border-[#215260]/30 bg-[#215260]/5 px-4 py-2.5 flex-wrap"
      >
        <span class="text-sm font-medium text-[#215260]">
          تم تحديد {{ selectedCount }} تصنيف
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
            تفعيل المحدد
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
            إيقاف المحدد
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
            حذف المحدد
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-muted-foreground"
            @click="selectedIds = new Set()"
          >
            إلغاء التحديد
          </Button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <!-- Bulk Checkbox -->
            <TableHead class="w-10 text-right">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>

            <!-- Sortable: Arabic Name -->
            <TableHead
              class="text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('name_ar')"
            >
              <div class="flex items-center gap-1.5">
                الاسم العربي
                <ArrowUp v-if="sortBy === 'name_ar' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'name_ar' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <!-- Sortable: English Name -->
            <TableHead
              class="text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('name_en')"
            >
              <div class="flex items-center gap-1.5">
                الاسم الإنجليزي
                <ArrowUp v-if="sortBy === 'name_en' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'name_en' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-right font-medium">التصنيف الأصلي</TableHead>
            <TableHead class="text-right font-medium">الوصف</TableHead>

            <!-- Sortable: Status -->
            <TableHead
              class="text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('status')"
            >
              <div class="flex items-center gap-1.5">
                الحالة
                <ArrowUp v-if="sortBy === 'status' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'status' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-right font-medium">أُضيف بواسطة</TableHead>
            <TableHead class="text-right font-medium">آخر تعديل بواسطة</TableHead>

            <!-- Sortable: Created At -->
            <TableHead
              class="text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('created_at')"
            >
              <div class="flex items-center gap-1.5">
                تاريخ الإنشاء
                <ArrowUp v-if="sortBy === 'created_at' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'created_at' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

            <TableHead class="text-right font-medium">آخر تحديث</TableHead>
            <TableHead class="text-right font-medium">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <!-- Loading -->
          <TableRow v-if="loading">
            <TableCell :colspan="11" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                جاري تحميل التصنيفات...
              </div>
            </TableCell>
          </TableRow>

          <!-- Error -->
          <TableRow v-else-if="errorMessage">
            <TableCell :colspan="11" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <span>{{ errorMessage }}</span>
                <Button variant="outline" size="sm" @click="loadCategories()">
                  إعادة المحاولة
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <!-- Empty -->
          <TableRow v-else-if="categories.length === 0">
            <TableCell :colspan="11" class="py-14 text-center text-sm text-muted-foreground">
              {{
                search || hasActiveFilters
                  ? 'لا توجد نتائج مطابقة للبحث أو الفلاتر'
                  : 'لا توجد تصنيفات مضافة حتى الآن'
              }}
            </TableCell>
          </TableRow>

          <!-- Data Rows -->
          <TableRow
            v-for="cat in categories"
            v-else
            :key="cat.id"
            class="hover:bg-muted/30 transition-colors"
            :class="{ 'bg-muted/20': selectedIds.has(cat.id) }"
          >
            <!-- Checkbox -->
            <TableCell class="w-10">
              <Checkbox
                :model-value="selectedIds.has(cat.id)"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelect(cat.id)"
              />
            </TableCell>

            <!-- Arabic Name (clickable → view) -->
            <TableCell class="font-medium">
              <button
                v-if="canShow"
                type="button"
                class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-right"
                @click="handleView(cat)"
              >
                {{ cat.name_ar }}
              </button>
              <span v-else>{{ cat.name_ar }}</span>
            </TableCell>

            <!-- English Name -->
            <TableCell class="text-sm text-muted-foreground">
              {{ cat.name_en || '—' }}
            </TableCell>

            <!-- Parent -->
            <TableCell class="text-sm text-muted-foreground">
              {{ parentDisplay(cat) }}
            </TableCell>

            <!-- Description (truncated to 5 words) -->
            <TableCell class="text-sm text-muted-foreground max-w-[180px]">
              {{ truncateDescription(cat.description) }}
            </TableCell>

            <!-- Status Badge -->
            <TableCell>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                :class="statusConfig(cat.status).class"
              >
                {{ statusConfig(cat.status).label }}
              </span>
            </TableCell>

            <!-- Created By -->
            <TableCell class="text-sm text-muted-foreground">
              {{ authorDisplay(cat.created_by) }}
            </TableCell>

            <!-- Updated By -->
            <TableCell class="text-sm text-muted-foreground">
              {{ authorDisplay(cat.updated_by) }}
            </TableCell>

            <!-- Created At -->
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(cat.created_at) }}
            </TableCell>

            <!-- Updated At -->
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(cat.updated_at) }}
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <!-- Edit -->
                <button
                  v-if="canUpdate"
                  type="button"
                  class="inline-flex items-center gap-1 text-[#2563eb] hover:underline"
                  @click="handleEdit(cat)"
                >
                  <Pencil class="size-3.5" />
                  تعديل
                </button>

                <!-- Deactivate -->
                <button
                  v-if="canUpdate && cat.status === 'active'"
                  type="button"
                  class="inline-flex items-center gap-1 text-amber-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="togglingId === cat.id || deletingId === cat.id"
                  @click="categoryToDeactivate = cat"
                >
                  <LoaderCircle v-if="togglingId === cat.id" class="size-3.5 animate-spin" />
                  <UserX v-else class="size-3.5" />
                  إيقاف
                </button>

                <!-- Activate -->
                <button
                  v-else-if="canUpdate && cat.status === 'inactive'"
                  type="button"
                  class="inline-flex items-center gap-1 text-green-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="togglingId === cat.id || deletingId === cat.id"
                  @click="categoryToActivate = cat"
                >
                  <LoaderCircle v-if="togglingId === cat.id" class="size-3.5 animate-spin" />
                  <UserCheck v-else class="size-3.5" />
                  تفعيل
                </button>

                <!-- Delete -->
                <button
                  v-if="canDestroy && cat.status !== 'deleted'"
                  type="button"
                  class="inline-flex items-center gap-1 text-red-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="deletingId === cat.id || togglingId === cat.id"
                  @click="categoryToDelete = cat"
                >
                  <LoaderCircle v-if="deletingId === cat.id" class="size-3.5 animate-spin" />
                  <Trash2 v-else class="size-3.5" />
                  حذف
                </button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">
          عرض {{ (currentPage - 1) * pagination.per_page + 1 }}–{{ Math.min(currentPage * pagination.per_page, pagination.total) }} من إجمالي {{ pagination.total }} تصنيف
        </p>
        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="currentPage <= 1 || loading"
            @click="goToPage(currentPage - 1)"
          >
            <ChevronRight class="size-4" />
          </Button>
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
          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="currentPage >= pagination.last_page || loading"
            @click="goToPage(currentPage + 1)"
          >
            <ChevronLeft class="size-4" />
          </Button>
        </div>
      </div>
      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">إجمالي {{ pagination.total }} تصنيف</p>
      </div>
    </div>
  </div>

  <!-- ── Confirmation Dialogs ─────────────────────────────────────────────────── -->

  <!-- Delete Single -->
  <AlertDialog :open="!!categoryToDelete" @update:open="val => { if (!val) categoryToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
        <AlertDialogDescription>
          هل أنت متأكد من حذف التصنيف
          <span class="font-semibold text-foreground">{{ categoryToDelete?.name_ar }}</span>؟
          لا يمكن التراجع عن هذا الإجراء.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="!!deletingId"
          @click="confirmDelete"
        >
          <LoaderCircle v-if="deletingId" class="size-4 animate-spin ml-2" />
          نعم، احذف
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Deactivate Single -->
  <AlertDialog :open="!!categoryToDeactivate" @update:open="val => { if (!val) categoryToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد إيقاف التصنيف</AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>
            هل أنت متأكد من إيقاف التصنيف
            <span class="font-semibold text-foreground">{{ categoryToDeactivate?.name_ar }}</span>؟
          </p>
          <p>يمكنك تفعيله مجدداً في أي وقت من نفس القائمة.</p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          class="bg-amber-600 hover:bg-amber-700 text-white"
          :disabled="!!togglingId"
          @click="confirmDeactivate"
        >
          <LoaderCircle v-if="togglingId" class="size-4 animate-spin ml-2" />
          نعم، أوقف
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Activate Single -->
  <AlertDialog :open="!!categoryToActivate" @update:open="val => { if (!val) categoryToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد تفعيل التصنيف</AlertDialogTitle>
        <AlertDialogDescription>
          هل أنت متأكد من تفعيل التصنيف
          <span class="font-semibold text-foreground">{{ categoryToActivate?.name_ar }}</span>؟
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          class="bg-green-600 hover:bg-green-700 text-white"
          :disabled="!!togglingId"
          @click="confirmActivate"
        >
          <LoaderCircle v-if="togglingId" class="size-4 animate-spin ml-2" />
          نعم، فعّل
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
          {{ bulkConfirmType === 'activate' ? 'تأكيد التفعيل الجماعي' : 'تأكيد الإيقاف الجماعي' }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            bulkConfirmType === 'activate'
              ? `هل أنت متأكد من تفعيل ${selectedCount} تصنيف محدد؟`
              : `هل أنت متأكد من إيقاف ${selectedCount} تصنيف محدد؟ يمكنك تفعيلها مجدداً لاحقاً.`
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          :class="bulkConfirmType === 'activate' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'"
          :disabled="bulkActionLoading"
          @click="confirmBulkAction"
        >
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin ml-2" />
          {{ bulkConfirmType === 'activate' ? 'نعم، فعّل الجميع' : 'نعم، أوقف الجميع' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Bulk Delete -->
  <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="val => { bulkDeleteConfirmOpen = val }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
        <AlertDialogDescription>
          هل أنت متأكد من حذف {{ selectedCount }} تصنيف محدد؟ لا يمكن التراجع عن هذا الإجراء.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="bulkActionLoading"
          @click="confirmBulkDelete"
        >
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin ml-2" />
          نعم، احذف الجميع
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>


</template>
