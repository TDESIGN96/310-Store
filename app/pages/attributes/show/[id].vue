<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { $api } = useApi()

interface AttributeValue {
  id: number
  attribute_id: number
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface AttributeItem {
  id: number
  name: string
  products_count: number
  values: AttributeValue[]
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface AttributeShowResponse {
  status?: string
  status_code?: number
  data?: AttributeItem
  message?: string | null
}

const route = useRoute()
const attributeId = String(route.params.id)

const attribute = ref<AttributeItem | null>(null)
const loading = ref(false)
const { loadError, clearLoadError, setLoadErrorFromException, setLoadErrorNotFound } = useResourceListLoadError(
  'attributes_show',
  'error',
)

const loadAttribute = async () => {
  loading.value = true
  clearLoadError()
  attribute.value = null
  try {
    const res = await $api<AttributeShowResponse>(`/attributes/${attributeId}`)
    const data = res.data
    if (!data || typeof data !== 'object' || !('id' in data)) {
      setLoadErrorNotFound()
      return
    }
    attribute.value = data as AttributeItem
  }
  catch (error: unknown) {
    setLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAttribute()
})
</script>

<template>
  <div class="mx-auto w-full  flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/attributes">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('attributes_show.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ t('attributes_show.subtitle') }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
    >
      <Loader2 class="size-5 animate-spin" />
      {{ t('attributes_show.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium text-center">{{ loadError.title }}</p>
      <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
        {{ loadError.detail }}
      </p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="loadAttribute">
          {{ t('common.retry') }}
        </Button>
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink to="/attributes">{{ t('attributes_show.back') }}</NuxtLink>
        </Button>
      </div>
    </div>

    <template v-else-if="attribute">
      <div class="rounded-lg border p-6 space-y-3">
        <h2 class="text-3xl font-bold">{{ attribute.name || '—' }}</h2>
        <Badge variant="secondary" class="w-fit">
          {{ t('attributes_show.linked_products', { count: attribute.products_count ?? 0 }) }}
        </Badge>
      </div>

      <div class="space-y-3">
        <h3 class="text-xl font-semibold">{{ t('attributes_show.values_title') }}</h3>
        <div class="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="rtl:text-right font-medium">{{ t('attributes_show.col_sort_order') }}</TableHead>
                <TableHead class="rtl:text-right font-medium">{{ t('attributes_show.col_name') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="!attribute.values?.length">
                <TableCell :colspan="2" class="py-12 text-center text-sm text-muted-foreground">
                  {{ t('attributes_show.no_values') }}
                </TableCell>
              </TableRow>

              <TableRow
                v-for="value in attribute.values || []"
                :key="value.id"
                class="hover:bg-muted/30 transition-colors"
              >
                <TableCell class="w-[140px]">
                  <Input :model-value="String(value.sort_order ?? 0)" disabled class="h-8 max-w-[110px]" />
                </TableCell>
                <TableCell class="font-medium">{{ value.name || '—' }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>
  </div>
</template>
