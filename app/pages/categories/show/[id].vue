<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, ShieldAlert, Calendar, Pencil, Tag, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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

const { t, locale } = useI18n()

// ── Types ──────────────────────────────────────────────────────────────────────

interface CategoryAuthor {
  id: number
  name: string
  email?: string
}

interface ParentCategory {
  id: number
  name_ar: string
  name_en: string
}

interface CategoryDetail {
  id: number
  name_ar: string
  name_en: string
  description?: string | null
  status: string
  parent?: ParentCategory | null
  parent_id?: number | null
  created_by?: CategoryAuthor | number | null
  updated_by?: CategoryAuthor | number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface CategoryShowResponse {
  status?: string
  status_code?: number
  data?: {
    category?: CategoryDetail
    warning?: string | boolean | null
  }
  category?: CategoryDetail
  message?: string | null
}

// ── Route & API ────────────────────────────────────────────────────────────────

const route = useRoute()
const categoryId = route.params.id as string
const { $api } = useApi()

const { canAccess, canEdit: cEdit, canDelete: cDelete } = usePermissions()
const canView = computed(() => canAccess('categories'))
const canEdit = computed(() => cEdit('categories'))
const canDelete = computed(() => cDelete('categories'))

const showDeleteDialog = ref(false)
const deleting = ref(false)

// ── State ──────────────────────────────────────────────────────────────────────

const category = ref<CategoryDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')

// ── Helpers ────────────────────────────────────────────────────────────────────

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

const authorDisplay = (value?: CategoryAuthor | number | null) => {
  if (!value) return '—'
  if (typeof value === 'number') return `#${value}`
  return value.name || `#${value.id}`
}

const parentLabel = (cat: CategoryDetail) => {
  if (!cat.parent && !cat.parent_id) return '—'
  if (cat.parent) return cat.parent.name_ar || cat.parent.name_en || `#${cat.parent.id}`
  return `#${cat.parent_id}`
}

const statusConfig = (status: string) => {
  switch (status) {
    case 'active':
      return { label: t('common.active'), class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' }
    case 'inactive':
      return { label: t('common.inactive'), class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' }
    case 'deleted':
      return { label: t('common.deleted'), class: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' }
    default:
      return { label: status || '—', class: 'bg-muted text-muted-foreground' }
  }
}

// ── Data loading ───────────────────────────────────────────────────────────────

const loadCategory = async () => {
  loading.value = true
  errorMessage.value = ''
  category.value = null

  try {
    const res = await $api<CategoryShowResponse>(`/categories/${categoryId}`)
    const data = res.data?.category ?? res.category ?? null
    if (!data || typeof data !== 'object' || !('id' in data)) {
      errorMessage.value = t('categories_show.not_found')
      return
    }
    category.value = data as CategoryDetail
  }
  catch (error: unknown) {
    const msg = (error as { data?: { message?: string | { ar?: string } } })?.data?.message
    errorMessage.value =
      typeof msg === 'string'
        ? msg
        : (msg as { ar?: string } | undefined)?.ar
        ?? t('categories_show.load_error')
  }
  finally {
    loading.value = false
  }
}

const confirmDeleteCategory = async () => {
  if (!category.value) return
  deleting.value = true
  try {
    await $api(`/categories/${category.value.id}`, { method: 'DELETE' })
    toast.success(t('categories_page.delete_success', { name: category.value.name_ar }))
    showDeleteDialog.value = false
    await navigateTo('/categories')
  }
  catch (error: unknown) {
    const msg = (error as { data?: { message?: string | { ar?: string } } })?.data?.message
    const text =
      typeof msg === 'string'
        ? msg
        : (msg as { ar?: string } | undefined)?.ar
        ?? t('categories_page.delete_error')
    toast.error(text)
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  if (canView.value) loadCategory()
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" as-child>
          <NuxtLink to="/categories">
            <ArrowRight class="size-4" />
          </NuxtLink>
        </Button>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ t('categories_show.title') }}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ t('categories_show.subtitle') }}
          </p>
        </div>
      </div>
      <div v-if="category && (canEdit || canDelete)" class="flex flex-wrap gap-2">
        <Button v-if="canEdit" variant="outline" size="sm" class="gap-2" as-child>
          <NuxtLink :to="`/categories/edit/${category.id}`">
            <Pencil class="size-4" />
            {{ t('categories_show.edit_category') }}
          </NuxtLink>
        </Button>
        <Button
          v-if="canDelete && category.status !== 'deleted'"
          variant="outline"
          size="sm"
          class="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          @click="showDeleteDialog = true"
        >
          <Trash2 class="size-4" />
          {{ t('common.delete') }}
        </Button>
      </div>
    </div>

    <!-- No permission -->
    <div
      v-if="!canView"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('categories_show.no_view_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/categories">{{ t('categories_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <!-- Loading -->
      <div
        v-if="loading"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('categories_show.loading') }}
      </div>

      <!-- Error -->
      <div
        v-else-if="errorMessage"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <span>{{ errorMessage }}</span>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadCategory">
            {{ t('categories_show.retry') }}
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/categories">{{ t('categories_show.back') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <!-- Content -->
      <template v-else-if="category">
        <!-- Basic Info -->
        <div class="rounded-lg border overflow-hidden">
          <div class="bg-muted/40 px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Tag class="size-4" />
              {{ t('categories_show.basic_info') }}
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.name_ar') }}</p>
                <p class="font-medium" dir="rtl">{{ category.name_ar || t('categories_show.none') }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.name_en') }}</p>
                <p class="font-medium" dir="ltr">{{ category.name_en || t('categories_show.none') }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.parent') }}</p>
                <p class="text-sm font-medium">{{ parentLabel(category) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.status') }}</p>
                <span
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  :class="statusConfig(category.status).class"
                >
                  {{ statusConfig(category.status).label }}
                </span>
              </div>
              <div v-if="category.description" class="space-y-1 md:col-span-2">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.description') }}</p>
                <p class="text-sm leading-relaxed">{{ category.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Audit Info -->
        <div class="rounded-lg border overflow-hidden">
          <div class="bg-muted/40 px-4 py-3 border-b">
            <h2 class="font-semibold flex items-center gap-2">
              <Calendar class="size-4" />
              {{ t('categories_show.audit_info') }}
            </h2>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.added_by') }}</p>
                <p class="text-sm font-medium">{{ authorDisplay(category.created_by) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.updated_by') }}</p>
                <p class="text-sm font-medium">{{ authorDisplay(category.updated_by) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.created_at') }}</p>
                <p class="text-sm">{{ formatDate(category.created_at) }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.updated_at') }}</p>
                <p class="text-sm">{{ formatDate(category.updated_at) }}</p>
              </div>
              <div v-if="category.deleted_at" class="space-y-1 md:col-span-2">
                <p class="text-xs text-muted-foreground">{{ t('categories_show.deleted_at') }}</p>
                <p class="text-sm text-red-600">{{ formatDate(category.deleted_at) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <Button variant="outline" as-child>
            <NuxtLink to="/categories">{{ t('categories_show.back') }}</NuxtLink>
          </Button>
        </div>
      </template>
    </template>

    <AlertDialog :open="showDeleteDialog" @update:open="v => (showDeleteDialog = v)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('categories_page.delete_dialog_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('categories_page.delete_dialog_body', { name: category?.name_ar ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel as-child>
            <Button variant="outline">{{ t('common.cancel') }}</Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="deleting"
            @click="confirmDeleteCategory"
          >
            {{ t('categories_page.confirm_yes_delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
