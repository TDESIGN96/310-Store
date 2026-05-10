<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

interface DistrictDetail {
  id: number
  district: string
  delivery_fee: string
  other_fees: string
  created_at?: string
  updated_at?: string
}

interface DistrictResponse {
  data?: DistrictDetail | { district?: DistrictDetail }
  district?: DistrictDetail
  status?: string
  status_code?: number
  message?: string | null
}

const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const { canEdit: canEditPerm } = usePermissions()

const route = useRoute()
const districtId = computed(() => String(route.params.id ?? ''))
const canEdit = computed(() => canEditPerm('districts'))

const loadingDistrict = ref(false)
const fetchError = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const district = ref('')
const deliveryFee = ref('')
const otherFees = ref('')

const fieldErrors = ref({
  district: '',
  delivery_fee: '',
  other_fees: '',
})

const DECIMAL_RE = /^\d+(?:\.\d{1,2})?$/

const extractDistrict = (res: DistrictResponse): DistrictDetail | null => {
  const direct = res.data
  if (direct && typeof direct === 'object' && 'id' in direct) return direct as DistrictDetail
  if (direct && typeof direct === 'object' && 'district' in direct) {
    const nested = (direct as { district?: DistrictDetail }).district
    if (nested && typeof nested === 'object' && 'id' in nested) return nested
  }
  if (res.district && typeof res.district === 'object' && 'id' in res.district) return res.district
  return null
}

const loadDistrict = async () => {
  if (!districtId.value) return
  loadingDistrict.value = true
  fetchError.value = ''
  try {
    const res = await $api<DistrictResponse>(`/districts/${districtId.value}`)
    const data = extractDistrict(res)
    if (!data) {
      fetchError.value = t('districts_form.not_found')
      return
    }
    district.value = data.district ?? ''
    deliveryFee.value = String(data.delivery_fee ?? '')
    otherFees.value = String(data.other_fees ?? '')
  }
  catch (error: unknown) {
    fetchError.value = getErrorMessage(error)
  }
  finally {
    loadingDistrict.value = false
  }
}

const validateForm = (): boolean => {
  fieldErrors.value = { district: '', delivery_fee: '', other_fees: '' }

  if (!district.value.trim()) fieldErrors.value.district = t('districts_form.validation_district_required')
  if (!deliveryFee.value.trim()) fieldErrors.value.delivery_fee = t('districts_form.validation_delivery_fee_required')
  else if (!DECIMAL_RE.test(deliveryFee.value.trim())) fieldErrors.value.delivery_fee = t('districts_form.validation_decimal')
  if (otherFees.value.trim() && !DECIMAL_RE.test(otherFees.value.trim())) fieldErrors.value.other_fees = t('districts_form.validation_decimal')

  return !Object.values(fieldErrors.value).some(Boolean)
}

const updateDistrict = async () => {
  if (!districtId.value) return
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    await $api(`/districts/${districtId.value}`, {
      method: 'PUT',
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

onMounted(loadDistrict)
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('districts_form.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('districts_form.edit_subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="!canEdit"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('districts_form.no_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/districts">{{ t('districts_form.back_to_list') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div v-if="loadingDistrict" class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 class="size-5 animate-spin" />
        {{ t('districts_form.loading') }}
      </div>

      <div
        v-else-if="fetchError"
        class="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-7" />
        <p>{{ fetchError }}</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadDistrict">{{ t('common.retry') }}</Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/districts">{{ t('districts_form.back_to_list') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <template v-else>
        <div class="rounded-lg border p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2 md:col-span-2">
              <label class="text-sm font-medium">
                {{ t('districts_form.district') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="district"
                :placeholder="t('districts_form.placeholder_district')"
                :class="fieldErrors.district ? 'border-red-500 focus-visible:ring-red-500' : ''"
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
                :class="fieldErrors.delivery_fee ? 'border-red-500 focus-visible:ring-red-500' : ''"
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
                :class="fieldErrors.other_fees ? 'border-red-500 focus-visible:ring-red-500' : ''"
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
          <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="updateDistrict">
            <Loader2 v-if="submitting" class="size-4 animate-spin ml-2" />
            {{ submitting ? t('common.saving') : t('districts_form.submit_save') }}
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
