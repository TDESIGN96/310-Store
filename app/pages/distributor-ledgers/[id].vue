<script setup lang="ts">
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import LedgerEntriesTable, { type LedgerEntry } from '@/components/ledgers/LedgerEntriesTable.vue'
import SettlementForm, { type SettlementFormValue } from '@/components/ledgers/SettlementForm.vue'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatLedgerAmount, ledgerAmountClass } from '@/utils/formatLedgerAmount'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

interface LedgerDistributor {
  id: number
  name_en?: string
  name_ar?: string
}

interface LedgerShowResponse {
  distributor?: LedgerDistributor
  balance?: string
  users_balance?: string
  settlements_balance?: string
  entries?: LedgerEntry[]
  pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  data?: LedgerShowResponse
}

const { t, locale } = useI18n()
const route = useRoute()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canAccess, canCreate, canEdit, canDelete } = usePermissions()
const { loadError, clearLoadError, setLoadErrorFromException } = useResourceListLoadError('distributor_ledgers_page', 'error')

const distributorId = computed(() => String(route.params.id))
const canView = computed(() => canAccess('distributor_ledgers'))
const canSettle = computed(() => canCreate('distributor_ledgers'))
const canEditSettlement = computed(() => canEdit('distributor_ledgers'))
const canDeleteSettlement = computed(() => canDelete('distributor_ledgers'))

const loading = ref(false)
const saving = ref(false)
const distributor = ref<LedgerDistributor | null>(null)
const balance = ref('0.00')
const usersBalance = ref('0.00')
const settlementsBalance = ref('0.00')
const entries = ref<LedgerEntry[]>([])
const pagination = ref<LedgerShowResponse['pagination'] | null>(null)
const currentPage = ref(1)
const editingEntry = ref<LedgerEntry | null>(null)
const entryToDelete = ref<LedgerEntry | null>(null)

const displayName = computed(() => {
  if (!distributor.value) return t('distributor_ledgers_page.detail_title')
  return locale.value === 'ar'
    ? (distributor.value.name_ar || distributor.value.name_en || t('distributor_ledgers_page.detail_title'))
    : (distributor.value.name_en || distributor.value.name_ar || t('distributor_ledgers_page.detail_title'))
})

const editingForm = computed<SettlementFormValue | null>(() => {
  if (!editingEntry.value) return null
  const amount = Math.abs(Number(editingEntry.value.amount))
  return {
    amount: Number.isFinite(amount) ? String(amount) : '',
    direction: Number(editingEntry.value.amount) < 0 ? 'paid' : 'received',
    note: editingEntry.value.note ?? '',
    entry_date: editingEntry.value.entry_date,
  }
})

const loadLedger = async (page = currentPage.value) => {
  if (!canView.value) return
  loading.value = true
  clearLoadError()
  try {
    const res = await $api<LedgerShowResponse>(`/distributor-ledgers/${distributorId.value}`, { params: { page } })
    const payload = res.data ?? res
    distributor.value = payload.distributor ?? null
    balance.value = payload.balance ?? '0.00'
    usersBalance.value = payload.users_balance ?? '0.00'
    settlementsBalance.value = payload.settlements_balance ?? '0.00'
    entries.value = payload.entries ?? []
    pagination.value = payload.pagination ?? null
    currentPage.value = pagination.value?.current_page ?? page
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (!pagination.value || page < 1 || page > pagination.value.last_page) return
  loadLedger(page)
}

const submitSettlement = async (payload: { amount: number; direction: 'received' | 'paid'; note: string; entry_date: string }) => {
  saving.value = true
  try {
    if (editingEntry.value) {
      await $api(`/distributor-ledgers/${distributorId.value}/settlements/${editingEntry.value.id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.success(t('ledgers_page.settlement_updated'))
      editingEntry.value = null
    }
    else {
      await $api(`/distributor-ledgers/${distributorId.value}/settlements`, {
        method: 'POST',
        body: payload,
      })
      toast.success(t('ledgers_page.settlement_saved'))
    }
    await loadLedger(1)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    saving.value = false
  }
}

const confirmDelete = async () => {
  if (!entryToDelete.value) return
  saving.value = true
  try {
    await $api(`/distributor-ledgers/${distributorId.value}/settlements/${entryToDelete.value.id}`, { method: 'DELETE' })
    toast.success(t('ledgers_page.settlement_deleted'))
    entryToDelete.value = null
    await loadLedger(currentPage.value)
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    saving.value = false
  }
}

onMounted(() => {
  loadLedger()
})
</script>

<template>
  <div class="flex flex-col gap-6 p-4 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Button variant="ghost" class="mb-2 h-8 px-2" @click="navigateTo('/distributor-ledgers')">
          <ArrowRight class="size-4 rtl:rotate-180" />
          {{ t('ledgers_page.back_to_list') }}
        </Button>
        <h1 class="text-xl font-semibold">{{ displayName }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('distributor_ledgers_page.detail_subtitle') }}</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <div class="rounded-lg border px-4 py-3">
          <p class="text-xs text-muted-foreground">{{ t('ledgers_page.col_users_balance') }}</p>
          <p class="text-sm font-semibold" :class="ledgerAmountClass(usersBalance)">{{ formatLedgerAmount(usersBalance) }}</p>
        </div>
        <div class="rounded-lg border px-4 py-3">
          <p class="text-xs text-muted-foreground">{{ t('ledgers_page.col_settlements_balance') }}</p>
          <p class="text-sm font-semibold" :class="ledgerAmountClass(settlementsBalance)">{{ formatLedgerAmount(settlementsBalance) }}</p>
        </div>
        <div class="rounded-lg border px-4 py-3">
          <p class="text-xs text-muted-foreground">{{ t('ledgers_page.balance') }}</p>
          <p class="text-lg font-semibold" :class="ledgerAmountClass(balance)">{{ formatLedgerAmount(balance) }}</p>
        </div>
      </div>
    </div>

    <div v-if="!canView" class="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
      {{ t('distributor_ledgers_page.no_permission') }}
    </div>

    <div v-else-if="loadError" class="flex flex-col items-center gap-2 py-14 text-sm text-red-500">
      <ShieldAlert class="size-6" />
      <p class="font-medium">{{ loadError.title }}</p>
      <p class="max-w-md text-center text-red-600/90">{{ loadError.detail }}</p>
      <Button variant="outline" size="sm" @click="loadLedger()">{{ t('common.retry') }}</Button>
    </div>

    <template v-else>
      <Card v-if="canSettle">
        <CardHeader>
          <CardTitle class="text-base">
            {{ editingEntry ? t('ledgers_page.edit_settlement') : t('ledgers_page.record_settlement') }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SettlementForm
            :loading="saving"
            :initial="editingForm"
            @submit="submitSettlement"
            @cancel="editingEntry = null"
          />
        </CardContent>
      </Card>

      <LedgerEntriesTable
        :entries="entries"
        :loading="loading"
        show-user
        :can-edit="canEditSettlement"
        :can-delete="canDeleteSettlement"
        @edit="editingEntry = $event"
        @remove="entryToDelete = $event"
      />

      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3">
        <p class="text-xs text-muted-foreground">
          {{ t('ledgers_page.pagination', {
            from: (currentPage - 1) * pagination.per_page + 1,
            to: Math.min(currentPage * pagination.per_page, pagination.total),
            total: pagination.total,
          }) }}
        </p>
        <PaginationArrowButtons
          :current-page="currentPage"
          :last-page="pagination.last_page"
          :loading="loading"
          @prev="goToPage(currentPage - 1)"
          @next="goToPage(currentPage + 1)"
        />
      </div>
    </template>

    <AlertDialog :open="Boolean(entryToDelete)" @update:open="(open) => { if (!open) entryToDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('ledgers_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('ledgers_page.delete_body') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <Button variant="destructive" :disabled="saving" @click="confirmDelete">
            <Loader2 v-if="saving" class="size-4 animate-spin" />
            {{ t('common.delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
