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
const variationId = computed(() => String(route.params.variationId))
const { t } = useI18n()
const productsStore = useProductsStore()
const attributesStore = useAttributesStore()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const { $api } = useApi()
const { can } = usePermissions()
const canEditVariation = computed(() => can('product_variations.update'))

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
type WarehouseItem = {
  id: number
  name_ar?: string
  name_en?: string
  status?: string
  is_active?: boolean | number | string
}

const warehouses = ref<WarehouseItem[]>([])

interface InventoryRowForm {
  _key: number
  warehouse_id: number | null
  quantity: number
  min_quantity: number
  allow_notification: boolean
}

let inventoryRowKeyCounter = 0

const createEmptyInventoryRow = (row: Partial<Omit<InventoryRowForm, '_key'>> = {}): InventoryRowForm => ({
  _key: ++inventoryRowKeyCounter,
  warehouse_id: row.warehouse_id ?? null,
  quantity: Number(row.quantity ?? 0),
  min_quantity: Number(row.min_quantity ?? 0),
  allow_notification: row.allow_notification ?? true,
})

const form = ref({
  sku: '',
  barcode: '',
  price: 0,
  buying_price: 0,
  is_active: true,
  selectedValues: {} as Record<number, number>,
  tiered_prices: [] as Array<{ quantity_from: number, quantity_to: number, price: number }>,
  inventoryRows: [createEmptyInventoryRow()] as InventoryRowForm[],
})

const selectedAttributeIds = computed(() => productsStore.draft.attribute_ids)
const isWarehouseActive = (warehouse: WarehouseItem) => {
  if (warehouse.status) return String(warehouse.status).toLowerCase() === 'active'
  if (warehouse.is_active === undefined) return true
  return warehouse.is_active === true || warehouse.is_active === 1 || warehouse.is_active === '1'
}

const clearFieldError = (key: string) => {
  if (fieldErrors.value[key]) delete fieldErrors.value[key]
}

const applyServerFieldErrors = (errors: Record<string, string>) => {
  fieldErrors.value = {}
  Object.entries(errors).forEach(([key, message]) => {
    if (!message) return
    fieldErrors.value[key] = message
  })
}

const validateForm = () => {
  fieldErrors.value = {}
  let valid = true

  if (!form.value.sku.trim()) {
    fieldErrors.value.sku = t('products_form.validation_sku_required')
    valid = false
  }
  if (!form.value.barcode.trim()) {
    fieldErrors.value.barcode = t('products_variations.validation_barcode_required')
    valid = false
  }
  if (!(Number(form.value.price) > 0)) {
    fieldErrors.value.price = t('price_assignment.validation_standard_required')
    valid = false
  }
  if (!(Number(form.value.buying_price) > 0)) {
    fieldErrors.value.buying_price = t('price_assignment.validation_standard_required')
    valid = false
  }

  for (const attributeId of selectedAttributeIds.value) {
    if (!form.value.selectedValues[attributeId]) {
      fieldErrors.value[`attribute_value_ids.${attributeId}`] = t('products_variations.validation_values_required')
      valid = false
    }
  }

  if (!form.value.inventoryRows.length) {
    fieldErrors.value.inventory = t('products_variations.validation_warehouse_required')
    valid = false
  }

  form.value.inventoryRows.forEach((row, inventoryIndex) => {
    if (!row.warehouse_id) {
      fieldErrors.value[`inventory.${inventoryIndex}.warehouse_id`] = t('products_variations.validation_warehouse_required')
      valid = false
    }
    if (Number(row.quantity) < 0) {
      fieldErrors.value[`inventory.${inventoryIndex}.quantity`] = t('errors.required')
      valid = false
    }
    if (Number(row.min_quantity) < 0) {
      fieldErrors.value[`inventory.${inventoryIndex}.min_quantity`] = t('errors.required')
      valid = false
    }
  })

  form.value.tiered_prices.forEach((tier, tierIndex) => {
    if (!(Number(tier.quantity_from) >= 0)) {
      fieldErrors.value[`tiered_prices.${tierIndex}.quantity_from`] = t('errors.required')
      valid = false
    }
    if (!(Number(tier.quantity_to) > Number(tier.quantity_from))) {
      fieldErrors.value[`tiered_prices.${tierIndex}.quantity_to`] = t('price_assignment.validation_max_gt_min')
      valid = false
    }
    if (!(Number(tier.price) > 0)) {
      fieldErrors.value[`tiered_prices.${tierIndex}.price`] = t('price_assignment.validation_standard_required')
      valid = false
    }
  })

  return valid
}

const addInventoryRow = () => {
  form.value.inventoryRows.push(createEmptyInventoryRow())
}

const removeInventoryRow = (inventoryRowKey: number) => {
  form.value.inventoryRows = form.value.inventoryRows.filter(row => row._key !== inventoryRowKey)
}

const availableWarehousesForRow = (inventoryRowKey: number) => {
  const usedIds = new Set(
    form.value.inventoryRows
      .filter(row => row._key !== inventoryRowKey && row.warehouse_id)
      .map(row => String(row.warehouse_id)),
  )
  return warehouses.value.filter(w => isWarehouseActive(w) && !usedIds.has(String(w.id)))
}

const addTierPrice = () => {
  form.value.tiered_prices.push({ quantity_from: 0, quantity_to: 0, price: 0 })
}

const removeTierPrice = (index: number) => {
  form.value.tiered_prices.splice(index, 1)
}

const tieredRows = computed(() =>
  form.value.tiered_prices.map((tp, idx) => ({
    key: idx,
    minQty: tp.quantity_from,
    maxQty: tp.quantity_to,
    price: tp.price,
  })),
)

const tieredFieldErrors = computed(() =>
  Object.fromEntries(
    form.value.tiered_prices.map((_, idx) => [
      String(idx),
      {
        minQty: fieldErrors.value[`tiered_prices.${idx}.quantity_from`],
        maxQty: fieldErrors.value[`tiered_prices.${idx}.quantity_to`],
        price: fieldErrors.value[`tiered_prices.${idx}.price`],
      },
    ]),
  ),
)

const updateTieredMin = (payload: { key: string | number; value: string }) => {
  const idx = Number(payload.key)
  const tier = form.value.tiered_prices[idx]
  if (!tier) return
  const cleaned = payload.value.replace(/[^0-9]/g, '')
  tier.quantity_from = cleaned === '' ? 0 : Number(cleaned)
  clearFieldError(`tiered_prices.${idx}.quantity_from`)
}

const updateTieredMax = (payload: { key: string | number; value: string }) => {
  const idx = Number(payload.key)
  const tier = form.value.tiered_prices[idx]
  if (!tier) return
  const cleaned = payload.value.replace(/[^0-9]/g, '')
  tier.quantity_to = cleaned === '' ? 0 : Number(cleaned)
  clearFieldError(`tiered_prices.${idx}.quantity_to`)
}

const updateTieredPrice = (payload: { key: string | number; value: string }) => {
  const idx = Number(payload.key)
  const tier = form.value.tiered_prices[idx]
  if (!tier) return
  const cleaned = payload.value.replace(/[^0-9.]/g, '')
  tier.price = cleaned === '' ? 0 : Number(cleaned)
  clearFieldError(`tiered_prices.${idx}.price`)
}

const saveVariation = async () => {
  if (!canEditVariation.value) {
    errorMessage.value = t('common.forbidden')
    return
  }
  errorMessage.value = ''
  if (!validateForm()) return
  const attribute_value_ids = Object.values(form.value.selectedValues).map(v => Number(v)).filter(Boolean)
  const tieredPrices = form.value.tiered_prices
    .map(tp => ({
      quantity_from: Number(tp.quantity_from ?? 0),
      quantity_to: Number(tp.quantity_to ?? 0),
      price: Number(tp.price ?? 0),
    }))
    .filter(tp => tp.quantity_from > 0 || tp.quantity_to > 0 || tp.price > 0)
  const inventory = form.value.inventoryRows
    .filter(row => row.warehouse_id)
    .map(row => ({
      warehouse_id: Number(row.warehouse_id),
      quantity: Number(row.quantity ?? 0),
      min_quantity: Number(row.min_quantity ?? 0),
      allow_notification: Boolean(row.allow_notification),
    }))

  submitting.value = true
  try {
    await productsStore.updateVariation(productId.value, variationId.value, {
      sku: form.value.sku,
      barcode: form.value.barcode,
      price: form.value.price,
      buying_price: form.value.buying_price,
      stock_quantity: inventory.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
      is_active: form.value.is_active,
      attribute_value_ids,
      tiered_prices: tieredPrices.length ? tieredPrices : [],
      inventory,
    })
    toast.success(t('toasts.save_success'))
    await navigateTo(`/products/variations/${productId.value}`)
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      applyServerFieldErrors(getFieldErrors(error))
      errorMessage.value = ''
    }
    else {
      errorMessage.value = getErrorMessage(error)
    }
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!canEditVariation.value) return
  loading.value = true
  try {
    const whRes = await $api('/warehouses', { params: { page: 1, per_page: 100, status: 'active' } }).catch(() => ({}))
    warehouses.value = (((whRes as any)?.data?.warehouses ?? (whRes as any)?.warehouses ?? []) as WarehouseItem[])
      .filter(isWarehouseActive)
    await Promise.all([attributesStore.load(), productsStore.loadProductDraft(productId.value)])
    const response = await productsStore.getVariation(productId.value, variationId.value)
    const variation = (response as any)?.data?.variation ?? (response as any)?.variation ?? (response as any)?.data ?? response

    form.value.sku = String(variation?.sku ?? '')
    form.value.barcode = String(variation?.barcode ?? '')
    form.value.price = Number(variation?.price ?? 0)
    form.value.buying_price = Number(variation?.buying_price ?? 0)
    form.value.is_active = variation?.is_active !== false && variation?.is_active !== 0 && variation?.is_active !== '0'
    const inventoryRows: Array<Omit<InventoryRowForm, '_key'>> = (Array.isArray(variation?.inventory) ? variation.inventory : []).map((inventoryRow: any) => ({
      warehouse_id: Number(inventoryRow?.warehouse_id ?? inventoryRow?.warehouse?.id ?? 0) || null,
      quantity: Number(inventoryRow?.quantity ?? 0),
      min_quantity: Number(inventoryRow?.min_quantity ?? 0),
      allow_notification:
        inventoryRow?.allow_notification !== false
        && inventoryRow?.allow_notification !== 0
        && inventoryRow?.allow_notification !== '0',
    }))
    form.value.inventoryRows = inventoryRows.length
      ? inventoryRows.map(row => createEmptyInventoryRow(row))
      : [createEmptyInventoryRow()]
    form.value.tiered_prices = (variation?.tiered_prices ?? []).map((tp: any) => ({
      quantity_from: Number(tp.quantity_from ?? 0),
      quantity_to: Number(tp.quantity_to ?? 0),
      price: Number(tp.price ?? 0),
    }))

    const attrValues = (variation?.attribute_values ?? []) as Array<{ id?: number, attribute_id?: number }>
    const selected: Record<number, number> = {}
    for (const v of attrValues) {
      if (v.attribute_id && v.id) selected[Number(v.attribute_id)] = Number(v.id)
    }
    form.value.selectedValues = selected
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_variations.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground">#{{ variationId }}</p>
      </div>
    </div>

    <div v-if="!canEditVariation" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
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
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="text-xs font-medium">{{ t('products_variations.variation_sku') }}</label>
          <Input v-model="form.sku" @input="clearFieldError('sku')" />
          <p v-if="fieldErrors.sku" class="text-xs text-red-600">{{ fieldErrors.sku }}</p>
        </div>
        <div>
          <label class="text-xs font-medium">{{ t('products_variations.variation_barcode') }}</label>
          <Input v-model="form.barcode" @input="clearFieldError('barcode')" />
          <p v-if="fieldErrors.barcode" class="text-xs text-red-600">{{ fieldErrors.barcode }}</p>
        </div>
        <div>
          <label class="text-xs font-medium">{{ t('products_variations.variation_price') }}</label>
          <Input v-model.number="form.price" type="number" min="0" @input="clearFieldError('price')" />
          <p v-if="fieldErrors.price" class="text-xs text-red-600">{{ fieldErrors.price }}</p>
        </div>
        <div>
          <label class="text-xs font-medium">{{ t('products_variations.buying_price') }}</label>
          <Input v-model.number="form.buying_price" type="number" min="0" @input="clearFieldError('buying_price')" />
          <p v-if="fieldErrors.buying_price" class="text-xs text-red-600">{{ fieldErrors.buying_price }}</p>
        </div>
      </div>

      <div class="rounded-md border p-3 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-medium">{{ t('products_page.filter_warehouse') }}</h2>
          <Button variant="outline" size="sm" @click="addInventoryRow">
            <Plus class="size-4 mr-1" />
            {{ t('warehouse_assignment.add_row') }}
          </Button>
        </div>

        <div v-if="!form.inventoryRows.length" class="text-sm text-muted-foreground">
          {{ t('warehouse_assignment.empty_hint') }}
        </div>

        <div v-for="(inventoryRow, inventoryIndex) in form.inventoryRows" :key="inventoryRow._key" class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div class="md:col-span-4">
            <label class="text-xs font-medium">{{ t('warehouse_assignment.col_warehouse') }}</label>
            <Select
              :model-value="inventoryRow.warehouse_id ? String(inventoryRow.warehouse_id) : ''"
              @update:model-value="v => { inventoryRow.warehouse_id = v ? Number(v) : null; clearFieldError(`inventory.${inventoryIndex}.warehouse_id`) }"
            >
              <SelectTrigger><SelectValue :placeholder="t('products_page.filter_warehouse')" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="w in availableWarehousesForRow(inventoryRow._key)" :key="w.id" :value="String(w.id)">
                  {{ w.name_en || w.name_ar || `#${w.id}` }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="fieldErrors[`inventory.${inventoryIndex}.warehouse_id`]" class="text-xs text-red-600">{{ fieldErrors[`inventory.${inventoryIndex}.warehouse_id`] }}</p>
          </div>
          <div class="md:col-span-2">
            <label class="text-xs font-medium">{{ t('warehouse_assignment.col_stock') }}</label>
            <Input v-model.number="inventoryRow.quantity" type="number" min="0" @input="clearFieldError(`inventory.${inventoryIndex}.quantity`)" />
            <p v-if="fieldErrors[`inventory.${inventoryIndex}.quantity`]" class="text-xs text-red-600">{{ fieldErrors[`inventory.${inventoryIndex}.quantity`] }}</p>
          </div>
          <div class="md:col-span-2">
            <label class="text-xs font-medium">{{ t('warehouse_assignment.col_min_qty') }}</label>
            <Input v-model.number="inventoryRow.min_quantity" type="number" min="0" @input="clearFieldError(`inventory.${inventoryIndex}.min_quantity`)" />
            <p v-if="fieldErrors[`inventory.${inventoryIndex}.min_quantity`]" class="text-xs text-red-600">{{ fieldErrors[`inventory.${inventoryIndex}.min_quantity`] }}</p>
          </div>
          <div class="md:col-span-3">
            <label class="text-xs font-medium block mb-2">{{ t('warehouse_assignment.col_notifications') }}</label>
            <label class="inline-flex items-center gap-2 text-sm">
              <Checkbox :model-value="inventoryRow.allow_notification" @update:model-value="v => inventoryRow.allow_notification = Boolean(v)" />
              <span>{{ t('warehouse_assignment.col_notifications') }}</span>
            </label>
          </div>
          <div class="md:col-span-1">
            <Button variant="ghost" size="sm" class="w-full" @click="removeInventoryRow(inventoryRow._key)">
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div v-for="attributeId in selectedAttributeIds" :key="attributeId">
          <Select :model-value="form.selectedValues[attributeId] ? String(form.selectedValues[attributeId]) : ''" @update:model-value="v => { form.selectedValues[attributeId] = Number(v); clearFieldError(`attribute_value_ids.${attributeId}`); clearFieldError('attribute_value_ids') }">
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
          <p v-if="fieldErrors[`attribute_value_ids.${attributeId}`]" class="text-xs text-red-600">{{ fieldErrors[`attribute_value_ids.${attributeId}`] }}</p>
        </div>
      </div>
      <p v-if="fieldErrors.attribute_value_ids" class="text-xs text-red-600">{{ fieldErrors.attribute_value_ids }}</p>

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
        :rows="tieredRows"
        :field-error-by-key="tieredFieldErrors"
        @add-row="addTierPrice"
        @remove-row="(key) => removeTierPrice(Number(key))"
        @clear-rows="form.tiered_prices = []"
        @update-min-qty="updateTieredMin"
        @update-max-qty="updateTieredMax"
        @update-price="updateTieredPrice"
      />
      <p v-if="fieldErrors.tiered_prices" class="text-xs text-red-600">{{ fieldErrors.tiered_prices }}</p>
    </div>

    <div v-if="canEditVariation" class="flex justify-end gap-2">
      <Button variant="outline" as-child><NuxtLink :to="`/products/variations/${productId}`">{{ t('common.cancel') }}</NuxtLink></Button>
      <Button class="bg-primary hover:bg-primary/90 text-Green-Light" :disabled="submitting" @click="saveVariation">
        <Loader2 v-if="submitting" class="size-4 animate-spin mr-1" />
        {{ submitting ? t('common.saving') : t('common.save') }}
      </Button>
    </div>
  </div>
</template>
