<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { navItems, type NavItem } from '@/config/navigation'

const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()
const { navVisibility } = usePermissions()

function isSimpleVisible(item: NavItem): boolean {
  if (item.requiredPermission) return authStore.hasPermission(item.requiredPermission)
  return true
}

function isModuleVisible(item: NavItem): boolean {
  if (!item.module) return true
  return navVisibility(item.module) !== 'hidden'
}

const visibleSections = computed(() => {
  return navItems
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.module) return isModuleVisible(item)
        return isSimpleVisible(item)
      }),
    }))
    .filter((section) => section.items.length > 0)
})

function isRouteUnderModule(item: NavItem, mode: 'full' | 'create-only' = 'full'): boolean {
  const p = route.path.replace(/\/$/, '')
  const list = item.path.replace(/\/$/, '')
  const createLinks = getCreateLinks(item)
  if (!createLinks.length) return false
  const underCreate = createLinks.some((link) => {
    const create = link.path.replace(/\/$/, '')
    return p === create || p.startsWith(`${create}/`)
  })
  if (mode === 'create-only') return underCreate
  return p === list || p.startsWith(`${list}/`) || underCreate
}

function isListActive(item: NavItem): boolean {
  const p = route.path.replace(/\/$/, '')
  const list = item.path.replace(/\/$/, '')
  return p === list || (p.startsWith(`${list}/`) && !p.includes('/create'))
}

function isCreateActive(path: string): boolean {
  const p = route.path.replace(/\/$/, '')
  const create = path.replace(/\/$/, '')
  return p === create || p.startsWith(`${create}/`)
}

function getCreateLinks(item: NavItem): Array<{ path: string; labelKey: string }> {
  const links: Array<{ path: string; labelKey: string }> = []
  if (item.createPath) {
    links.push({ path: item.createPath, labelKey: 'nav.submenu.create' })
  }
  if (item.secondaryCreatePath) {
    links.push({
      path: item.secondaryCreatePath,
      labelKey: item.secondaryCreateLabelKey ?? 'nav.submenu.create',
    })
  }
  return links
}

function hasCreateLinks(item: NavItem): boolean {
  return getCreateLinks(item).length > 0
}
</script>

<template>
  <SidebarGroup
    v-for="section in visibleSections"
    :key="section.groupKey"
  >
    <SidebarGroupLabel>{{ t(section.groupKey) }}</SidebarGroupLabel>
    <SidebarMenu>
      <template v-for="item in section.items" :key="item.path">
        <!-- Module: plain link (list only) -->
        <SidebarMenuItem v-if="item.module && navVisibility(item.module) === 'link'">
          <SidebarMenuButton
            as-child
            :is-active="isRouteUnderModule(item)"
            :tooltip="t(item.labelKey)"
          >
            <NuxtLink :to="item.path">
              <component :is="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Module: dropdown (create only — has store but no list permission) -->
        <SidebarMenuItem
          v-else-if="
            item.module
              && hasCreateLinks(item)
              && navVisibility(item.module) === 'dropdown-create-only'
          "
          class="group/collapsible"
        >
          <details class="group/details" :open="isRouteUnderModule(item, 'create-only')">
            <summary
              class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&::-webkit-details-marker]:hidden"
            >
              <component :is="item.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ t(item.labelKey) }}</span>
              <ChevronDown class="ms-auto size-4 shrink-0 transition-transform group-open/details:rotate-180" />
            </summary>
            <SidebarMenuSub class="mt-1 border-sidebar-border">
              <SidebarMenuSubItem
                v-for="link in getCreateLinks(item)"
                :key="link.path"
              >
                <SidebarMenuSubButton
                  as-child
                  size="sm"
                  :is-active="isCreateActive(link.path)"
                >
                  <NuxtLink :to="link.path">
                    {{ t(link.labelKey) }}
                  </NuxtLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </details>
        </SidebarMenuItem>

        <!-- Module: dropdown (list + create) -->
        <SidebarMenuItem
          v-else-if="item.module && hasCreateLinks(item) && navVisibility(item.module) === 'dropdown'"
          class="group/collapsible"
        >
          <details class="group/details" :open="isRouteUnderModule(item)">
            <summary
              class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&::-webkit-details-marker]:hidden"
            >
              <component :is="item.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ t(item.labelKey) }}</span>
              <ChevronDown class="ms-auto size-4 shrink-0 transition-transform group-open/details:rotate-180" />
            </summary>
            <SidebarMenuSub class="mt-1 border-sidebar-border">
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  as-child
                  size="sm"
                  :is-active="isListActive(item)"
                >
                  <NuxtLink :to="item.path">
                    {{ t('nav.submenu.list') }}
                  </NuxtLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem
                v-for="link in getCreateLinks(item)"
                :key="link.path"
              >
                <SidebarMenuSubButton
                  as-child
                  size="sm"
                  :is-active="isCreateActive(link.path)"
                >
                  <NuxtLink :to="link.path">
                    {{ t(link.labelKey) }}
                  </NuxtLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </details>
        </SidebarMenuItem>

        <!-- Simple item (e.g. dashboard, products) -->
        <SidebarMenuItem v-else>
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
      </template>
    </SidebarMenu>
  </SidebarGroup>
</template>
