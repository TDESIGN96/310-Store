<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, ShieldCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

interface CreateRoleResponse {
  role?: {
    id: string | number
    name_en: string
    name_ar: string
  }
}

interface ApiErrorPayload {
  message?: string | { en?: string; ar?: string }
  errors?: Record<string, string[] | undefined>
}

interface PermissionItem {
  id: string
  label: string
}

interface PermissionGroup {
  id: string
  label: string
  permissions: PermissionItem[]
}

const permissionGroups: PermissionGroup[] = [
  {
    id: 'users',
    label: 'إدارة المستخدمين',
    permissions: [
      { id: 'users.view', label: 'عرض المستخدمين' },
      { id: 'users.create', label: 'إنشاء مستخدمين' },
     
    ],
  },
 
  
 
]

const { $api } = useApi()

const nameEn = ref('')
const nameAr = ref('')
const selectedPermissions = ref<string[]>([])
const submitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref({ name_en: '', name_ar: '' })

const setPermission = (permissionKey: string, checked: boolean) => {
  if (checked) {
    if (!selectedPermissions.value.includes(permissionKey)) {
      selectedPermissions.value = [...selectedPermissions.value, permissionKey]
    }
    return
  }

  selectedPermissions.value = selectedPermissions.value.filter(item => item !== permissionKey)
}

const isPermissionSelected = (permissionKey: string) => {
  return selectedPermissions.value.includes(permissionKey)
}

const isGroupSelected = (group: PermissionGroup) => {
  return group.permissions.every(permission => isPermissionSelected(permission.id))
}

const setGroup = (group: PermissionGroup, checked: boolean) => {
  if (!checked) {
    const ids = new Set(group.permissions.map(p => p.id))
    selectedPermissions.value = selectedPermissions.value.filter(p => !ids.has(p))
  } else {
    const next = new Set(selectedPermissions.value)
    group.permissions.forEach(p => next.add(p.id))
    selectedPermissions.value = [...next]
  }
}

const onGroupChange = (group: PermissionGroup, event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false
  setGroup(group, checked)
}

const onPermissionChange = (permissionKey: string, event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false
  setPermission(permissionKey, checked)
}

const permissionsError = computed(() => {
  if (selectedPermissions.value.length > 0) return ''
  return 'يجب اختيار صلاحية واحدة على الأقل'
})

const extractErrorMessage = (error: unknown) => {
  const payload = ((error as { data?: ApiErrorPayload })?.data || {}) as ApiErrorPayload
  const message =
    typeof payload.message === 'string'
      ? payload.message
      : payload.message?.ar || payload.message?.en || ''

  fieldErrors.value.name_en = payload.errors?.name_en?.[0] ?? ''
  fieldErrors.value.name_ar = payload.errors?.name_ar?.[0] ?? ''

  const firstPermissionError = Object.entries(payload.errors || {}).find(([key]) =>
    key.startsWith('permissions'),
  )?.[1]?.[0]

  return (
    firstPermissionError ||
    message ||
    'تعذر حفظ الصلاحية حالياً'
  )
}

const saveRole = async () => {
  errorMessage.value = ''
  fieldErrors.value = { name_en: '', name_ar: '' }

  if (!nameEn.value.trim()) {
    fieldErrors.value.name_en = 'يرجى إدخال اسم الصلاحية بالإنجليزية'
  } else if (nameEn.value.trim().length < 3) {
    fieldErrors.value.name_en = 'يجب أن يكون الاسم 3 أحرف على الأقل'
  }

  if (!nameAr.value.trim()) {
    fieldErrors.value.name_ar = 'يرجى إدخال اسم الصلاحية بالعربية'
  } else if (nameAr.value.trim().length < 3) {
    fieldErrors.value.name_ar = 'يجب أن يكون الاسم 3 أحرف على الأقل'
  }

  if (fieldErrors.value.name_en || fieldErrors.value.name_ar) return

  if (!selectedPermissions.value.length) {
    errorMessage.value = permissionsError.value
    return
  }

  submitting.value = true

  try {
    await $api<CreateRoleResponse>('/roles', {
      method: 'POST',
      body: {
        name_en: nameEn.value.trim(),
        name_ar: nameAr.value.trim(),
        permissions: selectedPermissions.value,
      },
    })

    toast.success('تم إنشاء الصلاحية بنجاح')
    await navigateTo('/roles')
  } catch (error: unknown) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/roles">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">إنشاء صلاحية</h1>
        <p class="text-sm text-muted-foreground mt-1">
          أنشئ دوراً جديداً وحدد الصلاحيات الخاصة به
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">اسم الصلاحية (EN) <span class="text-red-500">*</span></label>
          <Input
            v-model="nameEn"
            placeholder="مثال: Editor"
            :class="fieldErrors.name_en ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name_en = ''"
          />
          <p v-if="fieldErrors.name_en" class="text-xs text-red-500">{{ fieldErrors.name_en }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">اسم الصلاحية (AR) <span class="text-red-500">*</span></label>
          <Input
            v-model="nameAr"
            placeholder="مثال: محرر"
            :class="fieldErrors.name_ar ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name_ar = ''"
          />
          <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">{{ fieldErrors.name_ar }}</p>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        لا يوجد قيد على لغة الإدخال لكل حقل. يمكنك إدخال أي لغة في أي حقل.
      </p>
    </div>

    <div>
      <h2 class="text-xl font-semibold">إعداد الصلاحيات</h2>
      <p class="text-sm text-muted-foreground mt-1">
        اختر الإجراءات المسموح بها لهذا الدور. يجب اختيار صلاحية واحدة على الأقل.
      </p>
    </div>

    <div class="space-y-3">
      <div v-for="group in permissionGroups" :key="group.id" class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 flex items-center justify-between">
          <div class="inline-flex items-center gap-2">
            <ShieldCheck class="size-4 text-muted-foreground" />
            <span class="font-medium">{{ group.label }}</span>
          </div>
          <label class="inline-flex items-center gap-2 text-sm select-none cursor-pointer">
            <input
              type="checkbox"
              class="size-4 cursor-pointer rounded border border-input accent-primary"
              :checked="isGroupSelected(group)"
              @change="onGroupChange(group, $event)"
            >
            <span>تحديد الكل</span>
          </label>
        </div>

        <div class="px-4 py-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label
            v-for="permission in group.permissions"
            :key="permission.id"
            class="inline-flex items-center gap-2 text-sm select-none cursor-pointer"
          >
            <input
              type="checkbox"
              class="size-4 cursor-pointer rounded border border-input accent-primary"
              :checked="isPermissionSelected(permission.id)"
              @change="onPermissionChange(permission.id, $event)"
            >
            <span>{{ permission.label }}</span>
          </label>
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
        <NuxtLink to="/roles">إلغاء</NuxtLink>
      </Button>
      <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="saveRole">
        {{ submitting ? 'جارٍ الحفظ...' : 'انشاء الصلاحية' }}
      </Button>
    </div>
  </div>
</template>