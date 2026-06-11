<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Boxes, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
const canAllocate = computed(() => canEdit('distributors'))

const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const submitting = ref(false)
const formError = ref('')

const detail = ref<AllocationDetail | null>(null)
const quantity = ref<number>(0)
const quantityError = ref('')

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

const rowTotal = computed(() => {
  if (!detail.value) return 0
  return quantity.value * detail.value.unit_price
})

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
  if (!canAllocate.value || !allocationId.value) return
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
    quantity.value = parsed.allocated_quantity > 0 ? parsed.allocated_quantity : 1
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
  quantityError.value = ''
  formError.value = ''
  const current = detail.value
  if (!current) {
    formError.value = t('distributors_show.allocation_not_found')
    return false
  }
  const qty = Number(quantity.value)
  if (!Number.isFinite(qty) || qty <= 0) {
    quantityError.value = t('distributors_show.allocation_validation_quantity_invalid')
    return false
  }
  if (current.consumed_quantity > 0 && qty < current.consumed_quantity) {
    quantityError.value = t('distributors_show.allocation_validation_quantity_below_consumed', { consumed: current.consumed_quantity })
    return false
  }
  return true
}

const submitAllocation = async () => {
  if (!canAllocate.value || !detail.value) return
  if (!distributorId.value && !detail.value.distributor_id) {
    formError.value = t('distributors_show.allocation_distributor_required')
    return
  }
  if (!validate()) return

  submitting.value = true
  formError.value = ''
  try {
    await $api(`/distributors/allocations/${allocationId.value}`, {
      method: 'PUT',
      body: {
        distributor_id: detail.value.distributor_id || Number(distributorId.value),
        variation_id: detail.value.variation_id,
        warehouse_id: detail.value.warehouse_id,
        quantity: Number(quantity.value),
      },
    })

    toast.success(t('distributors_show.allocation_update_success'))
    await navigateTo({
      path: `/distributors/show/${distributorId.value || detail.value.distributor_id}`,
      query: { tab: 'stock-allocation' },
      replace: true,
    })
  }
  catch (error: unknown) {
    const message = getErrorMessage(error)
    formError.value = message
    toast.error(message)
  }
  finally {
    submitting.value = false
  }
}

onMounted(loadAllocation)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-9 shrink-0" as-child>
        <NuxtLink :to="{ path: `/distributors/show/${distributorId || ''}`, query: { tab: 'stock-allocation' } }">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('distributors_show.stock_allocation_action_edit') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('distributors_show.stock_allocation_edit_subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="!canAllocate"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('distributors_show.no_view_permission') }}
    </div>

    <div v-else-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="notFound"
      class="rounded-xl border border-muted bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('distributors_show.allocation_not_found') }}
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
    >
      {{ loadError }}
    </div>

    <template v-else-if="detail">
      <div class="overflow-hidden rounded-xl border">
        <div class="bg-muted/40 px-4 py-3 border-b flex items-center gap-2">
          <Boxes class="size-4" />
          <h2 class="font-semibold">{{ t('distributors_show.stock_allocation_action_edit') }}</h2>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader class="hidden md:table-header-group">
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="min-w-[240px] text-start">{{ t('distributors_show.stock_allocation_col_product_name') }}</TableHead>
                <TableHead class="min-w-[160px] text-start">{{ t('distributors_show.allocation_row_description') }}</TableHead>
                <TableHead class="w-28 text-start">{{ t('distributors_show.allocation_quantity') }}</TableHead>
                <TableHead class="w-32 text-start">{{ t('distributors_show.allocation_unit_price') }}</TableHead>
                <TableHead class="w-28 text-start">{{ t('distributors_show.allocation_row_total') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow class="flex flex-col gap-2 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border-0 md:rounded-none md:p-0 md:mb-0 md:shadow-none">
                <!-- Product cell (read-only with nested info) -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[240px] md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ t('distributors_show.stock_allocation_col_product_name') }}
                  </span>
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <p class="text-sm font-medium leading-snug break-words">
                      {{ detail.product_label || '—' }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ t('distributors_show.stock_allocation_col_variation') }}: <span class="font-medium text-foreground">{{ detail.variation_label || '—' }}</span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ t('distributors_show.stock_allocation_col_source_warehouse') }}: <span class="font-medium text-foreground">{{ detail.warehouse_label || '—' }}</span>
                    </p>
                    <div class="flex gap-3 text-xs text-muted-foreground border-t pt-1.5 mt-0.5">
                      <span>{{ t('distributors_show.stock_allocation_col_sold_quantity') }}: <span class="font-medium tabular-nums text-foreground">{{ detail.consumed_quantity }}</span></span>
                      <span>{{ t('distributors_show.stock_allocation_col_remaining_quantity') }}: <span class="font-medium tabular-nums text-foreground">{{ detail.remaining_quantity }}</span></span>
                    </div>
                  </div>
                </TableCell>

                <!-- Description (read-only) -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:min-w-[160px] md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ t('distributors_show.allocation_row_description') }}
                  </span>
                  <p class="text-sm text-muted-foreground">{{ detail.description || '—' }}</p>
                </TableCell>

                <!-- Qty (editable) -->
                <TableCell class="block py-1.5 md:table-cell md:align-top md:py-3">
                  <span class="block text-xs font-medium text-muted-foreground mb-1 md:hidden">
                    {{ t('distributors_show.allocation_quantity') }}
                  </span>
                  <div class="flex w-full flex-col gap-1 md:ms-auto md:max-w-28 md:items-end">
                    <Input
                      :model-value="quantity"
                      type="number"
                      min="1"
                      class="h-9 w-full text-start tabular-nums"
                      :class="quantityError ? 'border-red-500 focus-visible:ring-red-500' : ''"
                      @update:model-value="value => { quantity = Math.max(0, Number(value) || 0); quantityError = '' }"
                    />
                    <p v-if="quantityError" class="w-full text-start text-xs text-red-600">{{ quantityError }}</p>
                  </div>
                </TableCell>

                <!-- Unit Price (read-only) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:align-top md:py-3 md:text-start md:tabular-nums">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">
                    {{ t('distributors_show.allocation_unit_price') }}
                  </span>
                  <div class="font-medium md:ms-auto md:flex md:h-9 md:max-w-32 md:items-center md:justify-start tabular-nums">
                    {{ detail.unit_price > 0 ? formatMoney(detail.unit_price) : '—' }}
                  </div>
                </TableCell>

                <!-- Total (read-only computed) -->
                <TableCell class="flex justify-between items-center py-1.5 md:table-cell md:align-top md:py-3 md:text-start md:tabular-nums">
                  <span class="text-xs font-medium text-muted-foreground md:hidden">
                    {{ t('distributors_show.allocation_row_total') }}
                  </span>
                  <div class="font-medium md:ms-auto md:flex md:h-9 md:max-w-28 md:items-center md:justify-start tabular-nums">
                    {{ formatMoney(rowTotal) }}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>

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
          @click="submitAllocation"
        >
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          <Boxes v-else class="size-4" />
          {{ t('common.save') }}
        </Button>
      </div>
    </template>
  </div>
</template>
