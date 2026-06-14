<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import ComboDetailsSection from '@/components/products/create/ComboDetailsSection.vue'
import ComboBundleComponentsSection from '@/components/products/create/ComboBundleComponentsSection.vue'
import ComboPriceAssignmentSection from '@/components/products/create/ComboPriceAssignmentSection.vue'
import { normalizeApiLocale } from '@/utils/apiLocale'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const config = useRuntimeConfig()
const authStore = useAuthStore()

const detailsRef = ref<InstanceType<typeof ComboDetailsSection> | null>(null)
const bundleRef = ref<InstanceType<typeof ComboBundleComponentsSection> | null>(null)
const priceRef = ref<InstanceType<typeof ComboPriceAssignmentSection> | null>(null)

const submitting = ref(false)
const errorMessage = ref('')
const TEMP_COMBO_WAREHOUSE_ID = 1
const TEMP_COMBO_QUANTITY = 1
const TEMP_COMBO_MIN_QUANTITY = 0

interface WarehouseListItem {
  id?: number | string
}

interface WarehousesListResponse {
  data?: {
    warehouses?: WarehouseListItem[]
  }
  warehouses?: WarehouseListItem[]
}

interface UploadedFileResponse {
  data?: {
    file?: {
      path?: string
      url?: string
    }
  }
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
  if (!fileUrl)
    throw new Error('File upload response did not include url/path')

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
      const id = Number(w.id)
      return Number.isFinite(id) && id > 0
    })
    if (!firstWarehouse) return TEMP_COMBO_WAREHOUSE_ID
    return Number(firstWarehouse.id)
  }
  catch {
    return TEMP_COMBO_WAREHOUSE_ID
  }
}

async function handleSave() {
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
      // Temporary backend workaround until combo endpoint stops requiring these fields.
      unit_id: Number(detailsPayload.unit_id),
      inventory: [] as Array<Record<string, unknown>>,
      description: detailsPayload.description || undefined,
      is_combo: true,
      combo_items: bundleItems,
      price: Number(pricing.price),
      tiered_prices: pricing.tiered_prices?.length ? pricing.tiered_prices : null,
    }

    const inventory = payload.inventory as Array<Record<string, unknown>>
    inventory.push({
      warehouse_id: Number(dummyWarehouseId),
      quantity: Number(TEMP_COMBO_QUANTITY),
      min_quantity: Number(TEMP_COMBO_MIN_QUANTITY),
      allow_notification: false,
    })

    if (detailsPayload.main_image_file) {
      const imageUrl = await uploadFileAndGetUrl(detailsPayload.main_image_file, token)
      payload.main_image_url = imageUrl
    }
    if (detailsPayload.additional_image_files?.length) {
      const imageUrls = await Promise.all(
        detailsPayload.additional_image_files.map((file: File) => uploadFileAndGetUrl(file, token)),
      )
      payload.images = imageUrls
    }

    const base = config.public.apiBase as string
    await $fetch<unknown>(`${base.replace(/\/$/, '')}/products`, {
      method: 'POST',
      body: payload,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': normalizeApiLocale(locale.value),
      },
    })

    toast.success(t('products_combo.create_success'))
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

function handleCancel() {
  navigateTo('/products')
}
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_combo.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('products_combo.subtitle') }}</p>
        <p class="text-xs text-muted-foreground mt-2 max-w-2xl">
          {{ t('products_combo.steps_overview') }}
        </p>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ errorMessage }}
    </div>

    <ComboDetailsSection ref="detailsRef" />
    <ComboBundleComponentsSection ref="bundleRef" />
    <ComboPriceAssignmentSection ref="priceRef" />

    <div class="flex flex-wrap items-center justify-end gap-2 pb-6">
      <Button
        type="button"
        variant="outline"
        :disabled="submitting"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </Button>
      <Button
        type="button"
        class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-Green-Light min-w-[120px]"
        :disabled="submitting"
        @click="handleSave"
      >
        <Loader2 v-if="submitting" class="size-4 animate-spin shrink-0" />
        <span>{{ submitting ? t('common.saving') : t('products_form.save') }}</span>
      </Button>
    </div>
  </div>
</template>
