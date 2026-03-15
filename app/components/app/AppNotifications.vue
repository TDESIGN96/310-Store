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

// ── Types ──
interface Notification {
  id: string
  type: 'low_stock' | 'approval' | 'shipment' | 'warning' | 'info'
  title: string
  message: string
  time: string
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
  data?: {
    title?: string
    message?: string
    type?: string
    link?: string
  }
}

interface DemoPost {
  id: number
  title: string
  body: string
}

const notifications = ref<Notification[]>([])
const activeChannelName = ref<string | null>(null)
const isLoadingDemo = ref(false)
const demoLoadError = ref<string | null>(null)

const toRelativeArabicTime = (value?: string) => {
  if (!value) return 'الآن'

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'الآن'

  const minutes = Math.floor((Date.now() - timestamp) / (1000 * 60))
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `منذ ${minutes} دقيقة`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`

  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
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

  return {
    id: String(payload.id ?? crypto.randomUUID()),
    type: resolvedType,
    title: data.title || payload.title || 'إشعار جديد',
    message: data.message || payload.message || 'تم استلام إشعار جديد',
    time: toRelativeArabicTime(payload.created_at),
    read: Boolean(payload.read_at),
    link: data.link,
  }
}

const showToastForNotification = (notification: Notification) => {
  if (!import.meta.client) return

  toast(notification.title, {
    description: notification.message,
    action: notification.link
      ? {
          label: 'عرض',
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

const demoTypes: Notification['type'][] = ['info', 'approval', 'shipment', 'warning', 'low_stock']

const loadOnlineDemoNotifications = async () => {
  if (isLoadingDemo.value) return

  isLoadingDemo.value = true
  demoLoadError.value = null

  try {
    const posts = await $fetch<DemoPost[]>('https://jsonplaceholder.typicode.com/posts', {
      query: { _limit: 5 },
    })

    notifications.value = posts.map((post, index) => ({
      id: `demo-${post.id}`,
      type: demoTypes[index % demoTypes.length] || 'info',
      title: post.title.slice(0, 42) || 'Demo notification',
      message: post.body.slice(0, 90) || 'Demo message',
      time: `منذ ${index + 1} دقيقة`,
      read: false,
      link: '/notifications',
    }))
  } catch {
    demoLoadError.value = 'تعذر تحميل البيانات التجريبية حالياً'
  } finally {
    isLoadingDemo.value = false
  }
}

const triggerDemoLiveNotification = () => {
  addNotification(
    {
      id: `live-demo-${Date.now()}`,
      type: 'info',
      created_at: new Date().toISOString(),
      data: {
        title: 'اختبار إشعار مباشر',
        message: 'هذا إشعار تجريبي لاختبار الـ toaster والتحديث الفوري',
        type: 'info',
        link: '/notifications',
      },
    },
    { showToast: true },
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

    if (!userId) {
      unsubscribeFromUserChannel()
      notifications.value = []
      return
    }

    subscribeToUserChannel(userId)
  },
  { immediate: true },
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
          <span class="font-semibold text-sm">الإشعارات</span>
          <Badge
            v-if="unreadCount > 0"
            variant="secondary"
            class="text-xs px-1.5 py-0"
          >
            {{ unreadCount }} جديد
          </Badge>
        </div>
        <Button
          v-if="unreadCount > 0"
          variant="ghost"
          size="sm"
          class="text-xs text-muted-foreground h-7"
          @click="markAllRead"
        >
          تحديد الكل كمقروء
        </Button>
        <Button
          v-else
          variant="ghost"
          size="sm"
          class="text-xs text-muted-foreground h-7"
          :disabled="isLoadingDemo"
          @click="loadOnlineDemoNotifications"
        >
          {{ isLoadingDemo ? 'جارٍ التحميل...' : 'تحميل بيانات تجريبية' }}
        </Button>
      </div>

      <div class="px-4 pb-2">
        <Button
          variant="outline"
          size="sm"
          class="w-full text-xs"
          @click="triggerDemoLiveNotification"
        >
          اختبار إشعار مباشر + Toast
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
          <span class="text-sm">لا توجد إشعارات</span>
          <Button
            variant="outline"
            size="sm"
            class="mt-2"
            :disabled="isLoadingDemo"
            @click="loadOnlineDemoNotifications"
          >
            {{ isLoadingDemo ? 'جارٍ التحميل...' : 'تحميل بيانات تجريبية أونلاين' }}
          </Button>
          <span v-if="demoLoadError" class="text-xs text-red-500">
            {{ demoLoadError }}
          </span>
        </div>

        <!-- List -->
        <div v-else>
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer relative group border-b border-border/50 last:border-0"
            :class="!notification.read ? 'bg-muted/40' : 'hover:bg-muted/30'"
            @click="markRead(notification.id)"
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
              <span class="text-[11px] text-muted-foreground/50 mt-1 block">
                {{ notification.time }}
              </span>
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

      <Separator />

      <!-- Footer -->
      <div class="p-2">
        <Button
          variant="ghost"
          size="sm"
          class="w-full text-xs text-muted-foreground"
          as-child
        >
          <NuxtLink to="/notifications">
            عرض جميع الإشعارات
          </NuxtLink>
        </Button>
      </div>

    </PopoverContent>
  </Popover>
</template>