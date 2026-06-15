<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
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

const { $api } = useApi()

const nameAr = ref('')
const nameEn = ref('')
const location = ref('')
const address = ref('')
const managerId = ref<string>('')

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
  }

  if (!nameAr.value.trim())
    fieldErrors.value.name_ar = t('warehouses_form.validation_name_ar_required')
  if (!nameEn.value.trim())
    fieldErrors.value.name_en = t('warehouses_form.validation_name_en_required')
  if (!location.value.trim())
    fieldErrors.value.location = t('warehouses_form.validation_location_required')
  if (!managerId.value)
    fieldErrors.value.manager_id = t('warehouses_form.validation_manager_required')

  return !Object.values(fieldErrors.value).some(Boolean)
}

/** Loads the same user list as `users/index`: GET /users with `page` only (no search/filters), all pages merged. */
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

const createWarehouse = async () => {
  errorMessage.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      name_ar: nameAr.value.trim(),
      name_en: nameEn.value.trim(),
      location: location.value.trim(),
      status: 'active',
      manager_id: Number(managerId.value),
    }
    const addr = address.value.trim()
    if (addr) body.address = addr

    await $api('/warehouses', { method: 'POST', body })

    toast.success(t('warehouses_page.create_success'))
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
    }
    else {
      errorMessage.value = getErrorMessage(error)
    }
  }
  finally {
    submitting.value = false
  }
}

onMounted(() => loadUsersForManager())
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('warehouses_form.create_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('warehouses_form.create_subtitle') }}
        </p>
      </div>
    </div>

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
        class="bg-primary hover:bg-primary/90 text-white"
        :disabled="submitting || loadingUsers"
        @click="createWarehouse"
      >
        {{ submitting ? t('common.saving') : t('warehouses_form.submit_create') }}
      </Button>
    </div>
  </div>
</template>
