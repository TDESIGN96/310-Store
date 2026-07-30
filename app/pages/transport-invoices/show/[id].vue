<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, FileText, Loader2, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInvoicesStore } from '@/stores/invoices'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber, formatDisplayGrandTotal } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { canAccess } = usePermissions()
const canViewInvoices = computed(() => canAccess('invoices'))
const invoicesStore = useInvoicesStore()
const loading = ref(false)
const errorMessage = ref('')

const invoice = computed(() => invoicesStore.currentInvoice)
const districtName = computed(() => {
  const current = invoice.value
  if (!current) return ''
  const district = (current.district && typeof current.district === 'object' ? current.district : null) as Record<string, unknown> | null
  return String(district?.district ?? current.district_name ?? '').trim()
})
const deliveryFeeValue = computed(() => {
  const current = invoice.value
  if (!current) return 0
  const direct = asNumber(current.delivery_fees)
  if (direct > 0) return direct
  const district = (current.district && typeof current.district === 'object' ? current.district : null) as Record<string, unknown> | null
  return asNumber(district?.delivery_fee)
})
const otherFeeValue = computed(() => {
  const current = invoice.value
  if (!current) return 0
  const direct = asNumber(current.other_fees)
  if (direct > 0) return direct
  const district = (current.district && typeof current.district === 'object' ? current.district : null) as Record<string, unknown> | null
  return asNumber(district?.other_fees)
})
const showDeliveryFee = computed(() => deliveryFeeValue.value > 0)
const showOtherFee = computed(() => otherFeeValue.value > 0)
const statusLabel = computed(() => {
  const current = invoice.value
  if (!current) return '—'
  const status = String(current.status ?? '').trim()
  if (status === 'pending') return t('transport_invoices_page.status_pending')
  if (status === 'printed') return t('transport_invoices_page.status_printed')
  if (status === 'ready') return t('transport_invoices_page.status_ready')
  if (status === 'shipped') return t('transport_invoices_page.status_shipped')
  if (status === 'delivered') return t('transport_invoices_page.status_delivered')
  if (status === 'settled') return t('transport_invoices_page.status_settled')
  if (status === 'returned') return t('transport_invoices_page.status_returned')
  if (status === 'partially_returned') return t('transport_invoices_page.status_partially_returned')
  if (status === 'in_delivery') return t('transport_invoices_page.status_in_delivery')
  if (status === 'complete') return t('transport_invoices_page.status_complete')
  return String(current.status_label ?? status ?? '—') || '—'
})
const deliveryBy = computed(() => String(invoice.value?.delivery_by ?? '').trim())
const deliveryByLabel = computed(() => {
  const value = deliveryBy.value
  if (value === 'delivery_agent') return t('transport_invoices_page.delivery_by_delivery_agent')
  if (value === 'other') return t('transport_invoices_page.delivery_by_other')
  if (value === 'shipping_company') return t('transport_invoices_page.delivery_by_shipping_company')
  return '—'
})
const showDeliveryAgentFields = computed(() => deliveryBy.value === 'delivery_agent' || deliveryBy.value === 'other')
const deliveryAgentName = computed(() => String(invoice.value?.delivery_agent_name ?? '').trim())
const deliveryAgentMobile = computed(() => String(invoice.value?.delivery_agent_mobile ?? '').trim())
const attachmentUrl = computed(() => String(invoice.value?.attachment_path ?? '').trim())
const items = computed(() => {
  const raw = invoice.value?.items
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
  const warehouse = (invoice.value?.warehouse && typeof invoice.value.warehouse === 'object' ? invoice.value.warehouse : null) as Record<string, unknown> | null
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
  if (!canViewInvoices.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await invoicesStore.loadById(id.value)
    if (!response) errorMessage.value = t('transport_invoices_page.not_found')
  }
  catch {
    errorMessage.value = t('transport_invoices_page.load_error')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child><NuxtLink to="/transport-invoices"><ArrowRight class="size-4" /></NuxtLink></Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('transport_invoices_page.view_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('transport_invoices_page.view_subtitle', { id }) }}</p>
      </div>
    </div>
    <div v-if="!canViewInvoices" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">{{ t('transport_invoices_page.no_permission') }}</div>
    <div v-else-if="loading" class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"><Loader2 class="mx-auto mb-2 size-6 animate-spin" />{{ t('common.loading') }}</div>
    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{{ errorMessage }}</div>

    <template v-else-if="invoice">
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6"><FileText class="size-4 text-white/70" /><h2 class="text-base font-semibold">{{ t('transport_invoices_page.details_section') }}</h2></div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.reference_number') }}</p><p class="text-sm font-medium">{{ invoice.reference_number || `#${invoice.id}` }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.shipment_status_label') }}</p><p class="text-sm font-medium">{{ invoice.shipment_status_label || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.col_status') }}</p><p class="text-sm font-medium">{{ statusLabel }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.customer_name') }}</p><p class="text-sm">{{ invoice.customer_name || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.warehouse') }}</p><p class="text-sm">{{ warehouseName }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.customer_mobile') }}</p><p class="text-sm">{{ invoice.customer_mobile || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.district') }}</p><p class="text-sm">{{ districtName || t('transport_invoices_page.district_unassigned') }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.address') }}</p><p class="text-sm">{{ invoice.address || '—' }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.invoice_date') }}</p><p class="text-sm">{{ fmtDate(invoice.invoice_date) }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.supply_date') }}</p><p class="text-sm">{{ fmtDate(invoice.supply_date) }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.delivery_by') }}</p><p class="text-sm">{{ deliveryByLabel }}</p></div>
          <template v-if="showDeliveryAgentFields">
            <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.delivery_agent_name') }}</p><p class="text-sm">{{ deliveryAgentName || '—' }}</p></div>
            <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.delivery_agent_mobile') }}</p><p class="text-sm">{{ deliveryAgentMobile || '—' }}</p></div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.attachment') }}</p>
              <p class="text-sm">
                <a v-if="attachmentUrl" :href="attachmentUrl" target="_blank" rel="noopener noreferrer" class="text-primary underline">{{ t('transport_invoices_page.attachment_current_file') }}</a>
                <template v-else>—</template>
              </p>
            </div>
          </template>
          <div class="sm:col-span-2"><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.invoice_description') }}</p><div class="rich-text-content prose prose-sm mt-1 max-w-none text-sm dark:prose-invert" v-html="invoice.description || '—'" /></div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6"><Package class="size-4 text-white/70" /><h2 class="text-base font-semibold">{{ t('transport_invoices_page.items_section') }}</h2></div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader><TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="rtl:text-start">{{ t('transport_invoices_page.col_product') }}</TableHead>
                  <TableHead class="rtl:text-start">{{ t('transport_invoices_page.variation') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('transport_invoices_page.qty') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('transport_invoices_page.unit_price') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('transport_invoices_page.discount_percentage') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('transport_invoices_page.line_discount') }}</TableHead>
                  <TableHead class="rtl:text-start text-end">{{ t('transport_invoices_page.row_total') }}</TableHead>
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
          <div class="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-4">
            <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.subtotal') }}</p><p class="mt-1 font-semibold tabular-nums">{{ money(invoice.subtotal) }}</p></div>
            <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.total_discount') }}</p><p class="mt-1 font-semibold tabular-nums">{{ money(invoice.total_discount) }}</p></div>
            <div v-if="showDeliveryFee"><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.delivery_fees') }}</p><p class="mt-1 font-semibold tabular-nums">{{ money(deliveryFeeValue) }}</p></div>
            <div v-if="showOtherFee"><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.other_fees') }}</p><p class="mt-1 font-semibold tabular-nums">{{ money(otherFeeValue) }}</p></div>
            <div><p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.grand_total') }}</p><p class="mt-1 text-lg font-bold tabular-nums">{{ grandTotal(invoice.grand_total) }}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm"><div class="border-b bg-section-terms border-section-terms text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('transport_invoices_page.terms_section') }}</h2></div><CardContent class="px-4 py-5 text-sm sm:px-6 sm:py-6"><div class="rich-text-content prose prose-sm max-w-none dark:prose-invert" v-html="invoice.terms || '—'" /></CardContent></Card>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm"><div class="border-b bg-section-notes border-section-notes text-Black px-4 py-3.5 sm:px-6"><h2 class="text-base font-semibold">{{ t('transport_invoices_page.notes_section') }}</h2></div><CardContent class="px-4 py-5 text-sm sm:px-6 sm:py-6"><div class="rich-text-content prose prose-sm max-w-none dark:prose-invert" v-html="invoice.notes || '—'" /></CardContent></Card>
      <div class="flex justify-end"><Button variant="outline" as-child><NuxtLink to="/transport-invoices">{{ t('common.close') }}</NuxtLink></Button></div>
    </template>
  </div>
</template>
