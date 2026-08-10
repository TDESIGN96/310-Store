import { onBeforeUnmount } from 'vue'

export interface LongPressSelectOptions {
  /** Hold duration (ms) required before a touch-and-hold counts as a long-press. */
  thresholdMs?: number
  /** Finger movement tolerance (px) before a long-press is cancelled (e.g. the user is scrolling). */
  moveTolerance?: number
}

export interface LongPressRowHandlers {
  onLongPress: () => void
  onTap: () => void
}

/**
 * Shared "hold to select" behavior for mobile list cards.
 *
 * Bind the returned handlers on each row (e.g. `v-bind="bindRow({ onLongPress, onTap })"`):
 * - Holding the card past `thresholdMs` fires `onLongPress` (typically: select this row).
 * - A normal tap fires `onTap` (typically: navigate, or toggle selection when something
 *   is already selected — decide that in the caller using its own `selectedCount`).
 * - The synthetic click that follows a completed long-press is swallowed automatically,
 *   so it doesn't immediately re-toggle the row that was just selected.
 *
 * Only touch input drives the long-press timer; desktop mouse clicks are unaffected and
 * always fall through to `onTap`.
 */
export function useLongPressSelect(options: LongPressSelectOptions = {}) {
  const thresholdMs = options.thresholdMs ?? 450
  const moveTolerance = options.moveTolerance ?? 10

  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let suppressNextClick = false

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const bindRow = (handlers: LongPressRowHandlers) => {
    const onTouchstart = (event: TouchEvent) => {
      const point = event.touches[0]
      if (!point) return
      startX = point.clientX
      startY = point.clientY
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        suppressNextClick = true
        handlers.onLongPress()
      }, thresholdMs)
    }

    const onTouchmove = (event: TouchEvent) => {
      if (timer === null) return
      const point = event.touches[0]
      if (!point) return
      if (
        Math.abs(point.clientX - startX) > moveTolerance
        || Math.abs(point.clientY - startY) > moveTolerance
      ) {
        clearTimer()
      }
    }

    const onTouchend = () => clearTimer()
    const onTouchcancel = () => clearTimer()

    const onClick = () => {
      if (suppressNextClick) {
        suppressNextClick = false
        return
      }
      handlers.onTap()
    }

    return { onTouchstart, onTouchmove, onTouchend, onTouchcancel, onClick }
  }

  onBeforeUnmount(clearTimer)

  return { bindRow }
}
