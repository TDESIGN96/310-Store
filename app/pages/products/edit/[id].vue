<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Package, ImageIcon, Tag } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const config = useRuntimeConfig()
const { can: canPerm } = usePermissions()
const canShowProduct = computed(() => canPerm('products.show'))
const authStore = useAuthStore()
const canEdit = authStore.hasPermission('products.update')

const attributesStore = useAttributesStore()
const productsStore = useProductsStore()

interface CategoryOption { id: number, name_ar?: string, name_en?: string }
interface UnitOption { id: number, name_ar?: string, name_en?: string }

const categories = ref<CategoryOption[]>([])
const units = ref<UnitOption[]>([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const formErrors = ref<Record<string, string>>({})
const draft = computed(() => productsStore.draft)
const mainImageFile = ref<File | null>(null)
const additionalImageFiles = ref<File[]>([])

const MAX_PHOTOS = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024

const toggleAttribute = (attributeId: number, checked: boolean) => {
  const current = new Set(draft.value.attribute_ids)
  if (checked) current.add(attributeId)
  else current.delete(attributeId)
  draft.value.attribute_ids = [...current]
  if (draft.value.attribute_ids.length && formErrors.value.attribute_ids) {
    delete formErrors.value.attribute_ids
  }
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
  mainImageFile.value = input.files?.[0] ?? null
}

const onAdditionalImagesChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  additionalImageFiles.value = Array.from(input.files ?? [])
}

const removeExistingImageUrl = (index: number) => {
  draft.value.images.splice(index, 1)
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
  if (!draft.value.attribute_ids.length) {
    errors.attribute_ids = t('products_variations.validation_attributes_required')
  }
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const saveProduct = async () => {
  if (!canEdit) return
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
    await $api(`/products/${id.value}`, { method: 'PUT', body: payload })
    toast.success(t('toasts.save_success'))
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
  if (!canEdit) return
  loading.value = true
  try {
    await Promise.all([attributesStore.load(), loadOptions(), productsStore.loadProductDraft(id.value)])
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink to="/products">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ t('products_page.edit_title') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t('products_variations.edit_subtitle') }}
        </p>
      </div>
    </div>

    <div
      v-if="!canEdit"
      class="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-6 py-12 text-center text-sm text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('products_form.no_permission_edit') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/products">{{ t('common.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div
        v-if="errorMessage"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16 text-muted-foreground shadow-sm"
      >
        <Loader2 class="size-10 animate-spin" />
        <p class="text-sm">{{ t('common.loading') }}</p>
      </div>

      <template v-else>
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
            <Package class="size-4 shrink-0 text-white/70" />
            <h2 class="text-base font-semibold tracking-tight">
              {{ t('products_variations.product_info') }}
            </h2>
          </div>
          <CardContent class="space-y-8 px-4 py-5 sm:px-6 sm:py-6">
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

            <div class="space-y-5 border-t border-border pt-8">
              <h3 class="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ImageIcon class="size-4 text-muted-foreground" />
                {{ t('products_page.show_images') }}
              </h3>
              <div class="grid gap-6 sm:grid-cols-2">
                <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
                  <label class="text-sm font-medium">{{ t('products_form.main_image') }}</label>
                  <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_main_image') }}</p>
                  <Input type="file" accept="image/*" class="cursor-pointer bg-background file:me-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm" @change="onMainImageChange" />
                  <p v-if="draft.main_image" class="break-all text-xs text-muted-foreground">{{ draft.main_image }}</p>
                  <p v-if="mainImageFile" class="text-xs text-muted-foreground">{{ mainImageFile.name }}</p>
                  <p v-if="formErrors.main_image" class="text-xs text-red-600">{{ formErrors.main_image }}</p>
                </div>
                <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
                  <label class="text-sm font-medium">{{ t('products_form.add_additional_images') }}</label>
                  <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_additional_images') }}</p>
                  <Input type="file" accept="image/*" multiple class="cursor-pointer bg-background file:me-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm" @change="onAdditionalImagesChange" />
                  <div
                    v-for="(img, imgIndex) in draft.images"
                    :key="`existing-${imgIndex}`"
                    class="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <span class="min-w-0 break-all text-xs text-muted-foreground">{{ img }}</span>
                    <Button size="sm" variant="ghost" class="shrink-0 text-red-600 hover:text-red-700" @click="removeExistingImageUrl(imgIndex)">
                      {{ t('common.delete') }}
                    </Button>
                  </div>
                  <div
                    v-for="(file, fileIndex) in additionalImageFiles"
                    :key="`new-${fileIndex}`"
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

            <div class="space-y-3 border-t border-border pt-8">
              <h3 class="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Tag class="size-4 text-muted-foreground" />
                {{ t('products_variations.attributes') }}
                <span class="text-red-600">*</span>
              </h3>
              <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_attributes') }}</p>
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
          </CardContent>
        </Card>

        <div class="flex flex-col-reverse gap-3 rounded-xl border bg-card/80 px-4 py-4 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-card/70 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-5">
          <Button variant="outline" class="w-full sm:w-auto" :disabled="submitting" as-child>
            <NuxtLink to="/products">{{ t('common.cancel') }}</NuxtLink>
          </Button>
          <Button v-if="canShowProduct" variant="outline" class="w-full sm:w-auto" :disabled="submitting" as-child>
            <NuxtLink :to="`/products/show/${id}`">{{ t('common.view') }}</NuxtLink>
          </Button>
          <Button variant="outline" class="w-full sm:w-auto" :disabled="submitting" as-child>
            <NuxtLink :to="`/products/variations/${id}`">{{ t('products_page.manage_variations') }}</NuxtLink>
          </Button>
          <Button
            class="inline-flex w-full items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90 sm:w-auto sm:min-w-[140px]"
            :disabled="submitting"
            @click="saveProduct"
          >
            <Loader2 v-if="submitting" class="size-4 shrink-0 animate-spin" />
            <span>{{ submitting ? t('common.saving') : t('products_form.save') }}</span>
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
