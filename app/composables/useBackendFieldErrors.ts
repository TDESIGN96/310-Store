export type FieldErrorMap = Record<string, string>

/**
 * Preserve backend keys and add frontend aliases for indexed payload errors.
 * This lets forms highlight all invalid controls without losing API fidelity.
 */
export function normalizeBackendFieldErrors(fieldErrors: FieldErrorMap): FieldErrorMap {
  const normalized: FieldErrorMap = { ...fieldErrors }

  for (const [key, message] of Object.entries(fieldErrors)) {
    let m = key.match(/^items\.(\d+)\.(variation_id|qty|unit_price|discount|discount_value)$/)
    if (m) {
      const rowIndex = m[1]
      const backendField = m[2]
      const uiField = backendField === 'discount_value' ? 'discount' : backendField
      normalized[`row_${rowIndex}_${uiField}`] ||= message
      continue
    }

    m = key.match(/^additional_costs\.(\d+)\.(key|amount)$/)
    if (m) {
      const rowIndex = m[1]
      const uiField = m[2]
      normalized[`additional_cost_${rowIndex}_${uiField}`] ||= message
      continue
    }

    m = key.match(/^selected_variation_ids\.(\d+)$/)
    if (m) {
      normalized.selected_variation_ids ||= message
      continue
    }

    if (key === 'variation_ids') {
      normalized.selected_variation_ids ||= message
    }
  }

  return normalized
}
