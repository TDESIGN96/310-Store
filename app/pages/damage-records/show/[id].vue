<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, ClipboardList, FileText, Image, Loader2, Pencil } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDamageRecordsStore } from '@/stores/damageRecords'
import { formatDisplayDate } from '@/utils/formatDisplayDate'
import { formatDisplayNumber } from '@/utils/formatDisplayNumber'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { t, locale } = useI18n()
const { can } = usePermissions()
const { getErrorMessage } = useApiError()
const damageStore = useDamageRecordsStore()

const canViewDamage = computed(() => can('damage.view'))
const canEditDamage = computed(() => can('damage.edit'))
const canApproveDamage = computed(() => can('damage.approve'))
const canCancelDamage = computed(() => can('damage.cancel'))
const canDisposition = computed(() => can('damage.disposition'))

const formatMoney = (value: unknown) => formatDisplayNumber(value, { locale: locale.value })

// ─── Page state ───────────────────────────────────────────────────────────────
const loading = ref(false)
const errorMessage = ref('')
const record = ref<Awaited<ReturnType<typeof damageStore.loadById>>>(null)

// ─── Approve dialog ───────────────────────────────────────────────────────────
const approveOpen = ref(false)
const approveSubmitting = ref(false)
const approveError = ref('')

// ─── Reject dialog ────────────────────────────────────────────────────────────
const rejectOpen = ref(false)
const rejectSubmitting = ref(false)
const rejectReason = ref('')
const rejectError = ref('')

// ─── Cancel dialog ────────────────────────────────────────────────────────────
const cancelOpen = ref(false)
const cancelSubmitting = ref(false)
const cancelReason = ref('')
const cancelError = ref('')

// ─── Helpers ─────────────────────────────────────────────────────────────────
const openPhoto = (url: string) => {
  if (import.meta.client) window.open(url, '_blank')
}

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '—'
  return formatDisplayDate(value)
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
    case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
    case 'cancelled': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700'
    default: return ''
  }
}

// ─── Show actions visibility ──────────────────────────────────────────────────
const showPendingActions = computed(() => record.value?.status === 'pending')
const showDispositionButton = computed(
  () => record.value?.status === 'approved' && !record.value.disposition,
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!canViewDamage.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    record.value = await damageStore.loadById(id.value)
    if (!record.value) errorMessage.value = t('damage_records_page.not_found')
  }
  catch {
    errorMessage.value = t('damage_records_page.load_error')
  }
  finally {
    loading.value = false
  }
})

// ─── Actions ─────────────────────────────────────────────────────────────────
const confirmApprove = async () => {
  approveSubmitting.value = true
  approveError.value = ''
  try {
    await damageStore.approveRecord(id.value)
    approveOpen.value = false
    toast.success(t('damage_records_page.approve_success'))
    await navigateTo('/damage-records')
  }
  catch (err) {
    approveError.value = getErrorMessage(err)
  }
  finally {
    approveSubmitting.value = false
  }
}

const openRejectDialog = () => {
  rejectReason.value = ''
  rejectError.value = ''
  rejectOpen.value = true
}

const confirmReject = async () => {
  rejectError.value = ''
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectError.value = t('damage_records_page.reject_reason_required')
    return
  }
  if (reason.length > 250) {
    rejectError.value = t('damage_records_page.reject_reason_max')
    return
  }
  rejectSubmitting.value = true
  try {
    await damageStore.rejectRecord(id.value, reason)
    rejectOpen.value = false
    toast.success(t('damage_records_page.reject_success'))
    await navigateTo('/damage-records')
  }
  catch (err) {
    rejectError.value = getErrorMessage(err)
  }
  finally {
    rejectSubmitting.value = false
  }
}

const openCancelDialog = () => {
  cancelReason.value = ''
  cancelError.value = ''
  cancelOpen.value = true
}

const confirmCancel = async () => {
  cancelError.value = ''
  const reason = cancelReason.value.trim()
  if (!reason) {
    cancelError.value = t('damage_records_page.cancel_reason_required')
    return
  }
  if (reason.length > 250) {
    cancelError.value = t('damage_records_page.cancel_reason_max')
    return
  }
  cancelSubmitting.value = true
  try {
    await damageStore.cancelRecord(id.value, reason)
    cancelOpen.value = false
    toast.success(t('damage_records_page.cancel_success'))
    await navigateTo('/damage-records')
  }
  catch (err) {
    cancelError.value = getErrorMessage(err)
  }
  finally {
    cancelSubmitting.value = false
  }
}
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
        <NuxtLink to="/damage-records">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ t('damage_records_page.view_title') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t('damage_records_page.view_subtitle', { id: record?.reference_id || id }) }}
        </p>
      </div>
    </div>

    <!-- No permission -->
    <div
      v-if="!canViewDamage"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      {{ t('damage_records_page.no_permission') }}
    </div>

    <!-- Loading -->
    <div
      v-else-if="loading"
      class="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <Loader2 class="mx-auto mb-2 size-6 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <!-- Load error -->
    <div
      v-else-if="errorMessage"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
    >
      {{ errorMessage }}
    </div>

    <template v-else-if="record">
      <!-- Damage Details Card -->
      <Card class="gap-0 overflow-hidden py-0 shadow-sm">
        <div class="flex items-center gap-2 border-b bg-section-details border-section-details text-white px-4 py-3.5 sm:px-6">
          <FileText class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">
            {{ t('damage_records_page.details_section') }}
          </h2>
        </div>
        <CardContent class="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <!-- Record ID -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.reference_id_label') }}
            </p>
            <p class="mt-1 text-sm font-medium font-mono">
              {{ record.reference_id || `#${record.id}` }}
            </p>
          </div>

          <!-- Status -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.col_status') }}
            </p>
            <div class="mt-1">
              <Badge
                variant="outline"
                :class="statusBadgeClass(record.status)"
              >
                {{ record.status_label || record.status }}
              </Badge>
            </div>
          </div>

          <!-- Product -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.product_label') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.product_name || '—' }}
            </p>
          </div>

          <!-- Variation -->
          <div v-if="record.variation_name">
            <p class="text-xs text-muted-foreground">
              {{ t('common.variation') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.variation_name }}
            </p>
          </div>

          <!-- SKU -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.sku_label') }}
            </p>
            <p class="mt-1 text-sm font-mono text-muted-foreground">
              {{ record.sku || '—' }}
            </p>
          </div>

          <!-- Warehouse -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.warehouse_label') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.warehouse_name || '—' }}
            </p>
          </div>

          <!-- Damaged Quantity -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.damaged_qty_label') }}
            </p>
            <p class="mt-1 text-sm font-semibold tabular-nums">
              {{ record.damaged_quantity }}
            </p>
          </div>

          <!-- Estimated Loss -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.estimated_loss_label') }}
            </p>
            <p class="mt-1 text-sm font-semibold tabular-nums">
              {{ formatMoney(record.estimated_loss) }}
            </p>
          </div>

          <!-- Damage Reason -->
          <div :class="record.damage_reason === 'other' ? 'sm:col-span-2' : ''">
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.damage_reason_label') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.damage_reason_label || record.damage_reason }}
            </p>
            <p
              v-if="record.damage_reason === 'other' && record.damage_reason_specified"
              class="mt-1 text-sm text-muted-foreground"
            >
              {{ record.damage_reason_specified }}
            </p>
          </div>

          <!-- Notes -->
          <div
            v-if="record.notes"
            class="sm:col-span-2"
          >
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.notes_label') }}
            </p>
            <p class="mt-1 text-sm whitespace-pre-wrap">
              {{ record.notes }}
            </p>
          </div>

          <!-- Created By -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.col_created_by') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.created_by?.name || '—' }}
            </p>
          </div>

          <!-- Created Date -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.col_created_at') }}
            </p>
            <p class="mt-1 text-sm">
              {{ fmtDate(record.created_at) }}
            </p>
          </div>

          <!-- Approved section -->
          <template v-if="record.status === 'approved'">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_approved_by') }}
              </p>
              <p class="mt-1 text-sm">
                {{ record.approved_by?.name || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_approved_at') }}
              </p>
              <p class="mt-1 text-sm">
                {{ fmtDate(record.approved_at) }}
              </p>
            </div>
          </template>

          <!-- Rejected section -->
          <template v-if="record.status === 'rejected'">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_rejected_by') }}
              </p>
              <p class="mt-1 text-sm">
                {{ record.rejected_by?.name || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_rejected_at') }}
              </p>
              <p class="mt-1 text-sm">
                {{ fmtDate(record.rejected_at) }}
              </p>
            </div>
            <div
              v-if="record.rejection_reason"
              class="sm:col-span-2"
            >
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_rejection_reason') }}
              </p>
              <p class="mt-1 text-sm whitespace-pre-wrap">
                {{ record.rejection_reason }}
              </p>
            </div>
          </template>

          <!-- Cancelled section -->
          <template v-if="record.status === 'cancelled'">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_cancelled_by') }}
              </p>
              <p class="mt-1 text-sm">
                {{ record.cancelled_by?.name || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_cancelled_at') }}
              </p>
              <p class="mt-1 text-sm">
                {{ fmtDate(record.cancelled_at) }}
              </p>
            </div>
            <div
              v-if="record.cancellation_reason"
              class="sm:col-span-2"
            >
              <p class="text-xs text-muted-foreground">
                {{ t('damage_records_page.col_cancellation_reason') }}
              </p>
              <p class="mt-1 text-sm whitespace-pre-wrap">
                {{ record.cancellation_reason }}
              </p>
            </div>
          </template>
        </CardContent>
      </Card>

      <!-- Photos Card -->
      <Card
        v-if="record.photo_urls.length"
        class="gap-0 overflow-hidden py-0 shadow-sm"
      >
        <div class="flex items-center gap-2 border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
          <Image class="size-4 text-white/70" />
          <h2 class="text-base font-semibold">
            {{ t('damage_records_page.section_photos') }}
          </h2>
        </div>
        <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
          <div class="flex flex-wrap gap-3">
            <button
              v-for="(url, idx) in record.photo_urls"
              :key="idx"
              type="button"
              class="group relative size-24 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              @click="openPhoto(url)"
            >
              <img
                :src="url"
                :alt="`photo-${idx + 1}`"
                class="size-full object-cover"
                loading="lazy"
              >
            </button>
          </div>
        </CardContent>
      </Card>

      <!-- Disposition Card (read-only, shown when disposition exists) -->
      <Card
        v-if="record.disposition"
        class="gap-0 overflow-hidden py-0 shadow-sm"
      >
        <div class="flex items-center justify-between border-b bg-section-items border-section-items text-white px-4 py-3.5 sm:px-6">
          <div class="flex items-center gap-2">
            <ClipboardList class="size-4 text-white/70" />
            <h2 class="text-base font-semibold">
              {{ t('damage_records_page.section_disposition') }}
            </h2>
          </div>
          <Button
            v-if="canDisposition"
            variant="ghost"
            size="sm"
            class="h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white"
            as-child
          >
            <NuxtLink :to="`/damage-records/disposition/${record.id}`">
              <Pencil class="size-3.5" />
              {{ t('common.edit') }}
            </NuxtLink>
          </Button>
        </div>
        <CardContent class="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <!-- Action Taken -->
          <div :class="record.disposition.action_taken === 'other' ? 'sm:col-span-2' : ''">
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.col_action_taken') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.disposition.action_taken_label || record.disposition.action_taken }}
            </p>
            <p
              v-if="record.disposition.action_taken === 'other' && record.disposition.action_taken_specified"
              class="mt-1 text-sm text-muted-foreground"
            >
              {{ record.disposition.action_taken_specified }}
            </p>
          </div>

          <!-- Recorded By -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.col_recorded_by') }}
            </p>
            <p class="mt-1 text-sm">
              {{ record.disposition.recorded_by?.name || '—' }}
            </p>
          </div>

          <!-- Recorded Date -->
          <div>
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.col_recorded_at') }}
            </p>
            <p class="mt-1 text-sm">
              {{ fmtDate(record.disposition.recorded_at) }}
            </p>
          </div>

          <!-- Notes -->
          <div
            v-if="record.disposition.notes"
            class="sm:col-span-2"
          >
            <p class="text-xs text-muted-foreground">
              {{ t('damage_records_page.notes_label') }}
            </p>
            <p class="mt-1 text-sm whitespace-pre-wrap">
              {{ record.disposition.notes }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Action buttons (only shown when there are actual actions) -->
      <div
        v-if="showPendingActions || showDispositionButton"
        class="flex flex-wrap gap-3"
      >
        <template v-if="showPendingActions">
          <!-- Edit -->
          <Button
            v-if="canEditDamage"
            variant="outline"
            as-child
          >
            <NuxtLink :to="`/damage-records/edit/${record.id}`">
              {{ t('damage_records_page.action_edit') }}
            </NuxtLink>
          </Button>

          <!-- Reject -->
          <Button
            v-if="canApproveDamage"
            variant="outline"
            class="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            @click="openRejectDialog"
          >
            {{ t('damage_records_page.action_reject') }}
          </Button>

          <!-- Approve -->
          <Button
            v-if="canApproveDamage"
            class="bg-emerald-600 hover:bg-emerald-700 text-white"
            @click="approveOpen = true"
          >
            {{ t('damage_records_page.action_approve') }}
          </Button>

          <!-- Cancel -->
          <Button
            v-if="canCancelDamage"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive"
            @click="openCancelDialog"
          >
            {{ t('damage_records_page.action_cancel') }}
          </Button>
        </template>

        <!-- Record Disposition — navigate to form -->
        <Button
          v-if="showDispositionButton && canDisposition"
          variant="outline"
          as-child
        >
          <NuxtLink :to="`/damage-records/disposition/${record.id}`">
            {{ t('damage_records_page.action_record_disposition') }}
          </NuxtLink>
        </Button>
      </div>

      <!-- Close button when no actions -->
      <div
        v-else
        class="flex justify-start"
      >
        <Button
          variant="outline"
          as-child
        >
          <NuxtLink to="/damage-records">
            {{ t('common.close') }}
          </NuxtLink>
        </Button>
      </div>
    </template>

    <!-- ─── Approve Dialog ───────────────────────────────────────────────────── -->
    <AlertDialog :open="approveOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('damage_records_page.approve_confirm_title') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('damage_records_page.approve_confirm_desc') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <div
          v-if="approveError"
          class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {{ approveError }}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="approveSubmitting"
            @click="approveOpen = false; approveError = ''"
          >
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="approveSubmitting"
            class="bg-emerald-600 hover:bg-emerald-700"
            @click.prevent="confirmApprove"
          >
            <Loader2
              v-if="approveSubmitting"
              class="mr-2 size-4 animate-spin"
            />
            {{ t('damage_records_page.action_approve') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ─── Reject Dialog ────────────────────────────────────────────────────── -->
    <AlertDialog :open="rejectOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('damage_records_page.reject_dialog_title') }}</AlertDialogTitle>
        </AlertDialogHeader>
        <div class="space-y-2">
          <label class="text-sm font-medium">
            {{ t('damage_records_page.reject_reason_label') }}
            <span class="text-destructive ms-0.5">*</span>
          </label>
          <textarea
            v-model="rejectReason"
            rows="3"
            maxlength="250"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            :placeholder="t('damage_records_page.reject_reason_placeholder')"
            :class="{ 'border-destructive': rejectError }"
          />
          <p
            v-if="rejectError"
            class="text-xs text-destructive"
          >
            {{ rejectError }}
          </p>
          <p class="text-xs text-muted-foreground text-end">
            {{ rejectReason.length }} / 250
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="rejectSubmitting"
            @click="rejectOpen = false"
          >
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="rejectSubmitting"
            class="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            @click.prevent="confirmReject"
          >
            <Loader2
              v-if="rejectSubmitting"
              class="mr-2 size-4 animate-spin"
            />
            {{ t('damage_records_page.action_reject') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ─── Cancel Dialog ────────────────────────────────────────────────────── -->
    <AlertDialog :open="cancelOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('damage_records_page.cancel_dialog_title') }}</AlertDialogTitle>
        </AlertDialogHeader>
        <div class="space-y-2">
          <label class="text-sm font-medium">
            {{ t('damage_records_page.cancel_reason_label') }}
            <span class="text-destructive ms-0.5">*</span>
          </label>
          <textarea
            v-model="cancelReason"
            rows="3"
            maxlength="250"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            :placeholder="t('damage_records_page.cancel_reason_placeholder')"
            :class="{ 'border-destructive': cancelError }"
          />
          <p
            v-if="cancelError"
            class="text-xs text-destructive"
          >
            {{ cancelError }}
          </p>
          <p class="text-xs text-muted-foreground text-end">
            {{ cancelReason.length }} / 250
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            :disabled="cancelSubmitting"
            @click="cancelOpen = false"
          >
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="cancelSubmitting"
            class="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            @click.prevent="confirmCancel"
          >
            <Loader2
              v-if="cancelSubmitting"
              class="mr-2 size-4 animate-spin"
            />
            {{ t('damage_records_page.action_cancel') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
