<script setup lang="ts">
import AppSidebar from '~/components/app/Sidebar/index.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
</script>

<template>
  <SidebarProvider>
    <AppSidebar variant="inset" />
    <SidebarInset>
      <AppHeader />
      
      <main class="p-4">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
