<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search,
  Plus,
  Loader2,
  ShieldAlert,
  Package,
  Pencil,
  Trash2,
  Filter,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { normalizeApiLocale } from '@/utils/apiLocale'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { navigateRow } = useMobileRowNavigate()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const config = useRuntimeConfig()
const authStore = useAuthStore()
const { canCreate: canCreateProd, canEdit: canEditProd, canDelete: canDeleteProd, can: canPerm } = usePermissions()
const isDistributorUser = computed(() => Boolean(authStore.user?.is_distributor))
const canCreateProduct = computed(() => !isDistributorUser.value && canCreateProd('products'))
const canShowProduct = computed(() => !isDistributorUser.value && canPerm('products.show'))
const canEditProduct = computed(() => !isDistributorUser.value && canEditProd('products'))
const canDeleteProduct = computed(() => !isDistributorUser.value && canDeleteProd('products'))
const canSelectProductsForDelete = computed(() => canDeleteProduct.value)

interface Pagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface CategoryFilterItem {
  id: number
  name_ar: string
  name_en: string
  status?: string
}

interface WarehouseFilterItem {
  id: number
  name_ar: string
  name_en: string
  status: string
}

interface ProductAuthor {
  id: number
  name?: string
  email?: string
}

interface WarehousesListResponse {
  data?: { warehouses?: WarehouseFilterItem[]; pagination?: Pagination }
  warehouses?: WarehouseFilterItem[]
  pagination?: Pagination
}

interface ProductRow {
  id: number
  name: string
  categoryLabel: string
  qty: number
  variationsCount: number
  isIncomplete: boolean
  productType: 'single' | 'combo' | 'unknown'
  createdBy?: ProductAuthor | number | null
  canBeDeleted: boolean
}

interface ProductsResponse {
  status?: string
  status_code?: number
  data?: unknown
  products?: unknown[]
  pagination?: Pagination
  message?: string | null
}

function extractList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const d = payload as Record<string, unknown>
  if (Array.isArray(d.products)) return d.products
  if (Array.isArray(d.data)) return d.data
  const inner = d.data
  if (inner && typeof inner === 'object') {
    const o = inner as Record<string, unknown>
    if (Array.isArray(o.products)) return o.products
    if (Array.isArray(o.data)) return o.data
  }
  return []
}

function isPagination(p: unknown): p is Pagination {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.current_page === 'number' && typeof o.last_page === 'number'
}

function extractPagination(payload: unknown): Pagination | null {
  if (!payload || typeof payload !== 'object') return null
  const d = payload as Record<string, unknown>
  const inner = d.data
  const nested =
    (inner && typeof inner === 'object' ? (inner as { pagination?: unknown }).pagination : undefined)
    ?? d.pagination
  if (isPagination(nested)) return nested
  return null
}

function isWarehouseActive(warehouse: Record<string, unknown> | null | undefined): boolean {
  if (!warehouse || typeof warehouse !== 'object') return true
  const s = String(warehouse.status ?? 'active').toLowerCase()
  return s === 'active'
}

function warehouseDisplayName(warehouse: Record<string, unknown>, loc: string): string {
  if (loc === 'ar') {
    if (typeof warehouse.name_ar === 'string' && warehouse.name_ar.trim()) return warehouse.name_ar.trim()
    if (typeof warehouse.name === 'string' && warehouse.name.trim()) return warehouse.name.trim()
    if (typeof warehouse.name_en === 'string' && warehouse.name_en.trim()) return warehouse.name_en.trim()
    return '—'
  }
  if (typeof warehouse.name_en === 'string' && warehouse.name_en.trim()) return warehouse.name_en.trim()
  if (typeof warehouse.name === 'string' && warehouse.name.trim()) return warehouse.name.trim()
  if (typeof warehouse.name_ar === 'string' && warehouse.name_ar.trim()) return warehouse.name_ar.trim()
  return '—'
}

function extractWarehousePivotList(raw: Record<string, unknown>): Array<{ warehouse: Record<string, unknown>; qty: number }> {
  const candidates = [raw.warehouses, raw.product_warehouses, raw.stocks, raw.inventories, raw.inventory]
  let arr: unknown[] | null = null
  for (const c of candidates) {
    if (Array.isArray(c)) {
      arr = c
      break
    }
  }
  if (!arr?.length) return []

  const out: Array<{ warehouse: Record<string, unknown>; qty: number }> = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const wh = (row.warehouse && typeof row.warehouse === 'object'
      ? row.warehouse
      : row) as Record<string, unknown>
    if (!isWarehouseActive(wh)) continue
    const pivot = row.pivot && typeof row.pivot === 'object' ? (row.pivot as Record<string, unknown>) : row
    const qty = Number(pivot.quantity ?? pivot.qty ?? row.quantity ?? row.qty ?? row.stock ?? 0)
    out.push({ warehouse: wh, qty: Number.isFinite(qty) ? qty : 0 })
  }
  return out
}

function deriveWarehouseAndQty(
  rows: Array<{ warehouse: Record<string, unknown>; qty: number }>,
  loc: string,
  multipleLabel: string,
): { warehouseLabel: string; qty: number } {
  if (rows.length === 0) return { warehouseLabel: '—', qty: 0 }
  if (rows.length === 1) {
    const only = rows[0]!
    return { warehouseLabel: warehouseDisplayName(only.warehouse, loc), qty: only.qty }
  }
  const total = rows.reduce((s, r) => s + r.qty, 0)
  return { warehouseLabel: multipleLabel, qty: total }
}

function categoryLabelFromProduct(raw: Record<string, unknown>, loc: string): string {
  const cat = raw.category
  if (typeof cat === 'string') return cat
  if (cat && typeof cat === 'object') {
    const c = cat as Record<string, unknown>
    if (loc === 'ar' && typeof c.name_ar === 'string' && c.name_ar.trim()) return c.name_ar
    if (typeof c.name_en === 'string' && c.name_en.trim()) return c.name_en
    if (typeof c.name === 'string' && c.name.trim()) return c.name
  }
  if (loc === 'ar' && typeof raw.category_name_ar === 'string' && raw.category_name_ar.trim())
    return raw.category_name_ar
  if (loc === 'en' && typeof raw.category_name_en === 'string' && raw.category_name_en.trim())
    return raw.category_name_en
  const fallback = raw.category_name ?? raw.categoryName
  return typeof fallback === 'string' ? fallback : '—'
}

/** Stored/display name exactly as from API `name` when present. */
function productDisplayName(raw: Record<string, unknown>, loc: string): string {
  if (loc === 'ar') {
    if (typeof raw.name_ar === 'string' && raw.name_ar.trim()) return raw.name_ar
    if (typeof raw.name === 'string' && raw.name.trim()) return raw.name
    if (typeof raw.title === 'string' && raw.title.trim()) return raw.title
    if (typeof raw.name_en === 'string' && raw.name_en.trim()) return raw.name_en
    return '—'
  }
  if (typeof raw.name_en === 'string' && raw.name_en.trim()) return raw.name_en
  if (typeof raw.name === 'string' && raw.name.trim()) return raw.name
  if (typeof raw.title === 'string' && raw.title.trim()) return raw.title
  if (typeof raw.name_ar === 'string' && raw.name_ar.trim()) return raw.name_ar
  return '—'
}

function variationRows(raw: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(raw.variations)) return []
  return raw.variations.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
}

function totalStockFromVariations(rows: Array<Record<string, unknown>>): number {
  return rows.reduce((sum, v) => sum + Number(v.stock_quantity ?? 0), 0)
}

function normalizeProductRow(raw: Record<string, unknown>, loc: string, multipleWh: string): ProductRow | null {
  const id = raw.id
  const numId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : Number.NaN
  if (!Number.isFinite(numId)) return null

  const pivots = extractWarehousePivotList(raw)
  const variationList = variationRows(raw)
  const variationsQty = totalStockFromVariations(variationList)
  const { qty: fallbackQty } = deriveWarehouseAndQty(pivots, loc, multipleWh)

  const isComboRaw = raw.is_combo ?? raw.isCombo ?? raw.product_type
  let productType: ProductRow['productType'] = 'single'
  if (
    isComboRaw === true
    || isComboRaw === 1
    || isComboRaw === '1'
    || (typeof isComboRaw === 'string' && isComboRaw.toLowerCase() === 'true')
    || (typeof isComboRaw === 'string' && isComboRaw.toLowerCase() === 'combo')
  ) {
    productType = 'combo'
  }
  else if (typeof isComboRaw === 'string' && isComboRaw.toLowerCase() === 'unknown') {
    productType = 'unknown'
  }

  return {
    id: numId,
    name: productDisplayName(raw, loc),
    categoryLabel: categoryLabelFromProduct(raw, loc),
    qty: variationList.length ? variationsQty : fallbackQty,
    variationsCount: variationList.length,
    isIncomplete: raw.is_incomplete === true || raw.is_incomplete === 1 || raw.is_incomplete === '1',
    productType,
    createdBy: (raw.created_by ?? raw.createdBy ?? null) as ProductRow['createdBy'],
    canBeDeleted: raw.can_be_deleted === true || raw.can_be_deleted === 1 || raw.can_be_deleted === '1',
  }
}

const createdByDisplay = (value?: ProductRow['createdBy']) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const rows = ref<ProductRow[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('products_page')
const pagination = ref<Pagination | null>(null)
const currentPage = ref(1)

const search = ref('')
const filterCategoryId = ref<string>('all')
const filterWarehouseId = ref<string>('all')
const categoryOptions = ref<CategoryFilterItem[]>([])
const warehouseOptions = ref<WarehouseFilterItem[]>([])
const loadingFilters = ref(false)

const deleteDialogOpen = ref(false)
const deleteTarget = ref<ProductRow | null>(null)
const deleting = ref(false)
const selectedIds = ref<Set<number>>(new Set())
const bulkDeleteConfirmOpen = ref(false)
const bulkDeleteLoading = ref(false)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(
  () => filterCategoryId.value !== 'all' || filterWarehouseId.value !== 'all' || search.value.trim().length > 0,
)
const isAllSelected = computed(
  () => rows.value.length > 0 && rows.value.every(row => selectedIds.value.has(row.id)),
)
const isIndeterminate = computed(
  () => rows.value.some(row => selectedIds.value.has(row.id)) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)

const toggleSelectAll = () => {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) rows.value.forEach(row => next.delete(row.id))
  else rows.value.forEach(row => next.add(row.id))
  selectedIds.value = next
}

const toggleSelect = (id: number) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const { bindRow } = useLongPressSelect()

const categoryLabel = (c: CategoryFilterItem) =>
  locale.value === 'ar' ? c.name_ar || c.name_en : c.name_en || c.name_ar

const warehouseLabel = (w: WarehouseFilterItem) =>
  locale.value === 'ar' ? w.name_ar || w.name_en : w.name_en || w.name_ar

async function loadFilterOptions() {
  loadingFilters.value = true
  try {
    const [cats, whRes] = await Promise.all([
      fetchAllCategoriesPages<CategoryFilterItem>($api as CategoriesApi, { status: 'active' }).catch(() => []),
      $api<WarehousesListResponse>('/warehouses', { params: { page: 1, per_page: 100, status: 'active' } }).catch(
        (): WarehousesListResponse => ({}),
      ),
    ])
    categoryOptions.value = cats.filter((c: CategoryFilterItem) =>
      String(c.status ?? 'active').toLowerCase() === 'active',
    )
    const whList = whRes.data?.warehouses ?? whRes.warehouses ?? []
    warehouseOptions.value = whList.filter((w: WarehouseFilterItem) =>
      String(w.status ?? 'active').toLowerCase() === 'active',
    )
  }
  catch {
    categoryOptions.value = []
    warehouseOptions.value = []
  }
  finally {
    loadingFilters.value = false
  }
}

const loadProducts = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()
  try {
    const multipleWh = t('products_page.multiple_warehouses')
    const loc = locale.value === 'ar' ? 'ar' : 'en'

    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.name = query
    }
    if (filterCategoryId.value !== 'all') {
      params['filters[0][column]'] = 'category_id'
      params['filters[0][value]'] = filterCategoryId.value
      params['filters[0][condition]'] = '='
      params['filters[0][operator]'] = 'and'
    }
    if (filterWarehouseId.value !== 'all') {
      params['filters[1][column]'] = 'warehouse_id'
      params['filters[1][value]'] = filterWarehouseId.value
      params['filters[1][condition]'] = '='
      params['filters[1][operator]'] = 'and'
    }

    const data = await $api<ProductsResponse>('/products', { params })
    const list = extractList(data)
    const parsed: ProductRow[] = []
    for (const item of list) {
      if (item && typeof item === 'object') {
        const row = normalizeProductRow(item as Record<string, unknown>, loc, multipleWh)
        if (row) parsed.push(row)
      }
    }
    rows.value = parsed
    pagination.value = extractPagination(data)
    currentPage.value = pagination.value?.current_page ?? page
    selectedIds.value = new Set()
  }
  catch (error: unknown) {
    setListLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

function resetPageAndLoad() {
  currentPage.value = 1
  loadProducts(1, search.value.trim())
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadProducts(page)
}

watch(search, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadProducts(1, search.value.trim())
  }, 450)
})

watch(locale, async () => {
  await loadFilterOptions()
  await loadProducts(currentPage.value, search.value.trim())
})

function clearFilters() {
  search.value = ''
  filterCategoryId.value = 'all'
  filterWarehouseId.value = 'all'
  loadProducts(1, '')
}

function onCategoryFilterChange(value: unknown) {
  filterCategoryId.value = value != null && value !== '' ? String(value) : 'all'
  resetPageAndLoad()
}

function onWarehouseFilterChange(value: unknown) {
  filterWarehouseId.value = value != null && value !== '' ? String(value) : 'all'
  resetPageAndLoad()
}

function openDelete(row: ProductRow) {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value || !canDeleteProduct.value) return
  deleting.value = true
  try {
    const id = deleteTarget.value.id
    const base = config.public.apiBase as string
    await $fetch(`${base.replace(/\/$/, '')}/products/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
        Accept: 'application/json',
        'Accept-Language': normalizeApiLocale(locale.value),
      },
    })
    toast.success(t('products_page.delete_success'))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadProducts(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    deleting.value = false
  }
}

async function confirmBulkDelete() {
  if (selectedIds.value.size === 0 || !canDeleteProduct.value) return
  bulkDeleteConfirmOpen.value = false
  bulkDeleteLoading.value = true
  try {
    const base = config.public.apiBase as string
    const ids = [...selectedIds.value]
    await Promise.all(
      ids.map(id => $fetch(`${base.replace(/\/$/, '')}/products/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          Accept: 'application/json',
          'Accept-Language': normalizeApiLocale(locale.value),
        },
      })),
    )
    toast.success(t('common.bulk_deleted_success', { count: ids.length }))
    selectedIds.value = new Set()
    await loadProducts(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    bulkDeleteLoading.value = false
  }
}

onMounted(async () => {
  await loadFilterOptions()
  await loadProducts()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
       
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('products_page.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{
              t('products_page.subtitle_total', {
                count: pagination?.total ?? rows.length,
              })
            }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

<!-- Left side — search + filters -->
<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:flex-1">

  <div class="relative w-full sm:min-w-[200px] sm:max-w-sm">
    <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      v-model="search"
      :placeholder="t('products_page.search_placeholder')"
      class="h-9 pr-9 w-full"
    />
    <Loader2
      v-if="loading && search.trim()"
      class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
    />
  </div>

  <Select :key="`product-category-${locale}`" :model-value="filterCategoryId" @update:model-value="onCategoryFilterChange">
    <SelectTrigger class="h-9 w-full sm:w-[200px] gap-2">
      <Filter class="size-3.5 shrink-0 text-muted-foreground" />
      <SelectValue :placeholder="t('products_page.filter_category')" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{{ t('products_page.all_categories') }}</SelectItem>
      <SelectItem
        v-for="c in categoryOptions"
        :key="c.id"
        :value="String(c.id)"
      >
        {{ categoryLabel(c) }}
      </SelectItem>
    </SelectContent>
  </Select>

  <Select :key="`product-warehouse-${locale}`" :model-value="filterWarehouseId" @update:model-value="onWarehouseFilterChange">
    <SelectTrigger class="h-9 w-full sm:w-[200px] gap-2">
      <Filter class="size-3.5 shrink-0 text-muted-foreground" />
      <SelectValue :placeholder="t('products_page.filter_warehouse')" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{{ t('products_page.all_warehouses') }}</SelectItem>
      <SelectItem
        v-for="w in warehouseOptions"
        :key="w.id"
        :value="String(w.id)"
      >
        {{ warehouseLabel(w) }}
      </SelectItem>
    </SelectContent>
  </Select>

  <Button
    v-if="hasActiveFilters"
    variant="ghost"
    size="sm"
    class="h-9 gap-1.5 text-muted-foreground w-full sm:w-auto"
    :disabled="loading"
    @click="clearFilters"
  >
    <X class="size-3.5" />
    {{ t('products_page.clear_filters') }}
  </Button>

</div>

<!-- Right side — create dropdown -->
<DropdownMenu v-if="canCreateProduct">
  <DropdownMenuTrigger as-child>
    <Button class="h-9 gap-2 bg-primary hover:bg-primary/90 text-white w-full sm:w-auto">
      <Plus class="size-4" />
      {{ t('products_page.new_product') }}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem as-child>
      <NuxtLink to="/products/create" class="flex w-full cursor-pointer">
        {{ t('products_page.create_single_option') }}
      </NuxtLink>
    </DropdownMenuItem>
    <DropdownMenuItem as-child>
      <NuxtLink to="/products/create-combo" class="flex w-full cursor-pointer">
        {{ t('products_page.create_combo_option') }}
      </NuxtLink>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

</div>
    <div
      v-if="canSelectProductsForDelete && selectedCount > 0"
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

    <div v-if="loadingFilters" class="text-xs text-muted-foreground">
      {{ t('common.loading') }}…
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader class="hidden md:table-header-group">
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead v-if="canSelectProductsForDelete" class="w-10 text-center">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="text-start font-medium min-w-[220px]">
              {{ t('products_page.col_name') }}
            </TableHead>
            <TableHead class="text-start font-medium min-w-[150px]">
              {{ t('products_page.col_category') }}
            </TableHead>
            <TableHead class="text-center font-medium whitespace-nowrap">
              {{ t('products_page.col_qty') }}
            </TableHead>
            <TableHead class="text-center font-medium whitespace-nowrap">
              {{ t('products_page.variations_col') }}
            </TableHead>
            <TableHead class="text-start font-medium whitespace-nowrap min-w-[120px]">
              {{ t('common.added_by') }}
            </TableHead>
            <TableHead class="text-end font-medium min-w-[260px]">
              {{ t('products_page.col_actions') }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading" class="md:table-row">
            <TableCell :colspan="canSelectProductsForDelete ? 7 : 6" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('common.loading') }}…
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-else-if="listLoadError" class="md:table-row">
            <TableCell :colspan="canSelectProductsForDelete ? 7 : 6" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadProducts()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0" class="md:table-row">
            <TableCell :colspan="canSelectProductsForDelete ? 7 : 6" class="py-14 text-center text-sm text-muted-foreground">
              {{ t('products_page.no_products') }}
            </TableCell>
          </TableRow>
          <template v-else>
            <TableRow
              v-for="row in rows"
              :key="row.id"
              class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none hover:bg-muted/30 transition-colors align-middle cursor-pointer md:cursor-default"
              :class="{ 'bg-muted/20': selectedIds.has(row.id) }"
              v-bind="canSelectProductsForDelete ? bindRow({
                onLongPress: () => toggleSelect(row.id),
                onTap: () => (selectedCount > 0 ? toggleSelect(row.id) : navigateRow(row.productType === 'combo' ? `/products/show-combo/${row.id}` : `/products/show/${row.id}`)),
              }) : { onClick: () => navigateRow(row.productType === 'combo' ? `/products/show-combo/${row.id}` : `/products/show/${row.id}`) }"
            >
            <TableCell v-if="canSelectProductsForDelete" class="flex items-center justify-between gap-2 py-1.5 border-b md:w-10 md:table-cell md:py-4 md:border-0" @click.stop>
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.select') }}</span>
              <Checkbox
                :model-value="selectedIds.has(row.id)"
                class="md:mt-0.5 md:mx-4"
                @update:model-value="toggleSelect(row.id)"
              />
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_page.col_name') }}</span>
              <div class="flex flex-col items-end md:items-start gap-1">
                <div class="inline-flex items-center gap-2">
                  <button
                    v-if="canShowProduct"
                    type="button"
                    class="max-w-[260px] truncate text-sm font-medium text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-end md:text-start cursor-pointer"
                    @click="navigateTo(row.productType === 'combo' ? `/products/show-combo/${row.id}` : `/products/show/${row.id}`)"
                  >
                    {{ row.name }}
                  </button>
                  <span v-else class="max-w-[260px] truncate text-sm font-medium">{{ row.name }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Badge
                    v-if="row.productType === 'combo'"
                    variant="secondary"
                    class="text-[10px] uppercase tracking-wide"
                  >
                    {{ t('products_page.combo_badge') }}
                  </Badge>
                  <Badge
                    v-if="row.isIncomplete"
                    variant="destructive"
                    class="text-[10px] uppercase tracking-wide"
                  >
                    {{ t('products_page.warning_badge') }}
                  </Badge>
                </div>
              </div>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_page.col_category') }}</span>
              <span class="text-sm text-muted-foreground">{{ row.categoryLabel }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-center">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_page.col_qty') }}</span>
              <span class="text-sm tabular-nums">{{ row.qty }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-center">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_page.variations_col') }}</span>
              <span class="text-sm">{{ row.variationsCount }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.added_by') }}</span>
              <span class="text-sm text-muted-foreground">{{ createdByDisplay(row.createdBy) }}</span>
            </TableCell>
            <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end" @click.stop>
              <TableRowActions
                :actions="[
                  { key: `edit-${row.id}`, label: t('common.edit'), type: 'link', to: row.productType === 'combo' ? `/products/edit-combo/${row.id}` : `/products/edit/${row.id}`, icon: Pencil, tone: 'default', visible: canEditProduct },
                  { key: `variations-${row.id}`, label: t('products_page.manage_variations'), type: 'link', to: `/products/variations/${row.id}`, tone: 'default', visible: row.productType !== 'combo' },
                  { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteProduct && row.canBeDeleted, onClick: () => openDelete(row) },
                ]"
                variant="invoice"
                align="end"
              />
            </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <div
      v-if="pagination && pagination.last_page > 1"
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg px-4 py-3"
    >
      <p class="text-xs text-muted-foreground">
        {{
          t('common.showing_range', {
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
        <span class="text-sm text-muted-foreground px-2 tabular-nums">
          {{
            t('common.page_of', {
              current: currentPage,
              total: pagination.last_page,
            })
          }}
        </span>
      </PaginationArrowButtons>
    </div>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('products_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('products_page.delete_body', { name: deleteTarget?.name ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">{{ t('common.cancel') }}</AlertDialogCancel>
          <Button
            class="bg-red-600 hover:bg-red-700 text-white"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="deleting" class="size-4 animate-spin" />
            {{ deleting ? t('common.loading') + '…' : t('common.delete') }}
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
          <AlertDialogCancel :disabled="bulkDeleteLoading">{{ t('common.cancel') }}</AlertDialogCancel>
          <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="bulkDeleteLoading" @click="confirmBulkDelete">
            <Loader2 v-if="bulkDeleteLoading" class="size-4 animate-spin" />
            {{ t('common.delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
