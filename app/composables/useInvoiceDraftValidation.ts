import type { InvoiceDraft } from '@/stores/invoices'

const STRICT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STRICT_PHONE_RE = /^\+?[0-9]{8,15}$/

/** Field-level errors for invoice create/edit drafts. */
export function validateInvoiceDraft(
  draft: InvoiceDraft,
  selectedRowsCount: number,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const mobile = String(draft.customer_mobile ?? '').trim()
  const email = String(draft.customer_email ?? '').trim()
  const address = String(draft.address ?? '').trim()

  if (!mobile) errors.customer_mobile = t('invoices_page.customer_mobile_required')
  else if (!STRICT_PHONE_RE.test(mobile)) errors.customer_mobile = t('invoices_page.customer_mobile_invalid')

  if (!email) errors.customer_email = t('invoices_page.customer_email_required')
  else if (!STRICT_EMAIL_RE.test(email)) errors.customer_email = t('invoices_page.customer_email_invalid')

  if (!address) errors.address = t('invoices_page.address_required')

  if (!draft.invoice_date) errors.invoice_date = t('invoices_page.invoice_date_required')
  if (!draft.warehouse_id) errors.warehouse_id = t('invoices_page.warehouse_required')
  if (!selectedRowsCount) errors.items = t('invoices_page.product_required')

  draft.items.forEach((item, idx) => {
    if (!item.product_id) return
    if (item.product?.variations.length && !item.variation_id) {
      errors[`row_${idx}_variation`] = t('invoices_page.variation_required')
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      errors[`row_${idx}_qty`] = t('invoices_page.qty_invalid')
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      errors[`row_${idx}_unit_price`] = t('invoices_page.unit_price_invalid')
    }
    const d = item.discount_value
    if (!Number.isFinite(d) || d < 0) {
      errors[`row_${idx}_discount`] = t('invoices_page.discount_percent_invalid')
      return
    }
    if (item.discount_mode === 'percentage' && d > 100) {
      errors[`row_${idx}_discount`] = t('invoices_page.discount_percent_invalid')
    }
  })

  return errors
}

const FORM_KEY_ORDER = ['customer_mobile', 'customer_email', 'address', 'invoice_date', 'warehouse_id', 'items'] as const

/** Pick one message for a validation-error toast (stable priority). */
export function firstInvoiceValidationToastDescription(errors: Record<string, string>): string {
  for (const k of FORM_KEY_ORDER) {
    if (errors[k]) return errors[k]!
  }
  const rowKeys = Object.keys(errors).filter(k => k.startsWith('row_')).sort()
  if (rowKeys.length) return errors[rowKeys[0]!]!
  return Object.values(errors)[0] ?? ''
}
