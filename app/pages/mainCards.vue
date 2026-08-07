<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { Component } from 'vue'
import { ArrowRight, FilePlus2, Loader2, Receipt, ShoppingBag, Wallet } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/stores/auth'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber, formatDisplayGrandTotal } from '@/utils/formatDisplayNumber'
import {
  REPORT_DATE_PRESETS,
  getReportDatePresetRange,
  toIsoDateTimeEnd,
  toIsoDateTimeStart,
  type ReportDatePresetId,
} from '@/utils/reportDateFilters'

definePageMeta({
  layout: 'default',
})

interface DashboardMetricResponse {
  status?: string
  status_code?: number
  data?: {
    filters?: {
      from_date?: string | null
      to_date?: string | null
    }
    value?: number | string | null
  }
  message?: string | null
}

type MetricId = 'invoices_count' | 'invoices_value' | 'expenses_value'
type RecentTab = 'invoices' | 'transport'

interface MetricState {
  id: MetricId
  path: string
  titleKey: string
  hintKey: string
  format: 'count' | 'money'
  icon: Component
  iconWrapClass: string
  preset: ReportDatePresetId
  value: number
  loading: boolean
  loaded: boolean
  error: string
}

interface RecentInvoiceRow {
  id: number
  reference_number: string
  customer_name: string
  invoice_date: string
  grand_total: number
  status: string
  status_label: string
}

const { t, locale } = useI18n()
const { $api } = useApi()
const { canAccess, canCreate } = usePermissions()
const { getErrorMessage } = useApiError()
const authStore = useAuthStore()
const { navigateRow } = useMobileRowNavigate()

const canCreateInvoice = computed(() => canCreate('invoices'))
const canShowInvoices = computed(() => canAccess('invoices'))

const isAdmin = computed(() => {
  const me = authStore.user as { is_admin?: boolean; role?: string } | null
  if (!me) return false
  if (me.is_admin === true) return true
  const role = String(me.role ?? '').toLowerCase()
  return role === 'admin' || role === 'super_admin' || role.includes('admin')
})

const PRESET_LABEL_KEYS: Record<ReportDatePresetId, string> = {
  today: 'reports_filters.preset_today',
  yesterday: 'reports_filters.preset_yesterday',
  last_7_days: 'reports_filters.preset_last_7_days',
  last_30_days: 'reports_filters.preset_last_30_days',
  this_year: 'reports_filters.preset_this_year',
  previous_year: 'reports_filters.preset_previous_year',
}

const metrics = reactive<MetricState[]>([
  {
    id: 'invoices_count',
    path: '/reports/dashboard/invoices-count',
    titleKey: 'dashboard.card_finalized_count',
    hintKey: 'dashboard.card_finalized_count_hint',
    format: 'count',
    icon: Receipt,
    iconWrapClass: 'bg-emerald-500/10 text-emerald-700',
    preset: 'today',
    value: 0,
    loading: false,
    loaded: false,
    error: '',
  },
  {
    id: 'invoices_value',
    path: '/reports/dashboard/invoices-value',
    titleKey: 'dashboard.card_finalized_value',
    hintKey: 'dashboard.card_finalized_value_hint',
    format: 'money',
    icon: Wallet,
    iconWrapClass: 'bg-sky-500/10 text-sky-700',
    preset: 'today',
    value: 0,
    loading: false,
    loaded: false,
    error: '',
  },
  {
    id: 'expenses_value',
    path: '/reports/dashboard/expenses-value',
    titleKey: 'dashboard.card_expenses_value',
    hintKey: 'dashboard.card_expenses_value_hint',
    format: 'money',
    icon: ShoppingBag,
    iconWrapClass: 'bg-amber-500/10 text-amber-700',
    preset: 'today',
    value: 0,
    loading: false,
    loaded: false,
    error: '',
  },
])

const displayValue = (metric: MetricState) => {
  if (metric.format === 'money') {
    return formatDisplayGrandTotal(metric.value, { locale: locale.value })
  }
  return formatDisplayNumber(metric.value, { locale: locale.value })
}

const extractMetricValue = (response: DashboardMetricResponse): number => {
  const raw = response?.data?.value
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
}

const loadMetric = async (metric: MetricState) => {
  const range = getReportDatePresetRange(metric.preset)
  const fromIso = toIsoDateTimeStart(range.from)
  const toIso = toIsoDateTimeEnd(range.to)
  if (!fromIso || !toIso) return

  metric.loading = true
  metric.error = ''
  try {
    const response = await $api<DashboardMetricResponse>(metric.path, {
      params: {
        from_date: fromIso,
        to_date: toIso,
      },
    })
    metric.value = extractMetricValue(response)
    metric.loaded = true
  }
  catch (error: unknown) {
    metric.error = getErrorMessage(error)
    metric.loaded = false
  }
  finally {
    metric.loading = false
  }
}

const applyPreset = (metric: MetricState, preset: ReportDatePresetId) => {
  if (metric.preset === preset && metric.loaded) {
    void loadMetric(metric)
    return
  }
  metric.preset = preset
  void loadMetric(metric)
}

const loadAllMetrics = async () => {
  await Promise.all(metrics.map(metric => loadMetric(metric)))
}

const recentTab = ref<RecentTab>('invoices')
const recentLoading = ref(false)
const recentError = ref('')
const invoicesRows = ref<RecentInvoiceRow[]>([])
const transportRows = ref<RecentInvoiceRow[]>([])
const invoicesLoaded = ref(false)
const transportLoaded = ref(false)

const activeRecentRows = computed(() =>
  recentTab.value === 'invoices' ? invoicesRows.value : transportRows.value,
)

const recentShowBasePath = computed(() =>
  recentTab.value === 'invoices' ? '/invoices/show' : '/transport-invoices/show',
)

const recentModulePath = computed(() =>
  recentTab.value === 'invoices' ? '/invoices' : '/transport-invoices',
)

const recentModuleLabel = computed(() =>
  recentTab.value === 'invoices'
    ? t('dashboard.recent_go_to_invoices')
    : t('dashboard.recent_go_to_transport'),
)

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeRecentRow = (payload: Record<string, unknown>): RecentInvoiceRow | null => {
  const id = toNumber(payload.id, 0)
  if (id <= 0) return null
  return {
    id,
    reference_number: String(payload.reference_number ?? ''),
    customer_name: String(payload.customer_name ?? ''),
    invoice_date: String(payload.invoice_date ?? ''),
    grand_total: toNumber(payload.grand_total, 0),
    status: String(payload.status ?? ''),
    status_label: String(payload.status_label ?? payload.status ?? ''),
  }
}

const extractRecentRows = (payload: unknown): RecentInvoiceRow[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object'
    ? root.data as Record<string, unknown>
    : null
  const rows = (nested?.invoices ?? root.invoices ?? []) as unknown[]
  if (!Array.isArray(rows)) return []
  return rows
    .map(row => normalizeRecentRow((row ?? {}) as Record<string, unknown>))
    .filter((row): row is RecentInvoiceRow => row != null)
    .slice(0, 10)
}

const loadRecentTab = async (tab: RecentTab, force = false) => {
  if (!canShowInvoices.value) return
  if (!force) {
    if (tab === 'invoices' && invoicesLoaded.value) return
    if (tab === 'transport' && transportLoaded.value) return
  }

  recentLoading.value = true
  recentError.value = ''
  try {
    const endpoint = tab === 'invoices' ? '/v1/invoices' : '/v1/invoices/shipped'
    const response = await $api(endpoint, {
      params: {
        page: 1,
        per_page: 10,
        sort: '-created_at',
      },
    })
    const rows = extractRecentRows(response)
    if (tab === 'invoices') {
      invoicesRows.value = rows
      invoicesLoaded.value = true
    }
    else {
      transportRows.value = rows
      transportLoaded.value = true
    }
  }
  catch (error: unknown) {
    recentError.value = getErrorMessage(error)
  }
  finally {
    recentLoading.value = false
  }
}

const switchRecentTab = (tab: RecentTab) => {
  recentTab.value = tab
  recentError.value = ''
  void loadRecentTab(tab)
}

const money = (value: unknown) => formatDisplayGrandTotal(value, { locale: locale.value })
const fmtDate = (value?: string) => formatDisplayDate(value)

const statusLabel = (row: RecentInvoiceRow) => {
  if (row.status_label) return row.status_label
  if (row.status === 'issued') return t('invoices_page.status_issued')
  if (row.status === 'paid') return t('invoices_page.status_paid')
  if (row.status === 'partially_returned') return t('invoices_page.status_partially_returned')
  if (row.status === 'returned') return t('invoices_page.status_returned')
  if (row.status === 'pending') return t('invoices_page.status_pending')
  if (row.status === 'printed') return t('invoices_page.status_printed')
  if (row.status === 'ready') return t('invoices_page.status_ready')
  if (row.status === 'shipped') return t('invoices_page.status_shipped')
  if (row.status === 'delivered') return t('invoices_page.status_delivered')
  if (row.status === 'settled') return t('invoices_page.status_settled')
  if (row.status === 'in_delivery') return t('invoices_page.status_in_delivery')
  if (row.status === 'complete') return t('invoices_page.status_complete')
  return row.status || '—'
}

onMounted(() => {
  if (isAdmin.value) void loadAllMetrics()
  if (canShowInvoices.value) void loadRecentTab(recentTab.value)
})
</script>

<template>
  <div class="flex flex-col gap-6 p-1">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ t('dashboard.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('dashboard.subtitle') }}</p>
    </div>

    <section v-if="canCreateInvoice" class="space-y-3">
      <div>
        <h2 class="text-lg font-semibold">{{ t('dashboard.shortcuts_title') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('dashboard.shortcuts_subtitle') }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          to="/invoices/create"
          class="group block"
        >
          <Card class="h-full rounded-2xl border border-border/60 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
            <CardContent class="flex items-start gap-4 p-5">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <FilePlus2 class="size-6" />
              </div>
              <div class="min-w-0">
                <p class="text-base font-semibold group-hover:text-primary">
                  {{ t('dashboard.shortcut_create_invoice') }}
                </p>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ t('dashboard.shortcut_create_invoice_desc') }}
                </p>
              </div>
            </CardContent>
          </Card>
        </NuxtLink>
      </div>
    </section>

    <section v-if="isAdmin" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">{{ t('dashboard.period_stats_title') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('dashboard.period_stats_subtitle') }}</p>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <Card
          v-for="metric in metrics"
          :key="metric.id"
          class="rounded-2xl border border-border/60 shadow-sm"
        >
          <CardContent class="flex h-full flex-col gap-4 p-5">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-muted-foreground">
                {{ t(metric.titleKey) }}
              </p>
              <div
                class="flex size-10 items-center justify-center rounded-xl"
                :class="metric.iconWrapClass"
              >
                <component :is="metric.icon" class="size-5" />
              </div>
            </div>

            <div class="min-h-12">
              <div
                v-if="metric.loading && !metric.loaded"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 class="size-4 animate-spin" />
                {{ t('dashboard.loading_stats') }}
              </div>
              <p
                v-else-if="metric.error"
                class="text-sm text-red-600 dark:text-red-400"
              >
                {{ metric.error }}
              </p>
              <p
                v-else
                class="text-3xl font-bold tracking-tight tabular-nums"
                :class="metric.loading ? 'opacity-60' : ''"
              >
                {{ displayValue(metric) }}
              </p>
            </div>

            <p class="text-xs text-muted-foreground">
              {{ t(metric.hintKey) }}
            </p>

            <div class="mt-auto flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
              <Button
                v-for="presetId in REPORT_DATE_PRESETS"
                :key="`${metric.id}-${presetId}`"
                type="button"
                size="sm"
                class="h-7 px-2 text-xs"
                :variant="metric.preset === presetId ? 'default' : 'outline'"
                :disabled="metric.loading"
                @click="applyPreset(metric, presetId)"
              >
                {{ t(PRESET_LABEL_KEYS[presetId]) }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <section v-if="canShowInvoices" class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">{{ t('dashboard.recent_title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ t('dashboard.recent_subtitle') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            class="h-8"
            :variant="recentTab === 'invoices' ? 'default' : 'outline'"
            @click="switchRecentTab('invoices')"
          >
            {{ t('dashboard.recent_tab_invoices') }}
          </Button>
          <Button
            type="button"
            size="sm"
            class="h-8"
            :variant="recentTab === 'transport' ? 'default' : 'outline'"
            @click="switchRecentTab('transport')"
          >
            {{ t('dashboard.recent_tab_transport') }}
          </Button>
        </div>
      </div>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="text-start font-medium">{{ t('invoices_page.col_ref_id') }}</TableHead>
                <TableHead class="text-start font-medium">{{ t('invoices_page.col_customer') }}</TableHead>
                <TableHead class="text-start font-medium whitespace-nowrap">{{ t('invoices_page.col_invoice_date') }}</TableHead>
                <TableHead class="text-start font-medium whitespace-nowrap">{{ t('invoices_page.col_total') }}</TableHead>
                <TableHead class="text-start font-medium whitespace-nowrap">{{ t('invoices_page.col_status') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="recentLoading">
                <TableCell colspan="5" class="py-14 text-center">
                  <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 class="size-4 animate-spin" />
                    {{ t('common.loading') }}…
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-else-if="recentError">
                <TableCell colspan="5" class="py-10 text-center text-sm text-red-600 dark:text-red-400">
                  {{ recentError }}
                </TableCell>
              </TableRow>
              <TableRow v-else-if="!activeRecentRows.length">
                <TableCell colspan="5" class="py-14 text-center text-sm text-muted-foreground">
                  {{ recentTab === 'invoices' ? t('invoices_page.empty') : t('transport_invoices_page.empty') }}
                </TableCell>
              </TableRow>
              <TableRow
                v-for="row in activeRecentRows"
                :key="`${recentTab}-${row.id}`"
                class="cursor-pointer hover:bg-muted/30"
                @click="navigateRow(`${recentShowBasePath}/${row.id}`)"
              >
                <TableCell>
                  <NuxtLink
                    :to="`${recentShowBasePath}/${row.id}`"
                    class="text-sm font-medium text-[#2563eb] hover:underline"
                    @click.stop
                  >
                    {{ row.reference_number || `#${row.id}` }}
                  </NuxtLink>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ row.customer_name || '—' }}
                </TableCell>
                <TableCell class="text-sm tabular-nums">
                  {{ fmtDate(row.invoice_date) }}
                </TableCell>
                <TableCell class="text-sm tabular-nums">
                  {{ money(row.grand_total) }}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" class="font-normal">
                    {{ statusLabel(row) }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div class="flex items-center justify-end border-t px-4 py-3 sm:px-6">
          <Button
            as-child
            variant="outline"
            class="gap-2"
          >
            <NuxtLink :to="recentModulePath">
              {{ recentModuleLabel }}
              <ArrowRight class="size-4 rtl:rotate-180" />
            </NuxtLink>
          </Button>
        </div>
      </Card>
    </section>

    <div
      v-if="!canCreateInvoice && !isAdmin && !canShowInvoices"
      class="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground"
    >
      {{ t('dashboard.empty_no_access') }}
    </div>
  </div>
</template>
