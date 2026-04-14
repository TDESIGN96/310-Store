<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import ComboDetailsSection from '@/components/products/create/ComboDetailsSection.vue'
import ComboBundleComponentsSection from '@/components/products/create/ComboBundleComponentsSection.vue'
import ComboPriceAssignmentSection from '@/components/products/create/ComboPriceAssignmentSection.vue'
import { normalizeApiLocale } from '@/utils/apiLocale'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const route = useRoute()
const id = computed(() => route.params.id)
const { can: canPerm } = usePermissions()
const canShowProduct = computed(() => canPerm('products.show'))
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const { $api } = useApi()
const config = useRuntimeConfig()
const authStore = useAuthStore()
const canEdit = authStore.hasPermission('products.update')

const detailsRef = ref<InstanceType<typeof ComboDetailsSection> | null>(null)
const bundleRef = ref<InstanceType<typeof ComboBundleComponentsSection> | null>(null)
const priceRef = ref<InstanceType<typeof ComboPriceAssignmentSection> | null>(null)

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const TEMP_COMBO_WAREHOUSE_ID = 1
const TEMP_COMBO_QUANTITY = 1
const TEMP_COMBO_MIN_QUANTITY = 0

interface UploadedFileResponse {
  data?: { file?: { path?: string; url?: string } }
}

interface WarehouseListItem {
  id?: number | string
}

interface WarehousesListResponse {
  data?: { warehouses?: WarehouseListItem[] }
  warehouses?: WarehouseListItem[]
}

interface ComboEditData {
  id: number
  name_en?: string
  name_ar?: string
  sku?: string
  description?: string
  category?: { id?: number }
  unit?: { id?: number }
  is_combo?: boolean | number | string
  product_type?: string
  combo_items?: Array<{ product_id?: number | string; quantity?: number | string }>
  price?: string | number
  tiered_prices?: Array<{
    quantity_from?: string | number
    quantity_to?: string | number
    price?: string | number
  }>
}

interface ProductShowResponse {
  data?: { product?: ComboEditData }
  product?: ComboEditData
}

function isComboValue(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    return normalized === 'true' || normalized === 'combo'
  }
  return false
}

async function uploadFileAndGetUrl(file: File, token: string): Promise<string> {
  const base = config.public.apiBase as string
  const formData = new FormData()
  formData.append('file', file)
  const uploadResult = await $fetch<UploadedFileResponse>(`${base.replace(/\/$/, '')}/files`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Language': normalizeApiLocale(locale.value),
    },
  })
  const fileUrl = uploadResult?.data?.file?.url || uploadResult?.data?.file?.path
  if (!fileUrl) throw new Error('File upload response did not include url/path')
  return fileUrl
}

async function resolveDummyWarehouseId(token: string): Promise<number> {
  const base = config.public.apiBase as string
  try {
    const response = await $fetch<WarehousesListResponse>(`${base.replace(/\/$/, '')}/warehouses`, {
      method: 'GET',
      query: { page: 1, per_page: 100, status: 'active' },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': normalizeApiLocale(locale.value),
      },
    })
    const list = response.data?.warehouses ?? response.warehouses ?? []
    const firstWarehouse = list.find((w) => {
      const warehouseId = Number(w.id)
      return Number.isFinite(warehouseId) && warehouseId > 0
    })
    if (!firstWarehouse) return TEMP_COMBO_WAREHOUSE_ID
    return Number(firstWarehouse.id)
  }
  catch {
    return TEMP_COMBO_WAREHOUSE_ID
  }
}

async function loadProduct() {
  loading.value = true
  errorMessage.value = ''
  let prefillProduct: ComboEditData | null = null
  try {
    const res = await $api<ProductShowResponse>(`/products/${id.value}`)
    const p = res.data?.product ?? res.product
    if (!p) {
      errorMessage.value = t('products_page.not_found')
      return
    }
    const isCombo = isComboValue(p.is_combo) || (typeof p.product_type === 'string' && p.product_type.toLowerCase() === 'combo')
    if (!isCombo) {
      await navigateTo(`/products/edit/${id.value}`)
      return
    }
    prefillProduct = p
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    loading.value = false
  }

  if (!prefillProduct || errorMessage.value) return

  await nextTick()
  detailsRef.value?.setInitialData({
    name_ar: prefillProduct.name_ar,
    name_en: prefillProduct.name_en,
    sku: prefillProduct.sku,
    category_id: prefillProduct.category?.id ?? null,
    unit_id: prefillProduct.unit?.id ?? null,
    description: prefillProduct.description ?? '',
  })
  bundleRef.value?.setBundleItems(prefillProduct.combo_items ?? [])
  priceRef.value?.setPricing({
    price: prefillProduct.price ?? '',
    tiered_prices: prefillProduct.tiered_prices ?? [],
  })
}

async function handleSave() {
  if (!canEdit) return
  errorMessage.value = ''

  const detailsOk = detailsRef.value?.validate() ?? false
  const bundleOk = bundleRef.value?.validate() ?? false
  const priceOk = priceRef.value?.validate() ?? false
  if (!detailsOk || !bundleOk || !priceOk) return

  const token = authStore.token
  if (!token) {
    errorMessage.value = t('products_form.not_authenticated')
    return
  }

  submitting.value = true
  try {
    const detailsPayload = detailsRef.value!.getPayload()
    const bundleItems = bundleRef.value!.getBundleItems()
    const pricing = priceRef.value!.getPricingPayload()
    const dummyWarehouseId = await resolveDummyWarehouseId(token)

    const payload: Record<string, unknown> = {
      name_ar: detailsPayload.name_ar,
      name_en: detailsPayload.name_en,
      sku: detailsPayload.sku,
      category_id: Number(detailsPayload.category_id),
      unit_id: Number(detailsPayload.unit_id),
      inventory: [] as Array<Record<string, unknown>>,
      description: detailsPayload.description || undefined,
      is_combo: true,
      combo_items: bundleItems,
      price: Number(pricing.price),
      tiered_prices: pricing.tiered_prices,
    }

    const inventory = payload.inventory as Array<Record<string, unknown>>
    inventory.push({
      warehouse_id: Number(dummyWarehouseId),
      quantity: Number(TEMP_COMBO_QUANTITY),
      min_quantity: Number(TEMP_COMBO_MIN_QUANTITY),
      allow_notification: false,
    })

    if (detailsPayload.image_file) {
      const imageUrl = await uploadFileAndGetUrl(detailsPayload.image_file, token)
      payload.main_image_url = imageUrl
    }

    const base = config.public.apiBase as string
    await $fetch(`${base.replace(/\/$/, '')}/products/${id.value}`, {
      method: 'PUT',
      body: payload,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': normalizeApiLocale(locale.value),
      },
    })

    toast.success(t('toasts.save_success'))
    await navigateTo('/products')
  }
  catch (error: unknown) {
    if (isValidationError(error))
      detailsRef.value?.applyServerErrors(getFieldErrors(error))
    else
      errorMessage.value = getErrorMessage(error)
  }
  finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (!canEdit) return
  loadProduct()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/products">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_page.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('products_page.edit_subtitle', { id: String(id) }) }}</p>
      </div>
    </div>

    <div
      v-if="!canEdit"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('products_form.no_permission_edit') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/products">{{ t('common.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div v-if="errorMessage" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
        {{ errorMessage }}
      </div>

      <div v-if="loading" class="rounded-lg border p-8 text-center text-muted-foreground">
        <Loader2 class="mx-auto size-10 animate-spin mb-3" />
        <p class="text-sm">{{ t('common.loading') }}</p>
      </div>

      <template v-else>
        <ComboDetailsSection ref="detailsRef" />
        <ComboBundleComponentsSection ref="bundleRef" />
        <ComboPriceAssignmentSection ref="priceRef" />

        <div class="flex flex-wrap items-center justify-end gap-2 pb-6">
          <Button
            v-if="canShowProduct"
            type="button"
            variant="outline"
            :disabled="submitting"
            as-child
          >
            <NuxtLink :to="`/products/show-combo/${id}`">{{ t('common.view') }}</NuxtLink>
          </Button>
          <Button
            type="button"
            class="inline-flex items-center gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030] min-w-[120px]"
            :disabled="submitting"
            @click="handleSave"
          >
            <Loader2 v-if="submitting" class="size-4 animate-spin shrink-0" />
            <span>{{ submitting ? t('common.saving') : t('products_form.save') }}</span>
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
