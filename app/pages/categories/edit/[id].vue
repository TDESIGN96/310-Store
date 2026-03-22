<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Loader2, Check, ChevronDown, AlertCircle, Tag, ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'vue-sonner'
import { fetchAllCategoriesPages, type CategoriesApi } from '@/utils/categoryList'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()

// ── Types ──────────────────────────────────────────────────────────────────────

interface CategoryItem {
  id: number
  name_ar: string
  name_en: string
  status: string
  parent_id?: number | null
}

interface CategoryDetail extends CategoryItem {
  description?: string | null
  parent?: { id: number; name_ar: string; name_en: string } | null
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

interface CategoryListResponse {
  categories?: CategoryItem[]
  data?: { categories?: CategoryItem[] }
  status?: string
  status_code?: number
}

// ── Route & Auth ───────────────────────────────────────────────────────────────

const route = useRoute()
const categoryId = Number(route.params.id)
const { $api } = useApi()
const authStore = useAuthStore()

const canEdit = authStore.hasPermission('categories.update')

// ── Form State ─────────────────────────────────────────────────────────────────

const nameAr = ref('')
const nameEn = ref('')
const parentId = ref<number | null>(null)
const description = ref('')
const status = ref<'active' | 'inactive'>('active')

const submitting = ref(false)
const errorMessage = ref('')

const fieldErrors = ref({
  name_ar: '',
  name_en: '',
  parent_id: '',
  description: '',
  status: '',
})

// ── Category Loading ───────────────────────────────────────────────────────────

const categoryLoading = ref(false)
const categoryError = ref('')

const loadCategoryData = async () => {
  categoryLoading.value = true
  categoryError.value = ''

  try {
    const res = await $api<CategoryShowResponse>(`/categories/${categoryId}`)
    const data = res.data?.category ?? res.category ?? null
    if (!data || typeof data !== 'object' || !('id' in data)) {
      categoryError.value = t('categories_form.category_not_found')
      return
    }
    nameAr.value = data.name_ar ?? ''
    nameEn.value = data.name_en ?? ''
    description.value = data.description ?? ''
    status.value = data.status === 'inactive' ? 'inactive' : 'active'
    parentId.value = data.parent_id ?? null
  }
  catch (error: unknown) {
    categoryError.value = getErrorMessage(error)
  }
  finally {
    categoryLoading.value = false
  }
}

// ── All Categories (parent dropdown + descendant detection) ────────────────────

const allCategories = ref<CategoryItem[]>([])
const loadingParents = ref(false)
const parentSearchQuery = ref('')
const parentPopoverOpen = ref(false)

const loadAllCategories = async () => {
  loadingParents.value = true
  try {
    const list = await fetchAllCategoriesPages<CategoryItem>($api as CategoriesApi)

    allCategories.value = list
  }
  catch {
    allCategories.value = []
  }
  finally {
    loadingParents.value = false
  }
}

// ── Circular-reference prevention ──────────────────────────────────────────────

// Collect all descendant IDs of the current category using the flat parent_id list
const descendantIds = computed((): Set<number> => {
  const result = new Set<number>()
  if (!categoryId) return result
  const queue = [categoryId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const cat of allCategories.value) {
      if (cat.parent_id === current && !result.has(cat.id)) {
        result.add(cat.id)
        queue.push(cat.id)
      }
    }
  }
  return result
})

// Valid parent candidates: active, not self, not any descendant
const validParentCategories = computed(() =>
  allCategories.value.filter(
    c => c.status === 'active' && c.id !== categoryId && !descendantIds.value.has(c.id),
  ),
)

const filteredParentCategories = computed(() => {
  const q = parentSearchQuery.value.trim().toLowerCase()
  if (!q) return validParentCategories.value
  return validParentCategories.value.filter(
    c =>
      c.name_ar?.toLowerCase().includes(q) ||
      c.name_en?.toLowerCase().includes(q),
  )
})

const selectedParentLabel = computed(() => {
  if (parentId.value === null) return ''
  const found = allCategories.value.find(c => c.id === parentId.value)
  return found ? (found.name_ar || found.name_en) : ''
})

const selectParent = (id: number | null) => {
  parentId.value = id
  fieldErrors.value.parent_id = ''
  parentPopoverOpen.value = false
  parentSearchQuery.value = ''
}

// ── Regexes ────────────────────────────────────────────────────────────────────

// Arabic letters, diacritics (tashkeel), and spaces
const ARABIC_RE = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+$/
const ENGLISH_RE = /^[A-Za-z\s]+$/

// ── Description ────────────────────────────────────────────────────────────────

const descriptionLength = computed(() => description.value.length)
const descriptionOverLimit = computed(() => descriptionLength.value > 500)

// ── Sync Validation (format / required / parent safety) ────────────────────────

const validateLocal = (): boolean => {
  fieldErrors.value = { name_ar: '', name_en: '', parent_id: '', description: '', status: '' }

  if (!nameAr.value.trim()) {
    fieldErrors.value.name_ar = t('categories_form.validation_name_ar_required')
  }
  else if (!ARABIC_RE.test(nameAr.value.trim())) {
    fieldErrors.value.name_ar = t('categories_form.validation_name_ar_letters')
  }

  if (!nameEn.value.trim()) {
    fieldErrors.value.name_en = t('categories_form.validation_name_en_required')
  }
  else if (!ENGLISH_RE.test(nameEn.value.trim())) {
    fieldErrors.value.name_en = t('categories_form.validation_name_en_letters')
  }

  if (descriptionOverLimit.value) {
    fieldErrors.value.description = t('categories_form.validation_description_max', { count: descriptionLength.value })
  }

  if (parentId.value !== null) {
    if (parentId.value === categoryId) {
      fieldErrors.value.parent_id = t('categories_form.validation_parent_self')
    }
    else if (descendantIds.value.has(parentId.value)) {
      fieldErrors.value.parent_id = t('categories_form.validation_parent_cycle')
    }
    else {
      const parent = allCategories.value.find(c => c.id === parentId.value)
      if (!parent) {
        fieldErrors.value.parent_id = t('categories_form.validation_parent_missing')
      }
      else if (parent.status !== 'active') {
        fieldErrors.value.parent_id = t('categories_form.validation_parent_inactive')
      }
    }
  }

  return !Object.values(fieldErrors.value).some(Boolean)
}

// ── Uniqueness Check — excludes current category id ───────────────────────────

const checkNameUnique = async (field: 'name_ar' | 'name_en', value: string): Promise<boolean> => {
  try {
    const list = await fetchAllCategoriesPages<CategoryItem>($api as CategoriesApi, {
      search: value,
      name: value,
    })
    const duplicate = list.find(c => {
      if (c.id === categoryId) return false
      if (field === 'name_ar') return c.name_ar?.trim() === value
      return c.name_en?.trim().toLowerCase() === value.toLowerCase()
    })
    return !duplicate
  }
  catch {
    return true
  }
}

// ── Submit ─────────────────────────────────────────────────────────────────────

const updateCategory = async () => {
  errorMessage.value = ''

  // Re-sync categories before submit to validate parent safely.
  if (parentId.value !== null) {
    await loadAllCategories()
  }

  // Step 1: local format / required / parent safety checks
  if (!validateLocal()) return

  submitting.value = true
  try {
    // Step 2: uniqueness checks (both names in parallel, self excluded)
    const [arUnique, enUnique] = await Promise.all([
      checkNameUnique('name_ar', nameAr.value.trim()),
      checkNameUnique('name_en', nameEn.value.trim()),
    ])

    if (!arUnique) fieldErrors.value.name_ar = t('categories_form.validation_duplicate_ar')
    if (!enUnique) fieldErrors.value.name_en = t('categories_form.validation_duplicate_en')

    if (!arUnique || !enUnique) {
      submitting.value = false
      return
    }

    // Step 3: full-body PUT (API requires all fields on every update)
    const body: Record<string, unknown> = {
      name_ar: nameAr.value.trim(),
      name_en: nameEn.value.trim(),
      status: status.value,
    }
    body.parent_id = parentId.value
    if (description.value.trim()) body.description = description.value.trim()

    await $api(`/categories/${categoryId}`, { method: 'PUT', body })
    toast.success(t('toasts.save_success'))
    await navigateTo('/categories')
  }
  catch (error: unknown) {
    if (isValidationError(error)) {
      const fe = getFieldErrors(error)
      fieldErrors.value.name_ar = fe.name_ar ?? ''
      fieldErrors.value.name_en = fe.name_en ?? ''
      fieldErrors.value.parent_id = fe.parent_id ?? ''
      fieldErrors.value.description = fe.description ?? ''
      fieldErrors.value.status = fe.status ?? ''
    }
    else {
      errorMessage.value = getErrorMessage(error)
    }
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!canEdit) return
  await Promise.all([loadCategoryData(), loadAllCategories()])
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/categories">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('categories_form.edit_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('categories_form.edit_subtitle') }}
        </p>
      </div>
    </div>

    <!-- No permission -->
    <div
      v-if="!canEdit"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('categories_form.no_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/categories">{{ t('categories_show.back') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <!-- Loading -->
      <div
        v-if="categoryLoading"
        class="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm"
      >
        <Loader2 class="size-5 animate-spin" />
        {{ t('categories_form.loading_data') }}
      </div>

      <!-- Load Error -->
      <div
        v-else-if="categoryError"
        class="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
      >
        <ShieldAlert class="size-8" />
        <span>{{ categoryError }}</span>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="loadCategoryData">
            {{ t('common.retry') }}
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink to="/categories">{{ t('categories_show.back') }}</NuxtLink>
          </Button>
        </div>
      </div>

      <!-- Form -->
      <template v-else>
        <!-- Main Form Card -->
        <div class="rounded-lg border p-5 space-y-5">
          <div class="flex items-center gap-2 pb-1 border-b">
            <Tag class="size-4 text-muted-foreground" />
            <h2 class="font-semibold text-sm">{{ t('categories_form.section_basic') }}</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <!-- Arabic Name -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('categories_form.name_ar') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="nameAr"
                dir="rtl"
                :placeholder="t('categories_form.placeholder_name_ar')"
                :class="fieldErrors.name_ar ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="fieldErrors.name_ar = ''"
              />
              <p v-if="fieldErrors.name_ar" class="text-xs text-red-500">
                {{ fieldErrors.name_ar }}
              </p>
              <p v-else class="text-xs text-muted-foreground">
                {{ t('categories_form.name_ar_hint') }}
              </p>
            </div>

            <!-- English Name -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('categories_form.name_en') }} <span class="text-red-500">*</span>
              </label>
              <Input
                v-model="nameEn"
                dir="ltr"
                :placeholder="t('categories_form.placeholder_name_en')"
                :class="fieldErrors.name_en ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="fieldErrors.name_en = ''"
              />
              <p v-if="fieldErrors.name_en" class="text-xs text-red-500">
                {{ fieldErrors.name_en }}
              </p>
              <p v-else class="text-xs text-muted-foreground">
                {{ t('categories_form.name_en_hint') }}
              </p>
            </div>

            <!-- Parent Category -->
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('categories_form.parent') }}</label>
              <Popover v-model:open="parentPopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    role="combobox"
                    class="w-full justify-between font-normal h-9"
                    :class="fieldErrors.parent_id ? 'border-red-500' : ''"
                  >
                    <span class="truncate text-sm">
                      <span v-if="loadingParents" class="text-muted-foreground">{{ t('categories_form.parent_loading') }}</span>
                      <span v-else-if="selectedParentLabel" class="text-foreground">{{ selectedParentLabel }}</span>
                      <span v-else class="text-muted-foreground">{{ t('categories_form.parent_placeholder') }}</span>
                    </span>
                    <ChevronDown class="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  class="w-[var(--reka-popover-trigger-width)] p-0 overflow-hidden"
                  align="start"
                  side="bottom"
                >
                  <!-- Search -->
                  <div class="border-b p-2">
                    <input
                      v-model="parentSearchQuery"
                      type="text"
                      :placeholder="t('categories_form.parent_search')"
                      class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      dir="rtl"
                    />
                  </div>

                  <div class="max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      class="flex items-center w-full px-4 py-2.5 text-right text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                      @click="selectParent(null)"
                    >
                      {{ t('categories_form.parent_none') }}
                    </button>

                    <div v-if="loadingParents" class="p-4 text-sm text-muted-foreground text-center">
                      {{ t('categories_form.parent_loading_list') }}
                    </div>
                    <div
                      v-else-if="filteredParentCategories.length === 0"
                      class="p-4 text-sm text-muted-foreground text-center"
                    >
                      {{ t('categories_form.parent_empty') }}
                    </div>
                    <button
                      v-for="cat in filteredParentCategories"
                      v-else
                      :key="cat.id"
                      type="button"
                      class="flex items-center justify-between w-full px-4 py-2.5 text-right text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                      :class="parentId === cat.id ? 'bg-primary/10 text-primary font-medium' : ''"
                      @click="selectParent(cat.id)"
                    >
                      <span>{{ cat.name_ar || cat.name_en }}</span>
                      <Check v-if="parentId === cat.id" class="size-3.5 shrink-0" />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
              <p v-if="fieldErrors.parent_id" class="text-xs text-red-500">
                {{ fieldErrors.parent_id }}
              </p>
              <p v-else class="text-xs text-muted-foreground">
                {{ t('categories_form.parent_exclude_hint') }}
              </p>
            </div>

            <!-- Status -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('categories_form.status') }} <span class="text-red-500">*</span>
              </label>
              <Select
                :model-value="status"
                @update:model-value="val => { status = (val as 'active' | 'inactive'); fieldErrors.status = '' }"
              >
                <SelectTrigger :class="fieldErrors.status ? 'border-red-500 focus-visible:ring-red-500' : ''">
                  <SelectValue :placeholder="t('units_form.select_status')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{{ t('common.active') }}</SelectItem>
                  <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="fieldErrors.status" class="text-xs text-red-500">
                {{ fieldErrors.status }}
              </p>
            </div>

            <!-- Description (full width) -->
            <div class="space-y-2 md:col-span-2">
              <label class="text-sm font-medium flex items-center justify-between">
                <span>{{ t('categories_form.description') }}</span>
                <span
                  class="text-xs font-normal"
                  :class="descriptionOverLimit ? 'text-red-500' : 'text-muted-foreground'"
                >
                  {{ descriptionLength }} / 500
                </span>
              </label>
              <textarea
                v-model="description"
                dir="rtl"
                rows="4"
                :placeholder="t('categories_form.description_placeholder')"
                class="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none placeholder:text-muted-foreground dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                :class="fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''"
                @input="fieldErrors.description = ''"
              />
              <p v-if="fieldErrors.description" class="text-xs text-red-500">
                {{ fieldErrors.description }}
              </p>
              <p v-else class="text-xs text-muted-foreground">
                {{ t('categories_form.description_hint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Global Error Banner -->
        <div
          v-if="errorMessage"
          class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
        >
          <AlertCircle class="size-4 shrink-0 mt-0.5" />
          <span>{{ errorMessage }}</span>
        </div>

        <Separator />

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2">
          <Button variant="outline" :disabled="submitting" as-child>
            <NuxtLink to="/categories">{{ t('common.cancel') }}</NuxtLink>
          </Button>
          <Button
            class="bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]"
            :disabled="submitting"
            @click="updateCategory"
          >
            <Loader2 v-if="submitting" class="size-4 animate-spin ml-2" />
            {{ submitting ? t('common.saving') : t('categories_form.submit_save') }}
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
