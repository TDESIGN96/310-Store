<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 * 1024
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

const { $api } = useApi()

const productName = ref('')
const sku = ref('')
const categoryId = ref<string>('')
const description = ref('')
const unitId = ref<string>('')
const barcode = ref('')
const imageFiles = ref<File[]>([])

const categories = ref<CategoryItem[]>([])
const units = ref<UnitItem[]>([])
const loadingCategories = ref(false)
const loadingUnits = ref(false)
const optionsError = ref('')

const fileInputRef = ref<HTMLInputElement | null>(null)

const fieldErrors = ref({
  name: '',
  sku: '',
  category_id: '',
  description: '',
  unit_id: '',
  barcode: '',
  images: '',
})

function categoryOptionLabel(c: CategoryItem) {
  return locale.value === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)
}

function unitOptionLabel(u: UnitItem) {
  const name = locale.value === 'ar' ? (u.name_ar || u.name_en) : (u.name_en || u.name_ar)
  return u.symbol ? `${name} (${u.symbol})` : name
}

async function loadCategories() {
  loadingCategories.value = true
  try {
    const list = await fetchAllCategoriesPages<CategoryItem>($api as CategoriesApi, { status: 'active' })
    categories.value = list.filter(c => String(c.status ?? 'active').toLowerCase() === 'active')
  }
  catch {
    categories.value = []
    optionsError.value = t('products_form.categories_load_error')
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

function clearField(key: keyof typeof fieldErrors.value) {
  fieldErrors.value = { ...fieldErrors.value, [key]: '' }
}

function onBarcodeInput(e: Event) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/\D/g, '')
  barcode.value = digits
  el.value = digits
  clearField('barcode')
}

function validateClient(): boolean {
  fieldErrors.value = {
    name: '',
    sku: '',
    category_id: '',
    description: '',
    unit_id: '',
    barcode: '',
    images: '',
  }

  if (!productName.value.trim())
    fieldErrors.value.name = t('products_form.validation_name_required')

  const s = sku.value.trim()
  if (!s)
    fieldErrors.value.sku = t('products_form.validation_sku_required')
  else if (!SKU_RE.test(s))
    fieldErrors.value.sku = t('products_form.validation_sku_format')

  if (!categoryId.value)
    fieldErrors.value.category_id = t('products_form.validation_category_required')

  if (!unitId.value)
    fieldErrors.value.unit_id = t('products_form.validation_unit_required')

  if (barcode.value && !/^\d+$/.test(barcode.value))
    fieldErrors.value.barcode = t('products_form.validation_barcode_digits')

  for (const f of imageFiles.value) {
    if (f.size > MAX_IMAGE_BYTES) {
      fieldErrors.value.images = t('products_form.validation_image_max_size')
      break
    }
  }

  if (imageFiles.value.length > MAX_IMAGES)
    fieldErrors.value.images = t('products_form.validation_images_max_count')

  return !Object.values(fieldErrors.value).some(Boolean)
}

const canAddMoreImages = computed(() => imageFiles.value.length < MAX_IMAGES)

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''

  fieldErrors.value.images = ''
  let next = [...imageFiles.value]

  for (const file of picked) {
    if (next.length >= MAX_IMAGES) {
      fieldErrors.value.images = t('products_form.validation_images_max_count')
      break
    }
    if (file.size > MAX_IMAGE_BYTES) {
      fieldErrors.value.images = t('products_form.validation_image_max_size')
      continue
    }
    if (!file.type.startsWith('image/'))
      continue
    next.push(file)
  }
  imageFiles.value = next
}

function removeImage(index: number) {
  imageFiles.value = imageFiles.value.filter((_, i) => i !== index)
  clearField('images')
}

function applyServerFieldErrors(fe: Record<string, string>) {
  fieldErrors.value = {
    name: fe.name ?? '',
    sku: fe.sku ?? '',
    category_id: fe.category_id ?? '',
    description: fe.description ?? '',
    unit_id: fe.unit_id ?? '',
    barcode: fe.barcode ?? '',
    images: fe.images ?? fe.image ?? '',
  }
}

function buildFormData(): FormData {
  const formData = new FormData()
  formData.append('name', productName.value.trim())
  formData.append('sku', sku.value.trim())
  formData.append('category_id', categoryId.value)
  formData.append('unit_id', unitId.value)
  const desc = description.value.trim()
  if (desc)
    formData.append('description', desc)
  const bc = barcode.value.trim()
  if (bc)
    formData.append('barcode', bc)
  for (const file of imageFiles.value)
    formData.append('images[]', file)
  return formData
}

defineExpose({
  validate: validateClient,
  buildFormData,
  applyServerErrors: applyServerFieldErrors,
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadUnits()])
})
</script>

<template>
  <div class="rounded-lg border p-5 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('products_create.step_badge', { n: 1 }) }}
        </p>
        <h2 class="text-lg font-semibold tracking-tight mt-1">
          {{ t('products_form.section_product_details') }}
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('products_form.section_product_details_hint') }}
        </p>
      </div>
    </div>

    <div
      v-if="optionsError"
      class="rounded-md bg-amber-500/10 border border-amber-200 text-amber-800 dark:text-amber-200 text-sm px-4 py-3"
    >
      {{ optionsError }}
    </div>

    <Separator />

    <div class="grid gap-5 sm:grid-cols-2">
      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium leading-none" for="product-name">{{ t('products_form.name') }}</label>
        <Input
          id="product-name"
          v-model="productName"
          :placeholder="t('products_form.placeholder_name')"
          class="h-10"
          dir="auto"
          @update:model-value="clearField('name')"
        />
        <p v-if="fieldErrors.name" class="text-sm text-red-600">{{ fieldErrors.name }}</p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none" for="product-sku">{{ t('products_form.sku') }}</label>
        <Input
          id="product-sku"
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
            <SelectValue :placeholder="loadingCategories ? t('common.loading') + '…' : t('products_form.select_category')" />
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

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium leading-none" for="product-desc">{{ t('products_form.description') }}</label>
        <textarea
          id="product-desc"
          v-model="description"
          rows="4"
          class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          :placeholder="t('products_form.placeholder_description')"
          dir="auto"
          @input="clearField('description')"
        />
        <p v-if="fieldErrors.description" class="text-sm text-red-600">{{ fieldErrors.description }}</p>
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

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none" for="product-barcode">{{ t('products_form.barcode') }}</label>
        <Input
          id="product-barcode"
          :model-value="barcode"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          class="h-10 font-mono"
          dir="ltr"
          :placeholder="t('products_form.placeholder_barcode')"
          @input="onBarcodeInput"
        />
        <p class="text-xs text-muted-foreground">{{ t('products_form.hint_barcode') }}</p>
        <p v-if="fieldErrors.barcode" class="text-sm text-red-600">{{ fieldErrors.barcode }}</p>
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium leading-none">{{ t('products_form.images') }}</label>
        <p class="text-xs text-muted-foreground">{{ t('products_form.hint_images') }}</p>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="sr-only"
          @change="onFilesSelected"
        >
        <div class="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-9 gap-2"
            :disabled="!canAddMoreImages"
            @click="openFilePicker"
          >
            <ImagePlus class="size-4" />
            {{ t('products_form.add_images') }}
          </Button>
          <span class="text-xs text-muted-foreground">
            {{ t('products_form.images_count', { current: imageFiles.length, max: MAX_IMAGES }) }}
          </span>
        </div>
        <ul v-if="imageFiles.length" class="flex flex-wrap gap-3 pt-2">
          <li
            v-for="(file, idx) in imageFiles"
            :key="`${file.name}-${idx}`"
            class="relative group rounded-md border bg-muted/30 p-2 pe-8 max-w-[200px]"
          >
            <p class="text-xs truncate font-medium" :title="file.name">{{ file.name }}</p>
            <p class="text-[10px] text-muted-foreground tabular-nums">
              {{ (file.size / 1024 / 1024).toFixed(1) }} MB
            </p>
            <button
              type="button"
              class="absolute top-1 end-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              :aria-label="t('products_form.remove_image')"
              @click="removeImage(idx)"
            >
              <X class="size-3.5" />
            </button>
          </li>
        </ul>
        <p v-if="fieldErrors.images" class="text-sm text-red-600">{{ fieldErrors.images }}</p>
      </div>
    </div>

  </div>
</template>
