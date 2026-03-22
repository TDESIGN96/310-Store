<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, User, Mail, Phone, ShieldCheck, Calendar, CheckCircle, XCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { actionLabel } = usePermissionI18n()
const { getErrorMessage } = useApiError()

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
const errorMessage = ref('')

const loadUser = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await $api<UserResponse>(`/users/${userId}`)
    const raw = data.data
    const userData = (data.user ?? (raw && 'user' in raw ? raw.user : raw) ?? null) as UserData | null
    user.value = userData
    if (!userData) {
      errorMessage.value = t('errors.not_found')
    }
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
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
  if (match) return match.name_ar || match.name_en
  return role.name_ar || role.name_en || role.name
}

const permissionLabel = (permission: string) => actionLabel(permission)
onMounted(() => {
  loadUser()
  loadRoles()
})
</script>

<template>
  <div class="flex flex-col gap-5">
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
      v-else-if="errorMessage"
      class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <ShieldAlert class="size-8" />
      <span>{{ errorMessage }}</span>
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
  </div>
</template>
