<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

interface WarehouseManager {
  id: number
  name?: string
}

interface WarehouseData {
  id: number
  name_ar: string
  name_en: string
  location: string
  address?: string
  status: string
  manager?: WarehouseManager | null
}

interface WarehouseResponse {
  warehouse?: WarehouseData
  data?: WarehouseData | { warehouse?: WarehouseData }
  status?: string
  status_code?: number
  message?: string | null
}

/** Same response shape as `users/index` — GET /users */
interface UserListItem {
  id: number
  name: string
  email?: string
}

interface UsersPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface UsersResponse {
  users?: UserListItem[]
  pagination?: UsersPagination
  data?: {
    users?: UserListItem[]
    pagination?: UsersPagination
  }
}

const route = useRoute()
const warehouseId = route.params.id as string
const { $api } = useApi()
const { canEdit } = usePermissions()
const canEditWarehouse = computed(() => canEdit('warehouses'))

const loadingWarehouse = ref(false)
const fetchError = ref('')

const nameAr = ref('')
const nameEn = ref('')
const location = ref('')
const address = ref('')
const managerId = ref<string>('')
const status = ref<'active' | 'inactive'>('active')

const usersForManager = ref<UserListItem[]>([])
const loadingUsers = ref(false)
const usersLoadError = ref('')

const submitting = ref(false)
const errorMessage = ref('')

const fieldErrors = ref({
  name_ar: '',
  name_en: '',
  location: '',
  address: '',
  manager_id: '',
  status: '',
})

const clearFieldError = (key: keyof typeof fieldErrors.value) => {
  fieldErrors.value = { ...fieldErrors.value, [key]: '' }
}

const validateForm = (): boolean => {
  fieldErrors.value = {
    name_ar: '',
    name_en: '',
    location: '',
    address: '',
    manager_id: '',
    status: '',
  }

  if (!nameAr.value.trim())
    fieldErrors.value.name_ar = t('warehouses_form.validation_name_ar_required')
  if (!nameEn.value.trim())
    fieldErrors.value.name_en = t('warehouses_form.validation_name_en_required')
  if (!location.value.trim())
    fieldErrors.value.location = t('warehouses_form.validation_location_required')
  if (!managerId.value)
    fieldErrors.value.manager_id = t('warehouses_form.validation_manager_required')
  if (!status.value)
    fieldErrors.value.status = t('warehouses_form.validation_status_required')

  return !Object.values(fieldErrors.value).some(Boolean)
}

const parseWarehouse = (res: WarehouseResponse): WarehouseData | null => {
  const raw = res.data
  const w = (
    res.warehouse
    ?? (raw && typeof raw === 'object' && 'warehouse' in raw
      ? (raw as { warehouse?: WarehouseData }).warehouse
      : undefined)
    ?? (raw && typeof raw === 'object' && 'id' in raw && 'name_ar' in raw
      ? (raw as WarehouseData)
      : undefined)
    ?? null
  )
  return w
}

const loadWarehouse = async () => {
  loadingWarehouse.value = true
  fetchError.value = ''
  try {
    const res = await $api<WarehouseResponse>(`/warehouses/${warehouseId}`)
    const wh = parseWarehouse(res)
    if (!wh) {
      fetchError.value = t('warehouses_form.warehouse_not_found')
      return
    }

    nameAr.value = wh.name_ar ?? ''
    nameEn.value = wh.name_en ?? ''
    location.value = wh.location ?? ''
    address.value = wh.address?.trim() ? wh.address : ''
    managerId.value = wh.manager?.id != null ? String(wh.manager.id) : ''
    status.value = String(wh.status).toLowerCase() === 'inactive' ? 'inactive' : 'active'
  }
  catch (error: unknown) {
    fetchError.value = getErrorMessage(error)
  }
  finally {
    loadingWarehouse.value = false
  }
}

const loadUsersForManager = async () => {
  loadingUsers.value = true
  usersLoadError.value = ''
  try {
    const aggregated: UserListItem[] = []
    let page = 1
    let lastPage = 1

    do {
      const params: Record<string, string | number> = { page }
      const data = await $api<UsersResponse>('/users', { params })
      const list = data.users ?? data.data?.users ?? []
      const pagination = data.pagination ?? data.data?.pagination ?? null
      aggregated.push(...list)
      lastPage = pagination?.last_page ?? 1
      page++
    } while (page <= lastPage)

    usersForManager.value = aggregated
  }
  catch {
    usersForManager.value = []
    usersLoadError.value = t('warehouses_form.users_load_error')
  }
  finally {
    loadingUsers.value = false
  }
}

const updateWarehouse = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      name_ar: nameAr.value.trim(),
      name_en: nameEn.value.trim(),
      location: location.value.trim(),
      address: address.value.trim(),
      status: status.value,
      manager_id: Number(managerId.value),
    }

    await $api(`/warehouses/${warehouseId}`, {
      method: 'PUT',
      body,
    })

    toast.success(t('warehouses_page.update_success'))
    await navigateTo('/warehouses')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value.name_ar = fe.name_ar ?? ''
      fieldErrors.value.name_en = fe.name_en ?? ''
      fieldErrors.value.location = fe.location ?? ''
      fieldErrors.value.address = fe.address ?? ''
      fieldErrors.value.manager_id = fe.manager_id ?? ''
      fieldErrors.value.status = fe.status ?? ''
    }
    else {
      errorMessage.value = getErrorMessage(error)
    }
  }
  finally {
    submitting.value = false
  }
}

onMounted(() => {
  void Promise.all([loadWarehouse(), loadUsersForManager()])
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/warehouses">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('warehouses_form.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('warehouses_form.edit_subtitle') }}
        </p>
      </div>
    </div>

    <div
      v-if="!canEditWarehouse"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('warehouses_form.no_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/warehouses">{{ t('warehouses_form.back_to_list') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div
        v-if="loadingWarehouse"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('warehouses_form.loading') }}
      </div>

      <div
        v-else-if="fetchError"
        class="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-7" />
        <p>{{ fetchError }}</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadWarehouse">
            {{ t('common.retry') }}
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/warehouses">{{ t('warehouses_form.back_to_list') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <template v-else>
        <div class="rounded-lg border p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('warehouses_form.name_ar') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="nameAr"
                dir="rtl"
                :placeholder="t('warehouses_form.placeholder_name_ar')"
                :class="fieldErrors.name_ar ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="clearFieldError('name_ar')"
              />
              <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">{{ fieldErrors.name_ar }}</p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('warehouses_form.name_en') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="nameEn"
                dir="ltr"
                :placeholder="t('warehouses_form.placeholder_name_en')"
                :class="fieldErrors.name_en ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="clearFieldError('name_en')"
              />
              <p v-if="fieldErrors.name_en" class="text-xs text-red-500">{{ fieldErrors.name_en }}</p>
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-sm font-medium">
                {{ t('warehouses_form.location') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="location"
                :placeholder="t('warehouses_form.placeholder_location')"
                :class="fieldErrors.location ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="clearFieldError('location')"
              />
              <p v-if="fieldErrors.location" class="text-xs text-red-500">{{ fieldErrors.location }}</p>
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-sm font-medium">
                {{ t('warehouses_form.address') }}
                <span class="text-muted-foreground font-normal">({{ t('warehouses_form.optional') }})</span>
              </label>
              <Input
                v-model="address"
                :placeholder="t('warehouses_form.placeholder_address')"
                :class="fieldErrors.address ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="clearFieldError('address')"
              />
              <p v-if="fieldErrors.address" class="text-xs text-red-500">{{ fieldErrors.address }}</p>
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-sm font-medium">
                {{ t('warehouses_form.manager') }} <span class="text-red-500">*</span>
              </label>
              <div v-if="loadingUsers" class="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 class="size-4 animate-spin" />
                {{ t('warehouses_form.loading_users') }}
              </div>
              <template v-else>
                <Select
                  :model-value="managerId"
                  @update:model-value="(v) => { managerId = String(v ?? ''); clearFieldError('manager_id') }"
                >
                  <SelectTrigger
                    class="w-full"
                    :class="fieldErrors.manager_id ? 'border-red-500' : ''"
                  >
                    <SelectValue :placeholder="t('warehouses_form.manager_placeholder')" />
                  </SelectTrigger>
                  <SelectContent class="max-h-72">
                    <SelectItem
                      v-for="u in usersForManager"
                      :key="u.id"
                      :value="String(u.id)"
                    >
                      {{ u.name }}{{ u.email ? ` (${u.email})` : '' }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p v-if="usersLoadError" class="text-xs text-amber-600">{{ usersLoadError }}</p>
                <p v-if="fieldErrors.manager_id" class="text-xs text-red-500">{{ fieldErrors.manager_id }}</p>
              </template>
            </div>

            <div class="space-y-2 md:col-span-2">
              <label class="text-sm font-medium">
                {{ t('warehouses_form.status') }} <span class="text-red-500">*</span>
              </label>
              <Select
                :model-value="status"
                @update:model-value="(v) => { status = (v as 'active' | 'inactive'); clearFieldError('status') }"
              >
                <SelectTrigger
                  class="w-full max-w-md"
                  :class="fieldErrors.status ? 'border-red-500' : ''"
                >
                  <SelectValue :placeholder="t('warehouses_form.select_status')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{{ t('common.active') }}</SelectItem>
                  <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="fieldErrors.status" class="text-xs text-red-500">{{ fieldErrors.status }}</p>
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
            <NuxtLink to="/warehouses">{{ t('common.cancel') }}</NuxtLink>
          </Button>
          <Button
            class="bg-primary hover:bg-primary/90 text-Green-Light"
            :disabled="submitting || loadingUsers"
            @click="updateWarehouse"
          >
            {{ submitting ? t('common.saving') : t('warehouses_form.submit_save') }}
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
