<script setup lang="ts">
import { computed } from 'vue'
import { Filter } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface ReportMultiSelectItem {
  id: number
  label: string
}

const props = defineProps<{
  modelValue: number[]
  items: ReportMultiSelectItem[]
  placeholder?: string
  allLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const selectedLabel = computed(() => {
  if (!props.modelValue.length) {
    return props.allLabel ?? props.placeholder ?? '—'
  }
  if (props.modelValue.length === 1) {
    const item = props.items.find(i => i.id === props.modelValue[0])
    return item?.label ?? `#${props.modelValue[0]}`
  }
  return `${props.modelValue.length}`
})

const isSelected = (id: number) => props.modelValue.includes(id)

const toggleItem = (id: number) => {
  const next = isSelected(id)
    ? props.modelValue.filter(value => value !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}
</script>

<template>
  <Popover class="w-full">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="h-9 w-full justify-start gap-2"
      >
        <Filter class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="truncate max-w-[180px] text-sm">{{ selectedLabel }}</span>
        <Badge
          v-if="modelValue.length > 1"
          class="ms-1 h-4 min-w-4 rounded-full px-1 text-[10px] flex items-center justify-center"
        >
          {{ modelValue.length }}
        </Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-64 max-h-72 overflow-y-auto p-1">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
        @click="toggleItem(item.id)"
      >
        <Checkbox
          :model-value="isSelected(item.id)"
          class="pointer-events-none"
        />
        <span class="text-sm">{{ item.label }}</span>
      </div>
      <p
        v-if="!items.length"
        class="px-2 py-3 text-sm text-muted-foreground"
      >
        —
      </p>
    </PopoverContent>
  </Popover>
</template>
