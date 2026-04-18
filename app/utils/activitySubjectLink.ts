/**
 * When the activity API does not return a `url`, map Spatie-style `subject_type` + `subject_id`
 * to an in-app route. Returns null if the subject is unknown or has no detail screen.
 */
export function subjectPathFromMorph(subjectType: string, subjectId: number): string | null {
  if (!subjectType || !Number.isFinite(subjectId)) return null
  const t = subjectType.toLowerCase()
  if (t.includes('user')) return `/users/show/${subjectId}`
  if (t.includes('unit')) return `/units/show/${subjectId}`
  if (t.includes('categor')) return `/categories/show/${subjectId}`
  if (t.includes('warehouse')) return `/warehouses/show/${subjectId}`
  if (t.includes('product')) return `/products/show/${subjectId}`
  if (t.includes('role')) return `/roles/edit/${subjectId}`
  return null
}
