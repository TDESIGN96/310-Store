<script setup lang="ts">
import { Search, Wallet, Loader2, ShieldAlert } from 'lucide-vue-next'
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
import TableRowActions from '@/components/app/table/TableRowActions.vue'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { formatLedgerAmount, ledgerAmountClass } from '@/utils/formatLedgerAmount'

definePageMeta({ layout: 'default' })

interface LedgerUser {
  id: number
  name: string
  email?: string
}

interface AccountRow {
  user: LedgerUser
  balance: string
}

interface ListResponse {
  accounts?: AccountRow[]
  pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  data?: {
    accounts?: AccountRow[]
    pagination?: { current_page: number; last_page: number; per_page: number; total: number }
  }
}

const { t } = useI18n()
const { $api } = useApi()
const { canAccess, can } = usePermissions()
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('user_ledgers_page')

const canView = computed(() => canAccess('user_ledgers'))
const canShow = computed(() => can('user_ledgers.show'))

const rows = ref<AccountRow[]>([])
const search = ref('')
const loading = ref(false)
const pagination = ref<ListResponse['pagination'] | null>(null)
const currentPage = ref(1)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const loadAccounts = async (page = currentPage.value, query = search.value.trim()) => {
  if (!canView.value) return
  loading.value = true
  clearListLoadError()
  try {
    const params: Record<string, string | number> = { page }
    if (query) params.search = query
    const res = await $api<ListResponse>('/user-ledgers', { params })
    rows.value = res.data?.accounts ?? res.accounts ?? []
    pagination.value = res.data?.pagination ?? res.pagination ?? null
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
  loadAccounts(page)
}

watch(search, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadAccounts(1)
  }, 300)
})

onMounted(() => {
  if (canView.value) loadAccounts()
})
</script>

<template>
  <div class="flex flex-col gap-6 p-4 md:p-6">
    <div>
      <h1 class="text-xl font-semibold">{{ t('user_ledgers_page.title') }}</h1>
      <p class="text-sm text-muted-foreground">{{ t('user_ledgers_page.subtitle') }}</p>
    </div>

    <div v-if="!canView" class="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
      {{ t('user_ledgers_page.no_permission') }}
    </div>

    <template v-else>
      <div class="relative max-w-sm">
        <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" class="ps-9" :placeholder="t('user_ledgers_page.search_placeholder')" />
      </div>

      <div class="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader class="hidden md:table-header-group">
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="text-start font-medium">{{ t('ledgers_page.col_name') }}</TableHead>
              <TableHead class="text-end font-medium">{{ t('ledgers_page.col_balance') }}</TableHead>
              <TableHead class="text-end font-medium">{{ t('common.actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="3" class="py-14 text-center">
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  {{ t('user_ledgers_page.loading') }}
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="listLoadError">
              <TableCell colspan="3" class="py-14 text-center">
                <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                  <ShieldAlert class="size-6" />
                  <p class="font-medium">{{ listLoadError.title }}</p>
                  <p class="max-w-md text-center text-red-600/90">{{ listLoadError.detail }}</p>
                  <Button variant="outline" size="sm" @click="loadAccounts()">{{ t('common.retry') }}</Button>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="rows.length === 0">
              <TableCell colspan="3" class="py-14 text-center text-sm text-muted-foreground">
                {{ t('user_ledgers_page.empty') }}
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in rows"
              v-else
              :key="row.user.id"
              class="cursor-pointer align-middle"
              @click="canShow && navigateTo(`/user-ledgers/${row.user.id}`)"
            >
              <TableCell class="text-sm font-medium">{{ row.user.name }}</TableCell>
              <TableCell class="text-end text-sm font-medium" :class="ledgerAmountClass(row.balance)">
                {{ formatLedgerAmount(row.balance) }}
              </TableCell>
              <TableCell class="text-end" @click.stop>
                <TableRowActions
                  variant="link"
                  :actions="[
                    { key: `open-${row.user.id}`, label: t('ledgers_page.open_account'), type: 'button', icon: Wallet, visible: canShow, onClick: () => navigateTo(`/user-ledgers/${row.user.id}`) },
                  ]"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

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
