<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

function onDecimalInput(e: Event, obj: Record<string, string>, field: string) {
  const el = e.target as HTMLInputElement
  const value = el.value.replace(/[^0-9.]/g, '')
  obj[field] = value
  el.value = value
  rowError.value = ''
  sectionError.value = ''
}

function onIntegerInput(e: Event, obj: Record<string, string>, field: string) {
  const el = e.target as HTMLInputElement
  const value = el.value.replace(/[^0-9]/g, '')
  obj[field] = value
  el.value = value
  rowError.value = ''
  sectionError.value = ''
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
    tiered_prices: mapped,
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
        class="h-9 w-full font-mono"
        dir="ltr"
        :placeholder="t('price_assignment.placeholder_price')"
        @input="onStandardPriceInput"
      />
    </div>

    <div class="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="rtl:text-right font-medium min-w-[130px]">
              {{ t('price_assignment.col_min_qty') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium min-w-[130px]">
              {{ t('price_assignment.col_max_qty') }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium min-w-[150px]">
              {{ t('price_assignment.col_price_per_unit') }}
            </TableHead>
            <TableHead class="font-medium w-[80px] text-center">
              {{ t('products_combo.col_actions') }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="tieredRows.length === 0">
            <TableCell :colspan="4" class="py-10 text-center text-sm text-muted-foreground">
              {{ t('products_combo.pricing_empty_hint') }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="row in tieredRows"
            v-else
            :key="row._key"
            class="hover:bg-muted/20 transition-colors"
          >
            <TableCell class="py-2.5">
              <Input
                :model-value="row.minQty"
                type="text"
                inputmode="numeric"
                class="h-9 w-full font-mono"
                dir="ltr"
                placeholder="0"
                @input="(e: Event) => onIntegerInput(e, row as unknown as Record<string, string>, 'minQty')"
              />
            </TableCell>
            <TableCell class="py-2.5">
              <Input
                :model-value="row.maxQty"
                type="text"
                inputmode="numeric"
                class="h-9 w-full font-mono"
                dir="ltr"
                placeholder="0"
                @input="(e: Event) => onIntegerInput(e, row as unknown as Record<string, string>, 'maxQty')"
              />
            </TableCell>
            <TableCell class="py-2.5">
              <Input
                :model-value="row.pricePerUnit"
                type="text"
                inputmode="decimal"
                class="h-9 w-full font-mono"
                dir="ltr"
                :placeholder="t('price_assignment.placeholder_price')"
                @input="(e: Event) => onDecimalInput(e, row as unknown as Record<string, string>, 'pricePerUnit')"
              />
            </TableCell>
            <TableCell class="py-2.5 text-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                :aria-label="t('products_combo.delete_row')"
                @click="removeTieredRow(row._key)"
              >
                <Trash2 class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <p v-if="rowError" class="text-sm text-red-600">{{ rowError }}</p>
    <p v-if="sectionError" class="text-sm text-red-600">{{ sectionError }}</p>

    <div class="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="h-9 gap-2"
        @click="addTieredPricingRow"
      >
        <Plus class="size-4" />
        {{ t('products_combo.add_pricing_row') }}
      </Button>
      <Button
        v-if="tieredRows.length > 0"
        type="button"
        variant="ghost"
        size="sm"
        class="h-9 text-muted-foreground hover:text-red-600"
        @click="clearTieredRows"
      >
        {{ t('price_assignment.clear_all') }}
      </Button>
    </div>
  </div>
</template>
