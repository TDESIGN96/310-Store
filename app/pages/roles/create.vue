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
  key: string
  label: string
}

interface PermissionGroup {
  id: string
  label: string
  permissions: PermissionItem[]
}

const permissionGroups: PermissionGroup[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    permissions: [
      { id: 1, label: 'عرض لوحة التحكم' },
      { id: 2, label: 'تصدير التقارير' },
    ],
  },
  {
    id: 'users',
    label: 'إدارة المستخدمين',
    permissions: [
      { id: 3, label: 'عرض المستخدمين' },
      { id: 4, label: 'إنشاء مستخدمين' },
      { id: 5, label: 'تعديل المستخدمين' },
      { id: 6, label: 'حذف المستخدمين' },
    ],
  },
  {
    id: 'roles_permissions',
    label: 'الصلاحيات والأدوار',
    permissions: [
      { id: 7, label: 'عرض الصلاحيات' },
      { id: 8, label: 'إنشاء صلاحيات' },
      { id: 9, label: 'تعديل الصلاحيات' },
      { id: 10, label: 'حذف الصلاحيات' },
    ],
  },
  {
    id: 'products',
    label: 'إدارة المنتجات',
    permissions: [
      { id: 11, label: 'عرض المنتجات' },
      { id: 12, label: 'إنشاء منتجات' },
      { id: 13, label: 'تعديل المنتجات' },
      { id: 14, label: 'حذف المنتجات' },
    ],
  },
]

const { $api } = useApi()

const nameEn = ref('')
const nameAr = ref('')
const selectedPermissions = ref<number[]>([])
const submitting = ref(false)
const errorMessage = ref('')

const setPermission = (permissionId: number, checked: boolean) => {
  if (checked) {
    if (!selectedPermissions.value.includes(permissionId)) {
      selectedPermissions.value = [...selectedPermissions.value, permissionId]
    }
    return
  }

  selectedPermissions.value = selectedPermissions.value.filter(item => item !== permissionId)
}

const isPermissionSelected = (permissionId: number) => {
  return selectedPermissions.value.includes(permissionId)
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

const onPermissionChange = (permissionId: number, event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false
  setPermission(permissionId, checked)
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

  const firstPermissionError = Object.entries(payload.errors || {}).find(([key]) =>
    key.startsWith('permissions'),
  )?.[1]?.[0]

  return (
    payload.errors?.name_en?.[0] ||
    payload.errors?.name_ar?.[0] ||
    firstPermissionError ||
    message ||
    'تعذر حفظ الصلاحية حالياً'
  )
}

const saveRole = async () => {
  errorMessage.value = ''

  if (!nameEn.value.trim() || !nameAr.value.trim()) {
    errorMessage.value = 'يرجى إدخال اسم الصلاحية باللغتين'
    return
  }

  if (!selectedPermissions.value.length) {
    errorMessage.value = permissionsError.value
    return
  }

  submitting.value = true

  try {
    await toast.promise(
      $api<CreateRoleResponse>('/roles', {
        method: 'POST',
        body: {
          name_en: nameEn.value.trim(),
          name_ar: nameAr.value.trim(),
          permissions: selectedPermissions.value,
        },
      }),
      {
        loading: 'جارٍ حفظ الصلاحية...',
        success: 'تم إنشاء الصلاحية بنجاح',
        error: (error: unknown) => {
          const message = extractErrorMessage(error)
          errorMessage.value = message
          return message
        },
      },
    )

    await navigateTo('/roles')
  } catch {
    // Error toast + message handled above.
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
          <Input v-model="nameEn" placeholder="مثال: Editor" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">اسم الصلاحية (AR) <span class="text-red-500">*</span></label>
          <Input v-model="nameAr" placeholder="مثال: محرر" />
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

    <p v-if="errorMessage" class="text-sm text-red-500">{{ errorMessage }}</p>

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
