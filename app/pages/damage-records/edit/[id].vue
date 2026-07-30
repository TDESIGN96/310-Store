<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowRight,
  Barcode,
  FileText,
  Loader2,
  Package,
  Paperclip,
  Search,
  Trash2,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { onBeforeRouteLeave } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { QuotationProductOption, QuotationProductVariation } from '@/composables/useQuotationProducts'
import { useQuotationProducts } from '@/composables/useQuotationProducts'
import { useInvoiceWarehouses, type InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { useDamageRecordsStore, type DamageReason } from '@/stores/damageRecords'
import { normalizeBackendFieldErrors } from '@/composables/useBackendFieldErrors'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { t, locale } = useI18n()
const { can } = usePermissions()
const { $api } = useApi()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const config = useRuntimeConfig()
const authStore = useAuthStore()
const damageStore = useDamageRecordsStore()
const { searchProducts, lookupBarcode, getProductById, loadingProducts, resolvingBarcode } = useQuotationProducts()
const { loadActiveWarehouses } = useInvoiceWarehouses()

const canEditDamage = computed(() => can('damage.edit'))

interface UploadedFileResponse {
  data?: { file?: { url?: string; path?: string } }
}

interface WarehouseStockEntry extends InvoiceWarehouseOption {
  available_stock: number
}

const DAMAGE_REASONS: { value: DamageReason; labelKey: string }[] = [
  { value: 'manufacturing_defect', labelKey: 'damage_records_page.reason_manufacturing_defect' },
  { value: 'storage_damage', labelKey: 'damage_records_page.reason_storage_damage' },
  { value: 'transport_damage', labelKey: 'damage_records_page.reason_transport_damage' },
  { value: 'expired_material', labelKey: 'damage_records_page.reason_expired_material' },
  { value: 'customer_return_damaged', labelKey: 'damage_records_page.reason_customer_return_damaged' },
  { value: 'other', labelKey: 'damage_records_page.reason_other' },
]

const MAX_PHOTOS = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024

// ─── Page state ───────────────────────────────────────────────────────────────
const pageLoading = ref(true)
const editBlocked = ref(false)
const referenceId = ref('')
// prevent isDirty from firing during hydration
let hydrating = false

// ─── Product / Variation state ────────────────────────────────────────────────
const productSearch = ref('')
const barcodeInput = ref('')
const searchResults = ref<QuotationProductOption[]>([])
const selectedProduct = ref<QuotationProductOption | null>(null)
const selectedVariationId = ref<number | null>(null)
const loadingProductDetail = ref(false)
const allWarehouses = ref<InvoiceWarehouseOption[]>([])
const warehouseOptions = ref<WarehouseStockEntry[]>([])
let productSearchTimer: ReturnType<typeof setTimeout> | null = null

// ─── Form state ───────────────────────────────────────────────────────────────
const selectedWarehouseId = ref<number | null>(null)
const availableQty = ref<number>(0)
const unitPrice = ref<number>(0)
const damagedQty = ref<number | ''>('')
const damageReason = ref<DamageReason | ''>('')
const customReason = ref('')
const notes = ref('')
const existingPhotoUrls = ref<string[]>([])
const newPhotoFiles = ref<File[]>([])
const formErrors = ref<Record<string, string>>({})
const errorMessage = ref('')
const submitting = ref(false)
const unsavedDialogOpen = ref(false)
let pendingRouteLeaveResolve: ((value: boolean) => void) | null = null

// ─── Computed ─────────────────────────────────────────────────────────────────
const selectedVariation = computed(() =>
  selectedProduct.value?.variations.find(v => v.id === selectedVariationId.value) ?? null,
)

const sku = computed(() => selectedVariation.value?.sku ?? '')

const estimatedLoss = computed(() => {
  const qty = Number(damagedQty.value)
  if (!qty || !unitPrice.value) return 0
  return qty * unitPrice.value
})
const formatEstimatedLoss = (value: number) => formatDisplayNumber(value, { locale: locale.value })

const warehouseDisabled = computed(() => !selectedVariationId.value || loadingProductDetail.value)

const totalPhotos = computed(() => existingPhotoUrls.value.length + newPhotoFiles.value.length)

const isDirty = computed(() => {
  if (hydrating) return false
  return Boolean(
    selectedProduct.value || damagedQty.value || damageReason.value || notes.value
    || newPhotoFiles.value.length,
  )
})

const productLabel = (p: QuotationProductOption) =>
  locale.value === 'ar' ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar)

const variationOptionLabel = (v: QuotationProductVariation): string => {
  const parts: string[] = []
  if (v.label && v.label !== v.sku) parts.push(v.label)
  if (v.sku) parts.push(v.sku)
  return parts.join(' · ') || `#${v.id}`
}

const warehouseLabel = (w: InvoiceWarehouseOption) =>
  locale.value === 'ar' ? (w.name_ar || w.name_en) : (w.name_en || w.name_ar)

// ─── Product search ───────────────────────────────────────────────────────────
const triggerProductSearch = () => {
  if (productSearchTimer) clearTimeout(productSearchTimer)
  const query = productSearch.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  productSearchTimer = setTimeout(async () => {
    searchResults.value = await searchProducts(query)
  }, 300)
}

watch(productSearch, () => {
  if (selectedProduct.value && productSearch.value !== productLabel(selectedProduct.value)) {
    selectedProduct.value = null
    selectedVariationId.value = null
    selectedWarehouseId.value = null
    warehouseOptions.value = []
    availableQty.value = 0
    unitPrice.value = 0
  }
  triggerProductSearch()
})

const showAllProducts = async () => {
  searchResults.value = await searchProducts('')
}

const selectProductResult = async (product: QuotationProductOption) => {
  const full = await getProductById(product.id)
  selectedProduct.value = full ?? product
  searchResults.value = []
  productSearch.value = productLabel(selectedProduct.value)
  selectedVariationId.value = null
  selectedWarehouseId.value = null
  warehouseOptions.value = []
  availableQty.value = 0
  unitPrice.value = 0
  formErrors.value.variation_id = ''
  if (selectedProduct.value.variations.length === 1) {
    await selectVariation(selectedProduct.value.variations[0]!.id)
  }
}

const handleBarcodeSubmit = async () => {
  const code = barcodeInput.value.trim()
  if (!code) return
  const matched = await lookupBarcode(code)
  if (!matched) {
    toast.error(t('quotations_page.system_error_title'), {
      description: t('quotations_page.barcode_not_found'),
    })
    return
  }
  const full = await getProductById(matched.product.id)
  selectedProduct.value = full ?? matched.product
  productSearch.value = productLabel(selectedProduct.value)
  searchResults.value = []
  selectedVariationId.value = null
  selectedWarehouseId.value = null
  warehouseOptions.value = []
  formErrors.value.variation_id = ''
  if (matched.variationId) {
    await selectVariation(matched.variationId)
  }
  else if (selectedProduct.value.variations.length === 1) {
    await selectVariation(selectedProduct.value.variations[0]!.id)
  }
  barcodeInput.value = ''
}

// ─── Variation / warehouse loading ────────────────────────────────────────────
const selectVariation = async (variationId: number, keepWarehouse?: number) => {
  if (!selectedProduct.value) return
  loadingProductDetail.value = true
  selectedVariationId.value = variationId
  if (!keepWarehouse) selectedWarehouseId.value = null
  availableQty.value = 0
  formErrors.value.variation_id = ''

  try {
    const raw = await $api<Record<string, unknown>>(`/products/${selectedProduct.value.id}/variations/${variationId}`)
    const nested = raw?.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : null
    const variation = (nested?.variation ?? nested ?? raw) as Record<string, unknown>

    const inventory = Array.isArray(variation.inventory) ? variation.inventory as Record<string, unknown>[] : []
    const inventoryMap = new Map<number, number>()
    for (const item of inventory) {
      const wh = item.warehouse && typeof item.warehouse === 'object' ? item.warehouse as Record<string, unknown> : null
      const whId = wh ? Number(wh.id) : 0
      const qty = Number(item.quantity ?? item.qty ?? 0)
      if (whId > 0 && qty > 0) inventoryMap.set(whId, qty)
    }

    warehouseOptions.value = allWarehouses.value
      .filter(w => inventoryMap.has(w.id))
      .map(w => ({ ...w, available_stock: inventoryMap.get(w.id) ?? 0 }))

    unitPrice.value = Number(variation.price ?? variation.resolved_price ?? 0)

    if (keepWarehouse) {
      selectedWarehouseId.value = keepWarehouse
    }
  }
  catch {
    warehouseOptions.value = []
  }
  finally {
    loadingProductDetail.value = false
  }
}

const clearProduct = () => {
  selectedProduct.value = null
  selectedVariationId.value = null
  selectedWarehouseId.value = null
  warehouseOptions.value = []
  availableQty.value = 0
  unitPrice.value = 0
  productSearch.value = ''
  searchResults.value = []
}

// ─── Warehouse selection ──────────────────────────────────────────────────────
watch(selectedWarehouseId, (whId) => {
  if (!whId) {
    availableQty.value = 0
    return
  }
  const match = warehouseOptions.value.find(w => w.id === whId)
  availableQty.value = match?.available_stock ?? 0
  formErrors.value.warehouse_id = ''
})

// ─── Damage reason ────────────────────────────────────────────────────────────
watch(damageReason, (val) => {
  if (val !== 'other') customReason.value = ''
  formErrors.value.damage_reason = ''
})

// ─── Photo management ─────────────────────────────────────────────────────────
const removeExistingPhoto = (index: number) => {
  existingPhotoUrls.value.splice(index, 1)
}

const onPhotosChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  formErrors.value.photos = ''

  if (totalPhotos.value + files.length > MAX_PHOTOS) {
    formErrors.value.photos = t('damage_records_page.validation_photo_count')
    input.value = ''
    return
  }

  for (const file of files) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      formErrors.value.photos = t('damage_records_page.validation_photo_type')
      input.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      formErrors.value.photos = t('damage_records_page.validation_photo_size')
      input.value = ''
      return
    }
  }

  newPhotoFiles.value = [...newPhotoFiles.value, ...files]
  input.value = ''
}

const removeNewPhoto = (index: number) => {
  newPhotoFiles.value.splice(index, 1)
}

const uploadPhoto = async (file: File, token: string): Promise<string> => {
  const base = (config.public.apiBase as string).replace(/\/$/, '')
  const formData = new FormData()
  formData.append('file', file)
  const result = await $fetch<UploadedFileResponse>(`${base}/files`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const url = result?.data?.file?.url ?? result?.data?.file?.path
  if (!url) throw new Error('Upload did not return a file URL')
  return url
}

// ─── Validation ───────────────────────────────────────────────────────────────
const validate = (): boolean => {
  const errors: Record<string, string> = {}

  if (!selectedVariationId.value) {
    errors.variation_id = t('damage_records_page.validation_product_required')
  }
  if (!selectedWarehouseId.value) {
    errors.warehouse_id = t('damage_records_page.validation_warehouse_required')
  }

  const qty = Number(damagedQty.value)
  if (!damagedQty.value || !Number.isInteger(qty) || qty < 1) {
    errors.damaged_quantity = t('damage_records_page.validation_qty_required')
  }
  else if (availableQty.value > 0 && qty > availableQty.value) {
    errors.damaged_quantity = t('damage_records_page.validation_qty_exceeds', { available: availableQty.value })
  }

  if (!damageReason.value) {
    errors.damage_reason = t('damage_records_page.validation_reason_required')
  }

  if (damageReason.value === 'other') {
    if (!customReason.value.trim()) {
      errors.custom_reason = t('damage_records_page.validation_custom_reason_required')
    }
    else if (customReason.value.trim().length > 150) {
      errors.custom_reason = t('damage_records_page.validation_custom_reason_max')
    }
  }

  if (notes.value.trim().length > 500) {
    errors.notes = t('damage_records_page.validation_notes_max')
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// ─── Submit ───────────────────────────────────────────────────────────────────
const submit = async () => {
  if (editBlocked.value || !validate()) return
  submitting.value = true
  errorMessage.value = ''

  try {
    // Re-check status hasn't changed since page loaded
    const current = await damageStore.loadById(id.value)
    if (!current || current.status !== 'pending') {
      errorMessage.value = t('damage_records_page.edit_status_changed')
      editBlocked.value = true
      return
    }

    const token = authStore.token as string
    let newUrls: string[] = []
    if (newPhotoFiles.value.length) {
      newUrls = await Promise.all(newPhotoFiles.value.map(file => uploadPhoto(file, token)))
    }

    const allUrls = [...existingPhotoUrls.value, ...newUrls]

    await damageStore.updateRecord(id.value, {
      product_id: selectedProduct.value!.id,
      variation_id: selectedVariationId.value!,
      warehouse_id: selectedWarehouseId.value!,
      damaged_quantity: Number(damagedQty.value),
      damage_reason: damageReason.value as DamageReason,
      damage_reason_specified: damageReason.value === 'other' ? customReason.value.trim() : null,
      notes: notes.value.trim() || null,
      photo_urls: allUrls.length ? allUrls : null,
    })

    toast.success(t('damage_records_page.edit_success'))
    await navigateTo('/damage-records')
  }
  catch (err) {
    if (isValidationError(err)) {
      formErrors.value = { ...formErrors.value, ...normalizeBackendFieldErrors(getFieldErrors(err)) }
    }
    errorMessage.value = getErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  pageLoading.value = true
  errorMessage.value = ''

  if (!canEditDamage.value) {
    pageLoading.value = false
    return
  }

  try {
    const [warehouses, record] = await Promise.all([
      loadActiveWarehouses(),
      damageStore.loadById(id.value),
    ])
    allWarehouses.value = warehouses

    if (!record) {
      errorMessage.value = t('damage_records_page.not_found')
      pageLoading.value = false
      return
    }

    referenceId.value = record.reference_id

    if (record.status !== 'pending') {
      editBlocked.value = true
      pageLoading.value = false
      return
    }

    // Hydrate form — suppress isDirty during this phase
    hydrating = true

    const product = await getProductById(record.product_id)
    if (product) {
      selectedProduct.value = product
      productSearch.value = productLabel(product)
      // Load variation inventory and restore warehouse in one call
      await selectVariation(record.variation_id, record.warehouse_id)
    }

    damagedQty.value = record.damaged_quantity
    damageReason.value = record.damage_reason
    customReason.value = record.damage_reason_specified ?? ''
    notes.value = record.notes ?? ''
    existingPhotoUrls.value = [...record.photo_urls]

    hydrating = false
  }
  catch {
    errorMessage.value = t('damage_records_page.load_error')
  }
  finally {
    pageLoading.value = false
  }
})

// ─── Navigate-away guard ─────────────────────────────────────────────────────
onBeforeRouteLeave((_to, _from, next) => {
  if (!isDirty.value || submitting.value) {
    next()
    return
  }
  unsavedDialogOpen.value = true
  new Promise<boolean>((resolve) => {
    pendingRouteLeaveResolve = resolve
  }).then((confirmed) => {
    next(confirmed)
  })
})

const confirmLeave = () => {
  unsavedDialogOpen.value = false
  pendingRouteLeaveResolve?.(true)
  pendingRouteLeaveResolve = null
}

const cancelLeave = () => {
  unsavedDialogOpen.value = false
  pendingRouteLeaveResolve?.(false)
  pendingRouteLeaveResolve = null
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        class="size-9 shrink-0"
        as-child
      >
        <NuxtLink to="/damage-records">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ t('damage_records_page.edit_title') }}
          <span
            v-if="referenceId"
            class="text-muted-foreground font-normal text-xl ms-1"
          >#{{ referenceId }}</span>
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t('damage_records_page.edit_subtitle') }}
        </p>
      </div>
    </div>

    <!-- No permission -->
    <div
      v-if="!canEditDamage"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('damage_records_page.no_permission') }}
    </div>

    <!-- Page loading -->
    <div
      v-else-if="pageLoading"
      class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <!-- Edit blocked — status is not pending -->
      <div
        v-if="editBlocked"
        class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <p class="font-semibold mb-1">
          {{ t('damage_records_page.edit_blocked_title') }}
        </p>
        <p>{{ t('damage_records_page.edit_blocked_desc') }}</p>
      </div>

      <!-- Generic error (load failure / not found) -->
      <div
        v-else-if="errorMessage && !selectedProduct"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {{ errorMessage }}
      </div>

      <template v-else>
        <!-- Submit error -->
        <div
          v-if="errorMessage"
          class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {{ errorMessage }}
        </div>

        <!-- Product Selection Section -->
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <Package class="size-4 text-muted-foreground" />
            <h2 class="text-base font-semibold">
              {{ t('damage_records_page.product_label') }}
            </h2>
          </div>
          <CardContent class="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <div class="grid gap-3 md:grid-cols-2">
              <!-- Product Search -->
              <div class="space-y-2">
                <label class="text-sm font-medium">
                  {{ t('damage_records_page.product_label') }}
                  <span class="text-destructive ms-0.5">*</span>
                </label>
                <div class="relative">
                  <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    v-model="productSearch"
                    class="ps-9 pe-9"
                    :placeholder="t('damage_records_page.product_placeholder')"
                  />
                  <button
                    v-if="selectedProduct"
                    type="button"
                    class="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    @click="clearProduct"
                  >
                    <X class="w-4 h-4" />
                  </button>
                  <Loader2
                    v-else-if="loadingProducts"
                    class="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground"
                  />
                </div>
                <div
                  v-if="loadingProducts"
                  class="text-xs text-muted-foreground"
                >
                  {{ t('common.loading') }}
                </div>
                <!-- Product search results -->
                <div
                  v-if="searchResults.length && !selectedProduct"
                  class="max-h-48 overflow-y-auto rounded-md border bg-background"
                >
                  <button
                    v-for="product in searchResults"
                    :key="product.id"
                    type="button"
                    class="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted/40"
                    @click="selectProductResult(product)"
                  >
                    <span class="font-medium">{{ productLabel(product) }}</span>
                    <span class="text-xs text-muted-foreground">#{{ product.id }}</span>
                  </button>
                </div>
              </div>

              <!-- Barcode Search -->
              <div class="space-y-2">
                <label class="text-sm font-medium">
                  {{ t('products_variations.variation_barcode') }}
                </label>
                <div class="relative">
                  <Barcode class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    v-model="barcodeInput"
                    class="ps-9"
                    :placeholder="t('quotations_page.barcode_placeholder')"
                    @keydown.enter.prevent="handleBarcodeSubmit"
                  />
                </div>
                <div
                  v-if="resolvingBarcode"
                  class="text-xs text-muted-foreground flex items-center gap-1"
                >
                  <Loader2 class="w-3 h-3 animate-spin" />
                  {{ t('common.loading') }}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full gap-2 md:w-auto"
                  :disabled="loadingProducts"
                  @click="showAllProducts"
                >
                  <Loader2
                    v-if="loadingProducts"
                    class="size-4 animate-spin"
                  />
                  <span>{{ t('quotations_page.products') }}</span>
                </Button>
              </div>
            </div>

            <!-- Variation selector — shown when product has multiple variations -->
            <div
              v-if="selectedProduct && selectedProduct.variations.length > 1"
              class="space-y-2"
            >
              <label class="text-sm font-medium">
                {{ t('common.variation') }}
                <span class="text-destructive ms-0.5">*</span>
              </label>
              <Select
                :model-value="selectedVariationId ? String(selectedVariationId) : ''"
                @update:model-value="(val) => selectVariation(Number(val))"
              >
                <SelectTrigger
                  :aria-invalid="Boolean(formErrors.variation_id)"
                  :class="{ 'border-destructive': formErrors.variation_id }"
                >
                  <SelectValue :placeholder="t('common.select_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="variation in selectedProduct.variations"
                    :key="variation.id"
                    :value="String(variation.id)"
                  >
                    {{ variationOptionLabel(variation) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p
                v-if="formErrors.variation_id"
                class="text-xs text-destructive"
              >
                {{ formErrors.variation_id }}
              </p>
            </div>

            <!-- SKU (read-only) -->
            <div
              v-if="sku"
              class="space-y-2"
            >
              <label class="text-sm font-medium text-muted-foreground">{{ t('damage_records_page.sku_label') }}</label>
              <Input
                :model-value="sku"
                disabled
                class="bg-muted"
              />
            </div>

            <!-- Validation error when no variation dropdown shown -->
            <p
              v-if="formErrors.variation_id && !(selectedProduct && selectedProduct.variations.length > 1)"
              class="text-xs text-destructive"
            >
              {{ formErrors.variation_id }}
            </p>
          </CardContent>
        </Card>

        <!-- Damage Details Section -->
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
            <FileText class="size-4 text-white/70" />
            <h2 class="text-base font-semibold">
              {{ t('damage_records_page.details_section') }}
            </h2>
          </div>
          <CardContent class="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <!-- Reference ID (read-only) -->
            <div
              v-if="referenceId"
              class="space-y-2"
            >
              <label class="text-sm font-medium text-muted-foreground">{{ t('damage_records_page.reference_id_label') }}</label>
              <Input
                :model-value="referenceId"
                disabled
                class="bg-muted"
              />
            </div>

            <div class="grid gap-5 md:grid-cols-2">
              <!-- Warehouse -->
              <div class="space-y-2">
                <label class="text-sm font-medium">
                  {{ t('damage_records_page.warehouse_label') }}
                  <span class="text-destructive ms-0.5">*</span>
                </label>
                <Select
                  :model-value="selectedWarehouseId ? String(selectedWarehouseId) : ''"
                  :disabled="warehouseDisabled"
                  @update:model-value="(val) => { selectedWarehouseId = Number(val) }"
                >
                  <SelectTrigger
                    :aria-invalid="Boolean(formErrors.warehouse_id)"
                    :class="{ 'opacity-50': warehouseDisabled, 'border-destructive': formErrors.warehouse_id }"
                  >
                    <SelectValue :placeholder="warehouseDisabled ? t('damage_records_page.warehouse_disabled_hint') : t('damage_records_page.warehouse_placeholder')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="warehouse in warehouseOptions"
                      :key="warehouse.id"
                      :value="String(warehouse.id)"
                    >
                      {{ warehouseLabel(warehouse) }}
                      <span class="text-muted-foreground ms-1">({{ warehouse.available_stock }})</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p
                  v-if="formErrors.warehouse_id"
                  class="text-xs text-destructive"
                >
                  {{ formErrors.warehouse_id }}
                </p>
                <p
                  v-if="selectedVariationId && !warehouseDisabled"
                  class="text-xs text-muted-foreground"
                >
                  {{ t('damage_records_page.warehouse_hint') }}
                </p>
                <p
                  v-if="loadingProductDetail"
                  class="text-xs text-muted-foreground flex items-center gap-1"
                >
                  <Loader2 class="w-3 h-3 animate-spin" />
                  {{ t('common.loading') }}
                </p>
                <p
                  v-else-if="selectedVariationId && !warehouseOptions.length && !loadingProductDetail"
                  class="text-xs text-muted-foreground"
                >
                  {{ t('damage_records_page.no_warehouse_stock') }}
                </p>
              </div>

              <!-- Available Quantity (read-only) -->
              <div
                v-if="selectedWarehouseId"
                class="space-y-2"
              >
                <label class="text-sm font-medium">{{ t('damage_records_page.available_qty_label') }}</label>
                <Input
                  :model-value="String(availableQty)"
                  disabled
                  class="bg-muted"
                />
              </div>
            </div>

            <div class="grid gap-5 md:grid-cols-2">
              <!-- Damaged Quantity -->
              <div class="space-y-2">
                <label class="text-sm font-medium">
                  {{ t('damage_records_page.damaged_qty_label') }}
                  <span class="text-destructive ms-0.5">*</span>
                </label>
                <Input
                  v-model="damagedQty"
                  type="number"
                  min="1"
                  step="1"
                  :class="{ 'border-destructive': formErrors.damaged_quantity }"
                  @input="formErrors.damaged_quantity = ''"
                />
                <p
                  v-if="formErrors.damaged_quantity"
                  class="text-xs text-destructive"
                >
                  {{ formErrors.damaged_quantity }}
                </p>
              </div>

              <!-- Estimated Loss (read-only, computed) -->
              <div
                v-if="estimatedLoss > 0"
                class="space-y-2"
              >
                <label class="text-sm font-medium">{{ t('damage_records_page.estimated_loss_label') }}</label>
                <Input
                  :model-value="formatEstimatedLoss(estimatedLoss)"
                  disabled
                  class="bg-muted"
                />
              </div>
            </div>

            <!-- Damage Reason -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('damage_records_page.damage_reason_label') }}
                <span class="text-destructive ms-0.5">*</span>
              </label>
              <Select
                :model-value="damageReason"
                @update:model-value="(val) => { damageReason = val as DamageReason }"
              >
                <SelectTrigger
                  :aria-invalid="Boolean(formErrors.damage_reason)"
                  :class="{ 'border-destructive': formErrors.damage_reason }"
                >
                  <SelectValue :placeholder="t('damage_records_page.damage_reason_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="reason in DAMAGE_REASONS"
                    :key="reason.value"
                    :value="reason.value"
                  >
                    {{ t(reason.labelKey) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p
                v-if="formErrors.damage_reason"
                class="text-xs text-destructive"
              >
                {{ formErrors.damage_reason }}
              </p>
            </div>

            <!-- Custom Reason (only when "other") -->
            <div
              v-if="damageReason === 'other'"
              class="space-y-2"
            >
              <label class="text-sm font-medium">
                {{ t('damage_records_page.custom_reason_label') }}
                <span class="text-destructive ms-0.5">*</span>
              </label>
              <Input
                v-model="customReason"
                maxlength="150"
                :placeholder="t('damage_records_page.custom_reason_placeholder')"
                :class="{ 'border-destructive': formErrors.custom_reason }"
                @input="formErrors.custom_reason = ''"
              />
              <p
                v-if="formErrors.custom_reason"
                class="text-xs text-destructive"
              >
                {{ formErrors.custom_reason }}
              </p>
            </div>

            <!-- Photos -->
            <div class="space-y-3">
              <label class="text-sm font-medium">{{ t('damage_records_page.photos_label') }}</label>

              <!-- Existing photos thumbnails -->
              <div
                v-if="existingPhotoUrls.length"
                class="space-y-1.5"
              >
                <p class="text-xs text-muted-foreground">
                  {{ t('damage_records_page.existing_photos') }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="(url, idx) in existingPhotoUrls"
                    :key="idx"
                    class="relative group size-20 rounded-md overflow-hidden border bg-muted"
                  >
                    <img
                      :src="url"
                      :alt="`photo-${idx + 1}`"
                      class="size-full object-cover"
                    >
                    <button
                      type="button"
                      class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      :title="t('damage_records_page.remove_photo')"
                      @click="removeExistingPhoto(idx)"
                    >
                      <Trash2 class="size-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Add new photos -->
              <label
                v-if="totalPhotos < MAX_PHOTOS"
                class="flex items-center gap-2 w-full cursor-pointer border rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Paperclip class="w-4 h-4 shrink-0" />
                <span>{{ t('common.choose_files') }}</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  class="hidden"
                  @change="onPhotosChange"
                >
              </label>

              <p
                v-if="formErrors.photos"
                class="text-xs text-destructive"
              >
                {{ formErrors.photos }}
              </p>

              <!-- New photo file chips -->
              <div
                v-if="newPhotoFiles.length"
                class="flex flex-wrap gap-2"
              >
                <div
                  v-for="(file, idx) in newPhotoFiles"
                  :key="idx"
                  class="flex items-center gap-1.5 text-xs border rounded px-2 py-1 bg-muted"
                >
                  <span class="truncate max-w-[140px]">{{ file.name }}</span>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive"
                    @click="removeNewPhoto(idx)"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('damage_records_page.notes_label') }}</label>
              <textarea
                v-model="notes"
                rows="3"
                maxlength="500"
                class="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                :placeholder="t('damage_records_page.notes_placeholder')"
                :class="{ 'border-destructive': formErrors.notes }"
                @input="formErrors.notes = ''"
              />
              <p
                v-if="formErrors.notes"
                class="text-xs text-destructive"
              >
                {{ formErrors.notes }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <Button
                :disabled="submitting || editBlocked"
                @click="submit"
              >
                <Loader2
                  v-if="submitting"
                  class="w-4 h-4 me-2 animate-spin"
                />
                <span>{{ t('common.save') }}</span>
              </Button>
              <Button
                variant="outline"
                as-child
              >
                <NuxtLink to="/damage-records">
                  {{ t('common.cancel') }}
                </NuxtLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </template>
    </template>

    <!-- Navigate-away confirmation dialog -->
    <AlertDialog :open="unsavedDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('damage_records_page.unsaved_changes_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('damage_records_page.unsaved_changes_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelLeave">
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction @click="confirmLeave">
            {{ t('damage_records_page.unsaved_changes_confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
