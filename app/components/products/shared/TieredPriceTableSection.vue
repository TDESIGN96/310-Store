<script setup lang="ts">
import { Trash2, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TieredTableRow {
  key: string | number
  minQty: string | number
  maxQty: string | number
  price: string | number
}

const props = withDefaults(defineProps<{
  tableTitle: string
  minQtyLabel: string
  maxQtyLabel: string
  priceLabel: string
  actionsLabel: string
  addRowLabel: string
  clearAllLabel: string
  emptyHint: string
  rows: TieredTableRow[]
  rowError?: string
  sectionError?: string
  pricePlaceholder?: string
  fieldErrorByKey?: Record<string, { minQty?: string; maxQty?: string; price?: string }>
}>(), {
  rowError: '',
  sectionError: '',
  pricePlaceholder: '',
  fieldErrorByKey: () => ({}),
})

const emit = defineEmits<{
  addRow: []
  clearRows: []
  removeRow: [key: string | number]
  updateMinQty: [payload: { key: string | number; value: string }]
  updateMaxQty: [payload: { key: string | number; value: string }]
  updatePrice: [payload: { key: string | number; value: string }]
}>()

const onMinInput = (key: string | number, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('updateMinQty', { key, value })
}

const onMaxInput = (key: string | number, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('updateMaxQty', { key, value })
}

const onPriceInput = (key: string | number, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('updatePrice', { key, value })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-medium">{{ tableTitle }}</h3>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="h-9 gap-2"
        @click="emit('addRow')"
      >
        <Plus class="size-4" />
        {{ addRowLabel }}
      </Button>
    </div>

    <div class="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="rtl:text-right font-medium min-w-[170px]">
              {{ minQtyLabel }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium min-w-[170px]">
              {{ maxQtyLabel }}
            </TableHead>
            <TableHead class="rtl:text-right font-medium min-w-[180px]">
              {{ priceLabel }}
            </TableHead>
            <TableHead class="font-medium min-w-[120px] text-center">
              {{ actionsLabel }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="rows.length === 0">
            <TableCell :colspan="4" class="py-10 text-center text-sm text-muted-foreground">
              {{ emptyHint }}
            </TableCell>
          </TableRow>
          <TableRow
            v-for="row in rows"
            v-else
            :key="row.key"
            class="hover:bg-muted/20 transition-colors"
          >
            <TableCell class="py-2.5 align-top">
              <Input
                :model-value="String(row.minQty ?? '')"
                type="text"
                inputmode="numeric"
                class="h-9 w-full font-mono"
                dir="ltr"
                placeholder="0"
                @input="onMinInput(row.key, $event)"
              />
              <p v-if="fieldErrorByKey[String(row.key)]?.minQty" class="mt-1 text-xs text-red-600">
                {{ fieldErrorByKey[String(row.key)]?.minQty }}
              </p>
            </TableCell>
            <TableCell class="py-2.5 align-top">
            
              <Input
                :model-value="String(row.maxQty ?? '')"
                type="text"
                inputmode="numeric"
                class="h-9 w-full font-mono"
                dir="ltr"
                placeholder="0"
                @input="onMaxInput(row.key, $event)"
              />
              <p v-if="fieldErrorByKey[String(row.key)]?.maxQty" class="mt-1 text-xs text-red-600">
                {{ fieldErrorByKey[String(row.key)]?.maxQty }}
              </p>
            </TableCell>
            <TableCell class="py-2.5 align-top">
              <Input
                :model-value="String(row.price ?? '')"
                type="text"
                inputmode="decimal"
                class="h-9 w-full font-mono"
                dir="ltr"
                :placeholder="pricePlaceholder"
                @input="onPriceInput(row.key, $event)"
              />
              <p v-if="fieldErrorByKey[String(row.key)]?.price" class="mt-1 text-xs text-red-600">
                {{ fieldErrorByKey[String(row.key)]?.price }}
              </p>
            </TableCell>
            <TableCell class="py-2.5 text-center align-top">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 gap-1 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                @click="emit('removeRow', row.key)"
              >
                <Trash2 class="size-3.5" />
                {{ $t('common.delete') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <p v-if="rowError" class="text-sm text-red-600">{{ rowError }}</p>
    <p v-if="sectionError" class="text-sm text-red-600">{{ sectionError }}</p>

    <Button
      v-if="rows.length > 0"
      type="button"
      variant="ghost"
      size="sm"
      class="h-9 text-muted-foreground hover:text-red-600"
      @click="emit('clearRows')"
    >
      {{ clearAllLabel }}
    </Button>
  </div>
</template>
