<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowRight, FileSpreadsheet, FileText, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import ReportStringMultiSelect from '@/components/reports/ReportStringMultiSelect.vue'
import type { ReportStringMultiSelectItem } from '@/components/reports/ReportStringMultiSelect.vue'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import type { DamageAnalysisReason, DamageAnalysisReasonValue } from '@/stores/reports'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'
import {
  isFromAfterToPickerDate,
  isFuturePickerDate,
  toIsoDateTimeEnd,
  toIsoDateTimeStart,
} from '@/utils/reportDateFilters'
import { reportViewPermission } from '@/config/reportPermissions'

definePageMeta({ layout: 'default' })

const DAMAGE_REASONS: Array<{ value: DamageAnalysisReasonValue, labelKey: string }> = [
  { value: 'manufacturing_defect', labelKey: 'damage_records_page.reason_manufacturing_defect' },
  { value: 'storage_damage', labelKey: 'damage_records_page.reason_storage_damage' },
  { value: 'transport_damage', labelKey: 'damage_records_page.reason_transport_damage' },
  { value: 'expired_material', labelKey: 'damage_records_page.reason_expired_material' },
  { value: 'customer_return_damaged', labelKey: 'damage_records_page.reason_customer_return_damaged' },
  { value: 'other', labelKey: 'damage_records_page.reason_other' },
]

const REASON_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  DAMAGE_REASONS.map(r => [r.value, r.labelKey]),
)

const { t, locale } = useI18n()
const { can } = usePermissions()
const { loadActiveWarehouses } = useInvoiceWarehouses()
const reportsStore = useReportsStore()
const { getErrorMessage } = useApiError()
const { exportingExcel, exportingPdf, exportExcel, exportPdf } = useReportExport('damage-analysis')

const canViewReports = computed(() => can('reports.index') || can('reports.show') || can(reportViewPermission('damage-analysis')))

const dateFrom = ref('')
const dateTo = ref('')
const selectedWarehouseIds = ref<number[]>([])
const selectedReasons = ref<DamageAnalysisReasonValue[]>([])
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const fieldErrors = ref({ from_date: '', to_date: '' })
const currentPage = ref(1)

const loading = computed(() => reportsStore.damageAnalysisLoading)
const generated = computed(() => reportsStore.damageAnalysisGenerated)
const summary = computed(() => reportsStore.damageAnalysisSummary)
const records = computed(() => reportsStore.damageAnalysisRecords)
const pagination = computed(() => reportsStore.damageAnalysisPagination)

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

const reasonSelectItems = computed<ReportStringMultiSelectItem[]>(() =>
  DAMAGE_REASONS.map(r => ({
    value: r.value,
    label: t(r.labelKey),
  })),
)

const damageReasonLabel = (reason: DamageAnalysisReason | null) => {
  if (!reason) return '—'
  const value = String(reason.value ?? '')
  const specified = String(reason.specified ?? '').trim()
  if (value === 'other' && specified) return specified
  if (locale.value === 'ar') {
    if (reason.label_ar) return reason.label_ar
    return REASON_LABEL_KEYS[value] ? t(REASON_LABEL_KEYS[value]) : value || '—'
  }
  if (reason.label_en) return reason.label_en
  return REASON_LABEL_KEYS[value] ? t(REASON_LABEL_KEYS[value]) : value || '—'
}

const validateFilters = (): boolean => {
  fieldErrors.value = { from_date: '', to_date: '' }
  let valid = true

  if (!dateFrom.value.trim()) {
    fieldErrors.value.from_date = t('reports_damage_analysis.validation_from_required')
    valid = false
  }
  if (!dateTo.value.trim()) {
    fieldErrors.value.to_date = t('reports_damage_analysis.validation_to_required')
    valid = false
  }
  if (dateFrom.value.trim() && dateTo.value.trim() && isFromAfterToPickerDate(dateFrom.value, dateTo.value)) {
    fieldErrors.value.from_date = t('reports_damage_analysis.validation_from_after_to')
    valid = false
  }
  if (dateTo.value.trim() && isFuturePickerDate(dateTo.value)) {
    fieldErrors.value.to_date = t('reports_damage_analysis.validation_to_future')
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
    reasons: selectedReasons.value.length ? selectedReasons.value : undefined,
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
    await reportsStore.loadDamageAnalysis(params)
  }
  catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const resetFilters = () => {
  dateFrom.value = ''
  dateTo.value = ''
  selectedWarehouseIds.value = []
  selectedReasons.value = []
  fieldErrors.value = { from_date: '', to_date: '' }
  currentPage.value = 1
  reportsStore.resetDamageAnalysis()
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

onMounted(async () => {
  if (!canViewReports.value) return
  warehouseOptions.value = await loadActiveWarehouses()
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
      <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_damage_analysis.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('reports_damage_analysis.subtitle') }}</p>
    </div>

    <div
      v-if="!canViewReports"
      class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('reports_damage_analysis.no_permission') }}
    </div>

    <template v-else>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('reports_damage_analysis.generate_report') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_damage_analysis.filter_from_date') }} <span class="text-red-500">*</span>
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
                {{ t('reports_damage_analysis.filter_to_date') }} <span class="text-red-500">*</span>
              </label>
              <DatePickerInput
                v-model="dateTo"
                class="w-full"
                @update:model-value="fieldErrors.to_date = ''"
              />
              <p v-if="fieldErrors.to_date" class="text-xs text-red-600">{{ fieldErrors.to_date }}</p>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_damage_analysis.filter_warehouse') }}
              </label>
              <WarehouseMultiSelect
                v-model="selectedWarehouseIds"
                :warehouses="warehouseOptions"
                :placeholder="t('reports_damage_analysis.filter_warehouse')"
                :all-label="t('reports_damage_analysis.filter_warehouse_all')"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_damage_analysis.filter_reason') }}
              </label>
              <ReportStringMultiSelect
                v-model="selectedReasons"
                :items="reasonSelectItems"
                :placeholder="t('reports_damage_analysis.filter_reason')"
                :all-label="t('reports_damage_analysis.filter_reason_all')"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              @click="resetFilters"
            >
              {{ t('reports_damage_analysis.reset_filters') }}
            </Button>
            <Button
              :disabled="!canGenerate || loading"
              @click="generateReport(1)"
            >
              <Loader2 v-if="loading" class="me-2 size-4 animate-spin" />
              {{ t('reports_damage_analysis.generate_report') }}
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
          <div class="flex items-center gap-2 border-b bg-section-items border-section-items px-4 py-3.5 text-white sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_damage_analysis.summary_title') }}</h2>
          </div>
          <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_damage_analysis.summary_total_damaged_items') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ count(summary.total_damaged_items) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_damage_analysis.summary_total_financial_loss') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ money(summary.total_financial_loss) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_damage_analysis.summary_total_inventory_value') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ money(summary.total_inventory_value) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('reports_damage_analysis.summary_damage_rate') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ formatPercent(summary.damage_rate) }}</p>
            </div>
          </CardContent>
        </Card>

        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_damage_analysis.records_title') }}</h2>
          </div>
          <CardContent class="px-0 py-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="font-medium">{{ t('reports_damage_analysis.col_product_name') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_damage_analysis.col_warehouse') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_damage_analysis.col_damage_reason') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_damage_analysis.col_damaged_quantity') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_damage_analysis.col_cost_price') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_damage_analysis.col_financial_loss') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_damage_analysis.col_percentage_of_total_loss') }}</TableHead>
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
                      {{ t('reports_damage_analysis.empty_records') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="row in records"
                    :key="row.key"
                  >
                    <TableCell class="font-medium">{{ localizedName(row.product) }}</TableCell>
                    <TableCell>{{ localizedName(row.warehouse) }}</TableCell>
                    <TableCell>{{ damageReasonLabel(row.reason) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ count(row.damaged_quantity) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.cost_price) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.financial_loss) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ formatPercent(row.percentage_of_total_loss) }}</TableCell>
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
