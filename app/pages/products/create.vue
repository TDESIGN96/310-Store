<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import ProductDetailsSection from '@/components/products/create/ProductDetailsSection.vue'
import WarehouseAssignmentSection from '@/components/products/create/WarehouseAssignmentSection.vue'
import PriceAssignmentSection from '@/components/products/create/PriceAssignmentSection.vue'
import { normalizeApiLocale } from '@/utils/apiLocale'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const config = useRuntimeConfig()
const authStore = useAuthStore()

const productDetailsRef = ref<InstanceType<typeof ProductDetailsSection> | null>(null)
const warehouseRef = ref<InstanceType<typeof WarehouseAssignmentSection> | null>(null)
const priceRef = ref<InstanceType<typeof PriceAssignmentSection> | null>(null)

const submitting = ref(false)
const errorMessage = ref('')

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

async function handleSave() {
  errorMessage.value = ''

  const detailsOk = productDetailsRef.value?.validate() ?? false
  const warehouseOk = warehouseRef.value?.validate() ?? false
  const priceOk = priceRef.value?.validate() ?? false

  if (!detailsOk || !warehouseOk || !priceOk) return

  const token = authStore.token
  if (!token) {
    errorMessage.value = t('products_form.not_authenticated')
    return
  }

  submitting.value = true
  try {
    const detailsPayload = productDetailsRef.value!.getPayload()

    const payload: Record<string, unknown> = {
      name_ar: detailsPayload.name_ar,
      name_en: detailsPayload.name_en,
      sku: detailsPayload.sku,
      category_id: Number(detailsPayload.category_id),
      unit_id: Number(detailsPayload.unit_id),
      inventory: [] as Array<Record<string, unknown>>,
      tiered_prices: [] as Array<Record<string, unknown>>,
    }
    if (detailsPayload.description)
      payload.description = detailsPayload.description
    if (detailsPayload.barcode)
      payload.barcode = detailsPayload.barcode

    if (detailsPayload.main_image_file) {
      const mainImageUrl = await uploadFileAndGetUrl(detailsPayload.main_image_file, token)
      payload.main_image_url = mainImageUrl
    }

    const additionalImages: string[] = []
    for (const file of detailsPayload.additional_image_files) {
      const imageUrl = await uploadFileAndGetUrl(file, token)
      additionalImages.push(imageUrl)
    }
    if (additionalImages.length)
      payload.images = additionalImages

    const warehouseAssignments = warehouseRef.value!.getAssignments()
    const inventory = payload.inventory as Array<Record<string, unknown>>
    warehouseAssignments.forEach((row, i) => {
      inventory.push({
        warehouse_id: Number(row.warehouse_id),
        quantity: Number(row.quantity),
        min_quantity: Number(row.min_quantity),
        allow_notification: Boolean(row.allow_notification),
      })
    })

    const pricing = priceRef.value!.getPricing()
    if (pricing) {
      payload.price = Number(pricing.standard_price)
      const tieredPrices = payload.tiered_prices as Array<Record<string, unknown>>
      pricing.tiered_prices.forEach((row, i) => {
        tieredPrices.push({
          quantity_from: Number(row.quantity_from),
          quantity_to: Number(row.quantity_to),
          price: Number(row.price),
        })
      })
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

    toast.success(t('products_form.create_success'))
    await navigateTo('/products')
  }
  catch (error: unknown) {
    if (isValidationError(error))
      productDetailsRef.value?.applyServerErrors(getFieldErrors(error))
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
    <!-- Page header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/products">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_create.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('products_create.subtitle') }}</p>
        <p class="text-xs text-muted-foreground mt-2 max-w-2xl">
          {{ t('products_create.steps_overview') }}
        </p>
      </div>
    </div>

    <!-- Global error banner -->
    <div
      v-if="errorMessage"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ errorMessage }}
    </div>

    <!-- Section 1: Product Details -->
    <ProductDetailsSection ref="productDetailsRef" />

    <!-- Section 2: Warehouse Assignment -->
    <WarehouseAssignmentSection ref="warehouseRef" />

    <!-- Section 3: Price Assignment -->
    <PriceAssignmentSection ref="priceRef" />

    <!-- Shared form actions -->
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
        class="inline-flex items-center gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030] min-w-[120px]"
        :disabled="submitting"
        @click="handleSave"
      >
        <Loader2 v-if="submitting" class="size-4 animate-spin shrink-0" />
        <span>{{ submitting ? t('common.saving') : t('products_form.save') }}</span>
      </Button>
    </div>
  </div>
</template>
