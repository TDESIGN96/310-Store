<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, FileText, Loader2, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInvoicesStore, type InvoiceReturnItem, type InvoiceReturnRecord } from '@/stores/invoices'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { canAccess } = usePermissions()
const canViewInvoiceReturns = computed(() => canAccess('invoice_returns'))
const invoicesStore = useInvoicesStore()

const loading = ref(false)
const errorMessage = ref('')
const invoiceReturn = ref<InvoiceReturnRecord | null>(null)

const asNumber = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const productLabel = (row: InvoiceReturnItem) => {
  const direct = row.product && typeof row.product === 'object' ? row.product as Record<string, unknown> : null
  const fromItem = row.invoice_item && typeof row.invoice_item === 'object'
    ? ((row.invoice_item as Record<string, unknown>).product as Record<string, unknown> | undefined)
    : undefined
  const source = direct ?? fromItem ?? null
  if (!source) return '—'
  const nameAr = String(source.name_ar ?? '')
  const nameEn = String(source.name_en ?? '')
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
}

const variationLabel = (row: InvoiceReturnItem) => {
  const direct = row.variation && typeof row.variation === 'object' ? row.variation as Record<string, unknown> : null
  const fromItem = row.invoice_item && typeof row.invoice_item === 'object'
    ? ((row.invoice_item as Record<string, unknown>).variation as Record<string, unknown> | undefined)
    : undefined
  const source = direct ?? fromItem ?? null
  return String(source?.label ?? source?.sku ?? '—')
}

onMounted(async () => {
  if (!canViewInvoiceReturns.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const loaded = await invoicesStore.loadInvoiceReturnById(id.value)
    if (!loaded) {
      errorMessage.value = t('invoice_returns_page.not_found')
      return
    }
    invoiceReturn.value = loaded
  }
  catch {
    errorMessage.value = t('invoice_returns_page.load_error')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink to="/invoice-returns"><ArrowRight class="size-4" /></NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('invoice_returns_page.view_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('invoice_returns_page.view_subtitle', { id }) }}</p>
      </div>
    </div>

    <div v-if="!canViewInvoiceReturns" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800">
      {{ t('invoice_returns_page.no_permission') }}
    </div>
    <div v-else-if="loading" class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
    </div>
    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
      {{ errorMessage }}
    </div>

    <template v-else-if="invoiceReturn">
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
          <FileText class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">{{ t('invoice_returns_page.details_section') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <div><p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.col_ref_id') }}</p><p class="text-sm font-medium">{{ invoiceReturn.reference_number || `#${invoiceReturn.id}` }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.col_invoice_id') }}</p><p class="text-sm font-medium">{{ invoiceReturn.invoice_id }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.col_return_date') }}</p><p class="text-sm">{{ formatDisplayDate(invoiceReturn.return_date) }}</p></div>
          <div><p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.col_created_by') }}</p><p class="text-sm">{{ invoiceReturn.created_by?.name || invoiceReturn.created_by?.email || '—' }}</p></div>
          <div class="sm:col-span-2"><p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.reason_label') }}</p><p class="text-sm">{{ invoiceReturn.reason || '—' }}</p></div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">{{ t('invoice_returns_page.items_section') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader class="hidden md:table-header-group">
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="text-start">{{ t('invoices_page.col_product') }}</TableHead>
                    <TableHead class="text-start">{{ t('invoices_page.variation') }}</TableHead>
                    <TableHead class="text-end">{{ t('invoices_page.qty') }}</TableHead>
                    <TableHead class="text-end">{{ t('invoice_returns_page.original_qty') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="item in invoiceReturn.items"
                    :key="item.id"
                    class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none"
                  >
                    <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                      <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoices_page.col_product') }}</span>
                      <span>{{ productLabel(item) }}</span>
                    </TableCell>
                    <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                      <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoices_page.variation') }}</span>
                      <span>{{ variationLabel(item) }}</span>
                    </TableCell>
                    <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
                      <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoices_page.qty') }}</span>
                      <span class="tabular-nums">{{ item.qty }}</span>
                    </TableCell>
                    <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
                      <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoice_returns_page.original_qty') }}</span>
                      <span class="tabular-nums">{{ asNumber((item.invoice_item as any)?.qty) }}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
