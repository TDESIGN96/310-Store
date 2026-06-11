import type { PurchaseBillDraft } from '@/stores/purchaseBills'

const STRICT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STRICT_PHONE_RE = /^\+?[0-9]{8,15}$/

/** Field-level errors for purchase-bill create/edit drafts. */
export function validatePurchaseBillDraft(
  draft: PurchaseBillDraft,
  selectedRowsCount: number,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const mobile = String(draft.supplier_mobile ?? '').trim()
  const email = String(draft.supplier_email ?? '').trim()
  const address = String(draft.address ?? '').trim()

  if (!mobile) errors.supplier_mobile = t('purchase_bills_page.supplier_mobile_required')
  else if (!STRICT_PHONE_RE.test(mobile)) errors.supplier_mobile = t('purchase_bills_page.supplier_mobile_invalid')

  if (!email) errors.supplier_email = t('purchase_bills_page.supplier_email_required')
  else if (!STRICT_EMAIL_RE.test(email)) errors.supplier_email = t('purchase_bills_page.supplier_email_invalid')

  if (!address) errors.address = t('purchase_bills_page.address_required')

  if (!draft.bill_date) errors.bill_date = t('purchase_bills_page.bill_date_required')
  if (!draft.warehouse_id) errors.warehouse_id = t('purchase_bills_page.warehouse_required')
  if (!selectedRowsCount) errors.items = t('purchase_bills_page.product_required')

  draft.items.forEach((item, idx) => {
    if (!item.product_id) return
    if (item.product?.variations.length && !item.variation_id) {
      errors[`row_${idx}_variation`] = t('purchase_bills_page.variation_required')
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      errors[`row_${idx}_qty`] = t('purchase_bills_page.qty_invalid')
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      errors[`row_${idx}_unit_price`] = t('purchase_bills_page.unit_price_invalid')
    }
    const d = item.discount_value
    if (!Number.isFinite(d) || d < 0) {
      errors[`row_${idx}_discount`] = t('purchase_bills_page.discount_percent_invalid')
      return
    }
    if (item.discount_mode === 'percentage' && d > 100) {
      errors[`row_${idx}_discount`] = t('purchase_bills_page.discount_percent_invalid')
    }
  })

  return errors
}

const FORM_KEY_ORDER = ['supplier_mobile', 'supplier_email', 'address', 'bill_date', 'warehouse_id', 'items'] as const

/** Pick one message for a validation-error toast (stable priority). */
export function firstPurchaseBillValidationToastDescription(errors: Record<string, string>): string {
  for (const k of FORM_KEY_ORDER) {
    if (errors[k]) return errors[k]!
  }
  const rowKeys = Object.keys(errors).filter(k => k.startsWith('row_')).sort()
  if (rowKeys.length) return errors[rowKeys[0]!]!
  return Object.values(errors)[0] ?? ''
}
