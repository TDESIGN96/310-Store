<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
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
import ReportMultiSelect from '@/components/reports/ReportMultiSelect.vue'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'
import {
  isFromAfterToPickerDate,
  isFuturePickerDate,
  toIsoDateTimeEnd,
  toIsoDateTimeStart,
} from '@/utils/reportDateFilters'

definePageMeta({ layout: 'default' })

interface DistributorOption {
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

const canViewReports = computed(() => can('reports.index') || can('reports.show'))

const dateFrom = ref('')
const dateTo = ref('')
const selectedWarehouseIds = ref<number[]>([])
const selectedDistributorIds = ref<number[]>([])
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const distributorOptions = ref<DistributorOption[]>([])
const fieldErrors = ref({ from_date: '', to_date: '' })
const currentPage = ref(1)

const loading = computed(() => reportsStore.distributorPerformanceLoading)
const generated = computed(() => reportsStore.distributorPerformanceGenerated)
const records = computed(() => reportsStore.distributorPerformanceRecords)
const pagination = computed(() => reportsStore.distributorPerformancePagination)

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

const distributorSelectItems = computed(() =>
  distributorOptions.value.map(d => ({
    id: d.id,
    label: localizedName(d) || `#${d.id}`,
  })),
)

const validateFilters = (): boolean => {
  fieldErrors.value = { from_date: '', to_date: '' }
  let valid = true

  if (!dateFrom.value.trim()) {
    fieldErrors.value.from_date = t('reports_distributors_performance.validation_from_required')
    valid = false
  }
  if (!dateTo.value.trim()) {
    fieldErrors.value.to_date = t('reports_distributors_performance.validation_to_required')
    valid = false
  }
  if (dateFrom.value.trim() && dateTo.value.trim() && isFromAfterToPickerDate(dateFrom.value, dateTo.value)) {
    fieldErrors.value.from_date = t('reports_distributors_performance.validation_from_after_to')
    valid = false
  }
  if (dateTo.value.trim() && isFuturePickerDate(dateTo.value)) {
    fieldErrors.value.to_date = t('reports_distributors_performance.validation_to_future')
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
    distributor_ids: selectedDistributorIds.value.length ? selectedDistributorIds.value : undefined,
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
    await reportsStore.loadDistributorPerformance(params)
  }
  catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const resetFilters = () => {
  dateFrom.value = ''
  dateTo.value = ''
  selectedWarehouseIds.value = []
  selectedDistributorIds.value = []
  fieldErrors.value = { from_date: '', to_date: '' }
  currentPage.value = 1
  reportsStore.resetDistributorPerformance()
}

const goToPage = async (page: number) => {
  if (page < 1 || page > pagination.value.last_page || loading.value) return
  await generateReport(page)
}

const loadDistributorOptions = async () => {
  const aggregated: DistributorOption[] = []
  let page = 1
  let lastPage = 1
  const maxPages = 50

  do {
    const res = await $api<{
      data?: { distributors?: unknown[], pagination?: { last_page?: number } }
      distributors?: unknown[]
      pagination?: { last_page?: number }
    }>('/distributors', { params: { page, per_page: 100 } })

    const listRaw = res.data?.distributors ?? res.distributors ?? []
    for (const item of listRaw) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      if (!row.id) continue
      aggregated.push({
        id: Number(row.id),
        name_ar: String(row.name_ar ?? ''),
        name_en: String(row.name_en ?? ''),
      })
    }

    lastPage = res.data?.pagination?.last_page ?? res.pagination?.last_page ?? 1
    page++
  } while (page <= lastPage && page <= maxPages)

  distributorOptions.value = aggregated
}

onMounted(async () => {
  if (!canViewReports.value) return
  const [warehouses] = await Promise.all([
    loadActiveWarehouses(),
    loadDistributorOptions(),
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
      <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_distributors_performance.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('reports_distributors_performance.subtitle') }}</p>
    </div>

    <div
      v-if="!canViewReports"
      class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('reports_distributors_performance.no_permission') }}
    </div>

    <template v-else>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('reports_distributors_performance.generate_report') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_distributors_performance.filter_from_date') }} <span class="text-red-500">*</span>
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
                {{ t('reports_distributors_performance.filter_to_date') }} <span class="text-red-500">*</span>
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
                {{ t('reports_distributors_performance.filter_warehouse') }}
              </label>
              <WarehouseMultiSelect
                v-model="selectedWarehouseIds"
                :warehouses="warehouseOptions"
                :placeholder="t('reports_distributors_performance.filter_warehouse')"
                :all-label="t('reports_distributors_performance.filter_warehouse_all')"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_distributors_performance.filter_distributor') }}
              </label>
              <ReportMultiSelect
                v-model="selectedDistributorIds"
                :items="distributorSelectItems"
                :placeholder="t('reports_distributors_performance.filter_distributor')"
                :all-label="t('reports_distributors_performance.filter_distributor_all')"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              @click="resetFilters"
            >
              {{ t('reports_distributors_performance.reset_filters') }}
            </Button>
            <Button
              :disabled="!canGenerate || loading"
              @click="generateReport(1)"
            >
              <Loader2 v-if="loading" class="me-2 size-4 animate-spin" />
              {{ t('reports_distributors_performance.generate_report') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-if="generated">
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_distributors_performance.records_title') }}</h2>
          </div>
          <CardContent class="px-0 py-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="font-medium">{{ t('reports_distributors_performance.col_distributor_name') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_distributors_performance.col_total_invoices') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_distributors_performance.col_total_sales') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_distributors_performance.col_total_returns') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_distributors_performance.col_return_rate') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_distributors_performance.col_net_sales') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_distributors_performance.col_average_order_value') }}</TableHead>
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
                      {{ t('reports_distributors_performance.empty_records') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="row in records"
                    :key="row.key"
                  >
                    <TableCell class="font-medium">{{ localizedName(row.distributor) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ count(row.total_invoices) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.total_sales) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.total_returns) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ formatPercent(row.return_rate) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.net_sales) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ money(row.average_order_value) }}</TableCell>
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
