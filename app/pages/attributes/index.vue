<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search,
  Plus,
  Loader2,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
const { $api } = useApi()

interface AttributeValue {
  id: number
  attribute_id: number
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface AttributeItem {
  id: number
  name: string
  products_count: number
  values: AttributeValue[]
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface AttributesPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface AttributesResponse {
  status?: string
  status_code?: number
  attributes?: AttributeItem[]
  pagination?: AttributesPagination
  data?: {
    attributes?: AttributeItem[]
    pagination?: AttributesPagination
  }
  message?: string | null
}

type SortField = 'name' | 'products_count' | 'created_at'

const rows = ref<AttributeItem[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('attributes_page')
const pagination = ref<AttributesPagination | null>(null)
const currentPage = ref(1)

const search = ref('')
const sortBy = ref<SortField>('created_at')
const sortOrder = ref<'asc' | 'desc'>('desc')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const deleteDialogOpen = ref(false)
const deleteTarget = ref<AttributeItem | null>(null)
const deleting = ref(false)

const loadAttributes = async (page = currentPage.value, query = search.value.trim()) => {
  loading.value = true
  clearListLoadError()
  try {
    const params: Record<string, string | number> = { page }
    if (query) {
      params.search = query
      params.name = query
    }
    if (sortBy.value) {
      params['sortBy[column]'] = sortBy.value
      params['sortBy[direction]'] = sortOrder.value
    }

    const res = await $api<AttributesResponse>('/attributes', { params })
    rows.value = res.attributes ?? res.data?.attributes ?? []
    const paginationData = res.pagination ?? res.data?.pagination ?? null
    pagination.value = paginationData
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
  loadAttributes(page)
}

const resetPageAndLoad = () => {
  currentPage.value = 1
  loadAttributes(1, search.value.trim())
}

watch(search, value => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadAttributes(1, value.trim())
  }, 450)
})

const toggleSort = (field: SortField) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  resetPageAndLoad()
}

const sortIcon = (field: SortField) => {
  if (sortBy.value !== field) return ArrowUpDown
  return sortOrder.value === 'asc' ? ArrowUp : ArrowDown
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  try {
    const loc = locale.value === 'ar' ? 'ar-EG' : 'en-US'
    return new Date(dateStr).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  catch {
    return dateStr
  }
}

const valuePreview = (values: AttributeValue[]) => values.slice(0, 5)

const remainingValuesCount = (values: AttributeValue[]) => Math.max(values.length - 5, 0)

const openDelete = (row: AttributeItem) => {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $api(`/attributes/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.success(t('attributes_page.delete_success', { name: deleteTarget.value.name }))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadAttributes(currentPage.value)
  }
  catch {
    toast.error(t('attributes_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

const openCreate = () => navigateTo('/attributes/create')

onMounted(() => {
  loadAttributes()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('attributes_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('attributes_page.subtitle') }}</p>
      </div>
      <Button class="h-9 gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" @click="openCreate">
        <Plus class="size-4" />
        {{ t('attributes_page.create') }}
      </Button>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <div class="relative min-w-[220px] max-w-sm flex-1">
        <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
        <Input
          v-model="search"
          :placeholder="t('attributes_page.search_placeholder')"
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
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead
              class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('name')"
            >
              <div class="inline-flex items-center gap-1.5">
                {{ t('attributes_page.col_name') }}
                <component :is="sortIcon('name')" class="size-3.5 text-muted-foreground/70" />
              </div>
            </TableHead>
            <TableHead class="text-start font-medium">{{ t('attributes_page.col_values') }}</TableHead>
            <TableHead
              class="text-end font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('products_count')"
            >
              <div class="inline-flex items-center gap-1.5">
                {{ t('attributes_page.col_products_count') }}
                <component :is="sortIcon('products_count')" class="size-3.5 text-muted-foreground/70" />
              </div>
            </TableHead>
            <TableHead
              class="text-end font-medium cursor-pointer select-none hover:text-foreground transition-colors"
              @click="toggleSort('created_at')"
            >
              <div class="inline-flex items-center gap-1.5">
                {{ t('attributes_page.col_created_at') }}
                <component :is="sortIcon('created_at')" class="size-3.5 text-muted-foreground/70" />
              </div>
            </TableHead>
            <TableHead class="text-end font-medium w-[1%] whitespace-nowrap">
              {{ t('attributes_page.col_actions') }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="5" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                {{ t('attributes_page.loading') }}
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="listLoadError">
            <TableCell :colspan="5" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <p class="font-medium text-center">{{ listLoadError.title }}</p>
                <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                  {{ listLoadError.detail }}
                </p>
                <Button variant="outline" size="sm" @click="loadAttributes()">
                  {{ t('common.retry') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="rows.length === 0">
            <TableCell :colspan="5" class="py-14 text-center text-sm text-muted-foreground">
              {{ search ? t('attributes_page.no_results') : t('attributes_page.no_attributes') }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="row in rows"
            v-else
            :key="row.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <TableCell class="font-medium">
              <button
                type="button"
                class="text-[#2563eb] hover:underline"
                @click="navigateTo(`/attributes/show/${row.id}`)"
              >
                {{ row.name || '—' }}
              </button>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap items-center gap-1.5">
                <Badge
                  v-for="value in valuePreview(row.values || [])"
                  :key="value.id"
                  variant="secondary"
                  class="font-normal"
                >
                  {{ value.name }}
                </Badge>
                <Badge
                  v-if="remainingValuesCount(row.values || []) > 0"
                  variant="outline"
                  class="font-normal text-muted-foreground"
                >
                  +{{ remainingValuesCount(row.values || []) }} {{ t('attributes_page.more') }}
                </Badge>
                <span v-if="!row.values || row.values.length === 0" class="text-sm text-muted-foreground">—</span>
              </div>
            </TableCell>
            <TableCell class="text-end text-sm tabular-nums">{{ row.products_count ?? 0 }}</TableCell>
            <TableCell class="text-end text-sm text-muted-foreground tabular-nums">{{ formatDate(row.created_at) }}</TableCell>
            <TableCell class="text-end">
              <TableRowActions
                :actions="[
                  { key: `edit-${row.id}`, label: t('common.edit'), type: 'button', icon: Pencil, tone: 'default', onClick: () => navigateTo(`/attributes/edit/${row.id}`) },
                  { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', onClick: () => openDelete(row) },
                ]"
                variant="link"
                align="end"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="pagination && pagination.last_page > 1"
        class="flex items-center justify-between gap-3 border-t px-4 py-3"
      >
        <p class="text-xs text-muted-foreground">
          {{
            t('attributes_page.pagination', {
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
            <span v-else-if="page === 2 && currentPage > 3" class="px-1 text-muted-foreground text-sm">...</span>
            <span
              v-else-if="page === pagination.last_page - 1 && currentPage < pagination.last_page - 2"
              class="px-1 text-muted-foreground text-sm"
            >...</span>
          </template>
        </PaginationArrowButtons>
      </div>
      <div v-else-if="pagination" class="border-t px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('attributes_page.total', { total: pagination.total }) }}</p>
      </div>
    </div>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('attributes_page.delete_dialog_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('attributes_page.delete_dialog_body', { name: deleteTarget?.name ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">{{ t('common.cancel') }}</AlertDialogCancel>
          <Button
            class="bg-red-600 hover:bg-red-700 text-white"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="deleting" class="size-4 animate-spin ml-2" />
            {{ deleting ? t('common.loading') : t('attributes_page.confirm_yes_delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
