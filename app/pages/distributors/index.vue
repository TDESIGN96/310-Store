<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Plus, Pencil, Trash2, Loader2, ShieldAlert, UserX, UserCheck, Eye, Boxes } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
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

definePageMeta({ layout: 'default' })

interface DistributorItem {
  id: number
  name_en: string
  name_ar: string
  mobile: string
  email: string
  address: string
  admin_name: string
  admin_mobile: string
  location: string
  description: string
  status: string
  created_at?: string | null
}

interface ListPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface DistributorListResponse {
  distributors?: unknown[]
  pagination?: ListPagination
  data?: {
    distributors?: unknown[]
    pagination?: ListPagination
  }
}

const { t, locale } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canCreate, canEdit, canDelete, canAccess, can } = usePermissions()

const canCreateDistributor = computed(() => canCreate('distributors'))
const canEditDistributor = computed(() => canEdit('distributors'))
const canDeleteDistributor = computed(() => canDelete('distributors'))
const canShowDistributor = computed(() => can('distributors.show') || canAccess('distributors'))

const rows = ref<DistributorItem[]>([])
const loading = ref(false)
const pagination = ref<ListPagination | null>(null)
const currentPage = ref(1)
const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const filterLocation = ref('all')
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('distributors_page')

const distributorToDelete = ref<DistributorItem | null>(null)
const distributorToDeactivate = ref<DistributorItem | null>(null)
const distributorToActivate = ref<DistributorItem | null>(null)
const deletingId = ref<number | null>(null)
const togglingId = ref<number | null>(null)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const getString = (value: unknown) => (typeof value === 'string' ? value : '')
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'

const statusText = (value: unknown) => {
  const status = getString(value).toLowerCase()
  if (status === 'active' || status === 'inactive') return status
  if (value === true || value === 1 || value === '1') return 'active'
  if (value === false || value === 0 || value === '0') return 'inactive'
  return 'inactive'
}

const normalizeDistributor = (raw: unknown): DistributorItem | null => {
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
    mobile: getString(raw.mobile || raw.mobile_number || raw.phone),
    email: getString(raw.email),
    address: getString(raw.address),
    admin_name: getString(raw.admin_name || admin?.name || user?.name || raw.primary_admin_name),
    admin_mobile: getString(raw.admin_mobile || raw.admin_mobile_number || admin?.mobile || admin?.phone || user?.mobile || user?.phone),
    location: getString(raw.location || raw.city || raw.location_city),
    description: getString(raw.description),
    status: statusText(raw.status ?? raw.is_active),
    created_at: getString(raw.created_at || raw.createdAt) || null,
  }
}

const distributorDisplayName = (row: DistributorItem) =>
  locale.value === 'ar'
    ? (row.name_ar || row.name_en || `#${row.id}`)
    : (row.name_en || row.name_ar || `#${row.id}`)

const statusConfig = (status: string) => {
  const s = String(status || '').toLowerCase()
  if (s === 'active') {
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

const locationOptions = computed(() => {
  const set = new Set<string>()
  rows.value.forEach((row) => {
    const value = row.location.trim()
    if (value) set.add(value)
  })
  return [...set].sort((a, b) => a.localeCompare(b))
})

const loadDistributors = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()
  try {
    const params: Record<string, string | number> = {
      page,
      'sortBy[column]': 'created_at',
      'sortBy[direction]': 'desc',
    }

    if (query) {
      params.search = query
      params.name = query
      params.admin_name = query
    }

    let filterIndex = 0
    if (filterStatus.value !== 'all') {
      params[`filters[${filterIndex}][column]`] = 'status'
      params[`filters[${filterIndex}][value]`] = filterStatus.value
      params[`filters[${filterIndex}][condition]`] = '='
      params[`filters[${filterIndex}][operator]`] = 'and'
      filterIndex += 1
    }
    if (filterLocation.value !== 'all') {
      params[`filters[${filterIndex}][column]`] = 'location'
      params[`filters[${filterIndex}][value]`] = filterLocation.value
      params[`filters[${filterIndex}][condition]`] = '='
      params[`filters[${filterIndex}][operator]`] = 'and'
    }

    const res = await $api<DistributorListResponse>('/distributors', { params })
    const listRaw = res.data?.distributors ?? res.distributors ?? []
    const list = listRaw.map(item => normalizeDistributor(item)).filter((v): v is DistributorItem => !!v)
    rows.value = list
    pagination.value = res.data?.pagination ?? res.pagination ?? null
    currentPage.value = pagination.value?.current_page ?? page
  }
  catch (error: unknown) {
    setListLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadDistributors(page)
}

const resetAndReload = () => {
  currentPage.value = 1
  loadDistributors(1, search.value.trim())
}

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadDistributors(1, value.trim())
  }, 500)
})

const onStatusFilterChange = (value: unknown) => {
  const v = String(value ?? 'all')
  filterStatus.value = v === 'active' || v === 'inactive' ? v : 'all'
  resetAndReload()
}

const onLocationFilterChange = (value: unknown) => {
  filterLocation.value = String(value ?? 'all') || 'all'
  resetAndReload()
}

const hasActiveFilters = computed(() => filterStatus.value !== 'all' || filterLocation.value !== 'all')
const emptyListMessage = computed(() => {
  if (rows.value.length > 0) return ''
  if (loading.value || listLoadError.value) return ''
  if (search.value.trim() || hasActiveFilters.value) return t('distributors_page.empty_search')
  return t('distributors_page.empty_list')
})

const buildDistributorStatusBody = (row: DistributorItem, status: 'active' | 'inactive') => ({
  name_en: row.name_en.trim(),
  name_ar: row.name_ar.trim(),
  mobile: row.mobile.trim(),
  email: row.email.trim() || undefined,
  address: row.address.trim() || undefined,
  city: row.location.trim(),
  description: row.description.trim() || undefined,
  admin_name: row.admin_name.trim(),
  admin_mobile: row.admin_mobile.trim() || undefined,
  status,
})

const confirmDeactivate = async () => {
  const row = distributorToDeactivate.value
  if (!row) return
  togglingId.value = row.id
  distributorToDeactivate.value = null
  try {
    await $api(`/distributors/${row.id}`, {
      method: 'PUT',
      body: buildDistributorStatusBody(row, 'inactive'),
    })
    toast.success(t('distributors_page.deactivate_success', { name: distributorDisplayName(row) }))
    await loadDistributors(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    togglingId.value = null
  }
}

const confirmActivate = async () => {
  const row = distributorToActivate.value
  if (!row) return
  togglingId.value = row.id
  distributorToActivate.value = null
  try {
    await $api(`/distributors/${row.id}`, {
      method: 'PUT',
      body: buildDistributorStatusBody(row, 'active'),
    })
    toast.success(t('distributors_page.activate_success', { name: distributorDisplayName(row) }))
    await loadDistributors(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    togglingId.value = null
  }
}

const confirmDelete = async () => {
  const row = distributorToDelete.value
  if (!row) return
  deletingId.value = row.id
  distributorToDelete.value = null
  try {
    await $api(`/distributors/${row.id}`, { method: 'DELETE' })
    toast.success(t('distributors_page.delete_success', { name: distributorDisplayName(row) }))
    await loadDistributors(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    deletingId.value = null
  }
}

onMounted(() => {
  if (!canAccess('distributors')) return
  loadDistributors()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('distributors_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('distributors_page.subtitle') }}
        </p>
      </div>
      <Button
        v-if="canCreateDistributor"
        class="gap-2 bg-[#215260] hover:bg-[#184754]"
        as-child
      >
        <NuxtLink to="/distributors/create">
          <Plus class="size-4" />
          {{ t('distributors_page.add_distributor') }}
        </NuxtLink>
      </Button>
    </div>

    <div class="rounded-xl border bg-card overflow-hidden">
      <div class="p-4 border-b flex flex-col md:flex-row md:items-center gap-3">
        <div class="relative flex-1">
          <Search class="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            class="ps-9 h-10"
            :placeholder="t('distributors_page.search_placeholder')"
          />
        </div>
        <Select :model-value="filterLocation" @update:model-value="onLocationFilterChange">
          <SelectTrigger class="w-full md:w-[200px]">
            <SelectValue :placeholder="t('distributors_page.filter_location')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('common.all') }}</SelectItem>
            <SelectItem v-for="location in locationOptions" :key="location" :value="location">{{ location }}</SelectItem>
          </SelectContent>
        </Select>
        <Select :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-full md:w-[180px]">
            <SelectValue :placeholder="t('distributors_page.filter_status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('common.all') }}</SelectItem>
            <SelectItem value="active">{{ t('common.active') }}</SelectItem>
            <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="font-medium">{{ t('distributors_page.col_name') }}</TableHead>
            <TableHead class="font-medium">{{ t('distributors_page.col_admin_name') }}</TableHead>
            <TableHead class="font-medium">{{ t('distributors_page.col_location') }}</TableHead>
            <TableHead class="font-medium">{{ t('distributors_page.col_status') }}</TableHead>
            <TableHead class="text-end font-medium">{{ t('distributors_page.col_actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="5" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('distributors_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="listLoadError">
            <TableCell :colspan="5" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadDistributors()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="rows.length === 0">
            <TableCell :colspan="5" class="py-14 text-center text-sm text-muted-foreground">
              {{ emptyListMessage }}
            </TableCell>
          </TableRow>

          <TableRow v-for="row in rows" v-else :key="row.id" class="hover:bg-muted/30 transition-colors align-middle">
            <TableCell class="font-medium">
              <button
                v-if="canShowDistributor"
                type="button"
                class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-start cursor-pointer"
                @click="navigateTo(`/distributors/show/${row.id}`)"
              >
                {{ distributorDisplayName(row) }}
              </button>
              <span v-else>{{ distributorDisplayName(row) }}</span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">{{ row.admin_name || '—' }}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{{ row.location || '—' }}</TableCell>
            <TableCell>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                :class="statusConfig(row.status).class"
              >
                {{ statusConfig(row.status).label }}
              </span>
            </TableCell>
            <TableCell class="text-end">
              <TableRowActions
                :actions="[
                  { key: `view-${row.id}`, label: t('common.view'), type: 'button', icon: Eye, tone: 'muted', visible: canShowDistributor, onClick: () => navigateTo(`/distributors/show/${row.id}`) },
                  { key: `edit-${row.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canEditDistributor, onClick: () => navigateTo(`/distributors/edit/${row.id}`) },
                  { key: `stock-allocation-${row.id}`, label: t('distributors_page.stock_allocation'), type: 'button', icon: Boxes, tone: 'muted', visible: canShowDistributor, onClick: () => navigateTo({ path: `/distributors/show/${row.id}`, query: { tab: 'stock-allocation' } }) },
                  { key: `deactivate-${row.id}`, label: t('common.deactivate'), type: 'button', icon: UserX, tone: 'warning', visible: canEditDistributor && row.status === 'active', disabled: togglingId === row.id || deletingId === row.id, loading: togglingId === row.id, onClick: () => { distributorToDeactivate = row } },
                  { key: `activate-${row.id}`, label: t('common.activate'), type: 'button', icon: UserCheck, tone: 'success', visible: canEditDistributor && row.status !== 'active', disabled: togglingId === row.id || deletingId === row.id, loading: togglingId === row.id, onClick: () => { distributorToActivate = row } },
                  { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteDistributor, disabled: togglingId === row.id || deletingId === row.id, loading: deletingId === row.id, onClick: () => { distributorToDelete = row } },
                ]"
                variant="link"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">
          {{
            t('distributors_page.pagination', {
              from: (currentPage - 1) * pagination.per_page + 1,
              to: Math.min(currentPage * pagination.per_page, pagination.total),
              total: pagination.total,
            })
          }}
        </p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loading"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        >
          <template v-for="page in pagination.last_page" :key="page">
            <Button
              v-if="page === 1 || page === pagination.last_page || Math.abs(page - currentPage) <= 1"
              :variant="page === currentPage ? 'default' : 'outline'"
              size="icon"
              class="size-8 text-xs"
              :disabled="loading"
              @click="goToPage(page)"
            >
              {{ page }}
            </Button>
            <span v-else-if="page === 2 && currentPage > 3" class="px-1 text-muted-foreground text-sm">...</span>
            <span v-else-if="page === pagination.last_page - 1 && currentPage < pagination.last_page - 2" class="px-1 text-muted-foreground text-sm">...</span>
          </template>
        </PaginationArrowButtons>
      </div>

      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('distributors_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>
  </div>

  <AlertDialog :open="!!distributorToDelete" @update:open="v => { if (!v) distributorToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.delete_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.delete_dialog_body', { name: distributorToDelete ? distributorDisplayName(distributorToDelete) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="!!deletingId" @click="confirmDelete">
          {{ t('common.delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!distributorToDeactivate" @update:open="v => { if (!v) distributorToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.deactivate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.deactivate_dialog_body', { name: distributorToDeactivate ? distributorDisplayName(distributorToDeactivate) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-amber-600 hover:bg-amber-700 text-white" :disabled="!!togglingId" @click="confirmDeactivate">
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
          {{ t('distributors_page.activate_dialog_body', { name: distributorToActivate ? distributorDisplayName(distributorToActivate) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-green-600 hover:bg-green-700 text-white" :disabled="!!togglingId" @click="confirmActivate">
          {{ t('common.activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
