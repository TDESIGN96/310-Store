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

interface LedgerUser {
  id: number
  name: string
}

interface LedgerShowResponse {
  user?: LedgerUser
  balance?: string
  invoice_nets?: Array<{ invoice_id: number; reference_number: string | null; net: string }>
  entries?: LedgerEntry[]
  pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  data?: LedgerShowResponse
}

const { t } = useI18n()
const route = useRoute()
const { $api } = useApi()
const { getErrorMessage } = useApiError()
const { canAccess, canCreate, canEdit, canDelete } = usePermissions()
const { loadError, clearLoadError, setLoadErrorFromException } = useResourceListLoadError('user_ledgers_page', 'error')

const userId = computed(() => String(route.params.id))
const canView = computed(() => canAccess('user_ledgers'))
const canSettle = computed(() => canCreate('user_ledgers'))
const canEditSettlement = computed(() => canEdit('user_ledgers'))
const canDeleteSettlement = computed(() => canDelete('user_ledgers'))

const loading = ref(false)
const saving = ref(false)
const user = ref<LedgerUser | null>(null)
const balance = ref('0.00')
const entries = ref<LedgerEntry[]>([])
const invoiceNets = ref<Array<{ invoice_id: number; reference_number: string | null; net: string }>>([])
const pagination = ref<LedgerShowResponse['pagination'] | null>(null)
const currentPage = ref(1)
const editingEntry = ref<LedgerEntry | null>(null)
const entryToDelete = ref<LedgerEntry | null>(null)

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
    const res = await $api<LedgerShowResponse>(`/user-ledgers/${userId.value}`, { params: { page } })
    const payload = res.data ?? res
    user.value = payload.user ?? null
    balance.value = payload.balance ?? '0.00'
    entries.value = payload.entries ?? []
    invoiceNets.value = payload.invoice_nets ?? []
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
      await $api(`/user-ledgers/${userId.value}/settlements/${editingEntry.value.id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.success(t('ledgers_page.settlement_updated'))
      editingEntry.value = null
    }
    else {
      await $api(`/user-ledgers/${userId.value}/settlements`, {
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
    await $api(`/user-ledgers/${userId.value}/settlements/${entryToDelete.value.id}`, { method: 'DELETE' })
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
        <Button variant="ghost" class="mb-2 h-8 px-2" @click="navigateTo('/user-ledgers')">
          <ArrowRight class="size-4 rtl:rotate-180" />
          {{ t('ledgers_page.back_to_list') }}
        </Button>
        <h1 class="text-xl font-semibold">{{ user?.name || t('user_ledgers_page.detail_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('user_ledgers_page.detail_subtitle') }}</p>
      </div>
      <div class="rounded-lg border px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('ledgers_page.balance') }}</p>
        <p class="text-lg font-semibold" :class="ledgerAmountClass(balance)">{{ formatLedgerAmount(balance) }}</p>
      </div>
    </div>

    <div v-if="!canView" class="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
      {{ t('user_ledgers_page.no_permission') }}
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
