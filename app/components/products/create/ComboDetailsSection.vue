<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchAllCategoriesPages, type CategoriesApi } from '@/utils/categoryList'

const { t, locale } = useI18n()
const { $api } = useApi()
const MAX_IMAGES = 5
const MAX_ADDITIONAL_IMAGES = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SKU_RE = /^[A-Za-z0-9\-/]+$/

interface CategoryItem {
  id: number
  name_ar: string
  name_en: string
  status?: string
}

interface UnitItem {
  id: number
  name_ar: string
  name_en: string
  symbol: string
  status?: string
}

interface UnitsResponse {
  units?: UnitItem[]
  pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  data?: { units?: UnitItem[]; pagination?: UnitsResponse['pagination'] }
}

const productNameAr = ref('')
const productNameEn = ref('')
const sku = ref(generateRandomSku())
const categoryId = ref('')
const unitId = ref('')
const description = ref('')
const mainImageFile = ref<File | null>(null)
const additionalImageFiles = ref<File[]>([])

const categories = ref<CategoryItem[]>([])
const units = ref<UnitItem[]>([])
const loadingCategories = ref(false)
const loadingUnits = ref(false)
const optionsError = ref('')

const fieldErrors = ref({
  name_ar: '',
  name_en: '',
  sku: '',
  category_id: '',
  unit_id: '',
  main_image: '',
  images: '',
})

function generateRandomSku() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 8; i += 1)
    suffix += chars[Math.floor(Math.random() * chars.length)]
  return `CMB-${suffix}`
}

function categoryOptionLabel(c: CategoryItem) {
  return locale.value === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)
}

function unitOptionLabel(u: UnitItem) {
  const name = locale.value === 'ar' ? (u.name_ar || u.name_en) : (u.name_en || u.name_ar)
  return u.symbol ? `${name} (${u.symbol})` : name
}

function clearField(key: keyof typeof fieldErrors.value) {
  fieldErrors.value = { ...fieldErrors.value, [key]: '' }
}

async function loadCategories() {
  loadingCategories.value = true
  optionsError.value = ''
  try {
    const list = await fetchAllCategoriesPages<CategoryItem>($api as CategoriesApi, { status: 'active' })
    categories.value = list.filter(c => String(c.status ?? 'active').toLowerCase() === 'active')
  }
  catch {
    categories.value = []
    optionsError.value = t('products_combo.categories_load_error')
  }
  finally {
    loadingCategories.value = false
  }
}

async function loadUnits() {
  loadingUnits.value = true
  try {
    const aggregated: UnitItem[] = []
    let page = 1
    let lastPage = 1
    const maxPages = 50

    do {
      const data = await $api<UnitsResponse>('/units', { params: { page, per_page: 100 } })
      const list = data.units ?? data.data?.units ?? []
      const p = data.pagination ?? data.data?.pagination
      aggregated.push(...list)
      lastPage = p?.last_page ?? 1
      page++
    } while (page <= lastPage && page <= maxPages)

    units.value = aggregated.filter(u => String(u.status ?? 'active').toLowerCase() === 'active')
  }
  catch {
    units.value = []
    if (!optionsError.value)
      optionsError.value = t('products_form.units_load_error')
  }
  finally {
    loadingUnits.value = false
  }
}

function onMainImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  clearField('main_image')
  clearField('images')
  const file = picked[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    fieldErrors.value.main_image = t('products_combo.validation_image_type')
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    fieldErrors.value.main_image = t('products_form.validation_image_max_size')
    return
  }
  mainImageFile.value = file
}

function onAdditionalFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  clearField('images')

  let next = [...additionalImageFiles.value]
  for (const file of picked) {
    if (!file.type.startsWith('image/')) {
      fieldErrors.value.images = t('products_combo.validation_image_type')
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      fieldErrors.value.images = t('products_form.validation_image_max_size')
      continue
    }
    if (next.length >= MAX_ADDITIONAL_IMAGES) {
      fieldErrors.value.images = t('products_form.validation_additional_images_max_count')
      break
    }
    const total = (mainImageFile.value ? 1 : 0) + next.length
    if (total >= MAX_IMAGES) {
      fieldErrors.value.images = t('products_form.validation_images_max_count')
      break
    }
    next.push(file)
  }
  additionalImageFiles.value = next
}

function removeAdditionalImage(index: number) {
  additionalImageFiles.value = additionalImageFiles.value.filter((_, i) => i !== index)
  clearField('images')
}

function validate() {
  fieldErrors.value = {
    name_ar: '',
    name_en: '',
    sku: '',
    category_id: '',
    unit_id: '',
    main_image: '',
    images: '',
  }

  if (!productNameAr.value.trim())
    fieldErrors.value.name_ar = t('products_form.validation_name_ar_required')

  if (!productNameEn.value.trim())
    fieldErrors.value.name_en = t('products_form.validation_name_en_required')

  const normalizedSku = sku.value.trim()
  if (!normalizedSku)
    fieldErrors.value.sku = t('products_form.validation_sku_required')
  else if (!SKU_RE.test(normalizedSku))
    fieldErrors.value.sku = t('products_form.validation_sku_format')

  if (!categoryId.value)
    fieldErrors.value.category_id = t('products_combo.validation_category_required')

  if (!unitId.value)
    fieldErrors.value.unit_id = t('products_form.validation_unit_required')

  const allImages = [
    ...(mainImageFile.value ? [mainImageFile.value] : []),
    ...additionalImageFiles.value,
  ]
  for (const file of allImages) {
    if (file.size > MAX_IMAGE_BYTES) {
      fieldErrors.value.images = t('products_form.validation_image_max_size')
      break
    }
  }
  if (allImages.length > MAX_IMAGES)
    fieldErrors.value.images = t('products_form.validation_images_max_count')

  if (additionalImageFiles.value.length > MAX_ADDITIONAL_IMAGES)
    fieldErrors.value.images = t('products_form.validation_additional_images_max_count')

  return !Object.values(fieldErrors.value).some(Boolean)
}

function getPayload() {
  const trimmedArName = productNameAr.value.trim()
  const trimmedEnName = productNameEn.value.trim()
  return {
    name_ar: trimmedArName,
    name_en: trimmedEnName,
    sku: sku.value.trim(),
    category_id: Number(categoryId.value),
    unit_id: Number(unitId.value),
    description: description.value.trim(),
    main_image_file: mainImageFile.value,
    additional_image_files: [...additionalImageFiles.value],
  }
}

function setInitialData(data: {
  name_ar?: string
  name_en?: string
  sku?: string
  category_id?: number | string | null
  unit_id?: number | string | null
  description?: string | null
}) {
  productNameAr.value = data.name_ar ?? ''
  productNameEn.value = data.name_en ?? ''
  sku.value = data.sku ?? generateRandomSku()
  categoryId.value = data.category_id != null ? String(data.category_id) : ''
  unitId.value = data.unit_id != null ? String(data.unit_id) : ''
  description.value = data.description ?? ''
}

function applyServerErrors(fe: Record<string, string>) {
  fieldErrors.value = {
    name_ar: fe.name_ar ?? '',
    name_en: fe.name_en ?? '',
    sku: fe.sku ?? '',
    category_id: fe.category_id ?? '',
    unit_id: fe.unit_id ?? '',
    main_image: fe.main_image_url ?? fe.main_image ?? '',
    images: fe.images ?? fe.image ?? '',
  }
}

defineExpose({
  validate,
  getPayload,
  setInitialData,
  applyServerErrors,
})

onMounted(() => {
  loadCategories()
  loadUnits()
})
</script>

<template>
  <Card class="gap-0 overflow-hidden py-0 shadow-sm">
    <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
      <Package class="size-4 text-white/70" />
      <h2 class="text-base font-semibold">{{ t('products_combo.section_details_title') }}</h2>
    </div>
    <CardContent class="space-y-6 px-4 py-5 sm:px-6 sm:py-6">

    <div
      v-if="optionsError"
      class="rounded-md bg-amber-500/10 border border-amber-200 text-amber-800 dark:text-amber-200 text-sm px-4 py-3"
    >
      {{ optionsError }}
    </div>

    <div class="grid gap-5 sm:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium leading-none" for="combo-name-ar">{{ t('products_form.name_ar') }}</label>
        <Input
          id="combo-name-ar"
          v-model="productNameAr"
          class="h-10 rtl:text-right"
          dir="auto"
          :placeholder="t('products_form.placeholder_name_ar')"
          @update:model-value="clearField('name_ar')"
        />
        <p v-if="fieldErrors.name_ar" class="text-sm text-red-600">{{ fieldErrors.name_ar }}</p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none" for="combo-name-en">{{ t('products_form.name_en') }}</label>
        <Input
          id="combo-name-en"
          v-model="productNameEn"
          class="h-10 rtl:text-right"
          dir="ltr"
          :placeholder="t('products_form.placeholder_name_en')"
          @update:model-value="clearField('name_en')"
        />
        <p v-if="fieldErrors.name_en" class="text-sm text-red-600">{{ fieldErrors.name_en }}</p>
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium leading-none" for="combo-sku">{{ t('products_form.sku') }}</label>
        <Input
          id="combo-sku"
          v-model="sku"
          class="h-10 font-mono"
          dir="ltr"
          autocomplete="off"
          :placeholder="t('products_form.placeholder_sku')"
          @update:model-value="clearField('sku')"
        />
        <p class="text-xs text-muted-foreground">{{ t('products_form.hint_sku') }}</p>
        <p v-if="fieldErrors.sku" class="text-sm text-red-600">{{ fieldErrors.sku }}</p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">{{ t('products_form.category') }}</label>
        <Select
          :model-value="categoryId || undefined"
          :disabled="loadingCategories"
          @update:model-value="(v) => { categoryId = v != null ? String(v) : ''; clearField('category_id') }"
        >
          <SelectTrigger class="h-10 w-full">
            <SelectValue :placeholder="loadingCategories ? t('common.loading') + '…' : t('products_combo.select_category')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="c in categories"
              :key="c.id"
              :value="String(c.id)"
            >
              {{ categoryOptionLabel(c) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="fieldErrors.category_id" class="text-sm text-red-600">{{ fieldErrors.category_id }}</p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">{{ t('products_form.unit') }}</label>
        <Select
          :model-value="unitId || undefined"
          :disabled="loadingUnits"
          @update:model-value="(v) => { unitId = v != null ? String(v) : ''; clearField('unit_id') }"
        >
          <SelectTrigger class="h-10 w-full">
            <SelectValue :placeholder="loadingUnits ? t('common.loading') + '…' : t('products_form.select_unit')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="u in units"
              :key="u.id"
              :value="String(u.id)"
            >
              {{ unitOptionLabel(u) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="fieldErrors.unit_id" class="text-sm text-red-600">{{ fieldErrors.unit_id }}</p>
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium leading-none" for="combo-description">{{ t('products_form.description') }}</label>
        <textarea
          id="combo-description"
          v-model="description"
          rows="4"
          class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          :placeholder="t('products_form.placeholder_description')"
          dir="auto"
        />
      </div>

      <div class="space-y-5 border-t border-border pt-8 sm:col-span-2">
        <h3 class="text-sm font-semibold tracking-tight">
          {{ t('products_page.show_images') }}
        </h3>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
            <label class="text-sm font-medium">{{ t('products_form.main_image') }}</label>
            <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_main_image') }}</p>
            <Input
              type="file"
              accept="image/*"
              class="cursor-pointer bg-background file:me-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              @change="onMainImageSelected"
            />
            <p v-if="mainImageFile" class="text-xs text-muted-foreground">{{ mainImageFile.name }}</p>
            <p v-if="fieldErrors.main_image" class="text-xs text-red-600">{{ fieldErrors.main_image }}</p>
          </div>
          <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
            <label class="text-sm font-medium">{{ t('products_form.add_additional_images') }}</label>
            <p class="text-xs text-muted-foreground">{{ t('products_variations.hint_additional_images') }}</p>
            <Input
              type="file"
              accept="image/*"
              multiple
              class="cursor-pointer bg-background file:me-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              @change="onAdditionalFilesSelected"
            />
            <div
              v-for="(file, idx) in additionalImageFiles"
              :key="`${file.name}-${idx}`"
              class="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
            >
              <span class="min-w-0 truncate text-xs text-muted-foreground">{{ file.name }}</span>
              <Button size="sm" variant="ghost" class="shrink-0 text-red-600 hover:text-red-700" @click="removeAdditionalImage(idx)">
                {{ t('common.delete') }}
              </Button>
            </div>
            <p v-if="fieldErrors.images" class="text-xs text-red-600">{{ fieldErrors.images }}</p>
          </div>
        </div>
      </div>
    </div>
    </CardContent>
  </Card>
</template>
