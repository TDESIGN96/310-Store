<script setup lang="ts">
defineProps<{
  label?: string
  required?: boolean
  error?: string
  reserveErrorSpace?: boolean
  hideLabel?: boolean
}>()
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-1.5">
    <label
      class="block min-h-4 text-xs font-medium leading-4 text-muted-foreground"
      :class="hideLabel ? 'invisible' : ''"
    >
      <slot name="label">
        {{ label }}<span v-if="required" class="text-red-500"> *</span>
      </slot>
    </label>
    <div class="flex h-9 w-full min-w-0 items-center [&>*]:w-full">
      <slot />
    </div>
    <p
      v-if="reserveErrorSpace !== false"
      class="min-h-4 text-xs leading-4"
      :class="error ? 'text-red-600' : 'invisible'"
    >
      {{ error || '\u00a0' }}
    </p>
  </div>
</template>
