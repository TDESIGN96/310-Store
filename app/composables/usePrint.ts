export function usePrint() {
  const print = () => {
    if (import.meta.client) window.print()
  }

  return { print }
}
