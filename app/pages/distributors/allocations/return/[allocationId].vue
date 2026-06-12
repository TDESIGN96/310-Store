<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Boxes, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

definePageMeta({ layout: 'default' })

interface AllocationDetail {
  id: string
  distributor_id: number
  variation_id: number
  warehouse_id: number
  allocated_quantity: number
  consumed_quantity: number
  remaining_quantity: number
  distributor_label: string
  product_label: string
  variation_label: string
  warehouse_label: string
  description: string
  unit_price: number
}

const route = useRoute()
const { t, locale } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canEdit } = usePermissions()

const allocationId = computed(() => String(route.params.allocationId ?? '').trim())
const distributorId = computed(() => String(route.query.distributor_id ?? '').trim())
const canReturn = computed(() => canEdit('distributors'))

const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const submitting = ref(false)
const confirmOpen = ref(false)

const detail = ref<AllocationDetail | null>(null)
const returnQty = ref<number>(0)
const returnQtyError = ref('')

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const labelOf = (value: unknown, ...keys: string[]): string => {
  if (typeof value === 'string') return value.trim()
  if (isRecord(value)) {
    for (const key of keys) {
      const candidate = value[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
  }
  return ''
}

const localeLabel = (raw: unknown): string => {
  if (!isRecord(raw)) return ''
  if (locale.value === 'ar') return labelOf(raw, 'name_ar', 'name_en', 'name')
  return labelOf(raw, 'name_en', 'name_ar', 'name')
}

const formatMoney = (value: number): string => value.toFixed(2)

const extractAllocationRaw = (payload: unknown): Record<string, unknown> | null => {
  const root = isRecord(payload) ? payload : {}
  const nested = isRecord(root.data) ? root.data : null
  if (isRecord(nested?.allocation)) return nested.allocation
  if (isRecord(root.allocation)) return root.allocation
  if (nested && Object.keys(nested).length) return nested
  if (Object.keys(root).length) return root
  return null
}

const loadAllocation = async () => {
  if (!canReturn.value || !allocationId.value) return
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    const response = await $api<Record<string, unknown>>(`/distributors/allocations/${allocationId.value}`)
    const raw = extractAllocationRaw(response)
    if (!raw) {
      notFound.value = true
      return
    }

    const variationObj = isRecord(raw.variation) ? raw.variation : null
    const warehouseObj = isRecord(raw.warehouse) ? raw.warehouse : null
    const productObj = isRecord(variationObj?.product) ? variationObj.product : null

    const parsed: AllocationDetail = {
      id: String(raw.id ?? allocationId.value),
      distributor_id: toNumber(raw.distributor_id, Number(distributorId.value) || 0),
      variation_id: toNumber(raw.variation_id ?? variationObj?.id, 0),
      warehouse_id: toNumber(raw.warehouse_id ?? warehouseObj?.id, 0),
      allocated_quantity: toNumber(raw.allocated_quantity ?? raw.quantity, 0),
      consumed_quantity: toNumber(raw.consumed_quantity ?? raw.sold_quantity, 0),
      remaining_quantity: toNumber(raw.remaining_quantity, 0),
      distributor_label: labelOf(raw.distributor, 'name', 'name_en', 'name_ar'),
      product_label: productObj ? localeLabel(productObj) : labelOf(raw.product, 'name_en', 'name_ar', 'name'),
      variation_label: labelOf(raw.variation, 'label', 'name', 'sku'),
      warehouse_label: labelOf(raw.warehouse, 'name', 'name_en', 'name_ar'),
      description: typeof raw.description === 'string' ? raw.description : '',
      unit_price: toNumber(raw.price ?? raw.unit_price ?? raw.standard_price, 0),
    }

    if (!parsed.variation_id || !parsed.warehouse_id) {
      notFound.value = true
      return
    }

    detail.value = parsed
    returnQty.value = parsed.remaining_quantity > 0 ? parsed.remaining_quantity : 0
  }
  catch (error: unknown) {
    const err = error as { response?: { status?: number }; statusCode?: number; status?: number }
    const status = err?.response?.status ?? err?.statusCode ?? err?.status
    if (status === 404) {
      notFound.value = true
      return
    }
    loadError.value = getErrorMessage(error) || t('distributors_show.allocation_load_error')
  }
  finally {
    loading.value = false
  }
}

const validate = (): boolean => {
  returnQtyError.value = ''
  const current = detail.value
  if (!current) return false
  const qty = Number(returnQty.value)
  if (!Number.isFinite(qty) || qty <= 0) {
    returnQtyError.value = t('distributors_show.allocation_return_validation_qty_required')
    return false
  }
  if (qty > current.remaining_quantity) {
    returnQtyError.value = t('distributors_show.allocation_return_validation_qty_exceeds', { remaining: current.remaining_quantity })
    return false
  }
  return true
}

const requestReturn = () => {
  if (!validate()) return
  confirmOpen.value = true
}

const confirmReturn = async () => {
  if (!canReturn.value || !detail.value) return
  submitting.value = true
  try {
    await $api(`/distributors/allocations/${allocationId.value}`, {
      method: 'DELETE',
      body: { quantity: Number(returnQty.value) },
    })
    toast.success(t('distributors_show.allocation_return_success'))
    await navigateTo({
      path: `/distributors/show/${distributorId.value || detail.value.distributor_id}`,
      query: { tab: 'stock-allocation' },
      replace: true,
    })
  }
  catch (error: unknown) {
    const message = getErrorMessage(error)
    toast.error(message)
  }
  finally {
    submitting.value = false
    confirmOpen.value = false
  }
}

onMounted(loadAllocation)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink :to="{ path: `/distributors/show/${distributorId || ''}`, query: { tab: 'stock-allocation' } }">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('distributors_show.stock_allocation_action_return') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('distributors_show.allocation_return_subtitle') }}</p>
      </div>
    </div>

    <!-- Permission guard -->
    <div
      v-if="!canReturn"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('distributors_show.no_view_permission') }}
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Not found -->
    <div
      v-else-if="notFound"
      class="rounded-xl border border-muted bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('distributors_show.allocation_not_found') }}
    </div>

    <!-- Load error -->
    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
    >
      {{ loadError }}
    </div>

    <!-- Unavailable (remaining = 0) -->
    <div
      v-else-if="detail && detail.remaining_quantity <= 0"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('distributors_show.allocation_return_unavailable') }}
    </div>

    <template v-else-if="detail">
      <!-- Allocation detail card -->
      <div class="overflow-hidden rounded-xl border">
        <div class="bg-muted/40 px-4 py-3 border-b flex items-center gap-2">
          <Boxes class="size-4" />
          <h2 class="font-semibold">{{ t('distributors_show.stock_allocation_action_return') }}</h2>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader class="hidden md:table-header-group">
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="min-w-[240px] text-start">{{ t('distributors_show.stock_allocation_col_product_name') }}</TableHead>
                <TableHead class="min-w-[160px] text-start">{{ t('distributors_show.allocation_row_description') }}</TableHead>
                <TableHead class="w-28 text-end">{{ t('distributors_show.allocation_quantity') }}</TableHead>
                <TableHead class="w-32 text-end">{{ t('distributors_show.allocation_unit_price') }}</TableHead>
                <TableHead class="w-28 text-end">{{ t('distributors_show.allocation_row_total') }}</TableHead>
                <TableHead class="w-24 text-end">{{ t('distributors_show.stock_allocation_col_sold_quantity') }}</TableHead>
                <TableHead class="w-28 text-end">{{ t('distributors_show.stock_allocation_col_remaining_quantity') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow class="flex flex-col gap-2 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border-0 md:rounded-none md:p-0 md:mb-0 md:shadow-none">
                <!-- Product -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[240px] md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ t('distributors_show.stock_allocation_col_product_name') }}
                  </span>
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <p class="text-sm font-medium leading-snug break-words">{{ detail.product_label || '—' }}</p>
                    <p class="text-xs text-muted-foreground">
                      {{ t('distributors_show.stock_allocation_col_variation') }}:
                      <span class="font-medium text-foreground">{{ detail.variation_label || '—' }}</span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ t('distributors_show.stock_allocation_col_source_warehouse') }}:
                      <span class="font-medium text-foreground">{{ detail.warehouse_label || '—' }}</span>
                    </p>
                  </div>
                </TableCell>

                <!-- Description -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[160px] md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ t('distributors_show.allocation_row_description') }}
                  </span>
                  <p class="text-sm text-muted-foreground">{{ detail.description || '—' }}</p>
                </TableCell>

                <!-- Allocated Qty (read-only) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:py-3 md:text-end">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.allocation_quantity') }}</span>
                  <span class="tabular-nums">{{ detail.allocated_quantity }}</span>
                </TableCell>

                <!-- Unit Price (read-only) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:py-3 md:text-end">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.allocation_unit_price') }}</span>
                  <span class="tabular-nums">{{ detail.unit_price > 0 ? formatMoney(detail.unit_price) : '—' }}</span>
                </TableCell>

                <!-- Row Total (read-only) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:py-3 md:text-end">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.allocation_row_total') }}</span>
                  <span class="tabular-nums font-medium">
                    {{ detail.unit_price > 0 ? formatMoney(detail.allocated_quantity * detail.unit_price) : '—' }}
                  </span>
                </TableCell>

                <!-- Sold Qty (read-only) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:py-3 md:text-end">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.stock_allocation_col_sold_quantity') }}</span>
                  <span class="tabular-nums">{{ detail.consumed_quantity }}</span>
                </TableCell>

                <!-- Remaining Qty (read-only) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:py-3 md:text-end">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.stock_allocation_col_remaining_quantity') }}</span>
                  <span class="tabular-nums font-semibold">{{ detail.remaining_quantity }}</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <!-- Return form card -->
      <div class="overflow-hidden rounded-xl border">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold">{{ t('distributors_show.stock_allocation_action_return') }}</h2>
        </div>
        <div class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <!-- Remaining Quantity (read-only) -->
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('distributors_show.allocation_return_remaining_label') }}</label>
            <Input :model-value="detail.remaining_quantity" type="number" disabled class="tabular-nums" />
          </div>

          <!-- Return Quantity (editable) -->
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('distributors_show.allocation_return_qty_label') }}</label>
            <Input
              :model-value="returnQty"
              type="number"
              min="1"
              :max="detail.remaining_quantity"
              :class="returnQtyError ? 'border-red-500 focus-visible:ring-red-500' : ''"
              class="tabular-nums"
              @update:model-value="value => { returnQty = Math.max(0, Number(value) || 0); returnQtyError = '' }"
            />
            <p v-if="returnQtyError" class="text-xs text-red-600">{{ returnQtyError }}</p>
          </div>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="flex flex-col-reverse gap-3 rounded-xl border bg-card/80 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end sm:px-5">
        <Button
          type="button"
          variant="outline"
          class="h-10 w-full sm:w-auto"
          :disabled="submitting"
          as-child
        >
          <NuxtLink :to="{ path: `/distributors/show/${distributorId || ''}`, query: { tab: 'stock-allocation' } }">
            {{ t('common.cancel') }}
          </NuxtLink>
        </Button>
        <Button
          type="button"
          class="h-10 gap-2 bg-[#215260] hover:bg-[#184754] w-full sm:w-auto"
          :disabled="submitting"
          @click="requestReturn"
        >
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          <Boxes v-else class="size-4" />
          {{ t('distributors_show.stock_allocation_action_return') }}
        </Button>
      </div>
    </template>

    <!-- Confirmation dialog -->
    <AlertDialog :open="confirmOpen" @update:open="confirmOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('distributors_show.allocation_return_confirm_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('distributors_show.allocation_return_confirm_body', {
              qty: returnQty,
              product: detail?.product_label ?? '',
              warehouse: detail?.warehouse_label ?? '',
            }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="submitting">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-[#215260] hover:bg-[#184754] text-white"
            :disabled="submitting"
            @click.prevent="confirmReturn"
          >
            <Loader2 v-if="submitting" class="me-2 size-4 animate-spin" />
            {{ t('distributors_show.stock_allocation_action_return') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
