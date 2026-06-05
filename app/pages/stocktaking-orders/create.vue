<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowRight,
  Barcode,
  ChevronDown,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerInput } from '@/components/ui/date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useStocktakingOrdersStore } from '@/stores/stocktakingOrders'
import { useInvoiceWarehouses, type InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { useStocktakingCounters, type CounterOption } from '@/composables/useStocktakingCounters'
import {
  firstStocktakingValidationToastDescription,
  validateStocktakingDraft,
} from '@/composables/useStocktakingDraftValidation'
import { fetchAllCategoriesPages, type CategoriesApi } from '@/utils/categoryList'
import type { QuotationProductOption } from '@/composables/useQuotationProducts'
import { useQuotationProducts } from '@/composables/useQuotationProducts'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { canCreate } = usePermissions()
const { $api } = useApi()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const stocktakingOrdersStore = useStocktakingOrdersStore()
const { loadActiveWarehouses, loadingWarehouses } = useInvoiceWarehouses()
const { loadAvailableCounters, loadingCounters } = useStocktakingCounters()
const { searchProducts, lookupBarcode, getProductById, loadingProducts, resolvingBarcode } = useQuotationProducts()

const canCreateStocktaking = computed(() => canCreate('stocktaking'))

interface CategoryOption {
  id: number
  name_ar: string
  name_en: string
}

interface PartialProductRow {
  key: string
  product: QuotationProductOption | null
  product_id: number | null
  variation_id: number | null
  categoryLabel: string
  warehouseQty: number
}

const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const counterOptions = ref<CounterOption[]>([])
const categoryOptions = ref<CategoryOption[]>([])
const partialProductRows = ref<PartialProductRow[]>([])
const formErrors = ref<Record<string, string>>({})
const errorMessage = ref('')
const productSearch = ref('')
const barcodeInput = ref('')
const searchResults = ref<QuotationProductOption[]>([])
const filterCategoryId = ref<'all' | string>('all')
const warehouseChangeDialogOpen = ref(false)
const pendingWarehouseId = ref<number | null>(null)
const previousWarehouseId = ref<number | null>(null)
const counterSearch = ref('')
let productSearchTimer: ReturnType<typeof setTimeout> | null = null
let partialRowKeyCounter = 0

const draft = computed(() => stocktakingOrdersStore.draft)
const submitting = computed(() => stocktakingOrdersStore.submitting)

const formatTodayPickerDate = (): string => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}-${month}-${year}`
}

const normalizePickerDate = (value: string): string | undefined => {
  const raw = value.trim()
  if (!raw) return undefined
  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!isoMatch) return undefined
  return raw
}

const toIsoDateTime = (value: string): string | undefined => {
  const normalized = normalizePickerDate(value)
  if (!normalized) return undefined
  return `${normalized}T00:00:00.000Z`
}

const parsePickerDate = (value: string): Date | null => {
  const normalized = normalizePickerDate(value)
  if (!normalized) return null
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

const startOfToday = (): Date => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const isFutureDate = computed(() => {
  const selected = parsePickerDate(draft.value.stocktaking_date)
  if (!selected) return false
  return selected.getTime() > startOfToday().getTime()
})

const formEnabled = computed(() => Boolean(draft.value.warehouse_id))
const showProductSelection = computed(() => formEnabled.value && draft.value.type === 'partial')
const showFirstReminder = computed(() => formEnabled.value && isFutureDate.value)
const showSecondReminder = computed(() =>
  showFirstReminder.value
  && draft.value.first_reminder_days != null
  && draft.value.first_reminder_days >= 1,
)

const warehouseDisplayName = (warehouse: InvoiceWarehouseOption): string => {
  if (locale.value === 'ar') return warehouse.name_ar || warehouse.name_en || `#${warehouse.id}`
  return warehouse.name_en || warehouse.name_ar || `#${warehouse.id}`
}

const selectedWarehouseName = computed(() => {
  const id = draft.value.warehouse_id
  if (!id) return ''
  const match = warehouseOptions.value.find(warehouse => warehouse.id === id)
  return match ? warehouseDisplayName(match) : ''
})

const categoryLabel = (category: CategoryOption): string => {
  if (locale.value === 'ar') return category.name_ar || category.name_en || `#${category.id}`
  return category.name_en || category.name_ar || `#${category.id}`
}

const selectedCounterIds = computed({
  get: () => draft.value.counter_ids,
  set: (value: number[]) => {
    draft.value.counter_ids = value
  },
})

const filteredCounters = computed(() => {
  const query = counterSearch.value.trim().toLowerCase()
  if (!query) return counterOptions.value
  return counterOptions.value.filter(counter =>
    counter.name.toLowerCase().includes(query)
    || String(counter.email ?? '').toLowerCase().includes(query),
  )
})

const selectedCountersLabel = computed(() => {
  if (!selectedCounterIds.value.length) return ''
  const selected = counterOptions.value.filter(counter => selectedCounterIds.value.includes(counter.id))
  const sep = locale.value === 'ar' ? '، ' : ', '
  return selected.map(counter => counter.name).join(sep)
})

const productSearchOptions = computed(() => ({
  warehouseId: draft.value.warehouse_id ?? undefined,
  categoryId: filterCategoryId.value === 'all' ? undefined : Number(filterCategoryId.value),
}))

const productDisplayName = (product: QuotationProductOption | null): string => {
  if (!product) return '—'
  if (locale.value === 'ar') return product.name_ar || product.name_en || `#${product.id}`
  return product.name_en || product.name_ar || `#${product.id}`
}

const selectedProductsCount = computed(() =>
  partialProductRows.value.filter(row => row.product_id && row.variation_id).length,
)

const createPartialRowKey = () => {
  partialRowKeyCounter += 1
  return `partial-row-${partialRowKeyCounter}`
}

const categoryLabelFromRaw = (raw: Record<string, unknown>, loc: string): string => {
  const category = raw.category && typeof raw.category === 'object'
    ? raw.category as Record<string, unknown>
    : null
  if (!category) return '—'
  if (loc === 'ar') return String(category.name_ar ?? category.name ?? category.name_en ?? '—')
  return String(category.name_en ?? category.name ?? category.name_ar ?? '—')
}

const warehouseQtyFromRaw = (raw: Record<string, unknown>, warehouseId: number, variationId?: number | null): number => {
  const variations = Array.isArray(raw.variations) ? raw.variations : []
  if (variationId) {
    const match = variations.find((row) => Number((row as Record<string, unknown>).id) === variationId)
    if (match && typeof match === 'object') {
      return Number((match as Record<string, unknown>).stock_quantity ?? 0) || 0
    }
  }
  const candidates = [raw.warehouses, raw.product_warehouses, raw.stocks, raw.inventories]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    for (const item of candidate) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const warehouse = row.warehouse && typeof row.warehouse === 'object'
        ? row.warehouse as Record<string, unknown>
        : row
      const id = Number(warehouse.id ?? row.warehouse_id)
      if (id !== warehouseId) continue
      const pivot = row.pivot && typeof row.pivot === 'object' ? row.pivot as Record<string, unknown> : row
      const qty = Number(pivot.quantity ?? pivot.qty ?? row.quantity ?? row.qty ?? 0)
      return Number.isFinite(qty) ? qty : 0
    }
  }
  return variations.reduce((sum, row) => {
    const variation = row as Record<string, unknown>
    return sum + Number(variation.stock_quantity ?? 0)
  }, 0)
}

const syncVariationIdsToDraft = () => {
  draft.value.selected_variation_ids = partialProductRows.value
    .map(row => row.variation_id)
    .filter((id): id is number => id != null && Number.isFinite(id) && id > 0)
}

const addProductRow = async (product: QuotationProductOption, variationId: number | null = null) => {
  if (!draft.value.warehouse_id) return
  const full = await getProductById(product.id)
  if (!full) return

  let resolvedVariationId = variationId
  if (full.variations.length === 1 && !resolvedVariationId) {
    resolvedVariationId = full.variations[0]?.id ?? null
  }

  if (resolvedVariationId && partialProductRows.value.some(row => row.variation_id === resolvedVariationId)) {
    toast.error(t('stocktaking_orders_page.create_error'), {
      description: t('stocktaking_orders_page.product_already_selected'),
    })
    return
  }

  const raw = await $api<Record<string, unknown>>(`/products/${product.id}`)
  const nested = raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : null
  const rawProduct = (nested?.product ?? raw.product ?? nested ?? raw) as Record<string, unknown>
  const loc = locale.value === 'ar' ? 'ar' : 'en'

  partialProductRows.value.push({
    key: createPartialRowKey(),
    product: full,
    product_id: full.id,
    variation_id: resolvedVariationId,
    categoryLabel: categoryLabelFromRaw(rawProduct, loc),
    warehouseQty: warehouseQtyFromRaw(rawProduct, draft.value.warehouse_id, resolvedVariationId),
  })
  syncVariationIdsToDraft()
  formErrors.value.selected_variation_ids = ''
}

const setRowVariation = (index: number, variationId: number) => {
  const row = partialProductRows.value[index]
  if (!row || !row.product) return
  if (partialProductRows.value.some((item, idx) => idx !== index && item.variation_id === variationId)) {
    toast.error(t('stocktaking_orders_page.create_error'), {
      description: t('stocktaking_orders_page.product_already_selected'),
    })
    return
  }
  row.variation_id = variationId
  formErrors.value[`row_${index}_variation`] = ''
  syncVariationIdsToDraft()
}

const removeProductRow = (index: number) => {
  partialProductRows.value.splice(index, 1)
  syncVariationIdsToDraft()
  formErrors.value.selected_variation_ids = ''
}

const handleBarcodeSubmit = async () => {
  const code = barcodeInput.value.trim()
  if (!code || !draft.value.warehouse_id) return
  const matched = await lookupBarcode(code, productSearchOptions.value)
  if (!matched) {
    toast.error(t('stocktaking_orders_page.create_error'), {
      description: t('purchase_bills_page.barcode_not_found'),
    })
    return
  }
  await addProductRow(matched.product, matched.variationId)
  barcodeInput.value = ''
}

const selectProductResult = async (productId: number) => {
  const picked = searchResults.value.find(row => row.id === productId)
  if (!picked) return
  await addProductRow(picked, null)
  searchResults.value = []
  productSearch.value = ''
}

const showAllProducts = async () => {
  if (!draft.value.warehouse_id) return
  searchResults.value = await searchProducts('', productSearchOptions.value)
}

const isCounterSelected = (counter: CounterOption) => selectedCounterIds.value.includes(counter.id)

const toggleCounter = (counter: CounterOption) => {
  const next = new Set(selectedCounterIds.value)
  if (next.has(counter.id)) next.delete(counter.id)
  else next.add(counter.id)
  selectedCounterIds.value = [...next]
  formErrors.value.counter_ids = ''
}

const removeCounter = (counterId: number) => {
  selectedCounterIds.value = selectedCounterIds.value.filter(id => id !== counterId)
}

const clearProductSelection = () => {
  partialProductRows.value = []
  draft.value.selected_variation_ids = []
  productSearch.value = ''
  barcodeInput.value = ''
  searchResults.value = []
  filterCategoryId.value = 'all'
}

const applyWarehouseChange = async (warehouseId: number) => {
  draft.value.warehouse_id = warehouseId
  clearProductSelection()
}

const onWarehouseChange = async (value: unknown) => {
  const nextId = Number(value)
  if (!Number.isFinite(nextId) || nextId <= 0) {
    draft.value.warehouse_id = null
    clearProductSelection()
    return
  }

  const currentId = draft.value.warehouse_id
  if (
    currentId
    && currentId !== nextId
    && draft.value.type === 'partial'
    && partialProductRows.value.length > 0
  ) {
    pendingWarehouseId.value = nextId
    previousWarehouseId.value = currentId
    warehouseChangeDialogOpen.value = true
    return
  }

  await applyWarehouseChange(nextId)
  formErrors.value.warehouse_id = ''
}

const confirmWarehouseChange = async () => {
  if (!pendingWarehouseId.value) return
  await applyWarehouseChange(pendingWarehouseId.value)
  pendingWarehouseId.value = null
  previousWarehouseId.value = null
  warehouseChangeDialogOpen.value = false
}

const cancelWarehouseChange = () => {
  pendingWarehouseId.value = null
  previousWarehouseId.value = null
  warehouseChangeDialogOpen.value = false
}

const warehouseSelectValue = computed(() => {
  if (warehouseChangeDialogOpen.value && previousWarehouseId.value) {
    return String(previousWarehouseId.value)
  }
  return draft.value.warehouse_id ? String(draft.value.warehouse_id) : undefined
})

const adjustReminder = (field: 'first_reminder_days' | 'second_reminder_days', delta: number) => {
  const current = draft.value[field]
  const base = current == null ? (delta > 0 ? 1 : 0) : current + delta
  if (base <= 0) {
    draft.value[field] = null
    if (field === 'first_reminder_days') draft.value.second_reminder_days = null
    return
  }
  draft.value[field] = Math.min(30, Math.max(1, base))
}

watch(
  () => draft.value.type,
  (type) => {
    if (type === 'full') {
      clearProductSelection()
      formErrors.value.selected_variation_ids = ''
    }
  },
)

watch(
  () => draft.value.first_reminder_days,
  (value) => {
    if (value == null) draft.value.second_reminder_days = null
  },
)

watch(isFutureDate, (future) => {
  if (!future) {
    draft.value.first_reminder_days = null
    draft.value.second_reminder_days = null
  }
})

watch(productSearch, (value) => {
  if (!draft.value.warehouse_id || draft.value.type !== 'partial') return
  if (productSearchTimer) clearTimeout(productSearchTimer)
  const text = value.trim()
  if (!text) {
    searchResults.value = []
    return
  }
  productSearchTimer = setTimeout(async () => {
    searchResults.value = await searchProducts(text, productSearchOptions.value)
  }, 350)
})

watch(filterCategoryId, async () => {
  if (!productSearch.value.trim() || !draft.value.warehouse_id || draft.value.type !== 'partial') return
  searchResults.value = await searchProducts(productSearch.value.trim(), productSearchOptions.value)
})

const validate = (): boolean => {
  syncVariationIdsToDraft()
  const errors = validateStocktakingDraft(draft.value, t)
  partialProductRows.value.forEach((row, idx) => {
    if (!row.product_id) return
    if (row.product?.variations.length && !row.variation_id) {
      errors[`row_${idx}_variation`] = t('purchase_bills_page.variation_required')
    }
  })
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const submitCreate = async () => {
  if (!canCreateStocktaking.value) return
  if (!validate()) {
    toast.error(t('stocktaking_orders_page.create_error'), {
      description: firstStocktakingValidationToastDescription(formErrors.value),
    })
    return
  }

  errorMessage.value = ''
  const stocktakingDate = toIsoDateTime(draft.value.stocktaking_date)
  if (!stocktakingDate || !draft.value.warehouse_id) return

  const payload = {
    warehouse_id: draft.value.warehouse_id,
    type: draft.value.type,
    stocktaking_date: stocktakingDate,
    show_registered_quantities: draft.value.show_registered_quantities,
    first_reminder_days: isFutureDate.value ? draft.value.first_reminder_days : null,
    second_reminder_days: isFutureDate.value ? draft.value.second_reminder_days : null,
    notes: draft.value.notes.trim() || null,
    counter_ids: draft.value.counter_ids,
    ...(draft.value.type === 'partial'
      ? { variation_ids: [...draft.value.selected_variation_ids] }
      : {}),
  }

  try {
    await stocktakingOrdersStore.createOrder(payload)
    toast.success(t('stocktaking_orders_page.create_success'))
    await navigateTo('/stocktaking-orders')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fieldErrors = getFieldErrors(error)
      formErrors.value = {
        ...formErrors.value,
        warehouse_id: fieldErrors.warehouse_id ?? formErrors.value.warehouse_id ?? '',
        stocktaking_date: fieldErrors.stocktaking_date ?? formErrors.value.stocktaking_date ?? '',
        counter_ids: fieldErrors.counter_ids ?? formErrors.value.counter_ids ?? '',
        selected_variation_ids: fieldErrors.variation_ids ?? formErrors.value.selected_variation_ids ?? '',
        first_reminder_days: fieldErrors.first_reminder_days ?? formErrors.value.first_reminder_days ?? '',
        second_reminder_days: fieldErrors.second_reminder_days ?? formErrors.value.second_reminder_days ?? '',
      }
      toast.error(getErrorMessage(error))
      return
    }
    const msg = getErrorMessage(error)
    errorMessage.value = msg
    toast.error(msg || t('stocktaking_orders_page.create_error'))
  }
}

onMounted(async () => {
  stocktakingOrdersStore.resetDraft()
  draft.value.stocktaking_date = formatTodayPickerDate()
  warehouseOptions.value = await loadActiveWarehouses()
  counterOptions.value = await loadAvailableCounters()
  categoryOptions.value = await fetchAllCategoriesPages<CategoryOption>($api as CategoriesApi, { status: 'active' })
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink to="/stocktaking-orders">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('stocktaking_orders_page.create_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('stocktaking_orders_page.create_subtitle') }}</p>
      </div>
    </div>

    <div v-if="!canCreateStocktaking" class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">
      {{ t('stocktaking_orders_page.no_permission') }}
    </div>

    <template v-else>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('stocktaking_orders_page.create_title') }}</h2>
        </div>
        <CardContent class="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('stocktaking_orders_page.col_ref_id') }}</label>
              <Input
                :model-value="t('stocktaking_orders_page.reference_id_placeholder')"
                disabled
                class="bg-muted/40"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('stocktaking_orders_page.warehouse_label') }}
                <span class="text-red-500">*</span>
              </label>
              <Select
                :model-value="warehouseSelectValue"
                :disabled="loadingWarehouses"
                @update:model-value="onWarehouseChange"
              >
                <SelectTrigger :class="formErrors.warehouse_id ? 'border-red-500' : ''">
                  <SelectValue :placeholder="t('stocktaking_orders_page.select_warehouse')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="warehouse in warehouseOptions"
                    :key="warehouse.id"
                    :value="String(warehouse.id)"
                  >
                    {{ warehouseDisplayName(warehouse) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="formErrors.warehouse_id" class="text-xs text-red-500">{{ formErrors.warehouse_id }}</p>
            </div>

            <fieldset :disabled="!formEnabled" class="space-y-2 border-0 p-0 m-0 min-w-0">
              <label class="text-sm font-medium">
                {{ t('stocktaking_orders_page.type_label') }}
                <span class="text-red-500">*</span>
              </label>
              <Select
                v-model="draft.type"
              >
                <SelectTrigger :class="formErrors.type ? 'border-red-500' : ''">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{{ t('stocktaking_orders_page.type_full_option') }}</SelectItem>
                  <SelectItem value="partial">{{ t('stocktaking_orders_page.type_partial_option') }}</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="formErrors.type" class="text-xs text-red-500">{{ formErrors.type }}</p>
            </fieldset>

            <fieldset :disabled="!formEnabled" class="space-y-2 border-0 p-0 m-0 min-w-0">
              <label class="text-sm font-medium">
                {{ t('stocktaking_orders_page.stocktaking_date_label') }}
                <span class="text-red-500">*</span>
              </label>
              <DatePickerInput
                v-model="draft.stocktaking_date"
                :class="`w-full ${formErrors.stocktaking_date ? 'border-red-500' : ''}`"
              />
              <p v-if="formErrors.stocktaking_date" class="text-xs text-red-500">{{ formErrors.stocktaking_date }}</p>
            </fieldset>
          </div>

          <div v-if="showFirstReminder" class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('stocktaking_orders_page.first_reminder_label') }}</label>
              <div class="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  class="size-9"
                  :disabled="draft.first_reminder_days == null"
                  @click="adjustReminder('first_reminder_days', -1)"
                >
                  <Minus class="size-4" />
                </Button>
                <Input
                  :model-value="draft.first_reminder_days ?? ''"
                  readonly
                  class="w-16 text-center tabular-nums"
                />
                <Button type="button" variant="outline" size="icon" class="size-9" @click="adjustReminder('first_reminder_days', 1)">
                  <Plus class="size-4" />
                </Button>
                <span class="text-sm text-muted-foreground">{{ t('stocktaking_orders_page.reminder_days_suffix') }}</span>
              </div>
              <p v-if="formErrors.first_reminder_days" class="text-xs text-red-500">{{ formErrors.first_reminder_days }}</p>
            </div>

            <div v-if="showSecondReminder" class="space-y-2">
              <label class="text-sm font-medium">{{ t('stocktaking_orders_page.second_reminder_label') }}</label>
              <div class="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  class="size-9"
                  :disabled="draft.second_reminder_days == null"
                  @click="adjustReminder('second_reminder_days', -1)"
                >
                  <Minus class="size-4" />
                </Button>
                <Input
                  :model-value="draft.second_reminder_days ?? ''"
                  readonly
                  class="w-16 text-center tabular-nums"
                />
                <Button type="button" variant="outline" size="icon" class="size-9" @click="adjustReminder('second_reminder_days', 1)">
                  <Plus class="size-4" />
                </Button>
                <span class="text-sm text-muted-foreground">{{ t('stocktaking_orders_page.reminder_days_suffix') }}</span>
              </div>
              <p v-if="formErrors.second_reminder_days" class="text-xs text-red-500">{{ formErrors.second_reminder_days }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                :model-value="draft.show_registered_quantities"
                :disabled="!formEnabled"
                @update:model-value="draft.show_registered_quantities = Boolean($event)"
              />
              {{ t('stocktaking_orders_page.show_quantities_label') }}
            </label>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">
              {{ t('stocktaking_orders_page.assigned_counters_label') }}
              <span class="text-red-500">*</span>
            </label>
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  role="combobox"
                  class="w-full justify-between font-normal"
                  :disabled="!formEnabled || loadingCounters"
                  :class="formErrors.counter_ids ? 'border-red-500' : ''"
                >
                  <span class="truncate">
                    {{ selectedCountersLabel || t('stocktaking_orders_page.select_counters') }}
                  </span>
                  <ChevronDown class="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[var(--reka-popover-trigger-width)] p-0 overflow-hidden" align="start">
                <div class="border-b p-2">
                  <Input v-model="counterSearch" :placeholder="t('stocktaking_orders_page.select_counters')" />
                </div>
                <div v-if="loadingCounters" class="p-4 text-sm text-muted-foreground text-center">
                  {{ t('common.loading') }}…
                </div>
                <div v-else-if="!filteredCounters.length" class="p-4 text-sm text-muted-foreground text-center">
                  {{ t('stocktaking_orders_page.no_counters_available') }}
                </div>
                <div v-else class="max-h-60 overflow-y-auto">
                  <button
                    v-for="counter in filteredCounters"
                    :key="counter.id"
                    type="button"
                    class="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
                    :class="isCounterSelected(counter) ? 'bg-primary/15 text-primary font-medium' : ''"
                    @click="toggleCounter(counter)"
                  >
                    <Checkbox :model-value="isCounterSelected(counter)" class="pointer-events-none" />
                    <span class="truncate">{{ counter.name }}</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <div v-if="selectedCounterIds.length" class="flex flex-wrap gap-2">
              <Badge
                v-for="counterId in selectedCounterIds"
                :key="counterId"
                variant="secondary"
                class="gap-1"
              >
                {{ counterOptions.find(item => item.id === counterId)?.name || `#${counterId}` }}
                <button type="button" class="rounded-sm hover:bg-muted" @click="removeCounter(counterId)">
                  <X class="size-3" />
                </button>
              </Badge>
            </div>
            <p v-if="formErrors.counter_ids" class="text-xs text-red-500">{{ formErrors.counter_ids }}</p>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('stocktaking_orders_page.notes_label') }}</label>
            <textarea
              v-model="draft.notes"
              rows="4"
              class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              :placeholder="t('stocktaking_orders_page.notes_placeholder')"
              :disabled="!formEnabled"
            />
          </div>
        </CardContent>
      </Card>

      <Card v-if="showProductSelection" class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-muted-foreground" />
          <div>
            <h2 class="text-base font-semibold">{{ t('stocktaking_orders_page.product_selection_title') }}</h2>
            <p class="text-sm text-muted-foreground mt-0.5">{{ t('stocktaking_orders_page.product_selection_subtitle') }}</p>
          </div>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('quotations_page.products') }}</label>
              <div class="relative">
                <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  v-model="productSearch"
                  class="ps-9"
                  :placeholder="t('stocktaking_orders_page.product_search_placeholder')"
                />
              </div>
              <div v-if="loadingProducts" class="text-xs text-muted-foreground">{{ t('common.loading') }}</div>
              <div
                v-if="searchResults.length"
                class="max-h-48 overflow-y-auto rounded-md border bg-background"
              >
                <button
                  v-for="product in searchResults"
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
              <label class="text-sm font-medium">{{ t('products_variations.variation_barcode') }}</label>
              <div class="relative">
                <Barcode class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  v-model="barcodeInput"
                  class="ps-9"
                  :placeholder="t('quotations_page.barcode_placeholder')"
                  @keydown.enter.prevent="handleBarcodeSubmit"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                class="w-full gap-2 md:w-auto"
                :disabled="loadingProducts || resolvingBarcode"
                @click="showAllProducts"
              >
                <Loader2 v-if="loadingProducts || resolvingBarcode" class="size-4 animate-spin" />
                <span>{{ t('quotations_page.products') }}</span>
              </Button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Select v-model="filterCategoryId">
              <SelectTrigger class="h-9 w-[220px]">
                <SelectValue :placeholder="t('stocktaking_orders_page.category_filter_label')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{{ t('stocktaking_orders_page.category_all') }}</SelectItem>
                <SelectItem
                  v-for="category in categoryOptions"
                  :key="category.id"
                  :value="String(category.id)"
                >
                  {{ categoryLabel(category) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-sm text-muted-foreground">
              {{ t('stocktaking_orders_page.selected_products_count', { count: selectedProductsCount }) }}
            </p>
          </div>

          <p v-if="formErrors.selected_variation_ids" class="text-xs text-red-600">{{ formErrors.selected_variation_ids }}</p>

          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="min-w-[200px] text-start">{{ t('quotations_page.col_product') }}</TableHead>
                    <TableHead class="min-w-[160px] text-start">{{ t('stocktaking_orders_page.category_filter_label') }}</TableHead>
                    <TableHead class="w-28 text-start">{{ t('stocktaking_orders_page.col_warehouse') }}</TableHead>
                    <TableHead class="w-12 text-start">{{ t('quotations_page.col_actions') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!partialProductRows.length">
                    <TableCell :colspan="4" class="py-10 text-center text-sm text-muted-foreground">
                      {{ t('stocktaking_orders_page.no_products_for_warehouse') }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-for="(row, idx) in partialProductRows" :key="row.key">
                    <TableCell class="align-top whitespace-normal min-w-[200px] py-3">
                      <div class="flex min-w-0 flex-col gap-2">
                        <p class="text-sm font-medium leading-snug break-words">
                          {{ productDisplayName(row.product) }}
                        </p>
                        <Select
                          v-if="row.product?.variations.length"
                          :model-value="row.variation_id ? String(row.variation_id) : ''"
                          @update:model-value="value => setRowVariation(idx, Number(value))"
                        >
                          <SelectTrigger class="w-full max-w-full">
                            <SelectValue :placeholder="t('quotations_page.select_variation')" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="variation in row.product.variations"
                              :key="variation.id"
                              :value="String(variation.id)"
                            >
                              {{ variation.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p v-if="formErrors[`row_${idx}_variation`]" class="text-xs text-red-600">
                          {{ formErrors[`row_${idx}_variation`] }}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell class="align-top text-sm text-muted-foreground py-3">{{ row.categoryLabel }}</TableCell>
                    <TableCell class="align-top text-sm py-3">{{ selectedWarehouseName || '—' }}</TableCell>
                    <TableCell class="align-top py-3">
                      <Button type="button" variant="ghost" size="icon" class="size-8" @click="removeProductRow(idx)">
                        <Trash2 class="size-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        v-if="errorMessage"
        class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        <span class="mt-0.5 shrink-0">⚠</span>
        <span>{{ errorMessage }}</span>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" as-child>
          <NuxtLink to="/stocktaking-orders">{{ t('stocktaking_orders_page.cancel') }}</NuxtLink>
        </Button>
        <Button
          class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]"
          :disabled="submitting"
          @click="submitCreate"
        >
          <Loader2 v-if="submitting" class="me-2 size-4 animate-spin" />
          {{ t('stocktaking_orders_page.submit_create') }}
        </Button>
      </div>
    </template>

    <AlertDialog :open="warehouseChangeDialogOpen" @update:open="warehouseChangeDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('stocktaking_orders_page.warehouse_change_warning_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('stocktaking_orders_page.warehouse_change_warning_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelWarehouseChange">
            {{ t('stocktaking_orders_page.warehouse_change_cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction @click="confirmWarehouseChange">
            {{ t('stocktaking_orders_page.warehouse_change_confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
