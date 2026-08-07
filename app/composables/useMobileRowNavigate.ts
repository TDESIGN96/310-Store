export function useMobileRowNavigate() {
  const navigateRow = (path: string) => {
    if (!import.meta.client) return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    return navigateTo(path)
  }

  return { navigateRow }
}
