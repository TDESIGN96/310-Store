<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { t, tm, rt, locale } = useI18n()
const { $api } = useApi()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

const nameEn = ref('')
const nameAr = ref('')
const mobileNumber = ref('')
const email = ref('')
const address = ref('')
const location = ref('')
const description = ref('')
const adminName = ref('')
const adminMobileNumber = ref('')
const password = ref('')

const submitting = ref(false)
const errorMessage = ref('')

const fieldErrors = ref<Record<string, string>>({
  name_en: '',
  name_ar: '',
  mobile_number: '',
  email: '',
  address: '',
  location: '',
  description: '',
  admin_name: '',
  admin_mobile_number: '',
  password: '',
})

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^07\d{9}$/
const normalizeMobile = (value: string) =>
  value
    .trim()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, '')
    .replace(/[^\d]/g, '')
const mobileMeta = (value: string) => {
  const trimmed = value.trim()
  const normalized = normalizeMobile(value)
  return {
    trimmedLength: trimmed.length,
    normalizedLength: normalized.length,
    hasArabicDigits: /[٠-٩]/.test(trimmed),
    hasSpaces: /\s/.test(trimmed),
    startsWith07: normalized.startsWith('07'),
    valid07Format: MOBILE_RE.test(normalized),
  }
}
const locationOptions = computed<string[]>(() => {
  void locale.value
  const raw = tm('distributors_form.iraqi_provinces') as unknown[]
  if (!Array.isArray(raw)) return []
  return raw.map((item: unknown) => rt(item as Parameters<typeof rt>[0])).filter((s: string) => s.trim().length > 0)
})

const resetFieldErrors = () => {
  fieldErrors.value = {
    name_en: '',
    name_ar: '',
    mobile_number: '',
    email: '',
    address: '',
    location: '',
    description: '',
    admin_name: '',
    admin_mobile_number: '',
    password: '',
  }
}

const passwordHintClass = computed(() => (PASSWORD_RE.test(password.value) ? 'text-green-600' : 'text-muted-foreground'))

const validateForm = (): boolean => {
  resetFieldErrors()

  if (!nameEn.value.trim()) fieldErrors.value.name_en = t('distributors_form.validation_required')
  if (!nameAr.value.trim()) fieldErrors.value.name_ar = t('distributors_form.validation_required')
  if (!mobileNumber.value.trim()) fieldErrors.value.mobile_number = t('distributors_form.validation_required')
  else if (!MOBILE_RE.test(normalizeMobile(mobileNumber.value))) fieldErrors.value.mobile_number = t('invoices_page.customer_mobile_invalid')
  if (!location.value.trim()) fieldErrors.value.location = t('distributors_form.validation_required')
  if (!adminName.value.trim()) fieldErrors.value.admin_name = t('distributors_form.validation_required')
  if (!password.value.trim()) fieldErrors.value.password = t('distributors_form.validation_required')

  if (email.value.trim() && !EMAIL_RE.test(email.value.trim())) {
    fieldErrors.value.email = t('distributors_form.validation_email')
  }
  if (password.value.trim() && !PASSWORD_RE.test(password.value)) {
    fieldErrors.value.password = t('distributors_form.validation_password_strength')
  }

  return !Object.values(fieldErrors.value).some(Boolean)
}

const onLocationChange = (value: unknown) => {
  location.value = String(value ?? '')
  fieldErrors.value.location = ''
}

const createDistributor = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  const mobilePayload = normalizeMobile(mobileNumber.value)
  const adminMobilePayload = adminMobileNumber.value.trim() ? normalizeMobile(adminMobileNumber.value) : undefined
  submitting.value = true
  try {
    // #region agent log
    fetch('http://127.0.0.1:7881/ingest/5d1ba08e-cf2e-4257-b83a-e23b15afe695',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'58ba7c'},body:JSON.stringify({sessionId:'58ba7c',runId:'post-fix',hypothesisId:'H1',location:'app/pages/distributors/create.vue:createDistributor',message:'submit payload diagnostics before create',data:{mobile:mobileMeta(mobileNumber.value),adminMobile:mobileMeta(adminMobileNumber.value),mobilePayloadLength:mobilePayload.length,adminMobilePayloadLength:adminMobilePayload?.length ?? 0},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    await $api('/distributors', {
      method: 'POST',
      body: {
        name_en: nameEn.value.trim(),
        name_ar: nameAr.value.trim(),
        mobile: mobilePayload,
        email: email.value.trim() || undefined,
        address: address.value.trim() || undefined,
        city: location.value.trim(),
        description: description.value.trim() || undefined,
        admin_name: adminName.value.trim(),
        admin_mobile: adminMobilePayload,
        password: password.value,
      },
    })

    toast.success(t('distributors_messages.add_success'))
    await navigateTo('/distributors')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      // #region agent log
      fetch('http://127.0.0.1:7881/ingest/5d1ba08e-cf2e-4257-b83a-e23b15afe695',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'58ba7c'},body:JSON.stringify({sessionId:'58ba7c',runId:'post-fix',hypothesisId:'H4',location:'app/pages/distributors/create.vue:createDistributor.catch',message:'validation keys for create distributor',data:{keys:Object.keys(fe),hasMobile:Boolean(fe.mobile),hasMobileNumber:Boolean(fe.mobile_number),hasPhone:Boolean(fe.phone),hasAddressKey:Boolean(fe.address)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      fieldErrors.value = {
        name_en: fe.name_en ?? fe.distributor_name_en ?? '',
        name_ar: fe.name_ar ?? fe.distributor_name_ar ?? '',
        mobile_number: fe.mobile ?? fe.phone ?? fe.mobile_number ?? '',
        email: fe.email ?? '',
        address: fe.address ?? '',
        location: fe.city ?? '',
        description: fe.description ?? '',
        admin_name: fe.admin_name ?? '',
        admin_mobile_number: fe.admin_mobile ?? '',
        password: fe.password ?? '',
      }
      if (!Object.values(fieldErrors.value).some(Boolean)) {
        errorMessage.value = getErrorMessage(error)
      }
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
        <NuxtLink to="/distributors">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('distributors_form.create_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('distributors_form.create_subtitle') }}
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.name_en') }} <span class="text-red-500">*</span></label>
          <Input v-model="nameEn" :class="fieldErrors.name_en ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.name_en = ''" />
          <p v-if="fieldErrors.name_en" class="text-xs text-red-500">{{ fieldErrors.name_en }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.name_ar') }} <span class="text-red-500">*</span></label>
          <Input v-model="nameAr" :class="fieldErrors.name_ar ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.name_ar = ''" />
          <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">{{ fieldErrors.name_ar }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.mobile_number') }} <span class="text-red-500">*</span></label>
          <Input v-model="mobileNumber" :class="fieldErrors.mobile_number ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.mobile_number = ''" />
          <p v-if="fieldErrors.mobile_number" class="text-xs text-red-500">{{ fieldErrors.mobile_number }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.email') }}</label>
          <Input v-model="email" type="email" :class="fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.email = ''" />
          <p v-if="fieldErrors.email" class="text-xs text-red-500">{{ fieldErrors.email }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.location') }} <span class="text-red-500">*</span></label>
          <Select :model-value="location" @update:model-value="onLocationChange">
            <SelectTrigger :class="fieldErrors.location ? 'border-red-500 focus-visible:ring-red-500' : ''">
              <SelectValue :placeholder="t('distributors_form.location_placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="item in locationOptions" :key="item" :value="item">{{ item }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="fieldErrors.location" class="text-xs text-red-500">{{ fieldErrors.location }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.address') }}</label>
          <Input v-model="address" :class="fieldErrors.address ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.address = ''" />
          <p v-if="fieldErrors.address" class="text-xs text-red-500">{{ fieldErrors.address }}</p>
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium">{{ t('distributors_form.description') }}</label>
          <Input v-model="description" :class="fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.description = ''" />
          <p v-if="fieldErrors.description" class="text-xs text-red-500">{{ fieldErrors.description }}</p>
        </div>
      </div>

      <Separator class="my-2" />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.admin_name') }} <span class="text-red-500">*</span></label>
          <Input v-model="adminName" :class="fieldErrors.admin_name ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.admin_name = ''" />
          <p v-if="fieldErrors.admin_name" class="text-xs text-red-500">{{ fieldErrors.admin_name }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('distributors_form.admin_mobile_number') }}</label>
          <Input v-model="adminMobileNumber" :class="fieldErrors.admin_mobile_number ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.admin_mobile_number = ''" />
          <p v-if="fieldErrors.admin_mobile_number" class="text-xs text-red-500">{{ fieldErrors.admin_mobile_number }}</p>
        </div>
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium">{{ t('distributors_form.password') }} <span class="text-red-500">*</span></label>
          <Input v-model="password" type="password" :class="fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''" @input="fieldErrors.password = ''" />
          <p v-if="fieldErrors.password" class="text-xs text-red-500">{{ fieldErrors.password }}</p>
          <p class="text-xs" :class="passwordHintClass">{{ t('distributors_form.password_hint') }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" as-child>
          <NuxtLink to="/distributors">{{ t('common.cancel') }}</NuxtLink>
        </Button>
        <Button type="button" class="bg-[#215260] hover:bg-[#184754]" :disabled="submitting" @click="createDistributor">
          <Loader2 v-if="submitting" class="size-4 animate-spin me-1" />
          {{ t('common.save') }}
        </Button>
      </div>
    </div>
  </div>
</template>
