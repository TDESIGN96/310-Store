<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, Barcode, Boxes, Loader2, Plus, Search, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
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

definePageMeta({ layout: 'default' })

type PricingMethod = 'standard' | 'tiered'

interface LookupWarehouse {
  id: string
  label: string
  availableStock: number
  minQty: number | null
  maxQty: number | null
  thresholdActive: boolean
  canOverrideThreshold: boolean
}

interface LookupVariation {
  id: string
  label: string
  barcode: string
  unit: string
  defaultStandardPrice: number | null
  warehouses: LookupWarehouse[]
}

interface LookupProduct {
  id: string
  name_en: string
  name_ar: string
  barcode: string
  variations: LookupVariation[]
}

interface TierDraft {
  from: number
  to: number
  price: number
}

interface AllocationRowDraft {
  key: string
  product: LookupProduct | null
  product_id: string
  variation_id: string
  warehouse_id: string
  description: string
  quantity: number
  unit: string
  available_stock: number
  pricing_method: PricingMethod
  standard_price: number
  tiers: TierDraft[]
  threshold_active: boolean
  threshold_min: number | null
  threshold_max: number | null
  can_override_threshold: boolean
}

interface RowFieldErrors {
  product_id?: string
  variation_id?: string
  warehouse_id?: string
  quantity?: string
  standard_price?: string
  tiers?: string
}

const route = useRoute()
const { t, locale } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canEdit } = usePermissions()

const distributorId = computed(() => String(route.query.distributor_id ?? '').trim())
const canAllocate = computed(() => canEdit('distributors'))

const distributorActive = ref(false)
const distributorLoading = ref(false)
const distributorError = ref('')

const lookupResults = ref<LookupProduct[]>([])
const lookupLoading = ref(false)
const lookupError = ref('')
const searchQuery = ref('')
const barcodeQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const thresholdOverridePermission = ref(false)

const rows = ref<AllocationRowDraft[]>([])
const rowErrors = ref<Record<string, RowFieldErrors>>({})
const formError = ref('')
const submitting = ref(false)

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const getString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const createEmptyTier = (): TierDraft => ({ from: 1, to: 1, price: 0 })

const createEmptyRow = (): AllocationRowDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  product: null,
  product_id: '',
  variation_id: '',
  warehouse_id: '',
  description: '',
  quantity: 1,
  unit: '',
  available_stock: 0,
  pricing_method: 'standard',
  standard_price: 0,
  tiers: [createEmptyTier()],
  threshold_active: false,
  threshold_min: null,
  threshold_max: null,
  can_override_threshold: false,
})

const ensureRows = () => {
  if (!rows.value.length) rows.value = [createEmptyRow()]
}

const productDisplayName = (product: LookupProduct | null): string => {
  if (!product) return '—'
  if (locale.value === 'ar') return product.name_ar || product.name_en || '—'
  return product.name_en || product.name_ar || '—'
}

const formatMoney = (value: number): string => value.toFixed(2)

const rowTotal = (row: AllocationRowDraft): number => row.quantity * row.standard_price

const getVariationOptions = (row: AllocationRowDraft): LookupVariation[] => row.product?.variations ?? []

const getWarehouseOptions = (row: AllocationRowDraft): LookupWarehouse[] => {
  const variation = getVariationOptions(row).find(v => v.id === row.variation_id)
  return variation?.warehouses ?? []
}

const normalizeWarehouse = (raw: unknown): LookupWarehouse | null => {
  if (!isRecord(raw)) return null
  const id = String(raw.id ?? raw.warehouse_id ?? '').trim()
  if (!id) return null
  const label = getString(raw.name || raw.name_en || raw.name_ar || raw.warehouse || raw.label || id)
  const availableStock = toNumber(
    raw.available_stock
    ?? raw.available_quantity
    ?? raw.stock_available
    ?? raw.remaining_stock
    ?? raw.stock
    ?? raw.quantity,
    0,
  )
  const minQty = Number.isFinite(Number(raw.min_allocation_qty ?? raw.threshold_min_quantity ?? raw.minimum_qty))
    ? Number(raw.min_allocation_qty ?? raw.threshold_min_quantity ?? raw.minimum_qty)
    : Number.isFinite(Number(raw.min_quantity))
      ? Number(raw.min_quantity)
    : null
  const maxQty = Number.isFinite(Number(raw.max_allocation_qty ?? raw.threshold_max_quantity ?? raw.maximum_qty))
    ? Number(raw.max_allocation_qty ?? raw.threshold_max_quantity ?? raw.maximum_qty)
    : null
  const thresholdActive = Boolean(raw.threshold_active ?? raw.has_threshold_restriction ?? raw.is_threshold_active)
  const canOverrideThreshold = Boolean(raw.can_override_threshold ?? raw.override_permission)

  return {
    id,
    label,
    availableStock,
    minQty,
    maxQty,
    thresholdActive,
    canOverrideThreshold,
  }
}

const normalizeVariation = (raw: unknown): LookupVariation | null => {
  if (!isRecord(raw)) return null
  const id = String(raw.id ?? raw.variation_id ?? '').trim()
  if (!id) return null
  const label = getString(raw.label || raw.name || raw.sku || raw.variation || id)
  const barcode = getString(raw.barcode || raw.code)
  const unit = getString(raw.unit || raw.unit_name || raw.measurement_unit)
  const defaultStandardPrice = Number.isFinite(Number(raw.standard_price ?? raw.price ?? raw.default_price))
    ? Number(raw.standard_price ?? raw.price ?? raw.default_price)
    : null
  const rawWarehouses = Array.isArray(raw.inventory)
    ? raw.inventory.map((item) => {
      const inventoryItem = isRecord(item) ? item : {}
      return {
        id: isRecord(inventoryItem.warehouse) ? inventoryItem.warehouse.id : inventoryItem.warehouse_id,
        name: isRecord(inventoryItem.warehouse)
          ? (inventoryItem.warehouse.name_en ?? inventoryItem.warehouse.name_ar ?? inventoryItem.warehouse.name)
          : (inventoryItem.warehouse_name ?? inventoryItem.warehouse),
        name_en: isRecord(inventoryItem.warehouse) ? inventoryItem.warehouse.name_en : undefined,
        name_ar: isRecord(inventoryItem.warehouse) ? inventoryItem.warehouse.name_ar : undefined,
        available_stock: inventoryItem.quantity ?? inventoryItem.available_stock ?? inventoryItem.stock_available,
        min_quantity: inventoryItem.min_quantity,
        can_override_threshold: inventoryItem.can_override_threshold,
      }
    })
    : Array.isArray(raw.warehouses)
      ? raw.warehouses
      : isRecord(raw.warehouse)
        ? [raw.warehouse]
        : []
  const warehouses = rawWarehouses
    .map(item => normalizeWarehouse(item))
    .filter((item): item is LookupWarehouse => !!item)
  return {
    id,
    label,
    barcode,
    unit,
    defaultStandardPrice,
    warehouses,
  }
}

const normalizeProduct = (raw: unknown): LookupProduct | null => {
  if (!isRecord(raw)) return null
  const id = String(raw.id ?? raw.product_id ?? '').trim()
  if (!id) return null
  const name_en = getString(raw.name_en || raw.name || raw.product || raw.product_name || id)
  const name_ar = getString(raw.name_ar || raw.name || raw.product || raw.product_name || id)
  const rawVariations = Array.isArray(raw.variations)
    ? raw.variations
    : isRecord(raw.variation)
      ? [raw.variation]
      : []
  const variations = rawVariations
    .map(item => normalizeVariation(item))
    .filter((item): item is LookupVariation => !!item)
  const barcode = getString(raw.barcode || raw.code || variations[0]?.barcode)
  return {
    id,
    name_en,
    name_ar,
    barcode,
    variations,
  }
}

const mergeProducts = (products: LookupProduct[]): LookupProduct[] => {
  const byProduct = new Map<string, LookupProduct>()
  products.forEach((product) => {
    const existing = byProduct.get(product.id)
    if (!existing) {
      byProduct.set(product.id, {
        ...product,
        variations: [...product.variations],
      })
      return
    }
    const variationMap = new Map(existing.variations.map(v => [v.id, v]))
    product.variations.forEach((variation) => {
      const existingVariation = variationMap.get(variation.id)
      if (!existingVariation) {
        variationMap.set(variation.id, variation)
        return
      }
      const warehouseMap = new Map(existingVariation.warehouses.map(w => [w.id, w]))
      variation.warehouses.forEach((warehouse) => warehouseMap.set(warehouse.id, warehouse))
      variationMap.set(variation.id, { ...existingVariation, warehouses: [...warehouseMap.values()] })
    })
    byProduct.set(product.id, { ...existing, variations: [...variationMap.values()] })
  })
  return [...byProduct.values()]
}

const extractLookupProducts = (payload: unknown): LookupProduct[] => {
  const root = isRecord(payload) ? payload : {}
  const nested = isRecord(root.data) ? root.data : null
  thresholdOverridePermission.value = Boolean(
    nested?.can_override_threshold
    ?? root.can_override_threshold
    ?? nested?.override_permission
    ?? root.override_permission,
  )

  const productsRaw = Array.isArray(nested?.products)
    ? nested.products
    : Array.isArray(root.products)
      ? root.products
      : []

  if (productsRaw.length > 0) {
    return mergeProducts(
      productsRaw.map(item => normalizeProduct(item)).filter((item): item is LookupProduct => !!item),
    )
  }

  const allocationsRaw = Array.isArray(nested?.allocations)
    ? nested.allocations
    : Array.isArray(root.allocations)
      ? root.allocations
      : isRecord(nested?.allocation)
        ? [nested.allocation]
        : isRecord(root.allocation)
          ? [root.allocation]
          : []

  const synthesizedProducts = allocationsRaw
    .map((item) => {
      if (!isRecord(item)) return null
      const productId = String(item.product_id ?? (isRecord(item.product) ? item.product.id : '') ?? '').trim()
      const variationId = String(item.variation_id ?? (isRecord(item.variation) ? item.variation.id : '') ?? '').trim()
      if (!productId || !variationId) return null
      const warehouseCandidate = isRecord(item.warehouse)
        ? item.warehouse
        : {
            id: item.warehouse_id,
            name: item.warehouse,
            available_stock: item.available_stock,
            can_override_threshold: item.can_override_threshold,
          }
      const warehouse = normalizeWarehouse(warehouseCandidate)
      const variation = normalizeVariation({
        id: variationId,
        label: item.variation,
        unit: item.unit,
        standard_price: item.standard_price,
        warehouses: warehouse ? [warehouse] : [],
      })
      if (!variation) return null
      const product = normalizeProduct({
        id: productId,
        name_en: item.product_name_en || item.product_name || item.product,
        name_ar: item.product_name_ar || item.product_name || item.product,
        barcode: item.barcode,
        variations: [variation],
      })
      return product
    })
    .filter((item): item is LookupProduct => !!item)

  return mergeProducts(synthesizedProducts)
}

const loadLookupProducts = async (params: { search?: string, barcode?: string } = {}) => {
  lookupLoading.value = true
  lookupError.value = ''
  try {
    const response = await $api<Record<string, unknown>>('/products', {
      params: {
        search: params.search?.trim() || undefined,
        name: params.search?.trim() || undefined,
        barcode: params.barcode?.trim() || undefined,
        per_page: 100,
      },
    })
    const products = extractLookupProducts(response)
    lookupResults.value = products
    return products
  }
  catch (error: unknown) {
    lookupError.value = getErrorMessage(error)
    lookupResults.value = []
    return []
  }
  finally {
    lookupLoading.value = false
  }
}

const findFirstEmptyRowIndex = () => {
  const idx = rows.value.findIndex(row => !row.product_id)
  return idx >= 0 ? idx : rows.value.length
}

const applyProductToRow = (row: AllocationRowDraft, product: LookupProduct, variationId: string | null = null) => {
  row.product = product
  row.product_id = product.id
  row.variation_id = ''
  row.warehouse_id = ''
  row.unit = ''
  row.available_stock = 0
  row.threshold_active = false
  row.threshold_min = null
  row.threshold_max = null
  row.can_override_threshold = false
  row.standard_price = 0
  row.tiers = [createEmptyTier()]

  if (variationId && product.variations.some(v => v.id === variationId)) {
    row.variation_id = variationId
    onVariationChange(row)
    return
  }

  if (product.variations.length === 1) {
    row.variation_id = product.variations[0]!.id
    onVariationChange(row)
  }
}

const addProductFromLookup = (product: LookupProduct, variationId: string | null = null) => {
  const targetIndex = findFirstEmptyRowIndex()
  if (targetIndex === rows.value.length) rows.value.push(createEmptyRow())
  const target = rows.value[targetIndex]!
  applyProductToRow(target, product, variationId)
}

const selectProductResult = (productId: string) => {
  const selected = lookupResults.value.find(item => item.id === productId)
  if (!selected) return
  addProductFromLookup(selected)
  searchQuery.value = ''
  lookupResults.value = []
}

const showAllProducts = async () => {
  lookupResults.value = await loadLookupProducts({ search: '' })
}

const onVariationChange = (row: AllocationRowDraft) => {
  const variation = getVariationOptions(row).find(v => v.id === row.variation_id)
  row.warehouse_id = ''
  row.available_stock = 0
  row.threshold_active = false
  row.threshold_min = null
  row.threshold_max = null
  row.can_override_threshold = thresholdOverridePermission.value
  row.unit = variation?.unit || ''
  row.standard_price = variation?.defaultStandardPrice ?? 0
}

const fetchThresholdMetadata = async (row: AllocationRowDraft) => {
  if (!distributorId.value || !row.variation_id || !row.warehouse_id) return
  try {
    const response = await $api<Record<string, unknown>>('/distributors/allocations', {
      params: {
        distributor_id: distributorId.value,
        variation_id: row.variation_id,
        warehouse_id: row.warehouse_id,
        metadata: 'threshold',
      },
    })
    const root = isRecord(response) ? response : {}
    const nested = isRecord(root.data) ? root.data : null
    const meta = (isRecord(nested?.threshold) ? nested?.threshold : null) || (isRecord(root.threshold) ? root.threshold : null)
    if (!meta) return
    row.threshold_active = Boolean(meta.threshold_active ?? row.threshold_active)
    row.threshold_min = Number.isFinite(Number(meta.min_quantity ?? meta.min_allocation_qty))
      ? Number(meta.min_quantity ?? meta.min_allocation_qty)
      : row.threshold_min
    row.threshold_max = Number.isFinite(Number(meta.max_quantity ?? meta.max_allocation_qty))
      ? Number(meta.max_quantity ?? meta.max_allocation_qty)
      : row.threshold_max
    row.can_override_threshold = Boolean(
      meta.can_override_threshold
      ?? meta.override_permission
      ?? row.can_override_threshold
      ?? thresholdOverridePermission.value,
    )
  }
  catch {
    // Secondary metadata API is best-effort; keep inventory-derived values.
  }
}

const onWarehouseChange = (row: AllocationRowDraft) => {
  const warehouse = getWarehouseOptions(row).find(w => w.id === row.warehouse_id)
  row.available_stock = warehouse?.availableStock ?? 0
  row.threshold_active = warehouse?.thresholdActive ?? false
  row.threshold_min = warehouse?.minQty ?? null
  row.threshold_max = warehouse?.maxQty ?? null
  row.can_override_threshold = Boolean(warehouse?.canOverrideThreshold || thresholdOverridePermission.value)
  fetchThresholdMetadata(row)
}

const addRow = () => {
  rows.value.push(createEmptyRow())
}

const removeRow = (index: number) => {
  if (rows.value.length <= 1) return
  rows.value.splice(index, 1)
}

const addTier = (row: AllocationRowDraft) => {
  const last = row.tiers[row.tiers.length - 1]
  const start = last ? last.to + 1 : 1
  row.tiers.push({ from: start, to: start, price: 0 })
}

const removeTier = (row: AllocationRowDraft, index: number) => {
  if (row.tiers.length <= 1) return
  row.tiers.splice(index, 1)
}

const handleBarcodeSubmit = async () => {
  const code = barcodeQuery.value.trim()
  if (!code) return
  const products = await loadLookupProducts({ barcode: code })
  const matched = products.find(p => p.variations.some(v => v.barcode === code) || p.barcode === code) ?? products[0]
  if (!matched) {
    toast.error(t('distributors_show.allocation_barcode_not_found'))
    return
  }
  const matchedVariation = matched.variations.find(v => v.barcode === code)
  addProductFromLookup(matched, matchedVariation?.id ?? null)
  barcodeQuery.value = ''
}

watch(searchQuery, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  const text = value.trim()
  if (!text) {
    lookupResults.value = []
    return
  }
  searchDebounceTimer = setTimeout(() => {
    loadLookupProducts({ search: text })
  }, 350)
})

const normalizeDistributorStatus = (value: unknown): 'active' | 'inactive' => {
  const status = getString(value).toLowerCase()
  if (status === 'active' || value === true || value === 1 || value === '1') return 'active'
  return 'inactive'
}

const loadDistributorMeta = async () => {
  if (!distributorId.value) return
  distributorLoading.value = true
  distributorError.value = ''
  try {
    const response = await $api<Record<string, unknown>>(`/distributors/${distributorId.value}`)
    const root = isRecord(response) ? response : {}
    const data = isRecord(root.data) ? root.data : null
    const raw = isRecord(root.distributor)
      ? root.distributor
      : isRecord(data?.distributor)
        ? data.distributor
        : data
    distributorActive.value = normalizeDistributorStatus(raw?.status ?? raw?.is_active) === 'active'
  }
  catch (error: unknown) {
    distributorError.value = getErrorMessage(error)
    distributorActive.value = false
  }
  finally {
    distributorLoading.value = false
  }
}

const getRowError = (row: AllocationRowDraft) => rowErrors.value[row.key] ?? {}

const validateTierRanges = (tiers: TierDraft[]): string | undefined => {
  if (!tiers.length) return t('distributors_show.allocation_validation_tiers_required')

  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i]!
    if (tier.from <= 0 || tier.to <= 0 || tier.to < tier.from) {
      return t('distributors_show.allocation_validation_tier_range_invalid')
    }
    if (tier.price <= 0) {
      return t('distributors_show.allocation_validation_tier_price_invalid')
    }
    if (i > 0) {
      const prev = tiers[i - 1]!
      if (tier.from !== prev.to + 1) {
        return t('distributors_show.allocation_validation_tier_sequential')
      }
    }
  }
  return undefined
}

const validateRows = (): boolean => {
  const nextErrors: Record<string, RowFieldErrors> = {}
  formError.value = ''

  if (!rows.value.length) {
    formError.value = t('distributors_show.allocation_validation_rows_required')
    rowErrors.value = {}
    return false
  }

  let validRows = 0

  rows.value.forEach((row) => {
    const errors: RowFieldErrors = {}

    if (!row.product_id) errors.product_id = t('distributors_show.allocation_validation_product_required')
    if (!row.variation_id) errors.variation_id = t('distributors_show.allocation_validation_variation_required')
    if (!row.warehouse_id) errors.warehouse_id = t('distributors_show.allocation_validation_warehouse_required')

    const quantity = Number(row.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.quantity = t('distributors_show.allocation_validation_quantity_invalid')
    }
    else {
      if (quantity > row.available_stock) {
        errors.quantity = t('distributors_show.allocation_validation_quantity_exceeds_stock')
      }
      if (row.threshold_active && !row.can_override_threshold) {
        if (row.threshold_min != null && quantity < row.threshold_min) {
          errors.quantity = t('distributors_show.allocation_validation_quantity_below_threshold', { min: row.threshold_min })
        }
        if (row.threshold_max != null && quantity > row.threshold_max) {
          errors.quantity = t('distributors_show.allocation_validation_quantity_above_threshold', { max: row.threshold_max })
        }
      }
    }

    if (row.pricing_method === 'standard') {
      if (!(Number(row.standard_price) > 0)) {
        errors.standard_price = t('distributors_show.allocation_validation_standard_price_required')
      }
    }
    else {
      const tierError = validateTierRanges(row.tiers)
      if (tierError) errors.tiers = tierError
    }

    if (Object.keys(errors).length > 0) nextErrors[row.key] = errors
    else if (row.product_id && row.variation_id && row.warehouse_id) validRows += 1
  })

  if (validRows === 0) {
    formError.value = t('distributors_show.allocation_validation_rows_required')
  }

  rowErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0 && validRows > 0
}

const buildRowPayload = (row: AllocationRowDraft) => ({
  variation_id: Number(row.variation_id),
  warehouse_id: Number(row.warehouse_id),
  quantity: Number(row.quantity),
  description: row.description || undefined,
})

const submitAllocation = async () => {
  if (!canAllocate.value) return
  if (!distributorId.value) {
    formError.value = t('distributors_show.allocation_distributor_required')
    return
  }
  if (!distributorActive.value) {
    toast.error(t('distributors_show.allocation_distributor_inactive'))
    return
  }
  if (!validateRows()) {
    toast.error(t('distributors_show.allocation_validation_failed'))
    return
  }

  submitting.value = true
  formError.value = ''
  try {
    const items = rows.value
      .filter(row => row.product_id && row.variation_id && row.warehouse_id)
      .map(row => buildRowPayload(row))

    await $api('/distributors/allocations', {
      method: 'POST',
      body: {
        allocations: items.map(item => ({
          distributor_id: Number(distributorId.value),
          variation_id: item.variation_id,
          warehouse_id: item.warehouse_id,
          quantity: item.quantity,
        })),
      },
    })

    toast.success(t('distributors_show.allocation_create_success'))
    await navigateTo({
      path: `/distributors/show/${distributorId.value}`,
      query: { tab: 'stock-allocation' },
      replace: true,
    })
  }
  catch (error: unknown) {
    const message = getErrorMessage(error)
    formError.value = message
    toast.error(message)
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  ensureRows()
  await loadDistributorMeta()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink :to="{ path: `/distributors/show/${distributorId || ''}`, query: { tab: 'stock-allocation' } }">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('distributors_show.stock_allocation_allocate_products') }}</h1>
        <p class="text-sm text-muted-foreground">{{ $t('distributors_show.stock_allocation_create_subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="!canAllocate"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ $t('distributors_show.no_view_permission') }}
    </div>

    <template v-else>
      <div
        v-if="distributorError"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {{ distributorError }}
      </div>

      <div class="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ $t('distributors_show.stock_allocation_col_product_name') }}</label>
            <div class="relative">
              <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="searchQuery"
                class="ps-9"
                :placeholder="$t('distributors_show.allocation_product_search_placeholder')"
              />
            </div>
            <div v-if="lookupLoading" class="text-xs text-muted-foreground">{{ $t('common.loading') }}</div>
            <div v-if="lookupResults.length" class="max-h-48 overflow-y-auto rounded-md border bg-background">
              <button
                v-for="product in lookupResults"
                :key="product.id"
                type="button"
                class="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted/40"
                @click="selectProductResult(product.id)"
              >
                <span>{{ productDisplayName(product) }}</span>
                <span class="text-xs text-muted-foreground">#{{ product.id }}</span>
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{ $t('distributors_show.allocation_barcode') }}</label>
            <div class="relative">
              <Barcode class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="barcodeQuery"
                class="ps-9"
                :placeholder="$t('distributors_show.allocation_barcode_placeholder')"
                @keydown.enter.prevent="handleBarcodeSubmit"
              />
            </div>
            <Button type="button" variant="outline" class="w-full gap-2 md:w-auto" :disabled="lookupLoading" @click="showAllProducts">
              <Loader2 v-if="lookupLoading" class="size-4 animate-spin" />
              <span>{{ $t('distributors_show.allocation_show_all_products') }}</span>
            </Button>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ $t('distributors_show.allocation_choose_product_hint') }}
        </p>

        <p v-if="lookupError" class="text-xs text-red-600">{{ lookupError }}</p>
        <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
      </div>

      <div class="overflow-hidden rounded-xl border">
        <div class="bg-section-items border-section-items text-white px-4 py-3 border-b flex items-center justify-between">
          <h2 class="font-semibold flex items-center gap-2">
            <Boxes class="size-4" />
            {{ $t('distributors_show.stock_allocation_allocate_products') }}
          </h2>
          <Button type="button" variant="outline" class="h-8 gap-1.5 w-full sm:w-auto" @click="addRow">
            <Plus class="size-4" />
            {{ $t('distributors_show.allocation_add_row') }}
          </Button>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader class="hidden md:table-header-group">
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="min-w-[280px] text-start">{{ $t('distributors_show.stock_allocation_col_product_name') }}</TableHead>
                <TableHead class="min-w-[160px] text-start">{{ $t('distributors_show.allocation_row_description') }}</TableHead>
                <TableHead class="w-24 text-start">{{ $t('distributors_show.allocation_quantity') }}</TableHead>
                <TableHead class="w-32 text-start">{{ $t('distributors_show.allocation_unit_price') }}</TableHead>
                <TableHead class="w-28 text-start">{{ $t('distributors_show.allocation_row_total') }}</TableHead>
                <TableHead class="w-12 text-start">{{ $t('distributors_show.stock_allocation_col_actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(row, idx) in rows"
                :key="row.key"
                class="flex flex-col gap-2 border-2 rounded-lg p-4 mb-4 shadow-sm
                       md:table-row md:border-0 md:rounded-none md:p-0 md:mb-0 md:shadow-none"
              >
                <!-- Product cell (nested: variation, warehouse, stock, pricing) -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[280px] md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ $t('distributors_show.stock_allocation_col_product_name') }}
                  </span>
                  <div class="flex min-w-0 flex-col gap-2">
                    <p class="text-sm font-medium leading-snug break-words">
                      {{ productDisplayName(row.product) }}
                    </p>
                    <p v-if="getRowError(row).product_id" class="text-xs text-red-600">{{ getRowError(row).product_id }}</p>

                    <!-- Variation -->
                    <Select
                      :model-value="row.variation_id"
                      @update:model-value="value => { row.variation_id = String(value ?? ''); onVariationChange(row) }"
                    >
                      <SelectTrigger class="h-8 w-full text-xs">
                        <SelectValue :placeholder="$t('distributors_show.stock_allocation_col_variation')" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="variation in getVariationOptions(row)"
                          :key="variation.id"
                          :value="variation.id"
                        >
                          {{ variation.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="getRowError(row).variation_id" class="text-xs text-red-600">{{ getRowError(row).variation_id }}</p>

                    <!-- Warehouse -->
                    <Select
                      :model-value="row.warehouse_id"
                      @update:model-value="value => { row.warehouse_id = String(value ?? ''); onWarehouseChange(row) }"
                    >
                      <SelectTrigger class="h-8 w-full text-xs">
                        <SelectValue :placeholder="$t('distributors_show.stock_allocation_filter_warehouse')" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="warehouse in getWarehouseOptions(row)"
                          :key="warehouse.id"
                          :value="warehouse.id"
                        >
                          {{ warehouse.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="getRowError(row).warehouse_id" class="text-xs text-red-600">{{ getRowError(row).warehouse_id }}</p>

                    <!-- Available Stock -->
                    <p class="text-xs text-muted-foreground">
                      {{ $t('distributors_show.allocation_available_stock') }}: <span class="tabular-nums font-medium">{{ row.available_stock }}</span>
                      <span v-if="row.unit" class="ms-1">{{ row.unit }}</span>
                    </p>

                    <!-- Pricing Method -->
                    <div class="space-y-1.5 border-t pt-2 mt-1">
                      <Select
                        :model-value="row.pricing_method"
                        @update:model-value="value => row.pricing_method = (String(value ?? 'standard') === 'tiered' ? 'tiered' : 'standard')"
                      >
                        <SelectTrigger class="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">{{ $t('distributors_show.allocation_pricing_standard') }}</SelectItem>
                          <SelectItem value="tiered">{{ $t('distributors_show.allocation_pricing_tiered') }}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div v-if="row.pricing_method === 'tiered'" class="space-y-1.5">
                        <div v-for="(tier, tierIdx) in row.tiers" :key="`${row.key}-tier-${tierIdx}`" class="grid grid-cols-3 gap-1.5">
                          <Input :model-value="tier.from" type="number" min="1" class="h-7 text-xs" :placeholder="$t('distributors_show.allocation_tier_from')" @update:model-value="v => tier.from = Math.max(1, Number(v) || 1)" />
                          <Input :model-value="tier.to" type="number" min="1" class="h-7 text-xs" :placeholder="$t('distributors_show.allocation_tier_to')" @update:model-value="v => tier.to = Math.max(1, Number(v) || 1)" />
                          <div class="flex items-center gap-1">
                            <Input :model-value="tier.price" type="number" min="0" step="0.01" class="h-7 text-xs" :placeholder="$t('distributors_show.allocation_tier_price')" @update:model-value="v => tier.price = Math.max(0, Number(v) || 0)" />
                            <Button type="button" variant="ghost" size="icon" class="size-6 shrink-0" @click="removeTier(row, tierIdx)">
                              <Trash2 class="size-3" />
                            </Button>
                          </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" class="h-7 text-xs" @click="addTier(row)">
                          {{ $t('distributors_show.allocation_add_tier') }}
                        </Button>
                        <p v-if="getRowError(row).tiers" class="text-xs text-red-600">{{ getRowError(row).tiers }}</p>
                      </div>
                    </div>
                  </div>
                </TableCell>

                <!-- Description -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[160px] md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ $t('distributors_show.allocation_row_description') }}
                  </span>
                  <Input v-model="row.description" class="w-full" />
                </TableCell>

                <!-- Qty -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ $t('distributors_show.allocation_quantity') }}
                  </span>
                  <div class="flex w-full flex-col gap-1 md:ms-auto md:max-w-24 md:items-end">
                    <Input
                      :model-value="row.quantity"
                      type="number"
                      min="1"
                      class="h-9 w-full text-start tabular-nums"
                      @update:model-value="value => row.quantity = Math.max(0, Number(value) || 0)"
                    />
                    <p v-if="getRowError(row).quantity" class="w-full text-start text-xs text-red-600">{{ getRowError(row).quantity }}</p>
                  </div>
                </TableCell>

                <!-- Unit Price -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ $t('distributors_show.allocation_unit_price') }}
                  </span>
                  <div class="flex w-full flex-col gap-1 md:ms-auto md:max-w-32 md:items-end">
                    <Input
                      :model-value="row.standard_price"
                      type="number"
                      min="0"
                      step="0.01"
                      class="h-9 w-full text-start tabular-nums"
                      @update:model-value="value => row.standard_price = Math.max(0, Number(value) || 0)"
                    />
                    <p v-if="getRowError(row).standard_price" class="w-full text-start text-xs text-red-600">{{ getRowError(row).standard_price }}</p>
                  </div>
                </TableCell>

                <!-- Total -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:align-top md:py-3 md:text-start md:tabular-nums">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">
                    {{ $t('distributors_show.allocation_row_total') }}
                  </span>
                  <div class="font-medium md:ms-auto md:flex md:h-9 md:max-w-28 md:items-center md:justify-start tabular-nums">
                    {{ formatMoney(rowTotal(row)) }}
                  </div>
                </TableCell>

                <!-- Delete -->
                <TableCell class="flex justify-end pt-2 border-t mt-1 md:table-cell md:border-0 md:align-top md:pt-3 md:mt-0 md:text-start">
                  <div class="flex h-9 items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0 text-red-600"
                      :disabled="rows.length <= 1"
                      @click="removeRow(idx)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div class="flex flex-col-reverse gap-3 rounded-xl border bg-card/80 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end sm:px-5">
        <Button
          type="button"
          variant="outline"
          class="h-10 w-full sm:w-auto"
          :disabled="submitting || distributorLoading"
          as-child
        >
          <NuxtLink :to="{ path: `/distributors/show/${distributorId || ''}`, query: { tab: 'stock-allocation' } }">
            {{ $t('common.cancel') }}
          </NuxtLink>
        </Button>
        <Button
          type="button"
          class="h-10 gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto"
          :disabled="submitting || distributorLoading || !distributorActive"
          @click="submitAllocation"
        >
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          <Boxes v-else class="size-4" />
          {{ $t('distributors_show.stock_allocation_allocate_products') }}
        </Button>
      </div>
    </template>
  </div>
</template>
