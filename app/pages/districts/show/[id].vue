<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Calendar, Pencil, MapPin, Trash2 } from 'lucide-vue-next'
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
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

interface DistrictAuthor {
  id: number
  name?: string
  email?: string
}

interface DistrictDetail {
  id: number
  district: string
  delivery_fee: string
  other_fees: string
  created_by?: DistrictAuthor | number | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

interface DistrictResponse {
  data?: DistrictDetail | { district?: DistrictDetail }
  district?: DistrictDetail
  status?: string
  status_code?: number
  message?: string | null
}

const { t } = useI18n()
const route = useRoute()
const districtId = computed(() => String(route.params.id ?? ''))
const { $api } = useApi()
const { canAccess, canEdit: canEditPerm, canDelete: canDeletePerm } = usePermissions()

const canView = computed(() => canAccess('districts'))
const canEdit = computed(() => canEditPerm('districts'))
const canDelete = computed(() => canDeletePerm('districts'))

const district = ref<DistrictDetail | null>(null)
const loading = ref(false)
const showDeleteDialog = ref(false)
const deleting = ref(false)
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError('districts_show', 'error')

const extractDistrict = (res: DistrictResponse): DistrictDetail | null => {
  const direct = res.data
  if (direct && typeof direct === 'object' && 'id' in direct) return direct as DistrictDetail
  if (direct && typeof direct === 'object' && 'district' in direct) {
    const nested = (direct as { district?: DistrictDetail }).district
    if (nested && typeof nested === 'object' && 'id' in nested) return nested
  }
  if (res.district && typeof res.district === 'object' && 'id' in res.district) return res.district
  return null
}

const authorDisplay = (value?: DistrictAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const formatDate = (value?: string | null) => formatDisplayDate(value)

const loadDistrict = async () => {
  if (!districtId.value) return
  loading.value = true
  clearLoadError()
  district.value = null
  try {
    const res = await $api<DistrictResponse>(`/districts/${districtId.value}`)
    const data = extractDistrict(res)
    if (!data) {
      setLoadErrorNotFound()
      return
    }
    district.value = data
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const confirmDeleteDistrict = async () => {
  if (!district.value) return
  deleting.value = true
  try {
    await $api(`/districts/${district.value.id}`, { method: 'DELETE' })
    toast.success(t('districts_page.delete_success', { name: district.value.district }))
    showDeleteDialog.value = false
    await navigateTo('/districts')
  }
  catch {
    toast.error(t('districts_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  if (canView.value) loadDistrict()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/districts">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('districts_show.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ t('districts_show.subtitle') }}</p>
        </div>
      </div>
      <div v-if="district && (canEdit || canDelete)" class="flex flex-wrap gap-2">
        <Button v-if="canEdit" variant="outline" size="sm" class="gap-2" as-child>
          <NuxtLink :to="`/districts/edit/${district.id}`">
            <Pencil class="size-4" />
            {{ t('districts_show.edit_district') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="canDelete && !district.deleted_at"
          variant="outline"
          size="sm"
          class="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          @click="showDeleteDialog = true"
        >
          <Trash2 class="size-4" />
          {{ t('common.delete') }}
        </Button>
      </div>
    </div>

    <div
      v-if="!canView"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('districts_show.no_view_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/districts">{{ t('districts_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div v-if="loading" class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 class="size-5 animate-spin" />
        {{ t('districts_show.loading') }}
      </div>

      <div
        v-else-if="loadError"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <p class="font-medium text-center">{{ loadError.title }}</p>
        <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">{{ loadError.detail }}</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadDistrict">{{ t('common.retry') }}</Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/districts">{{ t('districts_show.back') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <template v-else-if="district">
        <div class="rounded-lg border overflow-hidden">
          <div class="bg-section-details border-section-details text-white px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <MapPin class="size-4" />
              {{ t('districts_show.basic_info') }}
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1 md:col-span-2">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.district') }}</p>
                <p class="font-medium">{{ district.district || '—' }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.delivery_fee') }}</p>
                <p class="font-medium tabular-nums">{{ district.delivery_fee || '—' }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.other_fees') }}</p>
                <p class="font-medium tabular-nums">{{ district.other_fees || '—' }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border overflow-hidden">
          <div class="bg-section-details border-section-details text-white px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Calendar class="size-4" />
              {{ t('districts_show.audit_info') }}
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.added_by') }}</p>
                <p class="text-sm font-medium">{{ authorDisplay(district.created_by) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.created_at') }}</p>
                <p class="text-sm">{{ formatDate(district.created_at) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.updated_at') }}</p>
                <p class="text-sm">{{ formatDate(district.updated_at) }}</p>
              </div>
              <div v-if="district.deleted_at" class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('districts_show.deleted_at') }}</p>
                <p class="text-sm text-red-600">{{ formatDate(district.deleted_at) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <Button variant="outline" as-child>
            <NuxtLink to="/districts">{{ t('districts_show.back') }}</NuxtLink>
          </Button>
        </div>
      </template>
    </template>

    <AlertDialog :open="showDeleteDialog" @update:open="v => (showDeleteDialog = v)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('districts_page.delete_dialog_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('districts_page.delete_dialog_body', { name: district?.district ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel as-child>
            <Button variant="outline">{{ t('common.cancel') }}</Button>
          </AlertDialogCancel>
          <Button variant="destructive" :disabled="deleting" @click="confirmDeleteDistrict">
            {{ t('districts_page.confirm_yes_delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
