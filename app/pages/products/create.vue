<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const config = useRuntimeConfig()
const authStore = useAuthStore()
const attributesStore = useAttributesStore()
const productsStore = useProductsStore()

interface CategoryOption { id: number, name_ar?: string, name_en?: string }
interface UnitOption { id: number, name_ar?: string, name_en?: string }

const categories = ref<CategoryOption[]>([])
const units = ref<UnitOption[]>([])
const submitting = ref(false)
const errorMessage = ref('')
const formErrors = ref<Record<string, string>>({})
const mainImageFile = ref<File | null>(null)
const additionalImageFiles = ref<File[]>([])

const MAX_PHOTOS = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024

const draft = computed(() => productsStore.draft)

const toggleAttribute = (attributeId: number, checked: boolean) => {
  const current = new Set(draft.value.attribute_ids)
  if (checked) current.add(attributeId)
  else current.delete(attributeId)
  draft.value.attribute_ids = [...current]
}

interface UploadedFileResponse {
  data?: {
    file?: {
      path?: string
      url?: string
    }
  }
}

const onMainImageChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  mainImageFile.value = file
}

const onAdditionalImagesChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  additionalImageFiles.value = files
}

const removeAdditionalSelectedFile = (index: number) => {
  additionalImageFiles.value.splice(index, 1)
}

const uploadFileAndGetUrl = async (file: File, token: string): Promise<string> => {
  const base = config.public.apiBase as string
  const formData = new FormData()
  formData.append('file', file)

  const uploadResult = await $fetch<UploadedFileResponse>(`${base.replace(/\/$/, '')}/files`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  const fileUrl = uploadResult?.data?.file?.url || uploadResult?.data?.file?.path
  if (!fileUrl) throw new Error('File upload response did not include url/path')
  return fileUrl
}

const validate = () => {
  const errors: Record<string, string> = {}
  if (!draft.value.name_ar.trim()) errors.name_ar = t('products_form.validation_name_ar_required')
  if (!draft.value.name_en.trim()) errors.name_en = t('products_form.validation_name_en_required')
  if (!draft.value.category_id) errors.category_id = t('products_form.validation_category_required')
  if (!draft.value.unit_id) errors.unit_id = t('products_form.validation_unit_required')
  const allFiles = [mainImageFile.value, ...additionalImageFiles.value].filter(Boolean) as File[]
  if (allFiles.some(file => file.size > MAX_FILE_SIZE)) {
    errors.images = t('products_form.validation_image_max_size')
  }

  const mainCount = mainImageFile.value ? 1 : (draft.value.main_image ? 1 : 0)
  const additionalCount = draft.value.images.filter(Boolean).length + additionalImageFiles.value.length
  if (mainCount + additionalCount > MAX_PHOTOS) {
    errors.images = t('products_form.validation_images_max_count')
  }
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const saveProduct = async () => {
  errorMessage.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    const token = authStore.token
    if (!token) {
      errorMessage.value = t('products_form.not_authenticated')
      submitting.value = false
      return
    }

    if (mainImageFile.value) {
      draft.value.main_image = await uploadFileAndGetUrl(mainImageFile.value, token)
    }
    if (additionalImageFiles.value.length) {
      const uploaded = await Promise.all(additionalImageFiles.value.map(file => uploadFileAndGetUrl(file, token)))
      draft.value.images = [...draft.value.images.filter(Boolean), ...uploaded]
    }

    const payload = productsStore.createProductPayload(true)
    await $api('/products', { method: 'POST', body: payload })
    toast.success(t('products_form.create_success'))
    await navigateTo('/products')
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    submitting.value = false
  }
}

const loadOptions = async () => {
  const [cats, unitsRes] = await Promise.all([
    $api('/categories', { params: { page: 1, per_page: 100 } }).catch(() => ({})),
    $api('/units', { params: { page: 1, per_page: 100 } }).catch(() => ({})),
  ])
  categories.value = ((cats as any)?.data?.categories ?? (cats as any)?.categories ?? []) as CategoryOption[]
  units.value = ((unitsRes as any)?.data?.units ?? (unitsRes as any)?.units ?? []) as UnitOption[]
}

onMounted(async () => {
  productsStore.resetDraft()
  await Promise.all([attributesStore.load(), loadOptions()])
})
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_create.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('products_variations.create_subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ errorMessage }}
    </div>

    <div class="rounded-lg border p-5 space-y-6">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('products_create.step_badge', { n: 1 }) }}
        </p>
        <h2 class="text-lg font-semibold tracking-tight mt-1">
          {{ t('products_variations.product_info') }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('products_variations.create_subtitle') }}
        </p>
      </div>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('products_form.name_ar') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_name_ar') }}</p>
          <Input v-model="draft.name_ar" class="mt-0.5" />
          <p v-if="formErrors.name_ar" class="text-xs text-red-600">{{ formErrors.name_ar }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('products_form.name_en') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_name_en') }}</p>
          <Input v-model="draft.name_en" class="mt-0.5" />
          <p v-if="formErrors.name_en" class="text-xs text-red-600">{{ formErrors.name_en }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('products_form.category') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_category') }}</p>
          <Select :model-value="draft.category_id ? String(draft.category_id) : ''" @update:model-value="v => draft.category_id = Number(v)">
            <SelectTrigger class="mt-0.5"><SelectValue :placeholder="t('products_form.select_category')" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in categories" :key="c.id" :value="String(c.id)">
                {{ c.name_en || c.name_ar || `#${c.id}` }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="formErrors.category_id" class="text-xs text-red-600">{{ formErrors.category_id }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('products_form.unit') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_unit') }}</p>
          <Select :model-value="draft.unit_id ? String(draft.unit_id) : ''" @update:model-value="v => draft.unit_id = Number(v)">
            <SelectTrigger class="mt-0.5"><SelectValue :placeholder="t('products_form.select_unit')" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="u in units" :key="u.id" :value="String(u.id)">
                {{ u.name_en || u.name_ar || `#${u.id}` }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="formErrors.unit_id" class="text-xs text-red-600">{{ formErrors.unit_id }}</p>
        </div>
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium leading-none">{{ t('products_form.description') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_description') }}</p>
          <textarea
            v-model="draft.description"
            rows="4"
            class="mt-0.5 w-full min-h-[100px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p v-if="formErrors.description" class="text-xs text-red-600">{{ formErrors.description }}</p>
        </div>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-6">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('products_create.step_badge', { n: 2 }) }}
        </p>
        <h2 class="text-lg font-semibold tracking-tight mt-1">
          {{ t('products_page.show_images') }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('products_variations.hint_additional_images') }}
        </p>
      </div>
      <div class="grid gap-6 sm:grid-cols-2">
        <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
          <label class="text-sm font-medium">{{ t('products_form.main_image') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_main_image') }}</p>
          <Input type="file" accept="image/*" class="cursor-pointer bg-background file:me-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm" @change="onMainImageChange" />
          <p v-if="mainImageFile" class="text-xs text-muted-foreground">{{ mainImageFile.name }}</p>
          <p v-if="formErrors.main_image" class="text-xs text-red-600">{{ formErrors.main_image }}</p>
        </div>
        <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
          <label class="text-sm font-medium">{{ t('products_form.add_additional_images') }}</label>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_additional_images') }}</p>
          <Input type="file" accept="image/*" multiple class="cursor-pointer bg-background file:me-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm" @change="onAdditionalImagesChange" />
          <div
            v-for="(file, fileIndex) in additionalImageFiles"
            :key="`${file.name}-${fileIndex}`"
            class="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
          >
            <span class="min-w-0 truncate text-xs text-muted-foreground">{{ file.name }}</span>
            <Button size="sm" variant="ghost" class="shrink-0 text-red-600 hover:text-red-700" @click="removeAdditionalSelectedFile(fileIndex)">
              {{ t('common.delete') }}
            </Button>
          </div>
          <p v-if="formErrors.images" class="text-xs text-red-600">{{ formErrors.images }}</p>
          <p v-if="formErrors.additional_images" class="text-xs text-red-600">{{ formErrors.additional_images }}</p>
        </div>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-6">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('products_create.step_badge', { n: 3 }) }}
        </p>
        <h2 class="text-lg font-semibold tracking-tight mt-1">
          {{ t('products_variations.attributes') }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('products_variations.hint_attributes') }}
        </p>
      </div>
      <div class="grid grid-cols-1 gap-2 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label
          v-for="a in attributesStore.options"
          :key="a.id"
          class="flex cursor-pointer items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-sm transition-colors hover:border-input hover:bg-background/80"
        >
          <Checkbox
            :model-value="draft.attribute_ids.includes(a.id)"
            @update:model-value="checked => toggleAttribute(a.id, Boolean(checked))"
          />
          <span class="leading-snug">{{ a.name }}</span>
        </label>
      </div>
      <p v-if="formErrors.attribute_ids" class="text-xs text-red-600">{{ formErrors.attribute_ids }}</p>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-2 pb-6">
      <Button type="button" variant="outline" :disabled="submitting" @click="navigateTo('/products')">
        {{ t('common.cancel') }}
      </Button>
      <Button
        type="button"
        class="inline-flex items-center gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030] min-w-[120px]"
        :disabled="submitting"
        @click="saveProduct"
      >
        <Loader2 v-if="submitting" class="size-4 shrink-0 animate-spin" />
        <span>{{ submitting ? t('common.saving') : t('products_form.save') }}</span>
      </Button>
    </div>
  </div>
</template>
