<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Trash2, Plus, Loader2 } from 'lucide-vue-next'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const { t, locale } = useI18n()

// ── Types ──────────────────────────────────────────────────────────────────────

type PricingType = 'standard' | 'tiered' | 'combo' | ''

interface StandardRow {
  _key: number
  price: string
}

interface TieredRow {
  _key: number
  minQty: string
  maxQty: string
  pricePerUnit: string
}

interface ComboRow {
  _key: number
  productId: string
  quantity: string
  bundlePrice: string
}

interface ProductOption {
  id: number
  name_ar: string
  name_en: string
}

interface ProductsListResponse {
  data?: { products?: ProductOption[]; pagination?: { last_page?: number } }
  products?: ProductOption[]
  pagination?: { last_page?: number }
}

// ── State ──────────────────────────────────────────────────────────────────────

const { $api } = useApi()

const pricingType = ref<PricingType>('')
const pendingType = ref<PricingType>('')
const showSwitchWarning = ref(false)

const standardRows = ref<StandardRow[]>([])
const tieredRows = ref<TieredRow[]>([])
const comboRows = ref<ComboRow[]>([])

const products = ref<ProductOption[]>([])
const loadingProducts = ref(false)
const productsLoadError = ref('')

let _keyCounter = 0

const sectionError = ref('')
const rowError = ref('')

// ── Pricing type options ───────────────────────────────────────────────────────

const pricingTypeOptions: { value: PricingType; labelKey: string }[] = [
  { value: 'standard', labelKey: 'price_assignment.type_standard' },
  { value: 'tiered', labelKey: 'price_assignment.type_tiered' },
  { value: 'combo', labelKey: 'price_assignment.type_combo' },
]

// ── Active rows helper ─────────────────────────────────────────────────────────

const activeRows = computed<StandardRow[] | TieredRow[] | ComboRow[]>(() => {
  if (pricingType.value === 'standard') return standardRows.value
  if (pricingType.value === 'tiered') return tieredRows.value
  if (pricingType.value === 'combo') return comboRows.value
  return []
})

const hasData = computed(() => activeRows.value.length > 0)

// ── Pricing type switch ────────────────────────────────────────────────────────

function onPricingTypeChange(value: unknown) {
  const next = (value ?? '') as PricingType
  if (next === pricingType.value) return

  if (hasData.value) {
    pendingType.value = next
    showSwitchWarning.value = true
    return
  }

  applyTypeSwitch(next)
}

function confirmSwitch() {
  showSwitchWarning.value = false
  applyTypeSwitch(pendingType.value)
  pendingType.value = ''
}

function cancelSwitch() {
  showSwitchWarning.value = false
  pendingType.value = ''
}

function applyTypeSwitch(next: PricingType) {
  pricingType.value = next
  standardRows.value = []
  tieredRows.value = []
  comboRows.value = []
  sectionError.value = ''
  rowError.value = ''

  if (next === 'combo' && products.value.length === 0) {
    loadProducts()
  }
}

// ── Row management ─────────────────────────────────────────────────────────────

function addRow() {
  sectionError.value = ''
  rowError.value = ''
  const key = ++_keyCounter

  if (pricingType.value === 'standard') {
    standardRows.value.push({ _key: key, price: '' })
  }
  else if (pricingType.value === 'tiered') {
    tieredRows.value.push({ _key: key, minQty: '', maxQty: '', pricePerUnit: '' })
  }
  else if (pricingType.value === 'combo') {
    comboRows.value.push({ _key: key, productId: '', quantity: '', bundlePrice: '' })
  }
}

function removeRow(key: number) {
  standardRows.value = standardRows.value.filter(r => r._key !== key)
  tieredRows.value = tieredRows.value.filter(r => r._key !== key)
  comboRows.value = comboRows.value.filter(r => r._key !== key)
  sectionError.value = ''
  rowError.value = ''
}

function clearAll() {
  standardRows.value = []
  tieredRows.value = []
  comboRows.value = []
  sectionError.value = ''
  rowError.value = ''
}

// ── Input helpers ──────────────────────────────────────────────────────────────

function onNumberInput(e: Event, obj: Record<string, string>, field: string) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/[^0-9.]/g, '')
  obj[field] = digits
  el.value = digits
}

function onIntInput(e: Event, obj: Record<string, string>, field: string) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/[^0-9]/g, '')
  obj[field] = digits
  el.value = digits
}

// ── Products loader (for Combo type) ──────────────────────────────────────────

async function loadProducts() {
  loadingProducts.value = true
  productsLoadError.value = ''
  try {
    const aggregated: ProductOption[] = []
    let page = 1
    let lastPage = 1
    const maxPages = 50

    do {
      const data = await $api<ProductsListResponse>('/products', {
        params: { page, per_page: 100 },
      })
      const list = data.data?.products ?? data.products ?? []
      aggregated.push(...list)
      lastPage = data.data?.pagination?.last_page ?? data.pagination?.last_page ?? 1
      page++
    } while (page <= lastPage && page <= maxPages)

    products.value = aggregated
  }
  catch {
    productsLoadError.value = t('price_assignment.products_load_error')
  }
  finally {
    loadingProducts.value = false
  }
}

function productLabel(p: ProductOption) {
  return locale.value === 'ar' ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar)
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validate(): boolean {
  sectionError.value = ''
  rowError.value = ''

  if (!pricingType.value || activeRows.value.length === 0) {
    sectionError.value = t('price_assignment.validation_at_least_one')
    return false
  }

  if (pricingType.value === 'tiered') {
    for (const row of tieredRows.value) {
      const min = Number(row.minQty || 0)
      const max = Number(row.maxQty || 0)
      if (max <= min) {
        rowError.value = t('price_assignment.validation_max_gt_min')
        return false
      }
    }
  }

  return true
}

function getPricing() {
  if (pricingType.value === 'standard') {
    return {
      type: 'standard',
      rows: standardRows.value.map(r => ({ price: Number(r.price || 0) })),
    }
  }
  if (pricingType.value === 'tiered') {
    return {
      type: 'tiered',
      rows: tieredRows.value.map(r => ({
        min_quantity: Number(r.minQty || 0),
        max_quantity: Number(r.maxQty || 0),
        price_per_unit: Number(r.pricePerUnit || 0),
      })),
    }
  }
  if (pricingType.value === 'combo') {
    return {
      type: 'combo',
      rows: comboRows.value.map(r => ({
        product_id: Number(r.productId),
        quantity: Number(r.quantity || 0),
        bundle_price: Number(r.bundlePrice || 0),
      })),
    }
  }
  return null
}

defineExpose({ validate, getPricing })
</script>

<template>
  <div class="rounded-lg border p-5 space-y-6">
    <!-- Section header -->
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

    <!-- Pricing type selector -->
    <div class="flex flex-col gap-1.5 max-w-xs">
      <label class="text-sm font-medium">
        {{ t('price_assignment.pricing_type_label') }}
      </label>
      <Select
        :model-value="pricingType || undefined"
        @update:model-value="onPricingTypeChange"
      >
        <SelectTrigger class="h-9">
          <SelectValue :placeholder="t('price_assignment.select_type')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in pricingTypeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ t(opt.labelKey) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Pricing type switch warning dialog -->
    <AlertDialog :open="showSwitchWarning">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('price_assignment.switch_warning_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('price_assignment.switch_warning_body') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelSwitch">
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction @click="confirmSwitch">
            {{ t('common.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Table area (only when a type is selected) -->
    <template v-if="pricingType">
      <!-- Combo: loading / error -->
      <div
        v-if="pricingType === 'combo' && loadingProducts"
        class="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 class="size-4 animate-spin" />
        {{ t('common.loading') }}…
      </div>

      <div
        v-if="pricingType === 'combo' && productsLoadError"
        class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
      >
        {{ productsLoadError }}
      </div>

      <div class="rounded-md border overflow-auto">
        <Table>
          <!-- ── Standard table ── -->
          <template v-if="pricingType === 'standard'">
            <TableHeader>
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="rtl:text-right font-medium">
                  {{ t('price_assignment.col_price') }}
                </TableHead>
                <TableHead class="font-medium w-[80px] text-center">
                  {{ t('price_assignment.col_actions') }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="standardRows.length === 0">
                <TableCell :colspan="2" class="py-10 text-center text-sm text-muted-foreground">
                  {{ t('price_assignment.empty_hint') }}
                </TableCell>
              </TableRow>
              <TableRow
                v-for="row in standardRows"
                v-else
                :key="row._key"
                class="hover:bg-muted/20 transition-colors"
              >
                <TableCell class="py-2.5">
                  <Input
                    :model-value="row.price"
                    type="text"
                    inputmode="decimal"
                    class="h-9 w-full max-w-[200px] font-mono"
                    dir="ltr"
                    :placeholder="t('price_assignment.placeholder_price')"
                    @input="(e: Event) => onNumberInput(e, row as unknown as Record<string, string>, 'price')"
                  />
                </TableCell>
                <TableCell class="py-2.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    :aria-label="t('price_assignment.delete_row')"
                    @click="removeRow(row._key)"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </template>

          <!-- ── Tiered table ── -->
          <template v-else-if="pricingType === 'tiered'">
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
                  {{ t('price_assignment.col_actions') }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="tieredRows.length === 0">
                <TableCell :colspan="4" class="py-10 text-center text-sm text-muted-foreground">
                  {{ t('price_assignment.empty_hint') }}
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
                    @input="(e: Event) => onIntInput(e, row as unknown as Record<string, string>, 'minQty')"
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
                    @input="(e: Event) => onIntInput(e, row as unknown as Record<string, string>, 'maxQty')"
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
                    @input="(e: Event) => onNumberInput(e, row as unknown as Record<string, string>, 'pricePerUnit')"
                  />
                </TableCell>
                <TableCell class="py-2.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    :aria-label="t('price_assignment.delete_row')"
                    @click="removeRow(row._key)"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </template>

          <!-- ── Combo table ── -->
          <template v-else-if="pricingType === 'combo'">
            <TableHeader>
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="rtl:text-right font-medium min-w-[180px]">
                  {{ t('price_assignment.col_product') }}
                </TableHead>
                <TableHead class="rtl:text-right font-medium w-[130px]">
                  {{ t('price_assignment.col_quantity') }}
                </TableHead>
                <TableHead class="rtl:text-right font-medium w-[150px]">
                  {{ t('price_assignment.col_bundle_price') }}
                </TableHead>
                <TableHead class="font-medium w-[80px] text-center">
                  {{ t('price_assignment.col_actions') }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="comboRows.length === 0">
                <TableCell :colspan="4" class="py-10 text-center text-sm text-muted-foreground">
                  {{ t('price_assignment.empty_hint') }}
                </TableCell>
              </TableRow>
              <TableRow
                v-for="row in comboRows"
                v-else
                :key="row._key"
                class="hover:bg-muted/20 transition-colors"
              >
                <TableCell class="py-2.5">
                  <Select
                    :model-value="row.productId || undefined"
                    @update:model-value="(v: unknown) => { row.productId = v != null ? String(v) : '' }"
                  >
                    <SelectTrigger class="h-9 w-full min-w-[160px]">
                      <SelectValue :placeholder="t('price_assignment.select_product')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="p in products"
                        :key="p.id"
                        :value="String(p.id)"
                      >
                        {{ productLabel(p) }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell class="py-2.5">
                  <Input
                    :model-value="row.quantity"
                    type="text"
                    inputmode="numeric"
                    class="h-9 w-full font-mono"
                    dir="ltr"
                    placeholder="0"
                    @input="(e: Event) => onIntInput(e, row as unknown as Record<string, string>, 'quantity')"
                  />
                </TableCell>
                <TableCell class="py-2.5">
                  <Input
                    :model-value="row.bundlePrice"
                    type="text"
                    inputmode="decimal"
                    class="h-9 w-full font-mono"
                    dir="ltr"
                    :placeholder="t('price_assignment.placeholder_price')"
                    @input="(e: Event) => onNumberInput(e, row as unknown as Record<string, string>, 'bundlePrice')"
                  />
                </TableCell>
                <TableCell class="py-2.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    :aria-label="t('price_assignment.delete_row')"
                    @click="removeRow(row._key)"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </template>
        </Table>
      </div>

      <!-- Row-level error (e.g. max < min) -->
      <p v-if="rowError" class="text-sm text-red-600">{{ rowError }}</p>

      <!-- Section-level error (no records) -->
      <p v-if="sectionError" class="text-sm text-red-600">{{ sectionError }}</p>

      <!-- Table action buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-9 gap-2"
          @click="addRow"
        >
          <Plus class="size-4" />
          {{ t('price_assignment.add_row') }}
        </Button>

        <Button
          v-if="activeRows.length > 0"
          type="button"
          variant="ghost"
          size="sm"
          class="h-9 text-muted-foreground hover:text-red-600"
          @click="clearAll"
        >
          {{ t('price_assignment.clear_all') }}
        </Button>
      </div>
    </template>
  </div>
</template>
