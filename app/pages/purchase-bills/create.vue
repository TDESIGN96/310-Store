<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowRight,
  Loader2,
  Plus,
  Search,
  Trash2,
  Barcode,
  FileText,
  Package,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import RichTextEditor from '@/components/quotations/RichTextEditor.vue'
import { usePurchaseBillsStore } from '@/stores/purchaseBills'
import type { QuotationProductOption } from '@/composables/useQuotationProducts'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { firstPurchaseBillValidationToastDescription, validatePurchaseBillDraft } from '@/composables/usePurchaseBillDraftValidation'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { canCreate } = usePermissions()
const canCreatePurchaseBill = computed(() => canCreate('purchase_bills'))
const purchaseBillsStore = usePurchaseBillsStore()
const { searchProducts, lookupBarcode, getProductById, loadingProducts } = useQuotationProducts()
const { loadActiveWarehouses, loadingWarehouses } = useInvoiceWarehouses()
const { $api } = useApi()
const { getErrorMessage } = useApiError()

const formErrors = ref<Record<string, string>>({})
const errorMessage = ref('')
const productSearch = ref('')
const barcodeInput = ref('')
const searchResults = ref<QuotationProductOption[]>([])
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const districtOptions = ref<Array<{ id: number, district: string, delivery_fee: string, other_fees: string | null }>>([])
const loadingDistricts = ref(false)
const clearDialogOpen = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const draft = computed(() => purchaseBillsStore.draft)
const summary = computed(() => purchaseBillsStore.summary)
const rowTotals = (index: number) => purchaseBillsStore.rowMath(draft.value.items[index]!)

const productDisplayName = (product: QuotationProductOption | null): string => {
  if (!product) return '—'
  if (locale.value === 'ar') return product.name_ar || product.name_en || `#${product.id}`
  return product.name_en || product.name_ar || `#${product.id}`
}

const formatMoney = (value: number): string => formatDisplayNumber(value, { locale: locale.value })
const warehouseDisplayName = (warehouse: InvoiceWarehouseOption): string => {
  if (locale.value === 'ar') return warehouse.name_ar || warehouse.name_en || `#${warehouse.id}`
  return warehouse.name_en || warehouse.name_ar || `#${warehouse.id}`
}
const districtLabel = (item: { district: string }) => item.district || '—'

const selectedRowsCount = computed(() => draft.value.items.filter(item => item.product_id).length)

const firstEmptyRowIndex = computed(() => {
  const found = draft.value.items.findIndex(item => !item.product_id)
  return found >= 0 ? found : draft.value.items.length
})

const addProductToRows = async (product: QuotationProductOption, variationId: number | null) => {
  const targetIndex = firstEmptyRowIndex.value
  if (targetIndex === draft.value.items.length) purchaseBillsStore.addRow()
  await purchaseBillsStore.setRowProduct(targetIndex, product, variationId)
}

const handleBarcodeSubmit = async () => {
  const code = barcodeInput.value.trim()
  if (!code) return
  const matched = await lookupBarcode(code)
  if (!matched) {
    toast.error(t('purchase_bills_page.system_error_title'), {
      description: t('purchase_bills_page.barcode_not_found'),
    })
    return
  }
  await addProductToRows(matched.product, matched.variationId)
  barcodeInput.value = ''
}

const selectProductResult = async (productId: number) => {
  const picked = searchResults.value.find(row => row.id === productId)
  if (!picked) return
  const code = productSearch.value.trim()
  const full = await getProductById(productId)
  const product = full ?? picked
  let variationId: number | null = null
  if (code) {
    const matchedVariation = product.variations.find(variation => variation.barcode === code)
    if (matchedVariation) variationId = matchedVariation.id
  }
  if (!variationId && product.variations.length === 1) {
    variationId = product.variations[0]?.id ?? null
  }
  await addProductToRows(product, variationId)
  searchResults.value = []
  productSearch.value = ''
}

const showAllProducts = async () => {
  searchResults.value = await searchProducts('')
}

watch(productSearch, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  const text = value.trim()
  if (!text) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchResults.value = await searchProducts(text)
  }, 350)
})

const validate = (): boolean => {
  const errors = validatePurchaseBillDraft(draft.value, selectedRowsCount.value, t)
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const loadDistrictOptions = async () => {
  loadingDistricts.value = true
  try {
    const res = await $api<{
      data?: { districts?: Array<{ id: number, district: string, delivery_fee: string, other_fees: string | null }> }
      districts?: Array<{ id: number, district: string, delivery_fee: string, other_fees: string | null }>
    }>('/districts', {
      params: { page: 1, per_page: 100 },
    })
    districtOptions.value = res.data?.districts ?? res.districts ?? []
  }
  catch {
    districtOptions.value = []
  }
  finally {
    loadingDistricts.value = false
  }
}

const onDistrictChange = (value: unknown) => {
  const selectedId = Number(value ?? 0)
  draft.value.district_id = Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null
}

type SaveMode = 'close' | 'add'

const savePurchaseBill = async (mode: SaveMode) => {
  if (!canCreatePurchaseBill.value) return
  if (!validate()) {
    toast.error(t('purchase_bills_page.system_error_title'), {
      description: firstPurchaseBillValidationToastDescription(formErrors.value),
    })
    return
  }

  purchaseBillsStore.submitting = true
  errorMessage.value = ''
  try {
    const res = await purchaseBillsStore.createPurchaseBill()
    const root = res as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const bill = (nested?.purchase_bill ?? root.purchase_bill ?? nested?.bill ?? root.bill ?? null) as Record<string, unknown> | null
    const referenceNumber = typeof bill?.reference_number === 'string' ? bill.reference_number : ''
    if (referenceNumber) purchaseBillsStore.draft.reference_number = referenceNumber

    if (mode === 'close') {
      toast.success(t('purchase_bills_page.system_success_title'), { description: t('purchase_bills_page.system_save_success_body') })
      await navigateTo('/purchase-bills')
      return
    }

    toast.success(t('purchase_bills_page.system_success_title'), {
      description: `${t('purchase_bills_page.system_save_success_body')} ${t('purchase_bills_page.system_save_and_add_hint')}`,
    })
    purchaseBillsStore.resetDraft()
    formErrors.value = {}
    errorMessage.value = ''
  }
  catch (error: unknown) {
    const msg = getErrorMessage(error)
    errorMessage.value = msg
    toast.error(t('purchase_bills_page.system_error_title'), { description: msg })
  }
  finally {
    purchaseBillsStore.submitting = false
  }
}

onMounted(() => {
  purchaseBillsStore.resetDraft()
  loadActiveWarehouses().then((rows) => {
    warehouseOptions.value = rows
  })
  loadDistrictOptions()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink to="/purchase-bills">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('purchase_bills_page.create_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('purchase_bills_page.create_subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="!canCreatePurchaseBill"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('purchase_bills_page.no_permission') }}
    </div>

    <template v-else>
      <div
        v-if="errorMessage"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {{ errorMessage }}
      </div>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
          <FileText class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">{{ t('purchase_bills_page.details_section') }}</h2>
        </div>
        <CardContent class="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid gap-5 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.reference_number') }}</label>
              <Input :model-value="draft.reference_number || t('purchase_bills_page.reference_generated_after_save')" disabled />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.warehouse') }}</label>
              <Select
                :model-value="draft.warehouse_id ? String(draft.warehouse_id) : ''"
                @update:model-value="value => draft.warehouse_id = Number(value) || null"
              >
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="t('purchase_bills_page.select_warehouse')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="warehouse in warehouseOptions"
                    :key="warehouse.id"
                    :value="String(warehouse.id)"
                  >
                    {{ warehouseDisplayName(warehouse) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="loadingWarehouses" class="text-xs text-muted-foreground">{{ t('common.loading') }}</p>
              <p v-if="formErrors.warehouse_id" class="text-xs text-red-600">{{ formErrors.warehouse_id }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.supplier_name') }}</label>
              <Input v-model="draft.supplier_name" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.district') }}</label>
              <Select
                :model-value="draft.district_id ? String(draft.district_id) : ''"
                @update:model-value="onDistrictChange"
              >
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="t('purchase_bills_page.select_district')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="district in districtOptions" :key="district.id" :value="String(district.id)">
                    {{ districtLabel(district) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="loadingDistricts" class="text-xs text-muted-foreground">{{ t('common.loading') }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.supplier_mobile') }}</label>
              <Input v-model="draft.supplier_mobile" type="tel" />
              <p v-if="formErrors.supplier_mobile" class="text-xs text-red-600">{{ formErrors.supplier_mobile }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.supplier_email') }}</label>
              <Input v-model="draft.supplier_email" type="email" />
              <p v-if="formErrors.supplier_email" class="text-xs text-red-600">{{ formErrors.supplier_email }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.address') }}</label>
              <Input v-model="draft.address" />
              <p v-if="formErrors.address" class="text-xs text-red-600">{{ formErrors.address }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.bill_date') }}</label>
              <Input v-model="draft.bill_date" type="date" />
              <p v-if="formErrors.bill_date" class="text-xs text-red-600">{{ formErrors.bill_date }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.supply_date') }}</label>
              <Input v-model="draft.supply_date" type="date" />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('purchase_bills_page.bill_description') }}</label>
            <RichTextEditor v-model="draft.description" />
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">{{ t('purchase_bills_page.items_section') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.products') }}</label>
              <div class="relative">
                <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input v-model="productSearch" class="ps-9" :placeholder="t('purchase_bills_page.product_search_placeholder')" />
              </div>
              <div v-if="loadingProducts" class="text-xs text-muted-foreground">{{ t('common.loading') }}</div>
              <div v-if="searchResults.length" class="max-h-48 overflow-y-auto rounded-md border bg-background">
                <button
                  v-for="product in searchResults"
                  :key="product.id"
                  type="button"
                  class="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted/40"
                  @click="selectProductResult(product.id)"
                >
                  <span>{{ productDisplayName(product) }}</span>
                  <span class="text-xs text-muted-foreground">#{{ product.id }}</span>
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('products_variations.variation_barcode') }}</label>
              <div class="relative">
                <Barcode class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  v-model="barcodeInput"
                  class="ps-9"
                  :placeholder="t('purchase_bills_page.barcode_placeholder')"
                  @keydown.enter.prevent="handleBarcodeSubmit"
                />
              </div>
              <Button type="button" variant="outline" class="w-full gap-2 md:w-auto" :disabled="loadingProducts" @click="showAllProducts">
                <Loader2 v-if="loadingProducts" class="size-4 animate-spin" />
                <span>{{ t('purchase_bills_page.products') }}</span>
              </Button>
            </div>
          </div>

          <p v-if="formErrors.items" class="text-xs text-red-600">{{ formErrors.items }}</p>

          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader class="hidden md:table-header-group">
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="min-w-[200px] text-start">{{ t('purchase_bills_page.col_product') }}</TableHead>
                    <TableHead class="min-w-[180px] text-start">{{ t('purchase_bills_page.row_description') }}</TableHead>
                    <TableHead class="w-24 text-start">{{ t('purchase_bills_page.qty') }}</TableHead>
                    <TableHead class="w-32 text-start">{{ t('purchase_bills_page.unit_price') }}</TableHead>
                    <TableHead class="w-44 text-start">{{ t('purchase_bills_page.discount_percent') }}</TableHead>
                    <TableHead class="w-32 text-start">{{ t('purchase_bills_page.row_total') }}</TableHead>
                    <TableHead class="w-12 text-start">{{ t('purchase_bills_page.col_actions') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(item, idx) in draft.items"
                    :key="item.key"
                    class="flex flex-col gap-2 border-2 rounded-lg p-4 mb-4 shadow-sm
                           md:table-row md:border-0 md:rounded-none md:p-0 md:mb-0 md:shadow-none"
                  >
                    <TableCell class="block py-1.5 md:table-cell md:align-top md:whitespace-normal md:min-w-[200px] md:py-3">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.col_product') }}
                      </span>
                      <div class="flex min-w-0 flex-col gap-2">
                        <p class="text-sm font-medium leading-snug break-words">{{ productDisplayName(item.product) }}</p>
                        <Select
                          v-if="item.product?.variations.length"
                          :model-value="item.variation_id ? String(item.variation_id) : ''"
                          @update:model-value="value => purchaseBillsStore.setRowVariation(idx, Number(value))"
                        >
                          <SelectTrigger class="w-full max-w-full"><SelectValue :placeholder="t('purchase_bills_page.select_variation')" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="variation in item.product.variations" :key="variation.id" :value="String(variation.id)">
                              {{ variation.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[180px] md:py-3">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.row_description') }}
                      </span>
                      <Input v-model="item.description" class="w-full" />
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:align-top md:py-3">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.qty') }}
                      </span>
                      <Input :model-value="item.qty" type="number" min="1" class="h-9 w-full text-start tabular-nums" @update:model-value="value => purchaseBillsStore.setRowQty(idx, Number(value))" />
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:align-top md:py-3">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.unit_price') }}
                      </span>
                      <Input :model-value="item.unit_price" type="number" min="0" class="h-9 w-full text-start tabular-nums" @update:model-value="value => purchaseBillsStore.setRowUnitPrice(idx, Number(value))" />
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:align-top md:py-3">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.discount_percent') }}
                      </span>
                      <div class="w-full space-y-2 md:ms-auto md:max-w-44">
                        <Select :model-value="item.discount_mode" @update:model-value="value => purchaseBillsStore.setRowDiscountMode(idx, (value as 'fixed' | 'percentage'))">
                          <SelectTrigger class="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">{{ t('purchase_bills_page.discount_mode_fixed') }}</SelectItem>
                            <SelectItem value="percentage">{{ t('purchase_bills_page.discount_mode_percentage') }}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input :model-value="item.discount_value" type="number" step="0.01" class="h-9 w-full text-start tabular-nums" @update:model-value="value => purchaseBillsStore.setRowDiscountValue(idx, Number(value))" />
                      </div>
                    </TableCell>
                    <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:align-top md:py-3 md:text-start md:tabular-nums">
                      <span class="text-xs font-medium text-muted-foreground md:hidden">
                        {{ t('purchase_bills_page.row_total') }}
                      </span>
                      <div class="font-medium md:ms-auto md:flex md:h-9 md:max-w-32 md:items-center md:justify-start">{{ formatMoney(rowTotals(idx).rowTotal) }}</div>
                    </TableCell>
                    <TableCell class="flex justify-end pt-2 border-t mt-1 md:table-cell md:border-0 md:align-top md:pt-3 md:mt-0 md:text-start md:rtl:text-end">
                      <div class="flex h-9 items-center justify-end">
                        <Button type="button" variant="ghost" size="icon" class="size-8 shrink-0 text-red-600" @click="purchaseBillsStore.removeRow(idx)">
                          <Trash2 class="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button type="button" variant="outline" class="gap-1.5" @click="purchaseBillsStore.addRow">
              <Plus class="size-4" />
              {{ t('purchase_bills_page.add_row') }}
            </Button>
            <Button type="button" variant="outline" class="text-red-600" @click="clearDialogOpen = true">
              {{ t('purchase_bills_page.clear_all') }}
            </Button>
          </div>

          <div class="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.subtotal') }}</p>
                <p class="mt-1 font-semibold tabular-nums">{{ formatMoney(summary.subtotal) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.total_discount') }}</p>
                <p class="mt-1 font-semibold tabular-nums">{{ formatMoney(summary.totalDiscount) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.grand_total') }}</p>
                <p class="mt-1 text-lg font-bold tabular-nums">{{ formatMoney(summary.grandTotal) }}</p>
              </div>
            </div>

            <div class="space-y-3 border-t border-border/60 pt-4">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium">{{ t('purchase_bills_page.additional_costs') }}</p>
                <Button type="button" variant="outline" size="sm" class="gap-1.5" @click="purchaseBillsStore.addAdditionalCost()">
                  <Plus class="size-4" />
                  {{ t('purchase_bills_page.add_additional_cost') }}
                </Button>
              </div>

              <div
                v-if="draft.additional_costs.length === 0"
                class="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground"
              >
                {{ t('purchase_bills_page.add_additional_cost') }}
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(cost, idx) in draft.additional_costs"
                  :key="idx"
                  class="grid gap-2 sm:grid-cols-[1fr_140px_auto]"
                >
                  <div class="space-y-1">
                    <label v-if="idx === 0" class="text-xs text-muted-foreground">{{ t('purchase_bills_page.additional_cost_label') }}</label>
                    <Input
                      :model-value="cost.key"
                      maxlength="100"
                      :placeholder="t('purchase_bills_page.additional_cost_label_placeholder')"
                      :class="formErrors[`additional_cost_${idx}_key`] ? 'border-red-500 focus-visible:ring-red-500' : ''"
                      @update:model-value="value => purchaseBillsStore.setAdditionalCostKey(idx, String(value ?? ''))"
                    />
                    <p v-if="formErrors[`additional_cost_${idx}_key`]" class="text-xs text-red-500">{{ formErrors[`additional_cost_${idx}_key`] }}</p>
                  </div>
                  <div class="space-y-1">
                    <label v-if="idx === 0" class="text-xs text-muted-foreground">{{ t('purchase_bills_page.additional_cost_amount') }}</label>
                    <Input
                      :model-value="cost.amount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="tabular-nums"
                      :placeholder="t('purchase_bills_page.additional_cost_amount_placeholder')"
                      :class="formErrors[`additional_cost_${idx}_amount`] ? 'border-red-500 focus-visible:ring-red-500' : ''"
                      @update:model-value="value => purchaseBillsStore.setAdditionalCostAmount(idx, Math.max(0, Number(value) || 0))"
                    />
                    <p v-if="formErrors[`additional_cost_${idx}_amount`]" class="text-xs text-red-500">{{ formErrors[`additional_cost_${idx}_amount`] }}</p>
                  </div>
                  <div class="flex items-end">
                    <Button type="button" variant="ghost" size="icon" class="size-9 text-red-600" @click="purchaseBillsStore.removeAdditionalCost(idx)">
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div v-if="purchaseBillsStore.additionalCostsTotal > 0" class="flex justify-end">
                <p class="text-sm text-muted-foreground">
                  {{ t('purchase_bills_page.additional_costs_total') }}:
                  <span class="ms-1 font-semibold tabular-nums text-foreground">{{ formatMoney(purchaseBillsStore.additionalCostsTotal) }}</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-section-terms border-section-terms text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('purchase_bills_page.terms_section') }}</h2></div>
        <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
          <details class="rounded-lg border px-4 py-3">
            <summary class="cursor-pointer text-sm font-medium">{{ t('purchase_bills_page.terms_section') }}</summary>
            <textarea v-model="draft.terms" rows="4" class="mt-3 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" :placeholder="t('purchase_bills_page.terms_placeholder')" />
          </details>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-section-notes border-section-notes text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('purchase_bills_page.notes_section') }}</h2></div>
        <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
          <details class="rounded-lg border px-4 py-3">
            <summary class="cursor-pointer text-sm font-medium">{{ t('purchase_bills_page.notes_section') }}</summary>
            <textarea v-model="draft.notes" rows="4" class="mt-3 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" :placeholder="t('purchase_bills_page.notes_placeholder')" />
          </details>
        </CardContent>
      </Card>

      <div class="flex flex-col-reverse gap-3 rounded-xl border bg-card/80 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end sm:px-5">
        <Button variant="outline" class="w-full sm:w-auto" :disabled="purchaseBillsStore.submitting" as-child>
          <NuxtLink to="/purchase-bills">{{ t('common.cancel') }}</NuxtLink>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button class="w-full gap-2 sm:w-auto sm:min-w-[170px]" :disabled="purchaseBillsStore.submitting">
              <Loader2 v-if="purchaseBillsStore.submitting" class="size-4 animate-spin" />
              {{ t('purchase_bills_page.save_options') }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="savePurchaseBill('close')">{{ t('purchase_bills_page.save_and_close') }}</DropdownMenuItem>
            <DropdownMenuItem @click="savePurchaseBill('add')">{{ t('purchase_bills_page.save_and_add') }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </template>

    <AlertDialog :open="clearDialogOpen" @update:open="clearDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('purchase_bills_page.clear_all_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('purchase_bills_page.clear_all_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction class="bg-red-600 text-white hover:bg-red-700" @click="purchaseBillsStore.clearAllRows()">
            {{ t('purchase_bills_page.clear_all_confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
