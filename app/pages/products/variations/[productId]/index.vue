<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Pencil, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const route = useRoute()
const productId = computed(() => String(route.params.productId))
const { t } = useI18n()
const productsStore = useProductsStore()
const authStore = useAuthStore()
const { getErrorMessage } = useApiError()
const { $api } = useApi()
const { can } = usePermissions()

const loading = ref(false)
const rows = ref<Array<Record<string, unknown>>>([])
const deleteTarget = ref<Record<string, unknown> | null>(null)
const productName = ref('')
const selectedIds = ref<Set<number>>(new Set())
const bulkDeleteConfirmOpen = ref(false)
const bulkActionLoading = ref(false)

interface ProductShowResponse {
  data?: {
    product?: Record<string, unknown>
  }
  product?: Record<string, unknown>
}

const isDistributorUser = computed(() => Boolean(authStore.user?.is_distributor))
const canListVariations = computed(() => can('product_variations.index'))
const canShowVariation = computed(() => !isDistributorUser.value && can('product_variations.show'))
const canCreateVariation = computed(() => !isDistributorUser.value && can('product_variations.store'))
const canEditVariation = computed(() => !isDistributorUser.value && can('product_variations.update'))
const canDeleteVariation = computed(() => !isDistributorUser.value && can('product_variations.destroy'))
const selectedRows = computed(() => rows.value.filter(row => selectedIds.value.has(Number(row.id))))
const selectedCount = computed(() => selectedIds.value.size)
const isAllSelected = computed(
  () => rows.value.length > 0 && rows.value.every(row => selectedIds.value.has(Number(row.id))),
)
const isIndeterminate = computed(
  () => rows.value.some(row => selectedIds.value.has(Number(row.id))) && !isAllSelected.value,
)
const canDeleteSelected = computed(
  () => canDeleteVariation.value && selectedRows.value.length > 0,
)
const tableColspan = computed(() => (isDistributorUser.value ? 9 : 10))

const toggleSelectAll = () => {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) rows.value.forEach(row => next.delete(Number(row.id)))
  else rows.value.forEach(row => next.add(Number(row.id)))
  selectedIds.value = next
}

const toggleSelect = (id: number) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const isActive = (row: Record<string, unknown>) =>
  row.is_active === true || row.is_active === 1 || row.is_active === '1'

const tieredCount = (row: Record<string, unknown>) =>
  Array.isArray(row.tiered_prices) ? row.tiered_prices.length : 0

const inventorySummary = (row: Record<string, unknown>) => {
  const inv = Array.isArray(row.inventory) ? row.inventory as Array<Record<string, unknown>> : []
  if (!inv.length) return '—'
  return inv
    .map((item) => {
      const warehouse = item.warehouse as Record<string, unknown> | undefined
      const warehouseName = String(
        warehouse?.name_en
        ?? warehouse?.name_ar
        ?? warehouse?.name
        ?? item.warehouse_name
        ?? `#${item.warehouse_id ?? warehouse?.id ?? '—'}`,
      )
      return `${warehouseName}: ${item.quantity ?? 0}`
    })
    .join(', ')
}

const loadVariations = async () => {
  if (!canListVariations.value) return
  loading.value = true
  try {
    rows.value = await productsStore.listVariations(productId.value)
    selectedIds.value = new Set()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    loading.value = false
  }
}

const loadProductName = async () => {
  try {
    const res = await $api<ProductShowResponse>(`/products/${productId.value}`)
    const product = res.data?.product ?? res.product ?? {}
    productName.value = String(product.name_en ?? product.name_ar ?? product.name ?? '').trim()
  }
  catch {
    productName.value = ''
  }
}

const confirmDelete = async () => {
  const variationId = Number(deleteTarget.value?.id)
  if (!variationId) return
  if (!canDeleteVariation.value) {
    if (isDistributorUser.value) return
    toast.error(t('common.forbidden'))
    return
  }
  try {
    await productsStore.deleteVariation(productId.value, variationId)
    deleteTarget.value = null
    toast.success(t('products_variations.delete_success'))
    await loadVariations()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
}

const runBulkDelete = async () => {
  if (!canDeleteVariation.value) {
    if (isDistributorUser.value) return
    toast.error(t('common.forbidden'))
    return
  }
  const eligible = selectedRows.value
  if (!eligible.length) return
  bulkDeleteConfirmOpen.value = false
  bulkActionLoading.value = true
  try {
    await Promise.all(
      eligible.map(row => productsStore.deleteVariation(productId.value, Number(row.id))),
    )
    toast.success(t('common.bulk_deleted_success', { count: eligible.length }))
    selectedIds.value = new Set()
    await loadVariations()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error))
  } finally {
    bulkActionLoading.value = false
  }
}

onMounted(() => {
  loadProductName()
  loadVariations()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/products"><ArrowRight class="size-4" /></NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">
            {{ t('products_variations.variations_list_title') }}{{ productName ? ` - ${productName}` : '' }}
          </h1>
          <p class="text-sm text-muted-foreground">#{{ productId }}</p>
        </div>
      </div>
      <Button v-if="canCreateVariation" as-child class="bg-primary hover:bg-primary/90 text-Green-Light">
        <NuxtLink :to="`/products/variations/${productId}/create`">{{ t('products_variations.add_variation') }}</NuxtLink>
      </Button>
    </div>

    <div
      v-if="!canListVariations"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ t('common.forbidden') }}
    </div>
    <div
      v-else-if="selectedCount > 0"
      class="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 flex-wrap"
    >
      <span class="text-sm font-medium text-emerald-700">
        {{ t('common.bulk_status_actions_notice', { count: selectedCount }) }}
      </span>
      <div class="flex items-center gap-2 ms-auto">
        <Button variant="outline" size="sm" class="h-8 text-red-600 border-red-300 hover:bg-red-100" :disabled="bulkActionLoading || !canDeleteSelected" @click="bulkDeleteConfirmOpen = true">
          {{ t('common.delete') }}
        </Button>
        <Button variant="ghost" size="sm" class="h-8 text-muted-foreground" @click="selectedIds = new Set()">
          {{ t('common.deselect') }}
        </Button>
      </div>
    </div>

    <div v-else class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader class="hidden md:table-header-group">
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="w-10 text-center">
              <Checkbox
                :model-value="isIndeterminate ? 'indeterminate' : isAllSelected"
                class="mt-0.5 mx-4"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="text-start">{{ t('products_variations.variation_sku') }}</TableHead>
            <TableHead class="text-start">{{ t('products_variations.show_variation_label') }}</TableHead>
            <TableHead class="text-start">{{ t('products_variations.variation_barcode') }}</TableHead>
            <TableHead class="text-center">{{ t('products_variations.variation_price') }}</TableHead>
            <TableHead class="text-center">{{ t('products_variations.variation_qty') }}</TableHead>
            <TableHead class="text-center">{{ t('products_variations.tiered_prices') }}</TableHead>
            <TableHead class="text-start">{{ t('products_page.col_warehouse') }}</TableHead>
            <TableHead class="text-start">{{ t('common.status') }}</TableHead>
            <TableHead v-if="!isDistributorUser" class="text-end">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading" class="md:table-row">
            <TableCell :colspan="tableColspan" class="py-10 ">
              <Loader2 class="size-4 animate-spin inline-block mr-2" />
              {{ t('common.loading') }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0" class="md:table-row">
            <TableCell :colspan="tableColspan" class="py-10 text-center text-muted-foreground">
              {{ t('products_variations.no_variations') }}
            </TableCell>
          </TableRow>
          <TableRow
            v-for="row in rows"
            :key="String(row.id)"
            v-else
            class="flex flex-col gap-1 border-2 rounded-lg p-4 mb-4 shadow-sm
                   md:table-row md:border md:border-b md:rounded-none md:p-0 md:mb-0 md:shadow-none
                   hover:bg-muted/30 transition-colors align-middle"
            :class="{ 'bg-muted/20': selectedIds.has(Number(row.id)) }"
          >
            <TableCell class="flex items-center justify-between gap-2 py-1.5 border-b md:w-10 md:table-cell md:border-0 md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.select') }}</span>
              <Checkbox
                :model-value="selectedIds.has(Number(row.id))"
                class="md:mt-0.5 md:mx-4"
                @update:model-value="toggleSelect(Number(row.id))"
              />
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_variations.variation_sku') }}</span>
              <div class="font-medium">
                <NuxtLink
                  v-if="canShowVariation"
                  :to="`/products/variations/${productId}/show/${row.id}`"
                  class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
                >
                  {{ row.sku || '—' }}
                </NuxtLink>
                <span v-else>{{ row.sku || '—' }}</span>
              </div>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_variations.show_variation_label') }}</span>
              <span>{{ row.label || '—' }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_variations.variation_barcode') }}</span>
              <span>{{ row.barcode || '—' }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-center">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_variations.variation_price') }}</span>
              <span>{{ row.price || '—' }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-center">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_variations.variation_qty') }}</span>
              <span>{{ row.stock_quantity ?? 0 }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4 md:text-center">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_variations.tiered_prices') }}</span>
              <span>{{ tieredCount(row) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('products_page.col_warehouse') }}</span>
              <span class="md:max-w-[220px] md:truncate">{{ inventorySummary(row) }}</span>
            </TableCell>
            <TableCell class="flex justify-between items-start gap-2 py-1.5 md:table-cell md:py-4">
              <span class="text-xs font-medium text-muted-foreground md:hidden">{{ t('common.status') }}</span>
              <span>{{ isActive(row) ? t('common.active') : t('common.inactive') }}</span>
            </TableCell>
            <TableCell v-if="!isDistributorUser" class="flex justify-end gap-2 pt-3 border-t mt-2 md:table-cell md:border-0 md:pt-4 md:mt-0 md:text-end">
              <div class="flex flex-wrap gap-1 justify-end w-full sm:w-auto">
                <Button v-if="canEditVariation" variant="outline" size="sm" as-child class="flex-1 sm:flex-none">
                  <NuxtLink :to="`/products/variations/${productId}/edit/${row.id}`"><Pencil class="size-3.5" /></NuxtLink>
                </Button>
                <Button
                  v-if="canDeleteVariation"
                  variant="outline"
                  size="sm"
                  class="flex-1 sm:flex-none text-red-600 border-red-200"
                  @click="deleteTarget = row"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <AlertDialog :open="!!deleteTarget" @update:open="v => { if (!v) deleteTarget = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('products_variations.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('products_variations.delete_body') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <Button class="bg-red-600 hover:bg-red-700 text-white" @click="confirmDelete">
            {{ t('products_variations.delete_confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog :open="bulkDeleteConfirmOpen" @update:open="bulkDeleteConfirmOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('common.bulk_delete_selected_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('common.bulk_delete_selected_body', { count: selectedCount }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="bulkActionLoading">{{ t('common.cancel') }}</AlertDialogCancel>
          <Button class="bg-red-600 hover:bg-red-700 text-white" :disabled="bulkActionLoading" @click="runBulkDelete">
            <Loader2 v-if="bulkActionLoading" class="size-4 animate-spin" />
            {{ t('common.delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
