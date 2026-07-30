<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

const district = ref('')
const deliveryFee = ref('')
const otherFees = ref('')

const submitting = ref(false)
const errorMessage = ref('')

const fieldErrors = ref({
  district: '',
  delivery_fee: '',
  other_fees: '',
})

const DECIMAL_RE = /^\d+(?:\.\d{1,2})?$/

const validateForm = (): boolean => {
  fieldErrors.value = { district: '', delivery_fee: '', other_fees: '' }

  if (!district.value.trim()) {
    fieldErrors.value.district = t('districts_form.validation_district_required')
  }

  if (!deliveryFee.value.trim()) {
    fieldErrors.value.delivery_fee = t('districts_form.validation_delivery_fee_required')
  }
  else if (!DECIMAL_RE.test(deliveryFee.value.trim())) {
    fieldErrors.value.delivery_fee = t('districts_form.validation_decimal')
  }

  if (otherFees.value.trim() && !DECIMAL_RE.test(otherFees.value.trim())) {
    fieldErrors.value.other_fees = t('districts_form.validation_decimal')
  }

  return !Object.values(fieldErrors.value).some(Boolean)
}

const createDistrict = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    await $api('/districts', {
      method: 'POST',
      body: {
        district: district.value.trim(),
        delivery_fee: String(deliveryFee.value.trim()),
        other_fees: String(otherFees.value.trim()),
      },
    })
    toast.success(t('toasts.save_success'))
    await navigateTo('/districts')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value.district = fe.district ?? ''
      fieldErrors.value.delivery_fee = fe.delivery_fee ?? ''
      fieldErrors.value.other_fees = fe.other_fees ?? ''
    }
    else {
      errorMessage.value = getErrorMessage(error)
    }
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/districts">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('districts_form.create_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('districts_form.create_subtitle') }}</p>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium">
            {{ t('districts_form.district') }} <span class="text-red-500">*</span>
          </label>
          <Input
            v-model="district"
            :placeholder="t('districts_form.placeholder_district')"
            :aria-invalid="Boolean(fieldErrors.district)"
            :class="fieldErrors.district ? 'border-destructive focus-visible:ring-destructive/30' : ''"
            @input="fieldErrors.district = ''"
          />
          <p v-if="fieldErrors.district" class="text-xs text-red-500">{{ fieldErrors.district }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">
            {{ t('districts_form.delivery_fee') }} <span class="text-red-500">*</span>
          </label>
          <Input
            v-model="deliveryFee"
            inputmode="decimal"
            :placeholder="t('districts_form.placeholder_delivery_fee')"
            :aria-invalid="Boolean(fieldErrors.delivery_fee)"
            :class="fieldErrors.delivery_fee ? 'border-destructive focus-visible:ring-destructive/30' : ''"
            @input="fieldErrors.delivery_fee = ''"
          />
          <p v-if="fieldErrors.delivery_fee" class="text-xs text-red-500">{{ fieldErrors.delivery_fee }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">
            {{ t('districts_form.other_fees') }}
          </label>
          <Input
            v-model="otherFees"
            inputmode="decimal"
            :placeholder="t('districts_form.placeholder_other_fees')"
            :aria-invalid="Boolean(fieldErrors.other_fees)"
            :class="fieldErrors.other_fees ? 'border-destructive focus-visible:ring-destructive/30' : ''"
            @input="fieldErrors.other_fees = ''"
          />
          <p v-if="fieldErrors.other_fees" class="text-xs text-red-500">{{ fieldErrors.other_fees }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <span class="mt-0.5 shrink-0">⚠</span>
      <span>{{ errorMessage }}</span>
    </div>

    <Separator />

    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" :disabled="submitting" as-child>
        <NuxtLink to="/districts">{{ t('common.cancel') }}</NuxtLink>
      </Button>
      <Button class="bg-primary hover:bg-primary/90 text-white" :disabled="submitting" @click="createDistrict">
        <Loader2 v-if="submitting" class="size-4 animate-spin ml-2" />
        {{ submitting ? t('common.saving') : t('districts_form.submit_create') }}
      </Button>
    </div>
  </div>
</template>
