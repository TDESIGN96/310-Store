<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Plus, ShieldAlert, Trash2, Package, ImageIcon, Tag, Layers } from 'lucide-vue-next'
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
interface WarehouseOption { id: number, name_ar?: string, name_en?: string }

const categories = ref<CategoryOption[]>([])
const units = ref<UnitOption[]>([])
const warehouses = ref<WarehouseOption[]>([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const formErrors = ref<Record<string, string>>({})
const draft = computed(() => productsStore.draft)
const selectedValuesByVariation = ref<Record<number, Record<number, number>>>({})
const mainImageFile = ref<File | null>(null)
const additionalImageFiles = ref<File[]>([])

const MAX_PHOTOS = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024

const getVariationSelections = (index: number) => {
  if (!selectedValuesByVariation.value[index]) selectedValuesByVariation.value[index] = {}
  return selectedValuesByVariation.value[index]!
}

const addVariation = () => {
  draft.value.variations.push({
    sku: '',
    barcode: '',
    price: 0,
    buying_price: 0,
    stock_quantity: 0,
    is_active: true,
    warehouse_id: null,
    min_quantity: 0,
    allow_notification: true,
    attribute_value_ids: [],
    tiered_prices: [],
  })
}

const removeVariation = (index: number) => {
  draft.value.variations.splice(index, 1)
  delete selectedValuesByVariation.value[index]
}

const toggleAttribute = (attributeId: number, checked: boolean) => {
  const current = new Set(draft.value.attribute_ids)
  if (checked) current.add(attributeId)
  else current.delete(attributeId)
  draft.value.attribute_ids = [...current]
}

const applySelectedAttributeValuesToVariation = (index: number) => {
  const picked = Object.entries(getVariationSelections(index))
    .map(([_, valueId]) => Number(valueId))
    .filter(Boolean)
  const allowedAttributeIds = new Set(draft.value.attribute_ids)
  const valid = picked.filter(valueId => {
    const value = attributesStore.valueById.get(valueId)
    return value ? allowedAttributeIds.has(value.attribute_id) : false
  })
  draft.value.variations[index]!.attribute_value_ids = valid
}

const addVariationTierPrice = (variationIndex: number) => {
  draft.value.variations[variationIndex]?.tiered_prices.push({ quantity_from: 0, quantity_to: 0, price: 0 })
}

const removeVariationTierPrice = (variationIndex: number, tierIndex: number) => {
  draft.value.variations[variationIndex]?.tiered_prices.splice(tierIndex, 1)
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
  if (!draft.value.description.trim()) errors.description = t('products_form.validation_description_required')
  if (!draft.value.attribute_ids.length) errors.attribute_ids = t('products_variations.validation_attributes_required')
  if (!draft.value.variations.length) errors.variations = t('products_variations.validation_variations_required')
  draft.value.variations.forEach((v, idx) => {
    if (!v.sku.trim()) errors[`variation_${idx}_sku`] = t('products_form.validation_sku_required')
    if (!v.barcode.trim()) errors[`variation_${idx}_barcode`] = t('products_variations.validation_barcode_required')
    if (!v.attribute_value_ids.length) errors[`variation_${idx}_attrs`] = t('products_variations.validation_values_required')
    if (!v.warehouse_id) errors[`variation_${idx}_warehouse`] = t('products_variations.validation_warehouse_required')
  })

  const allFiles = [mainImageFile.value, ...additionalImageFiles.value].filter(Boolean) as File[]
  if (allFiles.some(file => file.size > MAX_FILE_SIZE)) {
    errors.images = t('products_form.validation_image_max_size')
  }
  const mainCount = mainImageFile.value ? 1 : (draft.value.main_image ? 1 : 0)
  const additionalCount = draft.value.images.filter(Boolean).length + additionalImageFiles.value.length
  if (mainCount + additionalCount > MAX_PHOTOS) {
    errors.images = t('products_form.validation_images_max_count')
  }
  if (mainCount === 0) {
    errors.main_image = t('products_form.validation_main_image_required')
  }
  if (additionalCount === 0) {
    errors.additional_images = t('products_form.validation_additional_images_required')
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
  const [cats, unitsRes, whRes] = await Promise.all([
    $api('/categories', { params: { page: 1, per_page: 100 } }).catch(() => ({})),
    $api('/units', { params: { page: 1, per_page: 100 } }).catch(() => ({})),
    $api('/warehouses', { params: { page: 1, per_page: 100, status: 'active' } }).catch(() => ({})),
  ])
  categories.value = ((cats as any)?.data?.categories ?? (cats as any)?.categories ?? []) as CategoryOption[]
  units.value = ((unitsRes as any)?.data?.units ?? (unitsRes as any)?.units ?? []) as UnitOption[]
  warehouses.value = ((whRes as any)?.data?.warehouses ?? (whRes as any)?.warehouses ?? []) as WarehouseOption[]
}

const attributeLabel = (id: number) => attributesStore.attributeName(id)
const valueLabel = (id: number) => attributesStore.valueName(id)

onMounted(async () => {
  if (!canEdit) return
  loading.value = true
  try {
    await Promise.all([attributesStore.load(), loadOptions(), productsStore.loadProductDraft(id.value)])
    if (!draft.value.variations.length) addVariation()
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
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <Package class="size-4 shrink-0 text-muted-foreground" />
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

        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex flex-col gap-3 border-b bg-muted/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div class="flex items-center gap-2">
              <Layers class="size-4 shrink-0 text-muted-foreground" />
              <h2 class="text-base font-semibold tracking-tight">
                {{ t('products_variations.variations') }}
              </h2>
            </div>
            <Button variant="outline" size="sm" class="w-full gap-1.5 sm:w-auto" @click="addVariation">
              <Plus class="size-4" />
              {{ t('products_variations.add_variation') }}
            </Button>
          </div>
          <CardContent class="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <p v-if="formErrors.variations" class="text-xs text-red-600">{{ formErrors.variations }}</p>

            <div
              v-for="(variation, idx) in draft.variations"
              :key="variation.id ?? idx"
              class="space-y-5 rounded-xl border bg-card/50 p-4 shadow-sm sm:p-5"
            >
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                <p class="text-sm font-semibold text-muted-foreground">
                  {{ t('products_variations.variations') }} #{{ idx + 1 }}
                </p>
                <Button variant="ghost" size="sm" class="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" @click="removeVariation(idx)">
                  <Trash2 class="size-4" />
                  {{ t('common.delete') }}
                </Button>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('products_variations.variation_sku') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_variation_sku') }}</p>
                  <Input v-model="variation.sku" class="font-mono text-sm" />
                  <p v-if="formErrors[`variation_${idx}_sku`]" class="text-xs text-red-600">{{ formErrors[`variation_${idx}_sku`] }}</p>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('products_variations.variation_barcode') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_variation_barcode') }}</p>
                  <Input v-model="variation.barcode" class="font-mono text-sm" />
                  <p v-if="formErrors[`variation_${idx}_barcode`]" class="text-xs text-red-600">{{ formErrors[`variation_${idx}_barcode`] }}</p>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('products_variations.variation_price') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_variation_price') }}</p>
                  <Input v-model.number="variation.price" type="number" min="0" class="tabular-nums" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('products_variations.buying_price') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_buying_price') }}</p>
                  <Input v-model.number="variation.buying_price" type="number" min="0" class="tabular-nums" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('products_variations.variation_qty') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_variation_qty') }}</p>
                  <Input v-model.number="variation.stock_quantity" type="number" min="0" class="tabular-nums" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('products_page.filter_warehouse') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_variation_warehouse') }}</p>
                  <Select :model-value="variation.warehouse_id ? String(variation.warehouse_id) : ''" @update:model-value="v => variation.warehouse_id = Number(v)">
                    <SelectTrigger><SelectValue :placeholder="t('products_page.filter_warehouse')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="w in warehouses" :key="w.id" :value="String(w.id)">
                        {{ w.name_en || w.name_ar || `#${w.id}` }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p v-if="formErrors[`variation_${idx}_warehouse`]" class="text-xs text-red-600">{{ formErrors[`variation_${idx}_warehouse`] }}</p>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium">{{ t('warehouse_assignment.col_min_qty') }}</label>
                  <p class="text-[11px] leading-snug text-muted-foreground">{{ t('products_variations.hint_min_qty') }}</p>
                  <Input v-model.number="variation.min_quantity" type="number" min="0" class="tabular-nums" />
                </div>
                <div class="flex items-end pb-1 sm:col-span-2 xl:col-span-1">
                  <label class="inline-flex cursor-pointer items-center gap-2.5 rounded-md border bg-muted/10 px-3 py-2.5 text-sm">
                    <Checkbox :model-value="variation.allow_notification" @update:model-value="v => variation.allow_notification = Boolean(v)" />
                    {{ t('warehouse_assignment.col_notifications') }}
                  </label>
                </div>
              </div>

              <div class="space-y-2 rounded-lg border bg-muted/10 p-4">
                <label class="text-xs font-medium">{{ t('products_variations.values_by_attribute') }}</label>
                <p class="text-[11px] text-muted-foreground">{{ t('products_variations.hint_values_by_attribute') }}</p>
                <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div v-for="attributeId in draft.attribute_ids" :key="attributeId" class="space-y-1">
                    <Select
                      :model-value="getVariationSelections(idx)[attributeId] ? String(getVariationSelections(idx)[attributeId]) : ''"
                      @update:model-value="v => { getVariationSelections(idx)[attributeId] = Number(v); applySelectedAttributeValuesToVariation(idx) }"
                    >
                      <SelectTrigger>
                        <SelectValue :placeholder="attributeLabel(attributeId)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="v in attributesStore.valuesByAttributeId.get(attributeId) || []"
                          :key="v.id"
                          :value="String(v.id)"
                        >
                          {{ valueLabel(v.id) }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p v-if="formErrors[`variation_${idx}_attrs`]" class="text-xs text-red-600">{{ formErrors[`variation_${idx}_attrs`] }}</p>
              </div>

              <div class="space-y-3 rounded-lg border border-dashed bg-muted/15 p-4">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label class="text-xs font-medium">{{ t('products_variations.tiered_prices') }}</label>
                  <Button type="button" size="sm" variant="outline" class="w-full sm:w-auto" @click="addVariationTierPrice(idx)">
                    {{ t('products_variations.add_tier_price') }}
                  </Button>
                </div>
                <div v-if="!variation.tiered_prices.length" class="text-xs text-muted-foreground">
                  {{ t('products_page.show_no_tiered_prices') }}
                </div>
                <template v-else>
                  <div class="grid grid-cols-3 gap-2 border-b border-border/60 pb-2">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ t('products_variations.quantity_from') }}
                    </p>
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ t('products_variations.quantity_to') }}
                    </p>
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ t('products_variations.price_field') }}
                    </p>
                  </div>
                  <div v-for="(tp, tierIdx) in variation.tiered_prices" :key="tierIdx" class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
                    <Input v-model.number="tp.quantity_from" type="number" min="0" class="tabular-nums" :placeholder="t('price_assignment.col_min_qty')" />
                    <Input v-model.number="tp.quantity_to" type="number" min="0" class="tabular-nums" :placeholder="t('price_assignment.col_max_qty')" />
                    <div class="flex gap-2">
                      <Input v-model.number="tp.price" type="number" min="0" class="min-w-0 flex-1 tabular-nums" :placeholder="t('price_assignment.col_price')" />
                      <Button type="button" size="icon" variant="ghost" class="size-9 shrink-0 text-red-600" @click="removeVariationTierPrice(idx, tierIdx)">
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                  </div>
                </template>
              </div>
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
            class="inline-flex w-full items-center justify-center gap-2 bg-[#215260] text-[#CFE030] hover:bg-[#215260]/90 sm:w-auto sm:min-w-[140px]"
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
