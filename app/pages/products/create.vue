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

  const formData = productDetailsRef.value!.buildFormData()

  const warehouseAssignments = warehouseRef.value!.getAssignments()
  warehouseAssignments.forEach((row, i) => {
    formData.append(`warehouses[${i}][warehouse_id]`, String(row.warehouse_id))
    formData.append(`warehouses[${i}][stock]`, String(row.stock))
    formData.append(`warehouses[${i}][min_quantity]`, String(row.min_quantity))
    formData.append(`warehouses[${i}][allow_notifications]`, row.allow_notifications ? '1' : '0')
  })

  const pricing = priceRef.value!.getPricing()
  if (pricing) {
    formData.append('pricing_type', pricing.type)
    pricing.rows.forEach((row, i) => {
      Object.entries(row).forEach(([key, value]) => {
        formData.append(`pricing[${i}][${key}]`, String(value))
      })
    })
  }

  submitting.value = true
  try {
    const base = config.public.apiBase as string
    await $fetch<unknown>(`${base.replace(/\/$/, '')}/products`, {
      method: 'POST',
      body: formData,
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
