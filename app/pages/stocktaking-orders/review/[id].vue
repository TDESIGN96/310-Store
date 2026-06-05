<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  Package,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { StocktakingItemDecision, StocktakingReviewItem } from '@/stores/stocktakingOrders'
import { useStocktakingOrdersStore } from '@/stores/stocktakingOrders'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { can } = usePermissions()
const { getErrorMessage } = useApiError()
const stocktakingOrdersStore = useStocktakingOrdersStore()

const orderId = computed(() => String(route.params.id))
const canReview = computed(() => can('stocktaking.review'))

const loading = computed(() => stocktakingOrdersStore.reviewLoading)
const submitting = computed(() => stocktakingOrdersStore.reviewSubmitting)
const reviewState = computed(() => stocktakingOrdersStore.reviewState)

const loadError = ref('')
const notAuthorized = ref(false)
const updatingItemId = ref<number | null>(null)
const localNotes = ref<Record<number, string>>({})
const submitDialogOpen = ref(false)
const selectedItemIds = ref<Set<number>>(new Set())
const bulkDecision = ref<StocktakingItemDecision>(null)
const bulkUpdating = ref(false)

const isPendingReview = computed(() => reviewState.value?.status === 'pending_review')
const isCompleted = computed(() => reviewState.value?.status === 'completed')
const isEditable = computed(() => isPendingReview.value)
const isReadOnly = computed(() => isCompleted.value)
const isAvailable = computed(() => isPendingReview.value || isCompleted.value)

const canSubmit = computed(() =>
  isEditable.value
  && (reviewState.value?.summary.pending_decision ?? 1) === 0
  && !submitting.value,
)

const warehouseLabel = computed(() => {
  const state = reviewState.value
  if (!state) return '—'
  return locale.value === 'ar'
    ? (state.warehouse_name_ar || state.warehouse_name_en || '—')
    : (state.warehouse_name_en || state.warehouse_name_ar || '—')
})

const typeLabel = computed(() => {
  const state = reviewState.value
  if (!state) return '—'
  if (state.type_label) return state.type_label
  if (state.type === 'full') return t('stocktaking_orders_page.type_full')
  if (state.type === 'partial') return t('stocktaking_orders_page.type_partial')
  return state.type || '—'
})

const fmtDate = (value?: string) => formatDisplayDate(value)

const productDisplayName = (item: StocktakingReviewItem): string => {
  if (locale.value === 'ar') return item.product_name_ar || item.product_name_en || `#${item.product_id}`
  return item.product_name_en || item.product_name_ar || `#${item.product_id}`
}

const hasVariance = (item: StocktakingReviewItem): boolean => item.variance !== 0

const varianceItems = computed(() =>
  (reviewState.value?.items ?? []).filter(item => item.variance !== 0),
)
const matchedItems = computed(() =>
  (reviewState.value?.items ?? []).filter(item => item.variance === 0),
)

const allVarianceSelected = computed(() =>
  varianceItems.value.length > 0
  && varianceItems.value.every(item => selectedItemIds.value.has(item.id)),
)
const someVarianceSelected = computed(() =>
  varianceItems.value.some(item => selectedItemIds.value.has(item.id)),
)
const selectAllModel = computed<boolean | 'indeterminate'>(() => {
  if (allVarianceSelected.value) return true
  if (someVarianceSelected.value) return 'indeterminate'
  return false
})
const selectedCount = computed(() => selectedItemIds.value.size)

const toggleSelectAll = (checked: boolean | 'indeterminate') => {
  if (checked === true) {
    selectedItemIds.value = new Set(varianceItems.value.map(item => item.id))
  }
  else {
    selectedItemIds.value = new Set()
  }
}

const toggleSelectItem = (itemId: number, checked: boolean | 'indeterminate') => {
  const next = new Set(selectedItemIds.value)
  if (checked === true) next.add(itemId)
  else next.delete(itemId)
  selectedItemIds.value = next
}

const varianceLabel = (item: StocktakingReviewItem): string => {
  if (!hasVariance(item)) return t('stocktaking_review_page.matched')
  if (item.variance > 0) return `${t('stocktaking_review_page.variance_surplus')} (+${item.variance})`
  return `${t('stocktaking_review_page.variance_shortage')} (${item.variance})`
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

const noteValue = (item: StocktakingReviewItem): string => {
  if (localNotes.value[item.id] !== undefined) return localNotes.value[item.id]!
  return item.reviewer_note ?? ''
}

const syncLocalNotes = () => {
  const notes: Record<number, string> = {}
  for (const item of reviewState.value?.items ?? []) {
    notes[item.id] = item.reviewer_note ?? ''
  }
  localNotes.value = notes
}

const loadReview = async () => {
  if (!canReview.value) {
    notAuthorized.value = true
    return
  }
  loadError.value = ''
  notAuthorized.value = false
  try {
    await stocktakingOrdersStore.getReview(orderId.value)
    syncLocalNotes()
  }
  catch (error: unknown) {
    const err = error as { response?: { status?: number }; statusCode?: number; status?: number }
    const status = err?.response?.status ?? err?.statusCode ?? err?.status
    if (status === 403) {
      notAuthorized.value = true
      return
    }
    loadError.value = getErrorMessage(error) || t('stocktaking_review_page.load_error')
  }
}

const updateItem = async (
  item: StocktakingReviewItem,
  decision: StocktakingItemDecision,
  reviewerNote?: string,
) => {
  if (!isEditable.value) return
  updatingItemId.value = item.id
  try {
    const note = reviewerNote !== undefined ? reviewerNote : noteValue(item)
    await stocktakingOrdersStore.updateReviewItem(orderId.value, item.id, {
      decision,
      reviewer_note: note.trim() || null,
    })
    syncLocalNotes()
    toast.success(t('stocktaking_review_page.update_success'))
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_review_page.update_error'))
  }
  finally {
    updatingItemId.value = null
  }
}

const onDecisionChange = async (item: StocktakingReviewItem, value: string) => {
  const decision = value as StocktakingItemDecision
  if (!decision) return
  await updateItem(item, decision)
}

const onNoteBlur = async (item: StocktakingReviewItem) => {
  const note = localNotes.value[item.id] ?? ''
  const existingNote = item.reviewer_note ?? ''
  if (note.trim() === existingNote.trim()) return
  if (!item.decision) return
  await updateItem(item, item.decision, note)
}

const applyBulkDecision = async () => {
  if (!isEditable.value || !bulkDecision.value || !selectedItemIds.value.size) return
  bulkUpdating.value = true
  try {
    const ids = [...selectedItemIds.value]
    for (const id of ids) {
      const item = varianceItems.value.find(row => row.id === id)
      if (!item) continue
      await stocktakingOrdersStore.updateReviewItem(orderId.value, id, {
        decision: bulkDecision.value,
        reviewer_note: noteValue(item).trim() || null,
      })
    }
    syncLocalNotes()
    selectedItemIds.value = new Set()
    bulkDecision.value = null
    toast.success(t('stocktaking_review_page.bulk_apply_success'))
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_review_page.update_error'))
  }
  finally {
    bulkUpdating.value = false
  }
}

const handleSubmit = async () => {
  if (!canSubmit.value) return
  submitDialogOpen.value = false
  try {
    const result = await stocktakingOrdersStore.submitReview(orderId.value)
    if (!result) throw new Error('SUBMIT_FAILED')
    if (result.status === 'completed') {
      toast.success(t('stocktaking_review_page.submit_success'))
      await router.push('/stocktaking-orders')
      return
    }
    toast.success(t('stocktaking_review_page.submit_recount_pending'))
    await stocktakingOrdersStore.getReview(orderId.value)
    syncLocalNotes()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_review_page.submit_error'))
  }
}

onMounted(loadReview)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="shrink-0" as-child>
          <NuxtLink to="/stocktaking-orders">
            <ArrowRight class="size-5 rtl:rotate-180" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('stocktaking_review_page.title') }}</h1>
          <p class="text-sm text-muted-foreground">{{ t('stocktaking_review_page.subtitle') }}</p>
        </div>
      </div>
      <Button
        v-if="reviewState && isEditable"
        :disabled="!canSubmit"
        @click="submitDialogOpen = true"
      >
        <Loader2 v-if="submitting" class="me-2 size-4 animate-spin" />
        {{ t('stocktaking_review_page.submit') }}
      </Button>
    </div>

    <div
      v-if="!canReview || notAuthorized"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {{ t('stocktaking_review_page.not_authorized') }}
    </div>

    <div
      v-else-if="loadError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div v-else-if="loading && !reviewState" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="reviewState">
      <div
        v-if="!isAvailable"
        class="rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      >
        {{ t('stocktaking_review_page.not_available') }}
      </div>

      <div
        v-if="isReadOnly"
        class="rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      >
        {{ t('stocktaking_review_page.read_only_completed') }}
      </div>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <ClipboardList class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_review_page.title') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.reference_id') }}</p>
            <p class="text-sm font-medium">{{ reviewState.reference_id || `#${reviewState.id}` }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.warehouse') }}</p>
            <p class="text-sm font-medium">{{ warehouseLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.stocktaking_type') }}</p>
            <p class="text-sm font-medium">{{ typeLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.stocktaking_date') }}</p>
            <p class="text-sm font-medium tabular-nums">{{ fmtDate(reviewState.stocktaking_date) }}</p>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <h2 class="text-base font-semibold">{{ t('stocktaking_review_page.variance_summary') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.summary_total_products') }}</p>
            <p class="text-lg font-semibold tabular-nums">{{ reviewState.summary.total_products }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.summary_matched') }}</p>
            <p class="text-lg font-semibold tabular-nums text-muted-foreground">{{ reviewState.summary.matched }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.summary_surplus') }}</p>
            <p class="text-lg font-semibold tabular-nums text-emerald-700">{{ reviewState.summary.surplus }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.summary_shortage') }}</p>
            <p class="text-lg font-semibold tabular-nums text-red-600">{{ reviewState.summary.shortage }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_review_page.summary_pending_decision') }}</p>
            <p class="text-lg font-semibold tabular-nums">{{ reviewState.summary.pending_decision }}</p>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex flex-col gap-3 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <div class="flex items-center gap-2">
            <Package class="size-4 text-muted-foreground" />
            <h2 class="text-base font-semibold">{{ t('stocktaking_review_page.section_variance_title') }}</h2>
            <Badge variant="outline" class="ms-1">{{ varianceItems.length }}</Badge>
          </div>
          <div
            v-if="isEditable && selectedCount > 0"
            class="flex flex-col gap-2 rounded-lg border bg-background p-2 sm:flex-row sm:items-center"
          >
            <span class="text-sm font-medium">
              {{ t('stocktaking_review_page.bulk_selected', { count: selectedCount }) }}
            </span>
            <div class="flex flex-1 items-center gap-2">
              <Select
                :model-value="bulkDecision ?? ''"
                :disabled="bulkUpdating"
                @update:model-value="value => bulkDecision = (String(value) as StocktakingItemDecision)"
              >
                <SelectTrigger class="h-9 w-full sm:max-w-[220px]">
                  <SelectValue :placeholder="t('stocktaking_review_page.bulk_decision_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">{{ t('stocktaking_review_page.decision_accept') }}</SelectItem>
                  <SelectItem value="rejected">{{ t('stocktaking_review_page.decision_reject') }}</SelectItem>
                  <SelectItem value="recount_requested">{{ t('stocktaking_review_page.decision_request_recount') }}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                :disabled="!bulkDecision || bulkUpdating"
                @click="applyBulkDecision"
              >
                <Loader2 v-if="bulkUpdating" class="me-2 size-4 animate-spin" />
                {{ t('stocktaking_review_page.bulk_apply') }}
              </Button>
            </div>
          </div>
        </div>
        <CardContent class="px-0 py-0">
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead v-if="isEditable" class="w-10 text-start">
                    <Checkbox
                      :model-value="selectAllModel"
                      :disabled="!varianceItems.length || bulkUpdating"
                      @update:model-value="toggleSelectAll"
                    />
                  </TableHead>
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_review_page.col_product') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_review_page.col_variation') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_review_page.col_sku') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_review_page.col_system_quantity') }}</TableHead>
                  <TableHead class="min-w-[110px] text-start">{{ t('stocktaking_review_page.col_snapshot_quantity') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_review_page.col_counted_quantity') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_review_page.col_variance') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_review_page.col_counted_by') }}</TableHead>
                  <TableHead class="min-w-[160px] text-start">{{ t('stocktaking_review_page.col_decision') }}</TableHead>
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_review_page.col_reviewer_note') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!varianceItems.length">
                  <TableCell :colspan="isEditable ? 11 : 10" class="py-10 text-center text-sm text-muted-foreground">
                    {{ t('stocktaking_review_page.no_variance_items') }}
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="item in varianceItems"
                  :key="item.id"
                  :class="['align-middle', rowHighlightClass(item)]"
                >
                  <TableCell v-if="isEditable" class="text-start">
                    <Checkbox
                      :model-value="selectedItemIds.has(item.id)"
                      :disabled="bulkUpdating"
                      @update:model-value="checked => toggleSelectItem(item.id, checked)"
                    />
                  </TableCell>
                  <TableCell class="text-sm font-medium">{{ productDisplayName(item) }}</TableCell>
                  <TableCell class="text-sm">{{ item.variation_label || '—' }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ item.sku || '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.system_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.snapshot_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.counted_quantity ?? '—' }}</TableCell>
                  <TableCell :class="['text-sm tabular-nums', varianceClass(item)]">{{ varianceLabel(item) }}</TableCell>
                  <TableCell class="text-sm">{{ item.counted_by?.name || '—' }}</TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Select
                        :model-value="item.decision ?? ''"
                        :disabled="!isEditable || updatingItemId === item.id || bulkUpdating"
                        @update:model-value="value => onDecisionChange(item, String(value))"
                      >
                        <SelectTrigger class="h-9 w-full min-w-[140px]">
                          <SelectValue :placeholder="t('stocktaking_review_page.decision_placeholder')" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accepted">{{ t('stocktaking_review_page.decision_accept') }}</SelectItem>
                          <SelectItem value="rejected">{{ t('stocktaking_review_page.decision_reject') }}</SelectItem>
                          <SelectItem value="recount_requested">{{ t('stocktaking_review_page.decision_request_recount') }}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Loader2
                        v-if="updatingItemId === item.id"
                        class="size-4 shrink-0 animate-spin text-muted-foreground"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      :model-value="noteValue(item)"
                      class="h-9 w-full min-w-[160px]"
                      :placeholder="t('stocktaking_review_page.reviewer_note_placeholder')"
                      :disabled="!isEditable || updatingItemId === item.id || bulkUpdating"
                      @update:model-value="value => localNotes[item.id] = String(value)"
                      @blur="onNoteBlur(item)"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <Package class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_review_page.section_matched_title') }}</h2>
          <Badge variant="outline" class="ms-1">{{ matchedItems.length }}</Badge>
        </div>
        <CardContent class="px-0 py-0">
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_review_page.col_product') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_review_page.col_variation') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_review_page.col_sku') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_review_page.col_system_quantity') }}</TableHead>
                  <TableHead class="min-w-[110px] text-start">{{ t('stocktaking_review_page.col_snapshot_quantity') }}</TableHead>
                  <TableHead class="min-w-[90px] text-start">{{ t('stocktaking_review_page.col_counted_quantity') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_review_page.col_variance') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_review_page.col_counted_by') }}</TableHead>
                  <TableHead class="min-w-[160px] text-start">{{ t('stocktaking_review_page.col_decision') }}</TableHead>
                  <TableHead class="min-w-[180px] text-start">{{ t('stocktaking_review_page.col_reviewer_note') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!matchedItems.length">
                  <TableCell :colspan="10" class="py-10 text-center text-sm text-muted-foreground">
                    {{ t('stocktaking_review_page.no_matched_items') }}
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="item in matchedItems"
                  :key="item.id"
                  class="align-middle"
                >
                  <TableCell class="text-sm font-medium">{{ productDisplayName(item) }}</TableCell>
                  <TableCell class="text-sm">{{ item.variation_label || '—' }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ item.sku || '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.system_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.snapshot_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">{{ item.counted_quantity ?? '—' }}</TableCell>
                  <TableCell class="text-sm tabular-nums">
                    <Badge variant="secondary">{{ t('stocktaking_review_page.matched') }}</Badge>
                  </TableCell>
                  <TableCell class="text-sm">{{ item.counted_by?.name || '—' }}</TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Select
                        :model-value="item.decision ?? ''"
                        :disabled="!isEditable || updatingItemId === item.id || bulkUpdating"
                        @update:model-value="value => onDecisionChange(item, String(value))"
                      >
                        <SelectTrigger class="h-9 w-full min-w-[140px]">
                          <SelectValue :placeholder="t('stocktaking_review_page.decision_placeholder')" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recount_requested">
                            {{ t('stocktaking_review_page.decision_request_recount') }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Loader2
                        v-if="updatingItemId === item.id"
                        class="size-4 shrink-0 animate-spin text-muted-foreground"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      :model-value="noteValue(item)"
                      class="h-9 w-full min-w-[160px]"
                      :placeholder="t('stocktaking_review_page.reviewer_note_placeholder')"
                      :disabled="!isEditable || updatingItemId === item.id || bulkUpdating"
                      @update:model-value="value => localNotes[item.id] = String(value)"
                      @blur="onNoteBlur(item)"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </template>

    <AlertDialog :open="submitDialogOpen" @update:open="submitDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('stocktaking_review_page.submit_confirm_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('stocktaking_review_page.submit_confirm_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="submitting">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction :disabled="submitting" @click="handleSubmit">
            <Loader2 v-if="submitting" class="me-2 size-4 animate-spin" />
            {{ t('stocktaking_review_page.submit_confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
