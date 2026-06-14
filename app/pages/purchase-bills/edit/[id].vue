<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, Loader2, Plus, Search, Trash2, Barcode, FileText, Package } from 'lucide-vue-next'
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

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { canEdit } = usePermissions()
const canEditPurchaseBill = computed(() => canEdit('purchase_bills'))
const purchaseBillsStore = usePurchaseBillsStore()
const { searchProducts, lookupBarcode, getProductById, loadingProducts } = useQuotationProducts()
const { loadActiveWarehouses, loadingWarehouses } = useInvoiceWarehouses()
const { $api } = useApi()
const { getErrorMessage } = useApiError()

const loading = ref(false)
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
const formatMoney = (value: number): string => value.toFixed(2)
const warehouseDisplayName = (warehouse: InvoiceWarehouseOption): string => {
  if (locale.value === 'ar') return warehouse.name_ar || warehouse.name_en || `#${warehouse.id}`
  return warehouse.name_en || warehouse.name_ar || `#${warehouse.id}`
}
const districtLabel = (district: { district: string }): string => district.district || '—'
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
    toast.error(t('purchase_bills_page.system_error_title'), { description: t('purchase_bills_page.barcode_not_found') })
    return
  }
  await addProductToRows(matched.product, matched.variationId)
  barcodeInput.value = ''
}
const selectProductResult = async (productId: number) => {
  const picked = searchResults.value.find(row => row.id === productId)
  if (!picked) return
  await addProductToRows(picked, null)
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
  }, 300)
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
  if (!draft.value.district_id) {
    draft.value.other_fees = 0
    return
  }
  const selected = districtOptions.value.find(item => item.id === draft.value.district_id)
  if (!selected) return
  draft.value.other_fees = Math.max(0, Number(selected.other_fees) || 0)
}
type SaveMode = 'close' | 'add'
const savePurchaseBill = async (mode: SaveMode) => {
  if (!canEditPurchaseBill.value) return
  if (!validate()) {
    toast.error(t('purchase_bills_page.system_error_title'), { description: firstPurchaseBillValidationToastDescription(formErrors.value) })
    return
  }
  purchaseBillsStore.submitting = true
  errorMessage.value = ''
  try {
    await purchaseBillsStore.updatePurchaseBill(id.value)
    if (mode === 'close') {
      toast.success(t('purchase_bills_page.system_success_title'), { description: t('purchase_bills_page.system_save_success_body') })
      await navigateTo('/purchase-bills')
      return
    }
    if (mode === 'add') {
      toast.success(t('purchase_bills_page.system_success_title'), {
        description: `${t('purchase_bills_page.system_save_success_body')} ${t('purchase_bills_page.system_save_and_add_hint')}`,
      })
      purchaseBillsStore.resetDraft()
      await navigateTo('/purchase-bills/create')
      return
    }
    toast.success(t('purchase_bills_page.system_success_title'), { description: t('purchase_bills_page.system_save_success_body') })
  }
  catch (error: unknown) {
    const msg = getErrorMessage(error) || t('purchase_bills_page.save_error')
    errorMessage.value = msg
    toast.error(t('purchase_bills_page.system_error_title'), { description: msg })
  }
  finally {
    purchaseBillsStore.submitting = false
  }
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  if (!canEditPurchaseBill.value) {
    loading.value = false
    return
  }
  try {
    warehouseOptions.value = await loadActiveWarehouses().catch(() => [])
    await loadDistrictOptions().catch(() => {})
    const bill = await purchaseBillsStore.loadDraftById(id.value)
    if (!bill) errorMessage.value = t('purchase_bills_page.not_found')
  }
  catch {
    errorMessage.value = t('purchase_bills_page.load_error')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto flex w-full flex-col gap-6 pb-10">
    <div class="flex min-w-0 items-start gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child><NuxtLink to="/purchase-bills"><ArrowRight class="size-4" /></NuxtLink></Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('purchase_bills_page.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('purchase_bills_page.edit_subtitle', { id }) }}</p>
      </div>
    </div>
    <div v-if="!canEditPurchaseBill" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">{{ t('purchase_bills_page.no_permission') }}</div>
    <div v-else-if="loading" class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"><Loader2 class="mx-auto mb-2 size-6 animate-spin" />{{ t('common.loading') }}</div>

    <template v-else>
      <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{{ errorMessage }}</div>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6"><FileText class="size-4 text-white/70" /><h2 class="text-base font-semibold">{{ t('purchase_bills_page.details_section') }}</h2></div>
        <CardContent class="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid gap-5 md:grid-cols-2">
            <div class="space-y-2"><label class="text-sm font-medium">{{ t('purchase_bills_page.reference_number') }}</label><Input :model-value="draft.reference_number || `#${id}`" disabled /></div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.warehouse') }}</label>
              <Select :model-value="draft.warehouse_id ? String(draft.warehouse_id) : ''" @update:model-value="value => draft.warehouse_id = Number(value) || null">
                <SelectTrigger class="w-full"><SelectValue :placeholder="t('purchase_bills_page.select_warehouse')" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="warehouse in warehouseOptions" :key="warehouse.id" :value="String(warehouse.id)">
                    {{ warehouseDisplayName(warehouse) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="loadingWarehouses" class="text-xs text-muted-foreground">{{ t('common.loading') }}</p>
              <p v-if="formErrors.warehouse_id" class="text-xs text-red-600">{{ formErrors.warehouse_id }}</p>
            </div>
            <div class="space-y-2"><label class="text-sm font-medium">{{ t('purchase_bills_page.supplier_name') }}</label><Input v-model="draft.supplier_name" /></div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.district') }}</label>
              <Select :model-value="draft.district_id ? String(draft.district_id) : ''" @update:model-value="onDistrictChange">
                <SelectTrigger class="w-full"><SelectValue :placeholder="t('purchase_bills_page.select_district')" /></SelectTrigger>
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
            <div class="space-y-2"><label class="text-sm font-medium">{{ t('purchase_bills_page.bill_date') }}</label><Input v-model="draft.bill_date" type="date" /></div>
            <div class="space-y-2"><label class="text-sm font-medium">{{ t('purchase_bills_page.supply_date') }}</label><Input v-model="draft.supply_date" type="date" /></div>
          </div>
          <div class="space-y-2"><label class="text-sm font-medium">{{ t('purchase_bills_page.bill_description') }}</label><RichTextEditor v-model="draft.description" /></div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6"><Package class="size-4 text-white/70" /><h2 class="text-base font-semibold">{{ t('purchase_bills_page.items_section') }}</h2></div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('purchase_bills_page.products') }}</label>
              <div class="relative"><Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input v-model="productSearch" class="ps-9" :placeholder="t('purchase_bills_page.product_search_placeholder')" /></div>
              <div v-if="searchResults.length" class="max-h-48 overflow-y-auto rounded-md border bg-background">
                <button v-for="product in searchResults" :key="product.id" type="button" class="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted/40" @click="selectProductResult(product.id)"><span>{{ productDisplayName(product) }}</span><span class="text-xs text-muted-foreground">#{{ product.id }}</span></button>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('products_variations.variation_barcode') }}</label>
              <div class="relative"><Barcode class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input v-model="barcodeInput" class="ps-9" :placeholder="t('purchase_bills_page.barcode_placeholder')" @keydown.enter.prevent="handleBarcodeSubmit" /></div>
              <Button type="button" variant="outline" class="w-full gap-2 md:w-auto" :disabled="loadingProducts" @click="showAllProducts"><Loader2 v-if="loadingProducts" class="size-4 animate-spin" /><span>{{ t('purchase_bills_page.products') }}</span></Button>
            </div>
          </div>

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
                           md:table-row md:border-0 md:rounded-none md:p-0 md:mb-0 md:shadow-none md:align-top"
                  >
                    <TableCell class="block py-1.5 md:table-cell md:min-w-[220px]">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.col_product') }}
                      </span>
                      <div class="space-y-2">
                        <p class="text-sm font-medium">{{ productDisplayName(item.product) }}</p>
                        <Select v-if="item.product?.variations.length" :model-value="item.variation_id ? String(item.variation_id) : ''" @update:model-value="value => purchaseBillsStore.setRowVariation(idx, Number(value))">
                          <SelectTrigger><SelectValue :placeholder="t('purchase_bills_page.select_variation')" /></SelectTrigger>
                          <SelectContent><SelectItem v-for="variation in item.product.variations" :key="variation.id" :value="String(variation.id)">{{ variation.label }}</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:min-w-[200px] md:ltr:text-start md:rtl:text-end md:text-start">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.row_description') }}
                      </span>
                      <Input v-model="item.description" />
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:min-w-[90px] md:text-start md:rtl:text-end">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.qty') }}
                      </span>
                      <Input :model-value="item.qty" type="number" min="1" class="text-start rtl:text-end tabular-nums" @update:model-value="value => purchaseBillsStore.setRowQty(idx, Number(value))" />
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:min-w-[120px] md:text-start md:rtl:text-end">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.unit_price') }}
                      </span>
                      <Input :model-value="item.unit_price" type="number" min="0" class="text-start rtl:text-end tabular-nums" @update:model-value="value => purchaseBillsStore.setRowUnitPrice(idx, Number(value))" />
                    </TableCell>
                    <TableCell class="block py-1.5 md:table-cell md:min-w-[220px] md:text-start md:rtl:text-end">
                      <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                        {{ t('purchase_bills_page.discount_percent') }}
                      </span>
                      <Select :model-value="item.discount_mode" @update:model-value="value => purchaseBillsStore.setRowDiscountMode(idx, (value as 'fixed' | 'percentage'))">
                        <SelectTrigger class="h-9 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="fixed">{{ t('purchase_bills_page.discount_mode_fixed') }}</SelectItem><SelectItem value="percentage">{{ t('purchase_bills_page.discount_mode_percentage') }}</SelectItem></SelectContent>
                      </Select>
                      <Input :model-value="item.discount_value" type="number" step="0.01" class="mt-2 text-start rtl:text-end tabular-nums" @update:model-value="value => purchaseBillsStore.setRowDiscountValue(idx, Number(value))" />
                    </TableCell>
                    <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:text-start md:rtl:text-end md:font-medium md:tabular-nums">
                      <span class="text-xs font-medium text-muted-foreground md:hidden">
                        {{ t('purchase_bills_page.row_total') }}
                      </span>
                      <span class="font-medium">{{ formatMoney(rowTotals(idx).rowTotal) }}</span>
                    </TableCell>
                    <TableCell class="flex justify-end pt-2 border-t mt-1 md:table-cell md:border-0 md:pt-0 md:mt-0 md:text-end">
                      <Button type="button" variant="ghost" size="icon" class="size-8 text-red-600" @click="purchaseBillsStore.removeRow(idx)"><Trash2 class="size-4" /></Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div class="flex flex-wrap gap-2"><Button type="button" variant="outline" class="gap-1.5" @click="purchaseBillsStore.addRow"><Plus class="size-4" />{{ t('purchase_bills_page.add_row') }}</Button><Button type="button" variant="outline" class="text-red-600" @click="clearDialogOpen = true">{{ t('purchase_bills_page.clear_all') }}</Button></div>
          <div class="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.subtotal') }}</p><p class="mt-1 font-semibold tabular-nums">{{ formatMoney(summary.subtotal) }}</p></div>
            <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.total_discount') }}</p><p class="mt-1 font-semibold tabular-nums">{{ formatMoney(summary.totalDiscount) }}</p></div>
            <div class="space-y-1"><label class="text-xs text-muted-foreground">{{ t('purchase_bills_page.other_fees') }}</label><Input :model-value="draft.other_fees" type="number" min="0" class="tabular-nums" @update:model-value="value => draft.other_fees = Math.max(0, Number(value) || 0)" /></div>
            <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.grand_total') }}</p><p class="mt-1 text-lg font-bold tabular-nums">{{ formatMoney(summary.grandTotal) }}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm"><div class="border-b bg-section-terms border-section-terms text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('purchase_bills_page.terms_section') }}</h2></div><CardContent class="px-4 py-5 sm:px-6 sm:py-6"><textarea v-model="draft.terms" rows="4" class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" :placeholder="t('purchase_bills_page.terms_placeholder')" /></CardContent></Card>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm"><div class="border-b bg-section-notes border-section-notes text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('purchase_bills_page.notes_section') }}</h2></div><CardContent class="px-4 py-5 sm:px-6 sm:py-6"><textarea v-model="draft.notes" rows="4" class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" :placeholder="t('purchase_bills_page.notes_placeholder')" /></CardContent></Card>

      <div class="flex flex-col-reverse gap-3 rounded-xl border bg-card/80 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end sm:px-5">
        <Button variant="outline" class="w-full sm:w-auto" :disabled="purchaseBillsStore.submitting" as-child><NuxtLink to="/purchase-bills">{{ t('common.cancel') }}</NuxtLink></Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child><Button class="w-full gap-2 sm:w-auto sm:min-w-[190px]" :disabled="purchaseBillsStore.submitting"><Loader2 v-if="purchaseBillsStore.submitting" class="size-4 animate-spin" />{{ t('purchase_bills_page.save_options') }}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="savePurchaseBill('close')">{{ t('purchase_bills_page.save_and_close') }}</DropdownMenuItem>
            <DropdownMenuItem @click="savePurchaseBill('add')">{{ t('purchase_bills_page.save_and_add') }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </template>

    <AlertDialog :open="clearDialogOpen" @update:open="clearDialogOpen = $event">
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ t('purchase_bills_page.clear_all_title') }}</AlertDialogTitle><AlertDialogDescription>{{ t('purchase_bills_page.clear_all_body') }}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel><AlertDialogAction class="bg-red-600 text-white hover:bg-red-700" @click="purchaseBillsStore.clearAllRows()">{{ t('purchase_bills_page.clear_all_confirm') }}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>
</template>
