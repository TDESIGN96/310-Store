<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowRight, FileSpreadsheet, FileText, Loader2 } from 'lucide-vue-next'
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
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import WarehouseMultiSelect from '@/components/reports/WarehouseMultiSelect.vue'
import ReportMultiSelect from '@/components/reports/ReportMultiSelect.vue'
import ReportFilterField from '@/components/reports/ReportFilterField.vue'
import ReportDateRangeFilter from '@/components/reports/ReportDateRangeFilter.vue'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'
import { fetchAllCategoriesPages } from '@/utils/categoryList'
import {
  isFromAfterToPickerDate,
  isFuturePickerDate,
  todayPickerDate,
  toIsoDateTimeEnd,
  toIsoDateTimeStart,
} from '@/utils/reportDateFilters'
import { reportViewPermission } from '@/config/reportPermissions'

definePageMeta({ layout: 'default' })

interface CategoryOption {
  id: number
  name_ar: string
  name_en: string
}

const { t, locale } = useI18n()
const { can } = usePermissions()
const { $api } = useApi()
const { loadActiveWarehouses } = useInvoiceWarehouses()
const reportsStore = useReportsStore()
const { getErrorMessage } = useApiError()
const { exportingExcel, exportingPdf, exportExcel, exportPdf } = useReportExport('product-profitability')

const canViewReports = computed(() => can('reports.index') || can('reports.show') || can(reportViewPermission('product-profitability')))

const dateFrom = ref('')
const dateTo = ref(todayPickerDate())
const selectedWarehouseIds = ref<number[]>([])
const selectedCategoryIds = ref<number[]>([])
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const categoryOptions = ref<CategoryOption[]>([])
const fieldErrors = ref({ from_date: '', to_date: '' })
const currentPage = ref(1)

const loading = computed(() => reportsStore.productProfitabilityLoading)
const generated = computed(() => reportsStore.productProfitabilityGenerated)
const records = computed(() => reportsStore.productProfitabilityRecords)
const pagination = computed(() => reportsStore.productProfitabilityPagination)

const money = (value: unknown) => formatDisplayNumber(value)
const count = (value: unknown) => formatDisplayNumber(value)

const formatPercent = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0%'
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(num)}%`
}

const localizedName = (entity: { name_ar?: string, name_en?: string } | null) => {
  if (!entity) return '—'
  return locale.value === 'ar'
    ? (entity.name_ar || entity.name_en || '—')
    : (entity.name_en || entity.name_ar || '—')
}

const categorySelectItems = computed(() =>
  categoryOptions.value.map(c => ({
    id: c.id,
    label: localizedName(c) || `#${c.id}`,
  })),
)

const validateFilters = (): boolean => {
  fieldErrors.value = { from_date: '', to_date: '' }
  let valid = true

  if (!dateFrom.value.trim()) {
    fieldErrors.value.from_date = t('reports_product_profitability.validation_from_required')
    valid = false
  }
  if (!dateTo.value.trim()) {
    fieldErrors.value.to_date = t('reports_product_profitability.validation_to_required')
    valid = false
  }
  if (dateFrom.value.trim() && dateTo.value.trim() && isFromAfterToPickerDate(dateFrom.value, dateTo.value)) {
    fieldErrors.value.from_date = t('reports_product_profitability.validation_from_after_to')
    valid = false
  }
  if (dateTo.value.trim() && isFuturePickerDate(dateTo.value)) {
    fieldErrors.value.to_date = t('reports_product_profitability.validation_to_future')
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
    warehouse_ids: selectedWarehouseIds.value.length ? selectedWarehouseIds.value : undefined,
    category_ids: selectedCategoryIds.value.length ? selectedCategoryIds.value : undefined,
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
    await reportsStore.loadProductProfitability(params)
  }
  catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const resetFilters = () => {
  dateFrom.value = ''
  dateTo.value = todayPickerDate()
  selectedWarehouseIds.value = []
  selectedCategoryIds.value = []
  fieldErrors.value = { from_date: '', to_date: '' }
  currentPage.value = 1
  reportsStore.resetProductProfitability()
}

const goToPage = async (page: number) => {
  if (page < 1 || page > pagination.value.last_page || loading.value) return
  await generateReport(page)
}

const buildExportParams = () => {
  const params = buildQueryParams(1)
  if (!params) return null
  const exportParams: Record<string, unknown> = { ...params }
  delete exportParams.page
  delete exportParams.per_page
  return exportParams
}

const handleExportExcel = () => {
  if (!validateFilters()) return
  exportExcel(buildExportParams())
}

const handleExportPdf = () => {
  if (!validateFilters()) return
  exportPdf(buildExportParams())
}

const loadCategoryOptions = async () => {
  const list = await fetchAllCategoriesPages<CategoryOption>($api, { status: 'active' })
  categoryOptions.value = list.filter(c => String((c as CategoryOption & { status?: string }).status ?? 'active').toLowerCase() !== 'deleted')
}

onMounted(async () => {
  if (!canViewReports.value) return
  const [warehouses] = await Promise.all([
    loadActiveWarehouses(),
    loadCategoryOptions(),
  ])
  warehouseOptions.value = warehouses
})
</script>

<template>
  <div class="flex flex-col gap-6">
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
      <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_product_profitability.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('reports_product_profitability.subtitle') }}</p>
    </div>

    <div
      v-if="!canViewReports"
      class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('reports_product_profitability.no_permission') }}
    </div>

    <template v-else>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('reports_product_profitability.generate_report') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6">
          <ReportDateRangeFilter
            v-model:date-from="dateFrom"
            v-model:date-to="dateTo"
            :from-label="t('reports_product_profitability.filter_from_date')"
            :to-label="t('reports_product_profitability.filter_to_date')"
            :from-error="fieldErrors.from_date"
            :to-error="fieldErrors.to_date"
            @clear-errors="fieldErrors = { from_date: '', to_date: '' }"
          />
          <div class="grid items-start gap-4 sm:grid-cols-2">
            <ReportFilterField :label="t('reports_product_profitability.filter_warehouse')">
              <WarehouseMultiSelect
                v-model="selectedWarehouseIds"
                :warehouses="warehouseOptions"
                :placeholder="t('reports_product_profitability.filter_warehouse')"
                :all-label="t('reports_product_profitability.filter_warehouse_all')"
              />
            </ReportFilterField>
            <ReportFilterField :label="t('reports_product_profitability.filter_category')">
              <ReportMultiSelect
                v-model="selectedCategoryIds"
                :items="categorySelectItems"
                :placeholder="t('reports_product_profitability.filter_category')"
                :all-label="t('reports_product_profitability.filter_category_all')"
              />
            </ReportFilterField>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              @click="resetFilters"
            >
              {{ t('reports_product_profitability.reset_filters') }}
            </Button>
            <Button
              :disabled="!canGenerate || loading"
              @click="generateReport(1)"
            >
              <Loader2 v-if="loading" class="me-2 size-4 animate-spin" />
              {{ t('reports_product_profitability.generate_report') }}
            </Button>
            <Button
              variant="outline"
              class="gap-2"
              :disabled="!canGenerate || exportingExcel"
              @click="handleExportExcel"
            >
              <Loader2 v-if="exportingExcel" class="size-4 animate-spin" />
              <FileSpreadsheet v-else class="size-4" />
              {{ t('reports_hub.export_excel') }}
            </Button>
            <Button
              variant="outline"
              class="gap-2"
              :disabled="!canGenerate || exportingPdf"
              @click="handleExportPdf"
            >
              <Loader2 v-if="exportingPdf" class="size-4 animate-spin" />
              <FileText v-else class="size-4" />
              {{ t('reports_hub.export_pdf') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-if="generated">
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_product_profitability.records_title') }}</h2>
          </div>
          <CardContent class="px-0 py-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="font-medium text-start">{{ t('reports_product_profitability.col_product_name') }}</TableHead>
                    <TableHead class="font-medium text-start">{{ t('reports_product_profitability.col_category') }}</TableHead>
                    <TableHead class="font-medium text-end tabular-nums">{{ t('reports_product_profitability.col_average_cost_price') }}</TableHead>
                    <TableHead class="font-medium text-end tabular-nums">{{ t('reports_product_profitability.col_average_selling_price') }}</TableHead>
                    <TableHead class="font-medium text-end tabular-nums">{{ t('reports_product_profitability.col_profit_margin') }}</TableHead>
                    <TableHead class="font-medium text-end tabular-nums">{{ t('reports_product_profitability.col_total_quantity_sold') }}</TableHead>
                    <TableHead class="font-medium text-end tabular-nums">{{ t('reports_product_profitability.col_total_profit') }}</TableHead>
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
                      {{ t('reports_product_profitability.empty_records') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="row in records"
                    :key="row.key"
                  >
                    <TableCell class="font-medium text-start align-middle">{{ localizedName(row.product) }}</TableCell>
                    <TableCell class="text-start align-middle">{{ localizedName(row.category) }}</TableCell>
                    <TableCell class="text-end tabular-nums align-middle">{{ money(row.average_cost_price) }}</TableCell>
                    <TableCell class="text-end tabular-nums align-middle">{{ money(row.average_selling_price) }}</TableCell>
                    <TableCell class="text-end tabular-nums align-middle">{{ formatPercent(row.profit_margin) }}</TableCell>
                    <TableCell class="text-end tabular-nums align-middle">{{ count(row.total_quantity_sold) }}</TableCell>
                    <TableCell class="text-end tabular-nums align-middle">{{ money(row.total_profit) }}</TableCell>
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
