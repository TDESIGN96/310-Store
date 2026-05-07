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

function onStandardPriceInput(e: Event) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/[^0-9.]/g, '')
  standardPrice.value = digits
  el.value = digits
  sectionError.value = ''
}

function addTieredRow() {
  rowError.value = ''
  sectionError.value = ''
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

function validate(): boolean {
  sectionError.value = ''
  rowError.value = ''

  if (!standardPrice.value.trim()) {
    sectionError.value = t('price_assignment.validation_standard_required')
    return false
  }

  for (const row of tieredRows.value) {
    if (!row.minQty || !row.maxQty || !row.pricePerUnit) {
      rowError.value = t('price_assignment.validation_tiered_row_required')
      return false
    }
    const min = Number(row.minQty)
    const max = Number(row.maxQty)
    if (max <= min) {
      rowError.value = t('price_assignment.validation_max_gt_min')
      return false
    }
  }

  return true
}

function getPricing() {
  const standard = Number(standardPrice.value || 0)
  const mappedTiered = tieredRows.value.map(r => ({
    quantity_from: Number(r.minQty || 0),
    quantity_to: Number(r.maxQty || 0),
    price: Number(r.pricePerUnit || 0),
  }))

  return {
    standard_price: standard,
    tiered_prices: mappedTiered.length ? mappedTiered : null,
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

defineExpose({ validate, getPricing, setPricing })
</script>

<template>
  <div class="rounded-lg border p-5 space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('products_create.step_badge', { n: 3 }) }}
      </p>
      <h2 class="text-lg font-semibold tracking-tight mt-1">
        {{ t('products_create.price_section_title') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('price_assignment.section_hint') }}
      </p>
    </div>

    <Separator />

    <div class="space-y-2 max-w-sm">
      <label class="text-sm font-medium">{{ t('price_assignment.standard_price_label') }}</label>
      <Input
        :model-value="standardPrice"
        type="text"
        inputmode="decimal"
        class="h-9 font-mono"
        dir="ltr"
        :placeholder="t('price_assignment.placeholder_price')"
        @input="onStandardPriceInput"
      />
      <p class="text-xs text-muted-foreground">{{ t('price_assignment.tiered_optional_hint') }}</p>
    </div>

    <TieredPriceTableSection
      :table-title="t('products_variations.tiered_prices')"
      :min-qty-label="t('price_assignment.col_min_qty')"
      :max-qty-label="t('price_assignment.col_max_qty')"
      :price-label="t('price_assignment.col_price_per_unit')"
      :actions-label="t('price_assignment.col_actions')"
      :add-row-label="t('price_assignment.add_row')"
      :clear-all-label="t('price_assignment.clear_all')"
      :empty-hint="t('price_assignment.empty_hint')"
      :price-placeholder="t('price_assignment.placeholder_price')"
      :rows="tieredRows.map(row => ({ key: row._key, minQty: row.minQty, maxQty: row.maxQty, price: row.pricePerUnit }))"
      :row-error="rowError"
      :section-error="sectionError"
      @add-row="addTieredRow"
      @clear-rows="clearTieredRows"
      @remove-row="(key) => removeTieredRow(Number(key))"
      @update-min-qty="updateMinQty"
      @update-max-qty="updateMaxQty"
      @update-price="updatePrice"
    />
  </div>
</template>
