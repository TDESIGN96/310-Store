<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import flatpickr from 'flatpickr'
import type { Instance } from 'flatpickr/dist/types/instance'
import { Calendar } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  class?: string
  maxDate?: string | Date | 'today'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const inputEl = ref<HTMLInputElement | null>(null)
let fp: Instance | null = null

const resolveMaxDate = (value: string | Date | 'today' | undefined): string | Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (value === 'today') return 'today'
  return value
}

onMounted(() => {
  if (!inputEl.value) return
  fp = flatpickr(inputEl.value, {
    dateFormat: 'd-m-Y',
    allowInput: true,
    disableMobile: true,
    maxDate: resolveMaxDate(props.maxDate),
    onChange: (_dates, dateStr) => {
      emit('update:modelValue', dateStr)
    },
    onClose: (_dates, dateStr) => {
      emit('update:modelValue', dateStr)
    },
  })
  if (props.modelValue) fp.setDate(props.modelValue, false)
})

watch(() => props.modelValue, (val) => {
  if (!fp) return
  if (!val) fp.clear()
  else fp.setDate(val, false)
})

watch(() => props.maxDate, (val) => {
  if (!fp) return
  fp.set('maxDate', resolveMaxDate(val))
})

onBeforeUnmount(() => {
  fp?.destroy()
})
</script>

<template>
  <div class="relative">
    <input
      ref="inputEl"
      :placeholder="placeholder ?? 'DD-MM-YYYY'"
      :class="cn(
        'placeholder:text-muted-foreground border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pe-9 text-base shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        props.class,
      )"
    />
    <Calendar class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>
</template>
