/**
 * English fallback label generation for permission ids that have no matching
 * i18n translation (e.g. permissions newly added on the backend). Existing
 * translated permissions always take priority — this is only used as a fallback.
 */

const WORD_SPLIT_REGEX = /[_-]+/g

const CRUD_VERB_LABELS: Record<string, (singular: string, plural: string) => string> = {
  index: (_singular, plural) => `View ${plural} list`,
  show: singular => `View a specific ${singular}`,
  store: singular => `Create ${singular}`,
  update: singular => `Edit ${singular}`,
  destroy: singular => `Delete ${singular}`,
}

function capitalizeFirst(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function humanizeSegment(segment: string): string {
  const trimmed = segment.trim()
  if (!trimmed) return ''
  return trimmed
    .split(WORD_SPLIT_REGEX)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function singularizeWord(word: string): string {
  if (!word) return word
  if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`
  if (word.endsWith('ses') && word.length > 3) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 1) return word.slice(0, -1)
  return word
}

function singularizeLabel(label: string): string {
  const words = label.split(' ').filter(Boolean)
  if (!words.length) return label
  return words
    .map((word, index) => (index === words.length - 1 ? singularizeWord(word) : word))
    .join(' ')
}

/** Fallback group label, e.g. `loyalty_points` -> `Loyalty Points management`. */
export function humanizePermissionGroupId(groupId: string): string {
  const label = humanizeSegment(groupId)
  return label ? `${label} management` : groupId
}

/**
 * Fallback checkbox label for a full permission id, e.g.:
 * - `users.index` -> `View users list`
 * - `reports.sales.show` -> `Show sales report`
 * - `transport_invoices.approve` -> `Approve transport invoice`
 */
export function humanizePermissionId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) return id

  const dot = trimmed.indexOf('.')
  if (dot === -1) return humanizeSegment(trimmed) || trimmed

  const moduleSegment = trimmed.slice(0, dot)
  const rest = trimmed.slice(dot + 1)
  const parts = rest.split('.').filter(Boolean)
  if (!parts.length) return humanizeSegment(moduleSegment) || trimmed

  const modulePlural = humanizeSegment(moduleSegment).toLowerCase()
  const moduleSingular = singularizeLabel(modulePlural)
  const verb = parts[parts.length - 1]?.toLowerCase() ?? ''
  const middleParts = parts.slice(0, -1)

  if (!middleParts.length && CRUD_VERB_LABELS[verb]) {
    return capitalizeFirst(CRUD_VERB_LABELS[verb](moduleSingular, modulePlural))
  }

  const middleLabel = middleParts.map(part => humanizeSegment(part).toLowerCase()).join(' ')
  const verbLabel = humanizeSegment(verb)
  const label = [verbLabel, middleLabel, moduleSingular].filter(Boolean).join(' ')
  return capitalizeFirst(label) || trimmed
}
