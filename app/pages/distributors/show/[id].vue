<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Pencil, UserX, UserCheck, Trash2, Building2, Boxes, Search, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

interface DistributorDetail {
  id: number
  name_en: string
  name_ar: string
  mobile: string
  email: string
  address: string
  location: string
  description: string
  admin_name: string
  admin_mobile: string
  status: 'active' | 'inactive'
}

interface DistributorShowResponse {
  distributor?: unknown
  data?: unknown
}

interface AllocationPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface AllocationRow {
  id: string
  variation_id: string
  warehouse_id: string
  product_name: string
  variation: string
  description: string
  unit_price: number | null
  allocated_quantity: number
  sold_quantity: number
  remaining_quantity: number
  source_warehouse: string
  allocation_date: string
  status: 'active' | 'returned' | 'partially_returned' | string
  status_label: string
}

const route = useRoute()
const distributorId = computed(() => String(route.params.id ?? ''))

const { t, locale } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canAccess, canEdit, canDelete } = usePermissions()
const canViewDistributor = computed(() => canAccess('distributors'))
const canEditDistributor = computed(() => canEdit('distributors'))
const canDeleteDistributor = computed(() => canDelete('distributors'))

const distributor = ref<DistributorDetail | null>(null)
const loading = ref(false)
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError('distributors_show', 'error')

const distributorToDelete = ref<DistributorDetail | null>(null)
const allocationToReturn = ref<AllocationRow | null>(null)
const returningAllocation = ref(false)
const distributorToDeactivate = ref<DistributorDetail | null>(null)
const distributorToActivate = ref<DistributorDetail | null>(null)
const deleting = ref(false)
const toggling = ref(false)

const currentTab = ref<'general' | 'stock-allocation'>('general')

const allocations = ref<AllocationRow[]>([])
const allocationsLoading = ref(false)
const allocationsError = ref('')
const allocationsPagination = ref<AllocationPagination>({
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
})
const allocationsPage = ref(1)
const allocationsSearch = ref('')
const allocationsWarehouse = ref('all')
const allocationsStatus = ref<'all' | 'active' | 'returned' | 'partially_returned'>('all')
const allocationsDateFrom = ref('')
const allocationsDateTo = ref('')
let allocationsSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const getString = (value: unknown) => (typeof value === 'string' ? value : '')

const normalizeStatus = (value: unknown): 'active' | 'inactive' => {
  const status = getString(value).toLowerCase()
  if (status === 'active' || value === true || value === 1 || value === '1') return 'active'
  return 'inactive'
}

const normalizeDistributor = (raw: unknown): DistributorDetail | null => {
  if (!isRecord(raw)) return null
  const idValue = raw.id
  const id = typeof idValue === 'number' ? idValue : Number(idValue)
  if (!Number.isFinite(id)) return null
  const admin = isRecord(raw.admin) ? raw.admin : null
  const user = isRecord(raw.user) ? raw.user : null
  return {
    id,
    name_en: getString(raw.name_en || raw.distributor_name_en || raw.name || raw.company_name_en),
    name_ar: getString(raw.name_ar || raw.distributor_name_ar || raw.company_name_ar),
    mobile: getString(raw.mobile || raw.phone),
    email: getString(raw.email),
    address: getString(raw.address),
    location: getString(raw.location || raw.city || raw.location_city),
    description: getString(raw.description),
    admin_name: getString(raw.admin_name || admin?.name || user?.name),
    admin_mobile: getString(raw.admin_mobile || admin?.mobile || admin?.phone || user?.mobile || user?.phone),
    status: normalizeStatus(raw.status ?? raw.is_active),
  }
}

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const normalizeFilterDate = (value: string): string | undefined => {
  const raw = value.trim()
  if (!raw) return undefined
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return undefined
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!iso) return undefined
  return `${iso[1]}-${iso[2]}-${iso[3]}`
}

const normalizeAllocationStatus = (value: unknown): AllocationRow['status'] => {
  const status = getString(value).trim().toLowerCase().replace(/\s+/g, '_')
  if (status === 'active' || status === 'returned' || status === 'partially_returned') return status
  return status || 'active'
}

const normalizeAllocation = (raw: unknown): AllocationRow | null => {
  if (!isRecord(raw)) return null
  const variationObj = isRecord(raw.variation) ? raw.variation : null
  const warehouseObj = isRecord(raw.warehouse) ? raw.warehouse : null
  // `product` may be a top-level sibling of `variation` (API v2) or nested inside `variation.product`
  const productObj = isRecord(raw.product)
    ? raw.product
    : (isRecord(variationObj?.product) ? variationObj.product : null)
  const status = normalizeAllocationStatus(raw.status ?? raw.allocation_status)

  const sourceWarehouse = typeof raw.warehouse === 'string'
    ? raw.warehouse
    : getString(
      warehouseObj?.name_ar
      || warehouseObj?.name_en
      || warehouseObj?.name
      || raw.source_warehouse
      || raw.warehouse_name,
    )

  const id = String(raw.id ?? '').trim()
  if (!id) return null

  const product_name = productObj
    ? (locale.value === 'ar'
      ? getString(productObj.name_ar || productObj.name_en || productObj.name || raw.product_name || raw.product)
      : getString(productObj.name_en || productObj.name_ar || productObj.name || raw.product_name || raw.product))
    : getString(raw.product_name || raw.product || raw.variation)

  return {
    id,
    variation_id: String(raw.variation_id ?? variationObj?.id ?? '').trim(),
    warehouse_id: String(raw.warehouse_id ?? warehouseObj?.id ?? '').trim(),
    product_name,
    variation: getString(
      raw.variation_label
      || variationObj?.label
      || variationObj?.name
      || variationObj?.sku
      || raw.variation,
    ),
    description: getString(raw.description),
    unit_price: Number.isFinite(Number(raw.unit_price ?? variationObj?.price ?? raw.price ?? raw.custom_price ?? raw.distributor_price))
      ? Number(raw.unit_price ?? variationObj?.price ?? raw.price ?? raw.custom_price ?? raw.distributor_price)
      : null,
    allocated_quantity: toNumber(raw.allocated_quantity, 0),
    sold_quantity: toNumber(raw.consumed_quantity ?? raw.sold_quantity, 0),
    remaining_quantity: toNumber(raw.remaining_quantity, 0),
    source_warehouse: sourceWarehouse,
    allocation_date: getString(raw.allocation_date || raw.created_at).slice(0, 10),
    status,
    status_label: getString(raw.status_label || raw.status_text || raw.status),
  }
}

const warehouseOptions = computed(() => {
  const unique = new Map<string, string>()
  allocations.value.forEach((row) => {
    if (!row.warehouse_id) return
    if (!unique.has(row.warehouse_id)) unique.set(row.warehouse_id, row.source_warehouse || row.warehouse_id)
  })
  return [...unique.entries()].map(([id, label]) => ({ id, label }))
})

const hasAllocationFilters = computed(() =>
  allocationsSearch.value.trim().length > 0
  || allocationsWarehouse.value !== 'all'
  || allocationsStatus.value !== 'all'
  || Boolean(allocationsDateFrom.value)
  || Boolean(allocationsDateTo.value),
)

const extractAllocationsPagination = (payload: unknown, page: number): AllocationPagination => {
  const root = isRecord(payload) ? payload : {}
  const nested = isRecord(root.data) ? root.data : null
  const paginationRaw = isRecord(nested?.pagination) ? nested.pagination : (isRecord(root.pagination) ? root.pagination : null)
  if (!paginationRaw) {
    return {
      current_page: page,
      last_page: 1,
      per_page: Math.max(allocations.value.length, 1),
      total: allocations.value.length,
    }
  }
  return {
    current_page: toNumber(paginationRaw.current_page, page),
    last_page: toNumber(paginationRaw.last_page, 1),
    per_page: toNumber(paginationRaw.per_page, 15),
    total: toNumber(paginationRaw.total, 0),
  }
}

const loadAllocations = async (page = allocationsPage.value) => {
  if (!distributorId.value) return
  allocationsLoading.value = true
  allocationsError.value = ''
  try {
    const params: Record<string, string | number | undefined> = {
      page,
      distributor_id: distributorId.value,
      search: allocationsSearch.value.trim() || undefined,
      name: allocationsSearch.value.trim() || undefined,
      status: allocationsStatus.value === 'all' ? undefined : allocationsStatus.value,
      warehouse_id: allocationsWarehouse.value === 'all' ? undefined : allocationsWarehouse.value,
      source_warehouse_id: allocationsWarehouse.value === 'all' ? undefined : allocationsWarehouse.value,
      from: normalizeFilterDate(allocationsDateFrom.value),
      to: normalizeFilterDate(allocationsDateTo.value),
      allocation_date_from: normalizeFilterDate(allocationsDateFrom.value),
      allocation_date_to: normalizeFilterDate(allocationsDateTo.value),
      'sortBy[column]': 'allocation_date',
      'sortBy[direction]': 'desc',
    }
    const response = await $api<Record<string, unknown>>('/distributors/allocations', { params })
    const root = isRecord(response) ? response : {}
    const nested = isRecord(root.data) ? root.data : null
    const rowsRaw = Array.isArray(nested?.allocations)
      ? nested.allocations
      : Array.isArray(root.allocations)
        ? root.allocations
        : isRecord(nested?.allocation)
          ? [nested.allocation]
          : isRecord(root.allocation)
            ? [root.allocation]
            : []

    const normalized = rowsRaw
      .map(item => normalizeAllocation(item))
      .filter((item): item is AllocationRow => !!item)
      .sort((a, b) => new Date(b.allocation_date || 0).getTime() - new Date(a.allocation_date || 0).getTime())

    allocations.value = normalized
    allocationsPagination.value = extractAllocationsPagination(response, page)
    allocationsPage.value = allocationsPagination.value.current_page || page
  }
  catch (error: unknown) {
    allocationsError.value = getErrorMessage(error)
  }
  finally {
    allocationsLoading.value = false
  }
}

const resetAllocationFilters = () => {
  allocationsSearch.value = ''
  allocationsWarehouse.value = 'all'
  allocationsStatus.value = 'all'
  allocationsDateFrom.value = ''
  allocationsDateTo.value = ''
  if (currentTab.value === 'stock-allocation') loadAllocations(1)
}

const statusLabel = (row: AllocationRow) => {
  if (row.status_label.trim()) return row.status_label
  if (row.status === 'active') return t('distributors_show.stock_allocation_status_active')
  if (row.status === 'returned') return t('distributors_show.stock_allocation_status_returned')
  if (row.status === 'partially_returned') return t('distributors_show.stock_allocation_status_partially_returned')
  return row.status || '—'
}

const statusBadgeClass = (row: AllocationRow) => {
  if (row.status === 'active') return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
  if (row.status === 'partially_returned') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  if (row.status === 'returned') return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700'
  return 'bg-muted text-muted-foreground border-border'
}

const canEditAllocation = (row: AllocationRow) => row.status === 'active' || row.status === 'partially_returned'
const canReturnAllocation = (row: AllocationRow) => row.remaining_quantity > 0

const goToAllocationPage = (page: number) => {
  if (page < 1 || page > allocationsPagination.value.last_page) return
  loadAllocations(page)
}

const goToAllocateProducts = () => navigateTo({ path: '/distributors/allocations/create', query: { distributor_id: distributorId.value } })
const goToEditAllocation = (row: AllocationRow) => {
  return navigateTo({ path: `/distributors/allocations/edit/${row.id}`, query: { distributor_id: distributorId.value } })
}

const returnAllocation = async () => {
  const target = allocationToReturn.value
  if (!target) return
  returningAllocation.value = true
  try {
    await $api(`/distributors/allocations/${target.id}`, { method: 'DELETE' })
    toast.success(t('distributors_show.allocation_return_success'))
    allocationToReturn.value = null
    await loadAllocations(allocationsPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    returningAllocation.value = false
  }
}

const formatQty = (value: number) => formatDisplayNumber(value, { locale: locale.value })
const formatMoney = (value: number | null) => (value == null ? '—' : formatDisplayNumber(value, { locale: locale.value }))

const distributorName = computed(() => distributor.value?.name_en || distributor.value?.name_ar || `#${distributor.value?.id ?? ''}`)

const statusConfig = (status: string) => {
  if (status === 'active') {
    return {
      label: t('common.active'),
      class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    }
  }
  return {
    label: t('common.inactive'),
    class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  }
}

const loadDistributor = async () => {
  if (!distributorId.value) return
  loading.value = true
  clearLoadError()
  distributor.value = null
  try {
    const res = await $api<DistributorShowResponse>(`/distributors/${distributorId.value}`)
    const root = res.data
    const raw = res.distributor
      ?? (isRecord(root) && 'distributor' in root ? root.distributor : undefined)
      ?? root
    const row = normalizeDistributor(raw)
    if (!row) {
      setLoadErrorNotFound()
      return
    }
    distributor.value = row
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const deactivate = async () => {
  if (!distributorToDeactivate.value) return
  toggling.value = true
  try {
    await $api(`/distributors/${distributorToDeactivate.value.id}`, {
      method: 'PUT',
      body: { status: 'inactive' },
    })
    toast.success(t('distributors_page.deactivate_success', { name: distributorName.value }))
    distributorToDeactivate.value = null
    await loadDistributor()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    toggling.value = false
  }
}

const activate = async () => {
  if (!distributorToActivate.value) return
  toggling.value = true
  try {
    await $api(`/distributors/${distributorToActivate.value.id}`, {
      method: 'PUT',
      body: { status: 'active' },
    })
    toast.success(t('distributors_page.activate_success', { name: distributorName.value }))
    distributorToActivate.value = null
    await loadDistributor()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    toggling.value = false
  }
}

const deleteDistributor = async () => {
  if (!distributorToDelete.value) return
  deleting.value = true
  try {
    await $api(`/distributors/${distributorToDelete.value.id}`, { method: 'DELETE' })
    toast.success(t('distributors_page.delete_success', { name: distributorName.value }))
    await navigateTo('/distributors')
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    deleting.value = false
  }
}

watch(
  () => route.query.tab,
  (tab) => {
    currentTab.value = tab === 'stock-allocation' ? 'stock-allocation' : 'general'
  },
  { immediate: true },
)

watch(allocationsSearch, (value) => {
  if (allocationsSearchDebounceTimer) clearTimeout(allocationsSearchDebounceTimer)
  allocationsSearchDebounceTimer = setTimeout(() => {
    if (currentTab.value !== 'stock-allocation') return
    allocationsPage.value = 1
    loadAllocations(1)
  }, 400)
})

watch(
  [allocationsWarehouse, allocationsStatus, allocationsDateFrom, allocationsDateTo],
  () => {
    if (currentTab.value !== 'stock-allocation') return
    allocationsPage.value = 1
    loadAllocations(1)
  },
)

watch(currentTab, (tab) => {
  if (tab === 'stock-allocation') loadAllocations(allocationsPage.value)
})

onMounted(async () => {
  if (!canViewDistributor.value) return
  await loadDistributor()
  if (currentTab.value === 'stock-allocation') await loadAllocations(1)
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/distributors">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('distributors_show.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ t('distributors_show.subtitle') }}</p>
        </div>
      </div>

      <div v-if="distributor" class="flex items-center gap-2 flex-wrap">
        <Button
          v-if="canEditDistributor"
          variant="outline"
          size="sm"
          class="gap-2"
          as-child
        >
          <NuxtLink :to="`/distributors/edit/${distributor.id}`">
            <Pencil class="size-4" />
            {{ t('common.edit') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="canEditDistributor && distributor.status === 'active'"
          variant="outline"
          size="sm"
          class="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
          @click="distributorToDeactivate = distributor"
        >
          <UserX class="size-4" />
          {{ t('common.deactivate') }}
        </Button>
        <Button
          v-if="canEditDistributor && distributor.status !== 'active'"
          variant="outline"
          size="sm"
          class="gap-2 text-green-700 border-green-200 hover:bg-green-50"
          @click="distributorToActivate = distributor"
        >
          <UserCheck class="size-4" />
          {{ t('common.activate') }}
        </Button>
        <Button
          v-if="canDeleteDistributor"
          variant="outline"
          size="sm"
          class="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          @click="distributorToDelete = distributor"
        >
          <Trash2 class="size-4" />
          {{ t('common.delete') }}
        </Button>
      </div>
    </div>

    <div
      v-if="!canViewDistributor"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('distributors_show.no_view_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/distributors">{{ t('distributors_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div v-if="loading" class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 class="size-5 animate-spin" />
        {{ t('distributors_show.loading') }}
      </div>

      <div
        v-else-if="loadError"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <p class="font-medium text-center">{{ loadError.title }}</p>
        <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
          {{ loadError.detail }}
        </p>
        <Button variant="outline" size="sm" @click="loadDistributor">{{ t('common.retry') }}</Button>
      </div>

      <template v-else-if="distributor">
        <div class="flex items-center gap-2 border-b">
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            :class="currentTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="currentTab = 'general'"
          >
            {{ t('distributors_show.tab_general') }}
          </button>
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            :class="currentTab === 'stock-allocation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="currentTab = 'stock-allocation'"
          >
            {{ t('distributors_show.tab_stock_allocation') }}
          </button>
        </div>

        <div v-if="currentTab === 'general'" class="rounded-lg border overflow-hidden">
          <div class="bg-section-details border-section-details text-white px-4 py-3 border-b flex items-center justify-between gap-2">
            <h2 class="font-semibold flex items-center gap-2">
              <Building2 class="size-4" />
              {{ t('distributors_show.general_information') }}
            </h2>
            <span
              class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              :class="statusConfig(distributor.status).class"
            >
              {{ statusConfig(distributor.status).label }}
            </span>
          </div>

          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.name_en') }}</p>
              <p class="font-medium">{{ distributor.name_en || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.name_ar') }}</p>
              <p class="font-medium">{{ distributor.name_ar || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.mobile') }}</p>
              <p class="font-medium">{{ distributor.mobile || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.email') }}</p>
              <p class="font-medium">{{ distributor.email || '—' }}</p>
            </div>
            <div class="space-y-1 md:col-span-2">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.address') }}</p>
              <p class="font-medium">{{ distributor.address || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.location') }}</p>
              <p class="font-medium">{{ distributor.location || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.admin_name') }}</p>
              <p class="font-medium">{{ distributor.admin_name || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.admin_mobile') }}</p>
              <p class="font-medium">{{ distributor.admin_mobile || '—' }}</p>
            </div>
            
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="rounded-lg border p-4">
            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div class="relative w-full sm:flex-1">
                  <Search class="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    v-model="allocationsSearch"
                    class="ps-9 h-9"
                    :placeholder="t('distributors_show.stock_allocation_search_placeholder')"
                  />
                </div>
                <Select v-model="allocationsWarehouse">
                  <SelectTrigger class="w-full sm:w-[220px] h-9">
                    <SelectValue :placeholder="t('distributors_show.stock_allocation_filter_warehouse')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{{ t('distributors_show.stock_allocation_filter_all_warehouses') }}</SelectItem>
                    <SelectItem
                      v-for="warehouse in warehouseOptions"
                      :key="warehouse.id"
                      :value="warehouse.id"
                    >
                      {{ warehouse.label || warehouse.id }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select v-model="allocationsStatus">
                  <SelectTrigger class="w-full sm:w-[220px] h-9">
                    <SelectValue :placeholder="t('distributors_show.stock_allocation_filter_status')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{{ t('distributors_show.stock_allocation_filter_all_statuses') }}</SelectItem>
                    <SelectItem value="active">{{ t('distributors_show.stock_allocation_status_active') }}</SelectItem>
                    <SelectItem value="partially_returned">{{ t('distributors_show.stock_allocation_status_partially_returned') }}</SelectItem>
                    <SelectItem value="returned">{{ t('distributors_show.stock_allocation_status_returned') }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div class="w-full sm:w-[220px]">
                  <label class="text-xs text-muted-foreground">{{ t('distributors_show.stock_allocation_date_from') }}</label>
                  <DatePickerInput v-model="allocationsDateFrom" class="w-full mt-1" />
                </div>
                <div class="w-full sm:w-[220px]">
                  <label class="text-xs text-muted-foreground">{{ t('distributors_show.stock_allocation_date_to') }}</label>
                  <DatePickerInput v-model="allocationsDateTo" class="w-full mt-1" />
                </div>
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ms-auto w-full sm:w-auto">
                  <Button
                    v-if="hasAllocationFilters"
                    variant="ghost"
                    size="sm"
                    class="w-full sm:w-auto h-9 gap-1.5 text-muted-foreground"
                    :disabled="allocationsLoading"
                    @click="resetAllocationFilters"
                  >
                    <X class="size-3.5" />
                    {{ t('distributors_show.stock_allocation_reset_filters') }}
                  </Button>
                  <Button class="w-full sm:w-auto h-9 gap-2 bg-primary hover:bg-primary/90" @click="goToAllocateProducts">
                    <Boxes class="size-4" />
                    {{ t('distributors_show.stock_allocation_allocate_products') }}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader class="hidden md:table-header-group">
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="min-w-[220px] rtl:text-right">{{ t('distributors_show.stock_allocation_col_product_name') }}</TableHead>
                  <TableHead class="w-24 text-end rtl:text-right ltr:text-left">{{ t('distributors_show.allocation_quantity') }}</TableHead>
                  <TableHead class="w-28 text-end rtl:text-right ltr:text-left">{{ t('distributors_show.allocation_unit_price') }}</TableHead>
                  <TableHead class="text-end w-24 rtl:text-right">{{ t('distributors_show.stock_allocation_col_sold_quantity') }}</TableHead>
                  <TableHead class="text-end w-24 rtl:text-right ltr:text-left">{{ t('distributors_show.stock_allocation_col_remaining_quantity') }}</TableHead>
                  <TableHead class="rtl:text-right">{{ t('distributors_show.stock_allocation_col_allocation_date') }}</TableHead>
                  <TableHead class="rtl:text-right">{{ t('distributors_show.stock_allocation_col_status') }}</TableHead>
                  <TableHead class="text-end">{{ t('distributors_show.stock_allocation_col_actions') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="allocationsLoading" class="md:table-row">
                  <TableCell :colspan="10" class="py-14 text-center">
                    <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 class="size-4 animate-spin" />
                      {{ t('distributors_show.stock_allocation_loading') }}
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-else-if="allocationsError" class="md:table-row">
                  <TableCell :colspan="10" class="py-14 text-center">
                    <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                      <ShieldAlert class="size-6" />
                      <p class="font-medium">{{ t('distributors_show.stock_allocation_error_title') }}</p>
                      <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                        {{ allocationsError }}
                      </p>
                      <Button variant="outline" size="sm" @click="loadAllocations(allocationsPage)">
                        {{ t('common.retry') }}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-else-if="allocations.length === 0" class="md:table-row">
                  <TableCell :colspan="10" class="py-14 text-center text-sm text-muted-foreground">
                    <div class="flex flex-col items-center gap-2">
                      <Boxes class="size-6 text-muted-foreground" />
                      <p class="font-medium">{{ t('distributors_show.stock_allocation_empty_title') }}</p>
                      <p>{{ t('distributors_show.stock_allocation_empty_hint') }}</p>
                      <Button class="mt-1 h-8 gap-2" @click="goToAllocateProducts">
                        <Boxes class="size-4" />
                        {{ t('distributors_show.stock_allocation_allocate_products') }}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="row in allocations"
                  v-else
                  :key="row.id"
                  class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm
                         md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none
                         hover:bg-muted/30 transition-colors align-middle"
                >
                  <!-- Product (with nested variation + warehouse) -->
                  <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:align-top md:py-4">
                    <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.stock_allocation_col_product_name') }}</span>
                    <div class="flex min-w-0 flex-col gap-1">
                      <span class="font-medium">{{ row.product_name || '—' }}</span>
                      <span class="text-xs text-muted-foreground">{{ row.variation || '—' }}</span>
                      <span class="text-xs text-muted-foreground">{{ row.source_warehouse || '—' }}</span>
                    </div>
                  </TableCell>

                 
                  

                  <!-- Qty (allocated) -->
                  <TableCell class="flex justify-between items-center gap-2 py-1.5 md:table-cell md:py-4 md:text-end rtl:text-right ltr:text-left">
                    <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.allocation_quantity') }}</span>
                    <span class="tabular-nums">{{ formatQty(row.allocated_quantity) }}</span>
                  </TableCell>

                  <!-- Unit Price -->
                  <TableCell class="flex justify-between items-center gap-2 py-1.5 md:table-cell md:py-4 md:text-end rtl:text-right ltr:text-left">
                    <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.allocation_unit_price') }}</span>
                    <span class="tabular-nums">{{ formatMoney(row.unit_price) }}</span>
                  </TableCell>

                 

                  <!-- Sold Qty -->
                  <TableCell class="flex justify-between items-center gap-2 py-1.5 md:table-cell md:py-4 md:text-end rtl:text-right ltr:text-left">
                    <span class="text-xs font-medium text-muted-foreground md:hidden ">{{ t('distributors_show.stock_allocation_col_sold_quantity') }}</span>
                    <span class="tabular-nums">{{ formatQty(row.sold_quantity) }}</span>
                  </TableCell>

                  <!-- Remaining Qty -->
                  <TableCell class="flex justify-between items-center gap-2 py-1.5 md:table-cell md:py-4 md:text-end rtl:text-right ltr:text-left">
                    <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.stock_allocation_col_remaining_quantity') }}</span>
                    <span class="tabular-nums">{{ formatQty(row.remaining_quantity) }}</span>
                  </TableCell>

                  <!-- Date -->
                  <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 ">
                    <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.stock_allocation_col_allocation_date') }}</span>
                    <span>{{ row.allocation_date || '—' }}</span>
                  </TableCell>

                  <!-- Status -->
                  <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 ">
                    <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('distributors_show.stock_allocation_col_status') }}</span>
                    <span
                      class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                      :class="statusBadgeClass(row)"
                    >
                      {{ statusLabel(row) }}
                    </span>
                  </TableCell>

                  <!-- Actions -->
                  <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto md:inline-flex">
                      <Button
                        v-if="canEditAllocation(row)"
                        variant="outline"
                        size="sm"
                        class="w-full sm:w-auto h-8"
                        @click="goToEditAllocation(row)"
                      >
                        {{ t('distributors_show.stock_allocation_action_edit') }}
                      </Button>
                      <Button
                        v-if="canReturnAllocation(row)"
                        variant="outline"
                        size="sm"
                        class="w-full sm:w-auto h-8"
                        @click="allocationToReturn = row"
                      >
                        {{ t('distributors_show.stock_allocation_action_return') }}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div
              v-if="allocationsPagination.last_page > 1 && allocations.length > 0"
              class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t px-4 py-3"
            >
              <p class="text-xs text-muted-foreground">
                {{
                  t('common.showing_range', {
                    from: allocationsPagination.total ? (allocationsPage - 1) * allocationsPagination.per_page + 1 : 0,
                    to: allocationsPagination.total ? Math.min(allocationsPage * allocationsPagination.per_page, allocationsPagination.total) : 0,
                    total: allocationsPagination.total,
                  })
                }}
              </p>
              <PaginationArrowButtons
                :current-page="allocationsPage"
                :last-page="allocationsPagination.last_page"
                :loading="allocationsLoading"
                @prev="goToAllocationPage(allocationsPage - 1)"
                @next="goToAllocationPage(allocationsPage + 1)"
              >
                <span class="text-sm text-muted-foreground px-2 tabular-nums">
                  {{ t('common.page_of', { current: allocationsPage, total: allocationsPagination.last_page }) }}
                </span>
              </PaginationArrowButtons>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>

  <AlertDialog :open="!!distributorToDelete" @update:open="v => { if (!v) distributorToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.delete_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.delete_dialog_body', { name: distributorName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="deleting" @click="deleteDistributor">
          {{ t('common.delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!allocationToReturn" @update:open="v => { if (!v) allocationToReturn = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_show.allocation_return_confirm_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_show.allocation_return_confirm_body', {
            qty: allocationToReturn?.remaining_quantity ?? 0,
            product: allocationToReturn?.product_name || '—',
            warehouse: allocationToReturn?.source_warehouse || '—',
          }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button :disabled="returningAllocation" @click="returnAllocation">
          {{ t('distributors_show.stock_allocation_action_return') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!distributorToDeactivate" @update:open="v => { if (!v) distributorToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.deactivate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.deactivate_dialog_body', { name: distributorName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-amber-600 hover:bg-amber-700 text-white" :disabled="toggling" @click="deactivate">
          {{ t('common.deactivate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!distributorToActivate" @update:open="v => { if (!v) distributorToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.activate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.activate_dialog_body', { name: distributorName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-green-600 hover:bg-green-700 text-white" :disabled="toggling" @click="activate">
          {{ t('common.activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
