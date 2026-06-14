<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()

interface AttributeValue {
  id: number
  attribute_id: number
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface AttributeItem {
  id: number
  name: string
  products_count: number
  values: AttributeValue[]
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface AttributeShowResponse {
  status?: string
  status_code?: number
  data?: AttributeItem
  message?: string | null
}

interface EditableValue {
  id: number
  name: string
  sort_order: number
}

const route = useRoute()
const attributeId = String(route.params.id)

const loading = ref(false)
const saving = ref(false)
const addingValue = ref(false)
const errorMessage = ref('')
const attribute = ref<AttributeItem | null>(null)
const attributeName = ref('')
const values = ref<EditableValue[]>([])

const newValueName = ref('')
const newValueSortOrder = ref<number>(1)
const newValueError = ref('')

const deletingValueId = ref<number | null>(null)
const valueToDelete = ref<EditableValue | null>(null)

const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError(
  'attributes_edit',
  'error',
)

const hasValues = computed(() => values.value.length > 0)

const loadAttribute = async () => {
  loading.value = true
  clearLoadError()
  errorMessage.value = ''
  try {
    const res = await $api<AttributeShowResponse>(`/attributes/${attributeId}`)
    const data = res.data
    if (!data || typeof data !== 'object' || !('id' in data)) {
      setLoadErrorNotFound()
      return
    }
    attribute.value = data as AttributeItem
    attributeName.value = attribute.value.name ?? ''
    values.value = (attribute.value.values ?? []).map(v => ({
      id: v.id,
      name: v.name ?? '',
      sort_order: Number(v.sort_order ?? 1) || 1,
    }))
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const normalizeSortOrder = (row: EditableValue) => {
  const n = Number(row.sort_order)
  row.sort_order = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

const validate = () => {
  errorMessage.value = ''
  if (!attributeName.value.trim()) {
    errorMessage.value = t('attributes_edit.validation_name_required')
    return false
  }
  for (const row of values.value) {
    if (!row.name.trim()) {
      errorMessage.value = t('attributes_edit.validation_value_name_required')
      return false
    }
    if (!Number.isFinite(row.sort_order) || row.sort_order < 1) {
      errorMessage.value = t('attributes_edit.validation_sort_order_required')
      return false
    }
  }
  return true
}

const saveChanges = async () => {
  if (!attribute.value) return
  if (!validate()) return

  saving.value = true
  errorMessage.value = ''
  try {
    const attributeUpdatePath = `/attributes/${attribute.value.id}`
    await $api(`/attributes/${attribute.value.id}`, {
      method: 'PUT',
      body: {
        name: attributeName.value.trim(),
      },
    })

    const valuesUpdatePaths = values.value.map(v => `/attributes/${attribute.value!.id}/values/${v.id}`)
    await Promise.all(
      values.value.map(v =>
        $api(`/attributes/${attribute.value!.id}/values/${v.id}`, {
          method: 'PUT',
          body: {
            name: v.name.trim(),
            sort_order: Number(v.sort_order),
          },
        }),
      ),
    )

    toast.success(t('attributes_edit.save_success'))
    await navigateTo('/attributes')
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    saving.value = false
  }
}

const addValue = async () => {
  if (!attribute.value) return

  newValueError.value = ''
  if (!newValueName.value.trim()) {
    newValueError.value = t('attributes_edit.validation_value_name_required')
    return
  }

  const sortOrder = Number(newValueSortOrder.value)
  if (!Number.isFinite(sortOrder) || sortOrder < 1) {
    newValueError.value = t('attributes_edit.validation_sort_order_required')
    return
  }

  addingValue.value = true
  try {
    await $api(`/attributes/${attribute.value.id}/values`, {
      method: 'POST',
      body: {
        name: newValueName.value.trim(),
        sort_order: Math.floor(sortOrder),
      },
    })
    newValueName.value = ''
    newValueSortOrder.value = 1
    toast.success(t('attributes_edit.add_value_success'))
    await loadAttribute()
  }
  catch (error: unknown) {
    newValueError.value = getErrorMessage(error)
  }
  finally {
    addingValue.value = false
  }
}

const confirmDeleteValue = async () => {
  if (!attribute.value || !valueToDelete.value) return
  deletingValueId.value = valueToDelete.value.id
  try {
    await $api(`/attributes/${attribute.value.id}/values/${valueToDelete.value.id}`, {
      method: 'DELETE',
    })
    toast.success(t('attributes_edit.delete_value_success'))
    valueToDelete.value = null
    await loadAttribute()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    deletingValueId.value = null
  }
}

onMounted(() => {
  loadAttribute()
})
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('attributes_edit.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('attributes_form.create_subtitle') }}
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
    >
      <Loader2 class="size-5 animate-spin" />
      {{ t('attributes_edit.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <p class="font-medium text-center">{{ loadError.title }}</p>
      <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
        {{ loadError.detail }}
      </p>
      <Button variant="outline" size="sm" @click="loadAttribute">
        {{ t('common.retry') }}
      </Button>
    </div>

    <template v-else-if="attribute">
      <div class="rounded-lg border overflow-hidden">
        <div class="p-5 border-b">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ t('attributes_edit.products_count') }}</p>
              <Badge variant="secondary" class="w-fit">
                {{ t('attributes_edit.used_by_products', { count: attribute.products_count ?? 0 }) }}
              </Badge>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('attributes_edit.name') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="attributeName"
                :placeholder="t('attributes_edit.placeholder_name')"
              />
            </div>
          </div>
        </div>

        <div class="p-5 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ t('attributes_edit.values_title') }}</h2>
            <p class="text-xs text-muted-foreground">{{ t('attributes_form.values_hint') }}</p>
          </div>

          <div class="grid grid-cols-12 gap-2 items-start rounded-md border p-3">
            <div class="col-span-7 md:col-span-8 space-y-1">
              <label class="text-xs font-medium">
                {{ t('attributes_edit.col_name') }}
              </label>
              <Input
                v-model="newValueName"
                :placeholder="t('attributes_edit.placeholder_value_name')"
              />
            </div>
            <div class="col-span-4 md:col-span-3">
              <label class="text-xs font-medium">
                {{ t('attributes_edit.col_sort_order') }}
              </label>
              <Input
                v-model.number="newValueSortOrder"
                type="number"
                min="1"
                :placeholder="t('attributes_edit.sort_order')"
              />
            </div>
            <div class="col-span-1 flex justify-end pt-1">
              <Button
                variant="ghost"
                size="icon"
                class="text-primary hover:text-primary hover:bg-muted"
                :disabled="addingValue"
                @click="addValue"
              >
                <Loader2 v-if="addingValue" class="size-4 animate-spin" />
                <Plus v-else class="size-4" />
              </Button>
            </div>
            <p v-if="newValueError" class="col-span-12 text-xs text-red-500">{{ newValueError }}</p>
          </div>

          <div v-if="!hasValues" class="py-10 text-center text-sm text-muted-foreground rounded-md border">
            {{ t('attributes_edit.no_values') }}
          </div>

          <div v-else class="space-y-2">
            <div class="grid grid-cols-12 gap-2 px-2">
              <div class="col-span-7 md:col-span-8 text-xs font-medium text-muted-foreground">
                {{ t('attributes_edit.col_name') }}
              </div>
              <div class="col-span-4 md:col-span-3 text-xs font-medium text-muted-foreground">
                {{ t('attributes_edit.col_sort_order') }}
              </div>
              <div class="col-span-1 text-xs font-medium text-muted-foreground text-end">
                {{ t('common.actions') }}
              </div>
            </div>
            <div
              v-for="row in values"
              :key="row.id"
              class="grid grid-cols-12 gap-2 items-start rounded-md border p-2"
            >
              <div class="col-span-7 md:col-span-8 space-y-1">
                <Input
                  v-model="row.name"
                  :placeholder="t('attributes_edit.placeholder_value_name')"
                  class="h-9"
                />
              </div>
              <div class="col-span-4 md:col-span-3">
                <Input
                  v-model.number="row.sort_order"
                  type="number"
                  min="1"
                  :placeholder="t('attributes_edit.sort_order')"
                  class="h-9"
                  @blur="normalizeSortOrder(row)"
                />
              </div>
              <div class="col-span-1 flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-red-600 hover:text-red-700 hover:bg-red-50"
                  :disabled="deletingValueId === row.id"
                  @click="valueToDelete = row"
                >
                  <Loader2 v-if="deletingValueId === row.id" class="size-4 animate-spin" />
                  <Trash2 v-else class="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <Button variant="outline" class="w-full gap-2" :disabled="addingValue" @click="addValue">
            <Plus class="size-4" />
            {{ t('attributes_edit.add_value') }}
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
        <Button variant="outline" :disabled="saving || loading" as-child>
          <NuxtLink to="/attributes">{{ t('common.cancel') }}</NuxtLink>
        </Button>
        <Button
          class="bg-primary hover:bg-primary/90 text-Green-Light"
          :disabled="saving || loading || !attribute"
          @click="saveChanges"
        >
          <Loader2 v-if="saving" class="size-4 animate-spin ml-2" />
          {{ saving ? t('common.saving') : t('attributes_edit.submit_save') }}
        </Button>
      </div>
    </template>

    <AlertDialog :open="!!valueToDelete" @update:open="val => { if (!val) valueToDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('attributes_edit.delete_value_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('attributes_edit.delete_value_body', { name: valueToDelete?.name ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deletingValueId != null">{{ t('common.cancel') }}</AlertDialogCancel>
          <Button
            class="bg-red-600 hover:bg-red-700 text-white"
            :disabled="deletingValueId != null"
            @click="confirmDeleteValue"
          >
            <Loader2 v-if="deletingValueId != null" class="size-4 animate-spin ml-2" />
            {{ deletingValueId != null ? t('common.loading') : t('attributes_edit.confirm_yes_delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
