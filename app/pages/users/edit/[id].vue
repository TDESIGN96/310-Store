<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, Check, ChevronDown, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import { permissionIdSet } from '@/config/permissions'
import { normalizeLoadedPermissions, type RolePermissionModule } from '@/utils/rolePermissions'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { actionLabel } = usePermissionI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

interface RoleItem {
  id: number | string
  name_en: string
  name_ar: string
}

interface RolesResponse {
  data?: { roles?: RoleItem[] }
  roles?: RoleItem[]
}

interface UserRole {
  id: number
  name: string
  name_en: string
  name_ar: string
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
const authStore = useAuthStore()
const { $api } = useApi()

// Super admin: role is 'super_admin', contains 'super', or user has is_admin
const isSuperAdmin = computed(() => {
  const user = authStore.user as { role?: string; is_admin?: boolean } | null
  if (!user) return false
  if (user.is_admin) return true
  const role = user.role
  if (!role) return false
  return role === 'super_admin' || role.toLowerCase().includes('super')
})

const username = ref('')
const phone = ref('')
const email = ref('')
const isActive = ref(true)
const selectedRoleIds = ref<number[]>([])
const showResetPassword = ref(false)
const loadingUser = ref(false)
const newPassword = ref('')
const newPasswordConfirmation = ref('')

const roles = ref<RoleItem[]>([])
const loadingRoles = ref(false)
const effectivePermissions = ref<string[]>([])
const loadingEffectivePermissions = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({
  username: '',
  phone: '',
  email: '',
  role_ids: '',
  password: '',
  password_confirmation: '',
})

const loadRoles = async () => {
  loadingRoles.value = true
  try {
    const data = await $api<RolesResponse>('/roles', { params: { per_page: 100 } })
    const rolesList = data.roles ?? data.data?.roles ?? []
    roles.value = rolesList
  } catch {
    roles.value = []
  } finally {
    loadingRoles.value = false
  }
}

interface RoleDetailResponse {
  data?: { permissions?: Array<string | RolePermissionModule> }
}

let effectivePermDebounce: ReturnType<typeof setTimeout> | null = null

watch(
  () => [...selectedRoleIds.value],
  (ids) => {
    if (effectivePermDebounce) clearTimeout(effectivePermDebounce)
    effectivePermDebounce = setTimeout(async () => {
      if (!ids.length) {
        effectivePermissions.value = []
        loadingEffectivePermissions.value = false
        return
      }
      loadingEffectivePermissions.value = true
      try {
        const results = await Promise.all(
          ids.map(id =>
            $api<RoleDetailResponse>(`/roles/${id}`).catch(() => null),
          ),
        )
        const merged = new Set<string>()
        for (const res of results) {
          const raw = res?.data?.permissions
          if (!Array.isArray(raw)) continue
          normalizeLoadedPermissions(raw)
            .filter(p => permissionIdSet.has(p))
            .forEach(p => merged.add(p))
        }
        effectivePermissions.value = [...merged].sort((a, b) => a.localeCompare(b))
      } finally {
        loadingEffectivePermissions.value = false
      }
    }, 300)
  },
  { deep: true },
)

const loadUser = async () => {
  loadingUser.value = true
  errorMessage.value = ''
  try {
    const data = await $api<UserResponse>(`/users/${userId}`)
    const raw = data.data
    const userData = (data.user ?? (raw && 'user' in raw ? raw.user : raw) ?? null) as UserData | null
    if (userData) {
      username.value = userData.name
      phone.value = userData.phone || ''
      email.value = userData.email
      isActive.value = userData.is_active
      selectedRoleIds.value = userData.roles?.map(r => r.id) ?? []
    } else {
      errorMessage.value = t('users_form.user_not_found')
    }
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    loadingUser.value = false
  }
}

const toggleRole = (role: RoleItem, checked: boolean) => {
  const id = typeof role.id === 'string' ? parseInt(role.id, 10) : role.id
  if (checked) {
    if (!selectedRoleIds.value.includes(id)) {
      selectedRoleIds.value = [...selectedRoleIds.value, id]
    }
  } else {
    selectedRoleIds.value = selectedRoleIds.value.filter(rid => rid !== id)
  }
}

const isRoleSelected = (role: RoleItem) => {
  const id = typeof role.id === 'string' ? parseInt(role.id, 10) : role.id
  return selectedRoleIds.value.includes(id)
}

const selectedRolesLabel = computed(() => {
  if (selectedRoleIds.value.length === 0) return ''
  const selected = roles.value.filter(r => {
    const id = typeof r.id === 'string' ? parseInt(r.id, 10) : r.id
    return selectedRoleIds.value.includes(id)
  })
  const sep = locale.value === 'ar' ? '، ' : ', '
  return selected.map(r => r.name_ar || r.name_en).join(sep)
})

/** Display name: min length, no digits, letters/spaces/apostrophe only (Unicode letters). */
const nameRules = computed(() => [
  { id: 'length', label: t('validation_hints.name_min'), test: (n: string) => n.trim().length >= 3 },
  { id: 'nodigits', label: t('validation_hints.name_no_digits'), test: (n: string) => !/\d/.test(n.trim()) },
  {
    id: 'allowed_chars',
    label: t('validation_hints.name_allowed_chars'),
    test: (n: string) => {
      const s = n.trim()
      if (!s.length) return true
      return /^[\p{L}\s']+$/u.test(s)
    },
  },
])
const nameRuleStatus = computed(() =>
  nameRules.value.map(rule => ({ ...rule, pass: rule.test(username.value) })),
)
const nameValid = computed(() => nameRuleStatus.value.every(r => r.pass))

const phoneRules = computed(() => [
  { id: 'format', label: t('validation_hints.phone_format'), test: (p: string) => /^07\d{9}$/.test(p.replace(/\s/g, '')) },
])
const phoneRuleStatus = computed(() =>
  phoneRules.value.map(rule => ({ ...rule, pass: rule.test(phone.value) })),
)
const phoneValid = computed(() => !phone.value.trim() || phoneRuleStatus.value.every(r => r.pass))

const passwordRules = computed(() => [
  { id: 'length', label: t('validation_hints.password_min'), test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: t('validation_hints.password_upper'), test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: t('validation_hints.password_lower'), test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: t('validation_hints.password_number'), test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: t('validation_hints.password_special'), test: (p: string) => /[@#$%&\-_]/.test(p) },
  { id: 'nospace', label: t('validation_hints.password_nospace'), test: (p: string) => !/\s/.test(p) },
])
const passwordRuleStatus = computed(() =>
  passwordRules.value.map(rule => ({ ...rule, pass: rule.test(newPassword.value) })),
)
const passwordValid = computed(() => passwordRuleStatus.value.every(r => r.pass))

const cancelResetPassword = () => {
  showResetPassword.value = false
  newPassword.value = ''
  newPasswordConfirmation.value = ''
  fieldErrors.value.password = ''
  fieldErrors.value.password_confirmation = ''
}

const updateUser = async () => {
  errorMessage.value = ''
  fieldErrors.value = {
    username: '',
    phone: '',
    email: '',
    role_ids: '',
    password: '',
    password_confirmation: '',
  }

  if (!username.value.trim()) {
    fieldErrors.value.username = t('users_form.validation_name')
  } else if (!nameValid.value) {
    const failed = nameRules.value.find(r => !r.test(username.value))
    fieldErrors.value.username = failed?.label ?? ''
  }
  if (!email.value.trim()) {
    fieldErrors.value.email = t('users_form.validation_email_required')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    fieldErrors.value.email = t('users_form.validation_email')
  }
  if (phone.value.trim() && !phoneValid.value) {
    const failed = phoneRules.value.find(r => !r.test(phone.value))
    fieldErrors.value.phone = failed?.label ?? t('users_form.validation_phone')
  }
  if (showResetPassword.value) {
    if (!newPassword.value) {
      fieldErrors.value.password = t('users_form.new_password_required')
    } else if (!passwordValid.value) {
      const failed = passwordRules.value.find(r => !r.test(newPassword.value))
      fieldErrors.value.password = failed?.label ?? ''
    }
    if (newPassword.value !== newPasswordConfirmation.value) {
      fieldErrors.value.password_confirmation = t('users_form.validation_password_confirm')
    }
  }

  if (Object.values(fieldErrors.value).some(Boolean)) return

  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      name: username.value.trim(),
      phone: phone.value.trim() || undefined,
      email: email.value.trim(),
      is_active: isActive.value,
      role_ids: selectedRoleIds.value,
    }
    if (showResetPassword.value) {
      body.password = newPassword.value
      body.password_confirmation = newPasswordConfirmation.value
    }

    await $api(`/users/${userId}`, {
      method: 'PUT',
      body,
    })

    toast.success(t('toasts.save_success'))
    cancelResetPassword()
    await navigateTo('/users')
  } catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value = {
        username: fe.username ?? fe.name ?? '',
        phone: fe.phone ?? '',
        email: fe.email ?? '',
        role_ids: fe.role_ids ?? '',
        password: fe.password ?? '',
        password_confirmation: fe.password_confirmation ?? '',
      }
    } else {
      errorMessage.value = getErrorMessage(error)
    }
  } finally {
    submitting.value = false
  }
}

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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('users_form.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('users_form.edit_subtitle') }}
        </p>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="loadingUser"
      class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
    >
      <Loader2 class="size-5 animate-spin" />
      {{ t('users_show.loading') }}
    </div>

    <!-- Error state (user not found) -->
    <div
      v-else-if="errorMessage && !username && !email"
      class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <ShieldAlert class="size-8" />
      <span>{{ errorMessage }}</span>
      <Button variant="outline" size="sm" @click="loadUser">{{ t('common.retry') }}</Button>
    </div>

    <template v-else>
    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('users_form.username_label') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="username"
            :placeholder="t('users_form.name_placeholder')"
            :class="fieldErrors.username ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.username = ''"
          />
          <p v-if="fieldErrors.username" class="text-xs text-red-500">{{ fieldErrors.username }}</p>
          <ul class="text-xs text-muted-foreground space-y-1 mt-2">
            <li
              v-for="rule in nameRuleStatus"
              :key="rule.id"
              class="flex items-center gap-2"
              :class="rule.pass ? 'text-green-600' : ''"
            >
              <span v-if="rule.pass" class="text-green-600">✓</span>
              <span v-else class="text-muted-foreground">○</span>
              {{ rule.label }}
            </li>
          </ul>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('users_form.email') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="email"
            type="email"
            placeholder="user@example.com"
            :class="fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.email = ''"
          />
          <p v-if="fieldErrors.email" class="text-xs text-red-500">{{ fieldErrors.email }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('users_form.phone') }}</label>
          <Input
            v-model="phone"
            placeholder="07XXXXXXXXX"
            :class="fieldErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.phone = ''"
          />
          <p v-if="fieldErrors.phone" class="text-xs text-red-500">{{ fieldErrors.phone }}</p>
          <ul class="text-xs text-muted-foreground space-y-1 mt-2">
            <li
              v-for="rule in phoneRuleStatus"
              :key="rule.id"
              class="flex items-center gap-2"
              :class="rule.pass ? 'text-green-600' : ''"
            >
              <span v-if="rule.pass" class="text-green-600">✓</span>
              <span v-else class="text-muted-foreground">○</span>
              {{ rule.label }}
            </li>
          </ul>
          <p class="text-xs text-muted-foreground">
            {{ t('users_form.phone_hint') }}
          </p>
        </div>

        <div class="space-y-2 flex flex-col justify-end">
          <label class="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input
              v-model="isActive"
              type="checkbox"
              class="size-4 cursor-pointer rounded border border-input accent-primary"
            >
            {{ t('users_form.account_active') }}
          </label>
        </div>
      </div>
    </div>

    <!-- Assigned roles -->
    <div>
      <h2 class="text-xl font-semibold flex items-center gap-2">
        <ShieldCheck class="size-4" />
        {{ t('users_form.assigned_roles_title') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('users_form.roles_edit_hint') }}
      </p>
    </div>

    <div class="space-y-2">
      <label class="text-sm font-medium">{{ t('users_form.roles_label') }}</label>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            role="combobox"
            class="w-full justify-between font-normal"
          >
            <span class="truncate">{{ selectedRolesLabel || t('users_form.roles_placeholder') }}</span>
            <ChevronDown class="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          class="w-[var(--reka-popover-trigger-width)] p-0 overflow-hidden"
          align="start"
          side="bottom"
        >
          <div v-if="loadingRoles" class="p-4 text-sm text-muted-foreground text-center">
            {{ t('users_form.loading_roles') }}
          </div>
          <div v-else-if="roles.length === 0" class="p-4 text-sm text-muted-foreground text-center">
            {{ t('users_form.no_roles') }}
          </div>
          <div
            v-else
            class="max-h-[200px] overflow-y-auto overflow-x-hidden overscroll-contain"
          >
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="flex items-center w-full gap-2 px-4 py-2.5 text-right text-sm select-none cursor-pointer transition-colors hover:bg-muted/50 rounded-sm shrink-0"
              :class="isRoleSelected(role) ? 'bg-primary/15 text-primary font-medium' : ''"
              @click="toggleRole(role, !isRoleSelected(role))"
            >
              <span class="inline-flex size-4 shrink-0 items-center justify-center">
                <Check v-if="isRoleSelected(role)" class="size-3.5 text-primary" />
              </span>
              {{ role.name_ar || role.name_en }}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <div v-if="selectedRoleIds.length" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="role in roles.filter(r => selectedRoleIds.includes(typeof r.id === 'string' ? parseInt(r.id, 10) : r.id))"
          :key="role.id"
          class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
        >
          <Check class="size-3" />
          {{ role.name_ar || role.name_en }}
        </span>
      </div>
    </div>

    <!-- Effective permissions from selected roles (read-only; visible to everyone on this page) -->
    <div class="rounded-lg border overflow-hidden">
      <div class="bg-muted/40 px-4 py-3 border-b">
        <h2 class="font-semibold flex items-center gap-2">
          <ShieldCheck class="size-4" />
          {{ t('users_form.effective_permissions_title') }}
        </h2>
        <p class="text-xs text-muted-foreground mt-1">{{ t('users_form.effective_permissions_hint') }}</p>
      </div>
      <div class="p-4">
        <p v-if="!selectedRoleIds.length" class="text-sm text-muted-foreground">
          {{ t('users_form.effective_permissions_select_roles') }}
        </p>
        <template v-else>
          <div v-if="loadingEffectivePermissions" class="text-sm text-muted-foreground">
            {{ t('users_form.effective_permissions_loading') }}
          </div>
          <div v-else-if="effectivePermissions.length" class="flex flex-wrap gap-2">
            <span
              v-for="perm in effectivePermissions"
              :key="perm"
              class="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              {{ actionLabel(perm) }}
            </span>
          </div>
          <p v-else class="text-sm text-muted-foreground">{{ t('users_form.effective_permissions_empty') }}</p>
        </template>
      </div>
    </div>

    <!-- Password field: always masked, not editable -->
    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('users_form.password_section_edit') }}</label>
          <Input
            type="password"
            :model-value="'••••••••••••'"
            disabled
            class="bg-muted/50"
          />
          <p class="text-xs text-muted-foreground">
            {{ t('users_form.password_cannot_view') }}
          </p>

          <!-- Reset Password button: only for super admin -->
          <div v-if="isSuperAdmin" class="mt-3">
            <Button
              v-if="!showResetPassword"
              variant="outline"
              size="sm"
              class="gap-2"
              @click="showResetPassword = true"
            >
              <KeyRound class="size-4" />
              {{ t('users_form.reset_password') }}
            </Button>
            <div v-else class="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground"
                @click="cancelResetPassword"
              >
                {{ t('common.cancel') }}
              </Button>
              <div class="space-y-2">
                <label class="text-sm font-medium">{{ t('users_form.new_password') }} <span class="text-red-500">*</span></label>
                <Input
                  v-model="newPassword"
                  type="password"
                  :placeholder="t('users_form.new_password_placeholder')"
                  :class="fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''"
                  @input="fieldErrors.password = ''"
                />
                <p v-if="fieldErrors.password" class="text-xs text-red-500">{{ fieldErrors.password }}</p>
                <ul class="text-xs text-muted-foreground space-y-1 mt-2">
                  <li
                    v-for="rule in passwordRuleStatus"
                    :key="rule.id"
                    class="flex items-center gap-2"
                    :class="rule.pass ? 'text-green-600' : ''"
                  >
                    <span v-if="rule.pass" class="text-green-600">✓</span>
                    <span v-else class="text-muted-foreground">○</span>
                    {{ rule.label }}
                  </li>
                </ul>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">{{ t('users_form.new_password_confirm') }} <span class="text-red-500">*</span></label>
                <Input
                  v-model="newPasswordConfirmation"
                  type="password"
                  :placeholder="t('users_form.new_password_confirm_placeholder')"
                  :class="fieldErrors.password_confirmation ? 'border-red-500 focus-visible:ring-red-500' : ''"
                  @input="fieldErrors.password_confirmation = ''"
                />
                <p v-if="fieldErrors.password_confirmation" class="text-xs text-red-500">{{ fieldErrors.password_confirmation }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <span class="mt-0.5 shrink-0">⚠</span>
      <span>{{ errorMessage }}</span>
    </div>

    <Separator />

    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" :disabled="submitting" as-child>
        <NuxtLink to="/users">{{ t('common.cancel') }}</NuxtLink>
      </Button>
      <Button class="bg-primary hover:bg-primary/90 text-Green-Light" :disabled="submitting" @click="updateUser">
        {{ submitting ? t('common.saving') : t('users_form.submit_save') }}
      </Button>
    </div>
    </template>
  </div>
</template>
