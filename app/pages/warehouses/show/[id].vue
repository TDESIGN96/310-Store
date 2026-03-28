<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Building2, Pencil, Calendar } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()

interface WarehouseManager {
  id: number
  name?: string
  email?: string
}

interface WarehouseDetail {
  id: number
  name_ar: string
  name_en: string
  location: string
  address?: string | null
  status: string
  manager?: WarehouseManager | null
  created_at?: string
  updated_at?: string
}

interface WarehouseShowResponse {
  warehouse?: WarehouseDetail
  data?: WarehouseDetail | { warehouse?: WarehouseDetail }
  status?: string
  status_code?: number
  message?: string | null
}

const route = useRoute()
const warehouseId = route.params.id as string
const { $api } = useApi()

const { canAccess, canEdit } = usePermissions()
const canView = computed(() => canAccess('warehouses'))
const canEditWarehouse = computed(() => canEdit('warehouses'))

const warehouse = ref<WarehouseDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const parseWarehouse = (res: WarehouseShowResponse): WarehouseDetail | null => {
  const raw = res.data
  const w = (
    res.warehouse
    ?? (raw && typeof raw === 'object' && 'warehouse' in raw
      ? (raw as { warehouse?: WarehouseDetail }).warehouse
      : undefined)
    ?? (raw && typeof raw === 'object' && 'id' in raw && 'name_ar' in raw
      ? (raw as WarehouseDetail)
      : undefined)
    ?? null
  )
  return w
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  try {
    const loc = locale.value === 'ar' ? 'ar-EG' : 'en-US'
    return new Date(dateStr).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return dateStr
  }
}

const statusConfig = (status: string) => {
  const s = String(status).toLowerCase()
  if (s === 'active') {
    return {
      label: t('common.active'),
      class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    }
  }
  if (s === 'inactive') {
    return {
      label: t('common.inactive'),
      class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    }
  }
  return { label: status || '—', class: 'bg-muted text-muted-foreground' }
}

const loadWarehouse = async () => {
  loading.value = true
  errorMessage.value = ''
  warehouse.value = null

  try {
    const res = await $api<WarehouseShowResponse>(`/warehouses/${warehouseId}`)
    const w = parseWarehouse(res)
    if (!w) {
      errorMessage.value = t('warehouses_show.not_found')
      return
    }
    warehouse.value = w
  }
  catch (error: unknown) {
    const msg = (error as { data?: { message?: string | { ar?: string } } })?.data?.message
    errorMessage.value =
      typeof msg === 'string'
        ? msg
        : (msg as { ar?: string } | undefined)?.ar
        ?? t('warehouses_show.load_error')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  if (canView.value) loadWarehouse()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/warehouses">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('warehouses_show.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ t('warehouses_show.subtitle') }}
          </p>
        </div>
      </div>
      <Button
        v-if="warehouse && canEditWarehouse"
        variant="outline"
        size="sm"
        class="gap-2"
        as-child
      >
        <NuxtLink :to="`/warehouses/edit/${warehouse.id}`">
          <Pencil class="size-4" />
          {{ t('warehouses_show.edit_warehouse') }}
        </NuxtLink>
      </Button>
    </div>

    <div
      v-if="!canView"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('warehouses_show.no_view_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/warehouses">{{ t('warehouses_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div
        v-if="loading"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('warehouses_show.loading') }}
      </div>

      <div
        v-else-if="errorMessage"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <span>{{ errorMessage }}</span>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadWarehouse">
            {{ t('warehouses_show.retry') }}
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/warehouses">{{ t('warehouses_show.back') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <template v-else-if="warehouse">
        <div class="rounded-lg border overflow-hidden">
          <div class="bg-muted/40 px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Building2 class="size-4" />
              {{ t('warehouses_show.basic_info') }}
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('warehouses_show.name_ar') }}</p>
                <p class="font-medium" dir="rtl">{{ warehouse.name_ar || t('warehouses_show.none') }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('warehouses_show.name_en') }}</p>
                <p class="font-medium" dir="ltr">{{ warehouse.name_en || t('warehouses_show.none') }}</p>
              </div>
              <div class="space-y-1 md:col-span-2">
                <p class="text-xs text-muted-foreground">{{ t('warehouses_show.location') }}</p>
                <p class="text-sm font-medium">{{ warehouse.location || t('warehouses_show.none') }}</p>
              </div>
              <div class="space-y-1 md:col-span-2">
                <p class="text-xs text-muted-foreground">{{ t('warehouses_show.address') }}</p>
                <p class="text-sm">{{ warehouse.address?.trim() || t('warehouses_show.none') }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('warehouses_show.manager') }}</p>
                <p class="text-sm font-medium">
                  {{ warehouse.manager?.name || '—' }}
                  <span v-if="warehouse.manager?.email" class="text-muted-foreground">
                    ({{ warehouse.manager.email }})
                  </span>
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('warehouses_show.status') }}</p>
                <span
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  :class="statusConfig(warehouse.status).class"
                >
                  {{ statusConfig(warehouse.status).label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="warehouse.created_at || warehouse.updated_at"
          class="rounded-lg border overflow-hidden"
        >
          <div class="bg-muted/40 px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Calendar class="size-4" />
              {{ t('warehouses_show.audit_info') }}
            </h2>
          </div>
          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-if="warehouse.created_at" class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('common.created_at') }}</p>
              <p class="text-sm font-medium">{{ formatDate(warehouse.created_at) }}</p>
            </div>
            <div v-if="warehouse.updated_at" class="space-y-1">
              <p class="text-xs text-muted-foreground">{{ t('common.updated_at') }}</p>
              <p class="text-sm font-medium">{{ formatDate(warehouse.updated_at) }}</p>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
