export type ReportPermissionSlug =
  | 'sales-summary'
  | 'purchase-summary'
  | 'sales-returns'
  | 'damage-analysis'
  | 'product-profitability'
  | 'distributor-performance'
  | 'warehouse-movement'

/**
 * Maps report page slugs to the backend's per-report permission module
 * (e.g. `sales-summary` -> `sales_summary_report.view`). The backend grants
 * reports access per-report instead of a single `reports.index`/`reports.show`.
 */
export const REPORT_PERMISSION_MODULE: Record<ReportPermissionSlug, string> = {
  'sales-summary': 'sales_summary_report',
  'purchase-summary': 'purchase_summary_report',
  'sales-returns': 'sales_returns_report',
  'damage-analysis': 'damage_analysis_report',
  'product-profitability': 'product_profitability_report',
  'distributor-performance': 'distributor_performance_report',
  'warehouse-movement': 'warehouse_movement_report',
}

export const REPORT_PERMISSION_MODULES: string[] = Object.values(REPORT_PERMISSION_MODULE)

/** `sales_summary_report.view`, `purchase_summary_report.view`, ... — used to gate the Reports nav/hub. */
export const REPORT_VIEW_PERMISSIONS: string[] = REPORT_PERMISSION_MODULES.map(m => `${m}.view`)
export const REPORT_EXPORT_PDF_PERMISSIONS: string[] = REPORT_PERMISSION_MODULES.map(m => `${m}.export_pdf`)
export const REPORT_EXPORT_EXCEL_PERMISSIONS: string[] = REPORT_PERMISSION_MODULES.map(m => `${m}.export_excel`)

export const reportViewPermission = (slug: ReportPermissionSlug): string =>
  `${REPORT_PERMISSION_MODULE[slug]}.view`

export const reportExportPdfPermission = (slug: ReportPermissionSlug): string =>
  `${REPORT_PERMISSION_MODULE[slug]}.export_pdf`

export const reportExportExcelPermission = (slug: ReportPermissionSlug): string =>
  `${REPORT_PERMISSION_MODULE[slug]}.export_excel`
