/**
 * KAMU / Laravel API errors: show backend strings as-is (e.g. Arabic).
 * No mapping from API text → local i18n keys for API validation or top-level messages.
 */
export const useApiError = () => {
  const { t, locale } = useI18n()

  /** String or `{ ar, en }` from API */
  const pickLocalizedApiMessage = (raw: unknown): string => {
    if (typeof raw === 'string') return raw.trim()
    if (raw && typeof raw === 'object') {
      const o = raw as { ar?: string; en?: string }
      if (locale.value === 'ar') return (o.ar || o.en || '').trim()
      return (o.en || o.ar || '').trim()
    }
    return ''
  }

  /** ofetch / $fetch: body on `error.data` or `error.response._data` */
  const getPayload = (error: unknown) => {
    const e = error as {
      data?: { errors?: unknown; message?: unknown; status_code?: number }
      response?: { status?: number; _data?: { errors?: unknown; message?: unknown; status_code?: number } }
      statusCode?: number
      status?: number
      message?: string
    }
    return (e?.data ?? e?.response?._data ?? {}) as {
      errors?: Record<string, string[] | string>
      message?: unknown
      status_code?: number
    }
  }

  /** First validation message string from Laravel `errors` object */
  const firstValidationMessage = (errors: Record<string, string[] | string> | undefined): string => {
    if (!errors || typeof errors !== 'object') return ''
    for (const messages of Object.values(errors)) {
      const first = Array.isArray(messages) ? messages[0] : messages
      if (typeof first === 'string' && first.trim()) return first.trim()
    }
    return ''
  }

  /**
   * 422 field errors: first message per field, exactly as returned by the backend.
   */
  const getFieldErrors = (error: unknown): Record<string, string> => {
    const fieldErrors: Record<string, string> = {}
    const errors = getPayload(error).errors
    if (!errors || typeof errors !== 'object') return fieldErrors

    for (const [field, messages] of Object.entries(errors)) {
      const first = Array.isArray(messages) ? messages[0] : messages
      if (typeof first !== 'string' || !first) continue
      fieldErrors[field] = first.trim()
    }
    return fieldErrors
  }

  /**
   * Top-level or non-field error banner. Uses API `message` as-is when present.
   * 422: never treated as "network" — use `message` or first `errors[...]` string from the endpoint.
   */
  const getErrorMessage = (error: unknown): string => {
    const e = error as {
      data?: { message?: unknown; status_code?: number; errors?: unknown }
      response?: { status?: number; _data?: { message?: unknown; status_code?: number; errors?: unknown } }
      statusCode?: number
      status?: number
      message?: string
    }

    const data = getPayload(e)

    const status =
      e?.response?.status ??
      e?.statusCode ??
      e?.status ??
      data?.status_code

    const is422 = status === 422 || data?.status_code === 422

    const backendMessage =
      pickLocalizedApiMessage(data?.message) ||
      (typeof e?.message === 'string' ? e.message.trim() : '')

    // 422: endpoint always wins — never show generic "network" for validation responses
    if (is422) {
      if (backendMessage) return backendMessage
      const fromFields = firstValidationMessage(data.errors)
      if (fromFields) return fromFields
      return t('errors.unknown_error')
    }

    if (backendMessage) return backendMessage

    const fromValidationBody = firstValidationMessage(data.errors)
    if (fromValidationBody) return fromValidationBody

    const res = e?.response
    // Real network / offline: no HTTP error object and no parsed body
    const hasParsedBody =
      (e?.data && typeof e.data === 'object') ||
      (data && (data.message !== undefined || data.errors !== undefined || data.status_code !== undefined))

    if (!res && !hasParsedBody && e?.statusCode === undefined && e?.status === undefined) {
      return t('errors.network_error')
    }

    if (status === 401) return t('errors.unauthorized')
    if (status === 403) return t('errors.forbidden')
    if (status === 404) return t('errors.not_found')
    if (status === 429) return t('errors.too_many_requests')
    if (typeof status === 'number' && status >= 500) return t('errors.server_error')

    return t('errors.unknown_error')
  }

  /** Laravel 422 or any payload with an `errors` object */
  const isValidationError = (error: unknown): boolean => {
    const e = error as {
      statusCode?: number
      status?: number
      response?: { status?: number }
      data?: { errors?: unknown }
    }
    const s = e?.statusCode ?? e?.status ?? e?.response?.status
    if (s === 422) return true
    const errors = getPayload(e).errors ?? e?.data?.errors
    return !!(errors && typeof errors === 'object')
  }

  return {
    getFieldErrors,
    getErrorMessage,
    isValidationError,
  }
}
