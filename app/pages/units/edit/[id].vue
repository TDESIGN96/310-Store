<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-vue-next'
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

const { t } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

// ── Types ──────────────────────────────────────────────────────────────────────

interface UnitData {
  id: number
  name_ar: string
  name_en: string
  symbol: string
  status: 'active' | 'inactive' | string
}

interface UnitResponse {
  unit?: UnitData
  data?: UnitData | { unit?: UnitData }
  status?: string
  status_code?: number
  message?: string | null
}

// ── Route & API ────────────────────────────────────────────────────────────────

const route = useRoute()
const unitId = route.params.id as string
const { $api } = useApi()
const authStore = useAuthStore()

// ── Permission guard ───────────────────────────────────────────────────────────

const canEdit = authStore.hasPermission('units.update')

// ── Loading / fetch state ──────────────────────────────────────────────────────

const loadingUnit = ref(false)
const fetchError = ref('')

// ── Form state ─────────────────────────────────────────────────────────────────

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

// ── Validation regexes ─────────────────────────────────────────────────────────

const MIXED_NAME_RE = /^[A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+$/

// ── Data loading ───────────────────────────────────────────────────────────────

const loadUnit = async () => {
  loadingUnit.value = true
  fetchError.value = ''

  try {
    const res = await $api<UnitResponse>(`/units/${unitId}`)
    const raw = res.data
    const unit = (
      res.unit
      ?? (raw && typeof raw === 'object' && 'unit' in raw ? (raw as { unit?: UnitData }).unit : undefined)
      ?? (raw && typeof raw === 'object' && 'id' in raw ? (raw as UnitData) : undefined)
      ?? null
    ) as UnitData | null

    if (!unit) {
      fetchError.value = t('units_form.unit_not_found')
      return
    }

    nameAr.value = unit.name_ar ?? ''
    nameEn.value = unit.name_en ?? ''
    symbol.value = unit.symbol ?? ''
    status.value = (unit.status === 'inactive' ? 'inactive' : 'active')
  }
  catch (error: unknown) {
    fetchError.value = getErrorMessage(error)
  }
  finally {
    loadingUnit.value = false
  }
}

// ── Client-side validation ─────────────────────────────────────────────────────

const validateForm = (): boolean => {
  fieldErrors.value = { name_ar: '', name_en: '', symbol: '', status: '' }

  if (!nameAr.value.trim()) {
    fieldErrors.value.name_ar = t('units_form.validation_name_ar_required')
  }
  else if (!MIXED_NAME_RE.test(nameAr.value.trim())) {
    fieldErrors.value.name_ar = t('units_form.validation_name_ar_letters')
  }

  if (!nameEn.value.trim()) {
    fieldErrors.value.name_en = t('units_form.validation_name_en_required')
  }
  else if (!MIXED_NAME_RE.test(nameEn.value.trim())) {
    fieldErrors.value.name_en = t('units_form.validation_name_en_letters')
  }

  if (!symbol.value.trim()) {
    fieldErrors.value.symbol = t('units_form.validation_symbol_required')
  }

  if (!status.value) {
    fieldErrors.value.status = t('units_form.validation_status_required')
  }

  return !Object.values(fieldErrors.value).some(Boolean)
}

// ── Submit ─────────────────────────────────────────────────────────────────────

const updateUnit = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    await $api(`/units/${unitId}`, {
      method: 'PUT',
      body: {
        name_ar: nameAr.value.trim(),
        name_en: nameEn.value.trim(),
        symbol: symbol.value.trim(),
        status: status.value,
      },
    })
    toast.success(t('toasts.save_success'))
    await navigateTo('/units')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value.name_ar = fe.name_ar ?? ''
      fieldErrors.value.name_en = fe.name_en ?? ''
      fieldErrors.value.symbol = fe.symbol ?? ''
      fieldErrors.value.status = fe.status ?? ''
    }
    else {
      errorMessage.value = getErrorMessage(error)
    }
  }
  finally {
    submitting.value = false
  }
}

onMounted(loadUnit)
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('units_form.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('units_form.edit_subtitle') }}
        </p>
      </div>
    </div>

    <!-- No permission -->
    <div
      v-if="!canEdit"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('units_form.no_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/units">{{ t('units_form.back_to_list') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <!-- Loading -->
      <div
        v-if="loadingUnit"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('units_form.loading') }}
      </div>

      <!-- Fetch error -->
      <div
        v-else-if="fetchError"
        class="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-7" />
        <p>{{ fetchError }}</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadUnit">
            {{ t('common.retry') }}
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/units">{{ t('units_form.back_to_list') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <!-- Form -->
      <template v-else>
        <div class="rounded-lg border p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <!-- Arabic Name -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('units_form.name_ar') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="nameAr"
                dir="rtl"
                :placeholder="t('units_form.placeholder_name_ar')"
                :aria-invalid="Boolean(fieldErrors.name_ar)"
                :class="fieldErrors.name_ar ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                @input="fieldErrors.name_ar = ''"
              />
              <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">
                {{ fieldErrors.name_ar }}
              </p>
            </div>

            <!-- English Name -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('units_form.name_en') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="nameEn"
                dir="ltr"
                :placeholder="t('units_form.placeholder_name_en')"
                :aria-invalid="Boolean(fieldErrors.name_en)"
                :class="fieldErrors.name_en ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                @input="fieldErrors.name_en = ''"
              />
              <p v-if="fieldErrors.name_en" class="text-xs text-red-500">
                {{ fieldErrors.name_en }}
              </p>
            </div>

            <!-- Symbol -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('units_form.symbol') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="symbol"
                dir="ltr"
                placeholder="e.g. kg"
                :aria-invalid="Boolean(fieldErrors.symbol)"
                :class="fieldErrors.symbol ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                @input="fieldErrors.symbol = ''"
              />
              <p v-if="fieldErrors.symbol" class="text-xs text-red-500">
                {{ fieldErrors.symbol }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('units_form.symbol_hint') }}
              </p>
            </div>

            <!-- Status -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('units_form.status') }} <span class="text-red-500">*</span>
              </label>
              <Select
                :model-value="status"
                @update:model-value="val => { status = (val as 'active' | 'inactive'); fieldErrors.status = '' }"
              >
                <SelectTrigger
                  :aria-invalid="Boolean(fieldErrors.status)"
                  :class="fieldErrors.status ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                >
                  <SelectValue :placeholder="t('units_form.select_status')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{{ t('common.active') }}</SelectItem>
                  <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="fieldErrors.status" class="text-xs text-red-500">
                {{ fieldErrors.status }}
              </p>
            </div>

          </div>
        </div>

        <!-- Global error banner -->
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
            <NuxtLink to="/units">{{ t('common.cancel') }}</NuxtLink>
          </Button>
          <Button
            class="bg-primary hover:bg-primary/90 text-white"
            :disabled="submitting"
            @click="updateUnit"
          >
            <Loader2 v-if="submitting" class="size-4 animate-spin ml-2" />
            {{ submitting ? t('common.saving') : t('units_form.submit_save') }}
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>