<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { DatePickerInput } from '@/components/ui/date-picker'
import ReportFilterField from '@/components/reports/ReportFilterField.vue'
import {
  REPORT_DATE_PRESETS,
  getReportDatePresetRange,
  type ReportDatePresetId,
} from '@/utils/reportDateFilters'

const props = defineProps<{
  dateFrom: string
  dateTo: string
  fromLabel: string
  toLabel: string
  fromError?: string
  toError?: string
}>()

const emit = defineEmits<{
  'update:dateFrom': [value: string]
  'update:dateTo': [value: string]
  'clear-errors': []
}>()

const { t } = useI18n()

const PRESET_LABEL_KEYS: Record<ReportDatePresetId, string> = {
  today: 'reports_filters.preset_today',
  yesterday: 'reports_filters.preset_yesterday',
  last_7_days: 'reports_filters.preset_last_7_days',
  last_30_days: 'reports_filters.preset_last_30_days',
  this_year: 'reports_filters.preset_this_year',
  previous_year: 'reports_filters.preset_previous_year',
}

const activePreset = computed<ReportDatePresetId | null>(() => {
  const from = props.dateFrom.trim()
  const to = props.dateTo.trim()
  if (!from || !to) return null
  for (const id of REPORT_DATE_PRESETS) {
    const range = getReportDatePresetRange(id)
    if (range.from === from && range.to === to) return id
  }
  return null
})

const applyPreset = (id: ReportDatePresetId) => {
  const range = getReportDatePresetRange(id)
  emit('update:dateFrom', range.from)
  emit('update:dateTo', range.to)
  emit('clear-errors')
}

const updateFrom = (value: string) => {
  emit('update:dateFrom', value)
  emit('clear-errors')
}

const updateTo = (value: string) => {
  emit('update:dateTo', value)
  emit('clear-errors')
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <Button
        v-for="id in REPORT_DATE_PRESETS"
        :key="id"
        type="button"
        size="sm"
        class="h-8"
        :variant="activePreset === id ? 'default' : 'outline'"
        @click="applyPreset(id)"
      >
        {{ t(PRESET_LABEL_KEYS[id]) }}
      </Button>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <ReportFilterField
        :label="fromLabel"
        required
        :error="fromError"
      >
        <DatePickerInput
          :model-value="dateFrom"
          class="w-full"
          @update:model-value="updateFrom"
        />
      </ReportFilterField>
      <ReportFilterField
        :label="toLabel"
        required
        :error="toError"
      >
        <DatePickerInput
          :model-value="dateTo"
          class="w-full"
          max-date="today"
          @update:model-value="updateTo"
        />
      </ReportFilterField>
    </div>
  </div>
</template>
