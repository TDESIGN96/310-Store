<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ArrowRight,
  Barcode,
  ClipboardList,
  Loader2,
  Maximize,
  Minimize,
  Package,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import type { StocktakingCountItem } from '@/stores/stocktakingOrders'
import { useStocktakingOrdersStore } from '@/stores/stocktakingOrders'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { can } = usePermissions()
const { getErrorMessage } = useApiError()
const authStore = useAuthStore()
const stocktakingOrdersStore = useStocktakingOrdersStore()

const orderId = computed(() => String(route.params.id))
const canCount = computed(() => can('stocktaking.count'))

const loading = computed(() => stocktakingOrdersStore.countLoading)
const saving = computed(() => stocktakingOrdersStore.countSaving)
const submitting = computed(() => stocktakingOrdersStore.countSubmitting)
const countState = computed(() => stocktakingOrdersStore.countState)

const loadError = ref('')
const notAuthorized = ref(false)
const barcodeInput = ref('')
const scanning = ref(false)
const scanNotFound = ref(false)
const highlightedItemId = ref<number | null>(null)
const dirtyItemIds = ref<Set<number>>(new Set())
const localQtyDraft = ref<Record<number, string>>({})
const updatingItemId = ref<number | null>(null)
const submitDialogOpen = ref(false)
const isFullscreen = ref(false)
const productListRef = ref<HTMLElement | null>(null)
const qtyInputRefs = ref<Record<number, HTMLInputElement | null>>({})
const BARCODE_SCAN_DEBOUNCE_MS = 1000
let barcodeScanTimer: ReturnType<typeof setTimeout> | null = null

const isInProgress = computed(() => countState.value?.status === 'in_progress')
const isReadOnly = computed(() => !isInProgress.value)
const showSystemQuantity = computed(() => Boolean(countState.value?.show_registered_quantities))

const progressPercentage = computed(() => {
  const state = countState.value
  if (!state) return 0
  return Math.min(100, Math.max(0, state.progress_percentage))
})

const progressSummary = computed(() => {
  const state = countState.value
  if (!state) return ''
  return t('stocktaking_count_page.progress_summary', {
    counted: state.counted_items,
    total: state.total_items,
  })
})

const allItemsCounted = computed(() => {
  const items = countState.value?.items ?? []
  if (!items.length) return false
  return items.every(item => item.counted_quantity != null)
})

const canSaveProgress = computed(() =>
  canCount.value && isInProgress.value && !saving.value && !submitting.value,
)

const canSubmit = computed(() =>
  canCount.value && isInProgress.value && allItemsCounted.value && !saving.value && !submitting.value,
)

const warehouseLabel = computed(() => {
  const state = countState.value
  if (!state) return '—'
  return locale.value === 'ar'
    ? (state.warehouse_name_ar || state.warehouse_name_en || '—')
    : (state.warehouse_name_en || state.warehouse_name_ar || '—')
})

const typeLabel = computed(() => {
  const state = countState.value
  if (!state) return '—'
  if (state.type_label) return state.type_label
  if (state.type === 'full') return t('stocktaking_orders_page.type_full')
  if (state.type === 'partial') return t('stocktaking_orders_page.type_partial')
  return state.type || '—'
})

const productDisplayName = (item: StocktakingCountItem): string => {
  if (locale.value === 'ar') return item.product_name_ar || item.product_name_en || `#${item.product_id}`
  return item.product_name_en || item.product_name_ar || `#${item.product_id}`
}

const itemStatusLabel = (item: StocktakingCountItem): string => {
  if (item.count_status === 'done' || item.counted_quantity != null) {
    return t('stocktaking_count_page.status_done')
  }
  return t('stocktaking_count_page.status_in_progress')
}

const itemStatusVariant = (item: StocktakingCountItem): 'default' | 'secondary' | 'outline' => {
  if (item.count_status === 'done' || item.counted_quantity != null) return 'default'
  return 'outline'
}

const qtyDraftValue = (item: StocktakingCountItem): string => {
  if (localQtyDraft.value[item.id] !== undefined) return localQtyDraft.value[item.id]!
  if (item.counted_quantity != null) return String(item.counted_quantity)
  return ''
}

const setQtyInputRef = (itemId: number, el: unknown) => {
  qtyInputRefs.value[itemId] = el as HTMLInputElement | null
}

const resolveQtyInputEl = (itemId: number, row: HTMLElement | null): HTMLInputElement | null => {
  const stored = qtyInputRefs.value[itemId] as unknown
  if (stored instanceof HTMLInputElement) return stored
  const viaComponent = (stored as { $el?: unknown } | null)?.$el
  if (viaComponent instanceof HTMLInputElement) return viaComponent
  return row?.querySelector<HTMLInputElement>('input') ?? null
}

const parseWholeQuantity = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) return null
  return num
}

const syncLocalDrafts = () => {
  const drafts: Record<number, string> = {}
  for (const item of countState.value?.items ?? []) {
    if (item.counted_quantity != null) drafts[item.id] = String(item.counted_quantity)
  }
  localQtyDraft.value = drafts
}

const loadCount = async () => {
  if (!canCount.value) {
    notAuthorized.value = true
    return
  }
  loadError.value = ''
  notAuthorized.value = false
  try {
    await stocktakingOrdersStore.getCount(orderId.value)
    syncLocalDrafts()
    dirtyItemIds.value = new Set()
  }
  catch (error: unknown) {
    const err = error as { response?: { status?: number }; statusCode?: number; status?: number }
    const status = err?.response?.status ?? err?.statusCode ?? err?.status
    if (status === 403) {
      notAuthorized.value = true
      return
    }
    loadError.value = getErrorMessage(error) || t('stocktaking_count_page.load_error')
  }
}

const focusAndHighlightItem = async (itemId: number) => {
  highlightedItemId.value = itemId
  await nextTick()
  const row = document.getElementById(`count-item-row-${itemId}`)
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const qtyInput = resolveQtyInputEl(itemId, row)
  qtyInput?.focus()
  qtyInput?.select?.()
  setTimeout(() => {
    if (highlightedItemId.value === itemId) highlightedItemId.value = null
  }, 2500)
}

const findItemByBarcodeLocal = (barcode: string): StocktakingCountItem | null => {
  const normalized = barcode.trim().toLowerCase()
  if (!normalized) return null
  const items = countState.value?.items ?? []
  return items.find(item =>
    item.barcode.toLowerCase() === normalized
    || item.sku.toLowerCase() === normalized,
  ) ?? null
}

const clearBarcodeScanTimer = () => {
  if (barcodeScanTimer) {
    clearTimeout(barcodeScanTimer)
    barcodeScanTimer = null
  }
}

const scheduleBarcodeScan = () => {
  clearBarcodeScanTimer()
  scanNotFound.value = false
  const code = barcodeInput.value.trim()
  if (!code || isReadOnly.value || scanning.value) return
  barcodeScanTimer = setTimeout(() => {
    barcodeScanTimer = null
    void handleBarcodeScan()
  }, BARCODE_SCAN_DEBOUNCE_MS)
}

const onBarcodeEnter = () => {
  clearBarcodeScanTimer()
  void handleBarcodeScan()
}

const handleBarcodeScan = async () => {
  const code = barcodeInput.value.trim()
  if (!code || isReadOnly.value || scanning.value) return
  clearBarcodeScanTimer()
  scanning.value = true
  try {
    const { itemId } = await stocktakingOrdersStore.scanBarcode(orderId.value, code)
    if (itemId) {
      barcodeInput.value = ''
      scanNotFound.value = false
      await focusAndHighlightItem(itemId)
      return
    }
    const localMatch = findItemByBarcodeLocal(code)
    if (localMatch) {
      barcodeInput.value = ''
      scanNotFound.value = false
      await focusAndHighlightItem(localMatch.id)
      return
    }
    scanNotFound.value = true
    toast.error(t('stocktaking_count_page.scan_not_found'))
  }
  catch (error: unknown) {
    const err = error as { response?: { status?: number }; statusCode?: number; status?: number }
    const status = err?.response?.status ?? err?.statusCode ?? err?.status
    if (status === 404 || status === 422) {
      scanNotFound.value = true
      toast.error(t('stocktaking_count_page.scan_not_found'))
      return
    }
    toast.error(getErrorMessage(error) || t('stocktaking_count_page.scan_error'))
  }
  finally {
    scanning.value = false
  }
}

const commitItemQuantity = async (item: StocktakingCountItem, rawValue: string) => {
  if (isReadOnly.value) return
  const parsed = parseWholeQuantity(rawValue)
  if (rawValue.trim() && parsed == null) {
    toast.error(t('stocktaking_count_page.qty_invalid'))
    localQtyDraft.value[item.id] = item.counted_quantity != null ? String(item.counted_quantity) : ''
    return
  }
  if (parsed == null) return
  if (item.counted_quantity === parsed) {
    dirtyItemIds.value.delete(item.id)
    return
  }

  updatingItemId.value = item.id
  try {
    const updated = await stocktakingOrdersStore.updateItemQuantity(orderId.value, item.id, parsed)
    const merged: StocktakingCountItem = {
      ...(updated ?? item),
      counted_quantity: parsed,
      count_status: 'done',
      counted_by: authStore.user
        ? { id: authStore.user.id, name: authStore.user.name }
        : (updated?.counted_by ?? item.counted_by),
      counted_at: new Date().toISOString(),
    }
    stocktakingOrdersStore.applyCountItemUpdate(merged)
    localQtyDraft.value[item.id] = String(parsed)
    dirtyItemIds.value.delete(item.id)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
    localQtyDraft.value[item.id] = item.counted_quantity != null ? String(item.counted_quantity) : ''
  }
  finally {
    updatingItemId.value = null
  }
}

const onQtyInput = (item: StocktakingCountItem, value: string | number) => {
  const text = String(value)
  localQtyDraft.value[item.id] = text
  if (text.trim() && parseWholeQuantity(text) != null) {
    dirtyItemIds.value.add(item.id)
  }
}

const onQtyBlur = async (item: StocktakingCountItem) => {
  const draft = localQtyDraft.value[item.id] ?? ''
  if (!draft.trim()) return
  await commitItemQuantity(item, draft)
}

const onQtyEnter = async (item: StocktakingCountItem, event: KeyboardEvent) => {
  event.preventDefault()
  const draft = localQtyDraft.value[item.id] ?? ''
  if (!draft.trim()) return
  await commitItemQuantity(item, draft)
}

const flushDirtyItems = async () => {
  const items = countState.value?.items ?? []
  for (const itemId of [...dirtyItemIds.value]) {
    const item = items.find(row => row.id === itemId)
    if (!item) continue
    const draft = localQtyDraft.value[itemId] ?? ''
    if (!draft.trim()) continue
    await commitItemQuantity(item, draft)
  }
}

const handleSaveProgress = async () => {
  if (!canSaveProgress.value) return
  try {
    await flushDirtyItems()
    await stocktakingOrdersStore.saveProgress(orderId.value)
    await stocktakingOrdersStore.getCount(orderId.value)
    syncLocalDrafts()
    dirtyItemIds.value = new Set()
    toast.success(t('stocktaking_count_page.save_success'))
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_count_page.save_error'))
  }
}

const handleSubmit = async () => {
  if (!canSubmit.value) return
  submitDialogOpen.value = false
  try {
    await flushDirtyItems()
    const result = await stocktakingOrdersStore.submitCount(orderId.value)
    if (!result) throw new Error('SUBMIT_FAILED')
    toast.success(t('stocktaking_count_page.submit_success'))
    await router.push('/stocktaking-orders')
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('stocktaking_count_page.submit_error'))
  }
}

const toggleFullscreen = async () => {
  const el = productListRef.value
  if (!el) return
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      }
    else {
      isFullscreen.value = true
      if (isInProgress.value) await focusBarcodeInput()
    }
  }
  else {
    await document.exitFullscreen()
  }
}
catch {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value && isInProgress.value) await focusBarcodeInput()
}
}

const focusBarcodeInput = async () => {
  await nextTick()
  productListRef.value?.querySelector<HTMLInputElement>('input[data-slot="input"]')?.focus()
}

const onFullscreenChange = async () => {
  const wasFullscreen = isFullscreen.value
  isFullscreen.value = Boolean(document.fullscreenElement)
  if (!wasFullscreen && isFullscreen.value && isInProgress.value) {
    await focusBarcodeInput()
  }
}

watch(barcodeInput, scheduleBarcodeScan)

onMounted(async () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  await loadCount()
})

onUnmounted(() => {
  clearBarcodeScanTimer()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
})
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
          <h1 class="text-2xl font-bold tracking-tight">{{ t('stocktaking_count_page.title') }}</h1>
          <p class="text-sm text-muted-foreground">{{ t('stocktaking_count_page.subtitle') }}</p>
        </div>
      </div>
      <div v-if="countState && isInProgress" class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          :disabled="!canSaveProgress"
          @click="handleSaveProgress"
        >
          <Loader2 v-if="saving" class="me-2 size-4 animate-spin" />
          {{ t('stocktaking_count_page.save_progress') }}
        </Button>
        <Button
          :disabled="!canSubmit"
          @click="submitDialogOpen = true"
        >
          <Loader2 v-if="submitting" class="me-2 size-4 animate-spin" />
          {{ t('stocktaking_count_page.submit') }}
        </Button>
      </div>
    </div>

    <div
      v-if="!canCount || notAuthorized"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {{ t('stocktaking_count_page.not_authorized') }}
    </div>

    <div
      v-else-if="loadError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div v-else-if="loading && !countState" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="countState">
      <div
        v-if="isReadOnly"
        class="rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      >
        {{ t('stocktaking_count_page.not_in_progress') }}
      </div>

      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <ClipboardList class="size-4 text-muted-foreground" />
          <h2 class="text-base font-semibold">{{ t('stocktaking_count_page.title') }}</h2>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_count_page.reference_id') }}</p>
            <p class="text-sm font-medium">{{ countState.reference_id || `#${countState.id}` }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_count_page.warehouse') }}</p>
            <p class="text-sm font-medium">{{ warehouseLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('stocktaking_count_page.stocktaking_type') }}</p>
            <p class="text-sm font-medium">{{ typeLabel }}</p>
          </div>
          <div class="sm:col-span-2 lg:col-span-1">
            <p class="text-xs text-muted-foreground mb-1">{{ t('stocktaking_count_page.progress') }}</p>
            <div class="flex items-center gap-3">
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-300"
                  :style="{ width: `${progressPercentage}%` }"
                />
              </div>
              <span class="text-sm font-medium tabular-nums shrink-0">{{ progressPercentage }}%</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ progressSummary }}</p>
          </div>
        </CardContent>
      </Card>

      <div
        ref="productListRef"
        class="flex flex-col"
        :class="isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''"
      >
      <div
        v-if="isInProgress"
        class="shrink-0 border-b bg-background px-4 py-3 sm:px-6"
        :class="isFullscreen ? 'shadow-sm' : ''"
      >
        <label class="text-sm font-medium">{{ t('stocktaking_count_page.barcode_scanner') }}</label>
        <div class="relative mt-2 max-w-xl">
          <Barcode
            class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            :class="scanNotFound ? 'text-red-500' : 'text-muted-foreground'"
          />
          <Input
            v-model="barcodeInput"
            class="ps-9"
            :aria-invalid="Boolean(scanNotFound)"
            :class="scanNotFound ? 'border-destructive bg-white text-red-600 placeholder:text-red-400 focus-visible:border-destructive focus-visible:ring-destructive/30' : ''"
            :placeholder="scanNotFound ? t('stocktaking_count_page.scan_not_found_placeholder') : t('stocktaking_count_page.barcode_placeholder')"
            :disabled="scanning"
            @keydown.enter.prevent="onBarcodeEnter"
          />
        </div>
        <p v-if="scanNotFound" class="mt-1.5 text-xs text-red-600">
          {{ t('stocktaking_count_page.scan_not_found') }}
        </p>
      </div>
      <Card class="gap-0 overflow-hidden py-0 shadow-sm flex flex-1 flex-col min-h-0">
        <div class="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3.5 sm:px-6">
          <div class="flex items-center gap-2">
            <Package class="size-4 text-muted-foreground" />
            <h2 class="text-base font-semibold">{{ t('stocktaking_count_page.product_list') }}</h2>
          </div>
          <Button type="button" variant="outline" size="sm" class="gap-2" @click="toggleFullscreen">
            <Minimize v-if="isFullscreen" class="size-4" />
            <Maximize v-else class="size-4" />
            {{ isFullscreen ? t('stocktaking_count_page.exit_fullscreen') : t('stocktaking_count_page.fullscreen') }}
          </Button>
        </div>
        <CardContent class="flex-1 overflow-auto px-0 py-0 sm:px-0">
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="min-w-[200px] text-start">{{ t('stocktaking_count_page.col_product') }}</TableHead>
                  <TableHead class="min-w-[100px] text-start">{{ t('stocktaking_count_page.col_sku') }}</TableHead>
                  <TableHead class="min-w-[140px] text-start">{{ t('stocktaking_count_page.col_variation') }}</TableHead>
                  <TableHead
                    v-if="showSystemQuantity"
                    class="min-w-[100px] text-start"
                  >
                    {{ t('stocktaking_count_page.col_system_quantity') }}
                  </TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_count_page.col_counted_quantity') }}</TableHead>
                  <TableHead class="min-w-[140px] text-start">{{ t('stocktaking_count_page.col_counted_by') }}</TableHead>
                  <TableHead class="min-w-[120px] text-start">{{ t('stocktaking_count_page.col_status') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!countState.items.length">
                  <TableCell
                    :colspan="showSystemQuantity ? 7 : 6"
                    class="py-10 text-center text-sm text-muted-foreground"
                  >
                    {{ t('stocktaking_count_page.no_items') }}
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="item in countState.items"
                  :id="`count-item-row-${item.id}`"
                  :key="item.id"
                  :class="[
                    'align-middle transition-colors',
                    highlightedItemId === item.id ? 'bg-primary/10 ring-1 ring-primary/30' : '',
                  ]"
                >
                  <TableCell class="text-sm font-medium">{{ productDisplayName(item) }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ item.sku || '—' }}</TableCell>
                  <TableCell class="text-sm">{{ item.variation_label || '—' }}</TableCell>
                  <TableCell
                    v-if="showSystemQuantity"
                    class="text-sm tabular-nums"
                  >
                    {{ item.system_quantity ?? item.snapshot_quantity ?? '—' }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Input
                        :ref="(el) => setQtyInputRef(item.id, el as HTMLInputElement | null)"
                        :model-value="qtyDraftValue(item)"
                        type="number"
                        min="0"
                        step="1"
                        class="h-9 w-24 text-start tabular-nums"
                        :disabled="isReadOnly || updatingItemId === item.id"
                        @update:model-value="value => onQtyInput(item, value)"
                        @blur="onQtyBlur(item)"
                        @keydown.enter="onQtyEnter(item, $event)"
                      />
                      <Loader2
                        v-if="updatingItemId === item.id"
                        class="size-4 animate-spin text-muted-foreground"
                      />
                    </div>
                  </TableCell>
                  <TableCell class="text-sm">{{ item.counted_by?.name || '—' }}</TableCell>
                  <TableCell>
                    <Badge :variant="itemStatusVariant(item)">{{ itemStatusLabel(item) }}</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </template>

    <AlertDialog :open="submitDialogOpen" @update:open="submitDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('stocktaking_count_page.submit_confirm_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('stocktaking_count_page.submit_confirm_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="submitting">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction :disabled="submitting" @click="handleSubmit">
            <Loader2 v-if="submitting" class="me-2 size-4 animate-spin" />
            {{ t('stocktaking_count_page.submit_confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
