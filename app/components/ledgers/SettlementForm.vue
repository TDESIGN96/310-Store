<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePickerInput } from '@/components/ui/date-picker'
import { isoDateFromPicker, pickerDateFromIso, todayPickerDate } from '@/utils/ledgerDates'
import { toast } from 'vue-sonner'

export interface SettlementFormValue {
  amount: string
  direction: 'received' | 'paid'
  note: string
  entry_date: string
}

const props = withDefaults(defineProps<{
  loading?: boolean
  initial?: SettlementFormValue | null
  submitLabel?: string
}>(), {
  loading: false,
  initial: null,
})

const emit = defineEmits<{
  submit: [payload: { amount: number; direction: 'received' | 'paid'; note: string; entry_date: string }]
  cancel: []
}>()

const { t } = useI18n()

const amount = ref(props.initial?.amount ?? '')
const direction = ref<'received' | 'paid'>(props.initial?.direction ?? 'received')
const note = ref(props.initial?.note ?? '')
const entryDate = ref(props.initial?.entry_date ? pickerDateFromIso(props.initial.entry_date) : todayPickerDate())

watch(() => props.initial, (value) => {
  amount.value = value?.amount ?? ''
  direction.value = value?.direction ?? 'received'
  note.value = value?.note ?? ''
  entryDate.value = value?.entry_date ? pickerDateFromIso(value.entry_date) : todayPickerDate()
})

const isEditing = computed(() => Boolean(props.initial))

const submit = () => {
  const parsedAmount = Number(amount.value)
  const isoDate = isoDateFromPicker(entryDate.value)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    toast.error(t('ledgers_page.amount_invalid'))
    return
  }
  if (!isoDate) {
    toast.error(t('ledgers_page.date_invalid'))
    return
  }
  if (!note.value.trim()) {
    toast.error(t('ledgers_page.note_required'))
    return
  }

  emit('submit', {
    amount: parsedAmount,
    direction: direction.value,
    note: note.value.trim(),
    entry_date: isoDate,
  })
}
</script>

<template>
  <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submit">
    <div class="grid gap-1.5">
      <label class="text-sm font-medium">{{ t('ledgers_page.amount') }}</label>
      <Input v-model="amount" type="number" min="0.01" step="0.01" required />
    </div>
    <div class="grid gap-1.5">
      <label class="text-sm font-medium">{{ t('ledgers_page.direction') }}</label>
      <Select v-model="direction">
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="t('ledgers_page.direction')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="received">{{ t('ledgers_page.direction_received') }}</SelectItem>
          <SelectItem value="paid">{{ t('ledgers_page.direction_paid') }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="grid gap-1.5">
      <label class="text-sm font-medium">{{ t('ledgers_page.entry_date') }}</label>
      <DatePickerInput v-model="entryDate" class="w-full" />
    </div>
    <div class="grid gap-1.5 md:col-span-2">
      <label class="text-sm font-medium">{{ t('ledgers_page.note') }}</label>
      <textarea
        v-model="note"
        rows="3"
        required
        class="border-input placeholder:text-muted-foreground dark:bg-input/30 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      />
    </div>
    <div class="flex items-center gap-2 md:col-span-2">
      <Button type="submit" :disabled="loading">
        {{ submitLabel || (isEditing ? t('ledgers_page.update_settlement') : t('ledgers_page.record_settlement')) }}
      </Button>
      <Button v-if="isEditing" type="button" variant="ghost" :disabled="loading" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </Button>
    </div>
  </form>
</template>
