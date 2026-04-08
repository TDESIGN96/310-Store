import { subjectPathFromMorph } from '@/utils/activitySubjectLink'

/** Laravel-style pagination object returned by list endpoints. */
export interface ActivitiesPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

/** Normalized row for the activity log table UI. */
export interface ActivityTableRow {
  id: number
  userId: number | null
  userName: string
  activityLabel: string
  createdAt: string
  subjectLink: string | null
}

/**
 * Pulls the activity list array from heterogeneous API envelopes (`data`, nested `data.activities`, etc.).
 */
export function extractActivitiesList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object')
    return []
  const d = payload as Record<string, unknown>
  if (Array.isArray(d.data))
    return d.data
  const inner = d.data
  if (inner && typeof inner === 'object') {
    const o = inner as Record<string, unknown>
    if (Array.isArray(o.activities))
      return o.activities
    if (Array.isArray(o.data))
      return o.data
    if (Array.isArray(o.items))
      return o.items
  }
  if (Array.isArray(d.activities))
    return d.activities
  return []
}

/**
 * Returns true when `value` looks like a pagination object (at least current and last page).
 */
function isActivitiesPagination(value: unknown): value is ActivitiesPagination {
  if (!value || typeof value !== 'object')
    return false
  const o = value as Record<string, unknown>
  return typeof o.current_page === 'number' && typeof o.last_page === 'number'
}

/**
 * Resolves pagination from root or nested `data`, with a fallback when counts live on the root object.
 */
export function extractActivitiesPagination(payload: unknown): ActivitiesPagination | null {
  if (!payload || typeof payload !== 'object')
    return null
  const d = payload as Record<string, unknown>
  const inner = d.data
  const nested =
    (inner && typeof inner === 'object' ? (inner as { pagination?: unknown }).pagination : undefined)
    ?? d.pagination
  if (isActivitiesPagination(nested))
    return nested
  if (typeof d.current_page === 'number' && typeof d.last_page === 'number') {
    return {
      current_page: d.current_page,
      last_page: d.last_page,
      per_page: typeof d.per_page === 'number' ? d.per_page : 15,
      total: typeof d.total === 'number' ? d.total : 0,
    }
  }
  return null
}

/**
 * Detects API flags that mean the related subject was removed or should not be linked.
 */
function isActivitySubjectDeleted(raw: Record<string, unknown>): boolean {
  if (raw.deleted === true || raw.subject_deleted === true)
    return true
  if (raw.subject_exists === false || raw.related_exists === false)
    return true
  return false
}

/**
 * Maps one raw API activity record to `ActivityTableRow`, or `null` if the payload is not a valid row.
 */
export function parseActivityTableRow(raw: Record<string, unknown>): ActivityTableRow | null {
  const id = raw.id
  if (typeof id !== 'number' && typeof id !== 'string')
    return null

  const userObj = raw.user ?? raw.causer ?? raw.actor
  let userId: number | null = null
  let userName = '—'
  if (userObj && typeof userObj === 'object') {
    const u = userObj as Record<string, unknown>
    if (typeof u.id === 'number')
      userId = u.id
    else if (typeof u.id === 'string')
      userId = Number(u.id)
    if (Number.isNaN(userId))
      userId = null
    if (typeof u.name === 'string')
      userName = u.name
  }

  const desc = raw.description ?? raw.activity ?? raw.event ?? raw.log_name
  const activityLabel = typeof desc === 'string' ? desc : String(desc ?? '—')

  const createdRaw = raw.created_at ?? raw.createdAt
  const createdAt = typeof createdRaw === 'string' ? createdRaw : ''

  const deleted = isActivitySubjectDeleted(raw)
  let subjectLink: string | null = null

  if (!deleted) {
    if (typeof raw.url === 'string' && raw.url.startsWith('/'))
      subjectLink = raw.url
    else {
      const st = raw.subject_type != null ? String(raw.subject_type) : ''
      const sid = raw.subject_id
      const subjectId =
        typeof sid === 'number' ? sid : typeof sid === 'string' ? Number(sid) : Number.NaN
      if (st && Number.isFinite(subjectId))
        subjectLink = subjectPathFromMorph(st, subjectId)
    }
  }

  return {
    id: Number(id),
    userId,
    userName,
    activityLabel,
    createdAt,
    subjectLink,
  }
}
