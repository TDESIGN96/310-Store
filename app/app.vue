<script setup lang="ts">
import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <NuxtLayout dir="rtl">
    <NuxtPage />
  </NuxtLayout>
  <Toaster dir="rtl" position="bottom-right" />
</template>