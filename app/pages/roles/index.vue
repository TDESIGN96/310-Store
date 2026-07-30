<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, Plus, Pencil, Copy, Trash2, Loader2, ShieldAlert, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()

interface RoleItem {
  id: string
  name_en: string
  name_ar: string
  created_by?: {
    id: number | string
    name?: string
    email?: string
  } | number | null
}

interface RolesPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface RolesResponse {
  status: string
  status_code: number
  data: {
    roles: RoleItem[]
    pagination: RolesPagination
  }
}

const { $api } = useApi()
const { getErrorMessage } = useApiError()

const { canCreate: rCreate, canEdit: rEdit, canDelete: rDestroy } = usePermissions()
const canCreateRole = computed(() => rCreate('roles'))
const canEditRole = computed(() => rEdit('roles'))
const canDeleteRole = computed(() => rDestroy('roles'))

const roles = ref<RoleItem[]>([])
const search = ref('')
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('roles_page')
const pagination = ref<RolesPagination | null>(null)
const currentPage = ref(1)
const selectedIds = ref<Set<string>>(new Set())

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const bulkDeleteConfirmOpen = ref(false)
const bulkDeleteLoading = ref(false)

const isAllSelected = computed(
  () => roles.value.length > 0 && roles.value.every(role => selectedIds.value.has(String(role.id))),
)
const isIndeterminate = computed(
  () => roles.value.some(role => selectedIds.value.has(String(role.id))) && !isAllSelected.value,
)
const selectedCount = computed(() => selectedIds.value.size)

const toggleSelectAll = () => {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) {
    roles.value.forEach(role => next.delete(String(role.id)))
  }
  else {
    roles.value.forEach(role => next.add(String(role.id)))
  }
  selectedIds.value = next
}

const toggleSelect = (id: string) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const loadRoles = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()

  try {
    const params: Record<string, string | number> = { page }
    if (query) params.search = query

    const data = await $api<RolesResponse>('/roles', { params })
    roles.value = data.data.roles ?? []
    pagination.value = data.data.pagination ?? null
    currentPage.value = data.data.pagination?.current_page ?? page
    selectedIds.value = new Set()
  } catch (error: unknown) {
    setListLoadErrorFromException(error)
  } finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadRoles(page)
}

watch(search, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadRoles(1, value.trim())
  }, 1000)
})

const goToCreateRole = async () => {
  await navigateTo('/roles/create')
}

const handleEdit = (role: RoleItem) => {
  navigateTo(`/roles/edit/${role.id}`)
}

/** Prefill create form from source role (names + permissions) — same pattern as users create clone */
const handleClone = (role: RoleItem) => {
  navigateTo({ path: '/roles/create', query: { from: String(role.id) } })
}

const deletingId = ref<string | null>(null)
const roleToDelete = ref<RoleItem | null>(null)

const rolePrimaryName = (role: RoleItem) =>
  locale.value === 'ar'
    ? (role.name_ar || role.name_en || '—')
    : (role.name_en || role.name_ar || '—')

const createdByDisplay = (value?: RoleItem['created_by']) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  const id = typeof value.id === 'number' || typeof value.id === 'string' ? value.id : '—'
  return value.name || `#${id}`
}

const confirmDelete = async () => {
  if (!roleToDelete.value) return

  const role = roleToDelete.value
  deletingId.value = String(role.id)
  roleToDelete.value = null

  try {
    await $api(`/roles/${role.id}`, { method: 'DELETE' })
    toast.success(t('roles_page.delete_success', { name: rolePrimaryName(role) }))
    await loadRoles(currentPage.value)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('roles_page.delete_error'))
  } finally {
    deletingId.value = null
  }
}

const confirmBulkDelete = async () => {
  if (selectedIds.value.size === 0) return
  bulkDeleteConfirmOpen.value = false
  bulkDeleteLoading.value = true
  try {
    const ids = [...selectedIds.value]
    await Promise.all(ids.map(id => $api(`/roles/${id}`, { method: 'DELETE' })))
    toast.success(t('common.bulk_deleted_success', { count: ids.length }))
    selectedIds.value = new Set()
    await loadRoles(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error) || t('roles_page.delete_error'))
  }
  finally {
    bulkDeleteLoading.value = false
  }
}

onMounted(loadRoles)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('roles_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('roles_page.subtitle') }}
        </p>
      </div>

      
    </div>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="relative">
        <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
        <Input
          v-model="search"
          :placeholder="t('roles_page.search_placeholder')"
          class="pr-9 w-80 h-9"
        />
        <Loader2
          v-if="loading && search"
          class="absolute top-1/2 -translate-y-1/2 left-3 size-3.5 animate-spin text-muted-foreground"
        />
      </div>
     
      <Button
        v-if="canCreateRole"
        class="gap-2 bg-primary hover:bg-primary/90 text-white"
        as-child
      >
        <NuxtLink to="/roles/create">
          <Plus class="size-4" />
          {{ t('roles_page.create') }}
        </NuxtLink>
      </Button>
     
    </div>
    <div
      v-if="selectedCount > 0"
      class="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/70 px-4 py-2.5 flex-wrap"
    >
      <span class="text-sm font-medium text-red-700">
        {{ t('common.bulk_delete_only_notice', { count: selectedCount }) }}
      </span>
      <div class="flex items-center gap-2 ms-auto">
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 text-red-600 border-red-300 hover:bg-red-100"
          :disabled="bulkDeleteLoading"
          @click="bulkDeleteConfirmOpen = true"
        >
          {{ t('common.delete') }}
        </Button>
        <Button variant="ghost" size="sm" class="h-8 text-muted-foreground" @click="selectedIds = new Set()">
          {{ t('common.deselect') }}
        </Button>
      </div>
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="w-10 text-center">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="text-start font-medium">
              {{ locale === 'ar' ? t('roles_page.col_name_ar') : t('roles_page.col_name_en') }}
            </TableHead>
            <TableHead class="text-start font-medium">{{ t('common.added_by') }}</TableHead>
            <TableHead class="text-end font-medium">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="4" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('roles_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="listLoadError">
            <TableCell :colspan="4" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadRoles">{{ t('common.retry') }}</Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="roles.length === 0">
            <TableCell :colspan="4" class="py-14 text-center text-sm text-muted-foreground">
              {{ search ? t('roles_page.no_results_search') : t('roles_page.no_roles') }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="role in roles"
            v-else
            :key="role.id"
            class="hover:bg-muted/30 transition-colors align-middle"
            :class="{ 'bg-muted/20': selectedIds.has(String(role.id)) }"
          >
            <TableCell class="w-10">
              <Checkbox
                :model-value="selectedIds.has(String(role.id))"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelect(String(role.id))"
              />
            </TableCell>
            <TableCell class="font-medium">{{ rolePrimaryName(role) }}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{{ createdByDisplay(role.created_by) }}</TableCell>
            <TableCell class="text-end">
              <TableRowActions
                :actions="[
                  { key: `edit-${role.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', visible: canEditRole, onClick: () => handleEdit(role) },
                  { key: `copy-${role.id}`, label: t('common.copy'), type: 'button', icon: Copy, tone: 'muted', visible: canCreateRole, disabled: deletingId === String(role.id), onClick: () => handleClone(role) },
                  { key: `delete-${role.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteRole, disabled: deletingId === String(role.id), loading: deletingId === String(role.id), onClick: () => { roleToDelete = role } },
                ]"
                variant="link"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">
          {{
            t('roles_page.pagination', {
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

          <template v-for="page in pagination.last_page" :key="page">
            <Button
              v-if="page === 1 || page === pagination.last_page || Math.abs(page - currentPage) <= 1"
              :variant="page === currentPage ? 'default' : 'outline'"
              size="icon"
              class="size-8 text-xs"
              :disabled="loading"
              @click="goToPage(page)"
            >
              {{ page }}
            </Button>
            <span
              v-else-if="page === 2 && currentPage > 3"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
            <span
              v-else-if="page === pagination.last_page - 1 && currentPage < pagination.last_page - 2"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
          </template>

        </PaginationArrowButtons>
      </div>

      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('roles_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>
  </div>

  <AlertDialog :open="!!roleToDelete" @update:open="val => { if (!val) roleToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="rtl:text-right">{{ t('roles_page.delete_title') }}</AlertDialogTitle>
        <AlertDialogDescription class="rtl:text-right">
          {{ t('roles_page.delete_body', { name: roleToDelete ? rolePrimaryName(roleToDelete) : '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="!!deletingId"
          @click="confirmDelete"
        >
          <LoaderCircle v-if="deletingId" class="size-4 animate-spin" />
          {{ t('roles_page.delete_confirm') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="bulkDeleteConfirmOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.bulk_delete_selected_title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('common.bulk_delete_selected_body', { count: selectedCount }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="bulkDeleteLoading">{{ t('common.cancel') }}</AlertDialogCancel>
        <Button
          class="bg-red-600 hover:bg-red-700 text-white"
          :disabled="bulkDeleteLoading"
          @click="confirmBulkDelete"
        >
          <LoaderCircle v-if="bulkDeleteLoading" class="size-4 animate-spin" />
          {{ t('common.delete') }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
