<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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

const { t, locale } = useI18n()
const { $api } = useApi()

interface Pagination {
  current_page: number
  last_page: number
}

interface ProductOption {
  id: number
  name_ar?: string
  name_en?: string
  name?: string
  is_combo?: boolean | number | string
}

interface ProductsResponse {
  data?: unknown
  products?: unknown[]
  pagination?: Pagination
}

interface BundleRow {
  _key: number
  productId: string
  quantity: string
}

const rows = ref<BundleRow[]>([])
const products = ref<ProductOption[]>([])
const loadingProducts = ref(false)
const loadError = ref('')
const sectionError = ref('')
const rowError = ref('')

let _keyCounter = 0

function extractList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const d = payload as Record<string, unknown>
  if (Array.isArray(d.products)) return d.products
  if (Array.isArray(d.data)) return d.data
  if (d.data && typeof d.data === 'object') {
    const inner = d.data as Record<string, unknown>
    if (Array.isArray(inner.products)) return inner.products
    if (Array.isArray(inner.data)) return inner.data
  }
  return []
}

function extractPagination(payload: unknown): Pagination | null {
  if (!payload || typeof payload !== 'object') return null
  const d = payload as Record<string, unknown>
  const direct = d.pagination
  if (direct && typeof direct === 'object') {
    const p = direct as Record<string, unknown>
    if (typeof p.current_page === 'number' && typeof p.last_page === 'number') {
      return { current_page: p.current_page, last_page: p.last_page }
    }
  }
  if (d.data && typeof d.data === 'object') {
    const inner = d.data as Record<string, unknown>
    const nested = inner.pagination
    if (nested && typeof nested === 'object') {
      const p = nested as Record<string, unknown>
      if (typeof p.current_page === 'number' && typeof p.last_page === 'number') {
        return { current_page: p.current_page, last_page: p.last_page }
      }
    }
  }
  return null
}

function isComboValue(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function productLabel(p: ProductOption): string {
  if (locale.value === 'ar')
    return p.name_ar || p.name_en || p.name || '—'
  return p.name_en || p.name_ar || p.name || '—'
}

async function loadProducts() {
  loadingProducts.value = true
  loadError.value = ''
  try {
    const aggregated: ProductOption[] = []
    let page = 1
    let lastPage = 1
    const maxPages = 50

    do {
      const data = await $api<ProductsResponse>('/products', { params: { page, per_page: 100 } })
      const list = extractList(data)
      list.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return
        const row = raw as Record<string, unknown>
        const id = Number(row.id)
        if (!Number.isFinite(id)) return
        aggregated.push({
          id,
          name: typeof row.name === 'string' ? row.name : undefined,
          name_ar: typeof row.name_ar === 'string' ? row.name_ar : undefined,
          name_en: typeof row.name_en === 'string' ? row.name_en : undefined,
          is_combo: row.is_combo as ProductOption['is_combo'],
        })
      })
      const pagination = extractPagination(data)
      lastPage = pagination?.last_page ?? 1
      page += 1
    } while (page <= lastPage && page <= maxPages)

    products.value = aggregated.filter(p => !isComboValue(p.is_combo))
  }
  catch {
    products.value = []
    loadError.value = t('products_combo.products_load_error')
  }
  finally {
    loadingProducts.value = false
  }
}

function selectedProductIds(exceptKey?: number): string[] {
  return rows.value
    .filter(row => row._key !== exceptKey && row.productId)
    .map(row => row.productId)
}

function availableProductsForRow(rowKey: number): ProductOption[] {
  const used = new Set(selectedProductIds(rowKey))
  return products.value.filter(p => !used.has(String(p.id)))
}

function addRow() {
  sectionError.value = ''
  rowError.value = ''
  rows.value.push({
    _key: ++_keyCounter,
    productId: '',
    quantity: '1',
  })
}

function removeRow(key: number) {
  if (rows.value.length <= 2) return
  rows.value = rows.value.filter(row => row._key !== key)
  sectionError.value = ''
  rowError.value = ''
}

function onProductChange(row: BundleRow, value: unknown) {
  const incoming = value != null ? String(value) : ''
  rowError.value = ''
  sectionError.value = ''
  if (!incoming) {
    row.productId = ''
    return
  }

  const duplicate = selectedProductIds(row._key).includes(incoming)
  if (duplicate) {
    row.productId = ''
    rowError.value = t('products_combo.validation_duplicate_product')
    return
  }
  row.productId = incoming
}

function onQuantityInput(e: Event, row: BundleRow) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/[^0-9]/g, '')
  row.quantity = digits
  el.value = digits
  rowError.value = ''
}

function validate(): boolean {
  sectionError.value = ''
  rowError.value = ''

  if (rows.value.length < 2) {
    sectionError.value = t('products_combo.validation_min_two_products')
    return false
  }

  const selected = new Set<string>()
  for (const row of rows.value) {
    if (!row.productId) {
      rowError.value = t('products_combo.validation_select_product')
      return false
    }
    if (selected.has(row.productId)) {
      rowError.value = t('products_combo.validation_duplicate_product')
      return false
    }
    selected.add(row.productId)

    const quantity = Number(row.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      rowError.value = t('products_combo.validation_quantity_gt_zero')
      return false
    }
  }

  return true
}

function getBundleItems() {
  return rows.value.map((row, index) => ({
    product_id: Number(row.productId),
    quantity: Number(row.quantity),
    sort_order: index + 1,
  }))
}

function setBundleItems(items: Array<{ product_id?: number | string; quantity?: number | string }>) {
  const mapped = items
    .map((item) => {
      const productId = item.product_id != null ? String(item.product_id) : ''
      const quantity = item.quantity != null ? String(item.quantity) : ''
      if (!productId || !quantity) return null
      return {
        _key: ++_keyCounter,
        productId,
        quantity,
      }
    })
    .filter((row): row is BundleRow => row !== null)

  rows.value = mapped.length ? mapped : []
  if (rows.value.length < 2) {
    while (rows.value.length < 2) addRow()
  }
  sectionError.value = ''
  rowError.value = ''
}

function resetToMinimumRows() {
  rows.value = []
  addRow()
  addRow()
}

defineExpose({
  validate,
  getBundleItems,
  setBundleItems,
})

onMounted(async () => {
  resetToMinimumRows()
  await loadProducts()
})
</script>

<template>
  <div class="rounded-lg border p-5 space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('products_create.step_badge', { n: 2 }) }}
      </p>
      <h2 class="text-lg font-semibold tracking-tight mt-1">
        {{ t('products_combo.section_bundle_title') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('products_combo.section_bundle_hint') }}
      </p>
    </div>

    <div
      v-if="loadError"
      class="rounded-md bg-amber-500/10 border border-amber-200 text-amber-800 dark:text-amber-200 text-sm px-4 py-3"
    >
      {{ loadError }}
    </div>

    <Separator />

    <div class="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="rtl:text-right font-medium min-w-[220px]">
              {{ t('products_combo.col_product') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium min-w-[160px]">
              {{ t('products_combo.col_quantity') }}
            </TableHead>
            <TableHead class="font-medium w-[80px] text-center">
              {{ t('products_combo.col_actions') }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in rows"
            :key="row._key"
            class="hover:bg-muted/20 transition-colors"
          >
            <TableCell class="py-2.5">
              <Select
                :model-value="row.productId || undefined"
                :disabled="loadingProducts"
                @update:model-value="(v) => onProductChange(row, v)"
              >
                <SelectTrigger class="h-9 w-full min-w-[190px]">
                  <SelectValue :placeholder="t('products_combo.select_product')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in availableProductsForRow(row._key)"
                    :key="p.id"
                    :value="String(p.id)"
                  >
                    {{ productLabel(p) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell class="py-2.5">
              <Input
                :model-value="row.quantity"
                type="text"
                inputmode="numeric"
                class="h-9 w-full font-mono"
                dir="ltr"
                placeholder="1"
                @input="(e: Event) => onQuantityInput(e, row)"
              />
            </TableCell>
            <TableCell class="py-2.5 text-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                :disabled="rows.length <= 2"
                :aria-label="t('products_combo.delete_row')"
                @click="removeRow(row._key)"
              >
                <Trash2 class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <p v-if="rowError" class="text-sm text-red-600">{{ rowError }}</p>
    <p v-if="sectionError" class="text-sm text-red-600">{{ sectionError }}</p>

    <Button
      type="button"
      variant="outline"
      size="sm"
      class="h-9 gap-2"
      @click="addRow"
    >
      <Plus class="size-4" />
      {{ t('products_combo.add_product_row') }}
    </Button>
  </div>
</template>
