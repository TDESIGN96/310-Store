<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Pencil, UserX, UserCheck, Trash2, Building2, Boxes } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

interface DistributorDetail {
  id: number
  name_en: string
  name_ar: string
  mobile_number: string
  email: string
  address: string
  location: string
  description: string
  admin_name: string
  admin_mobile_number: string
  status: 'active' | 'inactive'
}

interface DistributorShowResponse {
  distributor?: unknown
  data?: unknown
}

const route = useRoute()
const distributorId = computed(() => String(route.params.id ?? ''))

const { t } = useI18n()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canAccess, canEdit, canDelete } = usePermissions()
const canViewDistributor = computed(() => canAccess('distributors'))
const canEditDistributor = computed(() => canEdit('distributors'))
const canDeleteDistributor = computed(() => canDelete('distributors'))

const distributor = ref<DistributorDetail | null>(null)
const loading = ref(false)
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError('distributors_show', 'error')

const distributorToDelete = ref<DistributorDetail | null>(null)
const distributorToDeactivate = ref<DistributorDetail | null>(null)
const distributorToActivate = ref<DistributorDetail | null>(null)
const deleting = ref(false)
const toggling = ref(false)

const currentTab = ref<'general' | 'stock-allocation'>('general')

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const getString = (value: unknown) => (typeof value === 'string' ? value : '')

const normalizeStatus = (value: unknown): 'active' | 'inactive' => {
  const status = getString(value).toLowerCase()
  if (status === 'active' || value === true || value === 1 || value === '1') return 'active'
  return 'inactive'
}

const normalizeDistributor = (raw: unknown): DistributorDetail | null => {
  if (!isRecord(raw)) return null
  const idValue = raw.id
  const id = typeof idValue === 'number' ? idValue : Number(idValue)
  if (!Number.isFinite(id)) return null
  const admin = isRecord(raw.admin) ? raw.admin : null
  const user = isRecord(raw.user) ? raw.user : null
  return {
    id,
    name_en: getString(raw.name_en || raw.distributor_name_en || raw.name || raw.company_name_en),
    name_ar: getString(raw.name_ar || raw.distributor_name_ar || raw.company_name_ar),
    mobile_number: getString(raw.mobile_number || raw.phone),
    email: getString(raw.email),
    address: getString(raw.address),
    location: getString(raw.location || raw.city || raw.location_city),
    description: getString(raw.description),
    admin_name: getString(raw.admin_name || admin?.name || user?.name),
    admin_mobile_number: getString(raw.admin_mobile_number || admin?.mobile || admin?.phone || user?.mobile || user?.phone),
    status: normalizeStatus(raw.status ?? raw.is_active),
  }
}

const distributorName = computed(() => distributor.value?.name_en || distributor.value?.name_ar || `#${distributor.value?.id ?? ''}`)

const statusConfig = (status: string) => {
  if (status === 'active') {
    return {
      label: t('common.active'),
      class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    }
  }
  return {
    label: t('common.inactive'),
    class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  }
}

const loadDistributor = async () => {
  if (!distributorId.value) return
  loading.value = true
  clearLoadError()
  distributor.value = null
  try {
    const res = await $api<DistributorShowResponse>(`/distributors/${distributorId.value}`)
    const root = res.data
    const raw = res.distributor
      ?? (isRecord(root) && 'distributor' in root ? root.distributor : undefined)
      ?? root
    const row = normalizeDistributor(raw)
    if (!row) {
      setLoadErrorNotFound()
      return
    }
    distributor.value = row
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const deactivate = async () => {
  if (!distributorToDeactivate.value) return
  toggling.value = true
  try {
    await $api(`/distributors/${distributorToDeactivate.value.id}`, {
      method: 'PUT',
      body: { status: 'inactive' },
    })
    toast.success(t('distributors_page.deactivate_success', { name: distributorName.value }))
    distributorToDeactivate.value = null
    await loadDistributor()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    toggling.value = false
  }
}

const activate = async () => {
  if (!distributorToActivate.value) return
  toggling.value = true
  try {
    await $api(`/distributors/${distributorToActivate.value.id}`, {
      method: 'PUT',
      body: { status: 'active' },
    })
    toast.success(t('distributors_page.activate_success', { name: distributorName.value }))
    distributorToActivate.value = null
    await loadDistributor()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    toggling.value = false
  }
}

const deleteDistributor = async () => {
  if (!distributorToDelete.value) return
  deleting.value = true
  try {
    await $api(`/distributors/${distributorToDelete.value.id}`, { method: 'DELETE' })
    toast.success(t('distributors_page.delete_success', { name: distributorName.value }))
    await navigateTo('/distributors')
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    deleting.value = false
  }
}

watch(
  () => route.query.tab,
  (tab) => {
    currentTab.value = tab === 'stock-allocation' ? 'stock-allocation' : 'general'
  },
  { immediate: true },
)

onMounted(() => {
  if (!canViewDistributor.value) return
  loadDistributor()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/distributors">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('distributors_show.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ t('distributors_show.subtitle') }}</p>
        </div>
      </div>

      <div v-if="distributor" class="flex items-center gap-2 flex-wrap">
        <Button
          v-if="canEditDistributor"
          variant="outline"
          size="sm"
          class="gap-2"
          as-child
        >
          <NuxtLink :to="`/distributors/edit/${distributor.id}`">
            <Pencil class="size-4" />
            {{ t('common.edit') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="canEditDistributor && distributor.status === 'active'"
          variant="outline"
          size="sm"
          class="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
          @click="distributorToDeactivate = distributor"
        >
          <UserX class="size-4" />
          {{ t('common.deactivate') }}
        </Button>
        <Button
          v-if="canEditDistributor && distributor.status !== 'active'"
          variant="outline"
          size="sm"
          class="gap-2 text-green-700 border-green-200 hover:bg-green-50"
          @click="distributorToActivate = distributor"
        >
          <UserCheck class="size-4" />
          {{ t('common.activate') }}
        </Button>
        <Button
          v-if="canDeleteDistributor"
          variant="outline"
          size="sm"
          class="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          @click="distributorToDelete = distributor"
        >
          <Trash2 class="size-4" />
          {{ t('common.delete') }}
        </Button>
      </div>
    </div>

    <div
      v-if="!canViewDistributor"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('distributors_show.no_view_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/distributors">{{ t('distributors_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div v-if="loading" class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 class="size-5 animate-spin" />
        {{ t('distributors_show.loading') }}
      </div>

      <div
        v-else-if="loadError"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <p class="font-medium text-center">{{ loadError.title }}</p>
        <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
          {{ loadError.detail }}
        </p>
        <Button variant="outline" size="sm" @click="loadDistributor">{{ t('common.retry') }}</Button>
      </div>

      <template v-else-if="distributor">
        <div class="flex items-center gap-2 border-b">
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            :class="currentTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="currentTab = 'general'"
          >
            {{ t('distributors_show.tab_general') }}
          </button>
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            :class="currentTab === 'stock-allocation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="currentTab = 'stock-allocation'"
          >
            {{ t('distributors_show.tab_stock_allocation') }}
          </button>
        </div>

        <div v-if="currentTab === 'general'" class="rounded-lg border overflow-hidden">
          <div class="bg-muted/40 px-4 py-3 border-b flex items-center justify-between gap-2">
            <h2 class="font-semibold flex items-center gap-2">
              <Building2 class="size-4" />
              {{ t('distributors_show.general_information') }}
            </h2>
            <span
              class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              :class="statusConfig(distributor.status).class"
            >
              {{ statusConfig(distributor.status).label }}
            </span>
          </div>

          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.name_en') }}</p>
              <p class="font-medium">{{ distributor.name_en || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.name_ar') }}</p>
              <p class="font-medium">{{ distributor.name_ar || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.mobile_number') }}</p>
              <p class="font-medium">{{ distributor.mobile_number || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.email') }}</p>
              <p class="font-medium">{{ distributor.email || '—' }}</p>
            </div>
            <div class="space-y-1 md:col-span-2">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.address') }}</p>
              <p class="font-medium">{{ distributor.address || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.location') }}</p>
              <p class="font-medium">{{ distributor.location || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.admin_name') }}</p>
              <p class="font-medium">{{ distributor.admin_name || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.admin_mobile_number') }}</p>
              <p class="font-medium">{{ distributor.admin_mobile_number || '—' }}</p>
            </div>
            <div class="space-y-1 md:col-span-2">
              <p class="text-xs text-muted-foreground">{{ t('distributors_show.description') }}</p>
              <p class="font-medium">{{ distributor.description || '—' }}</p>
            </div>
          </div>
        </div>

        <div v-else class="rounded-lg border p-6 flex flex-col items-center text-center gap-2">
          <Boxes class="size-7 text-muted-foreground" />
          <h3 class="font-medium">{{ t('distributors_show.tab_stock_allocation') }}</h3>
          <p class="text-sm text-muted-foreground">{{ t('distributors_show.stock_allocation_placeholder') }}</p>
        </div>
      </template>
    </template>
  </div>

  <AlertDialog :open="!!distributorToDelete" @update:open="v => { if (!v) distributorToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.delete_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.delete_dialog_body', { name: distributorName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="deleting" @click="deleteDistributor">
          {{ t('common.delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!distributorToDeactivate" @update:open="v => { if (!v) distributorToDeactivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.deactivate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.deactivate_dialog_body', { name: distributorName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-amber-600 hover:bg-amber-700 text-white" :disabled="toggling" @click="deactivate">
          {{ t('common.deactivate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="!!distributorToActivate" @update:open="v => { if (!v) distributorToActivate = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('distributors_page.activate_dialog_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('distributors_page.activate_dialog_body', { name: distributorName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button class="bg-green-600 hover:bg-green-700 text-white" :disabled="toggling" @click="activate">
          {{ t('common.activate') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
