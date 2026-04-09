<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search,
  Plus,
  Loader2,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Package,
  Eye,
  Pencil,
  Trash2,
  Filter,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const config = useRuntimeConfig()
const authStore = useAuthStore()
// TEMP: backend product permissions are not ready yet, so UI action gates are disabled.
// TODO: switch these back to usePermissions() checks when products.* permissions are available.
const canCreateProduct = true
const canShowProduct = true
const canEditProduct = true
const canDeleteProduct = true

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

interface WarehousesListResponse {
  data?: { warehouses?: WarehouseFilterItem[]; pagination?: Pagination }
  warehouses?: WarehouseFilterItem[]
  pagination?: Pagination
}

interface ProductRow {
  id: number
  sku: string
  name: string
  categoryLabel: string
  warehouseLabel: string
  qty: number
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
  if (typeof warehouse.name === 'string' && warehouse.name.trim()) return warehouse.name.trim()
  if (loc === 'ar' && typeof warehouse.name_ar === 'string' && warehouse.name_ar.trim())
    return warehouse.name_ar.trim()
  if (typeof warehouse.name_en === 'string' && warehouse.name_en.trim())
    return warehouse.name_en.trim()
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
  const fallback = raw.category_name ?? raw.categoryName
  return typeof fallback === 'string' ? fallback : '—'
}

/** Stored/display name exactly as from API `name` when present. */
function productDisplayName(raw: Record<string, unknown>, loc: string): string {
  if (typeof raw.name === 'string') return raw.name
  if (typeof raw.title === 'string') return raw.title
  if (loc === 'ar')
    return String(raw.name_ar ?? raw.name_en ?? '—')
  return String(raw.name_en ?? raw.name_ar ?? '—')
}

function productSku(raw: Record<string, unknown>): string {
  const v = raw.sku ?? raw.code ?? raw.SKU
  return typeof v === 'string' ? v : v != null ? String(v) : '—'
}

function normalizeProductRow(raw: Record<string, unknown>, loc: string, multipleWh: string): ProductRow | null {
  const id = raw.id
  const numId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : Number.NaN
  if (!Number.isFinite(numId)) return null

  const pivots = extractWarehousePivotList(raw)
  const { warehouseLabel, qty } = deriveWarehouseAndQty(pivots, loc, multipleWh)

  return {
    id: numId,
    sku: productSku(raw),
    name: productDisplayName(raw, loc),
    categoryLabel: categoryLabelFromProduct(raw, loc),
    warehouseLabel,
    qty,
  }
}

const rows = ref<ProductRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
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

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(
  () => filterCategoryId.value !== 'all' || filterWarehouseId.value !== 'all' || search.value.trim().length > 0,
)

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
  errorMessage.value = ''
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
  }
  catch (error: any) {
    errorMessage.value
      = error?.data?.message?.ar
      ?? error?.data?.message
      ?? t('products_page.load_error')
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
  if (!deleteTarget.value) return
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

onMounted(async () => {
  await loadFilterOptions()
  await loadProducts()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex size-10 items-center justify-center rounded-lg bg-[#215260]/10 text-[#215260]"
        >
          <Package class="size-5" />
        </div>
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

    <div class="flex items-center justify-between gap-4">

<!-- Left side — search + filters -->
<div class="flex flex-wrap items-center gap-2 flex-1">

  <div class="relative min-w-[200px] max-w-sm">
    <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      v-model="search"
      :placeholder="t('products_page.search_placeholder')"
      class="h-9 pr-9"
    />
    <Loader2
      v-if="loading && search.trim()"
      class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
    />
  </div>

  <Select :model-value="filterCategoryId" @update:model-value="onCategoryFilterChange">
    <SelectTrigger class="h-9 w-[200px] gap-2">
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

  <Select :model-value="filterWarehouseId" @update:model-value="onWarehouseFilterChange">
    <SelectTrigger class="h-9 w-[200px] gap-2">
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
    class="h-9 gap-1.5 text-muted-foreground"
    :disabled="loading"
    @click="clearFilters"
  >
    <X class="size-3.5" />
    {{ t('products_page.clear_filters') }}
  </Button>

</div>

<!-- Right side — new product button -->
<Button
  v-if="canCreateProduct"
  class="h-9 gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030] shrink-0"
  as-child
>
  <NuxtLink to="/products/create">
    <Plus class="size-4" />
    {{ t('products_page.new_product') }}
  </NuxtLink>
</Button>

</div>

    <div v-if="loadingFilters" class="text-xs text-muted-foreground">
      {{ t('common.loading') }}…
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="rtl:text-right font-medium whitespace-nowrap">
              {{ t('products_page.col_sku') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium min-w-[140px]">
              {{ t('products_page.col_name') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium">
              {{ t('products_page.col_warehouse') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium">
              {{ t('products_page.col_category') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium whitespace-nowrap">
              {{ t('products_page.col_qty') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium w-[1%]">
              {{ t('products_page.col_actions') }}
            </TableHead>
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
          <TableRow v-else-if="errorMessage">
            <TableCell :colspan="6" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <span>{{ errorMessage }}</span>
                <Button variant="outline" size="sm" @click="loadProducts()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell :colspan="6" class="py-14 text-center text-sm text-muted-foreground">
              {{ t('products_page.no_products') }}
            </TableCell>
          </TableRow>
          <template v-else>
            <TableRow
              v-for="row in rows"
              :key="row.id"
              class="hover:bg-muted/30 transition-colors"
            >
            <TableCell class="font-mono text-sm whitespace-nowrap">
              {{ row.sku }}
            </TableCell>
            <TableCell class="text-sm font-medium">
              {{ row.name }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ row.warehouseLabel }}
            </TableCell>
            <TableCell class="text-sm">
              {{ row.categoryLabel }}
            </TableCell>
            <TableCell class="text-sm tabular-nums">
              {{ row.qty }}
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap items-center gap-1 justify-end">
                <Button v-if="canShowProduct" variant="outline" size="sm" class="h-8 gap-1 px-2" as-child>
                  <NuxtLink :to="`/products/show/${row.id}`">
                    <Eye class="size-3.5" />
                    {{ t('common.view') }}
                  </NuxtLink>
                </Button>
                <Button v-if="canEditProduct" variant="outline" size="sm" class="h-8 gap-1 px-2" as-child>
                  <NuxtLink :to="`/products/edit/${row.id}`">
                    <Pencil class="size-3.5" />
                    {{ t('common.edit') }}
                  </NuxtLink>
                </Button>
                <!-- <Button
                  v-if="canDeleteProduct"
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                  @click="openDelete(row)"
                >
                  <Trash2 class="size-3.5" />
                  {{ t('common.delete') }}
                </Button> -->
              </div>
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
        <span class="text-sm text-muted-foreground px-2 tabular-nums">
          {{
            t('common.page_of', {
              current: currentPage,
              total: pagination.last_page,
            })
          }}
        </span>
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
  </div>
</template>
