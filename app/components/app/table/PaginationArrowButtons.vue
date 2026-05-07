<script setup lang="ts">
import { computed } from "vue"
import { ChevronLeft, ChevronRight } from "lucide-vue-next"
import { Button } from "@/components/ui/button"

const props = withDefaults(defineProps<{
  currentPage: number
  lastPage: number
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  prev: []
  next: []
}>()

const { locale } = useI18n()

const isRtl = computed(() => locale.value === "ar")
const prevIcon = computed(() => (isRtl.value ? ChevronRight : ChevronLeft))
const nextIcon = computed(() => (isRtl.value ? ChevronLeft : ChevronRight))
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      variant="outline"
      size="icon"
      class="size-8"
      :disabled="currentPage <= 1 || loading"
      @click="emit('prev')"
    >
      <component :is="prevIcon" class="size-4" />
    </Button>
    <slot />
    <Button
      variant="outline"
      size="icon"
      class="size-8"
      :disabled="currentPage >= lastPage || loading"
      @click="emit('next')"
    >
      <component :is="nextIcon" class="size-4" />
    </Button>
  </div>
</template>
