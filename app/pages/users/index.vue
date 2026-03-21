<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Plus, Pencil, Trash2, Loader2, ShieldAlert, ChevronRight, ChevronLeft, LoaderCircle, Filter, UserX, UserCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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

interface UserRole {
  id: number
  name: string
  name_en: string
  name_ar: string
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

const users = ref<UserItem[]>([])
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const pagination = ref<UsersPagination | null>(null)
const currentPage = ref(1)

/** API query params: align with backend (e.g. role_id, is_active 0|1) */
const filterRoleId = ref<string>('all')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const rolesForFilter = ref<RoleFilterItem[]>([])
const loadingRolesFilter = ref(false)

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
  errorMessage.value = ''

  try {
    const params: Record<string, string | number> = { page }
    if (query) params.search = query
    const role = filterRoleId.value
    if (role && role !== 'all') {
      const id = Number(role)
      if (!Number.isNaN(id)) params.role_id = id
    }
    if (filterStatus.value === 'active') {
      params.is_active = 1
    } else if (filterStatus.value === 'inactive') {
      params.is_active = 0
    }

    const data = await $api<UsersResponse>('/users', { params })

    // Handle both response formats: { users, pagination } or { data: { users, pagination } }
    const usersList = data.users ?? data.data?.users ?? []
    const paginationData = data.pagination ?? data.data?.pagination ?? null

    users.value = usersList
    pagination.value = paginationData
    currentPage.value = paginationData?.current_page ?? page
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? 'تعذر تحميل قائمة المستخدمين حالياً'
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

const handleEdit = (user: UserItem) => {
  navigateTo(`/users/edit/${user.id}`)
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
    toast.error('لا يمكن إيقاف أو تفعيل حساب المدير')
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
    toast.success('تم إيقاف حساب المستخدم بنجاح')
    await loadUsers(currentPage.value)
  } catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      'تعذر إيقاف الحساب حالياً'
    toast.error(msg)
  } finally {
    togglingActiveId.value = null
  }
}

const reactivateUser = async (user: UserItem) => {
  if (cannotToggleUserActivation(user)) {
    toast.error('لا يمكن إيقاف أو تفعيل حساب المدير')
    return
  }
  togglingActiveId.value = user.id
  try {
    await $api(`/users/${user.id}`, {
      method: 'PUT',
      body: buildUserStatusBody(user, true),
    })
    toast.success('تم تفعيل حساب المستخدم بنجاح')
    await loadUsers(currentPage.value)
  } catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      'تعذر تفعيل الحساب حالياً'
    toast.error(msg)
  } finally {
    togglingActiveId.value = null
  }
}

const deletingId = ref<number | null>(null)
const userToDelete = ref<UserItem | null>(null)

const confirmDelete = async () => {
  if (!userToDelete.value) return

  const user = userToDelete.value
  deletingId.value = user.id
  userToDelete.value = null

  try {
    await $api(`/users/${user.id}`, { method: 'DELETE' })
    toast.success(`تم حذف "${user.name}" بنجاح`)
    await loadUsers(currentPage.value)
  } catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      'تعذر حذف المستخدم حالياً'
    toast.error(msg)
  } finally {
    deletingId.value = null
  }
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

const rolesDisplay = (roles: UserRole[], maxWords = 8) => {
  if (!roles?.length) return '—'
  const full = roles.map(r => r.name_ar || r.name_en || r.name).join('، ')
  const words = full.split(/[\s،]+/).filter(Boolean)
  if (words.length <= maxWords) return full
  return words.slice(0, maxWords).join(' ') + '...'
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
        <h1 class="text-2xl font-bold tracking-tight">إدارة المستخدمين</h1>
        <p class="text-sm text-muted-foreground mt-1">
          إدارة حسابات المستخدمين وصلاحياتهم
        </p>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            placeholder="ابحث بالاسم أو البريد الإلكتروني..."
            class="pr-9 w-80 h-9"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
          />
        </div>

        <Select :model-value="filterRoleId" @update:model-value="onRoleFilterChange">
          <SelectTrigger class="w-[min(100%,14rem)] h-9 gap-2" :disabled="loadingRolesFilter">
            <Filter class="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="الدور" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأدوار</SelectItem>
            <SelectItem
              v-for="role in rolesForFilter"
              :key="role.id"
              :value="String(role.id)"
            >
              {{ role.name_ar || role.name_en }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select :model-value="filterStatus" @update:model-value="onStatusFilterChange">
          <SelectTrigger class="w-[min(100%,11rem)] h-9">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
        <NuxtLink to="/users/create">
          <Plus class="size-4" />
          إنشاء مستخدم
        </NuxtLink>
      </Button>
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="text-right font-medium">الاسم</TableHead>
            <TableHead class="text-right font-medium">البريد الإلكتروني</TableHead>
            <TableHead class="text-right font-medium">الهاتف</TableHead>
            <TableHead class="text-right font-medium">الأدوار</TableHead>
            <TableHead class="text-right font-medium">نشط</TableHead>
            <TableHead class="text-right font-medium">تاريخ الإنشاء</TableHead>
            <TableHead class="text-right font-medium">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="7" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                جاري تحميل المستخدمين...
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="errorMessage">
            <TableCell :colspan="7" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <span>{{ errorMessage }}</span>
                <Button variant="outline" size="sm" @click="loadUsers">إعادة المحاولة</Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="users.length === 0">
            <TableCell :colspan="7" class="py-14 text-center text-sm text-muted-foreground">
              {{
                search || hasActiveFilters
                  ? 'لا توجد نتائج مطابقة للبحث أو الفلاتر'
                  : 'لا يوجد مستخدمون'
              }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="user in users"
            v-else
            :key="user.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <TableCell class="font-medium">
              <NuxtLink
                :to="`/users/show/${user.id}`"
                class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {{ user.name }}
              </NuxtLink>
            </TableCell>
            <TableCell>{{ user.email }}</TableCell>
            <TableCell>{{ user.phone || '—' }}</TableCell>
            <TableCell class="text-sm">{{ rolesDisplay(user.roles) }}</TableCell>
            <TableCell>
              <span
                :class="user.is_active ? 'text-green-600' : 'text-muted-foreground'"
                class="text-sm"
              >
                {{ user.is_active ? 'نعم' : 'لا' }}
              </span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">{{ formatDate(user.created_at) }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <button
                  v-if="user.is_active && !cannotToggleUserActivation(user)"
                  type="button"
                  class="inline-flex items-center gap-1 text-amber-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="togglingActiveId === user.id || deletingId === user.id"
                  @click="openDeactivateConfirm(user)"
                >
                  <LoaderCircle v-if="togglingActiveId === user.id" class="size-3.5 animate-spin" />
                  <UserX v-else class="size-3.5" />
                  إيقاف
                </button>
                <button
                  v-else-if="!user.is_active && !cannotToggleUserActivation(user)"
                  type="button"
                  class="inline-flex items-center gap-1 text-green-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="togglingActiveId === user.id || deletingId === user.id"
                  @click="reactivateUser(user)"
                >
                  <LoaderCircle v-if="togglingActiveId === user.id" class="size-3.5 animate-spin" />
                  <UserCheck v-else class="size-3.5" />
                  تفعيل
                </button>
                <button
                  class="inline-flex items-center gap-1 text-[#2563eb] hover:underline"
                  @click="handleEdit(user)"
                >
                  <Pencil class="size-3.5" />
                  تعديل
                </button>
                <button
                  class="inline-flex items-center gap-1 text-red-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="deletingId === user.id"
                  @click="userToDelete = user"
                >
                  <LoaderCircle v-if="deletingId === user.id" class="size-3.5 animate-spin" />
                  <Trash2 v-else class="size-3.5" />
                  حذف
                </button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">
          عرض {{ (currentPage - 1) * pagination.per_page + 1 }}–{{ Math.min(currentPage * pagination.per_page, pagination.total) }} من إجمالي {{ pagination.total }} مستخدم
        </p>

        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="currentPage <= 1 || loading"
            @click="goToPage(currentPage - 1)"
          >
            <ChevronRight class="size-4" />
          </Button>

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

          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="currentPage >= pagination.last_page || loading"
            @click="goToPage(currentPage + 1)"
          >
            <ChevronLeft class="size-4" />
          </Button>
        </div>
      </div>

      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">إجمالي {{ pagination.total }} مستخدم</p>
      </div>
    </div>
  </div>

  <AlertDialog :open="!!userToDelete" @update:open="val => { if (!val) userToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
        <AlertDialogDescription>
          هل أنت متأكد من حذف المستخدم
          <span class="font-semibold text-foreground">{{ userToDelete?.name }}</span>؟
          لا يمكن التراجع عن هذا الإجراء.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="!!deletingId"
          @click="confirmDelete"
        >
          <LoaderCircle v-if="deletingId" class="size-4 animate-spin" />
          نعم، احذف
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!userToDeactivate" @update:open="val => { if (!val) userToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>تأكيد إيقاف الحساب</AlertDialogTitle>
        <AlertDialogDescription class="space-y-2">
          <p>
            هل أنت متأكد من إيقاف حساب المستخدم
            <span class="font-semibold text-foreground">{{ userToDeactivate?.name }}</span>؟
          </p>
          <p>
            بعد التأكيد لن يتمكن من تسجيل الدخول إلى النظام. يمكنك تفعيل الحساب لاحقاً من نفس القائمة.
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>إلغاء</AlertDialogCancel>
        <Button
          class="bg-amber-600 hover:bg-amber-700 text-white"
          :disabled="!!togglingActiveId"
          @click="confirmDeactivate"
        >
          <LoaderCircle v-if="togglingActiveId" class="size-4 animate-spin" />
          نعم، أوقف الحساب
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
