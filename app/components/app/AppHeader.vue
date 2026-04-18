<script setup lang="ts">
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { getBreadcrumbForPath } from '@/config/navigation'
import { Check, Languages } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { User, Settings, LogOut } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const route = useRoute()
const authStore = useAuthStore()
const { locale, setLocale, t } = useI18n()

const localeOptions = computed(() =>
  [
    { code: 'ar' as const, label: t('locale.ar') },
    { code: 'en' as const, label: t('locale.en') },
  ] as const,
)

const setLanguage = async (code: 'ar' | 'en') => {
  if (locale.value === code) return
  // Nuxt i18n: use setLocale() — assigning locale.value skips loading non-default locale messages.
  await setLocale(code)
  reloadNuxtApp()
}

const roleLabelKey = (role: string | undefined) => {
  if (!role) return ''
  const key = `header.roles.${role}` as const
  const translated = t(key)
  return translated !== key ? translated : role
}

const currentUser = computed(() => authStore.user)

const handleLogout = async () => {
  const name = authStore.user?.name ?? ''
  toast.promise(authStore.logout(), {
    loading: t('header.logout_loading'),
    success: () => {
      navigateTo('/')
      return name ? t('header.logout_success_named', { name }) : t('header.logout_success')
    },
    error: () => {
      navigateTo('/')
      return t('header.logout_error')
    },
  })
}

const breadcrumb = computed(() => getBreadcrumbForPath(route.path))
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center px-4 gap-2 border-b justify-between transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
  >
    <div class="flex items-center gap-2">
      <SidebarTrigger class="-ms-1" />
      <Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <template v-if="breadcrumb">
            <BreadcrumbItem class="hidden md:block">
              <BreadcrumbLink as-child>
                <NuxtLink :to="breadcrumb.groupPath">
                  {{ t(breadcrumb.groupKey) }}
                </NuxtLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator class="hidden md:block rotate-180" />
            <BreadcrumbItem>
              <BreadcrumbPage>{{ t(breadcrumb.item.labelKey) }}</BreadcrumbPage>
            </BreadcrumbItem>
          </template>
          <BreadcrumbItem v-else>
            <BreadcrumbPage>{{ route.path || t('header.breadcrumb_fallback') }}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>

    <div class="flex items-center gap-2">
      <AppNotifications />

      <!-- Language switcher -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-9">
            <Languages class="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem
            v-for="opt in localeOptions"
            :key="opt.code"
            class="gap-2 cursor-pointer"
            @click="setLanguage(opt.code)"
          >
            <Check
              class="size-4 shrink-0"
              :class="locale === opt.code ? 'opacity-100' : 'opacity-0'"
            />
            <span>{{ opt.label }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" class="h-4" />

      <!-- Current User + Role -->
      <div class="flex items-center gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton size="lg">
                  <div
                    class="flex size-7 items-center justify-center rounded-full bg-[#215260] text-[#CFE030] text-xs font-bold shrink-0"
                  >
                    {{ currentUser?.name?.charAt(0) ?? '؟' }}
                  </div>
                  <div class="flex flex-col leading-tight">
                    <span class="text-sm font-medium leading-tight">
                      {{ currentUser?.name ?? '—' }}
                    </span>
                    <Badge variant="secondary" class="text-[10px] px-1.5 py-0 h-4 w-fit">
                      {{ roleLabelKey(currentUser?.role) || currentUser?.role }}
                    </Badge>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" class="w-[--reka-popper-anchor-width]" align="end">
                <DropdownMenuLabel class="text-start">{{ t('header.account') }}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem as-child>
                  <NuxtLink to="/profile" class="flex w-full cursor-pointer items-center gap-2">
                    <User class="ms-2 size-4 shrink-0" />
                    <span>{{ t('header.profile') }}</span>
                  </NuxtLink>
                </DropdownMenuItem>

                <DropdownMenuItem>
                  <Settings class="ms-2 size-4" />
                  <span>{{ t('header.settings') }}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  class="text-red-500 focus:text-red-500 cursor-pointer"
                  @click="handleLogout"
                >
                  <LogOut class="ms-2 size-4" />
                  <span>{{ t('header.logout') }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </div>
  </header>
</template>
