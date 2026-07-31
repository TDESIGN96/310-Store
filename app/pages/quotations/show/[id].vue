<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, FileText, Loader2, Package, Printer } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import SalesDocumentPrint from '@/components/documents/SalesDocumentPrint.vue'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber, formatDisplayGrandTotal } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { canAccess } = usePermissions()
const { print } = usePrint()
const canViewQuotations = computed(() => canAccess('quotations'))
const quotationsStore = useQuotationsStore()
const loading = ref(false)
const errorMessage = ref('')

const quotation = computed(() => quotationsStore.currentQuotation)
const districtName = computed(() => {
  const q = quotation.value
  if (!q) return ''
  const district = q.district
  if (district && typeof district === 'object') {
    return String((district as Record<string, unknown>).district ?? '').trim()
  }
  return String(q.district_name ?? '').trim()
})
const deliveryFeeValue = computed(() => {
  const q = quotation.value
  if (!q) return 0
  const direct = asNumber(q.delivery_fees)
  if (direct > 0) return direct
  const district = q.district
  if (district && typeof district === 'object') {
    return asNumber((district as Record<string, unknown>).delivery_fee)
  }
  return 0
})
const otherFeeValue = computed(() => {
  const q = quotation.value
  if (!q) return 0
  const direct = asNumber(q.other_fees)
  if (direct > 0) return direct
  const district = q.district
  if (district && typeof district === 'object') {
    return asNumber((district as Record<string, unknown>).other_fees)
  }
  return 0
})
const showDeliveryFee = computed(() => deliveryFeeValue.value > 0)
const showOtherFee = computed(() => otherFeeValue.value > 0)
const items = computed(() => {
  const raw = quotation.value?.items
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
  const url = String(
    product.main_image_url
    ?? product.main_image
    ?? product.image_url
    ?? product.image
    ?? '',
  ).trim()
  return url
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

const itemDiscount = (row: Record<string, unknown>) => {
  const direct = asNumber(row.discount)
  if (direct > 0) return direct

  const qty = asNumber(row.qty)
  const lineDiscount = asNumber(row.line_discount)
  if (qty > 0 && lineDiscount > 0) return lineDiscount / qty

  const unitPrice = asNumber(row.unit_price)
  const percentage = asNumber(row.discount_percentage ?? row.discount_percent)
  if (unitPrice > 0 && percentage > 0) return (unitPrice * percentage) / 100

  return 0
}

const itemDiscountPercentage = (row: Record<string, unknown>) => {
  const direct = asNumber(row.discount_percentage ?? row.discount_percent)
  if (direct > 0) return direct

  const unitPrice = asNumber(row.unit_price)
  if (unitPrice <= 0) return 0
  return (itemDiscount(row) / unitPrice) * 100
}

const itemLineDiscount = (row: Record<string, unknown>) => {
  const direct = asNumber(row.line_discount)
  if (direct > 0) return direct
  return itemDiscount(row) * asNumber(row.qty)
}

const printFields = computed(() => {
  const current = quotation.value
  if (!current) return []
  return [
    { label: t('quotations_page.reference_number'), value: String(current.reference_number || `#${current.id}`) },
    { label: t('quotations_page.col_status'), value: String(current.status || '—') },
    { label: t('quotations_page.customer_name'), value: String(current.customer_name || '—') },
    { label: t('quotations_page.customer_phone'), value: String(current.customer_phone || '—') },
    { label: t('quotations_page.customer_email'), value: String(current.customer_email || '—') },
    { label: t('quotations_page.district'), value: districtName.value || t('quotations_page.district_unassigned') },
    { label: t('quotations_page.issue_date'), value: fmtDate(current.issue_date) },
    { label: t('quotations_page.expiry_date'), value: fmtDate(current.expiry_date) },
  ]
})

const printItems = computed(() => items.value.map(item => ({
  product: productLabel(item),
  description: productDescription(item) || undefined,
  variation: variationLabel(item),
  qty: String(asNumber(item.qty)),
  unitPrice: money(item.unit_price),
  discountPercentage: money(itemDiscountPercentage(item)),
  lineDiscount: money(itemLineDiscount(item)),
  rowTotal: money(item.row_total),
})))

const printTotals = computed(() => {
  const current = quotation.value
  if (!current) return []
  const totals: Array<{ label: string; value: string; emphasize?: boolean }> = [
    { label: t('quotations_page.subtotal'), value: money(current.subtotal) },
    { label: t('quotations_page.total_discount'), value: money(current.total_discount) },
  ]
  if (showDeliveryFee.value) {
    totals.push({ label: t('quotations_page.delivery_fees'), value: money(deliveryFeeValue.value) })
  }
  if (showOtherFee.value) {
    totals.push({ label: t('quotations_page.other_fees'), value: money(otherFeeValue.value) })
  }
  totals.push({ label: t('quotations_page.grand_total'), value: grandTotal(current.grand_total), emphasize: true })
  return totals
})

const asPrintHtml = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

onMounted(async () => {
  if (!canViewQuotations.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await quotationsStore.loadById(id.value)
    if (!response) errorMessage.value = t('quotations_page.not_found')
  }
  catch {
    errorMessage.value = t('quotations_page.load_error')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="no-print flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink to="/quotations">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 flex-1 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('quotations_page.view_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('quotations_page.view_subtitle', { id }) }}</p>
      </div>
      <Button v-if="quotation" variant="outline" class="gap-2 shrink-0" @click="print">
        <Printer class="size-4" />
        {{ t('common.print') }}
      </Button>
    </div>

    <div
      v-if="!canViewQuotations"
      class="no-print rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('quotations_page.no_permission') }}
    </div>

    <div
      v-else-if="loading"
      class="no-print rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="errorMessage"
      class="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
    >
      {{ errorMessage }}
    </div>

    <template v-else-if="quotation">
      <div class="no-print flex flex-col gap-6">
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
            <FileText class="size-4 text-white/70" />
            <h2 class="text-base font-semibold">{{ t('quotations_page.details_section') }}</h2>
          </div>
          <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.reference_number') }}</p>
              <p class="text-sm font-medium">{{ quotation.reference_number || `#${quotation.id}` }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.col_status') }}</p>
              <p class="text-sm font-medium">{{ quotation.status }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.customer_name') }}</p>
              <p class="text-sm">{{ quotation.customer_name || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.customer_phone') }}</p>
              <p class="text-sm">{{ quotation.customer_phone || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.customer_email') }}</p>
              <p class="text-sm">{{ quotation.customer_email || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.district') }}</p>
              <p class="text-sm">{{ districtName || t('quotations_page.district_unassigned') }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.issue_date') }}</p>
              <p class="text-sm">{{ fmtDate(quotation.issue_date) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.expiry_date') }}</p>
              <p class="text-sm">{{ fmtDate(quotation.expiry_date) }}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-xs text-muted-foreground">{{ t('quotations_page.quotation_description') }}</p>
              <div class="rich-text-content prose prose-sm mt-1 max-w-none text-sm dark:prose-invert" v-html="quotation.description || '—'" />
            </div>
          </CardContent>
        </Card>

        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
            <Package class="size-4 text-white/70" />
            <h2 class="text-base font-semibold">{{ t('quotations_page.items_section') }}</h2>
          </div>
          <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
            <div class="overflow-hidden rounded-xl border">
              <div class="overflow-x-auto">
                <Table>
                  <TableHeader class="hidden md:table-header-group">
                    <TableRow class="bg-muted/40 hover:bg-muted/40">
                      <TableHead class="rtl:text-start">{{ t('quotations_page.col_product') }}</TableHead>
                      <TableHead class="rtl:text-start">{{ t('quotations_page.variation') }}</TableHead>
                      <TableHead class="rtl:text-start">{{ t('quotations_page.qty') }}</TableHead>
                      <TableHead class="rtl:text-start">{{ t('quotations_page.unit_price') }}</TableHead>
                      <TableHead class="rtl:text-start">{{ t('quotations_page.discount_percentage') }}</TableHead>
                      <TableHead class="rtl:text-start">{{ t('quotations_page.line_discount') }}</TableHead>
                      <TableHead class="rtl:text-start">{{ t('quotations_page.row_total') }}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="(item, idx) in items"
                      :key="String(item.id ?? idx)"
                      class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none"
                    >
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.col_product') }}</span>
                        <div class="flex items-center gap-2 min-w-0">
                          <img
                            v-if="productImageUrl(item)"
                            :src="productImageUrl(item)"
                            :alt="productLabel(item)"
                            class="size-10 shrink-0 rounded-md border object-cover"
                            loading="lazy"
                          >
                          <div class="min-w-0">
                            <span class="block">{{ productLabel(item) }}</span>
                            <span v-if="productDescription(item)" class="block text-xs text-muted-foreground whitespace-normal">{{ productDescription(item) }}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.variation') }}</span>
                        <span>{{ variationLabel(item) }}</span>
                      </TableCell>
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.qty') }}</span>
                        <span class="tabular-nums">{{ asNumber(item.qty) }}</span>
                      </TableCell>
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.unit_price') }}</span>
                        <span class="tabular-nums">{{ money(item.unit_price) }}</span>
                      </TableCell>
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.discount_percentage') }}</span>
                        <span class="tabular-nums">{{ money(itemDiscountPercentage(item)) }}</span>
                      </TableCell>
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.line_discount') }}</span>
                        <span class="tabular-nums">{{ money(itemLineDiscount(item)) }}</span>
                      </TableCell>
                      <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                        <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('quotations_page.row_total') }}</span>
                        <span class="tabular-nums">{{ money(item.row_total) }}</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div class="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-4">
              <div>
                <p class="text-xs text-muted-foreground">{{ t('quotations_page.subtotal') }}</p>
                <p class="mt-1 font-semibold tabular-nums">{{ money(quotation.subtotal) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ t('quotations_page.total_discount') }}</p>
                <p class="mt-1 font-semibold tabular-nums">{{ money(quotation.total_discount) }}</p>
              </div>
              <div v-if="showDeliveryFee">
                <p class="text-xs text-muted-foreground">{{ t('quotations_page.delivery_fees') }}</p>
                <p class="mt-1 font-semibold tabular-nums">{{ money(deliveryFeeValue) }}</p>
              </div>
              <div v-if="showOtherFee">
                <p class="text-xs text-muted-foreground">{{ t('quotations_page.other_fees') }}</p>
                <p class="mt-1 font-semibold tabular-nums">{{ money(otherFeeValue) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ t('quotations_page.grand_total') }}</p>
                <p class="mt-1 text-lg font-bold tabular-nums">{{ grandTotal(quotation.grand_total) }}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="border-b bg-section-terms border-section-terms text-Black px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('quotations_page.terms_section') }}</h2>
          </div>
          <CardContent class="px-4 py-5 text-sm sm:px-6 sm:py-6">
            <div class="rich-text-content prose prose-sm max-w-none dark:prose-invert" v-html="quotation.terms || '—'" />
          </CardContent>
        </Card>

        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="border-b bg-section-notes border-section-notes text-Black px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('quotations_page.notes_section') }}</h2>
          </div>
          <CardContent class="px-4 py-5 text-sm sm:px-6 sm:py-6">
            <div class="rich-text-content prose prose-sm max-w-none dark:prose-invert" v-html="quotation.notes || '—'" />
          </CardContent>
        </Card>

        <div class="flex justify-end gap-2">
          <Button variant="outline" class="gap-2" @click="print">
            <Printer class="size-4" />
            {{ t('common.print') }}
          </Button>
          <Button variant="outline" as-child>
            <NuxtLink to="/quotations">{{ t('common.close') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <SalesDocumentPrint
        :title="t('quotations_page.view_title')"
        :reference="String(quotation.reference_number || `#${quotation.id}`)"
        :fields="printFields"
        :description-label="t('quotations_page.quotation_description')"
        :description-html="asPrintHtml(quotation.description)"
        :items-label="t('quotations_page.items_section')"
        :product-label="t('quotations_page.col_product')"
        :variation-label="t('quotations_page.variation')"
        :qty-label="t('quotations_page.qty')"
        :unit-price-label="t('quotations_page.unit_price')"
        :discount-percentage-label="t('quotations_page.discount_percentage')"
        :line-discount-label="t('quotations_page.line_discount')"
        :row-total-label="t('quotations_page.row_total')"
        :items="printItems"
        :totals="printTotals"
        :terms-label="t('quotations_page.terms_section')"
        :terms-html="asPrintHtml(quotation.terms)"
        :notes-label="t('quotations_page.notes_section')"
        :notes-html="asPrintHtml(quotation.notes)"
      />
    </template>
  </div>
</template>
