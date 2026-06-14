<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileText,
  Loader2,
  Package,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StocktakingCountItem, StocktakingReviewItem } from '@/stores/stocktakingOrders'
import { useStocktakingOrdersStore } from '@/stores/stocktakingOrders'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const route = useRoute()
const { t, locale } = useI18n()
const { can } = usePermissions()
const { getErrorMessage } = useApiError()
const stocktakingOrdersStore = useStocktakingOrdersStore()

const orderId = computed(() => String(route.params.id))
const canView = computed(() => can('stocktaking.view'))

const loading = computed(() => stocktakingOrdersStore.detailLoading)
const detail = computed(() => stocktakingOrdersStore.detailState)

const loadError = ref('')
const notAuthorized = ref(false)

const isInProgress = computed(() => detail.value?.status === 'in_progress')
const isPendingOrCompleted = computed(() =>
  detail.value?.status === 'pending_review' || detail.value?.status === 'completed',
)

const statusBadgeClass = computed(() => {
  switch (detail.value?.status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'in_progress': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'pending_review': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
    default: return ''
  }
})

const warehouseLabel = computed(() => {
  const state = detail.value
  if (!state) return '—'
  return locale.value === 'ar'
    ? (state.warehouse_name_ar || state.warehouse_name_en || '—')
    : (state.warehouse_name_en || state.warehouse_name_ar || '—')
})

const typeLabel = computed(() => {
  const state = detail.value
  if (!state) return '—'
  if (state.type_label) return state.type_label
  if (state.type === 'full') return t('stocktaking_orders_page.type_full')
  if (state.type === 'partial') return t('stocktaking_orders_page.type_partial')
  return state.type || '—'
})

const statusLabelText = computed(() => {
  const state = detail.value
  if (!state) return '—'
  const key = `stocktaking_orders_page.status_${state.status}` as const
  const translated = t(key)
  return translated === key ? (state.status_label || state.status || '—') : translated
})

const countersLabel = computed(() => {
  const counters = detail.value?.counters ?? []
  if (!counters.length) return '—'
  const sep = locale.value === 'ar' ? '، ' : ', '
  return counters.map(counter => counter.name).join(sep)
})

const progressPercentage = computed(() =>
  Math.min(100, Math.max(0, detail.value?.counting.progress_percentage ?? 0)),
)

const fmtDate = (value?: string) => formatDisplayDate(value)
const fmtDateTime = (value?: string | null) => formatDisplayDate(value, { withTime: true })

const productDisplayName = (item: StocktakingCountItem): string => {
  if (locale.value === 'ar') return item.product_name_ar || item.product_name_en || `#${item.product_id}`
  return item.product_name_en || item.product_name_ar || `#${item.product_id}`
}

const countStatusLabel = (item: StocktakingCountItem): string => {
  if (item.count_status === 'done' || item.counted_quantity != null) {
    return t('stocktaking_show_page.count_status_done')
  }
  return t('stocktaking_show_page.count_status_in_progress')
}

const countStatusVariant = (item: StocktakingCountItem): 'default' | 'outline' => {
  if (item.count_status === 'done' || item.counted_quantity != null) return 'default'
  return 'outline'
}

const hasVariance = (item: StocktakingReviewItem): boolean => item.variance !== 0

const varianceText = (item: StocktakingReviewItem): string => {
  if (!hasVariance(item)) return t('stocktaking_show_page.matched')
  if (item.variance > 0) return `${t('stocktaking_show_page.variance_surplus')} (+${item.variance})`
  return `${t('stocktaking_show_page.variance_shortage')} (${item.variance})`
}

const varianceClass = (item: StocktakingReviewItem): string => {
  if (!hasVariance(item)) return 'text-muted-foreground'
  if (item.variance > 0) return 'font-medium text-emerald-700'
  return 'font-medium text-red-600'
}

const rowHighlightClass = (item: StocktakingReviewItem): string => {
  if (!hasVariance(item)) return ''
  if (item.variance > 0) return 'bg-emerald-50/60'
  return 'bg-red-50/60'
}

const decisionLabel = (item: StocktakingReviewItem): string => {
  if (item.decision === 'accepted') return t('stocktaking_show_page.decision_accepted')
  if (item.decision === 'rejected') return t('stocktaking_show_page.decision_rejected')
  if (item.decision === 'recount_requested') return t('stocktaking_show_page.decision_recount_requested')
  if (!hasVariance(item)) return t('stocktaking_show_page.decision_matched')
  return t('stocktaking_show_page.decision_pending')
}

const loadDetail = async () => {
  if (!canView.value) {
    notAuthorized.value = true
    return
  }
  loadError.value = ''
  notAuthorized.value = false
  try {
    await stocktakingOrdersStore.getOrderDetail(orderId.value)
  }
  catch (error: unknown) {
    const err = error as { response?: { status?: number }; statusCode?: number; status?: number }
    const status = err?.response?.status ?? err?.statusCode ?? err?.status
    if (status === 403) {
      notAuthorized.value = true
      return
    }
    loadError.value = getErrorMessage(error) || t('stocktaking_show_page.load_error')
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="shrink-0" as-child>
        <NuxtLink to="/stocktaking-orders">
          <ArrowRight class="size-5 rtl:rotate-180" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('stocktaking_show_page.title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('stocktaking_show_page.subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="!canView || notAuthorized"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {{ t('stocktaking_show_page.not_authorized') }}
    </div>

    <div
      v-else-if="loadError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div v-else-if="loading && !detail" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="detail">
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
          <FileText class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_show_page.section_order_details') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.reference_id') }}</p>
            <p class="text-sm font-medium">{{ detail.reference_id || `#${detail.id}` }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.warehouse') }}</p>
            <p class="text-sm font-medium">{{ warehouseLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.stocktaking_type') }}</p>
            <p class="text-sm font-medium">{{ typeLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.stocktaking_date') }}</p>
            <p class="text-sm font-medium tabular-nums">{{ fmtDate(detail.stocktaking_date) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.status') }}</p>
            <Badge variant="outline" :class="statusBadgeClass">{{ statusLabelText }}</Badge>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.show_registered_quantities') }}</p>
            <p class="text-sm font-medium">
              {{ detail.show_registered_quantities ? t('stocktaking_show_page.on') : t('stocktaking_show_page.off') }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.assigned_counters') }}</p>
            <p class="text-sm font-medium">{{ countersLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.created_by') }}</p>
            <p class="text-sm font-medium">{{ detail.created_by?.name || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.creation_date') }}</p>
            <p class="text-sm font-medium tabular-nums">{{ fmtDateTime(detail.created_at) }}</p>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.notes') }}</p>
            <p class="text-sm font-medium whitespace-pre-line">{{ detail.notes || '—' }}</p>
          </div>
        </CardContent>
      </Card>

      <Card v-if="isInProgress" class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <ClipboardList class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_show_page.section_counting_progress') }}</h2>
        </div>
        <CardContent class="space-y-4 px-0 py-0">
          <div class="px-4 pt-5 sm:px-6">
            <div class="flex items-center gap-3">
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-300"
                  :style="{ width: `${progressPercentage}%` }"
                />
              </div>
              <span class="text-sm font-medium tabular-nums shrink-0">{{ progressPercentage }}%</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ t('stocktaking_show_page.progress_summary', {
                counted: detail.counting.counted_items,
                total: detail.counting.total_items,
              }) }}
            </p>
          </div>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_show_page.col_product') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_show_page.col_variation') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_show_page.col_sku') }}</TableHead>
                  <TableHead class="min-w-[110px] text-start">{{ t('stocktaking_show_page.col_counted_quantity') }}</TableHead>
                  <TableHead class="min-w-[140px] text-start">{{ t('stocktaking_show_page.col_counted_by') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_show_page.col_status') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!detail.counting.items.length">
                  <TableCell :colspan="6" class="py-10 text-center text-sm text-muted-foreground">
                    {{ t('stocktaking_show_page.no_items') }}
                  </TableCell>
                </TableRow>
                <TableRow v-for="item in detail.counting.items" :key="item.id" class="align-middle">
                  <TableCell class="text-sm font-medium">{{ productDisplayName(item) }}</TableCell>
                  <TableCell class="text-sm">{{ item.variation_label || '—' }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ item.sku || '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.counted_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm">{{ item.counted_by?.name || '—' }}</TableCell>
                  <TableCell>
                    <Badge :variant="countStatusVariant(item)">{{ countStatusLabel(item) }}</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card v-if="isPendingOrCompleted" class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_show_page.section_variance_results') }}</h2>
        </div>
        <CardContent class="space-y-4 px-0 py-0">
          <div class="grid gap-4 px-4 pt-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
            <div>
              <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.summary_total_products') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ detail.variance.summary.total_products }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.summary_matched') }}</p>
              <p class="text-lg font-semibold tabular-nums text-muted-foreground">{{ detail.variance.summary.matched }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.summary_surplus') }}</p>
              <p class="text-lg font-semibold tabular-nums text-emerald-700">{{ detail.variance.summary.surplus }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.summary_shortage') }}</p>
              <p class="text-lg font-semibold tabular-nums text-red-600">{{ detail.variance.summary.shortage }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('stocktaking_show_page.summary_pending_decision') }}</p>
              <p class="text-lg font-semibold tabular-nums">{{ detail.variance.summary.pending_decision }}</p>
            </div>
          </div>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_show_page.col_product') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_show_page.col_variation') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_show_page.col_sku') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_show_page.col_system_quantity') }}</TableHead>
                  <TableHead class="min-w-[110px] text-start">{{ t('stocktaking_show_page.col_snapshot_quantity') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_show_page.col_counted_quantity') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_show_page.col_variance') }}</TableHead>
                  <TableHead class="min-w-[140px] text-start">{{ t('stocktaking_show_page.col_counted_by') }}</TableHead>
                  <TableHead class="min-w-[140px] text-start">{{ t('stocktaking_show_page.col_decision') }}</TableHead>
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_show_page.col_reviewer_note') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!detail.variance.items.length">
                  <TableCell :colspan="10" class="py-10 text-center text-sm text-muted-foreground">
                    {{ t('stocktaking_show_page.no_items') }}
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="item in detail.variance.items"
                  :key="item.id"
                  :class="['align-middle', rowHighlightClass(item)]"
                >
                  <TableCell class="text-sm font-medium">{{ productDisplayName(item) }}</TableCell>
                  <TableCell class="text-sm">{{ item.variation_label || '—' }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ item.sku || '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.system_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.snapshot_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.counted_quantity ?? '—' }}</TableCell>
                  <TableCell :class="['text-sm tabular-nums', varianceClass(item)]">
                    <Badge v-if="!hasVariance(item)" variant="secondary">{{ varianceText(item) }}</Badge>
                    <span v-else>{{ varianceText(item) }}</span>
                  </TableCell>
                  <TableCell class="text-sm">{{ item.counted_by?.name || '—' }}</TableCell>
                  <TableCell class="text-sm">{{ decisionLabel(item) }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ item.reviewer_note || '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Activity class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_show_page.section_activity_log') }}</h2>
        </div>
        <CardContent class="px-4 py-5 sm:px-6">
          <p v-if="!detail.activities.length" class="py-6 text-center text-sm text-muted-foreground">
            {{ t('stocktaking_show_page.no_activities') }}
          </p>
          <ol v-else class="relative space-y-4 border-s ps-6">
            <li v-for="activity in detail.activities" :key="activity.id" class="relative">
              <span class="absolute -start-[1.6rem] top-1 size-3 rounded-full bg-primary ring-4 ring-background" />
              <p class="text-sm font-medium">{{ activity.action || '—' }}</p>
              <p class="text-xs text-muted-foreground">
                {{ activity.user?.name || '—' }} · {{ fmtDateTime(activity.created_at) }}
              </p>
            </li>
          </ol>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
