<script setup lang="ts">
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { navItems } from '@/config/navigation'

const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()

const visibleSections = computed(() => {
  return navItems
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.requiredPermission) return true
        return authStore.hasPermission(item.requiredPermission)
      }),
    }))
    .filter((section) => section.items.length > 0)
})
</script>

<template>
  <SidebarGroup
    v-for="section in visibleSections"
    :key="section.groupKey"
  >
    <SidebarGroupLabel>{{ t(section.groupKey) }}</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem
        v-for="item in section.items"
        :key="item.path"
      >
        <SidebarMenuButton
          as-child
          :is-active="route.path.startsWith(item.path) || (item.path === '/mainCards' && (route.path === '/dashboard' || route.path === '/'))"
          :tooltip="t(item.labelKey)"
        >
          <NuxtLink :to="item.path">
            <component :is="item.icon" />
            <span>{{ t(item.labelKey) }}</span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
