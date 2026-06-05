<script setup lang="ts">
import AppSidebar from '~/components/app/Sidebar/index.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
</script>

<template>
  <SidebarProvider>
    <AppSidebar variant="inset" />
    <SidebarInset class="min-w-0">
      <AppHeader />

      <main class="p-4 min-w-0">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>

</template>
