<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Search, Plus, Pencil, Copy, Trash2, Loader2, ShieldAlert, ChevronRight, ChevronLeft, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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

definePageMeta({ layout: 'default' })

const { t } = useI18n()

interface RoleItem {
  id: string
  name_en: string
  name_ar: string
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

const roles = ref<RoleItem[]>([])
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const pagination = ref<RolesPagination | null>(null)
const currentPage = ref(1)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const loadRoles = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const params: Record<string, string | number> = { page }
    if (query) params.search = query

    const data = await $api<RolesResponse>('/roles', { params })
    roles.value = data.data.roles ?? []
    pagination.value = data.data.pagination ?? null
    currentPage.value = data.data.pagination?.current_page ?? page
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? t('roles_page.load_error')
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

const cloningId = ref<string | null>(null)

const handleClone = async (role: RoleItem) => {
  cloningId.value = String(role.id)

  try {
    const res = await $api<Record<string, any>>(`/roles/${role.id}/clone`, { method: 'POST' })

    // Extract the new role ID from whatever response shape the backend returns
    const newId =
      res?.data?.role?.id ??
      res?.data?.id ??
      res?.role?.id ??
      res?.id ??
      null

    toast.success(t('roles_page.copy_success', { name: role.name_ar }))

    if (newId) {
      await navigateTo(`/roles/edit/${newId}`)
    } else {
      await loadRoles(currentPage.value)
    }
  } catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      t('roles_page.copy_error')
    toast.error(msg)
  } finally {
    cloningId.value = null
  }
}

const deletingId = ref<string | null>(null)
const roleToDelete = ref<RoleItem | null>(null)

const confirmDelete = async () => {
  if (!roleToDelete.value) return

  const role = roleToDelete.value
  deletingId.value = String(role.id)
  roleToDelete.value = null

  try {
    await $api(`/roles/${role.id}`, { method: 'DELETE' })
    toast.success(t('roles_page.delete_success', { name: role.name_ar }))
    await loadRoles(currentPage.value)
  } catch (error: any) {
    const msg =
      error?.data?.message?.ar ||
      error?.data?.message ||
      t('roles_page.delete_error')
    toast.error(msg)
  } finally {
    deletingId.value = null
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
     
      <Button class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
        <NuxtLink to="/roles/create">
          <Plus class="size-4" />
          {{ t('roles_page.create') }}
        </NuxtLink>
      </Button>
     
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="rtl:text-right font-medium">{{ t('roles_page.col_name_en') }}</TableHead>
            <TableHead class="rtl:text-right font-medium">{{ t('roles_page.col_name_ar') }}</TableHead>
            <TableHead class="rtl:text-right font-medium">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="3" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('roles_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="errorMessage">
            <TableCell :colspan="3" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <span>{{ errorMessage }}</span>
                <Button variant="outline" size="sm" @click="loadRoles">{{ t('common.retry') }}</Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="roles.length === 0">
            <TableCell :colspan="3" class="py-14 text-center text-sm text-muted-foreground">
              {{ search ? t('roles_page.no_results_search') : t('roles_page.no_roles') }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="role in roles"
            v-else
            :key="role.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <TableCell class="font-medium">{{ role.name_en }}</TableCell>
            <TableCell class="font-medium">{{ role.name_ar }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-3 text-sm">
                <button class="inline-flex items-center gap-1 text-[#2563eb] hover:underline" @click="handleEdit(role)">
                  <Pencil class="size-3.5" />
                  {{ t('common.edit') }}
                </button>
                <button
                  class="inline-flex items-center gap-1 text-muted-foreground hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="cloningId === String(role.id)"
                  @click="handleClone(role)"
                >
                  <LoaderCircle v-if="cloningId === String(role.id)" class="size-3.5 animate-spin" />
                  <Copy v-else class="size-3.5" />
                  {{ t('common.copy') }}
                </button>
                <button
                  class="inline-flex items-center gap-1 text-red-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="deletingId === String(role.id)"
                  @click="roleToDelete = role"
                >
                  <LoaderCircle v-if="deletingId === String(role.id)" class="size-3.5 animate-spin" />
                  <Trash2 v-else class="size-3.5" />
                  {{ t('common.delete') }}
                </button>
              </div>
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

        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="currentPage <= 1 || loading"
            @click="goToPage(currentPage - 1)"
          >
            <ChevronRight class="size-4" />
          </Button>

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

          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="currentPage >= pagination.last_page || loading"
            @click="goToPage(currentPage + 1)"
          >
            <ChevronLeft class="size-4" />
          </Button>
        </div>
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
          {{ t('roles_page.delete_body', { name: roleToDelete?.name_ar ?? '' }) }}
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
</template>
