import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { ReportExportFormat, ReportExportSlug } from '@/stores/reports'
import { reportExportExcelPermission, reportExportPdfPermission } from '@/config/reportPermissions'

/**
 * Shared export trigger for report pages: permission-gates the action, tracks a
 * separate loading state per format, and queues the async export job via the
 * reports store. The resulting file shows up in Reports Center once ready.
 */
export function useReportExport(slug: ReportExportSlug) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const reportsStore = useReportsStore()
  const { getErrorMessage } = useApiError()

  const canExportExcel = computed(() => can('reports.index') || can('reports.show') || can(reportExportExcelPermission(slug)))
  const canExportPdf = computed(() => can('reports.index') || can('reports.show') || can(reportExportPdfPermission(slug)))
  const canExportReports = computed(() => canExportExcel.value || canExportPdf.value)
  const exportingExcel = ref(false)
  const exportingPdf = ref(false)

  const runExport = async (format: ReportExportFormat, params: Record<string, unknown> | null) => {
    const allowed = format === 'excel' ? canExportExcel.value : canExportPdf.value
    if (!allowed || !params) return
    const loadingRef = format === 'excel' ? exportingExcel : exportingPdf
    loadingRef.value = true
    try {
      await reportsStore.exportReport(slug, format, params)
      toast.success(t('reports_hub.export_queued_success'), {
        action: {
          label: t('reports_hub.view_reports_center'),
          onClick: () => navigateTo('/reports-center'),
        },
      })
    }
    catch (error) {
      toast.error(getErrorMessage(error))
    }
    finally {
      loadingRef.value = false
    }
  }

  return {
    canExportReports,
    canExportExcel,
    canExportPdf,
    exportingExcel,
    exportingPdf,
    exportExcel: (params: Record<string, unknown> | null) => runExport('excel', params),
    exportPdf: (params: Record<string, unknown> | null) => runExport('pdf', params),
  }
}
