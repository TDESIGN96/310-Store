<script setup lang="ts">
import { computed } from 'vue'
import { Filter } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { InvoiceWarehouseOption } from '@/composables/useInvoiceWarehouses'

const props = defineProps<{
  modelValue: number[]
  warehouses: InvoiceWarehouseOption[]
  placeholder?: string
  allLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const { locale } = useI18n()

const warehouseLabel = (warehouse: InvoiceWarehouseOption) =>
  locale.value === 'ar'
    ? (warehouse.name_ar || warehouse.name_en || `#${warehouse.id}`)
    : (warehouse.name_en || warehouse.name_ar || `#${warehouse.id}`)

const selectedLabel = computed(() => {
  if (!props.modelValue.length) {
    return props.allLabel ?? props.placeholder ?? '—'
  }
  if (props.modelValue.length === 1) {
    const warehouse = props.warehouses.find(w => w.id === props.modelValue[0])
    return warehouse ? warehouseLabel(warehouse) : `#${props.modelValue[0]}`
  }
  return `${props.modelValue.length}`
})

const isSelected = (id: number) => props.modelValue.includes(id)

const toggleWarehouse = (id: number) => {
  const next = isSelected(id)
    ? props.modelValue.filter(value => value !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="h-9 w-full gap-2 sm:w-auto"
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
        v-for="warehouse in warehouses"
        :key="warehouse.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
        @click="toggleWarehouse(warehouse.id)"
      >
        <Checkbox
          :model-value="isSelected(warehouse.id)"
          class="pointer-events-none"
        />
        <span class="text-sm">{{ warehouseLabel(warehouse) }}</span>
      </div>
      <p
        v-if="!warehouses.length"
        class="px-2 py-3 text-sm text-muted-foreground"
      >
        —
      </p>
    </PopoverContent>
  </Popover>
</template>
