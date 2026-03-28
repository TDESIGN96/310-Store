<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, ShieldCheck, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import { permissionGroups, permissionIdSet, type PermissionGroup } from '@/config/permissions'
import { normalizeLoadedPermissions, type RolePermissionModule } from '@/utils/rolePermissions'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const { t } = useI18n()
const { groupLabel, actionLabel } = usePermissionI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

interface CreateRoleResponse {
  role?: {
    id: string | number
    name_en: string
    name_ar: string
  }
}

const { $api } = useApi()

const nameEn = ref('')
const nameAr = ref('')
const selectedPermissions = ref<string[]>([])
const submitting = ref(false)
const loadingPrefill = ref(false)
const isClonePrefill = ref(false)
const cloneSourceNameEn = ref('')
const cloneSourceNameAr = ref('')
const errorMessage = ref('')
const fieldErrors = ref({ name_en: '', name_ar: '' })

const knownPermissionIds = permissionIdSet

interface RoleData {
  id: string | number
  name_en: string
  name_ar: string
  permissions?: Array<string | RolePermissionModule>
}

interface RoleFetchResponse {
  status?: string
  data?: RoleData
}

const applyClonePrefill = async () => {
  const raw = route.query.from
  const fromId = Array.isArray(raw) ? raw[0] : raw
  if (!fromId || !String(fromId).trim()) return

  loadingPrefill.value = true
  try {
    const res = await $api<RoleFetchResponse>(`/roles/${fromId}`)
    const role = res?.data

    if (!role?.name_en) {
      toast.error(t('roles_form.fetch_error_unexpected'))
      return
    }

    nameEn.value = `${role.name_en.trim()}${t('roles_page.clone_name_suffix_en')}`
    nameAr.value = `${(role.name_ar ?? '').trim()}${t('roles_page.clone_name_suffix_ar')}`

    const rawPerm = Array.isArray(role.permissions) ? role.permissions : []
    const normalized = normalizeLoadedPermissions(rawPerm)
    selectedPermissions.value = normalized.filter(p => knownPermissionIds.has(p))

    cloneSourceNameEn.value = role.name_en
    cloneSourceNameAr.value = role.name_ar ?? ''
    isClonePrefill.value = true
    await router.replace({ query: {} })
  }
  catch (err: unknown) {
    toast.error(getErrorMessage(err))
  }
  finally {
    loadingPrefill.value = false
  }
}

onMounted(() => {
  applyClonePrefill()
})

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
    const ids = new Set<string>(group.permissions.map(p => p.id))
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
  return t('roles_form.permission_required')
})

const saveRole = async () => {
  errorMessage.value = ''
  fieldErrors.value = { name_en: '', name_ar: '' }

  if (!nameEn.value.trim()) {
    fieldErrors.value.name_en = t('roles_form.name_en_required')
  } else if (nameEn.value.trim().length < 3) {
    fieldErrors.value.name_en = t('roles_form.name_min')
  }

  if (!nameAr.value.trim()) {
    fieldErrors.value.name_ar = t('roles_form.name_ar_required')
  } else if (nameAr.value.trim().length < 3) {
    fieldErrors.value.name_ar = t('roles_form.name_min')
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

    toast.success(t('toasts.save_success'))
    await navigateTo('/roles')
  } catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value.name_en = fe.name_en ?? ''
      fieldErrors.value.name_ar = fe.name_ar ?? ''
      const permKey = Object.keys(fe).find(k => k.startsWith('permissions'))
      errorMessage.value = permKey ? fe[permKey]! : ''
    } else {
      errorMessage.value = getErrorMessage(error)
    }
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('roles_form.create_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('roles_form.create_subtitle') }}
        </p>
      </div>
    </div>

    <div
      v-if="loadingPrefill"
      class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
    >
      <Loader2 class="size-5 animate-spin" />
      {{ t('roles_form.loading_prefill') }}
    </div>

    <template v-else>
    <div
      v-if="isClonePrefill"
      class="rounded-lg border border-[#215260]/30 bg-[#215260]/5 px-4 py-3 text-sm text-foreground"
    >
      {{
        t('roles_form.clone_prefill_banner', {
          name_en: cloneSourceNameEn,
          name_ar: cloneSourceNameAr,
        })
      }}
    </div>

    <div class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('roles_form.name_en') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="nameEn"
            :placeholder="t('roles_form.placeholder_en')"
            :class="fieldErrors.name_en ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name_en = ''"
          />
          <p v-if="fieldErrors.name_en" class="text-xs text-red-500">{{ fieldErrors.name_en }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">{{ t('roles_form.name_ar') }} <span class="text-red-500">*</span></label>
          <Input
            v-model="nameAr"
            :placeholder="t('roles_form.placeholder_ar')"
            :class="fieldErrors.name_ar ? 'border-red-500 focus-visible:ring-red-500' : ''"
            @input="fieldErrors.name_ar = ''"
          />
          <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">{{ fieldErrors.name_ar }}</p>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ t('roles_form.name_hint') }}
      </p>
    </div>

    <div>
      <h2 class="text-xl font-semibold">{{ t('roles_form.permissions_title') }}</h2>
      <p class="text-sm text-muted-foreground mt-1">
        {{ t('roles_form.permissions_subtitle') }}
      </p>
    </div>

    <div class="space-y-3">
      <div v-for="group in permissionGroups" :key="group.id" class="rounded-lg border overflow-hidden">
        <div class="bg-muted/40 px-4 py-3 flex items-center justify-between">
          <div class="inline-flex items-center gap-2">
            <ShieldCheck class="size-4 text-muted-foreground" />
            <span class="font-medium">{{ groupLabel(group.id) }}</span>
          </div>
          <label class="inline-flex items-center gap-2 text-sm select-none cursor-pointer">
            <input
              type="checkbox"
              class="size-4 cursor-pointer rounded border border-input accent-primary"
              :checked="isGroupSelected(group)"
              @change="onGroupChange(group, $event)"
            >
            <span>{{ t('roles_form.select_all') }}</span>
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
            <span>{{ actionLabel(permission.id) }}</span>
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
        <NuxtLink to="/roles">{{ t('common.cancel') }}</NuxtLink>
      </Button>
      <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="saveRole">
        {{ submitting ? t('common.saving') : t('roles_form.submit_create') }}
      </Button>
    </div>
    </template>
  </div>
</template>