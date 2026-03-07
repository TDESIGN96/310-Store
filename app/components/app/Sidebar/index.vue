<script setup lang="ts">
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
 
} from '@/components/ui/sidebar'
import SidebarNav from './SidebarNav.vue';
import Logo from '../Logo.vue';

</script>

<template>
  <Sidebar side="right" collapsible="icon">
    <!-- Header -->
    <SidebarHeader>
      <div class="flex items-center gap-2 px-2 py-1">
        <div class=" flex items-center justify-center">
          <Logo />
        </div>

      </div>
    </SidebarHeader>


    <!-- Nav Items -->
    <SidebarContent>
      <SidebarNav />
    </SidebarContent>

    <!-- Footer -->
    <SidebarFooter>
      <span class="text-xs text-muted-foreground font-normal text-right">© 2026 KAMU</span>
    </SidebarFooter>

  </Sidebar>
</template>
