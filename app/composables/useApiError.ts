export const useApiError = () => {
  const { t } = useI18n()

  // ── Maps backend English strings → translation keys ──
  const errorMap: Record<string, string> = {
    // Auth — exact Laravel messages
    'The email field is required.': 'errors.email_required',
    'The email field must be a valid email address.': 'errors.email_invalid',
    'The email has already been taken.': 'errors.email_taken',
    'The password field is required.': 'errors.password_required',
    'The password field must be at least 8 characters.': 'errors.password_min',
    'The password field confirmation does not match.': 'errors.password_confirmed',
    'These credentials do not match our records.': 'errors.invalid_credentials',
    'Unauthenticated.': 'errors.unauthorized',

    // Phone (common in this API)
    'The phone field is required.': 'errors.required',
    'The phone has already been taken.': 'errors.unique',

    // Users / roles
    'The role ids field is required.': 'errors.roles_required',

    // General Laravel validation rule keywords (partial matching)
    required: 'errors.required',
    unique: 'errors.unique',
    min: 'errors.min_length',
    max: 'errors.max_length',
    numeric: 'errors.numeric',
    exists: 'errors.not_found',
    confirmed: 'errors.password_confirmed',
    email: 'errors.email_invalid',
    integer: 'errors.numeric',

    // Business logic — add as backend defines them
    'Insufficient stock': 'errors.insufficient_stock',
    'Invoice is locked': 'errors.invoice_locked',
    'Approval required': 'errors.approval_required',
    'already been taken': 'errors.unique',
    'has already been': 'errors.unique',
    'does not exist': 'errors.not_found',
    'is required': 'errors.required',
  }

  // Longer keys first so partial matches are more specific
  const sortedEntries = Object.entries(errorMap).sort((a, b) => b[0].length - a[0].length)

  const resolveMessage = (message: string): string => {
    if (!message) return t('errors.unknown_error')

    if (errorMap[message]) {
      return t(errorMap[message])
    }

    const lower = message.toLowerCase()
    for (const [key, translationKey] of sortedEntries) {
      if (lower.includes(key.toLowerCase())) {
        return t(translationKey)
      }
    }

    return t('errors.unknown_error')
  }

  const normalizeMessage = (raw: unknown): string => {
    if (typeof raw === 'string') return raw
    if (raw && typeof raw === 'object') {
      const o = raw as { ar?: string; en?: string }
      return o.ar || o.en || ''
    }
    return ''
  }

  const getFieldErrors = (error: unknown): Record<string, string> => {
    const fieldErrors: Record<string, string> = {}

    const err = error as { data?: { errors?: Record<string, string[] | string> } }
    const errors = err?.data?.errors
    if (!errors || typeof errors !== 'object') return fieldErrors

    for (const [field, messages] of Object.entries(errors)) {
      const first = Array.isArray(messages) ? messages[0] : messages
      if (typeof first !== 'string' || !first) continue
      fieldErrors[field] = resolveMessage(first)
    }

    return fieldErrors
  }

  const getErrorMessage = (error: unknown): string => {
    const err = error as {
      response?: { status?: number; _data?: { message?: unknown; status_code?: number } }
      data?: { message?: unknown; status_code?: number; errors?: unknown }
      status?: number
      statusCode?: number
      message?: string
    }

    const res = err?.response
    const data = (err?.data ?? res?._data ?? {}) as {
      message?: unknown
      status_code?: number
    }

    // Typical offline / DNS failure — no HTTP response
    if (!res && !err?.data && !err?.statusCode) {
      return t('errors.network_error')
    }

    const status =
      res?.status ??
      err?.statusCode ??
      err?.status ??
      data?.status_code

    if (status === 401) return t('errors.unauthorized')
    if (status === 403) return t('errors.forbidden')
    if (status === 404) return t('errors.not_found')
    if (status === 429) return t('errors.too_many_requests')
    if (typeof status === 'number' && status >= 500) return t('errors.server_error')

    const topMessage =
      normalizeMessage(data?.message) ||
      (typeof err?.message === 'string' ? err.message : '')

    return resolveMessage(topMessage)
  }

  const addErrorMapping = (backendMessage: string, translationKey: string) => {
    errorMap[backendMessage] = translationKey
  }

  /** Laravel 422 or payload with `errors` object */
  const isValidationError = (error: unknown): boolean => {
    const e = error as {
      statusCode?: number
      status?: number
      response?: { status?: number }
      data?: { errors?: unknown }
    }
    const s = e?.statusCode ?? e?.status ?? e?.response?.status
    if (s === 422) return true
    return !!(e?.data?.errors && typeof e.data.errors === 'object')
  }

  return {
    getErrorMessage,
    getFieldErrors,
    resolveMessage,
    addErrorMapping,
    isValidationError,
  }
}
