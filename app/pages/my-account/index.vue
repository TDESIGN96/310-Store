<script setup lang="ts">
import { ShieldAlert } from 'lucide-vue-next'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Button } from '@/components/ui/button'
import LedgerEntriesTable, { type LedgerEntry } from '@/components/ledgers/LedgerEntriesTable.vue'
import { formatLedgerAmount, ledgerAmountClass } from '@/utils/formatLedgerAmount'

definePageMeta({ layout: 'default' })

interface LedgerShowResponse {
  balance?: string
  invoice_nets?: Array<{ invoice_id: number; reference_number: string | null; net: string }>
  entries?: LedgerEntry[]
  pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  data?: LedgerShowResponse
}

const { t } = useI18n()
const { $api } = useApi()
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('my_ledger_page')

const loading = ref(false)
const balance = ref('0.00')
const entries = ref<LedgerEntry[]>([])
const pagination = ref<LedgerShowResponse['pagination'] | null>(null)
const currentPage = ref(1)

const loadLedger = async (page = currentPage.value) => {
  loading.value = true
  clearListLoadError()
  try {
    const res = await $api<LedgerShowResponse>('/my-ledger', { params: { page } })
    const payload = res.data ?? res
    balance.value = payload.balance ?? '0.00'
    entries.value = payload.entries ?? []
    pagination.value = payload.pagination ?? null
    currentPage.value = pagination.value?.current_page ?? page
  }
  catch (error: unknown) {
    setListLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (!pagination.value || page < 1 || page > pagination.value.last_page) return
  loadLedger(page)
}

onMounted(() => {
  loadLedger()
})
</script>

<template>
  <div class="flex flex-col gap-6 p-4 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">{{ t('my_ledger_page.title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('my_ledger_page.subtitle') }}</p>
      </div>
      <div class="rounded-lg border px-4 py-3">
        <p class="text-xs text-muted-foreground">{{ t('ledgers_page.balance') }}</p>
        <p class="text-lg font-semibold" :class="ledgerAmountClass(balance)">{{ formatLedgerAmount(balance) }}</p>
      </div>
    </div>

    <div v-if="listLoadError" class="flex flex-col items-center gap-2 py-14 text-sm text-red-500">
      <ShieldAlert class="size-6" />
      <p class="font-medium">{{ listLoadError.title }}</p>
      <p class="max-w-md text-center text-red-600/90">{{ listLoadError.detail }}</p>
      <Button variant="outline" size="sm" @click="loadLedger()">{{ t('common.retry') }}</Button>
    </div>

    <template v-else>
      <LedgerEntriesTable :entries="entries" :loading="loading" />

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
  </div>
</template>
