import type { NotificationType } from '~/types/notifications'

const STORAGE_KEY = 'notification_sound_enabled'

const SOUND_BY_TYPE: Record<NotificationType, string> = {
  low_stock: '/sounds/notifications/low-stock.mp3',
  approval: '/sounds/notifications/approval.mp3',
  shipment: '/sounds/notifications/shipment.mp3',
  warning: '/sounds/notifications/warning.mp3',
  info: '/sounds/notifications/info.mp3',
}

const DEFAULT_SOUND = '/sounds/notifications/default.mp3'

const VOLUME = 0.5

// Browsers block autoplay until the user interacts with the page; unlock() primes audio on first gesture.
let unlockRegistered = false
let unlocked = false

const audioCache = new Map<string, HTMLAudioElement>()

function isClient() {
  return import.meta.client
}

function readEnabled(): boolean {
  if (!isClient()) return true
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return true
  return stored === 'true'
}

const isEnabled = ref(readEnabled())

function setEnabled(value: boolean) {
  isEnabled.value = value
  if (isClient()) {
    localStorage.setItem(STORAGE_KEY, String(value))
  }
}

function getAudio(url: string): HTMLAudioElement {
  let audio = audioCache.get(url)
  if (!audio) {
    audio = new Audio(url)
    audio.preload = 'auto'
    audioCache.set(url, audio)
  }
  return audio
}

function resolveUrl(type: NotificationType): string {
  return SOUND_BY_TYPE[type] ?? DEFAULT_SOUND
}

function play(type: NotificationType) {
  if (!isClient() || !isEnabled.value) return

  const url = resolveUrl(type)
  const audio = getAudio(url)
  audio.volume = VOLUME
  audio.currentTime = 0

  audio.play().catch(() => {
    // Autoplay policy or missing file — fail silently
  })
}

function unlock() {
  if (!isClient() || unlocked) return

  const prime = () => {
    if (unlocked) return
    unlocked = true

    const audio = getAudio(DEFAULT_SOUND)
    const previousVolume = audio.volume
    audio.volume = 0
    audio.currentTime = 0
    audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.volume = previousVolume
      })
      .catch(() => {
        unlocked = false
      })
  }

  if (unlockRegistered) return
  unlockRegistered = true

  const onGesture = () => {
    prime()
    window.removeEventListener('click', onGesture)
    window.removeEventListener('keydown', onGesture)
  }

  window.addEventListener('click', onGesture, { once: true, passive: true })
  window.addEventListener('keydown', onGesture, { once: true, passive: true })
}

export function useNotificationSound() {
  return {
    isEnabled: readonly(isEnabled),
    setEnabled,
    play,
    unlock,
  }
}
