<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Trash2, Plus, HelpCircle, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const { t, locale } = useI18n()

// ── Types ──────────────────────────────────────────────────────────────────────

interface WarehouseOption {
  id: number
  name_ar: string
  name_en: string
  status: string
}

interface WarehousesListResponse {
  data?: { warehouses?: WarehouseOption[]; pagination?: { last_page?: number } }
  warehouses?: WarehouseOption[]
  pagination?: { last_page?: number }
}

interface AssignmentRow {
  _key: number
  warehouseId: string
  stock: string
  minQty: string
  allowNotifications: boolean
}

// ── State ──────────────────────────────────────────────────────────────────────

const { $api } = useApi()

const allWarehouses = ref<WarehouseOption[]>([])
const loadingWarehouses = ref(false)
const loadError = ref('')

const rows = ref<AssignmentRow[]>([])
let _keyCounter = 0

const tableError = ref('')

// ── Errors exposed to parent via defineExpose ──────────────────────────────────

const validationError = ref('')

// ── API ────────────────────────────────────────────────────────────────────────

async function loadWarehouses() {
  loadingWarehouses.value = true
  loadError.value = ''
  try {
    const aggregated: WarehouseOption[] = []
    let page = 1
    let lastPage = 1
    const maxPages = 50

    do {
      const data = await $api<WarehousesListResponse>('/warehouses', {
        params: { page, per_page: 100, status: 'active' },
      })
      const list = data.data?.warehouses ?? data.warehouses ?? []
      aggregated.push(...list)
      lastPage = data.data?.pagination?.last_page ?? data.pagination?.last_page ?? 1
      page++
    } while (page <= lastPage && page <= maxPages)

    allWarehouses.value = aggregated.filter(
      w => String(w.status ?? 'active').toLowerCase() === 'active',
    )
  }
  catch {
    loadError.value = t('warehouse_assignment.load_error')
  }
  finally {
    loadingWarehouses.value = false
  }
}

// ── Derived: available warehouses per row (excludes warehouses already used in other rows) ──

function availableForRow(rowKey: number): WarehouseOption[] {
  const usedIds = new Set(
    rows.value
      .filter(r => r._key !== rowKey && r.warehouseId !== '')
      .map(r => r.warehouseId),
  )
  return allWarehouses.value.filter(w => !usedIds.has(String(w.id)))
}

function warehouseOptionLabel(w: WarehouseOption) {
  return locale.value === 'ar' ? (w.name_ar || w.name_en) : (w.name_en || w.name_ar)
}

// ── Row management ─────────────────────────────────────────────────────────────

function addRow() {
  tableError.value = ''
  validationError.value = ''
  rows.value.push({
    _key: ++_keyCounter,
    warehouseId: '',
    stock: '0',
    minQty: '0',
    allowNotifications: true,
  })
}

function removeRow(key: number) {
  rows.value = rows.value.filter(r => r._key !== key)
  tableError.value = ''
  validationError.value = ''
}

function clearAll() {
  rows.value = []
  tableError.value = ''
  validationError.value = ''
}

// ── Input helpers ──────────────────────────────────────────────────────────────

function onNumberInput(e: Event, row: AssignmentRow, field: 'stock' | 'minQty') {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/[^0-9]/g, '')
  row[field] = digits
  el.value = digits
}

function onWarehouseChange(row: AssignmentRow, value: unknown) {
  row.warehouseId = value != null ? String(value) : ''
  tableError.value = ''
  validationError.value = ''
}

// ── Validation (called by parent via expose) ───────────────────────────────────

function validate(): boolean {
  validationError.value = ''
  tableError.value = ''

  if (rows.value.length === 0) {
    validationError.value = t('warehouse_assignment.validation_at_least_one')
    return false
  }

  for (const row of rows.value) {
    if (!row.warehouseId) {
      tableError.value = t('warehouse_assignment.validation_select_warehouse')
      return false
    }
  }

  return true
}

/** Returns the serialised assignment rows for the parent to include in its API call. */
function getAssignments() {
  return rows.value.map(r => ({
    warehouse_id: Number(r.warehouseId),
    quantity: Number(r.stock || 0),
    min_quantity: Number(r.minQty || 0),
    allow_notification: r.allowNotifications,
  }))
}

function setAssignments(assignments: Array<{
  warehouse_id?: number | string
  quantity?: number | string
  min_quantity?: number | string
  allow_notification?: boolean | string | number
}>) {
  rows.value = (assignments ?? []).map((row) => {
    const allowNotification
      = row.allow_notification === true
        || row.allow_notification === 'true'
        || row.allow_notification === '1'
        || row.allow_notification === 1

    return {
      _key: ++_keyCounter,
      warehouseId: row.warehouse_id != null ? String(row.warehouse_id) : '',
      stock: String(row.quantity ?? 0),
      minQty: String(row.min_quantity ?? 0),
      allowNotifications: allowNotification,
    }
  })
  tableError.value = ''
  validationError.value = ''
}

defineExpose({ validate, getAssignments, setAssignments })

onMounted(() => loadWarehouses())
</script>

<template>
  <div class="rounded-lg border p-5 space-y-6">
    <!-- Section header -->
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ t('products_create.step_badge', { n: 2 }) }}
      </p>
      <h2 class="text-lg font-semibold tracking-tight mt-1">
        {{ t('products_create.warehouse_section_title') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('warehouse_assignment.section_hint') }}
      </p>
    </div>

    <!-- Load error -->
    <div
      v-if="loadError"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ loadError }}
    </div>

    <!-- Loading spinner -->
    <div v-if="loadingWarehouses" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" />
      {{ t('common.loading') }}…
    </div>

    <template v-else>
      <Separator />

      <!-- Table -->
      <div class="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="rtl:text-right font-medium min-w-[180px]">
                {{ t('warehouse_assignment.col_warehouse') }}
              </TableHead>
              <TableHead class="rtl:text-right font-medium w-[140px]">
                {{ t('warehouse_assignment.col_stock') }}
              </TableHead>
              <TableHead class="rtl:text-right font-medium w-[160px]">
                {{ t('warehouse_assignment.col_min_qty') }}
              </TableHead>
              <TableHead class="font-medium w-[160px]">
                <div class="flex items-center gap-1.5 justify-center">
                  {{ t('warehouse_assignment.col_notifications') }}
                  <TooltipProvider :delay-duration="200">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button type="button" class="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle class="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-[220px] text-xs text-center">
                        {{ t('warehouse_assignment.notifications_tooltip') }}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead class="font-medium w-[80px] text-center">
                {{ t('warehouse_assignment.col_actions') }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- Empty state -->
            <TableRow v-if="rows.length === 0">
              <TableCell :colspan="5" class="py-10 text-center text-sm text-muted-foreground">
                {{ t('warehouse_assignment.empty_hint') }}
              </TableCell>
            </TableRow>

            <!-- Data rows -->
            <TableRow
              v-for="row in rows"
              v-else
              :key="row._key"
              class="hover:bg-muted/20 transition-colors"
            >
              <!-- Warehouse dropdown -->
              <TableCell class="py-2.5">
                <Select
                  :model-value="row.warehouseId || undefined"
                  @update:model-value="(v) => onWarehouseChange(row, v)"
                >
                  <SelectTrigger class="h-9 w-full min-w-[160px]">
                    <SelectValue :placeholder="t('warehouse_assignment.select_warehouse')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="w in availableForRow(row._key)"
                      :key="w.id"
                      :value="String(w.id)"
                    >
                      {{ warehouseOptionLabel(w) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              <!-- Stock -->
              <TableCell class="py-2.5">
                <Input
                  :model-value="row.stock"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  class="h-9 w-full font-mono"
                  dir="ltr"
                  @input="(e: Event) => onNumberInput(e, row, 'stock')"
                />
              </TableCell>

              <!-- Minimum quantity -->
              <TableCell class="py-2.5">
                <Input
                  :model-value="row.minQty"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  class="h-9 w-full font-mono"
                  dir="ltr"
                  @input="(e: Event) => onNumberInput(e, row, 'minQty')"
                />
              </TableCell>

              <!-- Allow notifications -->
              <TableCell class="py-2.5 text-center">
                <div class="flex justify-center">
                  <Checkbox
                    :checked="row.allowNotifications"
                    @update:checked="(v: boolean | 'indeterminate') => { row.allowNotifications = v === true }"
                  />
                </div>
              </TableCell>

              <!-- Delete row -->
              <TableCell class="py-2.5 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  :aria-label="t('warehouse_assignment.delete_row')"
                  @click="removeRow(row._key)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Row-level validation message -->
      <p v-if="tableError" class="text-sm text-red-600">{{ tableError }}</p>

      <!-- Section-level validation message (at least one row) -->
      <p v-if="validationError" class="text-sm text-red-600">{{ validationError }}</p>

      <!-- Table action buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-9 gap-2"
          :disabled="allWarehouses.length > 0 && rows.length >= allWarehouses.length"
          @click="addRow"
        >
          <Plus class="size-4" />
          {{ t('warehouse_assignment.add_row') }}
        </Button>

        <Button
          v-if="rows.length > 0"
          type="button"
          variant="ghost"
          size="sm"
          class="h-9 text-muted-foreground hover:text-red-600"
          @click="clearAll"
        >
          {{ t('warehouse_assignment.clear_all') }}
        </Button>
      </div>
    </template>
  </div>
</template>
