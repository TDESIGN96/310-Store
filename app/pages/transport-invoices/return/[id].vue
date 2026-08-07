<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, FileText, Loader2, Package } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInvoicesStore, resolveInvoiceStatusAfterReturn, type InvoiceReturnFormItem } from '@/stores/invoices'
import { useTransportInvoicesStore } from '@/stores/transportInvoices'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

interface ReturnRow extends InvoiceReturnFormItem {
  selected: boolean
  qty: number
}

const route = useRoute()
const invoiceId = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { can } = usePermissions()
const canCreateInvoiceReturn = computed(() => can('invoice_returns.store'))
const { getErrorMessage } = useApiError()
const invoicesStore = useInvoicesStore()
const transportInvoicesStore = useTransportInvoicesStore()

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const reason = ref('')
const rows = ref<ReturnRow[]>([])

const invoice = computed(() => invoicesStore.currentInvoice)
const warehouseName = computed(() => {
  const warehouse = (
    invoice.value?.warehouse && typeof invoice.value.warehouse === 'object' ? invoice.value.warehouse : null
  ) as Record<string, unknown> | null
  if (!warehouse) return '—'
  const nameAr = String(warehouse.name_ar ?? '')
  const nameEn = String(warehouse.name_en ?? '')
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
})
const originalReferenceNumber = computed(() => {
  const current = invoice.value
  if (!current) return ''
  return String(current.reference_number ?? '').trim() || `#${String(current.id ?? '')}`
})
const selectedRows = computed(() => rows.value.filter(row => row.selected))

const productLabel = (row: ReturnRow): string => {
  if (locale.value === 'ar') return row.product_name_ar || row.product_name_en || `#${row.product_id ?? ''}`
  return row.product_name_en || row.product_name_ar || `#${row.product_id ?? ''}`
}

const onQtyInput = (row: ReturnRow, value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    row.qty = 1
    return
  }
  const capped = Math.min(Math.max(1, parsed), row.original_qty)
  row.qty = capped
}

const extractCreatedReturnId = (response: unknown): number | null => {
  if (!response || typeof response !== 'object') return null
  const root = response as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const invoiceReturn = (nested?.return ?? root.return ?? null) as Record<string, unknown> | null
  const id = Number(invoiceReturn?.id ?? 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

const submitReturn = async () => {
  errorMessage.value = ''
  if (!selectedRows.value.length) {
    errorMessage.value = t('transport_invoices_page.return_select_at_least_one_item')
    return
  }

  for (const row of selectedRows.value) {
    if (!Number.isFinite(row.qty) || row.qty <= 0) {
      errorMessage.value = t('transport_invoices_page.return_qty_required')
      return
    }
    if (row.qty > row.original_qty) {
      errorMessage.value = t('transport_invoices_page.return_qty_exceeds_original')
      return
    }
  }

  submitting.value = true
  try {
    const created = await invoicesStore.createInvoiceReturn(invoiceId.value, {
      reason: reason.value.trim() || null,
      return_date: null,
      items: selectedRows.value.map(row => ({
        invoice_item_id: row.invoice_item_id,
        qty: row.qty,
      })),
    })

    const nextStatus = resolveInvoiceStatusAfterReturn(
      rows.value.map(row => ({
        invoice_item_id: row.invoice_item_id,
        original_qty: row.original_qty,
      })),
      selectedRows.value.map(row => ({
        invoice_item_id: row.invoice_item_id,
        qty: row.qty,
      })),
    )
    const nextStatusLabel = nextStatus === 'returned'
      ? t('transport_invoices_page.status_returned')
      : t('transport_invoices_page.status_partially_returned')

    try {
      await invoicesStore.syncStatusAfterReturn(invoiceId.value, nextStatus, nextStatusLabel)
      transportInvoicesStore.syncInvoiceStatusInList(invoiceId.value, nextStatus, nextStatusLabel)
    }
    catch {
      invoicesStore.syncInvoiceStatusInList(invoiceId.value, nextStatus, nextStatusLabel)
      transportInvoicesStore.syncInvoiceStatusInList(invoiceId.value, nextStatus, nextStatusLabel)
    }

    toast.success(t('transport_invoices_page.return_create_success'))
    const createdId = extractCreatedReturnId(created)
    if (createdId) {
      await navigateTo(`/invoice-returns/show/${createdId}`)
      return
    }
    await navigateTo('/invoice-returns')
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
    toast.error(errorMessage.value)
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!canCreateInvoiceReturn.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const loaded = await invoicesStore.loadById(invoiceId.value)
    if (!loaded) {
      errorMessage.value = t('transport_invoices_page.not_found')
      return
    }
    rows.value = invoicesStore.extractReturnFormItems(loaded).map(item => ({
      ...item,
      selected: true,
      qty: item.original_qty,
    }))
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
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink to="/transport-invoices"><ArrowRight class="size-4" /></NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('transport_invoices_page.return_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('transport_invoices_page.return_subtitle', { id: invoiceId }) }}</p>
      </div>
    </div>

    <div
      v-if="!canCreateInvoiceReturn"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('transport_invoices_page.no_permission') }}
    </div>
    <div v-else-if="loading" class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
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
          <h2 class="text-base font-semibold">{{ t('transport_invoices_page.return_details_section') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.return_original_invoice_ref') }}</p>
            <p class="text-sm font-medium">{{ originalReferenceNumber }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.return_generated_ref') }}</p>
            <Input :model-value="t('transport_invoices_page.reference_generated_after_save')" disabled />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.customer_name') }}</p>
            <p class="text-sm">{{ String(invoice?.customer_name ?? '—') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.warehouse') }}</p>
            <p class="text-sm">{{ warehouseName }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.invoice_date') }}</p>
            <p class="text-sm">{{ formatDisplayDate(invoice?.invoice_date) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('transport_invoices_page.supply_date') }}</p>
            <p class="text-sm">{{ formatDisplayDate(invoice?.supply_date) }}</p>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">{{ t('transport_invoices_page.return_items_section') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="w-14 text-center">{{ t('common.select_placeholder') }}</TableHead>
                    <TableHead class="text-start">{{ t('transport_invoices_page.col_product') }}</TableHead>
                    <TableHead class="text-start">{{ t('transport_invoices_page.variation') }}</TableHead>
                    <TableHead class="text-end">{{ t('transport_invoices_page.return_original_qty') }}</TableHead>
                    <TableHead class="text-end">{{ t('transport_invoices_page.return_qty_label') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!rows.length">
                    <TableCell :colspan="5" class="py-10 text-center text-muted-foreground">
                      {{ t('transport_invoices_page.empty') }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-for="row in rows" :key="row.invoice_item_id">
                    <TableCell class="text-center">
                      <Checkbox
                        :model-value="row.selected"
                        @update:model-value="value => row.selected = Boolean(value)"
                      />
                    </TableCell>
                    <TableCell class="text-sm">{{ productLabel(row) }}</TableCell>
                    <TableCell class="text-sm text-muted-foreground">{{ row.variation_label || '—' }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ row.original_qty }}</TableCell>
                    <TableCell class="text-end">
                      <Input
                        :model-value="row.qty"
                        type="number"
                        min="1"
                        :max="row.original_qty"
                        class="ms-auto w-28 text-end tabular-nums"
                        :disabled="!row.selected"
                        @update:model-value="value => onQtyInput(row, value)"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('transport_invoices_page.return_qty_hint') }}
          </p>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('transport_invoices_page.return_reason_label') }}</h2>
        </div>
        <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
          <textarea
            v-model="reason"
            rows="4"
            class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
            :placeholder="t('transport_invoices_page.return_reason_placeholder')"
          />
          <p class="mt-2 text-xs text-muted-foreground">{{ t('transport_invoices_page.return_reason_optional') }}</p>
        </CardContent>
      </Card>

      <div class="flex justify-end gap-2">
        <Button variant="outline" :disabled="submitting" as-child>
          <NuxtLink to="/transport-invoices">{{ t('common.cancel') }}</NuxtLink>
        </Button>
        <Button class="bg-primary hover:bg-primary/90 text-white" :disabled="submitting" @click="submitReturn">
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          {{ t('transport_invoices_page.return_submit') }}
        </Button>
      </div>
    </template>
  </div>
</template>
