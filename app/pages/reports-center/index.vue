<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, FileSpreadsheet, FileText, Loader2, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useReportsCenterStore, type ReportsCenterItem } from '@/stores/reportsCenter'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { canAccess } = usePermissions()
const reportsCenterStore = useReportsCenterStore()

const canViewReportsCenter = computed(() => canAccess('reports'))

const currentPage = ref(1)
const deleteTarget = ref<ReportsCenterItem | null>(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)

const list = computed(() => reportsCenterStore.list)
const pagination = computed(() => reportsCenterStore.pagination)
const loading = computed(() => reportsCenterStore.listLoading)

const fmtDate = (value?: string) => formatDisplayDate(value, { withTime: true })

const isProcessing = (row: ReportsCenterItem) => reportsCenterStore.isReportProcessing(row)

const statusBadgeClass = (row: ReportsCenterItem) => {
  const value = (row.status?.value ?? '').toLowerCase()
  if (['failed', 'error'].includes(value)) {
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
  }
  if (isProcessing(row)) {
    return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  }
  return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
}

const statusLabel = (row: ReportsCenterItem) => row.status?.label || row.status?.value || '—'

const formatIcon = (row: ReportsCenterItem) => {
  const value = (row.format?.value ?? '').toLowerCase()
  if (value.includes('excel') || value.includes('xlsx') || value.includes('csv') || value.includes('sheet')) return FileSpreadsheet
  if (value.includes('pdf')) return FileText
  return Download
}

const downloadLabel = (row: ReportsCenterItem) => {
  const label = row.format?.label
  return label ? t('reports_center_page.download_with_format', { format: label }) : t('reports_center_page.download')
}

const filterChips = (row: ReportsCenterItem): string[] => {
  return row.filters
    .map((filter) => {
      if (typeof filter === 'string') return filter
      if (filter && typeof filter === 'object') {
        const obj = filter as Record<string, unknown>
        const label = obj.label ?? obj.key ?? ''
        const value = obj.value ?? ''
        if (label && value !== '' && value !== null && value !== undefined) return `${label}: ${value}`
        if (label) return String(label)
        if (value !== '' && value !== null && value !== undefined) return String(value)
      }
      return filter !== null && filter !== undefined ? String(filter) : ''
    })
    .filter(Boolean)
}

const loadRows = async (page = currentPage.value) => {
  if (!canViewReportsCenter.value) return
  currentPage.value = page
  await reportsCenterStore.loadList({ page, sort: '-generated_on' })
}

const downloadReport = (row: ReportsCenterItem) => {
  if (!row.download_url || isProcessing(row)) return
  if (import.meta.client) window.open(row.download_url, '_blank')
}

const requestDelete = (row: ReportsCenterItem) => {
  if (isProcessing(row)) return
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await reportsCenterStore.deleteReport(deleteTarget.value.id)
    toast.success(t('reports_center_page.delete_success'))
    deleteDialogOpen.value = false
    deleteTarget.value = null
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('reports_center_page.delete_error'))
  }
  finally {
    deleting.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || page > pagination.value.last_page) return
  loadRows(page)
}

onMounted(async () => {
  await loadRows(1)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_center_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('reports_center_page.subtitle_total', { count: pagination.total ?? list.length }) }}
        </p>
      </div>
    </div>

    <div v-if="!canViewReportsCenter" class="rounded-xl bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">
      {{ t('reports_center_page.no_permission') }}
    </div>

    <template v-else>
      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader class="hidden md:table-header-group">
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="text-start font-medium min-w-[220px]">{{ t('reports_center_page.col_file_name') }}</TableHead>
              <TableHead class="text-start font-medium min-w-[200px]">{{ t('reports_center_page.col_filters_applied') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('reports_center_page.col_generated_on') }}</TableHead>
              <TableHead class="text-start font-medium whitespace-nowrap">{{ t('reports_center_page.col_expires_on') }}</TableHead>
              <TableHead class="font-medium min-w-[180px] text-end">{{ t('reports_center_page.col_actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading" class="md:table-row">
              <TableCell :colspan="5" class="py-14 text-center">
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />{{ t('common.loading') }}…
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!list.length" class="md:table-row">
              <TableCell :colspan="5" class="py-14 text-center text-sm text-muted-foreground">
                {{ t('reports_center_page.empty') }}
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in list"
              :key="row.id"
              class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none hover:bg-muted/30 transition-colors align-middle"
            >
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('reports_center_page.col_file_name') }}</span>
                <div class="flex flex-col gap-1 text-end md:text-start">
                  <span class="text-sm font-medium">{{ row.name || '—' }}</span>
                  <div class="flex flex-wrap items-center gap-1.5 justify-end md:justify-start">
                    <Badge variant="outline" :class="statusBadgeClass(row)">{{ statusLabel(row) }}</Badge>
                    <span v-if="row.report_type?.label" class="text-xs text-muted-foreground">{{ row.report_type.label }}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('reports_center_page.col_filters_applied') }}</span>
                <div class="flex flex-wrap gap-1 justify-end md:justify-start">
                  <template v-if="filterChips(row).length">
                    <Badge v-for="(chip, idx) in filterChips(row)" :key="idx" variant="secondary" class="text-xs">
                      {{ chip }}
                    </Badge>
                  </template>
                  <span v-else class="text-sm text-muted-foreground">{{ t('reports_center_page.no_filters') }}</span>
                </div>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('reports_center_page.col_generated_on') }}</span>
                <span class="text-sm tabular-nums rtl:text-start">{{ fmtDate(row.generated_on) }}</span>
              </TableCell>
              <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
                <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('reports_center_page.col_expires_on') }}</span>
                <span class="text-sm tabular-nums rtl:text-start">{{ fmtDate(row.expires_on) }}</span>
              </TableCell>
              <TableCell class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
                <div v-if="isProcessing(row)" class="text-xs text-muted-foreground italic">
                  {{ t('reports_center_page.processing_hint') }}
                </div>
                <TableRowActions
                  v-else
                  :actions="[
                    { key: `download-${row.id}`, label: downloadLabel(row), type: 'button', icon: formatIcon(row), tone: 'default', visible: true, disabled: !row.download_url, onClick: () => downloadReport(row) },
                    { key: `delete-${row.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: true, onClick: () => requestDelete(row) },
                  ]"
                  variant="invoice"
                  align="end"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div v-if="pagination.last_page > 1" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg px-4 py-3">
        <p class="text-xs text-muted-foreground">
          {{ t('common.showing_range', { from: pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0, to: pagination.total ? Math.min(currentPage * pagination.per_page, pagination.total) : 0, total: pagination.total }) }}
        </p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loading"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        >
          <span class="text-sm text-muted-foreground px-2 tabular-nums">{{ t('common.page_of', { current: currentPage, total: pagination.last_page }) }}</span>
        </PaginationArrowButtons>
      </div>
    </template>

    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('reports_center_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('reports_center_page.delete_body') }}</AlertDialogDescription>
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
