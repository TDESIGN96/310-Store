<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ImagePlus, X } from 'lucide-vue-next'
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
import { fetchAllCategoriesPages, type CategoriesApi } from '@/utils/categoryList'

const { t, locale } = useI18n()
const { $api } = useApi()
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

const comboNameAr = ref('')
const comboNameEn = ref('')
const sku = ref(generateRandomSku())
const categoryId = ref('')
const unitId = ref('')
const description = ref('')
const imageFile = ref<File | null>(null)

const categories = ref<CategoryItem[]>([])
const units = ref<UnitItem[]>([])
const loadingCategories = ref(false)
const loadingUnits = ref(false)
const optionsError = ref('')

const imageInputRef = ref<HTMLInputElement | null>(null)

const fieldErrors = ref({
  name_ar: '',
  name_en: '',
  sku: '',
  category_id: '',
  unit_id: '',
  image: '',
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

function openImagePicker() {
  imageInputRef.value?.click()
}

function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  clearField('image')
  const file = picked[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    fieldErrors.value.image = t('products_combo.validation_image_type')
    return
  }
  imageFile.value = file
}

function removeImage() {
  imageFile.value = null
  clearField('image')
}

function validate() {
  fieldErrors.value = {
    name_ar: '',
    name_en: '',
    sku: '',
    category_id: '',
    unit_id: '',
    image: '',
  }

  if (!comboNameAr.value.trim())
    fieldErrors.value.name_ar = t('products_form.validation_name_ar_required')

  if (!comboNameEn.value.trim())
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

  return !Object.values(fieldErrors.value).some(Boolean)
}

function getPayload() {
  const trimmedArName = comboNameAr.value.trim()
  const trimmedEnName = comboNameEn.value.trim()
  return {
    name_ar: trimmedArName,
    name_en: trimmedEnName,
    sku: sku.value.trim(),
    category_id: Number(categoryId.value),
    unit_id: Number(unitId.value),
    description: description.value.trim(),
    image_file: imageFile.value,
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
  comboNameAr.value = data.name_ar ?? ''
  comboNameEn.value = data.name_en ?? ''
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
    image: fe.main_image_url ?? fe.main_image ?? fe.image ?? '',
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
  <div class="rounded-lg border p-5 space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('products_create.step_badge', { n: 1 }) }}
      </p>
      <h2 class="text-lg font-semibold tracking-tight mt-1">
        {{ t('products_combo.section_details_title') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('products_combo.section_details_hint') }}
      </p>
    </div>

    <div
      v-if="optionsError"
      class="rounded-md bg-amber-500/10 border border-amber-200 text-amber-800 dark:text-amber-200 text-sm px-4 py-3"
    >
      {{ optionsError }}
    </div>

    <Separator />

    <div class="grid gap-5 sm:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium leading-none" for="combo-name-ar">{{ t('products_form.name_ar') }}</label>
        <Input
          id="combo-name-ar"
          v-model="comboNameAr"
          class="h-10"
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
          v-model="comboNameEn"
          class="h-10"
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
        <label class="text-sm font-medium leading-none">{{ t('products_combo.category') }}</label>
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
        <label class="text-sm font-medium leading-none" for="combo-description">{{ t('products_combo.description') }}</label>
        <textarea
          id="combo-description"
          v-model="description"
          rows="4"
          class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          :placeholder="t('products_combo.placeholder_description')"
          dir="auto"
        />
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium leading-none">{{ t('products_combo.image') }}</label>
        <input
          ref="imageInputRef"
          type="file"
          accept="image/*"
          class="sr-only"
          @change="onImageSelected"
        >
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-9 gap-2"
          @click="openImagePicker"
        >
          <ImagePlus class="size-4" />
          {{ imageFile ? t('products_combo.replace_image') : t('products_combo.add_image') }}
        </Button>
        <ul v-if="imageFile" class="flex flex-wrap gap-3 pt-2">
          <li class="relative group rounded-md border bg-muted/30 p-2 pe-8 max-w-[220px]">
            <p class="text-xs truncate font-medium" :title="imageFile.name">{{ imageFile.name }}</p>
            <p class="text-[10px] text-muted-foreground tabular-nums">
              {{ (imageFile.size / 1024 / 1024).toFixed(1) }} MB
            </p>
            <button
              type="button"
              class="absolute top-1 end-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              :aria-label="t('products_form.remove_image')"
              @click="removeImage"
            >
              <X class="size-3.5" />
            </button>
          </li>
        </ul>
        <p v-if="fieldErrors.image" class="text-sm text-red-600">{{ fieldErrors.image }}</p>
      </div>
    </div>
  </div>
</template>
