<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const route = useRoute()
const productId = computed(() => String(route.params.productId))
const variationId = computed(() => String(route.params.variationId))
const { t } = useI18n()
const productsStore = useProductsStore()
const attributesStore = useAttributesStore()
const { getErrorMessage } = useApiError()
const { $api } = useApi()
const { can } = usePermissions()
const canEditVariation = computed(() => can('variation.update'))

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const warehouses = ref<Array<{ id: number, name_ar?: string, name_en?: string }>>([])
const form = ref({
  sku: '',
  barcode: '',
  price: 0,
  buying_price: 0,
  stock_quantity: 0,
  is_active: true,
  warehouse_id: null as number | null,
  min_quantity: 0,
  allow_notification: true,
  selectedValues: {} as Record<number, number>,
  tiered_prices: [] as Array<{ quantity_from: number, quantity_to: number, price: number }>,
})

const selectedAttributeIds = computed(() => productsStore.draft.attribute_ids)

const addTierPrice = () => {
  form.value.tiered_prices.push({ quantity_from: 0, quantity_to: 0, price: 0 })
}

const removeTierPrice = (index: number) => {
  form.value.tiered_prices.splice(index, 1)
}

const saveVariation = async () => {
  if (!canEditVariation.value) {
    errorMessage.value = t('common.forbidden')
    return
  }
  errorMessage.value = ''
  const attribute_value_ids = Object.values(form.value.selectedValues).map(v => Number(v)).filter(Boolean)
  if (!attribute_value_ids.length) {
    errorMessage.value = t('products_variations.validation_values_required')
    return
  }
  if (!form.value.warehouse_id) {
    errorMessage.value = t('products_variations.validation_warehouse_required')
    return
  }
  submitting.value = true
  try {
    await productsStore.updateVariation(productId.value, variationId.value, {
      sku: form.value.sku,
      barcode: form.value.barcode,
      price: form.value.price,
      buying_price: form.value.buying_price,
      stock_quantity: form.value.stock_quantity,
      is_active: form.value.is_active,
      attribute_value_ids,
      tiered_prices: form.value.tiered_prices,
      inventory: [
        {
          warehouse_id: form.value.warehouse_id,
          quantity: form.value.stock_quantity,
          min_quantity: form.value.min_quantity,
          allow_notification: form.value.allow_notification,
        },
      ],
    })
    toast.success(t('toasts.save_success'))
    await navigateTo(`/products/variations/${productId.value}`)
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!canEditVariation.value) return
  loading.value = true
  try {
    const whRes = await $api('/warehouses', { params: { page: 1, per_page: 100, status: 'active' } }).catch(() => ({}))
    warehouses.value = ((whRes as any)?.data?.warehouses ?? (whRes as any)?.warehouses ?? []) as Array<{ id: number, name_ar?: string, name_en?: string }>
    await Promise.all([attributesStore.load(), productsStore.loadProductDraft(productId.value)])
    const response = await productsStore.getVariation(productId.value, variationId.value)
    const variation = (response as any)?.data?.variation ?? (response as any)?.variation ?? (response as any)?.data ?? response

    form.value.sku = String(variation?.sku ?? '')
    form.value.barcode = String(variation?.barcode ?? '')
    form.value.price = Number(variation?.price ?? 0)
    form.value.buying_price = Number(variation?.buying_price ?? 0)
    form.value.stock_quantity = Number(variation?.stock_quantity ?? 0)
    form.value.is_active = variation?.is_active !== false && variation?.is_active !== 0 && variation?.is_active !== '0'
    form.value.warehouse_id = Number(variation?.inventory?.[0]?.warehouse_id ?? variation?.inventory?.[0]?.warehouse?.id ?? 0) || null
    form.value.min_quantity = Number(variation?.inventory?.[0]?.min_quantity ?? 0)
    form.value.allow_notification =
      variation?.inventory?.[0]?.allow_notification !== false
      && variation?.inventory?.[0]?.allow_notification !== 0
      && variation?.inventory?.[0]?.allow_notification !== '0'
    form.value.tiered_prices = (variation?.tiered_prices ?? []).map((tp: any) => ({
      quantity_from: Number(tp.quantity_from ?? 0),
      quantity_to: Number(tp.quantity_to ?? 0),
      price: Number(tp.price ?? 0),
    }))

    const attrValues = (variation?.attribute_values ?? []) as Array<{ id?: number, attribute_id?: number }>
    const selected: Record<number, number> = {}
    for (const v of attrValues) {
      if (v.attribute_id && v.id) selected[Number(v.attribute_id)] = Number(v.id)
    }
    form.value.selectedValues = selected
  }
  catch (error: unknown) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink :to="`/products/variations/${productId}`"><ArrowRight class="size-4" /></NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_variations.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground">#{{ variationId }}</p>
      </div>
    </div>

    <div v-if="!canEditVariation" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
      {{ t('common.forbidden') }}
    </div>

    <div v-else-if="errorMessage" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
      {{ errorMessage }}
    </div>

    <div v-else-if="loading" class="rounded-lg border p-8 text-center text-muted-foreground">
      <Loader2 class="mx-auto size-10 animate-spin mb-3" />
      <p class="text-sm">{{ t('common.loading') }}</p>
    </div>

    <div v-else class="rounded-lg border p-5 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><label class="text-xs font-medium">{{ t('products_variations.variation_sku') }}</label><Input v-model="form.sku" /></div>
        <div><label class="text-xs font-medium">{{ t('products_variations.variation_barcode') }}</label><Input v-model="form.barcode" /></div>
        <div><label class="text-xs font-medium">{{ t('products_variations.variation_price') }}</label><Input v-model.number="form.price" type="number" min="0" /></div>
        <div><label class="text-xs font-medium">{{ t('products_variations.variation_qty') }}</label><Input v-model.number="form.stock_quantity" type="number" min="0" /></div>
        <div>
          <label class="text-xs font-medium">{{ t('products_page.filter_warehouse') }}</label>
          <Select :model-value="form.warehouse_id ? String(form.warehouse_id) : ''" @update:model-value="v => form.warehouse_id = Number(v)">
            <SelectTrigger><SelectValue :placeholder="t('products_page.filter_warehouse')" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="w in warehouses" :key="w.id" :value="String(w.id)">
                {{ w.name_en || w.name_ar || `#${w.id}` }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><label class="text-xs font-medium">{{ t('warehouse_assignment.col_min_qty') }}</label><Input v-model.number="form.min_quantity" type="number" min="0" /></div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div v-for="attributeId in selectedAttributeIds" :key="attributeId">
          <Select :model-value="form.selectedValues[attributeId] ? String(form.selectedValues[attributeId]) : ''" @update:model-value="v => form.selectedValues[attributeId] = Number(v)">
            <SelectTrigger><SelectValue :placeholder="attributesStore.attributeName(attributeId)" /></SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="v in attributesStore.valuesByAttributeId.get(attributeId) || []"
                :key="v.id"
                :value="String(v.id)"
              >
                {{ v.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="font-medium">{{ t('products_variations.tiered_prices') }}</h2>
          <Button variant="outline" size="sm" @click="addTierPrice">{{ t('products_variations.add_tier_price') }}</Button>
        </div>
        <label class="inline-flex items-center gap-2 text-sm">
          <Checkbox :model-value="form.allow_notification" @update:model-value="v => form.allow_notification = Boolean(v)" />
          {{ t('warehouse_assignment.col_notifications') }}
        </label>
        <div v-for="(tp, idx) in form.tiered_prices" :key="idx" class="grid grid-cols-3 gap-2">
          <Input v-model.number="tp.quantity_from" type="number" min="0" />
          <Input v-model.number="tp.quantity_to" type="number" min="0" />
          <div class="flex gap-2">
            <Input v-model.number="tp.price" type="number" min="0" />
            <Button variant="ghost" size="sm" @click="removeTierPrice(idx)">{{ t('common.delete') }}</Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="canEditVariation" class="flex justify-end gap-2">
      <Button variant="outline" as-child><NuxtLink :to="`/products/variations/${productId}`">{{ t('common.cancel') }}</NuxtLink></Button>
      <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="saveVariation">
        <Loader2 v-if="submitting" class="size-4 animate-spin mr-1" />
        {{ submitting ? t('common.saving') : t('common.save') }}
      </Button>
    </div>
  </div>
</template>
