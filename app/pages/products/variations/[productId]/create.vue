<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-vue-next'
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
const { t } = useI18n()
const productsStore = useProductsStore()
const attributesStore = useAttributesStore()
const { getErrorMessage } = useApiError()
const { $api } = useApi()
const { can } = usePermissions()
const canCreateVariation = computed(() => can('product_variations.store'))

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const warehouses = ref<Array<{ id: number, name_ar?: string, name_en?: string }>>([])

interface TierPriceForm {
  quantity_from: number
  quantity_to: number
  price: number
}

interface VariationForm {
  sku: string
  barcode: string
  price: number
  buying_price: number
  stock_quantity: number
  is_active: boolean
  warehouse_id: number | null
  min_quantity: number
  allow_notification: boolean
  selectedValues: Record<number, number>
  tiered_prices: TierPriceForm[]
}

const createEmptyVariation = (): VariationForm => ({
  sku: '',
  barcode: '',
  price: 0,
  buying_price: 0,
  stock_quantity: 0,
  is_active: true,
  warehouse_id: null,
  min_quantity: 0,
  allow_notification: true,
  selectedValues: {},
  tiered_prices: [],
})

const variations = ref<VariationForm[]>([createEmptyVariation()])

const selectedAttributeIds = computed(() => productsStore.draft.attribute_ids)

const addVariationRow = () => {
  variations.value.push(createEmptyVariation())
}

const removeVariationRow = (index: number) => {
  if (variations.value.length <= 1) return
  variations.value.splice(index, 1)
}

const addTierPrice = (rowIndex: number) => {
  variations.value[rowIndex]?.tiered_prices.push({ quantity_from: 0, quantity_to: 0, price: 0 })
}

const removeTierPrice = (rowIndex: number, tierIndex: number) => {
  variations.value[rowIndex]?.tiered_prices.splice(tierIndex, 1)
}

const createVariationPayload = (row: VariationForm) => {
  const attributeValueIds = Object.values(row.selectedValues).map(v => Number(v)).filter(Boolean)
  const payload: Record<string, unknown> = {
    // TEMP: variation fields are optional on create for now.
    sku: row.sku,
    barcode: row.barcode,
    price: row.price,
    buying_price: row.buying_price,
    stock_quantity: row.stock_quantity,
    is_active: row.is_active,
    tiered_prices: row.tiered_prices,
  }

  if (attributeValueIds.length) payload.attribute_value_ids = attributeValueIds
  if (row.warehouse_id) {
    payload.inventory = [{
      warehouse_id: row.warehouse_id,
      quantity: row.stock_quantity,
      min_quantity: row.min_quantity,
      allow_notification: row.allow_notification,
    }]
  }
  return payload
}

const createVariations = async () => {
  if (!canCreateVariation.value) {
    errorMessage.value = t('common.forbidden')
    return
  }
  errorMessage.value = ''
  if (!variations.value.length) variations.value.push(createEmptyVariation())

  submitting.value = true
  try {
    for (const row of variations.value) {
      await productsStore.createVariation(productId.value, createVariationPayload(row))
    }
    toast.success(t('products_variations.create_success'))
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
  if (!canCreateVariation.value) return
  loading.value = true
  try {
    const whRes = await $api('/warehouses', { params: { page: 1, per_page: 100, status: 'active' } }).catch(() => ({}))
    warehouses.value = ((whRes as any)?.data?.warehouses ?? (whRes as any)?.warehouses ?? []) as Array<{ id: number, name_ar?: string, name_en?: string }>
    await Promise.all([attributesStore.load(), productsStore.loadProductDraft(productId.value)])
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_variations.create_title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('products_variations.create_subtitle') }}</p>
      </div>
    </div>

    <div v-if="!canCreateVariation" class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3">
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
      <div
        v-for="(row, rowIndex) in variations"
        :key="rowIndex"
        class="rounded-md border p-4 space-y-4"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-medium">
            {{ t('products_variations.add_variation') }} #{{ rowIndex + 1 }}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            :disabled="variations.length <= 1"
            @click="removeVariationRow(rowIndex)"
          >
            <Trash2 class="size-4 mr-1" />
            {{ t('common.delete') }}
          </Button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div><label class="text-xs font-medium">{{ t('products_variations.variation_sku') }}</label><Input v-model="row.sku" /></div>
          <div><label class="text-xs font-medium">{{ t('products_variations.variation_barcode') }}</label><Input v-model="row.barcode" /></div>
          <div><label class="text-xs font-medium">{{ t('products_variations.variation_price') }}</label><Input v-model.number="row.price" type="number" min="0" /></div>
          <div><label class="text-xs font-medium">{{ t('products_variations.buying_price') }}</label><Input v-model.number="row.buying_price" type="number" min="0" /></div>
          <div><label class="text-xs font-medium">{{ t('products_variations.variation_qty') }}</label><Input v-model.number="row.stock_quantity" type="number" min="0" /></div>
          <div>
            <label class="text-xs font-medium">{{ t('products_page.filter_warehouse') }}</label>
            <Select :model-value="row.warehouse_id ? String(row.warehouse_id) : ''" @update:model-value="v => row.warehouse_id = Number(v)">
              <SelectTrigger><SelectValue :placeholder="t('products_page.filter_warehouse')" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="w in warehouses" :key="w.id" :value="String(w.id)">
                  {{ w.name_en || w.name_ar || `#${w.id}` }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><label class="text-xs font-medium">{{ t('warehouse_assignment.col_min_qty') }}</label><Input v-model.number="row.min_quantity" type="number" min="0" /></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div v-for="attributeId in selectedAttributeIds" :key="`${rowIndex}_${attributeId}`">
            <Select :model-value="row.selectedValues[attributeId] ? String(row.selectedValues[attributeId]) : ''" @update:model-value="v => row.selectedValues[attributeId] = Number(v)">
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
            <h3 class="font-medium">{{ t('products_variations.tiered_prices') }}</h3>
            <Button variant="outline" size="sm" @click="addTierPrice(rowIndex)">{{ t('products_variations.add_tier_price') }}</Button>
          </div>
          <label class="inline-flex items-center gap-2 text-sm">
            <Checkbox :model-value="row.allow_notification" @update:model-value="v => row.allow_notification = Boolean(v)" />
            {{ t('warehouse_assignment.col_notifications') }}
          </label>
          <div v-for="(tp, idx) in row.tiered_prices" :key="idx" class="grid grid-cols-3 gap-2">
            <Input v-model.number="tp.quantity_from" type="number" min="0" />
            <Input v-model.number="tp.quantity_to" type="number" min="0" />
            <div class="flex gap-2">
              <Input v-model.number="tp.price" type="number" min="0" />
              <Button variant="ghost" size="sm" @click="removeTierPrice(rowIndex, idx)">{{ t('common.delete') }}</Button>
            </div>
          </div>
        </div>
      </div>

      <Button variant="outline" class="w-full" @click="addVariationRow">
        <Plus class="size-4 mr-1" />
        {{ t('products_variations.add_variation') }}
      </Button>
    </div>

    <div v-if="canCreateVariation" class="flex justify-end gap-2">
      <Button variant="outline" as-child><NuxtLink :to="`/products/variations/${productId}`">{{ t('common.cancel') }}</NuxtLink></Button>
      <Button class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" :disabled="submitting" @click="createVariations">
        <Loader2 v-if="submitting" class="size-4 animate-spin mr-1" />
        {{ submitting ? t('common.saving') : t('common.save') }}
      </Button>
    </div>
  </div>
</template>
