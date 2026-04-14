<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Pencil, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
const { canEdit: canEditProd } = usePermissions()
const canEditProduct = computed(() => canEditProd('products'))
const { $api } = useApi()
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError('products_page', 'error')

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

interface ComboItem {
  product_id?: number | string
  quantity?: number | string
  sort_order?: number
  product?: {
    id?: number
    name_ar?: string
    name_en?: string
    name?: string
  }
}

interface ProductTieredPrice {
  quantity_from: string | number
  quantity_to: string | number
  price: string | number
}

interface ComboProductDetail {
  id: number
  name_en?: string
  name_ar?: string
  sku?: string
  description?: string
  main_image_url?: string
  images?: string[]
  price?: string | number
  is_combo?: boolean | number | string
  product_type?: string
  category?: ProductCategory
  unit?: ProductUnit
  combo_items?: ComboItem[]
  tiered_prices?: ProductTieredPrice[]
  created_at?: string
  updated_at?: string
}

interface ProductShowResponse {
  data?: { product?: ComboProductDetail }
  product?: ComboProductDetail
}

const loading = ref(false)
const product = ref<ComboProductDetail | null>(null)

function isComboValue(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    return normalized === 'true' || normalized === 'combo'
  }
  return false
}

const comboName = computed(() => {
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

const comboItemsForView = computed(() => {
  const list = product.value?.combo_items ?? []
  return [...list].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
})

function comboItemName(item: ComboItem): string {
  const p = item.product
  if (!p) return `#${item.product_id ?? '—'}`
  if (locale.value === 'ar') return p.name_ar || p.name_en || p.name || `#${item.product_id ?? '—'}`
  return p.name_en || p.name_ar || p.name || `#${item.product_id ?? '—'}`
}

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
    if (!isCombo) {
      await navigateTo(`/products/show/${id.value}`)
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
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('products_combo.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ t('products_page.show_subtitle', { id: String(id) }) }}</p>
        </div>
      </div>
      <Button v-if="canEditProduct && product" class="gap-2" variant="outline" as-child>
        <NuxtLink :to="`/products/edit-combo/${id}`">
          <Pencil class="size-4" />
          {{ t('common.edit') }}
        </NuxtLink>
      </Button>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
    >
      <Loader2 class="size-5 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
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
      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold flex items-center gap-2">
            <Package class="size-4" />
            {{ t('products_page.show_basic_info') }}
          </h2>
        </div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_form.name_ar') }}</p>
            <p class="font-medium">{{ product.name_ar || '—' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_form.name_en') }}</p>
            <p class="font-medium">{{ product.name_en || '—' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_page.col_sku') }}</p>
            <p class="font-mono">{{ product.sku || '—' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_page.col_name') }}</p>
            <p class="font-medium">{{ comboName }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_page.col_category') }}</p>
            <p>{{ categoryLabel }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_form.unit') }}</p>
            <p>{{ unitLabel }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('products_page.col_price') }}</p>
            <p>{{ product.price ?? '—' }}</p>
          </div>
          <div class="space-y-1 md:col-span-2">
            <p class="text-xs text-muted-foreground">{{ t('products_form.description') }}</p>
            <p class="text-sm leading-relaxed">{{ product.description || '—' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('common.created_at') }}</p>
            <p>{{ formatDate(product.created_at) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">{{ t('common.updated_at') }}</p>
            <p>{{ formatDate(product.updated_at) }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold">{{ t('products_combo.section_bundle_title') }}</h2>
        </div>
        <div class="p-4">
          <div class="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('products_combo.col_product') }}</TableHead>
                  <TableHead>{{ t('products_combo.col_quantity') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!comboItemsForView.length">
                  <TableCell :colspan="2" class="text-center text-sm text-muted-foreground py-8">
                    {{ t('products_page.not_found') }}
                  </TableCell>
                </TableRow>
                <TableRow v-for="(row, idx) in comboItemsForView" :key="idx">
                  <TableCell>{{ comboItemName(row) }}</TableCell>
                  <TableCell>{{ row.quantity ?? 0 }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold">{{ t('products_page.show_tiered_prices') }}</h2>
        </div>
        <div class="p-4">
          <div class="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('price_assignment.col_min_qty') }}</TableHead>
                  <TableHead>{{ t('price_assignment.col_max_qty') }}</TableHead>
                  <TableHead>{{ t('price_assignment.col_price') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!product.tiered_prices?.length">
                  <TableCell :colspan="3" class="text-center text-sm text-muted-foreground py-8">
                    {{ t('products_page.show_no_tiered_prices') }}
                  </TableCell>
                </TableRow>
                <TableRow v-for="(row, idx) in product.tiered_prices" :key="idx">
                  <TableCell>{{ row.quantity_from }}</TableCell>
                  <TableCell>{{ row.quantity_to }}</TableCell>
                  <TableCell>{{ row.price }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold">{{ t('products_page.show_images') }}</h2>
        </div>
        <div class="p-4">
          <div v-if="allImages.length" class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <a
              v-for="(url, idx) in allImages"
              :key="`${url}-${idx}`"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              class="block rounded border overflow-hidden bg-muted/20"
            >
              <img :src="url" :alt="`${comboName} ${idx + 1}`" class="w-full h-32 object-cover">
            </a>
          </div>
          <p v-else class="text-sm text-muted-foreground">{{ t('products_page.show_no_images') }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
