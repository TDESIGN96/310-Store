<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>

<template>
  <div class="flex min-h-[70vh] flex-1 items-center justify-center p-4">
    <div class="relative w-full max-w-3xl overflow-hidden rounded-2xl border bg-transparent p-10 text-center">
      <div class="mx-auto mb-6 h-20 w-20 rounded-full bg-primary/10 p-5 animate-pulse">
        <div class="h-full w-full rounded-full bg-primary/20" />
      </div>
      <h1 class="bg-gradient-to-r from-Green-Dark to-Green-Light bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
        Coming Soon
      </h1>
      <p class="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
        We are building a better dashboard experience. New insights and cards will be available soon.
      </p>
      <div class="mt-8 flex items-center justify-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" />
        <span class="h-2.5 w-2.5 rounded-full bg-[#7B9D1E] animate-bounce [animation-delay:120ms]" />
        <span class="h-2.5 w-2.5 rounded-full bg-Green-Light animate-bounce [animation-delay:240ms]" />
      </div>
    </div>
  </div>
</template>
