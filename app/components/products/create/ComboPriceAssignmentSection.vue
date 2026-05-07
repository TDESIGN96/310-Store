<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import TieredPriceTableSection from '@/components/products/shared/TieredPriceTableSection.vue'

const { t } = useI18n()

interface TieredRow {
  _key: number
  minQty: string
  maxQty: string
  pricePerUnit: string
}

const standardPrice = ref('')
const tieredRows = ref<TieredRow[]>([])
let _keyCounter = 0

const sectionError = ref('')
const rowError = ref('')

function addTieredRow() {
  tieredRows.value.push({
    _key: ++_keyCounter,
    minQty: '',
    maxQty: '',
    pricePerUnit: '',
  })
}

function removeTieredRow(key: number) {
  tieredRows.value = tieredRows.value.filter(r => r._key !== key)
  rowError.value = ''
}

function onStandardPriceInput(e: Event) {
  const el = e.target as HTMLInputElement
  const value = el.value.replace(/[^0-9.]/g, '')
  standardPrice.value = value
  el.value = value
  rowError.value = ''
  sectionError.value = ''
}

function addTieredPricingRow() {
  rowError.value = ''
  sectionError.value = ''
  addTieredRow()
}

function clearTieredRows() {
  tieredRows.value = []
  rowError.value = ''
}

const findRowByKey = (key: string | number) => tieredRows.value.find(row => row._key === Number(key))

const updateMinQty = ({ key, value }: { key: string | number; value: string }) => {
  const row = findRowByKey(key)
  if (!row) return
  const cleaned = value.replace(/[^0-9]/g, '')
  row.minQty = cleaned
  rowError.value = ''
  sectionError.value = ''
}

const updateMaxQty = ({ key, value }: { key: string | number; value: string }) => {
  const row = findRowByKey(key)
  if (!row) return
  const cleaned = value.replace(/[^0-9]/g, '')
  row.maxQty = cleaned
  rowError.value = ''
  sectionError.value = ''
}

const updatePrice = ({ key, value }: { key: string | number; value: string }) => {
  const row = findRowByKey(key)
  if (!row) return
  const cleaned = value.replace(/[^0-9.]/g, '')
  row.pricePerUnit = cleaned
  rowError.value = ''
  sectionError.value = ''
}

function validate() {
  rowError.value = ''
  sectionError.value = ''

  const parsedStandardPrice = Number(standardPrice.value)
  if (!standardPrice.value.trim() || !Number.isFinite(parsedStandardPrice)) {
    sectionError.value = t('products_combo.validation_bundle_price_numeric')
    return false
  }

  for (const row of tieredRows.value) {
    const min = Number(row.minQty)
    const max = Number(row.maxQty)
    const unitPrice = Number(row.pricePerUnit)

    if (!row.minQty || !row.maxQty || !row.pricePerUnit || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(unitPrice)) {
      rowError.value = t('products_combo.validation_tiered_row_required')
      return false
    }

    if (max <= min) {
      rowError.value = t('products_combo.validation_tiered_max_gt_min')
      return false
    }
  }

  return true
}

function getPricingPayload() {
  const mapped = tieredRows.value.map(row => ({
    quantity_from: Number(row.minQty),
    quantity_to: Number(row.maxQty),
    price: Number(row.pricePerUnit),
  }))

  return {
    pricing_type: 'standard' as const,
    price: Number(standardPrice.value),
    tiered_prices: mapped.length ? mapped : null,
  }
}

function setPricing(data: {
  price?: string | number | null
  tiered_prices?: Array<{
    quantity_from?: string | number
    quantity_to?: string | number
    price?: string | number
  }>
}) {
  standardPrice.value = data.price != null ? String(data.price) : ''
  tieredRows.value = (data.tiered_prices ?? []).map(row => ({
    _key: ++_keyCounter,
    minQty: String(row.quantity_from ?? ''),
    maxQty: String(row.quantity_to ?? ''),
    pricePerUnit: String(row.price ?? ''),
  }))
  sectionError.value = ''
  rowError.value = ''
}

defineExpose({
  validate,
  getPricingPayload,
  setPricing,
})
</script>

<template>
  <div class="rounded-lg border p-5 space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('products_create.step_badge', { n: 3 }) }}
      </p>
      <h2 class="text-lg font-semibold tracking-tight mt-1">
        {{ t('products_combo.section_pricing_title') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('products_combo.tiered_optional_hint') }}
      </p>
    </div>

    <Separator />

    <div class="max-w-sm space-y-2">
      <label class="text-sm font-medium">{{ t('price_assignment.col_bundle_price') }}</label>
      <Input
        :model-value="standardPrice"
        type="text"
        inputmode="decimal"
        class="h-9 w-full font-mono rtl:text-right"
        dir="ltr"
        :placeholder="t('price_assignment.placeholder_price')"
        @input="onStandardPriceInput"
      />
    </div>

    <TieredPriceTableSection
      :table-title="t('products_variations.tiered_prices')"
      :min-qty-label="t('price_assignment.col_min_qty')"
      :max-qty-label="t('price_assignment.col_max_qty')"
      :price-label="t('price_assignment.col_price_per_unit')"
      :actions-label="t('products_combo.col_actions')"
      :add-row-label="t('products_combo.add_pricing_row')"
      :clear-all-label="t('price_assignment.clear_all')"
      :empty-hint="t('products_combo.pricing_empty_hint')"
      :price-placeholder="t('price_assignment.placeholder_price')"
      :rows="tieredRows.map(row => ({ key: row._key, minQty: row.minQty, maxQty: row.maxQty, price: row.pricePerUnit }))"
      :row-error="rowError"
      :section-error="sectionError"
      @add-row="addTieredPricingRow"
      @clear-rows="clearTieredRows"
      @remove-row="removeTieredRow"
      @update-min-qty="updateMinQty"
      @update-max-qty="updateMaxQty"
      @update-price="updatePrice"
    />
  </div>
</template>
