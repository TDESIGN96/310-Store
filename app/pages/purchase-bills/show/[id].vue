<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, FileText, Loader2, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePurchaseBillsStore } from '@/stores/purchaseBills'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber, formatDisplayGrandTotal } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { canAccess } = usePermissions()
const canViewPurchaseBills = computed(() => canAccess('purchase_bills'))
const purchaseBillsStore = usePurchaseBillsStore()
const loading = ref(false)
const errorMessage = ref('')

const purchaseBill = computed(() => purchaseBillsStore.currentPurchaseBill)
const districtName = computed(() => {
  const current = purchaseBill.value
  if (!current) return ''
  const district = (current.district && typeof current.district === 'object' ? current.district : null) as Record<string, unknown> | null
  return String(district?.district ?? current.district_name ?? '').trim()
})
const additionalCosts = computed(() => {
  const current = purchaseBill.value
  if (!current) return [] as Array<{ key: string, amount: number }>

  const fromApi = Array.isArray(current.additional_costs) ? current.additional_costs : []
  const parsed = fromApi
    .map((costRaw) => {
      if (!costRaw || typeof costRaw !== 'object') return null
      const cost = costRaw as Record<string, unknown>
      const key = String(cost.key ?? cost.name ?? '').trim()
      const amount = asNumber(cost.amount)
      if (!key && amount <= 0) return null
      return { key, amount }
    })
    .filter((cost): cost is { key: string, amount: number } => cost !== null)

  if (parsed.length) return parsed

  const legacyFee = asNumber(current.other_fees)
  if (legacyFee > 0) return [{ key: t('purchase_bills_page.other_fees'), amount: legacyFee }]

  const district = (current.district && typeof current.district === 'object' ? current.district : null) as Record<string, unknown> | null
  const districtFee = asNumber(district?.other_fees)
  if (districtFee > 0) return [{ key: t('purchase_bills_page.other_fees'), amount: districtFee }]

  return []
})
const additionalCostsTotal = computed(() =>
  additionalCosts.value.reduce((sum, cost) => sum + cost.amount, 0),
)
const showAdditionalCosts = computed(() => additionalCosts.value.length > 0)
const items = computed(() => {
  const raw = purchaseBill.value?.items
  return Array.isArray(raw) ? raw as Array<Record<string, unknown>> : []
})

const asNumber = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const money = (value: unknown) => formatDisplayNumber(asNumber(value), { locale: locale.value })
const grandTotal = (value: unknown) => formatDisplayGrandTotal(asNumber(value), { locale: locale.value })
const fmtDate = (value: unknown) => {
  return formatDisplayDate(value)
}
const warehouseName = computed(() => {
  const warehouse = (purchaseBill.value?.warehouse && typeof purchaseBill.value.warehouse === 'object' ? purchaseBill.value.warehouse : null) as Record<string, unknown> | null
  if (!warehouse) return '—'
  const nameAr = String(warehouse.name_ar ?? '')
  const nameEn = String(warehouse.name_en ?? '')
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
})
const productLabel = (row: Record<string, unknown>) => {
  const product = (row.product && typeof row.product === 'object' ? row.product : null) as Record<string, unknown> | null
  if (!product) return '—'
  const nameAr = String(product.name_ar ?? '')
  const nameEn = String(product.name_en ?? '')
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
}
const productImageUrl = (row: Record<string, unknown>) => {
  const product = (row.product && typeof row.product === 'object' ? row.product : null) as Record<string, unknown> | null
  if (!product) return ''
  return String(product.main_image_url ?? product.main_image ?? product.image_url ?? product.image ?? '').trim()
}
const variationLabel = (row: Record<string, unknown>) => {
  const variation = (row.variation && typeof row.variation === 'object' ? row.variation : null) as Record<string, unknown> | null
  if (!variation) return '—'
  return String(variation.label ?? '—')
}
const productDescription = (row: Record<string, unknown>) => {
  const direct = String(row.description ?? '').trim()
  if (direct && direct !== 'null' && direct !== 'undefined') return direct
  return ''
}
const itemDiscountPercentage = (row: Record<string, unknown>) => {
  const direct = asNumber(row.discount_percentage)
  if (direct > 0) return direct
  const unitPrice = asNumber(row.unit_price)
  const perUnitDiscount = asNumber(row.discount)
  if (unitPrice <= 0) return 0
  return (perUnitDiscount / unitPrice) * 100
}
const itemLineDiscount = (row: Record<string, unknown>) => {
  const direct = asNumber(row.line_discount)
  if (direct > 0) return direct
  return asNumber(row.discount) * asNumber(row.qty)
}

onMounted(async () => {
  if (!canViewPurchaseBills.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await purchaseBillsStore.loadById(id.value)
    if (!response) errorMessage.value = t('purchase_bills_page.not_found')
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
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child><NuxtLink to="/purchase-bills"><ArrowRight class="size-4" /></NuxtLink></Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('purchase_bills_page.view_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('purchase_bills_page.view_subtitle', { id }) }}</p>
      </div>
    </div>
    <div v-if="!canViewPurchaseBills" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">{{ t('purchase_bills_page.no_permission') }}</div>
    <div v-else-if="loading" class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"><Loader2 class="mx-auto mb-2 size-6 animate-spin" />{{ t('common.loading') }}</div>
    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{{ errorMessage }}</div>

    <template v-else-if="purchaseBill">
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6"><FileText class="size-4 text-white/70" /><h2 class="text-base font-semibold">{{ t('purchase_bills_page.details_section') }}</h2></div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.reference_number') }}</p><p class="text-sm font-medium">{{ purchaseBill.reference_number || `#${purchaseBill.id}` }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.supplier_name') }}</p><p class="text-sm">{{ purchaseBill.supplier_name || purchaseBill.customer_name || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.warehouse') }}</p><p class="text-sm">{{ warehouseName }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.supplier_mobile') }}</p><p class="text-sm">{{ purchaseBill.supplier_mobile || purchaseBill.customer_mobile || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.supplier_email') }}</p><p class="text-sm">{{ purchaseBill.supplier_email || purchaseBill.customer_email || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.district') }}</p><p class="text-sm">{{ districtName || t('purchase_bills_page.district_unassigned') }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.address') }}</p><p class="text-sm">{{ purchaseBill.address || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.bill_date') }}</p><p class="text-sm">{{ fmtDate(purchaseBill.bill_date) }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.supply_date') }}</p><p class="text-sm">{{ fmtDate(purchaseBill.supply_date) }}</p></div>
          <div class="sm:col-span-2"><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.bill_description') }}</p><div class="prose prose-sm mt-1 max-w-none text-sm dark:prose-invert" v-html="purchaseBill.description || '—'" /></div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6"><Package class="size-4 text-white/70" /><h2 class="text-base font-semibold">{{ t('purchase_bills_page.items_section') }}</h2></div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader><TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="rtl:text-start">{{ t('purchase_bills_page.col_product') }}</TableHead>
                  <TableHead class="rtl:text-start">{{ t('purchase_bills_page.variation') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('purchase_bills_page.qty') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('purchase_bills_page.unit_price') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('purchase_bills_page.discount_percentage') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('purchase_bills_page.line_discount') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('purchase_bills_page.row_total') }}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <TableRow v-for="(item, idx) in items" :key="String(item.id ?? idx)">
                    <TableCell><div class="flex items-center gap-2"><img v-if="productImageUrl(item)" :src="productImageUrl(item)" :alt="productLabel(item)" class="size-10 shrink-0 rounded-md border object-cover" loading="lazy"><div class="min-w-0"><span class="block">{{ productLabel(item) }}</span><span v-if="productDescription(item)" class="block text-xs text-muted-foreground whitespace-normal">{{ productDescription(item) }}</span></div></div></TableCell>
                    <TableCell>{{ variationLabel(item) }}</TableCell>
                    <TableCell class="rtl:text-start text-end tabular-nums">{{ asNumber(item.qty) }}</TableCell>
                    <TableCell class="rtl:text-start text-end tabular-nums">{{ money(item.unit_price) }}</TableCell>
                    <TableCell class="rtl:text-start text-end tabular-nums">{{ money(itemDiscountPercentage(item)) }}</TableCell>
                    <TableCell class="rtl:text-start text-end tabular-nums">{{ money(itemLineDiscount(item)) }}</TableCell>
                    <TableCell class="rtl:text-start text-end tabular-nums">{{ money(item.row_total) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <div class="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.subtotal') }}</p><p class="mt-1 font-semibold tabular-nums">{{ money(purchaseBill.subtotal) }}</p></div>
            <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.total_discount') }}</p><p class="mt-1 font-semibold tabular-nums">{{ money(purchaseBill.total_discount) }}</p></div>
            <div v-if="showAdditionalCosts" class="sm:col-span-2 lg:col-span-4 space-y-2">
              <p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.additional_costs') }}</p>
              <div class="space-y-1.5">
                <div
                  v-for="(cost, idx) in additionalCosts"
                  :key="idx"
                  class="flex items-baseline gap-2 text-sm"
                >
                  <span>{{ cost.key }}</span>
                  <span class="font-semibold tabular-nums">{{ money(cost.amount) }}</span>
                </div>
              </div>
              <p class="text-sm text-muted-foreground">
                {{ t('purchase_bills_page.additional_costs_total') }}:
                <span class="ms-1 font-semibold tabular-nums text-foreground">{{ money(additionalCostsTotal) }}</span>
              </p>
            </div>
            <div><p class="text-xs text-muted-foreground">{{ t('purchase_bills_page.grand_total') }}</p><p class="mt-1 text-lg font-bold tabular-nums">{{ grandTotal(purchaseBill.grand_total) }}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm"><div class="border-b bg-section-terms border-section-terms text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('purchase_bills_page.terms_section') }}</h2></div><CardContent class="px-4 py-5 text-sm sm:px-6 sm:py-6"><p>{{ purchaseBill.terms || '—' }}</p></CardContent></Card>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm"><div class="border-b bg-section-notes border-section-notes text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('purchase_bills_page.notes_section') }}</h2></div><CardContent class="px-4 py-5 text-sm sm:px-6 sm:py-6"><p>{{ purchaseBill.notes || '—' }}</p></CardContent></Card>
      <div class="flex justify-end"><Button variant="outline" as-child><NuxtLink to="/purchase-bills">{{ t('common.close') }}</NuxtLink></Button></div>
    </template>
  </div>
</template>
