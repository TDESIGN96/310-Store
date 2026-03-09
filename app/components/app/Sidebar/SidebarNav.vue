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
</script>

<template>
 <SidebarGroup
    v-for="section in navItems"
    :key="section.group"
  >
  <SidebarGroupLabel>{{ section.group }}</SidebarGroupLabel>
  <SidebarMenu>
    <SidebarMenuItem
        v-for="item in section.items"
        :key="item.path"
      >
      <SidebarMenuButton
          as-child
          :is-active="route.path.startsWith(item.path) || (item.path === '/mainCards' && (route.path === '/dashboard' || route.path === '/'))"
          :tooltip="item.label"
        >
        <NuxtLink :to="item.path">
            <component :is="item.icon" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>