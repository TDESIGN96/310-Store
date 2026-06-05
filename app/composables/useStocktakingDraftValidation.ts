import type { StocktakingDraft } from '@/stores/stocktakingOrders'

const REMINDER_MIN = 1
const REMINDER_MAX = 30

const normalizePickerDate = (value: string): Date | null => {
  const raw = value.trim()
  if (!raw) return null
  const dmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2]) - 1
    const year = Number(dmyMatch[3])
    const date = new Date(year, month, day)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
    return date
  }
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2]) - 1
    const day = Number(isoMatch[3])
    const date = new Date(year, month, day)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
    return date
  }
  return null
}

const startOfToday = (): Date => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/** Field-level errors for stocktaking order create draft. */
export function validateStocktakingDraft(
  draft: StocktakingDraft,
  t: (key: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!draft.warehouse_id) {
    errors.warehouse_id = t('stocktaking_orders_page.warehouse_required')
  }

  if (!draft.type) {
    errors.type = t('stocktaking_orders_page.type_required')
  }

  if (!draft.stocktaking_date.trim()) {
    errors.stocktaking_date = t('stocktaking_orders_page.date_required')
  }
  else {
    const selected = normalizePickerDate(draft.stocktaking_date)
    if (!selected) {
      errors.stocktaking_date = t('stocktaking_orders_page.date_required')
    }
    else if (selected < startOfToday()) {
      errors.stocktaking_date = t('stocktaking_orders_page.date_past')
    }
  }

  if (draft.type === 'partial' && draft.selected_variation_ids.length === 0) {
    errors.selected_variation_ids = t('stocktaking_orders_page.products_required_partial')
  }

  if (!draft.counter_ids.length) {
    errors.counter_ids = t('stocktaking_orders_page.counters_required')
  }

  if (draft.first_reminder_days != null) {
    if (
      !Number.isFinite(draft.first_reminder_days)
      || draft.first_reminder_days < REMINDER_MIN
      || draft.first_reminder_days > REMINDER_MAX
    ) {
      errors.first_reminder_days = t('stocktaking_orders_page.reminder_invalid')
    }
  }

  if (draft.second_reminder_days != null) {
    if (draft.first_reminder_days == null) {
      errors.second_reminder_days = t('stocktaking_orders_page.second_reminder_requires_first')
    }
    else if (
      !Number.isFinite(draft.second_reminder_days)
      || draft.second_reminder_days < REMINDER_MIN
      || draft.second_reminder_days > REMINDER_MAX
    ) {
      errors.second_reminder_days = t('stocktaking_orders_page.reminder_invalid')
    }
  }

  return errors
}

const FORM_KEY_ORDER = [
  'warehouse_id',
  'type',
  'stocktaking_date',
  'selected_variation_ids',
  'counter_ids',
  'first_reminder_days',
  'second_reminder_days',
] as const

/** Pick one message for a validation-error toast (stable priority). */
export function firstStocktakingValidationToastDescription(errors: Record<string, string>): string {
  for (const key of FORM_KEY_ORDER) {
    if (errors[key]) return errors[key]!
  }
  return Object.values(errors)[0] ?? ''
}
