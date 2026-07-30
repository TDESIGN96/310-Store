<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, ClipboardList, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDamageRecordsStore, type DispositionAction } from '@/stores/damageRecords'
import { normalizeBackendFieldErrors } from '@/composables/useBackendFieldErrors'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { t } = useI18n()
const { can } = usePermissions()
const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()
const damageStore = useDamageRecordsStore()

const canDisposition = computed(() => can('damage.disposition'))

const DISPOSITION_ACTIONS: { value: DispositionAction; labelKey: string }[] = [
  { value: 'discard', labelKey: 'damage_records_page.disposition_action_discard' },
  { value: 'return_to_supplier', labelKey: 'damage_records_page.disposition_action_return_to_supplier' },
  { value: 'sell_at_discount', labelKey: 'damage_records_page.disposition_action_sell_at_discount' },
  { value: 'other', labelKey: 'damage_records_page.disposition_action_other' },
]

// ─── Page state ───────────────────────────────────────────────────────────────
const pageLoading = ref(true)
const blocked = ref(false)
const record = ref<Awaited<ReturnType<typeof damageStore.loadById>>>(null)
const errorMessage = ref('')

const isEditMode = computed(() => Boolean(record.value?.disposition))

// ─── Form state ───────────────────────────────────────────────────────────────
const actionTaken = ref<DispositionAction | ''>('')
const specifyAction = ref('')
const notes = ref('')
const formErrors = ref<Record<string, string>>({})
const submitting = ref(false)

// ─── Computed ─────────────────────────────────────────────────────────────────
const pageTitle = computed(() =>
  isEditMode.value
    ? t('damage_records_page.disposition_edit_title')
    : t('damage_records_page.disposition_title'),
)

// ─── Validation ───────────────────────────────────────────────────────────────
const validate = (): boolean => {
  const errors: Record<string, string> = {}

  if (!actionTaken.value) {
    errors.action_taken = t('damage_records_page.validation_action_taken_required')
  }

  if (actionTaken.value === 'other') {
    if (!specifyAction.value.trim()) {
      errors.specify_action = t('damage_records_page.validation_specify_action_required')
    }
    else if (specifyAction.value.trim().length > 150) {
      errors.specify_action = t('damage_records_page.validation_specify_action_max')
    }
  }

  if (notes.value.trim().length > 500) {
    errors.notes = t('damage_records_page.validation_disposition_notes_max')
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// ─── Submit ───────────────────────────────────────────────────────────────────
const submit = async () => {
  if (blocked.value || !validate()) return
  submitting.value = true
  errorMessage.value = ''

  try {
    const payload = {
      action_taken: actionTaken.value as DispositionAction,
      action_taken_specified: actionTaken.value === 'other' ? specifyAction.value.trim() : null,
      notes: notes.value.trim() || null,
    }

    if (isEditMode.value) {
      await damageStore.updateDisposition(id.value, payload)
      toast.success(t('damage_records_page.disposition_update_success'))
    }
    else {
      await damageStore.createDisposition(id.value, payload)
      toast.success(t('damage_records_page.disposition_create_success'))
    }

    await navigateTo('/damage-records')
  }
  catch (err) {
    if (isValidationError(err)) {
      formErrors.value = { ...formErrors.value, ...normalizeBackendFieldErrors(getFieldErrors(err)) }
    }
    errorMessage.value = getErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  pageLoading.value = true
  errorMessage.value = ''

  if (!canDisposition.value) {
    pageLoading.value = false
    return
  }

  try {
    record.value = await damageStore.loadById(id.value)

    if (!record.value) {
      errorMessage.value = t('damage_records_page.not_found')
      pageLoading.value = false
      return
    }

    if (record.value.status !== 'approved') {
      blocked.value = true
      pageLoading.value = false
      return
    }

    // Hydrate from existing disposition in edit mode
    if (record.value.disposition) {
      actionTaken.value = record.value.disposition.action_taken
      specifyAction.value = record.value.disposition.action_taken_specified ?? ''
      notes.value = record.value.disposition.notes ?? ''
    }
  }
  catch {
    errorMessage.value = t('damage_records_page.load_error')
  }
  finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        class="size-9 shrink-0"
        as-child
      >
        <NuxtLink :to="record ? `/damage-records/show/${record.id}` : '/damage-records'">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ pageTitle }}
          <span
            v-if="record?.reference_id"
            class="text-muted-foreground font-normal text-xl ms-1"
          >#{{ record.reference_id }}</span>
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t('damage_records_page.disposition_subtitle') }}
        </p>
      </div>
    </div>

    <!-- No permission -->
    <div
      v-if="!canDisposition"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('damage_records_page.no_permission') }}
    </div>

    <!-- Page loading -->
    <div
      v-else-if="pageLoading"
      class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <!-- Blocked (not approved) -->
      <div
        v-if="blocked"
        class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <p class="font-semibold mb-1">
          {{ t('damage_records_page.disposition_blocked_title') }}
        </p>
        <p>{{ t('damage_records_page.disposition_blocked_desc') }}</p>
      </div>

      <!-- Load error -->
      <div
        v-else-if="errorMessage && !record"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {{ errorMessage }}
      </div>

      <template v-else-if="record">
        <!-- Record context summary -->
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <CardContent class="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6 sm:py-5">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.reference_id_label') }}
              </p>
              <p class="mt-1 text-sm font-mono font-medium">
                {{ record.reference_id || `#${record.id}` }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.product_label') }}
              </p>
              <p class="mt-1 text-sm">
                {{ record.product_name || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.warehouse_label') }}
              </p>
              <p class="mt-1 text-sm">
                {{ record.warehouse_name || '—' }}
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Submit error -->
        <div
          v-if="errorMessage"
          class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {{ errorMessage }}
        </div>

        <!-- Disposition Form -->
        <Card class="gap-0 overflow-hidden py-0 shadow-sm">
          <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
            <ClipboardList class="size-4 text-white/70" />
            <h2 class="text-base font-semibold">
              {{ t('damage_records_page.section_disposition') }}
            </h2>
          </div>
          <CardContent class="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <!-- Action Taken -->
            <div class="space-y-2">
              <label class="text-sm font-medium">
                {{ t('damage_records_page.col_action_taken') }}
                <span class="text-destructive ms-0.5">*</span>
              </label>
              <Select
                :model-value="actionTaken"
                @update:model-value="(val) => { actionTaken = val as DispositionAction; formErrors.action_taken = '' }"
              >
                <SelectTrigger
                  :aria-invalid="Boolean(formErrors.action_taken)"
                  :class="{ 'border-destructive': formErrors.action_taken }"
                >
                  <SelectValue :placeholder="t('common.select_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in DISPOSITION_ACTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ t(option.labelKey) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p
                v-if="formErrors.action_taken"
                class="text-xs text-destructive"
              >
                {{ formErrors.action_taken }}
              </p>
            </div>

            <!-- Specify Action (only when "other") -->
            <div
              v-if="actionTaken === 'other'"
              class="space-y-2"
            >
              <label class="text-sm font-medium">
                {{ t('damage_records_page.specify_action_label') }}
                <span class="text-destructive ms-0.5">*</span>
              </label>
              <Input
                v-model="specifyAction"
                maxlength="150"
                :placeholder="t('damage_records_page.specify_action_placeholder')"
                :class="{ 'border-destructive': formErrors.specify_action }"
                @input="formErrors.specify_action = ''"
              />
              <p
                v-if="formErrors.specify_action"
                class="text-xs text-destructive"
              >
                {{ formErrors.specify_action }}
              </p>
            </div>

            <!-- Notes -->
            <div class="space-y-2">
              <label class="text-sm font-medium">{{ t('damage_records_page.notes_label') }}</label>
              <textarea
                v-model="notes"
                rows="3"
                maxlength="500"
                class="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                :placeholder="t('damage_records_page.notes_placeholder')"
                :class="{ 'border-destructive': formErrors.notes }"
                @input="formErrors.notes = ''"
              />
              <p
                v-if="formErrors.notes"
                class="text-xs text-destructive"
              >
                {{ formErrors.notes }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <Button
                :disabled="submitting || blocked"
                @click="submit"
              >
                <Loader2
                  v-if="submitting"
                  class="w-4 h-4 me-2 animate-spin"
                />
                <span>{{ t('common.save') }}</span>
              </Button>
              <Button
                variant="outline"
                as-child
              >
                <NuxtLink :to="`/damage-records/show/${record.id}`">
                  {{ t('common.cancel') }}
                </NuxtLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </template>
    </template>
  </div>
</template>
