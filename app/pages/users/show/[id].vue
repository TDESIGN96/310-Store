<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, User, Mail, Phone, ShieldCheck, Calendar, CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
import { permissionIdSet } from '@/config/permissions'
import { normalizeLoadedPermissions, type RolePermissionModule } from '@/utils/rolePermissions'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { actionLabel } = usePermissionI18n()
const { getErrorMessage } = useApiError()

const { canAccess, canEdit: uEdit, canDelete: uDelete } = usePermissions()
const canView = computed(() => canAccess('users'))
const canEdit = computed(() => uEdit('users'))
const canDeleteRow = computed(() => {
  if (!uDelete('users') || !user.value) return false
  return user.value.is_admin !== true
})

const showDeleteDialog = ref(false)
const deleting = ref(false)

interface UserRole {
  id: number
  name: string
  name_en: string
  name_ar: string
}

interface RoleItem {
  id: number | string
  name_en: string
  name_ar: string
}

interface RolesResponse {
  roles?: RoleItem[]
  data?: { roles?: RoleItem[] }
}

interface UserData {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  created_by?: number | null
  updated_by?: number | null
  created_at: string
  updated_at: string
  roles: UserRole[]
  is_active: boolean
  is_admin: boolean
  phone: string
  permissions: string[]
}

type UserDataApi = Omit<UserData, 'permissions'> & {
  permissions?: Array<string | RolePermissionModule>
}

interface UserResponse {
  user?: UserData
  data?: UserData | { user?: UserData }
}

const route = useRoute()
const userId = route.params.id as string
const { $api } = useApi()

const user = ref<UserData | null>(null)
const roles = ref<RoleItem[]>([])
const loading = ref(false)
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError('users_show', 'error')

const loadUser = async () => {
  loading.value = true
  clearLoadError()

  try {
    const data = await $api<UserResponse>(`/users/${userId}`)
    const raw = data.data
    const userData = (data.user ?? (raw && 'user' in raw ? raw.user : raw) ?? null) as UserDataApi | null
    if (userData) {
      const rawPerm = Array.isArray(userData.permissions) ? userData.permissions : []
      const normalizedPermissions = normalizeLoadedPermissions(rawPerm).filter(p => permissionIdSet.has(p))
      user.value = { ...userData, permissions: normalizedPermissions }
    } else {
      user.value = null
    }
    if (!userData) {
      setLoadErrorNotFound()
    }
  } catch (error: unknown) {
    setLoadErrorFromException(error)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const loc = locale.value === 'ar' ? 'ar-EG' : 'en-US'
    return d.toLocaleDateString(loc, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const loadRoles = async () => {
  try {
    const data = await $api<RolesResponse>('/roles', { params: { per_page: 100 } })
    roles.value = data.roles ?? data.data?.roles ?? []
  } catch {
    roles.value = []
  }
}

const roleLabel = (role: UserRole) => {
  const match = roles.value.find(r => Number(r.id) === Number(role.id))
  if (match) {
    return locale.value === 'ar'
      ? (match.name_ar || match.name_en || role.name_ar || role.name_en || role.name)
      : (match.name_en || match.name_ar || role.name_en || role.name_ar || role.name)
  }
  return locale.value === 'ar'
    ? (role.name_ar || role.name_en || role.name)
    : (role.name_en || role.name_ar || role.name)
}

const permissionLabel = (permission: string) => actionLabel(permission)

const confirmDeleteUser = async () => {
  if (!user.value) return
  deleting.value = true
  try {
    await $api(`/users/${user.value.id}`, { method: 'DELETE' })
    toast.success(t('toasts.user_deleted_named', { name: user.value.name }))
    showDeleteDialog.value = false
    await navigateTo('/users')
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  if (!canView.value) return
  loadUser()
  loadRoles()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- No view permission -->
    <div
      v-if="!canView"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('users_show.no_view_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/users">{{ t('users_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" class="size-8" as-child>
            <NuxtLink to="/users">
              <ArrowRight class="size-4" />
            </NuxtLink>
          </Button>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ t('users_show.title') }}</h1>
            <p class="text-sm text-muted-foreground mt-1">
              {{ t('users_show.subtitle') }}
            </p>
          </div>
        </div>
        <div v-if="user && (canEdit || canDeleteRow)" class="flex flex-wrap gap-2">
          <Button v-if="canEdit" variant="outline" size="sm" class="gap-2" as-child>
            <NuxtLink :to="`/users/edit/${user.id}`">
              <Pencil class="size-4" />
              {{ t('common.edit') }}
            </NuxtLink>
          </Button>
          <Button
            v-if="canDeleteRow"
            variant="outline"
            size="sm"
            class="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            @click="showDeleteDialog = true"
          >
            <Trash2 class="size-4" />
            {{ t('common.delete') }}
          </Button>
        </div>
      </div>

      <!-- Loading state -->
      <div
        v-if="loading"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('users_show.loading') }}
      </div>

      <!-- Error state -->
      <div
        v-else-if="loadError"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <p class="font-medium text-center">{{ loadError.title }}</p>
        <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
          {{ loadError.detail }}
        </p>
        <Button variant="outline" size="sm" @click="loadUser">{{ t('common.retry') }}</Button>
      </div>

      <!-- User details -->
      <template v-else-if="user">
      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold flex items-center gap-2">
            <User class="size-4" />
            {{ t('users_show.basic_info') }}
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('users_show.label_name') }}</p>
              <p class="font-medium">{{ user.name }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground flex items-center gap-1">
                <Mail class="size-3.5" />
                {{ t('users_show.label_email') }}
              </p>
              <p class="font-medium">{{ user.email }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground flex items-center gap-1">
                <Phone class="size-3.5" />
                {{ t('users_show.label_phone') }}
              </p>
              <p class="font-medium">{{ user.phone || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('users_show.label_status') }}</p>
              <div class="flex items-center gap-2">
                <CheckCircle v-if="user.is_active" class="size-4 text-green-600" />
                <XCircle v-else class="size-4 text-muted-foreground" />
                <span :class="user.is_active ? 'text-green-600' : 'text-muted-foreground'">
                  {{ user.is_active ? t('common.active') : t('common.inactive') }}
                </span>
              </div>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('users_show.label_admin') }}</p>
              <div class="flex items-center gap-2">
                <CheckCircle v-if="user.is_admin" class="size-4 text-amber-600" />
                <XCircle v-else class="size-4 text-muted-foreground" />
                <span :class="user.is_admin ? 'text-amber-600' : 'text-muted-foreground'">
                  {{ user.is_admin ? t('common.yes') : t('common.no') }}
                </span>
              </div>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('users_show.label_verified') }}</p>
              <p class="font-medium">{{ user.email_verified_at ? t('users_show.verified_yes') : t('users_show.verified_no') }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar class="size-3.5" />
                {{ t('users_show.created_at') }}
              </p>
              <p class="text-sm">{{ formatDate(user.created_at) }}</p>
            </div>
            <div v-if="user.updated_by != null" class="space-y-1">
              <p class="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar class="size-3.5" />
                {{ t('users_show.updated_at') }}
              </p>
              <p class="text-sm">{{ formatDate(user.updated_at) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Roles -->
      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold flex items-center gap-2">
            <ShieldCheck class="size-4" />
            {{ t('users_show.roles') }}
          </h2>
        </div>
        <div class="p-4">
          <div v-if="user.roles?.length" class="flex flex-wrap gap-2">
            <span
              v-for="role in user.roles"
              :key="role.id"
              class="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {{ roleLabel(role) }}
            </span>
          </div>
          <p v-else class="text-sm text-muted-foreground">{{ t('users_show.no_roles') }}</p>
        </div>
      </div>

      <!-- Permissions -->
      <div class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 border-b">
          <h2 class="font-semibold flex items-center gap-2">
            <ShieldCheck class="size-4" />
            {{ t('users_show.permissions') }}
          </h2>
        </div>
        <div class="p-4">
          <div v-if="user.permissions?.length" class="flex flex-wrap gap-2">
            <span
              v-for="(perm, idx) in user.permissions"
              :key="idx"
              class="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              {{ permissionLabel(perm) }}
            </span>
          </div>
          <p v-else class="text-sm text-muted-foreground">{{ t('users_show.no_permissions') }}</p>
        </div>
      </div>
      </template>
    </template>

    <AlertDialog :open="showDeleteDialog" @update:open="v => (showDeleteDialog = v)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('users_page.alert_delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('users_page.alert_delete_body', { name: user?.name ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel as-child>
            <Button variant="outline">{{ t('common.cancel') }}</Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="deleting"
            @click="confirmDeleteUser"
          >
            {{ t('users_page.alert_delete_confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
