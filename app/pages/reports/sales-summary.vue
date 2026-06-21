<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowRight, Download, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerInput } from '@/components/ui/date-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import WarehouseMultiSelect from '@/components/reports/WarehouseMultiSelect.vue'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import type { SalesSummaryRecord } from '@/stores/reports'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import {
  isFromAfterToPickerDate,
  isFuturePickerDate,
  toIsoDateTimeEnd,
  toIsoDateTimeStart,
} from '@/utils/reportDateFilters'

definePageMeta({ layout: 'default' })

const { t, tm, locale } = useI18n()
const { can } = usePermissions()
const { loadActiveWarehouses } = useInvoiceWarehouses()
const reportsStore = useReportsStore()
const { getErrorMessage } = useApiError()

const canViewReports = computed(() => can('reports.index') || can('reports.show'))

const dateFrom = ref('')
const dateTo = ref('')
const selectedWarehouseIds = ref<number[]>([])
const includeDistributorInvoices = ref(false)
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const fieldErrors = ref({ from_date: '', to_date: '' })
const currentPage = ref(1)

const loading = computed(() => reportsStore.salesSummaryLoading)
const generated = computed(() => reportsStore.salesSummaryGenerated)
const summary = computed(() => reportsStore.salesSummary)
const records = computed(() => reportsStore.salesSummaryRecords)
const pagination = computed(() => reportsStore.salesSummaryPagination)

const money = (value: unknown) => formatDisplayNumber(value)
const count = (value: unknown) => formatDisplayNumber(value)

const localizedName = (entity: { name_ar?: string, name_en?: string } | null | undefined) => {
  if (!entity) return '—'
  return locale.value === 'ar'
    ? (entity.name_ar || entity.name_en || '—')
    : (entity.name_en || entity.name_ar || '—')
}

const validateFilters = (): boolean => {
  fieldErrors.value = { from_date: '', to_date: '' }
  let valid = true

  if (!dateFrom.value.trim()) {
    fieldErrors.value.from_date = t('reports_sales_summary.validation_from_required')
    valid = false
  }
  if (!dateTo.value.trim()) {
    fieldErrors.value.to_date = t('reports_sales_summary.validation_to_required')
    valid = false
  }
  if (dateFrom.value.trim() && dateTo.value.trim() && isFromAfterToPickerDate(dateFrom.value, dateTo.value)) {
    fieldErrors.value.from_date = t('reports_sales_summary.validation_from_after_to')
    valid = false
  }
  if (dateTo.value.trim() && isFuturePickerDate(dateTo.value)) {
    fieldErrors.value.to_date = t('reports_sales_summary.validation_to_future')
    valid = false
  }

  return valid
}

const canGenerate = computed(() => {
  if (!dateFrom.value.trim() || !dateTo.value.trim()) return false
  if (isFromAfterToPickerDate(dateFrom.value, dateTo.value)) return false
  if (isFuturePickerDate(dateTo.value)) return false
  return true
})

const buildQueryParams = (page = currentPage.value) => {
  const fromIso = toIsoDateTimeStart(dateFrom.value)
  const toIso = toIsoDateTimeEnd(dateTo.value)
  if (!fromIso || !toIso) return null

  return {
    from_date: fromIso,
    to_date: toIso,
    include_distributor_invoices: includeDistributorInvoices.value === true,
    warehouse_ids: selectedWarehouseIds.value.length ? selectedWarehouseIds.value : undefined,
    page,
    per_page: pagination.value.per_page || 15,
  }
}

const generateReport = async (page = 1) => {
  if (!canViewReports.value) return
  if (!validateFilters()) return

  const params = buildQueryParams(page)
  if (!params) return

  currentPage.value = page
  try {
    await reportsStore.loadSalesSummary(params)
  }
  catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const resetFilters = () => {
  dateFrom.value = ''
  dateTo.value = ''
  selectedWarehouseIds.value = []
  includeDistributorInvoices.value = false
  fieldErrors.value = { from_date: '', to_date: '' }
  currentPage.value = 1
  reportsStore.resetSalesSummary()
}

const goToPage = async (page: number) => {
  if (page < 1 || page > pagination.value.last_page || loading.value) return
  await generateReport(page)
}

const recordRow = (row: SalesSummaryRecord) => [
  row.reference_number || '—',
  formatDisplayDate(row.invoice_date) || '—',
  localizedName(row.warehouse),
  localizedName(row.distributor),
  money(row.total),
  count(row.items_count),
  money(row.returns_total),
]

const exportCSV = () => {
  if (!generated.value) return

  const summaryRows = [
    [t('reports_sales_summary.summary_total_invoices'), count(summary.value.total_invoices)],
    [t('reports_sales_summary.summary_total_sales'), money(summary.value.total_sales)],
    [t('reports_sales_summary.summary_total_returns'), money(summary.value.total_returns)],
    [t('reports_sales_summary.summary_net_sales'), money(summary.value.net_sales)],
    [t('reports_sales_summary.summary_average_order_value'), money(summary.value.average_order_value)],
    [t('reports_sales_summary.summary_total_items_sold'), count(summary.value.total_items_sold)],
  ]

  const exportHeaders = tm('reports_sales_summary.export_headers') as unknown as string[]
  const recordRows = records.value.map(recordRow)

  const csvSections = [
    [t('reports_sales_summary.export_summary_section')],
    ...summaryRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    [],
    [t('reports_sales_summary.export_records_section')],
    exportHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...recordRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ]

  const csv = csvSections.map(line => (Array.isArray(line) ? line.join(',') : `"${String(line).replace(/"/g, '""')}"`)).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `sales-summary-${formatDisplayDate(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success(t('common.export_success'))
}

onMounted(async () => {
  if (!canViewReports.value) return
  warehouseOptions.value = await loadActiveWarehouses()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Button
          as-child
          variant="ghost"
          size="sm"
          class="mb-2 -ms-2 h-8 px-2 text-muted-foreground"
        >
          <NuxtLink to="/reports" class="inline-flex items-center gap-1">
            <ArrowRight class="size-4 rtl:rotate-180" />
            {{ t('reports_hub.back_to_reports') }}
          </NuxtLink>
        </Button>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_sales_summary.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('reports_sales_summary.subtitle') }}</p>
      </div>
      <Button
        v-if="generated"
        variant="outline"
        class="gap-2 shrink-0"
        @click="exportCSV"
      >
        <Download class="size-4" />
        {{ t('reports_sales_summary.export_csv') }}
      </Button>
    </div>

    <div
      v-if="!canViewReports"
      class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('reports_sales_summary.no_permission') }}
    </div>

    <template v-else>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('reports_sales_summary.generate_report') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_sales_summary.filter_from_date') }} <span class="text-red-500">*</span>
              </label>
              <DatePickerInput
                v-model="dateFrom"
                class="w-full"
                @update:model-value="fieldErrors.from_date = ''"
              />
              <p v-if="fieldErrors.from_date" class="text-xs text-red-600">{{ fieldErrors.from_date }}</p>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_sales_summary.filter_to_date') }} <span class="text-red-500">*</span>
              </label>
              <DatePickerInput
                v-model="dateTo"
                class="w-full"
                @update:model-value="fieldErrors.to_date = ''"
              />
              <p v-if="fieldErrors.to_date" class="text-xs text-red-600">{{ fieldErrors.to_date }}</p>
            </div>
            <div class=" space-y-1.5 ">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_sales_summary.filter_warehouse') }}
              </label>
              <WarehouseMultiSelect
                v-model="selectedWarehouseIds"
                :warehouses="warehouseOptions"
                :placeholder="t('reports_sales_summary.filter_warehouse')"
                :all-label="t('reports_sales_summary.filter_warehouse_all')"
              />
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <Checkbox
                  :model-value="includeDistributorInvoices"
                  @update:model-value="value => includeDistributorInvoices = value === true"
                />
                <span>{{ t('reports_sales_summary.filter_include_distributor_invoices') }}</span>
              </label>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              @click="resetFilters"
            >
              {{ t('reports_sales_summary.reset_filters') }}
            </Button>
            <Button
              :disabled="!canGenerate || loading"
              @click="generateReport(1)"
            >
              <Loader2 v-if="loading" class="me-2 size-4 animate-spin" />
              {{ t('reports_sales_summary.generate_report') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-if="generated">
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-section-items border-section-items px-4 py-3.5 text-white sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_sales_summary.summary_title') }}</h2>
          </div>
          <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_sales_summary.summary_total_invoices') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ count(summary.total_invoices) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_sales_summary.summary_total_sales') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ money(summary.total_sales) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_sales_summary.summary_total_returns') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ money(summary.total_returns) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_sales_summary.summary_net_sales') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ money(summary.net_sales) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_sales_summary.summary_average_order_value') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ money(summary.average_order_value) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_sales_summary.summary_total_items_sold') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ count(summary.total_items_sold) }}</p>
            </div>
          </CardContent>
        </Card>

        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_sales_summary.records_title') }}</h2>
          </div>
          <CardContent class="px-0 py-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="font-medium">{{ t('reports_sales_summary.col_reference') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_sales_summary.col_invoice_date') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_sales_summary.col_warehouse') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_sales_summary.col_distributor') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_sales_summary.col_total') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_sales_summary.col_items') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_sales_summary.col_returns') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="loading">
                    <TableCell :colspan="7" class="py-10 text-center text-sm text-muted-foreground">
                      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
                      {{ t('common.loading') }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-else-if="!records.length">
                    <TableCell :colspan="7" class="py-10 text-center text-sm text-muted-foreground">
                      —
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="row in records"
                    :key="row.id"
                  >
                    <TableCell class="font-medium">{{ row.reference_number || '—' }}</TableCell>
                    <TableCell>{{ formatDisplayDate(row.invoice_date) || '—' }}</TableCell>
                    <TableCell>{{ localizedName(row.warehouse) }}</TableCell>
                    <TableCell>{{ localizedName(row.distributor) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.total) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ count(row.items_count) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.returns_total) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div
              v-if="pagination.last_page > 1"
              class="flex items-center justify-between gap-3 border-t px-4 py-3"
            >
              <p class="text-xs text-muted-foreground tabular-nums">
                {{ t('common.page_of', { current: pagination.current_page, total: pagination.last_page }) }}
              </p>
              <PaginationArrowButtons
                :current-page="pagination.current_page"
                :last-page="pagination.last_page"
                :loading="loading"
                @prev="goToPage(pagination.current_page - 1)"
                @next="goToPage(pagination.current_page + 1)"
              />
            </div>
          </CardContent>
        </Card>
      </template>
    </template>
  </div>
</template>
