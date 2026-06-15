<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Plus, Pencil, Trash2, Copy, Loader2, ShieldAlert, LoaderCircle, Filter, UserX, UserCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
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
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { getErrorMessage } = useApiError()

interface UserRole {
  id: number
  name: string
  name_en: string
  name_ar: string
}

interface UserSummary {
  id: number
  name: string
}

interface UserItem {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  created_at: string
  updated_at: string
  roles: UserRole[]
  is_active: boolean
  is_admin: boolean
  phone: string
  created_by?: UserSummary | number | null
  permissions: string[]
}

interface UsersPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface UsersResponse {
  users?: UserItem[]
  pagination?: UsersPagination
  data?: {
    users?: UserItem[]
    pagination?: UsersPagination
  }
}

interface RoleFilterItem {
  id: number | string
  name_en: string
  name_ar: string
}

interface RolesListResponse {
  roles?: RoleFilterItem[]
  data?: { roles?: RoleFilterItem[] }
}

const { $api } = useApi()
const authStore = useAuthStore()
const { canCreate: uCreate, canEdit: uEdit, canDelete: uDestroy, can } = usePermissions()
const canCreateUser = computed(() => uCreate('users'))
const canEditUser = computed(() => uEdit('users'))
const canDestroyUserPerm = computed(() => uDestroy('users'))
const canShowUser = computed(() => can('users.show'))

const users = ref<UserItem[]>([])
const search = ref('')
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('users_page')
const pagination = ref<UsersPagination | null>(null)
const currentPage = ref(1)

/** API query params: align with backend (e.g. role_id, is_active 0|1) */
const filterRoleId = ref<string>('all')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const rolesForFilter = ref<RoleFilterItem[]>([])
const loadingRolesFilter = ref(false)
const selectedIds = ref<Set<number>>(new Set())
const bulkActivateConfirmOpen = ref(false)
const bulkDeactivateConfirmOpen = ref(false)
const bulkDeleteConfirmOpen = ref(false)
const bulkActionLoading = ref(false)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const loadRolesForFilter = async () => {
  loadingRolesFilter.value = true
  try {
    const data = await $api<RolesListResponse>('/roles', { params: { per_page: 100 } })
    rolesForFilter.value = data.roles ?? data.data?.roles ?? []
  } catch {
    rolesForFilter.value = []
  } finally {
    loadingRolesFilter.value = false
  }
}

const loadUsers = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()

  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      // Username-only search: keep both keys for backend compatibility.
      params.name = query
      params.search = query
    }
    const role = filterRoleId.value
    if (role && role !== 'all') {
      const id = Number(role)
      if (!Number.isNaN(id)) {
        params['filters[0][column]'] = 'role_id'
        params['filters[0][value]'] = id
        params['filters[0][condition]'] = '='
        params['filters[0][operator]'] = 'and'
      }
    }
    if (filterStatus.value === 'active') {
      params['filters[0][column]'] = 'is_active'
      params['filters[0][value]'] = 1
      params['filters[0][condition]'] = '='
      params['filters[0][operator]'] = 'and'
    } else if (filterStatus.value === 'inactive') {
      params['filters[0][column]'] = 'is_active'
      params['filters[0][value]'] = 0
      params['filters[0][condition]'] = '='
      params['filters[0][operator]'] = 'and'
    }

    const data = await $api<UsersResponse>('/users', { params })

    // Handle both response formats: { users, pagination } or { data: { users, pagination } }
    const usersList = data.users ?? data.data?.users ?? []
    const paginationData = data.pagination ?? data.data?.pagination ?? null

    users.value = usersList
    pagination.value = paginationData
    currentPage.value = paginationData?.current_page ?? page
    selectedIds.value = new Set()
  } catch (error: unknown) {
    setListLoadErrorFromException(error)
  } finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadUsers(page)
}

const resetPageAndFetchUsers = () => {
  currentPage.value = 1
  loadUsers(1, search.value.trim())
}

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadUsers(1, value.trim())
  }, 1000)
})

function onRoleFilterChange(value: unknown) {
  filterRoleId.value = value != null && value !== '' ? String(value) : 'all'
  resetPageAndFetchUsers()
}

function onStatusFilterChange(value: unknown) {
  const v = String(value ?? 'all')
  filterStatus.value =
    v === 'active' || v === 'inactive' ? v : 'all'
  resetPageAndFetchUsers()
}

const hasActiveFilters = computed(
  () => filterRoleId.value !== 'all' || filterStatus.value !== 'all',
)
const isAllSelected = computed(
  () => users.value.length > 0 && users.value.every(user => selectedIds.value.has(user.id)),
)
const isIndeterminate = computed(
  () => users.value.some(user => selectedIds.value.has(user.id)) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)
const selectedUsers = computed(() => users.value.filter(user => selectedIds.value.has(user.id)))

const toggleSelectAll = () => {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) users.value.forEach(user => next.delete(user.id))
  else users.value.forEach(user => next.add(user.id))
  selectedIds.value = next
}

const toggleSelect = (id: number) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const rolePrimaryName = (role: { name_ar?: string; name_en?: string; name?: string }) =>
  locale.value === 'ar'
    ? (role.name_ar || role.name_en || role.name || '—')
    : (role.name_en || role.name_ar || role.name || '—')

const handleEdit = (user: UserItem) => {
  navigateTo(`/users/edit/${user.id}`)
}

/** Prefill create form — unique email/phone entered by user before submit */
const cloneUser = (user: UserItem) => {
  navigateTo({ path: '/users/create', query: { from: String(user.id) } })
}

const isSelf = (user: UserItem) => Number(authStore.user?.id) === Number(user.id)

/** Logged-in user is treated as admin (session). */
const isLoggedInAdminSession = computed(() => {
  const me = authStore.user as { is_admin?: boolean; role?: string } | null
  if (!me) return false
  if (me.is_admin === true) return true
  const r = String(me.role || '').toLowerCase()
  return r.includes('admin') || r === 'super_admin'
})

/**
 * Only the admin user's own account cannot be activated/deactivated.
 * Protected when this row is yours and (session is admin OR list marks you as admin).
 */
const cannotToggleUserActivation = (user: UserItem) =>
  isSelf(user) &&
  (isLoggedInAdminSession.value || user.is_admin === true)

/** Endpoint marks admin accounts — delete is not offered for them */
const canDeleteUserRow = (user: UserItem) => user.is_admin !== true
const canActivateSelected = computed(
  () => canEditUser.value && selectedUsers.value.some(user => !user.is_active && !cannotToggleUserActivation(user)),
)
const canDeactivateSelected = computed(
  () => canEditUser.value && selectedUsers.value.some(user => user.is_active && !cannotToggleUserActivation(user)),
)
const canDeleteSelected = computed(
  () => canDestroyUserPerm.value && selectedUsers.value.some(user => canDeleteUserRow(user)),
)

function buildUserStatusBody(user: UserItem, is_active: boolean) {
  const email = user.email?.trim() ?? ''
  return {
    name: user.name.trim(),
    phone: user.phone?.trim() || undefined,
    email: email || undefined,
    is_active,
    role_ids: user.roles?.map(r => r.id) ?? [],
  }
}

const userToDeactivate = ref<UserItem | null>(null)
const togglingActiveId = ref<number | null>(null)

const openDeactivateConfirm = (user: UserItem) => {
  if (cannotToggleUserActivation(user)) {
    toast.error(t('errors.cannot_toggle_admin_account'))
    return
  }
  userToDeactivate.value = user
}

const confirmDeactivate = async () => {
  const user = userToDeactivate.value
  if (!user) return

  togglingActiveId.value = user.id
  userToDeactivate.value = null

  try {
    await $api(`/users/${user.id}`, {
      method: 'PUT',
      body: buildUserStatusBody(user, false),
    })
    toast.success(t('toasts.user_deactivated'))
    await loadUsers(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    togglingActiveId.value = null
  }
}

const reactivateUser = async (user: UserItem) => {
  if (cannotToggleUserActivation(user)) {
    toast.error(t('errors.cannot_toggle_admin_account'))
    return
  }
  togglingActiveId.value = user.id
  try {
    await $api(`/users/${user.id}`, {
      method: 'PUT',
      body: buildUserStatusBody(user, true),
    })
    toast.success(t('toasts.user_reactivated'))
    await loadUsers(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    togglingActiveId.value = null
  }
}

const deletingId = ref<number | null>(null)
const userToDelete = ref<UserItem | null>(null)

const confirmDelete = async () => {
  if (!userToDelete.value) return
  if (userToDelete.value.is_admin === true) {
    userToDelete.value = null
    return
  }

  const user = userToDelete.value
  deletingId.value = user.id
  userToDelete.value = null

  try {
    await $api(`/users/${user.id}`, { method: 'DELETE' })
    toast.success(t('toasts.user_deleted_named', { name: user.name }))
    await loadUsers(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    deletingId.value = null
  }
}

const runBulkActivate = async () => {
  const eligible = selectedUsers.value.filter(user => !user.is_active && !cannotToggleUserActivation(user))
  if (!eligible.length) return
  bulkActivateConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(
      eligible.map(user => $api(`/users/${user.id}`, {
        method: 'PUT',
        body: buildUserStatusBody(user, true),
      })),
    )
    toast.success(t('common.bulk_activated_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadUsers(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    bulkActionLoading.value = false
  }
}

const runBulkDeactivate = async () => {
  const eligible = selectedUsers.value.filter(user => user.is_active && !cannotToggleUserActivation(user))
  if (!eligible.length) return
  bulkDeactivateConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(
      eligible.map(user => $api(`/users/${user.id}`, {
        method: 'PUT',
        body: buildUserStatusBody(user, false),
      })),
    )
    toast.success(t('common.bulk_deactivated_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadUsers(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    bulkActionLoading.value = false
  }
}

const runBulkDelete = async () => {
  const eligible = selectedUsers.value.filter(user => canDeleteUserRow(user))
  if (!eligible.length) return
  bulkDeleteConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(eligible.map(user => $api(`/users/${user.id}`, { method: 'DELETE' })))
    toast.success(t('common.bulk_deleted_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadUsers(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    bulkActionLoading.value = false
  }
}

const formatDate = (dateStr: string | null) => {
  return formatDisplayDate(dateStr)
}

const statusConfig = (isActive: boolean) =>
  isActive
    ? {
        label: t('common.active'),
        class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      }
    : {
        label: t('common.inactive'),
        class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      }

const rolesDisplay = (roles: UserRole[], maxWords = 8) => {
  if (!roles?.length) return '—'
  const sep = locale.value === 'ar' ? '، ' : ', '
  const full = roles.map(r => rolePrimaryName(r)).join(sep)
  const words = full.split(/[\s،]+/).filter(Boolean)
  if (words.length <= maxWords) return full
  return words.slice(0, maxWords).join(' ') + '...'
}

const createdByDisplay = (value?: UserItem['created_by']) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

onMounted(() => {
  loadRolesForFilter()
  loadUsers()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('users_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('users_page.subtitle') }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 sm:flex-1">
        <div class="relative w-full sm:w-80">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            :placeholder="t('users_page.search_placeholder')"
            class="pr-9 w-full h-9"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
          />
        </div>

        <Select :model-value="filterRoleId" @update:model-value="onRoleFilterChange">
          <SelectTrigger class="w-full sm:w-[14rem] h-9 gap-2" :disabled="loadingRolesFilter">
            <Filter class="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue :placeholder="t('users_page.filter_role')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('users_page.all_roles') }}</SelectItem>
            <SelectItem
              v-for="role in rolesForFilter"
              :key="role.id"
              :value="String(role.id)"
            >
              {{ rolePrimaryName(role) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-full sm:w-[11rem] h-9">
            <SelectValue :placeholder="t('users_page.filter_status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('common.all_statuses') }}</SelectItem>
            <SelectItem value="active">{{ t('common.active') }}</SelectItem>
            <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        v-if="canCreateUser"
        class="gap-2 bg-primary hover:bg-primary/90 text-white w-full sm:w-auto"
        as-child
      >
        <NuxtLink to="/users/create">
          <Plus class="size-4" />
          {{ t('users_page.create_user') }}
        </NuxtLink>
      </Button>
    </div>
    <div
      v-if="selectedCount > 0"
      class="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 flex-wrap"
    >
      <span class="text-sm font-medium text-emerald-700">
        {{ t('common.bulk_status_actions_notice', { count: selectedCount }) }}
      </span>
      <div class="flex items-center gap-2 ms-auto">
        <Button variant="outline" size="sm" class="h-8" :disabled="bulkActionLoading || !canActivateSelected" @click="bulkActivateConfirmOpen = true">
          {{ t('common.activate') }}
        </Button>
        <Button variant="outline" size="sm" class="h-8" :disabled="bulkActionLoading || !canDeactivateSelected" @click="bulkDeactivateConfirmOpen = true">
          {{ t('common.deactivate') }}
        </Button>
        <Button variant="outline" size="sm" class="h-8 text-red-600 border-red-300 hover:bg-red-100" :disabled="bulkActionLoading || !canDeleteSelected" @click="bulkDeleteConfirmOpen = true">
          {{ t('common.delete') }}
        </Button>
        <Button variant="ghost" size="sm" class="h-8 text-muted-foreground" @click="selectedIds = new Set()">
          {{ t('common.deselect') }}
        </Button>
      </div>
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader class="hidden md:table-header-group">
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="w-10 text-center">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="text-start font-medium">{{ t('users_page.col_name') }}</TableHead>
            <TableHead class="text-start font-medium">{{ t('users_page.col_email') }}</TableHead>
            <TableHead class="text-start font-medium">{{ t('users_page.col_phone') }}</TableHead>
            <TableHead class="text-start font-medium">{{ t('users_page.col_roles') }}</TableHead>
            <TableHead class="text-start font-medium">{{ t('users_page.col_active') }}</TableHead>
            <TableHead class="text-start font-medium">{{ t('users_page.col_added_by') }}</TableHead>
            <TableHead class="text-end font-medium tabular-nums">{{ t('users_page.col_created') }}</TableHead>
            <TableHead class="text-end font-medium">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-if="loading" class="md:table-row">
            <TableCell :colspan="9" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('users_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="listLoadError" class="md:table-row">
            <TableCell :colspan="9" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadUsers">{{ t('common.retry') }}</Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="users.length === 0" class="md:table-row">
            <TableCell :colspan="9" class="py-14 text-center text-sm text-muted-foreground">
              {{
                search || hasActiveFilters
                  ? t('users_page.no_results')
                  : t('users_page.no_users')
              }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="user in users"
            v-else
            :key="user.id"
            class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none hover:bg-muted/30 transition-colors align-middle"
            :class="{ 'bg-muted/20': selectedIds.has(user.id) }"
          >
            <TableCell class="flex items-center justify-between gap-2 py-1.5 border-b md:w-10 md:table-cell md:py-4 md:border-0">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.select') }}</span>
              <Checkbox
                :model-value="selectedIds.has(user.id)"
                class="md:mt-0.5 md:mx-4"
                @update:model-value="toggleSelect(user.id)"
              />
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_name') }}</span>
              <div class="font-medium">
                <NuxtLink
                  v-if="canShowUser"
                  :to="`/users/show/${user.id}`"
                  class="text-sm text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-end md:text-start cursor-pointer"
                >
                  {{ user.name }}
                </NuxtLink>
                <span v-else class="text-sm">{{ user.name }}</span>
              </div>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_email') }}</span>
              <span class="text-sm">{{ user.email }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_phone') }}</span>
              <span class="text-sm">{{ user.phone || '—' }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_roles') }}</span>
              <span class="text-sm">{{ rolesDisplay(user.roles) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_active') }}</span>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                :class="statusConfig(user.is_active).class"
              >
                {{ statusConfig(user.is_active).label }}
              </span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_added_by') }}</span>
              <span class="text-sm text-muted-foreground">{{ createdByDisplay(user.created_by) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('users_page.col_created') }}</span>
              <span class="text-sm text-muted-foreground tabular-nums">{{ formatDate(user.created_at) }}</span>
            </TableCell>
            <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
              <TableRowActions
                :actions="[
                  { key: `deactivate-${user.id}`, label: t('common.deactivate'), type: 'button', icon: UserX, tone: 'warning', visible: canEditUser && user.is_active && !cannotToggleUserActivation(user), disabled: togglingActiveId === user.id || deletingId === user.id, loading: togglingActiveId === user.id, onClick: () => openDeactivateConfirm(user) },
                  { key: `activate-${user.id}`, label: t('common.activate'), type: 'button', icon: UserCheck, tone: 'success', visible: canEditUser && !user.is_active && !cannotToggleUserActivation(user), disabled: togglingActiveId === user.id || deletingId === user.id, loading: togglingActiveId === user.id, onClick: () => reactivateUser(user) },
                  { key: `edit-${user.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canEditUser, onClick: () => handleEdit(user) },
                  { key: `clone-${user.id}`, label: t('users_page.clone'), type: 'button', icon: Copy, tone: 'muted', visible: canCreateUser, disabled: deletingId === user.id || togglingActiveId === user.id, onClick: () => cloneUser(user) },
                  { key: `delete-${user.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDestroyUserPerm && canDeleteUserRow(user), disabled: deletingId === user.id, loading: deletingId === user.id, onClick: () => { userToDelete = user } },
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
            t('users_page.pagination', {
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
            <span
              v-else-if="page === 2 && currentPage > 3"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
            <span
              v-else-if="page === pagination.last_page - 1 && currentPage < pagination.last_page - 2"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
          </template>

        </PaginationArrowButtons>
      </div>

      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('users_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>
  </div>

  <AlertDialog :open="!!userToDelete" @update:open="val => { if (!val) userToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('users_page.alert_delete_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right">
          {{ t('users_page.alert_delete_body', { name: userToDelete?.name ?? '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="!!deletingId"
          @click="confirmDelete"
        >
          <LoaderCircle v-if="deletingId" class="size-4 animate-spin" />
          {{ t('users_page.alert_delete_confirm') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!userToDeactivate" @update:open="val => { if (!val) userToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('users_page.alert_deactivate_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>
            {{ t('users_page.alert_deactivate_p1', { name: userToDeactivate?.name ?? '' }) }}
          </p>
          <p>
            {{ t('users_page.alert_deactivate_p2') }}
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-amber-600 hover:bg-amber-700 text-white"
          :disabled="!!togglingActiveId"
          @click="confirmDeactivate"
        >
          <LoaderCircle v-if="togglingActiveId" class="size-4 animate-spin" />
          {{ t('users_page.alert_deactivate_confirm') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <AlertDialog :open="bulkActivateConfirmOpen" @update:open="bulkActivateConfirmOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.bulk_activate_selected_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('common.bulk_activate_selected_body') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button :disabled="bulkActionLoading" class="bg-emerald-600 hover:bg-emerald-700 text-white" @click="runBulkActivate">
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin" />
          {{ t('common.activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="bulkDeactivateConfirmOpen" @update:open="bulkDeactivateConfirmOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.bulk_deactivate_selected_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('common.bulk_deactivate_selected_body') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button :disabled="bulkActionLoading" class="bg-amber-600 hover:bg-amber-700 text-white" @click="runBulkDeactivate">
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin" />
          {{ t('common.deactivate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="bulkDeleteConfirmOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.bulk_delete_selected_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('common.bulk_delete_selected_body', { count: selectedCount }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button :disabled="bulkActionLoading" class="bg-red-600 hover:bg-red-700 text-white" @click="runBulkDelete">
          <LoaderCircle v-if="bulkActionLoading" class="size-4 animate-spin" />
          {{ t('common.delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
