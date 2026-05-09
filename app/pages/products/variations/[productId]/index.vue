<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Pencil, Trash2, Power, PowerOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
const { getErrorMessage } = useApiError()
const { $api } = useApi()
const { can } = usePermissions()

const loading = ref(false)
const actionLoadingId = ref<number | null>(null)
const rows = ref<Array<Record<string, unknown>>>([])
const deleteTarget = ref<Record<string, unknown> | null>(null)
const productName = ref('')

interface ProductShowResponse {
  data?: {
    product?: Record<string, unknown>
  }
  product?: Record<string, unknown>
}

const canListVariations = computed(() => can('product_variations.index'))
const canShowVariation = computed(() => can('product_variations.show'))
const canCreateVariation = computed(() => can('product_variations.store'))
const canEditVariation = computed(() => can('product_variations.update'))
const canDeleteVariation = computed(() => can('product_variations.destroy'))
const canActivateVariation = computed(() => can('product_variations.activate'))
const canDeactivateVariation = computed(() => can('product_variations.deactivate'))

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

const toggleActivation = async (row: Record<string, unknown>) => {
  const variationId = Number(row.id)
  if (!variationId) return
  if (isActive(row) && !canDeactivateVariation.value) {
    toast.error(t('common.forbidden'))
    return
  }
  if (!isActive(row) && !canActivateVariation.value) {
    toast.error(t('common.forbidden'))
    return
  }
  actionLoadingId.value = variationId
  try {
    if (isActive(row)) await productsStore.deactivateVariation(productId.value, variationId)
    else await productsStore.activateVariation(productId.value, variationId)
    await loadVariations()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    actionLoadingId.value = null
  }
}

const confirmDelete = async () => {
  const variationId = Number(deleteTarget.value?.id)
  if (!variationId) return
  if (!canDeleteVariation.value) {
    toast.error(t('common.forbidden'))
    return
  }
  actionLoadingId.value = variationId
  try {
    await productsStore.deleteVariation(productId.value, variationId)
    deleteTarget.value = null
    toast.success(t('products_variations.delete_success'))
    await loadVariations()
  }
  catch (error: unknown) {
    toast.error(getErrorMessage(error))
  }
  finally {
    actionLoadingId.value = null
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
      <Button v-if="canCreateVariation" as-child class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]">
        <NuxtLink :to="`/products/variations/${productId}/create`">{{ t('products_variations.add_variation') }}</NuxtLink>
      </Button>
    </div>

    <div
      v-if="!canListVariations"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ t('common.forbidden') }}
    </div>

    <div v-else class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="text-start">{{ t('products_variations.variation_sku') }}</TableHead>
            <TableHead class="text-start">{{ t('products_variations.variation_barcode') }}</TableHead>
            <TableHead class="text-center">{{ t('products_variations.variation_price') }}</TableHead>
            <TableHead class="text-center">{{ t('products_variations.variation_qty') }}</TableHead>
            <TableHead class="text-center">{{ t('products_variations.tiered_prices') }}</TableHead>
            <TableHead class="text-start">{{ t('products_page.col_warehouse') }}</TableHead>
            <TableHead class="text-start">{{ t('common.status') }}</TableHead>
            <TableHead class="text-end">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="8" class="py-10 ">
              <Loader2 class="size-4 animate-spin inline-block mr-2" />
              {{ t('common.loading') }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell :colspan="8" class="py-10 text-center text-muted-foreground">
              {{ t('products_variations.no_variations') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="row in rows" :key="String(row.id)" v-else class="hover:bg-muted/30 transition-colors align-middle">
            <TableCell class="text-start font-medium">
              <NuxtLink
                v-if="canShowVariation"
                :to="`/products/variations/${productId}/show/${row.id}`"
                class="text-[#2563eb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
              >
                {{ row.sku || '—' }}
              </NuxtLink>
              <span v-else>{{ row.sku || '—' }}</span>
            </TableCell>
            <TableCell class="text-start">{{ row.barcode || '—' }}</TableCell>
            <TableCell class="text-center">{{ row.price || '—' }}</TableCell>
            <TableCell class="text-center">{{ row.stock_quantity ?? 0 }}</TableCell>
            <TableCell class="text-center">{{ tieredCount(row) }}</TableCell>
            <TableCell class="max-w-[220px] truncate text-start">{{ inventorySummary(row) }}</TableCell>
            <TableCell class="text-start">{{ isActive(row) ? t('common.active') : t('common.inactive') }}</TableCell>
            <TableCell class="text-end">
              <div class="flex flex-wrap gap-1 justify-end">
                <Button v-if="canEditVariation" variant="outline" size="sm" as-child>
                  <NuxtLink :to="`/products/variations/${productId}/edit/${row.id}`"><Pencil class="size-3.5" /></NuxtLink>
                </Button>
                <Button
                  v-if="(isActive(row) && canDeactivateVariation) || (!isActive(row) && canActivateVariation)"
                  variant="outline"
                  size="sm"
                  @click="toggleActivation(row)"
                >
                  <Loader2 v-if="actionLoadingId === Number(row.id)" class="size-3.5 animate-spin" />
                  <PowerOff v-else-if="isActive(row)" class="size-3.5" />
                  <Power v-else class="size-3.5" />
                </Button>
                <Button
                  v-if="canDeleteVariation"
                  variant="outline"
                  size="sm"
                  class="text-red-600 border-red-200"
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
  </div>
</template>
