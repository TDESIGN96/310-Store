<script setup lang="ts">
import { computed } from 'vue'
import { Paperclip, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InvoiceDeliveryBy } from '@/stores/invoices'

const props = defineProps<{
  deliveryBy: InvoiceDeliveryBy
  deliveryAgentName: string
  deliveryAgentMobile: string
  attachmentPath: string
  attachmentFile: File | null
  attachmentError: string
  deliveryByError?: string
  deliveryAgentNameError?: string
  deliveryAgentMobileError?: string
  i18nPrefix: 'invoices_page' | 'transport_invoices_page'
}>()

const emit = defineEmits<{
  'update:deliveryBy': [value: InvoiceDeliveryBy]
  'update:deliveryAgentName': [value: string]
  'update:deliveryAgentMobile': [value: string]
  'attachment-change': [event: Event]
  'attachment-remove-existing': []
  'attachment-remove-selected': []
}>()

const { t } = useI18n()

const tp = (key: string) => t(`${props.i18nPrefix}.${key}`)

const showAgentFields = computed(() => props.deliveryBy !== 'shipping_company')

const attachmentFileName = computed(() => props.attachmentFile?.name ?? '')
const attachmentUrl = computed(() => (!props.attachmentFile ? props.attachmentPath : ''))
</script>

<template>
  <div class="space-y-2">
    <label class="text-sm font-medium">{{ tp('delivery_by') }}</label>
    <Select
      :model-value="deliveryBy"
      @update:model-value="value => emit('update:deliveryBy', value as InvoiceDeliveryBy)"
    >
      <SelectTrigger
        class="w-full"
        :aria-invalid="Boolean(deliveryByError)"
        :class="{ 'border-destructive': Boolean(deliveryByError) }"
      >
        <SelectValue :placeholder="tp('select_delivery_by')" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="shipping_company">{{ tp('delivery_by_shipping_company') }}</SelectItem>
        <SelectItem value="delivery_agent">{{ tp('delivery_by_delivery_agent') }}</SelectItem>
        <SelectItem value="other">{{ tp('delivery_by_other') }}</SelectItem>
      </SelectContent>
    </Select>
    <p v-if="deliveryByError" class="text-xs text-destructive">{{ deliveryByError }}</p>
  </div>

  <template v-if="showAgentFields">
    <div class="space-y-2">
      <label class="text-sm font-medium">{{ tp('delivery_agent_name') }}</label>
      <Input
        :model-value="deliveryAgentName"
        :aria-invalid="Boolean(deliveryAgentNameError)"
        @update:model-value="value => emit('update:deliveryAgentName', String(value))"
      />
      <p v-if="deliveryAgentNameError" class="text-xs text-destructive">{{ deliveryAgentNameError }}</p>
    </div>
    <div class="space-y-2">
      <label class="text-sm font-medium">{{ tp('delivery_agent_mobile') }}</label>
      <Input
        :model-value="deliveryAgentMobile"
        type="tel"
        inputmode="numeric"
        pattern="[0-9]*"
        :aria-invalid="Boolean(deliveryAgentMobileError)"
        @update:model-value="value => emit('update:deliveryAgentMobile', String(value).replace(/\D/g, ''))"
      />
      <p v-if="deliveryAgentMobileError" class="text-xs text-destructive">{{ deliveryAgentMobileError }}</p>
    </div>
    <div class="space-y-2 sm:col-span-2">
      <label class="text-sm font-medium">{{ tp('attachment') }}</label>
      <label
        class="flex w-full max-w-md items-center gap-2 cursor-pointer border rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Paperclip class="w-4 h-4 shrink-0" />
        <span>{{ tp('attachment_choose_file') }}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          class="hidden"
          @change="event => emit('attachment-change', event)"
        >
      </label>
      <p v-if="attachmentError" class="text-xs text-destructive">{{ attachmentError }}</p>
      <div v-if="attachmentFileName" class="flex items-center gap-1.5 text-xs border rounded px-2 py-1 bg-muted max-w-md">
        <span class="truncate">{{ attachmentFileName }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-destructive ms-auto"
          :aria-label="tp('attachment_remove')"
          @click="emit('attachment-remove-selected')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
      <div v-else-if="attachmentUrl" class="flex items-center gap-2 text-xs max-w-md">
        <a :href="attachmentUrl" target="_blank" rel="noopener noreferrer" class="truncate text-primary underline">
          {{ tp('attachment_current_file') }}
        </a>
        <button
          type="button"
          class="text-muted-foreground hover:text-destructive"
          :aria-label="tp('attachment_remove')"
          @click="emit('attachment-remove-existing')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </template>
</template>
