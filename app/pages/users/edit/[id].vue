<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, ChevronDown, KeyRound, ShieldCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

interface RoleItem {
  id: number | string
  name_en: string
  name_ar: string
}

interface RolesResponse {
  data?: { roles?: RoleItem[] }
  roles?: RoleItem[]
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
const selectedRoleIds = ref<number[]>([])
const showResetPassword = ref(false)
const newPassword = ref('')
const newPasswordConfirmation = ref('')

const roles = ref<RoleItem[]>([])
const loadingRoles = ref(false)
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

// Mock load user data (no endpoint - use placeholder)
const loadUser = () => {
  username.value = 'مستخدم تجريبي'
  phone.value = '07501234567'
  email.value = 'user@example.com'
  selectedRoleIds.value = []
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
  return selected.map(r => r.name_ar || r.name_en).join('، ')
})

const nameRules = [
  { id: 'length', label: '3 أحرف على الأقل', test: (n: string) => n.trim().length >= 3 },
  { id: 'nonumbers', label: 'بدون أرقام', test: (n: string) => !/[0-9]/.test(n) },
]
const nameRuleStatus = computed(() =>
  nameRules.map(rule => ({ ...rule, pass: rule.test(username.value) })),
)
const nameValid = computed(() => nameRuleStatus.value.every(r => r.pass))

const phoneRules = [
  { id: 'format', label: '11 رقماً تبدأ بـ 07', test: (p: string) => /^07\d{9}$/.test(p.replace(/\s/g, '')) },
]
const phoneRuleStatus = computed(() =>
  phoneRules.map(rule => ({ ...rule, pass: rule.test(phone.value) })),
)
const phoneValid = computed(() => !phone.value.trim() || phoneRuleStatus.value.every(r => r.pass))

const passwordRules = [
  { id: 'length', label: '8 أحرف على الأقل', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'حرف كبير واحد على الأقل (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'حرف صغير واحد على الأقل (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'رقم واحد على الأقل (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'رمز خاص واحد على الأقل (@ # $ % & - _)', test: (p: string) => /[@#$%&\-_]/.test(p) },
  { id: 'nospace', label: 'بدون مسافات', test: (p: string) => !/\s/.test(p) },
]
const passwordRuleStatus = computed(() =>
  passwordRules.map(rule => ({ ...rule, pass: rule.test(newPassword.value) })),
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
    fieldErrors.value.username = 'يرجى إدخال الاسم'
  } else if (!nameValid.value) {
    const failed = nameRules.find(r => !r.test(username.value))
    fieldErrors.value.username = failed?.label ?? ''
  }
  if (!email.value.trim()) {
    fieldErrors.value.email = 'يرجى إدخال البريد الإلكتروني'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    fieldErrors.value.email = 'البريد الإلكتروني غير صالح'
  }
  if (phone.value.trim() && !phoneValid.value) {
    const failed = phoneRules.find(r => !r.test(phone.value))
    fieldErrors.value.phone = failed?.label ?? 'رقم الهاتف غير صالح'
  }
  if (showResetPassword.value) {
    if (!newPassword.value) {
      fieldErrors.value.password = 'يرجى إدخال كلمة المرور الجديدة'
    } else if (!passwordValid.value) {
      const failed = passwordRules.find(r => !r.test(newPassword.value))
      fieldErrors.value.password = failed?.label ?? ''
    }
    if (newPassword.value !== newPasswordConfirmation.value) {
      fieldErrors.value.password_confirmation = 'كلمة المرور غير متطابقة'
    }
  }

  if (Object.values(fieldErrors.value).some(Boolean)) return

  submitting.value = true
  try {
    // No endpoint - mock success
    await new Promise(resolve => setTimeout(resolve, 500))
    toast.success('تم تحديث المستخدم بنجاح')
    cancelResetPassword()
    await navigateTo('/users')
  } catch {
    errorMessage.value = 'تعذر تحديث المستخدم حالياً'
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
        <h1 class="text-2xl font-bold tracking-tight">تعديل المستخدم</h1>
        <p class="text-sm text-muted-foreground mt-1">
          تعديل بيانات المستخدم
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">اسم المستخدم <span class="text-red-500">*</span></label>
          <Input
            v-model="username"
            placeholder="مثال: أحمد محمد"
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
          <label class="text-sm font-medium">البريد الإلكتروني <span class="text-red-500">*</span></label>
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
          <label class="text-sm font-medium">رقم الهاتف</label>
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
            رقم عراقي فريد — لا يُسمح بتكرار الأرقام
          </p>
        </div>
      </div>
    </div>

    <!-- Assigned roles -->
    <div>
      <h2 class="text-xl font-semibold flex items-center gap-2">
        <ShieldCheck class="size-4" />
        الأدوار المعينة
      </h2>
      <p class="text-sm text-muted-foreground mt-1">
        اختر الأدوار المرتبطة بهذا المستخدم
      </p>
    </div>

    <div class="space-y-2">
      <label class="text-sm font-medium">الأدوار</label>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            role="combobox"
            class="w-full justify-between font-normal"
          >
            <span class="truncate">{{ selectedRolesLabel || 'اختر الأدوار...' }}</span>
            <ChevronDown class="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          class="w-[var(--reka-popover-trigger-width)] p-0 overflow-hidden"
          align="start"
          side="bottom"
        >
          <div v-if="loadingRoles" class="p-4 text-sm text-muted-foreground text-center">
            جاري تحميل الأدوار...
          </div>
          <div v-else-if="roles.length === 0" class="p-4 text-sm text-muted-foreground text-center">
            لا توجد أدوار متاحة
          </div>
          <div
            v-else
            class="max-h-[200px] overflow-y-auto overflow-x-hidden overscroll-contain"
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
    </div>

    <!-- Password field: always masked, not editable -->
    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">كلمة المرور</label>
          <Input
            type="password"
            :model-value="'••••••••••••'"
            disabled
            class="bg-muted/50"
          />
          <p class="text-xs text-muted-foreground">
            لا يمكن عرض أو تعديل كلمة المرور مباشرة
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
              إعادة تعيين كلمة المرور
            </Button>
            <div v-else class="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground"
                @click="cancelResetPassword"
              >
                إلغاء
              </Button>
              <div class="space-y-2">
                <label class="text-sm font-medium">كلمة المرور الجديدة <span class="text-red-500">*</span></label>
                <Input
                  v-model="newPassword"
                  type="password"
                  placeholder="أدخل كلمة المرور الجديدة"
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
                <label class="text-sm font-medium">تأكيد كلمة المرور الجديدة <span class="text-red-500">*</span></label>
                <Input
                  v-model="newPasswordConfirmation"
                  type="password"
                  placeholder="أعد إدخال كلمة المرور"
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
        <NuxtLink to="/users">إلغاء</NuxtLink>
      </Button>
      <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="updateUser">
        {{ submitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات' }}
      </Button>
    </div>
  </div>
</template>
