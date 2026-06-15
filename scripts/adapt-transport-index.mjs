import fs from 'node:fs'

let s = fs.readFileSync('app/pages/invoices/index.vue', 'utf8')

// Dual stores: list via transport, mutations via invoices
s = s.replace(
  "import type { InvoiceListItem } from '@/stores/invoices'\nimport { useInvoicesStore } from '@/stores/invoices'",
  `import type { InvoiceListItem } from '@/stores/invoices'
import { useInvoicesStore } from '@/stores/invoices'
import type { TransportInvoiceListItem } from '@/stores/transportInvoices'
import { useTransportInvoicesStore } from '@/stores/transportInvoices'`,
)
s = s.replace('const invoicesStore = useInvoicesStore()', `const invoicesStore = useInvoicesStore()
const transportInvoicesStore = useTransportInvoicesStore()
const { $api } = useApi()`)

s = s.replace(/invoices_page\./g, 'transport_invoices_page.')
s = s.replace(/InvoiceListItem/g, 'TransportInvoiceListItem')

// List from shipped endpoint only
s = s.replace('const list = computed(() => invoicesStore.list)', 'const list = computed(() => transportInvoicesStore.list)')
s = s.replace('const pagination = computed(() => invoicesStore.pagination)', 'const pagination = computed(() => transportInvoicesStore.pagination)')
s = s.replace('const loading = computed(() => invoicesStore.listLoading)', 'const loading = computed(() => transportInvoicesStore.listLoading)')
s = s.replace('await invoicesStore.loadList(params)', 'await transportInvoicesStore.loadList(params)')

// Transport routes
s = s.replace(/`\/invoices\//g, '`/transport-invoices/')
s = s.replace(/to="\/invoices\//g, 'to="/transport-invoices/')
s = s.replace(/to="\/invoices\/create"/g, 'to="/transport-invoices/create"')

// Clone navigates to transport edit
s = s.replace(
  'await navigateTo(`/transport-invoices/edit/${createdId}`)',
  'await navigateTo(`/transport-invoices/edit/${createdId}`)',
)

// Add sync shipment after bulkDeleteLoading
if (!s.includes('shipmentSyncLoading')) {
  s = s.replace(
    'const bulkDeleteLoading = ref(false)\nlet debounceTimer',
    `const bulkDeleteLoading = ref(false)
const shipmentSyncLoading = ref(false)
let debounceTimer`,
  )
  s = s.replace(
    `const extractCreatedInvoiceId = (response: unknown): number | null => {`,
    `const syncShipmentStatus = async () => {
  shipmentSyncLoading.value = true
  try {
    await $api('/invoices/sync-shipment-status', { method: 'POST' })
    toast.success(t('transport_invoices_page.shipment_sync_success'))
    await loadRows(currentPage.value)
  }
  catch {
    toast.error(t('transport_invoices_page.shipment_sync_error'))
  }
  finally {
    shipmentSyncLoading.value = false
  }
}

const extractCreatedInvoiceId = (response: unknown): number | null => {`,
  )
  s = s.replace(
    `<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Button v-if="canCreateInvoice" class="h-9 gap-2 bg-primary`,
    `<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Button
            class="h-9 gap-2 w-full sm:w-auto"
            variant="outline"
            :disabled="shipmentSyncLoading || loading"
            @click="syncShipmentStatus"
          >
            <Loader2 v-if="shipmentSyncLoading" class="size-4 animate-spin" />
            <RotateCcw v-else class="size-4" />
            <span class="hidden sm:inline">{{ t('transport_invoices_page.shipment_status_sync') }}</span>
            <span class="sm:hidden">{{ t('transport_invoices_page.sync_status') }}</span>
          </Button>
          <Button v-if="canCreateInvoice" class="h-9 gap-2 bg-primary`,
  )
}

// Return action should be link type for transport - keep as navigateTo in button
s = s.replace(
  "onClick: () => navigateTo(`/transport-invoices/return/\${row.id}`)",
  "onClick: () => navigateTo(`/transport-invoices/return/${row.id}`)",
)

fs.writeFileSync('app/pages/transport-invoices/index.vue', s)
console.log('transport index written')
