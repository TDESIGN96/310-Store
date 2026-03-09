<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

// Redirect /dashboard to main cards so the first nav item is active when opening the dashboard
await navigateTo('/mainCards', { replace: true })
</script>

<template>
  <div />
</template>