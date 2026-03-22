<script setup lang="ts">
import { ref } from 'vue'
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiErrorPayload {
  message?: string | { en?: string; ar?: string }
  errors?: Record<string, string[] | undefined>
}

// ── API ────────────────────────────────────────────────────────────────────────

const { $api } = useApi()

// ── Form State ─────────────────────────────────────────────────────────────────

const nameAr = ref('')
const nameEn = ref('')
const symbol = ref('')
const status = ref<'active' | 'inactive'>('active')

const submitting = ref(false)
const errorMessage = ref('')

const fieldErrors = ref({
  name_ar: '',
  name_en: '',
  symbol: '',
  status: '',
})

// ── Validation (runs on submit) ────────────────────────────────────────────────

const ARABIC_RE = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s\u0020-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]+$/
const ENGLISH_RE = /^[A-Za-z\s]+$/

const validateForm = (): boolean => {
  fieldErrors.value = { name_ar: '', name_en: '', symbol: '', status: '' }

  if (!nameAr.value.trim()) {
    fieldErrors.value.name_ar = 'يرجى إدخال الاسم العربي'
  }
  else if (!ARABIC_RE.test(nameAr.value.trim())) {
    fieldErrors.value.name_ar = 'يجب أن يحتوي الاسم العربي على أحرف عربية فقط'
  }

  if (!nameEn.value.trim()) {
    fieldErrors.value.name_en = 'يرجى إدخال الاسم الإنجليزي'
  }
  else if (!ENGLISH_RE.test(nameEn.value.trim())) {
    fieldErrors.value.name_en = 'يجب أن يحتوي الاسم الإنجليزي على أحرف إنجليزية فقط'
  }

  if (!symbol.value.trim()) {
    fieldErrors.value.symbol = 'يرجى إدخال الرمز'
  }

  return !Object.values(fieldErrors.value).some(Boolean)
}

// ── Error Extraction ───────────────────────────────────────────────────────────

const extractErrorMessage = (error: unknown): string => {
  const payload = ((error as { data?: ApiErrorPayload })?.data ?? {}) as ApiErrorPayload
  const msg = payload.message
  const message = typeof msg === 'object' ? msg?.ar || msg?.en || '' : msg || ''

  fieldErrors.value.name_ar = payload.errors?.name_ar?.[0] ?? ''
  fieldErrors.value.name_en = payload.errors?.name_en?.[0] ?? ''
  fieldErrors.value.symbol = payload.errors?.symbol?.[0] ?? ''
  fieldErrors.value.status = payload.errors?.status?.[0] ?? ''

  return message || 'تعذر إنشاء الوحدة حالياً'
}

// ── Submit ─────────────────────────────────────────────────────────────────────

const createUnit = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    await $api('/units', {
      method: 'POST',
      body: {
        name_ar: nameAr.value.trim(),
        name_en: nameEn.value.trim(),
        symbol: symbol.value.trim(),
        status: status.value,
      },
    })
    toast.success('تم إنشاء الوحدة بنجاح')
    await navigateTo('/units')
  }
  catch (error: unknown) {
    errorMessage.value = extractErrorMessage(error)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/units">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">إنشاء وحدة</h1>
        <p class="text-sm text-muted-foreground mt-1">
          أضف وحدة قياس جديدة للنظام
        </p>
      </div>
    </div>

    <!-- Form Card -->
    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- Arabic Name -->
        <div class="space-y-2">
          <label class="text-sm font-medium">
            الاسم العربي <span class="text-red-500">*</span>
          </label>
          <Input
            v-model="nameAr"
            dir="rtl"
            placeholder="مثال: كيلوغرام"
            :class="fieldErrors.name_ar ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name_ar = ''"
          />
          <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">
            {{ fieldErrors.name_ar }}
          </p>
        </div>

        <!-- English Name -->
        <div class="space-y-2">
          <label class="text-sm font-medium">
            الاسم الإنجليزي <span class="text-red-500">*</span>
          </label>
          <Input
            v-model="nameEn"
            dir="ltr"
            placeholder="e.g. Kilogram"
            :class="fieldErrors.name_en ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name_en = ''"
          />
          <p v-if="fieldErrors.name_en" class="text-xs text-red-500">
            {{ fieldErrors.name_en }}
          </p>
        </div>

        <!-- Symbol -->
        <div class="space-y-2">
          <label class="text-sm font-medium">
            الرمز <span class="text-red-500">*</span>
          </label>
          <Input
            v-model="symbol"
            dir="ltr"
            placeholder="e.g. kg"
            :class="fieldErrors.symbol ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.symbol = ''"
          />
          <p v-if="fieldErrors.symbol" class="text-xs text-red-500">
            {{ fieldErrors.symbol }}
          </p>
          <p class="text-xs text-muted-foreground">
            يدعم جميع أحرف Unicode (مثال: kg، م، μg)
          </p>
        </div>

        <!-- Status -->
        <div class="space-y-2">
          <label class="text-sm font-medium">
            الحالة <span class="text-red-500">*</span>
          </label>
          <Select
            :model-value="status"
            @update:model-value="val => { status = (val as 'active' | 'inactive'); fieldErrors.status = '' }"
          >
            <SelectTrigger :class="fieldErrors.status ? 'border-red-500 focus-visible:ring-red-500' : ''">
              <SelectValue placeholder="اختر الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="fieldErrors.status" class="text-xs text-red-500">
            {{ fieldErrors.status }}
          </p>
        </div>

      </div>
    </div>

    <!-- Global Error Banner -->
    <div
      v-if="errorMessage"
      class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <span class="mt-0.5 shrink-0">⚠</span>
      <span>{{ errorMessage }}</span>
    </div>

    <Separator />

    <!-- Actions -->
    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" :disabled="submitting" as-child>
        <NuxtLink to="/units">إلغاء</NuxtLink>
      </Button>
      <Button
        class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]"
        :disabled="submitting"
        @click="createUnit"
      >
        <Loader2 v-if="submitting" class="size-4 animate-spin ml-2" />
        {{ submitting ? 'جارٍ الحفظ...' : 'إنشاء الوحدة' }}
      </Button>
    </div>
  </div>
</template>
