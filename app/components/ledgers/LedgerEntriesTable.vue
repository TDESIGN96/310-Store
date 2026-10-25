<script setup lang="ts">
import { Pencil, Trash2, Loader2 } from 'lucide-vue-next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatLedgerAmount, ledgerAmountClass } from '@/utils/formatLedgerAmount'

export interface LedgerEntryUser {
  id: number
  name: string
}

export interface LedgerEntry {
  id: number
  type: string
  type_label?: string
  amount: string
  invoice_id?: number | null
  invoice_reference?: string | null
  description: string
  note?: string | null
  entry_date: string
  reference_number?: string | null
  running_balance?: string
  user?: LedgerEntryUser | null
  can_be_edited?: boolean
  can_be_deleted?: boolean
}

defineProps<{
  entries: LedgerEntry[]
  loading?: boolean
  showUser?: boolean
  canEdit?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  edit: [entry: LedgerEntry]
  remove: [entry: LedgerEntry]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="rounded-lg border overflow-hidden">
    <Table>
      <TableHeader class="hidden md:table-header-group">
        <TableRow class="bg-muted/40 hover:bg-muted/40">
          <TableHead class="text-start font-medium">{{ t('ledgers_page.col_date') }}</TableHead>
          <TableHead class="text-start font-medium">{{ t('ledgers_page.col_reference') }}</TableHead>
          <TableHead class="text-start font-medium">{{ t('ledgers_page.col_description') }}</TableHead>
          <TableHead v-if="showUser" class="text-start font-medium">{{ t('ledgers_page.col_user') }}</TableHead>
          <TableHead class="text-end font-medium">{{ t('ledgers_page.col_amount') }}</TableHead>
          <TableHead class="text-end font-medium">{{ t('ledgers_page.col_running_balance') }}</TableHead>
          <TableHead class="text-end font-medium">{{ t('common.actions') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loading">
          <TableCell :colspan="showUser ? 7 : 6" class="py-14 text-center">
            <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 class="size-4 animate-spin" />
              {{ t('ledgers_page.loading_entries') }}
            </div>
          </TableCell>
        </TableRow>
        <TableRow v-else-if="entries.length === 0">
          <TableCell :colspan="showUser ? 7 : 6" class="py-14 text-center text-sm text-muted-foreground">
            {{ t('ledgers_page.empty_entries') }}
          </TableCell>
        </TableRow>
        <TableRow v-for="entry in entries" v-else :key="entry.id" class="align-middle">
          <TableCell class="text-sm tabular-nums">{{ formatDisplayDate(entry.entry_date) }}</TableCell>
          <TableCell class="text-sm">{{ entry.reference_number || entry.invoice_reference || '—' }}</TableCell>
          <TableCell class="text-sm">
            <div>{{ entry.description }}</div>
            <div v-if="entry.note" class="text-xs text-muted-foreground">{{ entry.note }}</div>
          </TableCell>
          <TableCell v-if="showUser" class="text-sm">{{ entry.user?.name || '—' }}</TableCell>
          <TableCell class="text-end text-sm font-medium" :class="ledgerAmountClass(entry.amount)">
            {{ formatLedgerAmount(entry.amount, { roundToCurrencyStep: entry.type === 'invoice_adjustment' }) }}
          </TableCell>
          <TableCell class="text-end text-sm tabular-nums">
            {{ entry.running_balance ? formatLedgerAmount(entry.running_balance) : '—' }}
          </TableCell>
          <TableCell class="text-end">
            <TableRowActions
              variant="link"
              :actions="[
                { key: `edit-${entry.id}`, label: t('common.edit'), type: 'button', icon: Pencil, visible: Boolean(canEdit && entry.can_be_edited), onClick: () => emit('edit', entry) },
                { key: `delete-${entry.id}`, label: t('common.delete'), type: 'button', icon: Trash2, tone: 'danger', visible: Boolean(canDelete && entry.can_be_deleted), onClick: () => emit('remove', entry) },
              ]"
            />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
