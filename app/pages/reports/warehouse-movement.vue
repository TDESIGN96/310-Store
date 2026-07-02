<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePickerInput } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import ReportMultiSelect from '@/components/reports/ReportMultiSelect.vue'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'
import type { WarehouseMovementRecord, WarehouseMovementType } from '@/stores/reports'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'
import { fetchAllProductsPages } from '@/utils/productList'
import {
  isFromAfterToPickerDate,
  isFuturePickerDate,
  toIsoDateTimeEnd,
  toIsoDateTimeStart,
} from '@/utils/reportDateFilters'
import { warehouseMovementReferencePath } from '@/utils/warehouseMovementReferencePath'

definePageMeta({ layout: 'default' })

interface ProductOption {
  id: number
  name_ar: string
  name_en: string
}

const MOVEMENT_TYPES: WarehouseMovementType[] = ['all', 'in', 'out']

const { t, locale } = useI18n()
const authStore = useAuthStore()
const { can } = usePermissions()
const { $api } = useApi()
const { loadActiveWarehouses } = useInvoiceWarehouses()
const reportsStore = useReportsStore()
const { getErrorMessage } = useApiError()

const canViewReports = computed(() => can('reports.index') || can('reports.show'))

const dateFrom = ref('')
const dateTo = ref('')
const selectedWarehouseId = ref<number | null>(null)
const movementType = ref<WarehouseMovementType>('all')
const selectedProductIds = ref<number[]>([])
const warehouseOptions = ref<InvoiceWarehouseOption[]>([])
const productOptions = ref<ProductOption[]>([])
const fieldErrors = ref({ warehouse_id: '', from_date: '', to_date: '' })
const currentPage = ref(1)

const loading = computed(() => reportsStore.warehouseMovementLoading)
const generated = computed(() => reportsStore.warehouseMovementGenerated)
const summary = computed(() => reportsStore.warehouseMovementSummary)
const records = computed(() => reportsStore.warehouseMovementRecords)
const pagination = computed(() => reportsStore.warehouseMovementPagination)

const count = (value: unknown) => formatDisplayNumber(value)

const localizedName = (entity: { name_ar?: string, name_en?: string } | null) => {
  if (!entity) return '—'
  return locale.value === 'ar'
    ? (entity.name_ar || entity.name_en || '—')
    : (entity.name_en || entity.name_ar || '—')
}

const warehouseLabel = (warehouse: InvoiceWarehouseOption) =>
  localizedName(warehouse) || `#${warehouse.id}`

const productSelectItems = computed(() =>
  productOptions.value.map(p => ({
    id: p.id,
    label: localizedName(p) || `#${p.id}`,
  })),
)

const movementTypeLabel = (type: WarehouseMovementType) => {
  if (type === 'in') return t('reports_warehouse_movement.filter_movement_type_in')
  if (type === 'out') return t('reports_warehouse_movement.filter_movement_type_out')
  return t('reports_warehouse_movement.filter_movement_type_all')
}

const rowMovementTypeLabel = (row: WarehouseMovementRecord) => {
  const label = String(row.movement_type?.label ?? '').trim()
  if (label) return label
  const value = String(row.movement_type?.value ?? '').toLowerCase()
  if (value === 'in') return t('reports_warehouse_movement.filter_movement_type_in')
  if (value === 'out') return t('reports_warehouse_movement.filter_movement_type_out')
  return '—'
}

const rowSourceLabel = (row: WarehouseMovementRecord) => {
  const label = String(row.source?.label ?? '').trim()
  return label || '—'
}

const referencePath = (row: WarehouseMovementRecord) =>
  warehouseMovementReferencePath(row.reference)

const executedByPath = (row: WarehouseMovementRecord) => {
  const userId = row.executed_by?.id
  if (!userId) return null
  return authStore.user?.id === userId ? '/profile' : `/users/show/${userId}`
}

const validateFilters = (): boolean => {
  fieldErrors.value = { warehouse_id: '', from_date: '', to_date: '' }
  let valid = true

  if (!selectedWarehouseId.value) {
    fieldErrors.value.warehouse_id = t('reports_warehouse_movement.validation_warehouse_required')
    valid = false
  }
  if (!dateFrom.value.trim()) {
    fieldErrors.value.from_date = t('reports_warehouse_movement.validation_from_required')
    valid = false
  }
  if (!dateTo.value.trim()) {
    fieldErrors.value.to_date = t('reports_warehouse_movement.validation_to_required')
    valid = false
  }
  if (dateFrom.value.trim() && dateTo.value.trim() && isFromAfterToPickerDate(dateFrom.value, dateTo.value)) {
    fieldErrors.value.from_date = t('reports_warehouse_movement.validation_from_after_to')
    valid = false
  }
  if (dateTo.value.trim() && isFuturePickerDate(dateTo.value)) {
    fieldErrors.value.to_date = t('reports_warehouse_movement.validation_to_future')
    valid = false
  }

  return valid
}

const canGenerate = computed(() => {
  if (!selectedWarehouseId.value) return false
  if (!dateFrom.value.trim() || !dateTo.value.trim()) return false
  if (isFromAfterToPickerDate(dateFrom.value, dateTo.value)) return false
  if (isFuturePickerDate(dateTo.value)) return false
  return true
})

const buildQueryParams = (page = currentPage.value) => {
  const fromIso = toIsoDateTimeStart(dateFrom.value)
  const toIso = toIsoDateTimeEnd(dateTo.value)
  if (!fromIso || !toIso || !selectedWarehouseId.value) return null

  return {
    from_date: fromIso,
    to_date: toIso,
    warehouse_id: selectedWarehouseId.value,
    movement_type: movementType.value,
    product_ids: selectedProductIds.value.length ? selectedProductIds.value : undefined,
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
    await reportsStore.loadWarehouseMovement(params)
  }
  catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const resetFilters = () => {
  dateFrom.value = ''
  dateTo.value = ''
  selectedWarehouseId.value = null
  movementType.value = 'all'
  selectedProductIds.value = []
  fieldErrors.value = { warehouse_id: '', from_date: '', to_date: '' }
  currentPage.value = 1
  reportsStore.resetWarehouseMovement()
}

const goToPage = async (page: number) => {
  if (page < 1 || page > pagination.value.last_page || loading.value) return
  await generateReport(page)
}

const loadProductOptions = async () => {
  const list = await fetchAllProductsPages<ProductOption>($api, { status: 'active' })
  productOptions.value = list.filter(p =>
    String((p as ProductOption & { status?: string }).status ?? 'active').toLowerCase() !== 'deleted',
  )
}

onMounted(async () => {
  if (!canViewReports.value) return
  const [warehouses] = await Promise.all([
    loadActiveWarehouses(),
    loadProductOptions(),
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
      <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_warehouse_movement.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('reports_warehouse_movement.subtitle') }}</p>
    </div>

    <div
      v-if="!canViewReports"
      class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('reports_warehouse_movement.no_permission') }}
    </div>

    <template v-else>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('reports_warehouse_movement.generate_report') }}</h2>
        </div>
        <CardContent class="space-y-4 px-4 py-5 sm:px-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_warehouse_movement.filter_warehouse') }} <span class="text-red-500">*</span>
              </label>
              <Select
                :model-value="selectedWarehouseId ? String(selectedWarehouseId) : ''"
                @update:model-value="(val) => { selectedWarehouseId = val ? Number(val) : null; fieldErrors.warehouse_id = '' }"
              >
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="t('reports_warehouse_movement.filter_warehouse_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="warehouse in warehouseOptions"
                    :key="warehouse.id"
                    :value="String(warehouse.id)"
                  >
                    {{ warehouseLabel(warehouse) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="fieldErrors.warehouse_id" class="text-xs text-red-600">{{ fieldErrors.warehouse_id }}</p>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_warehouse_movement.filter_from_date') }} <span class="text-red-500">*</span>
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
                {{ t('reports_warehouse_movement.filter_to_date') }} <span class="text-red-500">*</span>
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
                {{ t('reports_warehouse_movement.filter_movement_type') }}
              </label>
              <Select
                :model-value="movementType"
                @update:model-value="(val) => { movementType = (val as WarehouseMovementType) || 'all' }"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="type in MOVEMENT_TYPES"
                    :key="type"
                    :value="type"
                  >
                    {{ movementTypeLabel(type) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-muted-foreground">
                {{ t('reports_warehouse_movement.filter_product') }}
              </label>
              <ReportMultiSelect
                v-model="selectedProductIds"
                :items="productSelectItems"
                :placeholder="t('reports_warehouse_movement.filter_product')"
                :all-label="t('reports_warehouse_movement.filter_product_all')"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              @click="resetFilters"
            >
              {{ t('reports_warehouse_movement.reset_filters') }}
            </Button>
            <Button
              :disabled="!canGenerate || loading"
              @click="generateReport(1)"
            >
              <Loader2 v-if="loading" class="me-2 size-4 animate-spin" />
              {{ t('reports_warehouse_movement.generate_report') }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-if="generated">
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
            <h2 class="text-base font-semibold">{{ t('reports_warehouse_movement.records_title') }}</h2>
          </div>
          <CardContent class="px-0 py-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="font-medium">{{ t('reports_warehouse_movement.col_date') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_warehouse_movement.col_movement_type') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_warehouse_movement.col_source') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_warehouse_movement.col_reference') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_warehouse_movement.col_product_name') }}</TableHead>
                    <TableHead class="font-medium text-end">{{ t('reports_warehouse_movement.col_quantity') }}</TableHead>
                    <TableHead class="font-medium">{{ t('reports_warehouse_movement.col_executed_by') }}</TableHead>
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
                      {{ t('reports_warehouse_movement.empty_records') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="row in records"
                    :key="row.key"
                  >
                    <TableCell class="tabular-nums">{{ formatDisplayDate(row.date) }}</TableCell>
                    <TableCell>{{ rowMovementTypeLabel(row) }}</TableCell>
                    <TableCell>{{ rowSourceLabel(row) }}</TableCell>
                    <TableCell>
                      <NuxtLink
                        v-if="referencePath(row) && row.reference?.number"
                        :to="referencePath(row)!"
                        class="font-medium text-primary hover:underline"
                      >
                        {{ row.reference.number }}
                      </NuxtLink>
                      <span v-else>{{ row.reference?.number || '—' }}</span>
                    </TableCell>
                    <TableCell class="font-medium">{{ localizedName(row.product) }}</TableCell>
                    <TableCell class="text-end tabular-nums">{{ count(row.quantity) }}</TableCell>
                    <TableCell>
                      <NuxtLink
                        v-if="executedByPath(row) && row.executed_by?.name"
                        :to="executedByPath(row)!"
                        class="font-medium text-primary hover:underline"
                      >
                        {{ row.executed_by.name }}
                      </NuxtLink>
                      <span v-else>{{ row.executed_by?.name || '—' }}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div class="grid gap-4 border-t bg-muted/20 px-4 py-4 sm:grid-cols-3 sm:px-6">
              <div>
                <p class="text-xs text-muted-foreground">{{ t('reports_warehouse_movement.summary_total_in') }}</p>
                <p class="text-lg font-semibold tabular-nums">{{ count(summary.total_in) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ t('reports_warehouse_movement.summary_total_out') }}</p>
                <p class="text-lg font-semibold tabular-nums">{{ count(summary.total_out) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">{{ t('reports_warehouse_movement.summary_net_movement') }}</p>
                <p class="text-lg font-semibold tabular-nums">{{ count(summary.net_movement) }}</p>
              </div>
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
