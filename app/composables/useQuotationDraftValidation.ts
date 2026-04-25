import type { QuotationDraft } from '@/stores/quotations'

/** Field-level errors for quotation create/edit drafts. */
export function validateQuotationDraft(
  draft: QuotationDraft,
  selectedRowsCount: number,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.issue_date) errors.issue_date = t('quotations_page.issue_date_required')
  if (!draft.expiry_date) errors.expiry_date = t('quotations_page.expiry_date_required')
  if (draft.issue_date && draft.expiry_date && draft.expiry_date < draft.issue_date) {
    errors.expiry_date = t('quotations_page.expiry_after_issue')
  }
  if (!selectedRowsCount) errors.items = t('quotations_page.product_required')

  draft.items.forEach((item, idx) => {
    if (!item.product_id) return
    if (item.product?.variations.length && !item.variation_id) {
      errors[`row_${idx}_variation`] = t('quotations_page.variation_required')
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      errors[`row_${idx}_qty`] = t('quotations_page.qty_invalid')
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      errors[`row_${idx}_unit_price`] = t('quotations_page.unit_price_invalid')
    }
    const d = item.discount_percent
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      errors[`row_${idx}_discount`] = t('quotations_page.discount_percent_invalid')
    }
  })

  return errors
}

const FORM_KEY_ORDER = ['issue_date', 'expiry_date', 'items'] as const

/** Pick one message for a validation-error toast (stable priority). */
export function firstValidationToastDescription(errors: Record<string, string>): string {
  for (const k of FORM_KEY_ORDER) {
    if (errors[k]) return errors[k]!
  }
  const rowKeys = Object.keys(errors).filter(k => k.startsWith('row_')).sort()
  if (rowKeys.length) return errors[rowKeys[0]!]!
  return Object.values(errors)[0] ?? ''
}
