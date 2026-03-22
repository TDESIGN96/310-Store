<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Calendar, Pencil, Ruler } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

interface UnitAuthor {
  id: number
  name: string
  email?: string
}

interface UnitDetail {
  id: number
  name_ar: string
  name_en: string
  symbol: string
  status: string
  created_by?: UnitAuthor | number | null
  updated_by?: UnitAuthor | number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface UnitShowResponse {
  status?: string
  status_code?: number
  data?: UnitDetail
  message?: string | null
}

const route = useRoute()
const unitId = route.params.id as string
const { $api } = useApi()
const authStore = useAuthStore()

const canView = authStore.hasPermission('units.show')
const canEdit = authStore.hasPermission('units.update')

const unit = ref<UnitDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ar-EG', {
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

const authorDisplay = (value?: UnitAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const statusConfig = (status: string) => {
  switch (status) {
    case 'active':
      return { label: 'نشط', class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' }
    case 'inactive':
      return { label: 'غير نشط', class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' }
    case 'deleted':
      return { label: 'محذوف', class: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' }
    default:
      return { label: status || '—', class: 'bg-muted text-muted-foreground' }
  }
}

const loadUnit = async () => {
  loading.value = true
  errorMessage.value = ''
  unit.value = null

  try {
    const res = await $api<UnitShowResponse>(`/units/${unitId}`)
    const data = res.data
    if (!data || typeof data !== 'object' || !('id' in data)) {
      errorMessage.value = 'لم يتم العثور على الوحدة'
      return
    }
    unit.value = data as UnitDetail
  }
  catch (error: unknown) {
    const msg = (error as { data?: { message?: string | { ar?: string } } })?.data?.message
    errorMessage.value =
      typeof msg === 'string'
        ? msg
        : (msg as { ar?: string } | undefined)?.ar
        ?? 'تعذر تحميل بيانات الوحدة'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  if (canView) loadUnit()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/units">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">عرض الوحدة</h1>
          <p class="text-sm text-muted-foreground mt-1">
            تفاصيل وحدة القياس
          </p>
        </div>
      </div>
      <div v-if="unit && canEdit" class="flex gap-2">
        <Button variant="outline" size="sm" class="gap-2" as-child>
          <NuxtLink :to="`/units/edit/${unit.id}`">
            <Pencil class="size-4" />
            تعديل الوحدة
          </NuxtLink>
        </Button>
      </div>
    </div>

    <!-- No view permission -->
    <div
      v-if="!canView"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">ليس لديك صلاحية لعرض تفاصيل الوحدة</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/units">العودة إلى القائمة</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <!-- Loading -->
      <div
        v-if="loading"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        جاري تحميل البيانات...
      </div>

      <!-- Error -->
      <div
        v-else-if="errorMessage"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <span>{{ errorMessage }}</span>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadUnit">
            إعادة المحاولة
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/units">العودة إلى القائمة</NuxtLink>
          </Button>
        </div>
      </div>

      <!-- Content -->
      <template v-else-if="unit">
        <!-- Basic info -->
        <div class="rounded-lg border overflow-hidden">
          <div class="bg-muted/40 px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Ruler class="size-4" />
              المعلومات الأساسية
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">الاسم العربي</p>
                <p class="font-medium" dir="rtl">{{ unit.name_ar || '—' }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">الاسم الإنجليزي</p>
                <p class="font-medium" dir="ltr">{{ unit.name_en || '—' }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">الرمز</p>
                <span class="inline-flex items-center justify-center rounded bg-muted px-2 py-0.5 text-sm font-mono font-medium">
                  {{ unit.symbol || '—' }}
                </span>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">الحالة</p>
                <span
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  :class="statusConfig(unit.status).class"
                >
                  {{ statusConfig(unit.status).label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Audit -->
        <div class="rounded-lg border overflow-hidden">
          <div class="bg-muted/40 px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Calendar class="size-4" />
              معلومات التدقيق
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">أُضيف بواسطة</p>
                <p class="text-sm font-medium">{{ authorDisplay(unit.created_by) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">آخر تعديل بواسطة</p>
                <p class="text-sm font-medium">{{ authorDisplay(unit.updated_by) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">تاريخ الإنشاء</p>
                <p class="text-sm">{{ formatDate(unit.created_at) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">آخر تحديث</p>
                <p class="text-sm">{{ formatDate(unit.updated_at) }}</p>
              </div>
              <div v-if="unit.deleted_at" class="space-y-1 md:col-span-2">
                <p class="text-xs text-muted-foreground">تاريخ الحذف</p>
                <p class="text-sm text-red-600">{{ formatDate(unit.deleted_at) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <Button variant="outline" as-child>
            <NuxtLink to="/units">العودة إلى القائمة</NuxtLink>
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
