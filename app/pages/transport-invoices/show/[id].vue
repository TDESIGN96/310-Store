<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const id = String(route.params.id)
await navigateTo(`/invoices/show/${id}`, { replace: true })
</script>

<template>
  <div />
</template>
