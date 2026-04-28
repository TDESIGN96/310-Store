<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Package, Loader2, ShieldAlert, Pencil, Layers, ImageIcon, Warehouse } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const route = useRoute()
const id = computed(() => route.params.id)
const { canEdit: canEditProd, canAccess } = usePermissions()
const canEditProduct = computed(() => canEditProd('products'))
const canListVariations = computed(() => canAccess('product_variations'))

const isTruthy = (value: unknown) =>
  value === true || value === 1 || value === '1' || value === 'true'

const variationActive = (variation: ProductVariation) => isTruthy(variation.is_active)

interface ProductCategory {
  id: number
  name_ar: string
  name_en: string
}

interface ProductUnit {
  id: number
  name_ar: string
  name_en: string
  symbol?: string
}

interface ProductAuthor {
  id: number
  name?: string
  email?: string
}

interface ProductInventoryItem {
  warehouse_id?: number
  quantity?: string | number
  min_quantity?: string | number
  allow_notification?: boolean | string | number
  warehouse?: {
    id: number
    name_ar: string
    name_en: string
  }
}

interface ProductVariation {
  id: number
  sku?: string
  barcode?: string
  price?: string | number
  buying_price?: string | number
  stock_quantity?: string | number
  is_active?: boolean | number | string
  resolved_price?: string | number
  label?: string
  attribute_values?: Array<{ id: number, name?: string, attribute_id?: number }>
  tiered_prices?: Array<{ quantity_from?: string | number, quantity_to?: string | number, price?: string | number }>
  inventory?: ProductInventoryItem[]
}

interface ProductDetail {
  id: number
  name_en?: string
  name_ar?: string
  sku?: string
  identifier?: string
  description?: string
  barcode?: string
  main_image_url?: string
  images?: string[]
  price?: string | number
  is_available?: boolean | number | string
  all_variations_inactive?: boolean | number | string
  category?: ProductCategory
  unit?: ProductUnit
  inventory?: ProductInventoryItem[]
  variations?: ProductVariation[]
  is_incomplete?: boolean | number | string
  created_by?: ProductAuthor | number | null
  updated_by?: ProductAuthor | number | null
  created_at?: string
  updated_at?: string
  is_combo?: boolean | number | string
  product_type?: string
}

interface ProductShowResponse {
  status?: string
  status_code?: number
  data?: {
    product?: ProductDetail
  }
  product?: ProductDetail
  message?: string | null
}

const { $api } = useApi()
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError('products_page', 'error')

const loading = ref(false)
const product = ref<ProductDetail | null>(null)

const productName = computed(() => {
  if (!product.value) return '—'
  if (locale.value === 'ar') return product.value.name_ar || product.value.name_en || '—'
  return product.value.name_en || product.value.name_ar || '—'
})

const categoryLabel = computed(() => {
  const c = product.value?.category
  if (!c) return '—'
  return locale.value === 'ar' ? (c.name_ar || c.name_en || '—') : (c.name_en || c.name_ar || '—')
})

const unitLabel = computed(() => {
  const u = product.value?.unit
  if (!u) return '—'
  const name = locale.value === 'ar' ? (u.name_ar || u.name_en || '—') : (u.name_en || u.name_ar || '—')
  return u.symbol ? `${name} (${u.symbol})` : name
})

const allImages = computed(() => {
  const p = product.value
  if (!p) return []
  const additional = Array.isArray(p.images) ? p.images.filter(Boolean) : []
  return [p.main_image_url, ...additional].filter((v): v is string => Boolean(v))
})

const totalVariationStock = computed(() => {
  const list = product.value?.variations ?? []
  return list.reduce((sum, row) => sum + Number(row.stock_quantity ?? 0), 0)
})

const isIncomplete = computed(() => {
  const value = product.value?.is_incomplete
  return value === true || value === 1 || value === '1' || value === 'true'
})

const isAvailable = computed(() => {
  const value = product.value?.is_available
  return value === true || value === 1 || value === '1' || value === 'true'
})

const variationInventorySummary = (variation: ProductVariation) => {
  const list = variation.inventory ?? []
  if (!list.length) return '—'
  return list.map((row) => {
    const warehouseName = locale.value === 'ar'
      ? (row.warehouse?.name_ar || row.warehouse?.name_en || `#${row.warehouse_id ?? '—'}`)
      : (row.warehouse?.name_en || row.warehouse?.name_ar || `#${row.warehouse_id ?? '—'}`)
    return `${warehouseName}: ${row.quantity ?? 0}`
  }).join(' | ')
}

const variationAttributesSummary = (variation: ProductVariation) => {
  const values = variation.attribute_values ?? []
  if (!values.length) return '—'
  return values.map(v => v.name || `#${v.id}`).join(', ')
}

const variationName = (variation: ProductVariation) => variation.label || `#${variation.id}`

const formatDate = (value?: string) => {
  if (!value) return '—'
  try {
    const loc = locale.value === 'ar' ? 'ar-EG' : 'en-US'
    return new Date(value).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return value
  }
}

const boolLabel = (value: unknown) => {
  const truthy = isTruthy(value)
  return truthy ? t('common.yes') : t('common.no')
}

const authorDisplay = (value?: ProductAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

function isComboValue(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    return normalized === 'true' || normalized === 'combo'
  }
  return false
}

async function loadProduct() {
  loading.value = true
  clearLoadError()
  product.value = null
  try {
    const res = await $api<ProductShowResponse>(`/products/${id.value}`)
    const data = res.data?.product ?? res.product ?? null
    if (!data || typeof data !== 'object' || !('id' in data)) {
      setLoadErrorNotFound()
      return
    }
    const isCombo = isComboValue(data.is_combo) || (typeof data.product_type === 'string' && data.product_type.toLowerCase() === 'combo')
    if (isCombo) {
      await navigateTo(`/products/show-combo/${id.value}`)
      return
    }
    product.value = data
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProduct()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/products">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div class="min-w-0 space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            {{ t('products_page.show_title') }}
          </h1>
          <p v-if="product" class="truncate text-lg font-semibold text-foreground">
            {{ productName }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ t('products_page.show_subtitle', { id: String(id) }) }}
          </p>
          <div v-if="product" class="flex flex-wrap gap-2 pt-1">
            <Badge v-if="isIncomplete" variant="destructive">
              {{ t('products_page.warning_badge') }}
            </Badge>
            <Badge
              v-else-if="isAvailable"
              class="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
              variant="outline"
            >
              {{ t('products_page.show_is_available') }}: {{ t('common.yes') }}
            </Badge>
            <Badge v-else variant="secondary">
              {{ t('products_page.show_is_available') }}: {{ t('common.no') }}
            </Badge>
          </div>
        </div>
      </div>
      <div v-if="product && (canEditProduct || canListVariations)" class="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        <Button v-if="canListVariations" class="gap-2" variant="outline" as-child>
          <NuxtLink :to="`/products/variations/${id}`">
            <Layers class="size-4" />
            {{ t('products_page.manage_variations') }}
          </NuxtLink>
        </Button>
        <Button v-if="canEditProduct" class="gap-2" variant="default" as-child>
          <NuxtLink :to="`/products/edit/${id}`">
            <Pencil class="size-4" />
            {{ t('common.edit') }}
          </NuxtLink>
        </Button>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 rounded-xl border bg-card py-20 text-sm text-muted-foreground shadow-sm"
    >
      <Loader2 class="size-5 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium text-center">{{ loadError.title }}</p>
      <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
        {{ loadError.detail }}
      </p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="loadProduct">{{ t('common.retry') }}</Button>
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink to="/products">{{ t('common.back') }}</NuxtLink>
        </Button>
      </div>
    </div>

    <template v-else-if="product">
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Package class="size-4 shrink-0 text-muted-foreground" />
          <h2 class="text-base font-semibold tracking-tight">
            {{ t('products_page.show_basic_info') }}
          </h2>
        </div>
        <CardContent class="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('products_page.col_category') }}
              </p>
              <p class="text-sm text-foreground">{{ categoryLabel }}</p>
            </div>
            <div class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('products_form.unit') }}
              </p>
              <p class="text-sm text-foreground">{{ unitLabel }}</p>
            </div>
            <div class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('products_page.show_identifier') }}
              </p>
              <p class="font-mono text-sm text-foreground">{{ product.identifier || '—' }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-lg border bg-muted/20 px-3 py-3">
              <p class="text-xs font-medium text-muted-foreground">
                {{ t('products_variations.variations') }}
              </p>
              <p class="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {{ product.variations?.length ?? 0 }}
              </p>
            </div>
            <div class="rounded-lg border bg-muted/20 px-3 py-3">
              <p class="text-xs font-medium text-muted-foreground">
                {{ t('products_variations.total_stock') }}
              </p>
              <p class="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {{ totalVariationStock }}
              </p>
            </div>
            <div class="rounded-lg border bg-muted/20 px-3 py-3">
              <p class="text-xs font-medium text-muted-foreground">
                {{ t('products_variations.warning_state') }}
              </p>
              <p class="mt-1 text-sm font-medium leading-tight">
                {{ isIncomplete ? t('products_page.warning_badge') : t('common.no') }}
              </p>
            </div>
            <div class="rounded-lg border bg-muted/20 px-3 py-3">
              <p class="text-xs font-medium text-muted-foreground">
                {{ t('products_page.show_all_variations_inactive') }}
              </p>
              <p class="mt-1 text-sm font-medium leading-tight">
                {{ boolLabel(product.all_variations_inactive) }}
              </p>
            </div>
          </div>

          <div class="rounded-lg border bg-muted/10 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {{ t('products_form.description') }}
            </p>
            <p class="mt-2 text-sm leading-relaxed text-foreground">
              {{ product.description || '—' }}
            </p>
          </div>

          <div class="grid gap-4 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('common.added_by') }}
              </p>
              <p class="text-sm">{{ authorDisplay(product.created_by) }}</p>
            </div>
            <div v-if="product.updated_by != null" class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('common.last_modified_by') }}
              </p>
              <p class="text-sm">{{ authorDisplay(product.updated_by) }}</p>
            </div>
            <div class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('common.created_at') }}
              </p>
              <p class="text-sm tabular-nums">{{ formatDate(product.created_at) }}</p>
            </div>
            <div v-if="product.updated_by != null" class="space-y-1.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ t('common.updated_at') }}
              </p>
              <p class="text-sm tabular-nums">{{ formatDate(product.updated_at) }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Layers class="size-4 shrink-0 text-muted-foreground" />
          <h2 class="text-base font-semibold tracking-tight">
            {{ t('products_variations.variations') }}
          </h2>
        </div>
        <CardContent class="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <div class="overflow-hidden rounded-lg border">
            <div class="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ t('products_page.show_variation_pricing_section') }}
            </div>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="border-0 hover:bg-muted/40 bg-muted/40">
                    <TableHead class="rtl:text-right font-medium">
                      {{ t('products_page.show_variation_label') }}
                    </TableHead>
                    <TableHead class="rtl:text-right font-medium whitespace-nowrap">
                      {{ t('products_variations.variation_sku') }}
                    </TableHead>
                    <TableHead class="rtl:text-right font-medium whitespace-nowrap">
                      {{ t('products_variations.variation_barcode') }}
                    </TableHead>
                    <TableHead class="text-end font-medium whitespace-nowrap">
                      {{ t('products_variations.buying_price') }}
                    </TableHead>
                    <TableHead class="text-end font-medium whitespace-nowrap">
                      {{ t('products_variations.variation_price') }}
                    </TableHead>
                    <TableHead class="text-end font-medium whitespace-nowrap">
                      {{ t('products_variations.variation_qty') }}
                    </TableHead>
                    <TableHead class="w-[1%] whitespace-nowrap text-end font-medium">
                      {{ t('products_page.col_status') }}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!product.variations?.length">
                    <TableCell :colspan="7" class="py-12 text-center text-sm text-muted-foreground">
                      {{ t('products_variations.no_variations') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="variation in product.variations || []"
                    :key="`pricing-${variation.id}`"
                    class="transition-colors hover:bg-muted/25"
                  >
                    <TableCell class="align-middle font-medium">
                      {{ variationName(variation) }}
                    </TableCell>
                    <TableCell class="align-middle font-mono text-sm">
                      {{ variation.sku || '—' }}
                    </TableCell>
                    <TableCell class="align-middle font-mono text-sm">
                      {{ variation.barcode || '—' }}
                    </TableCell>
                    <TableCell class="align-middle text-end tabular-nums text-sm">
                      {{ variation.buying_price ?? '—' }}
                    </TableCell>
                    <TableCell class="align-middle text-end tabular-nums text-sm">
                      {{ variation.price ?? '—' }}
                    </TableCell>
                    <TableCell class="align-middle text-end tabular-nums text-sm">
                      {{ variation.stock_quantity ?? 0 }}
                    </TableCell>
                    <TableCell class="align-middle text-end">
                      <Badge
                        v-if="variationActive(variation)"
                        class="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
                        variant="outline"
                      >
                        {{ t('common.yes') }}
                      </Badge>
                      <Badge v-else variant="secondary">
                        {{ t('common.no') }}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg border">
            <div class="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ t('products_page.show_variation_configuration_section') }}
            </div>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="border-0 hover:bg-muted/40 bg-muted/40">
                    <TableHead class="w-[160px] rtl:text-right font-medium whitespace-nowrap">
                      {{ t('products_page.show_variation_label') }}
                    </TableHead>
                    <TableHead class="rtl:text-right font-medium min-w-[200px]">
                      {{ t('products_page.show_variation_attributes') }}
                    </TableHead>
                    <TableHead class="rtl:text-right font-medium min-w-[200px]">
                      {{ t('products_page.show_variation_tiered_prices') }}
                    </TableHead>
                    <TableHead class="rtl:text-right font-medium min-w-[220px]">
                      {{ t('products_page.show_variation_inventory') }}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!product.variations?.length">
                    <TableCell :colspan="4" class="py-12 text-center text-sm text-muted-foreground">
                      {{ t('products_variations.no_variations') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="variation in product.variations || []"
                    :key="`config-${variation.id}`"
                    class="transition-colors hover:bg-muted/25"
                  >
                    <TableCell class="align-middle font-medium whitespace-nowrap">
                      {{ variationName(variation) }}
                    </TableCell>
                    <TableCell class="align-middle text-sm leading-relaxed whitespace-normal">
                      {{ variationAttributesSummary(variation) }}
                    </TableCell>
                    <TableCell class="align-middle">
                      <div
                        v-if="variation.tiered_prices?.length"
                        class="space-y-1.5 rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-xs tabular-nums"
                      >
                        <p v-for="(tier, tierIdx) in variation.tiered_prices" :key="tierIdx" class="leading-snug">
                          {{ tier.quantity_from ?? 0 }} – {{ tier.quantity_to ?? 0 }} · {{ tier.price ?? 0 }}
                        </p>
                      </div>
                      <span v-else class="text-sm text-muted-foreground">—</span>
                    </TableCell>
                    <TableCell class="align-middle text-sm leading-relaxed whitespace-normal">
                      {{ variationInventorySummary(variation) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <ImageIcon class="size-4 shrink-0 text-muted-foreground" />
          <h2 class="text-base font-semibold tracking-tight">
            {{ t('products_page.show_images') }}
          </h2>
        </div>
        <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
          <div v-if="allImages.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <a
              v-for="(url, idx) in allImages"
              :key="`${url}-${idx}`"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              class="group block overflow-hidden rounded-lg border bg-muted/15 shadow-sm ring-offset-background transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div class="aspect-square w-full overflow-hidden bg-muted/30">
                <img
                  :src="url"
                  :alt="`${productName} ${idx + 1}`"
                  class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                >
              </div>
            </a>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            {{ t('products_page.show_no_images') }}
          </p>
        </CardContent>
      </Card>

      <!-- <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Warehouse class="size-4 shrink-0 text-muted-foreground" />
          <h2 class="text-base font-semibold tracking-tight">
            {{ t('products_page.show_inventory') }}
          </h2>
        </div>
        <CardContent class="px-4 pb-5 sm:px-6 sm:pb-6">
          <div class="overflow-hidden rounded-lg border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="border-0 hover:bg-muted/40 bg-muted/40">
                    <TableHead class="rtl:text-right font-medium">
                      {{ t('warehouse_assignment.col_warehouse') }}
                    </TableHead>
                    <TableHead class="text-end font-medium whitespace-nowrap">
                      {{ t('warehouse_assignment.col_stock') }}
                    </TableHead>
                    <TableHead class="text-end font-medium whitespace-nowrap">
                      {{ t('warehouse_assignment.col_min_qty') }}
                    </TableHead>
                    <TableHead class="w-[1%] whitespace-nowrap text-end font-medium">
                      {{ t('warehouse_assignment.col_notifications') }}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!product.inventory?.length">
                    <TableCell :colspan="4" class="py-12 text-center text-sm text-muted-foreground">
                      {{ t('products_page.show_no_inventory') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="(row, idx) in product.inventory || []"
                    :key="idx"
                    class="transition-colors hover:bg-muted/25"
                  >
                    <TableCell class="align-middle text-sm">
                      {{
                        locale === 'ar'
                          ? (row.warehouse?.name_ar || row.warehouse?.name_en || `#${row.warehouse_id ?? '—'}`)
                          : (row.warehouse?.name_en || row.warehouse?.name_ar || `#${row.warehouse_id ?? '—'}`)
                      }}
                    </TableCell>
                    <TableCell class="align-middle text-end tabular-nums text-sm">
                      {{ row.quantity ?? 0 }}
                    </TableCell>
                    <TableCell class="align-middle text-end tabular-nums text-sm">
                      {{ row.min_quantity ?? 0 }}
                    </TableCell>
                    <TableCell class="align-middle text-end text-sm">
                      {{ boolLabel(row.allow_notification) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card> -->
    </template>

    <div v-else class="rounded-xl border bg-card p-10 text-center text-muted-foreground shadow-sm">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/products">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <Package class="mx-auto size-10 opacity-40 mb-3" />
      <p class="text-sm">{{ t('products_page.not_found') }}</p>
    </div>
  </div>
</template>
