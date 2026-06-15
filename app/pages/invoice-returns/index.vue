<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Loader2, Pencil, Search, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { useInvoicesStore, type InvoiceListItem, type InvoiceReturnListItem } from '@/stores/invoices'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { canAccess, canEdit, canDelete } = usePermissions()
const canViewReturns = computed(() => canAccess('invoice_returns'))
const canEditReturn = computed(() => canEdit('invoice_returns'))
const canDeleteReturn = computed(() => canDelete('invoice_returns'))
const invoicesStore = useInvoicesStore()

const loadingInvoices = ref(false)
const loadingReturns = ref(false)
const deleting = ref(false)
const search = ref('')
const invoiceOptions = ref<InvoiceListItem[]>([])
const allRows = ref<InvoiceReturnListItem[]>([])
const rows = ref<InvoiceReturnListItem[]>([])
const currentPage = ref(1)
const pagination = ref({ current_page: 1, last_page: 1, per_page: 15, total: 0 as number })
const deleteTarget = ref<InvoiceReturnListItem | null>(null)
const deleteDialogOpen = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const pageSize = 15

const createdByLabel = (row: InvoiceReturnListItem) => {
  if (!row.created_by) return '—'
  return row.created_by.name || row.created_by.email || `#${row.created_by.id}`
}

const sortRows = (data: InvoiceReturnListItem[]) =>
  [...data].sort((a, b) => {
    const aTime = new Date(a.return_date).getTime()
    const bTime = new Date(b.return_date).getTime()
    if (aTime !== bTime) return bTime - aTime
    return b.id - a.id
  })

const applyPagination = (page = 1) => {
  const total = allRows.value.length
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const nextPage = Math.min(Math.max(1, page), lastPage)
  const start = (nextPage - 1) * pageSize
  rows.value = allRows.value.slice(start, start + pageSize)
  pagination.value = {
    current_page: nextPage,
    last_page: lastPage,
    per_page: pageSize,
    total,
  }
  currentPage.value = nextPage
}

const loadInvoiceOptions = async () => {
  loadingInvoices.value = true
  try {
    const allInvoices: InvoiceListItem[] = []
    let page = 1
    let lastPage = 1
    do {
      await invoicesStore.loadList({ page, per_page: 100, sort: '-created_at' })
      allInvoices.push(...invoicesStore.list)
      lastPage = invoicesStore.pagination.last_page || 1
      page += 1
    }
    while (page <= lastPage)
    invoiceOptions.value = allInvoices
  }
  catch (error: unknown) {
    throw error
  }
  finally {
    loadingInvoices.value = false
  }
}

const loadReturns = async (page = currentPage.value) => {
  if (!canViewReturns.value) return
  loadingReturns.value = true
  try {
    if (!invoiceOptions.value.length) {
      await loadInvoiceOptions()
    }
    const query = search.value.trim() || undefined
    const responseList = await Promise.all(
      invoiceOptions.value.map(invoice =>
        invoicesStore.loadInvoiceReturnsForInvoice(invoice.id, { page: 1, per_page: 100, search: query }),
      ),
    )
    allRows.value = sortRows(responseList.flatMap(res => res.returns))
    applyPagination(page)
  }
  catch (error: unknown) {
    toast.error(t('invoice_returns_page.load_error'))
  }
  finally {
    loadingReturns.value = false
  }
}

const requestDelete = (row: InvoiceReturnListItem) => {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await invoicesStore.deleteInvoiceReturn(deleteTarget.value.id)
    toast.success(t('invoice_returns_page.delete_success'))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadReturns(currentPage.value)
  }
  catch {
    toast.error(t('invoice_returns_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

const goToPage = (page: number) => {
  applyPagination(page)
}

watch(search, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => loadReturns(1), 350)
})

onMounted(async () => {
  if (!canViewReturns.value) return
  await loadInvoiceOptions()
  await loadReturns(1)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('invoice_returns_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('invoice_returns_page.subtitle_total', { count: pagination.total ?? rows.length }) }}
        </p>
      </div>
    </div>

    <div v-if="!canViewReturns" class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">
      {{ t('invoice_returns_page.no_permission') }}
    </div>

    <template v-else>
      <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
        <div class="relative w-full sm:min-w-[220px] sm:max-w-sm">
          <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="search"
            :placeholder="t('invoice_returns_page.search_placeholder')"
            class="h-9 pr-9"
          />
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader class="hidden md:table-header-group">
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="text-start">{{ t('invoice_returns_page.col_id') }}</TableHead>
              <TableHead class="text-start">{{ t('invoice_returns_page.col_ref_id') }}</TableHead>
              <TableHead class="text-start">{{ t('invoice_returns_page.col_invoice_id') }}</TableHead>
              <TableHead class="text-start">{{ t('invoice_returns_page.col_return_date') }}</TableHead>
              <TableHead class="text-start">{{ t('invoice_returns_page.col_created_by') }}</TableHead>
              <TableHead class="text-end">{{ t('common.actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loadingReturns" class="md:table-row">
              <TableCell :colspan="6" class="py-14 text-center">
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  {{ t('common.loading') }}…
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!rows.length" class="md:table-row">
              <TableCell :colspan="6" class="py-14 text-center text-sm text-muted-foreground">
                {{ t('invoice_returns_page.empty') }}
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in rows"
              :key="row.id"
              class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm
                     md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none
                     hover:bg-muted/30 transition-colors align-middle"
            >
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoice_returns_page.col_id') }}</span>
                <span>{{ row.id }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoice_returns_page.col_ref_id') }}</span>
                <NuxtLink
                  :to="`/invoice-returns/show/${row.id}`"
                  class="text-sm font-medium text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
                >
                  {{ row.return_reference || `#${row.id}` }}
                </NuxtLink>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoice_returns_page.col_invoice_id') }}</span>
                <span>{{ row.invoice_id }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoice_returns_page.col_return_date') }}</span>
                <span>{{ formatDisplayDate(row.return_date) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('invoice_returns_page.col_created_by') }}</span>
                <span>{{ createdByLabel(row) }}</span>
              </TableCell>
              <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
                <TableRowActions
                  :actions="[
                    { key: `edit-${row.id}`, label: t('common.edit'), type: 'link', to: `/invoice-returns/edit/${row.id}`, icon: Pencil, tone: 'default', visible: canEditReturn },
                    { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: canDeleteReturn, onClick: () => requestDelete(row) },
                  ]"
                  variant="invoice"
                  align="end"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div
        v-if="pagination.last_page > 1"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg px-4 py-3"
      >
        <p class="text-xs text-muted-foreground">
          {{
            t('common.showing_range', {
              from: pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0,
              to: pagination.total ? Math.min(currentPage * pagination.per_page, pagination.total) : 0,
              total: pagination.total,
            })
          }}
        </p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loadingReturns"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        >
          <span class="text-sm text-muted-foreground px-2 tabular-nums">
            {{ t('common.page_of', { current: currentPage, total: pagination.last_page }) }}
          </span>
        </PaginationArrowButtons>
      </div>
    </template>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('invoice_returns_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('invoice_returns_page.delete_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction class="bg-red-600 text-white hover:bg-red-700" :disabled="deleting" @click="confirmDelete">
            <Loader2 v-if="deleting" class="me-2 size-4 animate-spin" />
            {{ t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
