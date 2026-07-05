<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const money = (value: unknown) => formatDisplayNumber(value)

const route = useRoute()
const productId = computed(() => String(route.params.productId))
const variationId = computed(() => String(route.params.variationId))
const { t, locale } = useI18n()
const productsStore = useProductsStore()
const { getErrorMessage } = useApiError()
const { can } = usePermissions()
const canShowVariation = computed(() => can('product_variations.show'))

const loading = ref(false)
const errorMessage = ref('')
const variation = ref<Record<string, unknown> | null>(null)

const createdAtRaw = computed(() => {
  const value = variation.value?.created_at
  if (value == null) return ''
  return String(value).trim()
})

const updatedAtRaw = computed(() => {
  const value = variation.value?.updated_at
  if (value == null) return ''
  return String(value).trim()
})

const showUpdatedAt = computed(() => {
  if (!updatedAtRaw.value) return false
  if (!createdAtRaw.value) return true
  return updatedAtRaw.value !== createdAtRaw.value
})

const formatDateTime = (value: string) => {
  return formatDisplayDate(value, { withTime: true })
}

const mainWarehouse = computed(() => {
  const inventory = variation.value?.inventory as any[] | undefined
  return inventory?.[0] ?? null
})

const warehouseDisplayName = (inventoryRow: any) => {
  const warehouse = inventoryRow?.warehouse
  if (warehouse && typeof warehouse === 'object') {
    const nameAr = warehouse?.name_ar
    const nameEn = warehouse?.name_en
    if (locale.value === 'ar') {
      if (nameAr) return nameAr
      if (nameEn) return nameEn
    }
    else {
      if (nameEn) return nameEn
      if (nameAr) return nameAr
    }
  }
  const warehouseId = inventoryRow?.warehouse_id ?? warehouse?.id
  return warehouseId != null ? `#${warehouseId}` : '—'
}

const loadVariation = async () => {
  if (!canShowVariation.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await productsStore.getVariation(productId.value, variationId.value)
    variation.value = (response as any)?.data?.variation ?? (response as any)?.variation ?? (response as any)?.data ?? response
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadVariation()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink :to="`/products/variations/${productId}`"><ArrowRight class="size-4" /></NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_variations.show_title') }}</h1>
        <p class="text-sm text-muted-foreground">#{{ variationId }}</p>
      </div>
    </div>

    <div
      v-if="!canShowVariation"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ t('common.forbidden') }}
    </div>

    <div v-else-if="loading" class="rounded-lg border p-8 text-center text-muted-foreground">
      <Loader2 class="mx-auto size-10 animate-spin mb-3" />
      <p class="text-sm">{{ t('common.loading') }}</p>
    </div>

    <div v-else-if="errorMessage" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
      {{ errorMessage }}
    </div>

    <div v-else-if="variation" class="rounded-lg border p-5 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-muted-foreground">{{ t('products_variations.global_warehouse') }}</p>
          <p>{{ mainWarehouse ? warehouseDisplayName(mainWarehouse) : '—' }}</p>
        </div>
        <div><p class="text-xs text-muted-foreground">{{ t('products_variations.variation_sku') }}</p><p>{{ variation.sku || '—' }}</p></div>
        <div><p class="text-xs text-muted-foreground">{{ t('products_variations.variation_barcode') }}</p><p>{{ variation.barcode || '—' }}</p></div>
        <div><p class="text-xs text-muted-foreground">{{ t('products_variations.variation_price') }}</p><p class="tabular-nums">{{ money(variation.price) }}</p></div>
        <div><p class="text-xs text-muted-foreground">{{ t('products_variations.variation_qty') }}</p><p>{{ variation.stock_quantity || 0 }}</p></div>
        <div v-if="createdAtRaw"><p class="text-xs text-muted-foreground">{{ t('common.created_at') }}</p><p>{{ formatDateTime(createdAtRaw) }}</p></div>
        <div v-if="showUpdatedAt"><p class="text-xs text-muted-foreground">{{ t('common.updated_at') }}</p><p>{{ formatDateTime(updatedAtRaw) }}</p></div>
      </div>

      <div>
        <p class="text-xs text-muted-foreground mb-2">{{ t('products_variations.values_by_attribute') }}</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(value, idx) in (variation.attribute_values as any[] || [])"
            :key="idx"
            class="px-2 py-1 rounded bg-muted text-xs"
          >
            {{ value?.name || `#${value?.id || idx}` }}
          </span>
        </div>
      </div>

      <div>
        <p class="text-xs text-muted-foreground mb-2">{{ t('products_variations.tiered_prices') }}</p>
        <div class="space-y-1 text-sm">
          <p v-if="!(variation.tiered_prices as any[])?.length">—</p>
          <p v-for="(tier, idx) in (variation.tiered_prices as any[] || [])" :key="idx">
            {{ tier.quantity_from }} - {{ tier.quantity_to }} : {{ money(tier.price) }}
          </p>
        </div>
      </div>

      <div>
        <p class="text-xs text-muted-foreground mb-2">{{ t('products_page.col_warehouse') }}</p>
        <div class="space-y-1 text-sm">
          <p v-if="!(variation.inventory as any[])?.length">—</p>
          <p v-for="(inv, idx) in (variation.inventory as any[] || [])" :key="idx">
            {{ warehouseDisplayName(inv) }} - {{ inv.quantity ?? 0 }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
