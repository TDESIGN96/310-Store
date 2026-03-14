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
import { Languages } from 'lucide-vue-next'
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

const roleLabel: Record<string, string> = {
  admin: 'مدير النظام',
  manager: 'المدير',
  accountant: 'المحاسب',
  sales: 'موظف المبيعات',
  agent: 'المندوب',
  warehouse: 'أمين المخزن',
  driver: 'السائق',
}

const currentUser = computed(() => authStore.user)

const handleLogout = async () => {
  const name = authStore.user?.name ?? ''
  toast.promise(authStore.logout(), {
    loading: 'جارٍ تسجيل الخروج...',
    success: () => {
      navigateTo('/')
      return name ? `إلى اللقاء، ${name}` : 'تم تسجيل الخروج بنجاح'
    },
    error: () => {
      navigateTo('/')
      return 'تم تسجيل الخروج'
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
                  {{ breadcrumb.group }}
                </NuxtLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator class="hidden md:block rotate-180" />
            <BreadcrumbItem>
              <BreadcrumbPage>{{ breadcrumb.item.label }}</BreadcrumbPage>
            </BreadcrumbItem>
          </template>
          <BreadcrumbItem v-else>
            <BreadcrumbPage>{{ route.path || 'الرئيسية' }}</BreadcrumbPage>
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
          <DropdownMenuItem >
            <span>العربية</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>English</span>
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
                      {{ roleLabel[currentUser?.role ?? ''] ?? currentUser?.role }}
                    </Badge>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" class="w-[--reka-popper-anchor-width]" align="end">
                <DropdownMenuLabel class="text-start">حسابي</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem>
                  <User class="ms-2 size-4" />
                  <span>الملف الشخصي</span>
                </DropdownMenuItem>

                <DropdownMenuItem>
                  <Settings class="ms-2 size-4" />
                  <span>الإعدادات</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  class="text-red-500 focus:text-red-500 cursor-pointer"
                  @click="handleLogout"
                >
                  <LogOut class="ms-2 size-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </div>
  </header>
</template>
