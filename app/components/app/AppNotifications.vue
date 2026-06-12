<script setup lang="ts">
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Bell,
  Package,
  CheckSquare,
  AlertTriangle,
  Truck,
  X,
  Info,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()
const nuxtApp = useNuxtApp()
const { t, locale } = useI18n()
const STORAGE_PREFIX = 'app_notifications'
const MAX_NOTIFICATIONS = 50

// ── Types ──
interface Notification {
  id: string
  type: 'low_stock' | 'approval' | 'shipment' | 'warning' | 'info'
  title: string
  message: string
  createdAt?: string
  read: boolean
  link?: string
}

interface EchoNotificationPayload {
  id?: string | number
  type?: string
  read_at?: string | null
  created_at?: string
  title?: string
  message?: string
  message_ar?: string
  message_en?: string
  link?: string
  stocktaking_order_id?: string | number
  data?: {
    title?: string
    message?: string
    message_ar?: string
    message_en?: string
    type?: string
    link?: string
    stocktaking_order_id?: string | number
  }
}

const notifications = ref<Notification[]>([])
const activeChannelName = ref<string | null>(null)

const toRelativeTime = (value?: string) => {
  if (!value) return t('notifications.now')

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return t('notifications.now')

  const minutes = Math.floor((Date.now() - timestamp) / (1000 * 60))
  if (minutes < 1) return t('notifications.now')
  if (minutes < 60) return t('notifications.minutes_ago', { n: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('notifications.hours_ago', { n: hours })

  const days = Math.floor(hours / 24)
  return t('notifications.days_ago', { n: days })
}

const resolveNotificationType = (payload: EchoNotificationPayload): Notification['type'] => {
  const raw = (payload.data?.type || payload.type || '').toLowerCase()
  if (raw.includes('stock')) return 'low_stock'
  if (raw.includes('approve')) return 'approval'
  if (raw.includes('ship')) return 'shipment'
  if (raw.includes('warn') || raw.includes('reject')) return 'warning'
  return 'info'
}

const normalizeNotification = (payload: EchoNotificationPayload): Notification => {
  const data = payload.data || {}
  const resolvedType = resolveNotificationType(payload)

  type MessageSource = { message_ar?: string; message_en?: string; message?: string }
  const pickMessage = (src: MessageSource): string => {
    if (locale.value === 'ar') {
      return src.message_ar || src.message_en || src.message || ''
    }
    return src.message_en || src.message_ar || src.message || ''
  }

  const stocktakingId = data.stocktaking_order_id ?? payload.stocktaking_order_id
  const resolvedLink =
    data.link || payload.link ||
    (stocktakingId ? `/stocktaking-orders/show/${stocktakingId}` : undefined)

  return {
    id: String(payload.id ?? crypto.randomUUID()),
    type: resolvedType,
    title: data.title || payload.title || t('notifications.default_title'),
    message: pickMessage(data) || pickMessage(payload) || t('notifications.default_message'),
    createdAt: payload.created_at,
    read: Boolean(payload.read_at),
    link: resolvedLink,
  }
}

const showToastForNotification = (notification: Notification) => {
  if (!import.meta.client) return

  toast(notification.title, {
    position: 'top-left',
    description: notification.message,
    action: notification.link
      ? {
          label: t('notifications.view'),
          onClick: () => navigateTo(notification.link as string),
        }
      : undefined,
  })
}

const addNotification = (
  payload: EchoNotificationPayload,
  options: { showToast?: boolean } = {},
) => {
  const normalized = normalizeNotification(payload)
  const existingIndex = notifications.value.findIndex(n => n.id === normalized.id)

  if (existingIndex !== -1) {
    notifications.value[existingIndex] = normalized
    return
  }

  notifications.value.unshift(normalized)

  if (options.showToast && !normalized.read) {
    showToastForNotification(normalized)
  }
}

const setEchoAuthorizationHeader = () => {
  const echo = nuxtApp.$echo as any
  if (!echo?.connector?.options) return

  const token = authStore.token
  echo.connector.options.auth = {
    ...(echo.connector.options.auth || {}),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
}

const sanitizePersistedNotification = (value: unknown): Notification | null => {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<Notification>
  if (!candidate.id || !candidate.title || !candidate.message || !candidate.type) return null

  return {
    id: String(candidate.id),
    type: candidate.type,
    title: String(candidate.title),
    message: String(candidate.message),
    createdAt: candidate.createdAt,
    read: Boolean(candidate.read),
    link: candidate.link,
  }
}

const getStorageKey = (userId: number) => `${STORAGE_PREFIX}:${userId}`

const hydrateNotifications = (userId: number) => {
  if (!import.meta.client) return

  const raw = localStorage.getItem(getStorageKey(userId))
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return

    notifications.value = parsed
      .map(sanitizePersistedNotification)
      .filter((item): item is Notification => item !== null)
      .slice(0, MAX_NOTIFICATIONS)
  } catch {
    notifications.value = []
  }
}

const persistNotifications = (userId: number) => {
  if (!import.meta.client) return
  localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(notifications.value.slice(0, MAX_NOTIFICATIONS)),
  )
}

const unsubscribeFromUserChannel = () => {
  if (!activeChannelName.value) return

  const echo = nuxtApp.$echo as any
  if (!echo) {
    activeChannelName.value = null
    return
  }

  try {
    echo.leave(activeChannelName.value)
  } catch {}

  activeChannelName.value = null
}

const subscribeToUserChannel = (userId: number) => {
  const echo = nuxtApp.$echo as any
  if (!echo) return

  setEchoAuthorizationHeader()

  const channelName = `App.Models.User.${userId}`
  if (activeChannelName.value === channelName) return

  unsubscribeFromUserChannel()

  const channel = echo.private(channelName) as any
  if (typeof channel.notification === 'function') {
    channel.notification((payload: EchoNotificationPayload) => addNotification(payload, { showToast: true }))
  } else {
    channel.listen(
      '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated',
      (payload: EchoNotificationPayload) => addNotification(payload, { showToast: true }),
    )
  }

  activeChannelName.value = channelName
}

// ── Computed ──
const unreadCount = computed(() =>
  notifications.value.filter(n => !n.read).length
)

watch(
  () => authStore.user?.id,
  (userId) => {
    if (!import.meta.client) return

    notifications.value = []

    if (!userId) {
      unsubscribeFromUserChannel()
      return
    }

    hydrateNotifications(userId)
    subscribeToUserChannel(userId)
  },
  { immediate: true },
)

watch(
  notifications,
  () => {
    if (!import.meta.client) return
    const userId = authStore.user?.id
    if (!userId) return
    persistNotifications(userId)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  unsubscribeFromUserChannel()
})

// ── Icon + Color per type ──
const typeConfig = {
  low_stock: {
    icon: Package,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  approval: {
    icon: CheckSquare,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  shipment: {
    icon: Truck,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
}

// ── Actions ──
const markRead = (id: string) => {
  const n = notifications.value.find(n => n.id === id)
  if (n) n.read = true
}

const markAllRead = () => {
  notifications.value.forEach(n => n.read = true)
}

const remove = (id: string) => {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

const onNotificationClick = (notification: Notification) => {
  markRead(notification.id)
  if (notification.link) {
    navigateTo(notification.link)
  }
}
</script>

<template>
  <Popover>

    <!-- ── Bell Trigger ── -->
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative">
        <Bell class="size-4" />
        <span
          v-if="unreadCount > 0"
          class="absolute -top-1 -left-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </Button>
    </PopoverTrigger>

    <!-- ── Popover Panel ── -->
    <PopoverContent class="w-80 p-0" align="end" :side-offset="8">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm">{{ t('notifications.title') }}</span>
          <Badge
            v-if="unreadCount > 0"
            variant="secondary"
            class="text-xs px-1.5 py-0"
          >
            {{ t('notifications.new_count', { count: unreadCount }) }}
          </Badge>
        </div>
        <Button
          v-if="unreadCount > 0"
          variant="ghost"
          size="sm"
          class="text-xs text-muted-foreground h-7"
          @click="markAllRead"
        >
          {{ t('notifications.mark_all_read') }}
        </Button>
      </div>

      <Separator />

      <!-- Notifications List -->
      <ScrollArea class="h-[320px]">

        <!-- Empty State -->
        <div
          v-if="notifications.length === 0"
          class="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground"
        >
          <Bell class="size-8 opacity-20" />
          <span class="text-sm">{{ t('notifications.empty') }}</span>
        </div>

        <!-- List -->
        <div v-else>
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer relative group border-b border-border/50 last:border-0"
            :class="!notification.read ? 'bg-muted/40' : 'hover:bg-muted/30'"
            @click="onNotificationClick(notification)"
          >
            <!-- Type Icon -->
            <div
              :class="[
                'flex size-8 shrink-0 items-center justify-center rounded-full mt-0.5',
                typeConfig[notification.type].bg
              ]"
            >
              <component
                :is="typeConfig[notification.type].icon"
                :class="['size-4', typeConfig[notification.type].color]"
              />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium leading-tight">
                  {{ notification.title }}
                </span>
                <!-- Unread dot -->
                <span
                  v-if="!notification.read"
                  class="size-1.5 rounded-full bg-blue-500 shrink-0"
                />
              </div>
              <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                {{ notification.message }}
              </p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[11px] text-muted-foreground/50">
                  {{ toRelativeTime(notification.createdAt) }}
                </span>
                <span
                  v-if="notification.link"
                  class="text-[11px] font-medium text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {{ t('notifications.view') }}
                </span>
              </div>
            </div>

            <!-- Remove Button -->
            <Button
              variant="ghost"
              size="icon"
              class="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
              @click.stop="remove(notification.id)"
            >
              <X class="size-3" />
            </Button>

          </div>
        </div>
      </ScrollArea>

    </PopoverContent>
  </Popover>
</template>