<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Plus, Pencil, Trash2, Loader2, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

interface DistrictAuthor {
  id: number
  name?: string
  email?: string
}

interface DistrictItem {
  id: number
  district: string
  delivery_fee: string
  other_fees: string
  created_by?: DistrictAuthor | number | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

interface DistrictsPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface DistrictsResponse {
  status?: string
  status_code?: number
  data?: {
    districts?: DistrictItem[]
    pagination?: DistrictsPagination
  }
  districts?: DistrictItem[]
  pagination?: DistrictsPagination
  message?: string | null
}

const { t } = useI18n()
const { $api } = useApi()
const { canCreate: cCreate, canEdit: cEdit, canDelete: cDelete, can } = usePermissions()

const canCreateDistrict = computed(() => cCreate('districts'))
const canEditDistrict = computed(() => cEdit('districts'))
const canDeleteDistrict = computed(() => cDelete('districts'))
const canShowDistrict = computed(() => can('districts.show'))

const rows = ref<DistrictItem[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('districts_page')
const pagination = ref<DistrictsPagination | null>(null)
const currentPage = ref(1)
const search = ref('')

const deleteDialogOpen = ref(false)
const deleteTarget = ref<DistrictItem | null>(null)
const deleting = ref(false)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const authorDisplay = (value?: DistrictAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const formatDate = (value?: string | null) => formatDisplayDate(value)

const loadDistricts = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()
  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.district = query
    }
    const res = await $api<DistrictsResponse>('/districts', { params })
    rows.value = res.data?.districts ?? res.districts ?? []
    pagination.value = res.data?.pagination ?? res.pagination ?? null
    currentPage.value = pagination.value?.current_page ?? page
  }
  catch (error: unknown) {
    setListLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadDistricts(page)
}

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadDistricts(1, value.trim())
  }, 450)
})

const openDelete = (row: DistrictItem) => {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $api(`/districts/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.success(t('districts_page.delete_success', { name: deleteTarget.value.district }))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadDistricts(currentPage.value)
  }
  catch {
    toast.error(t('districts_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadDistricts()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('districts_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('districts_page.subtitle') }}</p>
      </div>
      <Button v-if="canCreateDistrict" class="h-9 gap-2 bg-primary hover:bg-primary/90 text-white" as-child>
        <NuxtLink to="/districts/create">
          <Plus class="size-4" />
          {{ t('districts_page.create') }}
        </NuxtLink>
      </Button>
    </div>

    <div class="flex flex-col sm:flex-row items-center gap-2 flex-wrap">
      <div class="relative w-full sm:min-w-[220px] sm:max-w-sm sm:flex-1">
        <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
        <Input
          v-model="search"
          :placeholder="t('districts_page.search_placeholder')"
          class="pr-9 h-9"
        />
        <Loader2
          v-if="loading && search.trim()"
          class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
        />
      </div>
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader class="hidden md:table-header-group">
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="text-start font-medium min-w-[180px]">{{ t('districts_page.col_district') }}</TableHead>
            <TableHead class="text-end font-medium whitespace-nowrap">{{ t('districts_page.col_delivery_fee') }}</TableHead>
            <TableHead class="text-end font-medium whitespace-nowrap">{{ t('districts_page.col_other_fees') }}</TableHead>
            <TableHead class="text-start font-medium whitespace-nowrap">{{ t('common.added_by') }}</TableHead>
            <TableHead class="text-end font-medium whitespace-nowrap">{{ t('common.created_at') }}</TableHead>
            <TableHead class="text-end font-medium">{{ t('districts_page.col_actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading" class="md:table-row">
            <TableCell :colspan="6" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('districts_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="listLoadError" class="md:table-row">
            <TableCell :colspan="6" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadDistricts()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="rows.length === 0" class="md:table-row">
            <TableCell :colspan="6" class="py-14 text-center text-sm text-muted-foreground">
              {{ search ? t('districts_page.no_results') : t('districts_page.no_districts') }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="row in rows"
            v-else
            :key="row.id"
            class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm
                   md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none
                   hover:bg-muted/30 transition-colors align-middle"
          >
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('districts_page.col_district') }}</span>
              <div class="font-medium text-start">
                <button
                  v-if="canShowDistrict"
                  type="button"
                  class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm text-start cursor-pointer"
                  @click="navigateTo(`/districts/show/${row.id}`)"
                >
                  {{ row.district || '—' }}
                </button>
                <span v-else>{{ row.district || '—' }}</span>
              </div>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('districts_page.col_delivery_fee') }}</span>
              <span class="text-sm text-muted-foreground tabular-nums">{{ formatDisplayNumber(row.delivery_fee, { fallback: '0' }) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('districts_page.col_other_fees') }}</span>
              <span class="text-sm text-muted-foreground tabular-nums">{{ formatDisplayNumber(row.other_fees, { fallback: '0' }) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.added_by') }}</span>
              <span class="text-sm text-muted-foreground">{{ authorDisplay(row.created_by) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-end">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.created_at') }}</span>
              <span class="text-sm text-muted-foreground tabular-nums">{{ formatDate(row.created_at) }}</span>
            </TableCell>
            <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
              <TableRowActions
                :actions="[
                  { key: `edit-${row.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canEditDistrict, onClick: () => navigateTo(`/districts/edit/${row.id}`) },
                  { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteDistrict, onClick: () => openDelete(row) },
                ]"
                variant="link"
                align="end"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div
      v-if="pagination && pagination.last_page > 1"
      class="flex items-center justify-between gap-3 border rounded-lg px-4 py-3"
    >
      <p class="text-xs text-muted-foreground">
        {{
          t('districts_page.pagination', {
            from: (currentPage - 1) * pagination.per_page + 1,
            to: Math.min(currentPage * pagination.per_page, pagination.total),
            total: pagination.total,
          })
        }}
      </p>
      <PaginationArrowButtons
        :current-page="currentPage"
        :last-page="pagination.last_page"
        :loading="loading"
        @prev="goToPage(currentPage - 1)"
        @next="goToPage(currentPage + 1)"
      >
        <span class="text-sm text-muted-foreground px-2 tabular-nums">
          {{ t('common.page_of', { current: currentPage, total: pagination.last_page }) }}
        </span>
      </PaginationArrowButtons>
    </div>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('districts_page.delete_dialog_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('districts_page.delete_dialog_body', { name: deleteTarget?.district ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">{{ t('common.cancel') }}</AlertDialogCancel>
          <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="deleting" @click="confirmDelete">
            <Loader2 v-if="deleting" class="size-4 animate-spin" />
            {{ t('districts_page.confirm_yes_delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
