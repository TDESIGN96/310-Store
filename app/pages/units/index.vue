<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search, Plus, Pencil, Trash2, Loader2, ShieldAlert,
  ChevronRight, ChevronLeft, LoaderCircle, Filter,
  Eye, Download, ArrowUp, ArrowDown, ArrowUpDown,
  UserX, UserCheck, X, FileSpreadsheet,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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

definePageMeta({ layout: 'default' })

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

const units = ref<UnitItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pagination = ref<UnitsPagination | null>(null)
const currentPage = ref(1)

// Search & Filters
const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Sorting
const sortBy = ref<SortField | ''>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

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
  errorMessage.value = ''
  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.name = query
    }
    if (filterStatus.value !== 'all') params.status = filterStatus.value
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
  catch (error: any) {
    errorMessage.value
      = error?.data?.message?.ar
      ?? error?.data?.message
      ?? 'تعذر تحميل قائمة الوحدات حالياً'
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

const authorDisplay = (value?: UnitAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
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
    toast.success(`تم حذف "${unit.name_ar}" بنجاح`)
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    toast.error(error?.data?.message?.ar ?? error?.data?.message ?? 'تعذر حذف الوحدة حالياً')
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
    toast.success(`تم إيقاف الوحدة "${unit.name_ar}" بنجاح`)
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      'تعذر إيقاف الوحدة حالياً'
    toast.error(msg)
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
    toast.success(`تم تفعيل الوحدة "${unit.name_ar}" بنجاح`)
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      'تعذر تفعيل الوحدة حالياً'
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
      .map(id => units.value.find(u => u.id === id))
      .filter((u): u is UnitItem => u != null)
    if (rows.length !== ids.length) {
      toast.error('تعذر تحديد بعض الوحدات المحددة — أعد تحميل الصفحة وحاول مرة أخرى')
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
    toast.success(`تم ${label} ${ids.length} وحدة بنجاح`)
    selectedIds.value = new Set()
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      `تعذر ${label} الوحدات المحددة`
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
    await Promise.all(ids.map(id => $api(`/units/${id}`, { method: 'DELETE' })))
    toast.success(`تم حذف ${ids.length} وحدة بنجاح`)
    selectedIds.value = new Set()
    await loadUnits(currentPage.value)
  }
  catch (error: any) {
    toast.error(error?.data?.message?.ar ?? error?.data?.message ?? 'تعذر حذف الوحدات المحددة')
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
    updated_by: authorDisplay(u.updated_by),
    created_at: formatDate(u.created_at),
    updated_at: formatDate(u.updated_at),
  }))

const exportCSV = () => {
  const selectedUnits = units.value.filter(u => selectedIds.value.has(u.id))
  if (selectedUnits.length === 0) {
    toast.error('يرجى تحديد عنصر واحد على الأقل للتصدير')
    return
  }
  const headers = ['المعرف', 'الاسم العربي', 'الاسم الإنجليزي', 'الرمز', 'الحالة', 'أُضيف بواسطة', 'آخر تعديل بواسطة', 'تاريخ الإنشاء', 'تاريخ التعديل']
  const rows = buildExportRows(selectedUnits).map(r => [
    r.id, r.name_ar, r.name_en, r.symbol, r.status,
    r.created_by, r.updated_by, r.created_at, r.updated_at,
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
  toast.success('تم تصدير الملف CSV بنجاح')
}

const exportExcel = () => {
  const selectedUnits = units.value.filter(u => selectedIds.value.has(u.id))
  if (selectedUnits.length === 0) {
    toast.error('يرجى تحديد عنصر واحد على الأقل للتصدير')
    return
  }
  const headers = ['المعرف', 'الاسم العربي', 'الاسم الإنجليزي', 'الرمز', 'الحالة', 'أُضيف بواسطة', 'آخر تعديل بواسطة', 'تاريخ الإنشاء', 'تاريخ التعديل']
  const rows = buildExportRows(selectedUnits).map(r => [
    r.id, r.name_ar, r.name_en, r.symbol, r.status,
    r.created_by, r.updated_by, r.created_at, r.updated_at,
  ])

  // Build HTML table that Excel can open natively
  const tableRows = [headers, ...rows]
    .map(row => `<tr>${row.map(cell => `<td>${String(cell ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`)
    .join('')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">`
    + `<head><meta charset="UTF-8"></head>`
    + `<body><table border="1">${tableRows}</table></body></html>`

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `units-${new Date().toISOString().slice(0, 10)}.xls`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success('تم تصدير الملف Excel بنجاح')
}

onMounted(() => loadUnits())
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">إدارة الوحدات</h1>
        <p class="text-sm text-muted-foreground mt-1">
          عرض وإدارة وحدات القياس المستخدمة في النظام
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
            placeholder="ابحث بالاسم أو الرمز..."
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
        <Button class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
        <NuxtLink to="/units/create">
          <Plus class="size-4" />
          إنشاء وحدة
        </NuxtLink>
      </Button>
      </div>

      <!-- Bulk Action Bar (visible when items are selected) -->
      <div
        v-if="selectedCount > 0"
        class="flex items-center gap-3 rounded-lg border border-[#215260]/30 bg-[#215260]/5 px-4 py-2.5 flex-wrap"
      >
        <span class="text-sm font-medium text-[#215260]">
          تم تحديد {{ selectedCount }} وحدة
        </span>
        <div class="flex items-center gap-2 mr-auto">
          <Button
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
    <div class="rounded-lg border overflow-hidden ">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40 ">
            <!-- Bulk Checkbox -->
            <TableHead class="w-10 text-right ">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>

            <!-- Sortable Columns -->
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

            <TableHead
              class="text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('symbol')"
            >
              <div class="flex items-center gap-1.5">
                الرمز
                <ArrowUp v-if="sortBy === 'symbol' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                <ArrowDown v-else-if="sortBy === 'symbol' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
              </div>
            </TableHead>

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
          <TableRow v-if="loading" >
            <TableCell :colspan="10" class="py-14 text-center ">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground ">
                <Loader2 class="size-4 animate-spin" />
                جاري تحميل الوحدات...
              </div>
            </TableCell>
          </TableRow>

          <!-- Error -->
          <TableRow v-else-if="errorMessage">
            <TableCell :colspan="10" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <span>{{ errorMessage }}</span>
                <Button variant="outline" size="sm" @click="loadUnits()">
                  إعادة المحاولة
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <!-- Empty -->
          <TableRow v-else-if="units.length === 0">
            <TableCell :colspan="10" class="py-14 text-center text-sm text-muted-foreground">
              {{
                search || hasActiveFilters
                  ? 'لا توجد نتائج مطابقة للبحث أو الفلاتر'
                  : 'لا توجد وحدات مضافة حتى الآن'
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
                type="button"
                class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-right"
                @click="handleView(unit)"
              >
                {{ unit.name_ar }}
              </button>
            </TableCell>

            <!-- English Name -->
            <TableCell class="text-sm text-muted-foreground">
              {{ unit.name_en || '—' }}
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

            <!-- Updated By -->
            <TableCell class="text-sm text-muted-foreground">
              {{ authorDisplay(unit.updated_by) }}
            </TableCell>

            <!-- Created At -->
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(unit.created_at) }}
            </TableCell>

            <!-- Updated At -->
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(unit.updated_at) }}
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <div class="flex flex-wrap items-center gap-3 text-sm">
               
                <!-- Edit -->
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-[#2563eb] hover:underline"
                  @click="handleEdit(unit)"
                >
                  <Pencil class="size-3.5" />
                  تعديل
                </button>

                <!-- Deactivate -->
                <button
                  v-if="unit.status === 'active'"
                  type="button"
                  class="inline-flex items-center gap-1 text-amber-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="togglingId === unit.id || deletingId === unit.id"
                  @click="unitToDeactivate = unit"
                >
                  <LoaderCircle v-if="togglingId === unit.id" class="size-3.5 animate-spin" />
                  <UserX v-else class="size-3.5" />
                  إيقاف
                </button>

                <!-- Activate -->
                <button
                  v-else-if="unit.status === 'inactive'"
                  type="button"
                  class="inline-flex items-center gap-1 text-green-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="togglingId === unit.id || deletingId === unit.id"
                  @click="unitToActivate = unit"
                >
                  <LoaderCircle v-if="togglingId === unit.id" class="size-3.5 animate-spin" />
                  <UserCheck v-else class="size-3.5" />
                  تفعيل
                </button>

                <!-- Delete -->
                <button
                  v-if="unit.status !== 'deleted'"
                  type="button"
                  class="inline-flex items-center gap-1 text-red-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="deletingId === unit.id || togglingId === unit.id"
                  @click="unitToDelete = unit"
                >
                  <LoaderCircle v-if="deletingId === unit.id" class="size-3.5 animate-spin" />
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
          عرض {{ (currentPage - 1) * pagination.per_page + 1 }}–{{ Math.min(currentPage * pagination.per_page, pagination.total) }} من إجمالي {{ pagination.total }} وحدة
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
        <p class="text-xs text-muted-foreground">إجمالي {{ pagination.total }} وحدة</p>
      </div>
    </div>
  </div>

  <!-- ── Confirmation Dialogs ─────────────────────────────────────────────────── -->

  <!-- Delete Single -->
  <AlertDialog :open="!!unitToDelete" @update:open="val => { if (!val) unitToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
        <AlertDialogDescription>
          هل أنت متأكد من حذف الوحدة
          <span class="font-semibold text-foreground">{{ unitToDelete?.name_ar }}</span>؟
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
  <AlertDialog :open="!!unitToDeactivate" @update:open="val => { if (!val) unitToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد إيقاف الوحدة</AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>
            هل أنت متأكد من إيقاف الوحدة
            <span class="font-semibold text-foreground">{{ unitToDeactivate?.name_ar }}</span>؟
          </p>
          <p>يمكنك تفعيلها مجدداً في أي وقت من نفس القائمة.</p>
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
  <AlertDialog :open="!!unitToActivate" @update:open="val => { if (!val) unitToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد تفعيل الوحدة</AlertDialogTitle>
        <AlertDialogDescription>
          هل أنت متأكد من تفعيل الوحدة
          <span class="font-semibold text-foreground">{{ unitToActivate?.name_ar }}</span>؟
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
              ? `هل أنت متأكد من تفعيل ${selectedCount} وحدة محددة؟`
              : `هل أنت متأكد من إيقاف ${selectedCount} وحدة محددة؟ يمكنك تفعيلها مجدداً لاحقاً.`
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
          هل أنت متأكد من حذف {{ selectedCount }} وحدة محددة؟ لا يمكن التراجع عن هذا الإجراء.
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
