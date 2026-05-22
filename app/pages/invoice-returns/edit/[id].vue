<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, FileText, Loader2, Package } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInvoicesStore, type InvoiceReturnItem, type InvoiceReturnRecord } from '@/stores/invoices'

definePageMeta({ layout: 'default' })

interface EditableReturnRow {
  id: number
  invoice_item_id: number
  product_label: string
  variation_label: string
  selected: boolean
  qty: number
  original_qty: number
}

const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const { can } = usePermissions()
const canUpdateInvoiceReturn = computed(() => can('invoice_returns.update'))
const { getErrorMessage } = useApiError()
const invoicesStore = useInvoicesStore()

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const reason = ref('')
const returnDate = ref<string | null>(null)
const returnRef = ref('')
const rows = ref<EditableReturnRow[]>([])

const currentReturn = ref<InvoiceReturnRecord | null>(null)
const selectedRows = computed(() => rows.value.filter(row => row.selected))

const productLabelFromItem = (item: InvoiceReturnItem): string => {
  const direct = item.product && typeof item.product === 'object' ? item.product as Record<string, unknown> : null
  const fromInvoiceItem = item.invoice_item && typeof item.invoice_item === 'object'
    ? ((item.invoice_item as Record<string, unknown>).product as Record<string, unknown> | undefined)
    : undefined
  const source = direct ?? fromInvoiceItem ?? null
  if (!source) return '—'
  const nameAr = String(source.name_ar ?? '')
  const nameEn = String(source.name_en ?? '')
  return locale.value === 'ar' ? (nameAr || nameEn || '—') : (nameEn || nameAr || '—')
}

const variationLabelFromItem = (item: InvoiceReturnItem): string => {
  const direct = item.variation && typeof item.variation === 'object' ? item.variation as Record<string, unknown> : null
  const fromInvoiceItem = item.invoice_item && typeof item.invoice_item === 'object'
    ? ((item.invoice_item as Record<string, unknown>).variation as Record<string, unknown> | undefined)
    : undefined
  const source = direct ?? fromInvoiceItem ?? null
  return String(source?.label ?? source?.sku ?? '—')
}

const originalQtyFromItem = (item: InvoiceReturnItem): number => {
  if (!item.invoice_item || typeof item.invoice_item !== 'object') return item.qty
  const rawQty = Number((item.invoice_item as Record<string, unknown>).qty ?? item.qty)
  return Number.isFinite(rawQty) && rawQty > 0 ? rawQty : item.qty
}

const onQtyInput = (row: EditableReturnRow, value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    row.qty = 1
    return
  }
  row.qty = Math.min(Math.max(1, parsed), row.original_qty)
}

const submitUpdate = async () => {
  errorMessage.value = ''
  if (!selectedRows.value.length) {
    errorMessage.value = t('invoices_page.return_select_at_least_one_item')
    return
  }
  for (const row of selectedRows.value) {
    if (!Number.isFinite(row.qty) || row.qty <= 0) {
      errorMessage.value = t('invoices_page.return_qty_required')
      return
    }
    if (row.qty > row.original_qty) {
      errorMessage.value = t('invoices_page.return_qty_exceeds_original')
      return
    }
  }

  submitting.value = true
  try {
    await invoicesStore.updateInvoiceReturn(id.value, {
      reason: reason.value.trim() || null,
      return_date: returnDate.value || null,
      items: selectedRows.value.map(row => ({
        invoice_item_id: row.invoice_item_id,
        qty: row.qty,
      })),
    })
    toast.success(t('invoice_returns_page.update_success'))
    await navigateTo(`/invoice-returns/show/${id.value}`)
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
  if (!canUpdateInvoiceReturn.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const loaded = await invoicesStore.loadInvoiceReturnById(id.value)
    if (!loaded) {
      errorMessage.value = t('invoice_returns_page.not_found')
      return
    }
    currentReturn.value = loaded
    reason.value = loaded.reason || ''
    returnDate.value = loaded.return_date || null
    returnRef.value = loaded.reference_number || ''
    rows.value = loaded.items.map(item => {
      const originalQty = originalQtyFromItem(item)
      return {
        id: item.id,
        invoice_item_id: item.invoice_item_id,
        product_label: productLabelFromItem(item),
        variation_label: variationLabelFromItem(item),
        selected: true,
        qty: item.qty,
        original_qty: originalQty,
      }
    })
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
        <NuxtLink :to="`/invoice-returns/show/${id}`"><ArrowRight class="size-4" /></NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('invoice_returns_page.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('invoice_returns_page.edit_subtitle', { id }) }}</p>
      </div>
    </div>

    <div
      v-if="!canUpdateInvoiceReturn"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800"
    >
      {{ t('invoice_returns_page.no_permission') }}
    </div>
    <div v-else-if="loading" class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
    </div>
    <template v-else>
      <div
        v-if="errorMessage"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ errorMessage }}
      </div>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <FileText class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('invoice_returns_page.details_section') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.col_ref_id') }}</p>
            <Input :model-value="returnRef || t('invoices_page.reference_generated_after_save')" disabled />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('invoice_returns_page.col_invoice_id') }}</p>
            <p class="text-sm">{{ currentReturn?.invoice_id ?? '—' }}</p>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('invoice_returns_page.items_section') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div class="overflow-hidden rounded-xl border">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="w-14 text-center">{{ t('common.select_placeholder') }}</TableHead>
                    <TableHead class="text-start">{{ t('invoices_page.col_product') }}</TableHead>
                    <TableHead class="text-start">{{ t('invoices_page.variation') }}</TableHead>
                    <TableHead class="text-end">{{ t('invoice_returns_page.original_qty') }}</TableHead>
                    <TableHead class="text-end">{{ t('invoices_page.return_qty_label') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in rows" :key="row.id">
                    <TableCell class="text-center">
                      <Checkbox
                        :model-value="row.selected"
                        @update:model-value="value => row.selected = Boolean(value)"
                      />
                    </TableCell>
                    <TableCell>{{ row.product_label }}</TableCell>
                    <TableCell>{{ row.variation_label || '—' }}</TableCell>
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
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('invoice_returns_page.reason_label') }}</h2>
        </div>
        <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
          <textarea
            v-model="reason"
            rows="4"
            class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
            :placeholder="t('invoices_page.return_reason_placeholder')"
          />
          <p class="mt-2 text-xs text-muted-foreground">{{ t('invoices_page.return_reason_optional') }}</p>
        </CardContent>
      </Card>

      <div class="flex justify-end gap-2">
        <Button variant="outline" :disabled="submitting" as-child>
          <NuxtLink :to="`/invoice-returns/show/${id}`">{{ t('common.cancel') }}</NuxtLink>
        </Button>
        <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="submitUpdate">
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          {{ t('common.save') }}
        </Button>
      </div>
    </template>
  </div>
</template>
