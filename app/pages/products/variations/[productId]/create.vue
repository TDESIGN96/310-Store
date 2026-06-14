<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-vue-next'
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
import TieredPriceTableSection from '@/components/products/shared/TieredPriceTableSection.vue'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const route = useRoute()
const productId = computed(() => String(route.params.productId))
const { t } = useI18n()
const productsStore = useProductsStore()
const attributesStore = useAttributesStore()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const { $api } = useApi()
const { can } = usePermissions()
const canCreateVariation = computed(() => can('product_variations.store'))

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const submitErrorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
type WarehouseItem = {
  id: number
  name_ar?: string
  name_en?: string
  status?: string
  is_active?: boolean | number | string
}

const warehouses = ref<WarehouseItem[]>([])

interface TierPriceForm {
  quantity_from: number
  quantity_to: number
  price: number
}

interface InventoryRowForm {
  _key: number
  warehouse_id: number | null
  quantity: number
  min_quantity: number
  allow_notification: boolean
}

interface VariationForm {
  sku: string
  barcode: string
  price: number
  buying_price: number
  is_active: boolean
  selectedValues: Record<number, number>
  tiered_prices: TierPriceForm[]
  inventoryRows: InventoryRowForm[]
}

let inventoryRowKeyCounter = 0

const createEmptyInventoryRow = (): InventoryRowForm => ({
  _key: ++inventoryRowKeyCounter,
  warehouse_id: null,
  quantity: 0,
  min_quantity: 0,
  allow_notification: true,
})

const createEmptyVariation = (): VariationForm => ({
  sku: '',
  barcode: '',
  price: 0,
  buying_price: 0,
  is_active: true,
  selectedValues: {},
  tiered_prices: [],
  inventoryRows: [createEmptyInventoryRow()],
})

const variations = ref<VariationForm[]>([createEmptyVariation()])

const selectedAttributeIds = computed(() => productsStore.draft.attribute_ids)
const isWarehouseActive = (warehouse: WarehouseItem) => {
  if (warehouse.status) return String(warehouse.status).toLowerCase() === 'active'
  if (warehouse.is_active === undefined) return true
  return warehouse.is_active === true || warehouse.is_active === 1 || warehouse.is_active === '1'
}

const rowFieldKey = (rowIndex: number, field: string) => `rows.${rowIndex}.${field}`
const inventoryFieldKey = (rowIndex: number, inventoryIndex: number, field: string) => `rows.${rowIndex}.inventory.${inventoryIndex}.${field}`
const attributeFieldKey = (rowIndex: number, attributeId: number) => `rows.${rowIndex}.attribute_value_ids.${attributeId}`
const tierFieldKey = (rowIndex: number, tierIndex: number, field: string) => `rows.${rowIndex}.tiered_prices.${tierIndex}.${field}`

const clearRowErrors = (rowIndex: number) => {
  Object.keys(fieldErrors.value)
    .filter(k => k.startsWith(`rows.${rowIndex}.`))
    .forEach((k) => {
      delete fieldErrors.value[k]
    })
}

const clearFieldError = (key: string) => {
  if (fieldErrors.value[key]) delete fieldErrors.value[key]
}

const clearServerErrors = () => {
  fieldErrors.value = {}
}

const addVariationRow = () => {
  variations.value.push(createEmptyVariation())
}

const removeVariationRow = (index: number) => {
  if (variations.value.length <= 1) return
  clearRowErrors(index)
  variations.value.splice(index, 1)
}

const addInventoryRow = (variationIndex: number) => {
  variations.value[variationIndex]?.inventoryRows.push(createEmptyInventoryRow())
}

const removeInventoryRow = (variationIndex: number, inventoryRowKey: number) => {
  const variation = variations.value[variationIndex]
  if (!variation) return
  variation.inventoryRows = variation.inventoryRows.filter(r => r._key !== inventoryRowKey)
}

const availableWarehousesForRow = (variation: VariationForm, inventoryRowKey: number) => {
  const usedIds = new Set(
    variation.inventoryRows
      .filter(r => r._key !== inventoryRowKey && r.warehouse_id)
      .map(r => String(r.warehouse_id)),
  )
  return warehouses.value.filter(w => isWarehouseActive(w) && !usedIds.has(String(w.id)))
}

const addTierPrice = (rowIndex: number) => {
  variations.value[rowIndex]?.tiered_prices.push({ quantity_from: 0, quantity_to: 0, price: 0 })
}

const removeTierPrice = (rowIndex: number, tierIndex: number) => {
  variations.value[rowIndex]?.tiered_prices.splice(tierIndex, 1)
}

const tieredRowsForVariation = (row: VariationForm) =>
  row.tiered_prices.map((tp, idx) => ({
    key: idx,
    minQty: tp.quantity_from,
    maxQty: tp.quantity_to,
    price: tp.price,
  }))

const tieredFieldErrorsForVariation = (rowIndex: number) =>
  Object.fromEntries(
    (variations.value[rowIndex]?.tiered_prices ?? []).map((_, tierIndex) => [
      String(tierIndex),
      {
        minQty: fieldErrors.value[tierFieldKey(rowIndex, tierIndex, 'quantity_from')],
        maxQty: fieldErrors.value[tierFieldKey(rowIndex, tierIndex, 'quantity_to')],
        price: fieldErrors.value[tierFieldKey(rowIndex, tierIndex, 'price')],
      },
    ]),
  )

const updateTieredMin = (rowIndex: number, payload: { key: string | number; value: string }) => {
  const tierIndex = Number(payload.key)
  const tierRow = variations.value[rowIndex]?.tiered_prices[tierIndex]
  if (!tierRow) return
  const cleaned = payload.value.replace(/[^0-9]/g, '')
  tierRow.quantity_from = cleaned === '' ? 0 : Number(cleaned)
  clearFieldError(tierFieldKey(rowIndex, tierIndex, 'quantity_from'))
}

const updateTieredMax = (rowIndex: number, payload: { key: string | number; value: string }) => {
  const tierIndex = Number(payload.key)
  const tierRow = variations.value[rowIndex]?.tiered_prices[tierIndex]
  if (!tierRow) return
  const cleaned = payload.value.replace(/[^0-9]/g, '')
  tierRow.quantity_to = cleaned === '' ? 0 : Number(cleaned)
  clearFieldError(tierFieldKey(rowIndex, tierIndex, 'quantity_to'))
}

const updateTieredPrice = (rowIndex: number, payload: { key: string | number; value: string }) => {
  const tierIndex = Number(payload.key)
  const tierRow = variations.value[rowIndex]?.tiered_prices[tierIndex]
  if (!tierRow) return
  const cleaned = payload.value.replace(/[^0-9.]/g, '')
  tierRow.price = cleaned === '' ? 0 : Number(cleaned)
  clearFieldError(tierFieldKey(rowIndex, tierIndex, 'price'))
}

const createVariationPayload = (row: VariationForm) => {
  const attributeValueIds = Object.values(row.selectedValues).map(v => Number(v)).filter(Boolean)
  const tieredPrices = row.tiered_prices
    .map(tp => ({
      quantity_from: Number(tp.quantity_from ?? 0),
      quantity_to: Number(tp.quantity_to ?? 0),
      price: Number(tp.price ?? 0),
    }))
    .filter(tp => tp.quantity_from > 0 || tp.quantity_to > 0 || tp.price > 0)
  const inventory = row.inventoryRows
    .filter(invRow => invRow.warehouse_id)
    .map(invRow => ({
      warehouse_id: Number(invRow.warehouse_id),
      quantity: Number(invRow.quantity ?? 0),
      min_quantity: Number(invRow.min_quantity ?? 0),
      allow_notification: Boolean(invRow.allow_notification),
    }))

  const payload: Record<string, unknown> = {
    // TEMP: variation fields are optional on create for now.
    sku: row.sku,
    barcode: row.barcode,
    price: row.price,
    buying_price: row.buying_price,
    stock_quantity: inventory.reduce((sum, invRow) => sum + Number(invRow.quantity ?? 0), 0),
    is_active: row.is_active,
    tiered_prices: tieredPrices.length ? tieredPrices : [],
  }

  if (attributeValueIds.length) payload.attribute_value_ids = attributeValueIds
  if (inventory.length) payload.inventory = inventory
  return payload
}

const validateProductAttributes = () => {
  if (!selectedAttributeIds.value.length) {
    fieldErrors.value.attribute_ids = t('products_variations.validation_attributes_required')
    return false
  }
  delete fieldErrors.value.attribute_ids
  return true
}

const validateRow = (row: VariationForm, rowIndex: number) => {
  let valid = true

  if (!row.sku.trim()) {
    fieldErrors.value[rowFieldKey(rowIndex, 'sku')] = t('products_form.validation_sku_required')
    valid = false
  }
  if (!row.barcode.trim()) {
    fieldErrors.value[rowFieldKey(rowIndex, 'barcode')] = t('products_variations.validation_barcode_required')
    valid = false
  }
  if (!(Number(row.price) > 0)) {
    fieldErrors.value[rowFieldKey(rowIndex, 'price')] = t('price_assignment.validation_standard_required')
    valid = false
  }
  if (!(Number(row.buying_price) > 0)) {
    fieldErrors.value[rowFieldKey(rowIndex, 'buying_price')] = t('price_assignment.validation_standard_required')
    valid = false
  }

  for (const attributeId of selectedAttributeIds.value) {
    if (!row.selectedValues[attributeId]) {
      fieldErrors.value[attributeFieldKey(rowIndex, attributeId)] = t('products_variations.validation_values_required')
      valid = false
    }
  }

  if (!row.inventoryRows.length) {
    fieldErrors.value[rowFieldKey(rowIndex, 'inventory')] = t('products_variations.validation_warehouse_required')
    valid = false
  }

  row.inventoryRows.forEach((inventoryRow, inventoryIndex) => {
    if (!inventoryRow.warehouse_id) {
      fieldErrors.value[inventoryFieldKey(rowIndex, inventoryIndex, 'warehouse_id')] = t('products_variations.validation_warehouse_required')
      valid = false
    }
    if (Number(inventoryRow.quantity) < 0) {
      fieldErrors.value[inventoryFieldKey(rowIndex, inventoryIndex, 'quantity')] = t('errors.required')
      valid = false
    }
    if (Number(inventoryRow.min_quantity) < 0) {
      fieldErrors.value[inventoryFieldKey(rowIndex, inventoryIndex, 'min_quantity')] = t('errors.required')
      valid = false
    }
  })

  row.tiered_prices.forEach((tier, tierIndex) => {
    if (!(Number(tier.quantity_from) >= 0)) {
      fieldErrors.value[tierFieldKey(rowIndex, tierIndex, 'quantity_from')] = t('errors.required')
      valid = false
    }
    if (!(Number(tier.quantity_to) > Number(tier.quantity_from))) {
      fieldErrors.value[tierFieldKey(rowIndex, tierIndex, 'quantity_to')] = t('price_assignment.validation_max_gt_min')
      valid = false
    }
    if (!(Number(tier.price) > 0)) {
      fieldErrors.value[tierFieldKey(rowIndex, tierIndex, 'price')] = t('price_assignment.validation_standard_required')
      valid = false
    }
  })

  return valid
}

const applyServerErrorsToRow = (rowIndex: number, errors: Record<string, string>) => {
  Object.entries(errors).forEach(([key, message]) => {
    if (!message) return

    if (key.startsWith('inventory.')) {
      fieldErrors.value[`rows.${rowIndex}.${key}`] = message
      return
    }
    if (key.startsWith('tiered_prices.')) {
      fieldErrors.value[`rows.${rowIndex}.${key}`] = message
      return
    }
    if (key.startsWith('attribute_value_ids')) {
      fieldErrors.value[rowFieldKey(rowIndex, 'attribute_value_ids')] = message
      return
    }
    fieldErrors.value[rowFieldKey(rowIndex, key)] = message
  })
}

const createVariations = async () => {
  if (!canCreateVariation.value) {
    errorMessage.value = t('common.forbidden')
    return
  }
  errorMessage.value = ''
  submitErrorMessage.value = ''
  clearServerErrors()
  if (!variations.value.length) variations.value.push(createEmptyVariation())
  if (!validateProductAttributes()) return
  const allRowsValid = variations.value.every((row, rowIndex) => validateRow(row, rowIndex))
  if (!allRowsValid) return

  submitting.value = true
  for (let rowIndex = 0; rowIndex < variations.value.length; rowIndex += 1) {
    const row = variations.value[rowIndex]!
    try {
      await productsStore.createVariation(productId.value, createVariationPayload(row))
    }
    catch (error: unknown) {
      const apiErrorMessage = getErrorMessage(error)
      submitErrorMessage.value = apiErrorMessage
      toast.error(apiErrorMessage)
      if (isValidationError(error)) {
        applyServerErrorsToRow(rowIndex, getFieldErrors(error))
      }
      submitting.value = false
      return
    }
  }
  submitErrorMessage.value = ''
  toast.success(t('products_variations.create_success'))
  await navigateTo(`/products/variations/${productId.value}`)
  submitting.value = false
}

onMounted(async () => {
  if (!canCreateVariation.value) return
  loading.value = true
  try {
    const whRes = await $api('/warehouses', { params: { page: 1, per_page: 100, status: 'active' } }).catch(() => ({}))
    warehouses.value = (((whRes as any)?.data?.warehouses ?? (whRes as any)?.warehouses ?? []) as WarehouseItem[])
      .filter(isWarehouseActive)
    await Promise.all([attributesStore.load(), productsStore.loadProductDraft(productId.value)])
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
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink :to="`/products/variations/${productId}`"><ArrowRight class="size-4" /></NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_variations.create_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('products_variations.create_subtitle') }}</p>
      </div>
    </div>

    <div v-if="!canCreateVariation" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
      {{ t('common.forbidden') }}
    </div>

    <div v-else-if="errorMessage" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
      {{ errorMessage }}
    </div>

    <div v-else-if="loading" class="rounded-lg border p-8 text-center text-muted-foreground">
      <Loader2 class="mx-auto size-10 animate-spin mb-3" />
      <p class="text-sm">{{ t('common.loading') }}</p>
    </div>

    <div v-else class="rounded-lg border p-5 space-y-4">
      <div v-if="submitErrorMessage" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
        {{ submitErrorMessage }}
      </div>
      <div
        v-for="(row, rowIndex) in variations"
        :key="rowIndex"
        class="rounded-md border p-4 space-y-4"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-medium">
            {{ t('products_variations.add_variation') }} #{{ rowIndex + 1 }}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            :disabled="variations.length <= 1"
            @click="removeVariationRow(rowIndex)"
          >
            <Trash2 class="size-4 mr-1" />
            {{ t('common.delete') }}
          </Button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label class="text-xs font-medium">{{ t('products_variations.variation_sku') }}</label>
            <Input v-model="row.sku" @input="clearFieldError(rowFieldKey(rowIndex, 'sku'))" />
            <p v-if="fieldErrors[rowFieldKey(rowIndex, 'sku')]" class="text-xs text-red-600">{{ fieldErrors[rowFieldKey(rowIndex, 'sku')] }}</p>
          </div>
          <div>
            <label class="text-xs font-medium">{{ t('products_variations.variation_barcode') }}</label>
            <Input v-model="row.barcode" @input="clearFieldError(rowFieldKey(rowIndex, 'barcode'))" />
            <p v-if="fieldErrors[rowFieldKey(rowIndex, 'barcode')]" class="text-xs text-red-600">{{ fieldErrors[rowFieldKey(rowIndex, 'barcode')] }}</p>
          </div>
          <div>
            <label class="text-xs font-medium">{{ t('products_variations.variation_price') }}</label>
            <Input v-model.number="row.price" type="number" min="0" @input="clearFieldError(rowFieldKey(rowIndex, 'price'))" />
            <p v-if="fieldErrors[rowFieldKey(rowIndex, 'price')]" class="text-xs text-red-600">{{ fieldErrors[rowFieldKey(rowIndex, 'price')] }}</p>
          </div>
          <div>
            <label class="text-xs font-medium">{{ t('products_variations.buying_price') }}</label>
            <Input v-model.number="row.buying_price" type="number" min="0" @input="clearFieldError(rowFieldKey(rowIndex, 'buying_price'))" />
            <p v-if="fieldErrors[rowFieldKey(rowIndex, 'buying_price')]" class="text-xs text-red-600">{{ fieldErrors[rowFieldKey(rowIndex, 'buying_price')] }}</p>
          </div>
        </div>

        <div class="rounded-md border p-3 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-medium">{{ t('products_page.filter_warehouse') }}</h3>
            <Button variant="outline" size="sm" @click="addInventoryRow(rowIndex)">
              <Plus class="size-4 mr-1" />
              {{ t('warehouse_assignment.add_row') }}
            </Button>
          </div>

          <div v-if="!row.inventoryRows.length" class="text-sm text-muted-foreground">
            {{ t('warehouse_assignment.empty_hint') }}
          </div>

          <div v-for="(inventoryRow, index) in row.inventoryRows" :key="inventoryRow._key" class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div class="md:col-span-4">
              <label class="text-xs font-medium">{{ t('warehouse_assignment.col_warehouse') }}</label>
              <Select
                :model-value="inventoryRow.warehouse_id ? String(inventoryRow.warehouse_id) : ''"
                @update:model-value="v => { inventoryRow.warehouse_id = v ? Number(v) : null; clearFieldError(inventoryFieldKey(rowIndex, index, 'warehouse_id')) }"
              >
                <SelectTrigger><SelectValue :placeholder="t('products_page.filter_warehouse')" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="w in availableWarehousesForRow(row, inventoryRow._key)" :key="w.id" :value="String(w.id)">
                    {{ w.name_en || w.name_ar || `#${w.id}` }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="fieldErrors[inventoryFieldKey(rowIndex, index, 'warehouse_id')]" class="text-xs text-red-600">{{ fieldErrors[inventoryFieldKey(rowIndex, index, 'warehouse_id')] }}</p>
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-medium">{{ t('warehouse_assignment.col_stock') }}</label>
              <Input v-model.number="inventoryRow.quantity" type="number" min="0" @input="clearFieldError(inventoryFieldKey(rowIndex, index, 'quantity'))" />
              <p v-if="fieldErrors[inventoryFieldKey(rowIndex, index, 'quantity')]" class="text-xs text-red-600">{{ fieldErrors[inventoryFieldKey(rowIndex, index, 'quantity')] }}</p>
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-medium">{{ t('warehouse_assignment.col_min_qty') }}</label>
              <Input v-model.number="inventoryRow.min_quantity" type="number" min="0" @input="clearFieldError(inventoryFieldKey(rowIndex, index, 'min_quantity'))" />
              <p v-if="fieldErrors[inventoryFieldKey(rowIndex, index, 'min_quantity')]" class="text-xs text-red-600">{{ fieldErrors[inventoryFieldKey(rowIndex, index, 'min_quantity')] }}</p>
            </div>
            <div class="md:col-span-3">
              <label class="text-xs font-medium block mb-2">{{ t('warehouse_assignment.col_notifications') }}</label>
              <label class="inline-flex items-center gap-2 text-sm">
                <Checkbox :model-value="inventoryRow.allow_notification" @update:model-value="v => inventoryRow.allow_notification = Boolean(v)" />
                <span>{{ t('warehouse_assignment.col_notifications') }}</span>
              </label>
            </div>
            <div class="md:col-span-1">
              <Button variant="ghost" size="sm" class="w-full" @click="removeInventoryRow(rowIndex, inventoryRow._key)">
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div v-for="attributeId in selectedAttributeIds" :key="`${rowIndex}_${attributeId}`">
            <Select :model-value="row.selectedValues[attributeId] ? String(row.selectedValues[attributeId]) : ''" @update:model-value="v => { row.selectedValues[attributeId] = Number(v); clearFieldError(attributeFieldKey(rowIndex, attributeId)); clearFieldError(rowFieldKey(rowIndex, 'attribute_value_ids')) }" required="true">
              <SelectTrigger><SelectValue :placeholder="attributesStore.attributeName(attributeId)" /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="v in attributesStore.valuesByAttributeId.get(attributeId) || []"
                  :key="v.id"
                  :value="String(v.id)"
                >
                  {{ v.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="fieldErrors[attributeFieldKey(rowIndex, attributeId)]" class="text-xs text-red-600">{{ fieldErrors[attributeFieldKey(rowIndex, attributeId)] }}</p>
          </div>
        </div>
        <p v-if="fieldErrors[rowFieldKey(rowIndex, 'attribute_value_ids')]" class="text-xs text-red-600">{{ fieldErrors[rowFieldKey(rowIndex, 'attribute_value_ids')] }}</p>

        <TieredPriceTableSection
          :table-title="t('products_variations.tiered_prices')"
          :min-qty-label="t('price_assignment.col_min_qty')"
          :max-qty-label="t('price_assignment.col_max_qty')"
          :price-label="t('price_assignment.col_price_per_unit')"
          :actions-label="t('price_assignment.col_actions')"
          :add-row-label="t('products_variations.add_tier_price')"
          :clear-all-label="t('price_assignment.clear_all')"
          :empty-hint="t('price_assignment.empty_hint')"
          :price-placeholder="t('price_assignment.placeholder_price')"
          :rows="tieredRowsForVariation(row)"
          :field-error-by-key="tieredFieldErrorsForVariation(rowIndex)"
          @add-row="addTierPrice(rowIndex)"
          @remove-row="(key) => removeTierPrice(rowIndex, Number(key))"
          @clear-rows="variations[rowIndex] && (variations[rowIndex].tiered_prices = [])"
          @update-min-qty="(payload) => updateTieredMin(rowIndex, payload)"
          @update-max-qty="(payload) => updateTieredMax(rowIndex, payload)"
          @update-price="(payload) => updateTieredPrice(rowIndex, payload)"
        />
        <p v-if="fieldErrors[rowFieldKey(rowIndex, 'tiered_prices')]" class="text-xs text-red-600">{{ fieldErrors[rowFieldKey(rowIndex, 'tiered_prices')] }}</p>
      </div>

      <div class="pt-4 border-t">
        <Button variant="outline" class="w-full" @click="addVariationRow">
          <Plus class="size-4 mr-1" />
          {{ t('products_variations.add_variation') }}
        </Button>
      </div>
    </div>

    <div v-if="canCreateVariation" class="flex justify-end gap-2">
      <Button variant="outline" as-child><NuxtLink :to="`/products/variations/${productId}`">{{ t('common.cancel') }}</NuxtLink></Button>
      <Button class="bg-primary hover:bg-primary/90 text-Green-Light" :disabled="submitting" @click="createVariations">
        <Loader2 v-if="submitting" class="size-4 animate-spin mr-1" />
        {{ submitting ? t('common.saving') : t('common.save') }}
      </Button>
    </div>
  </div>
</template>
