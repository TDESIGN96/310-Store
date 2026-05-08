<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  Loader2,
  ShieldAlert,
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  CheckCircle,
  XCircle,
  Pencil,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { actionLabel } = usePermissionI18n()

const authStore = useAuthStore()
const { $api } = useApi()
const { canEdit } = usePermissions()

const canEditProfile = computed(
  () => canEdit('users') && (user.value?.id != null || authStore.user?.id != null),
)

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
  created_at: string
  updated_at: string
  roles: UserRole[]
  is_active: boolean
  is_admin: boolean
  phone: string
  permissions: string[]
}

/** Laravel auth user payload (GET /api/user) — shape may match users/{id} resource */
interface UserResponse {
  user?: unknown
  data?: unknown
}

function normalizePermissionStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const o = item as { name?: string; key?: string }
        return o.name || o.key || ''
      }
      return ''
    })
    .filter(Boolean)
}

function parseUserPayload(res: UserResponse): Record<string, unknown> | null {
  const raw = res.data
  const candidate =
    res.user
    ?? (raw && typeof raw === 'object' && raw !== null && 'user' in raw
      ? (raw as { user?: unknown }).user
      : undefined)
    ?? (raw && typeof raw === 'object' && raw !== null && 'id' in raw ? raw : undefined)
    ?? null
  if (!candidate || typeof candidate !== 'object') return null
  return candidate as Record<string, unknown>
}

function toUserData(payload: Record<string, unknown>): UserData | null {
  const id = payload.id
  const name = payload.name
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof name !== 'string')
    return null

  const rolesRaw = payload.roles
  const roles: UserRole[] = Array.isArray(rolesRaw)
    ? rolesRaw.map((r, i) => {
        if (r && typeof r === 'object') {
          const o = r as Record<string, unknown>
          return {
            id: typeof o.id === 'number' ? o.id : i,
            name: String(o.name ?? ''),
            name_en: String(o.name_en ?? o.name ?? ''),
            name_ar: String(o.name_ar ?? o.name ?? ''),
          }
        }
        return { id: i, name: String(r), name_en: String(r), name_ar: String(r) }
      })
    : []

  return {
    id: Number(id),
    name,
    email: typeof payload.email === 'string' ? payload.email : '',
    email_verified_at:
      typeof payload.email_verified_at === 'string' ? payload.email_verified_at : null,
    created_at: typeof payload.created_at === 'string' ? payload.created_at : '',
    updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : '',
    roles,
    is_active: payload.is_active !== false,
    is_admin: payload.is_admin === true,
    phone: typeof payload.phone === 'string' ? payload.phone : '',
    permissions: normalizePermissionStrings(payload.permissions),
  }
}

const user = ref<UserData | null>(null)
const roles = ref<RoleItem[]>([])
const loading = ref(true)
const loadFailed = ref(false)

const roleLabelKey = (role: string | undefined) => {
  if (!role) return ''
  const key = `header.roles.${role}` as const
  const translated = t(key)
  return translated !== key ? translated : role
}

const formatDate = (dateStr: string | null) => {
  return formatDisplayDate(dateStr, { withTime: true })
}

const loadRoles = async () => {
  try {
    const data = await $api<RolesResponse>('/roles', { params: { per_page: 100 } })
    roles.value = data.roles ?? data.data?.roles ?? []
  }
  catch {
    roles.value = []
  }
}

const roleLabel = (role: UserRole) => {
  const match = roles.value.find(r => Number(r.id) === Number(role.id))
  if (match) return match.name_ar || match.name_en
  return role.name_ar || role.name_en || role.name
}

/** Authenticated user — Laravel route `GET /api/user` (Sanctum). */
const loadUser = async () => {
  if (!authStore.token) {
    loading.value = false
    return
  }

  loading.value = true
  loadFailed.value = false
  user.value = null

  try {
    const data = await $api<UserResponse>('/user')
    const payload = parseUserPayload(data)
    const userData = payload ? toUserData(payload) : null
    if (userData) {
      user.value = userData
      await loadRoles()
    }
    else {
      loadFailed.value = true
    }
  }
  catch {
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
}

const fallbackPermissions = computed(() => authStore.permissions ?? [])

const displayPermissions = computed(() => {
  if (user.value)
    return user.value.permissions ?? []
  return fallbackPermissions.value
})

onMounted(loadUser)
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/mainCards">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('profile_page.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ t('profile_page.subtitle') }}
          </p>
        </div>
      </div>
      <Button
        v-if="canEditProfile && (user || authStore.user?.id)"
        variant="outline"
        size="sm"
        class="gap-2"
        as-child
      >
        <NuxtLink :to="`/users/edit/${user?.id ?? authStore.user?.id}`">
          <Pencil class="size-4" />
          {{ t('common.edit') }}
        </NuxtLink>
      </Button>
    </div>

    <div
      v-if="!authStore.isLoggedIn"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('profile_page.not_logged_in') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/">{{ t('profile_page.sign_in') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div
        v-if="loading"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('users_show.loading') }}
      </div>

      <template v-else>
        <p
          v-if="loadFailed"
          class="text-sm text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3"
        >
          {{ t('profile_page.fallback_hint') }}
        </p>

        <!-- API-loaded profile (same shape as users/show) -->
        <template v-if="user">
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
                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar class="size-3.5" />
                    {{ t('users_show.updated_at') }}
                  </p>
                  <p class="text-sm">{{ formatDate(user.updated_at) }}</p>
                </div>
              </div>
            </div>
          </div>

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
                  v-for="(role, rIdx) in user.roles"
                  :key="`${role.id}-${rIdx}`"
                  class="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                >
                  {{ roleLabel(role) }}
                </span>
              </div>
              <p v-else class="text-sm text-muted-foreground">{{ t('users_show.no_roles') }}</p>
            </div>
          </div>

          <div class="rounded-lg border overflow-hidden">
            <div class="bg-muted/40 px-4 py-3 border-b">
              <h2 class="font-semibold flex items-center gap-2">
                <ShieldCheck class="size-4" />
                {{ t('users_show.permissions') }}
              </h2>
            </div>
            <div class="p-4">
              <div v-if="displayPermissions.length" class="flex flex-wrap gap-2">
                <span
                  v-for="(perm, idx) in displayPermissions"
                  :key="idx"
                  class="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {{ actionLabel(perm) }}
                </span>
              </div>
              <p v-else class="text-sm text-muted-foreground">{{ t('users_show.no_permissions') }}</p>
            </div>
          </div>
        </template>

        <!-- Session fallback (GET /user failed) -->
        <template v-else>
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
                  <p class="font-medium">{{ authStore.user?.name ?? '—' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone class="size-3.5" />
                    {{ t('users_show.label_phone') }}
                  </p>
                  <p class="font-medium">{{ authStore.user?.phone || '—' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail class="size-3.5" />
                    {{ t('users_show.label_email') }}
                  </p>
                  <p class="font-medium text-muted-foreground">{{ t('common.no_data') }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border overflow-hidden">
            <div class="bg-muted/40 px-4 py-3 border-b">
              <h2 class="font-semibold flex items-center gap-2">
                <ShieldCheck class="size-4" />
                {{ t('users_show.roles') }}
              </h2>
            </div>
            <div class="p-4">
              <span
                v-if="authStore.user?.role"
                class="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {{ roleLabelKey(authStore.user.role) || authStore.user.role }}
              </span>
              <p v-else class="text-sm text-muted-foreground">{{ t('users_show.no_roles') }}</p>
            </div>
          </div>

          <div class="rounded-lg border overflow-hidden">
            <div class="bg-muted/40 px-4 py-3 border-b">
              <h2 class="font-semibold flex items-center gap-2">
                <ShieldCheck class="size-4" />
                {{ t('users_show.permissions') }}
              </h2>
            </div>
            <div class="p-4">
              <div v-if="displayPermissions.length" class="flex flex-wrap gap-2">
                <span
                  v-for="(perm, idx) in displayPermissions"
                  :key="idx"
                  class="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {{ actionLabel(perm) }}
                </span>
              </div>
              <p v-else class="text-sm text-muted-foreground">{{ t('users_show.no_permissions') }}</p>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
