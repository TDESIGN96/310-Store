type ErrorKeyPrefix = 'list_error' | 'error'

const getHttpStatus = (error: unknown): number | undefined => {
  const e = error as {
    data?: { status_code?: number }
    response?: { status?: number; _data?: { status_code?: number } }
    statusCode?: number
    status?: number
  }
  const data = (e?.data ?? e?.response?._data ?? {}) as { status_code?: number }
  return e?.response?.status ?? e?.statusCode ?? e?.status ?? data?.status_code
}

export function useResourceListLoadError(
  namespace: string,
  keyPrefix: ErrorKeyPrefix = 'list_error',
) {
  const { t } = useI18n()
  const { getErrorMessage } = useApiError()

  const loadError = ref<{ title: string; detail: string } | null>(null)
  const tr = (suffix: string) => t(`${namespace}.${keyPrefix}_${suffix}`)

  const clearLoadError = () => {
    loadError.value = null
  }

  const setLoadErrorNotFound = () => {
    loadError.value = {
      title: tr('not_found_title'),
      detail: tr('not_found_detail'),
    }
  }

  const setLoadErrorFromException = (error: unknown) => {
    const status = getHttpStatus(error)
    if (status === 404) {
      setLoadErrorNotFound()
      return
    }
    if (status === 403) {
      loadError.value = {
        title: tr('forbidden_title'),
        detail: tr('forbidden_detail'),
      }
      return
    }
    if (status === 401) {
      loadError.value = {
        title: tr('unauthorized_title'),
        detail: tr('unauthorized_detail'),
      }
      return
    }
    if (typeof status === 'number' && status >= 500) {
      loadError.value = {
        title: tr('server_title'),
        detail: tr('server_detail'),
      }
      return
    }
    loadError.value = {
      title: tr('generic_title'),
      detail: getErrorMessage(error),
    }
  }

  // Backward-compatible aliases used by list pages.
  const listLoadError = loadError
  const clearListLoadError = clearLoadError
  const setListLoadErrorFromException = setLoadErrorFromException

  return {
    loadError,
    clearLoadError,
    setLoadErrorFromException,
    setLoadErrorNotFound,
    listLoadError,
    clearListLoadError,
    setListLoadErrorFromException,
  }
}
