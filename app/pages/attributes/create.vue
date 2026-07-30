<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

interface AttributeValuePayload {
  name: string
  sort_order: number
}

interface AttributeCreateResponse {
  status?: string
  status_code?: number
  data?: {
    id: number
    name: string
    products_count: number
    values: Array<{
      id: number
      attribute_id: number
      name: string
      sort_order: number
      created_at: string
      updated_at: string
      deleted_at?: string | null
    }>
    created_at: string
    updated_at: string
    deleted_at?: string | null
  }
  message?: string | null
}

interface ValueRow {
  key: number
  name: string
  sort_order: number
  error_name: string
}

const attributeName = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const fieldErrors = ref({
  name: '',
  values: '',
})

const values = ref<ValueRow[]>([
  { key: 1, name: '', sort_order: 1, error_name: '' },
])
const nextRowKey = ref(2)

const hasValues = computed(() => values.value.length > 0)

const addValueRow = () => {
  values.value.push({
    key: nextRowKey.value++,
    name: '',
    sort_order: values.value.length + 1,
    error_name: '',
  })
}

const removeValueRow = (key: number) => {
  values.value = values.value.filter(v => v.key !== key)
  if (!values.value.length) addValueRow()
}

const normalizeSortOrder = (row: ValueRow) => {
  const n = Number(row.sort_order)
  row.sort_order = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

const validateForm = (): boolean => {
  fieldErrors.value = { name: '', values: '' }
  for (const row of values.value) row.error_name = ''

  if (!attributeName.value.trim()) {
    fieldErrors.value.name = t('attributes_form.validation_name_required')
  }

  if (!values.value.length) {
    fieldErrors.value.values = t('attributes_form.validation_values_required')
  }

  const seen = new Set<string>()
  for (const row of values.value) {
    const trimmed = row.name.trim()
    if (!trimmed) {
      row.error_name = t('attributes_form.validation_value_name_required')
      continue
    }
    const token = trimmed.toLowerCase()
    if (seen.has(token)) {
      row.error_name = t('attributes_form.validation_value_name_duplicate')
      continue
    }
    seen.add(token)
    if (!Number.isFinite(row.sort_order) || row.sort_order < 1) {
      row.sort_order = 1
    }
  }

  return !fieldErrors.value.name
    && !fieldErrors.value.values
    && values.value.every(v => !v.error_name)
}

const buildPayload = () => ({
  name: attributeName.value.trim(),
  values: values.value.map<AttributeValuePayload>(row => ({
    name: row.name.trim(),
    sort_order: Number.isFinite(row.sort_order) ? Number(row.sort_order) : 1,
  })),
})

const createAttribute = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    await $api<AttributeCreateResponse>('/attributes', {
      method: 'POST',
      body: buildPayload(),
    })
    toast.success(t('attributes_form.create_success'))
    await navigateTo('/attributes')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value.name = fe.name ?? ''
      fieldErrors.value.values = fe.values ?? ''
      if (Array.isArray(fe['values.0.name'])) {
        // no-op: keep compatibility with unknown backend shape
      }
      return
    }
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
   <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/attributes">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('attributes_form.create_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('attributes_form.create_subtitle') }}
        </p>
      </div>
    </div>

    <div class="rounded-lg border overflow-hidden">
      <div class="p-5 border-b">
        <div class="space-y-2">
          <label class="text-sm font-medium">
            {{ t('attributes_form.name') }} <span class="text-red-500">*</span>
          </label>
          <Input
            v-model="attributeName"
            :placeholder="t('attributes_form.placeholder_name')"
            :aria-invalid="Boolean(fieldErrors.name)"
            :class="fieldErrors.name ? 'border-destructive focus-visible:ring-destructive/30' : ''"
            @input="fieldErrors.name = ''"
          />
          <p v-if="fieldErrors.name" class="text-xs text-red-500">{{ fieldErrors.name }}</p>
        </div>
      </div>

      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">{{ t('attributes_form.values_title') }}</h2>
          <p class="text-xs text-muted-foreground">{{ t('attributes_form.values_hint') }}</p>
        </div>

        <div v-if="fieldErrors.values" class="text-xs text-red-500">
          {{ fieldErrors.values }}
        </div>

        <div class="space-y-2">
          <div class="grid grid-cols-12 gap-2 px-2">
            <div class="col-span-7 md:col-span-8 text-xs font-medium text-muted-foreground">
              {{ t('attributes_form.placeholder_value_name') }}
            </div>
            <div class="col-span-4 md:col-span-3 text-xs font-medium text-muted-foreground">
              {{ t('attributes_form.sort_order') }}
            </div>
            <div class="col-span-1 text-xs font-medium text-muted-foreground text-end">
              {{ t('common.actions') }}
            </div>
          </div>
          <div
            v-for="row in values"
            :key="row.key"
            class="grid grid-cols-12 gap-2 items-start rounded-md border p-2"
          >
            <div class="col-span-7 md:col-span-8 space-y-1">
              <Input
                v-model="row.name"
                :placeholder="t('attributes_form.placeholder_value_name')"
                :aria-invalid="Boolean(row.error_name)"
                :class="row.error_name ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                @input="row.error_name = ''"
              />
              <p v-if="row.error_name" class="text-xs text-red-500">{{ row.error_name }}</p>
            </div>
            <div class="col-span-4 md:col-span-3">
              <Input
                v-model.number="row.sort_order"
                type="number"
                min="1"
                :placeholder="t('attributes_form.sort_order')"
                @blur="normalizeSortOrder(row)"
              />
            </div>
            <div class="col-span-1 flex justify-end pt-1">
              <Button
                variant="ghost"
                size="icon"
                class="text-red-600 hover:text-red-700 hover:bg-red-50"
                :disabled="!hasValues"
                @click="removeValueRow(row.key)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <Button variant="outline" class="w-full gap-2" @click="addValueRow">
          <Plus class="size-4" />
          {{ t('attributes_form.add_new_value') }}
        </Button>
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
        <NuxtLink to="/attributes">{{ t('common.cancel') }}</NuxtLink>
      </Button>
      <Button
        class="bg-primary hover:bg-primary/90 text-white"
        :disabled="submitting"
        @click="createAttribute"
      >
        <Loader2 v-if="submitting" class="size-4 animate-spin ml-2" />
        {{ submitting ? t('common.saving') : t('attributes_form.submit_create') }}
      </Button>
    </div>
  </div>
</template>
