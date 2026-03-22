<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, ChevronDown, ShieldCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

interface RoleItem {
  id: number | string
  name_en: string
  name_ar: string
}

interface RolesResponse {
  data?: {
    roles?: RoleItem[]
  }
  roles?: RoleItem[]
}

const { $api } = useApi()

const name = ref('')
const phone = ref('')
const email = ref('')
const isActive = ref(true)
const password = ref('')
const passwordConfirmation = ref('')
const selectedRoleIds = ref<number[]>([])

const roles = ref<RoleItem[]>([])
const loadingRoles = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({
  name: '',
  phone: '',
  email: '',
  password: '',
  password_confirmation: '',
  role_ids: '',
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

const toggleRole = (role: RoleItem, checked: boolean) => {
  const id = typeof role.id === 'string' ? parseInt(role.id, 10) : role.id
  if (checked) {
    if (!selectedRoleIds.value.includes(id)) {
      selectedRoleIds.value = [...selectedRoleIds.value, id]
    }
  } else {
    selectedRoleIds.value = selectedRoleIds.value.filter(rid => rid !== id)
  }
  fieldErrors.value.role_ids = ''
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

const nameRules = computed(() => [
  { id: 'length', label: t('validation_hints.name_min'), test: (n: string) => n.trim().length >= 3 },
  { id: 'nonumbers', label: t('validation_hints.name_no_digits'), test: (n: string) => !/[0-9]/.test(n) },
])

const nameRuleStatus = computed(() =>
  nameRules.value.map(rule => ({
    ...rule,
    pass: rule.test(name.value),
  })),
)

const nameValid = computed(() => nameRuleStatus.value.every(r => r.pass))

const getNameError = (): string => {
  if (!name.value.trim()) return t('users_form.validation_name')
  const failed = nameRules.value.find(r => !r.test(name.value))
  return failed ? failed.label : ''
}

const phoneRules = computed(() => [
  { id: 'format', label: t('validation_hints.phone_format'), test: (p: string) => /^07\d{9}$/.test(p.replace(/\s/g, '')) },
])

const phoneRuleStatus = computed(() =>
  phoneRules.value.map(rule => ({
    ...rule,
    pass: rule.test(phone.value),
  })),
)

const phoneValid = computed(() => !phone.value.trim() || phoneRuleStatus.value.every(r => r.pass))

const getPhoneError = (): string => {
  if (!phone.value.trim()) return ''
  const failed = phoneRules.value.find(r => !r.test(phone.value))
  return failed ? failed.label : ''
}

const passwordRules = computed(() => [
  { id: 'length', label: t('validation_hints.password_min'), test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: t('validation_hints.password_upper'), test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: t('validation_hints.password_lower'), test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: t('validation_hints.password_number'), test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: t('validation_hints.password_special'), test: (p: string) => /[@#$%&\-_]/.test(p) },
  { id: 'nospace', label: t('validation_hints.password_nospace'), test: (p: string) => !/\s/.test(p) },
])

const passwordRuleStatus = computed(() =>
  passwordRules.value.map(rule => ({
    ...rule,
    pass: rule.test(password.value),
  })),
)

const passwordValid = computed(() => passwordRuleStatus.value.every(r => r.pass))

const getPasswordError = (): string => {
  if (!password.value) return t('users_form.validation_password')
  const failed = passwordRules.value.find(r => !r.test(password.value))
  return failed ? failed.label : ''
}

const createUser = async () => {
  errorMessage.value = ''
  fieldErrors.value = {
    name: '',
    phone: '',
    email: '',
    password: '',
    password_confirmation: '',
    role_ids: '',
  }

  if (!name.value.trim()) {
    fieldErrors.value.name = t('users_form.validation_name')
  } else if (!nameValid.value) {
    fieldErrors.value.name = getNameError()
  }
  if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    fieldErrors.value.email = t('users_form.validation_email')
  }
  if (!password.value) {
    fieldErrors.value.password = t('users_form.validation_password')
  } else if (!passwordValid.value) {
    fieldErrors.value.password = getPasswordError()
  }
  if (password.value !== passwordConfirmation.value) {
    fieldErrors.value.password_confirmation = t('users_form.validation_password_confirm')
  }
  if (phone.value.trim() && !phoneValid.value) {
    fieldErrors.value.phone = getPhoneError() || t('users_form.validation_phone')
  }
  if (selectedRoleIds.value.length === 0) {
    fieldErrors.value.role_ids = t('errors.roles_required')
  }

  if (Object.values(fieldErrors.value).some(Boolean)) return

  submitting.value = true

  try {
    await $api('/users', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        phone: phone.value.trim() || undefined,
        email: email.value.trim() || undefined,
        is_active: isActive.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
        role_ids: selectedRoleIds.value,
      },
    })

    toast.success(t('toasts.save_success'))
    await navigateTo('/users')
  } catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value = {
        name: fe.name ?? '',
        phone: fe.phone ?? '',
        email: fe.email ?? '',
        password: fe.password ?? '',
        password_confirmation: fe.password_confirmation ?? '',
        role_ids: fe.role_ids ?? '',
      }
    } else {
      errorMessage.value = getErrorMessage(error)
    }
  } finally {
    submitting.value = false
  }
}

onMounted(loadRoles)
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('users_form.create_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('users_form.create_subtitle') }}
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('users_form.name') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="name"
            :placeholder="t('users_form.name_placeholder')"
            :class="fieldErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name = ''"
          />
          <p v-if="fieldErrors.name" class="text-xs text-red-500">{{ fieldErrors.name }}</p>
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
          <label class="text-sm font-medium">{{ t('users_form.label_email') }}</label>
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

        <div class="space-y-2 md:col-span-1">
          <label class="text-sm font-medium">{{ t('users_form.password') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="password"
            type="text"
            :placeholder="t('users_form.password_placeholder')"
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

        <div class="space-y-2 md:col-span-1">
          <label class="text-sm font-medium">{{ t('users_form.password_confirm') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="passwordConfirmation"
            type="text"
            :placeholder="t('users_form.password_confirm_placeholder')"
            :class="fieldErrors.password_confirmation ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.password_confirmation = ''"
          />
          <p v-if="fieldErrors.password_confirmation" class="text-xs text-red-500">{{ fieldErrors.password_confirmation }}</p>
        </div>
      </div>
    </div>

    <div>
      <h2 class="text-xl font-semibold flex items-center gap-2">
        <ShieldCheck class="size-4" />
        {{ t('users_form.roles_section') }}
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('users_form.roles_hint') }}
      </p>
    </div>

    <div class="space-y-2">
      <label class="text-sm font-medium">{{ t('users_form.roles_label') }} <span class="text-red-500">*</span></label>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            role="combobox"
            class="w-full justify-between font-normal"
            :class="fieldErrors.role_ids ? 'border-red-500 focus-visible:ring-red-500' : ''"
          >
            <span class="truncate">
              {{ selectedRolesLabel || t('users_form.roles_placeholder') }}
            </span>
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
            class="h-60 overflow-y-scroll overflow-x-hidden overscroll-contain"
          >
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="flex items-center w-full px-4 py-2.5 text-right text-sm select-none cursor-pointer transition-colors hover:bg-muted/50 rounded-sm shrink-0"
              :class="isRoleSelected(role) ? 'bg-primary/15 text-primary font-medium' : ''"
              @click="toggleRole(role, !isRoleSelected(role))"
            >
              {{ role.name_ar || role.name_en }}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <p v-if="fieldErrors.role_ids" class="text-xs text-red-500">{{ fieldErrors.role_ids }}</p>
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
      <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="createUser">
        {{ submitting ? t('common.saving') : t('users_form.submit_create') }}
      </Button>
    </div>
  </div>
</template>
