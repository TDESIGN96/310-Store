<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Search,
  Loader2,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  History,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { subjectPathFromMorph } from '@/utils/activitySubjectLink'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const authStore = useAuthStore()
const { $api } = useApi()
const { canAccess } = usePermissions()

const canViewLog = computed(() => canAccess('activities'))
const canOpenUserProfile = (userId: number) => {
  if (authStore.user?.id === userId) return true
  return canAccess('users')
}

const userProfileHref = (userId: number) =>
  authStore.user?.id === userId ? '/profile' : `/users/show/${userId}`

interface Pagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface ActivitiesResponse {
  status?: string
  status_code?: number
  data?: unknown
  activities?: unknown[]
  pagination?: Pagination
  message?: string | null
}

interface ActivityRow {
  id: number
  userId: number | null
  userName: string
  activityLabel: string
  createdAt: string
  subjectLink: string | null
}

/** Must match GET /activities sort columns on the API (Laravel-style sortBy[column]). */
type SortField = 'created_at' | 'user_name'

function extractList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const d = payload as Record<string, unknown>
  if (Array.isArray(d.data)) return d.data
  const inner = d.data
  if (inner && typeof inner === 'object') {
    const o = inner as Record<string, unknown>
    if (Array.isArray(o.activities)) return o.activities
    if (Array.isArray(o.data)) return o.data
    if (Array.isArray(o.items)) return o.items
  }
  if (Array.isArray(d.activities)) return d.activities
  return []
}

function isPagination(p: unknown): p is Pagination {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.current_page === 'number' && typeof o.last_page === 'number'
}

function extractPagination(payload: unknown): Pagination | null {
  if (!payload || typeof payload !== 'object') return null
  const d = payload as Record<string, unknown>
  const inner = d.data
  const nested =
    (inner && typeof inner === 'object' ? (inner as { pagination?: unknown }).pagination : undefined)
    ?? d.pagination
  if (isPagination(nested)) return nested
  if (typeof d.current_page === 'number' && typeof d.last_page === 'number') {
    return {
      current_page: d.current_page,
      last_page: d.last_page,
      per_page: typeof d.per_page === 'number' ? d.per_page : 15,
      total: typeof d.total === 'number' ? d.total : 0,
    }
  }
  return null
}

function isSubjectDeleted(raw: Record<string, unknown>): boolean {
  if (raw.deleted === true || raw.subject_deleted === true) return true
  if (raw.subject_exists === false || raw.related_exists === false) return true
  return false
}

function normalizeActivity(raw: Record<string, unknown>): ActivityRow | null {
  const id = raw.id
  if (typeof id !== 'number' && typeof id !== 'string') return null

  const userObj = raw.user ?? raw.causer ?? raw.actor
  let userId: number | null = null
  let userName = '—'
  if (userObj && typeof userObj === 'object') {
    const u = userObj as Record<string, unknown>
    if (typeof u.id === 'number') userId = u.id
    else if (typeof u.id === 'string') userId = Number(u.id)
    if (Number.isNaN(userId)) userId = null
    if (typeof u.name === 'string') userName = u.name
  }

  const desc = raw.description ?? raw.activity ?? raw.event ?? raw.log_name
  const activityLabel = typeof desc === 'string' ? desc : String(desc ?? '—')

  const createdRaw = raw.created_at ?? raw.createdAt
  const createdAt = typeof createdRaw === 'string' ? createdRaw : ''

  const deleted = isSubjectDeleted(raw)
  let subjectLink: string | null = null

  if (!deleted) {
    if (typeof raw.url === 'string' && raw.url.startsWith('/'))
      subjectLink = raw.url
    else {
      const st = raw.subject_type != null ? String(raw.subject_type) : ''
      const sid = raw.subject_id
      const subjectId =
        typeof sid === 'number' ? sid : typeof sid === 'string' ? Number(sid) : Number.NaN
      if (st && Number.isFinite(subjectId))
        subjectLink = subjectPathFromMorph(st, subjectId)
    }
  }

  return {
    id: Number(id),
    userId,
    userName,
    activityLabel,
    createdAt,
    subjectLink,
  }
}

const rows = ref<ActivityRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pagination = ref<Pagination | null>(null)
const currentPage = ref(1)

const search = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const sortBy = ref<SortField | ''>('')
const sortOrder = ref<'asc' | 'desc'>('asc')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const toggleSort = (field: SortField) => {
  if (sortBy.value === field)
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  resetPageAndLoad()
}

const loadActivities = async (page = currentPage.value) => {
  if (!canViewLog.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const params: Record<string, string | number> = { page }
    const q = search.value.trim()
    if (q) {
      params.search = q
      params.name = q
    }
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value

    if (sortBy.value) {
      params['sortBy[column]'] = sortBy.value
      params['sortBy[direction]'] = sortOrder.value
    }

    const data = await $api<ActivitiesResponse>('/activities', { params })
    const list = extractList(data)
    const parsed: ActivityRow[] = []
    for (const item of list) {
      if (item && typeof item === 'object') {
        const row = normalizeActivity(item as Record<string, unknown>)
        if (row) parsed.push(row)
      }
    }
    rows.value = parsed
    pagination.value = extractPagination(data)
    currentPage.value = pagination.value?.current_page ?? page
  }
  catch (error: any) {
    errorMessage.value
      = error?.data?.message?.ar
      ?? error?.data?.message
      ?? t('activities_page.load_error')
  }
  finally {
    loading.value = false
  }
}

function resetPageAndLoad() {
  currentPage.value = 1
  loadActivities(1)
}

const goToPage = (page: number) => {
  if (page < 1 || (pagination.value && page > pagination.value.last_page)) return
  loadActivities(page)
}

watch(search, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadActivities(1)
  }, 500)
})

watch([dateFrom, dateTo], () => {
  resetPageAndLoad()
})

const clearDateRange = () => {
  dateFrom.value = ''
  dateTo.value = ''
  resetPageAndLoad()
}

const formatDate = (d: string) => {
  if (!d) return '—'
  try {
    const loc = locale.value === 'ar' ? 'ar-EG' : 'en-US'
    return new Date(d).toLocaleString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return d
  }
}

const emptyMessage = computed(() => {
  if (rows.value.length > 0 || loading.value || errorMessage.value) return ''
  return t('activities_page.empty')
})

onMounted(() => {
  if (canViewLog.value) loadActivities()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <div
        class="flex size-10 items-center justify-center rounded-lg bg-[#215260]/10 text-[#215260]"
      >
        <History class="size-5" />
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('activities_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('activities_page.subtitle') }}
        </p>
      </div>
    </div>

    <div
      v-if="!canViewLog"
      class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <ShieldAlert class="size-8" />
      <p class="font-medium">{{ t('activities_page.no_permission') }}</p>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/mainCards">{{ t('activities_page.back_home') }}</NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="relative w-full min-w-[200px] max-w-sm sm:flex-1">
          <Search class="pointer-events-none absolute top-1/2 right-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="search"
            :placeholder="t('activities_page.search_placeholder')"
            class="h-9 pr-9"
          />
          <Loader2
            v-if="loading && search"
            class="absolute top-1/2 left-3 z-[1] size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label class="shrink-0 text-xs text-muted-foreground whitespace-nowrap" for="activities-date-from">
              {{ t('activities_page.date_from') }}
            </label>
            <Input
              id="activities-date-from"
              v-model="dateFrom"
              type="date"
              class="h-9 w-[160px]"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="shrink-0 text-xs text-muted-foreground whitespace-nowrap" for="activities-date-to">
              {{ t('activities_page.date_to') }}
            </label>
            <Input
              id="activities-date-to"
              v-model="dateTo"
              type="date"
              class="h-9 w-[160px]"
            />
          </div>
          <Button
            v-if="dateFrom || dateTo"
            variant="ghost"
            size="sm"
            class="h-9 shrink-0 gap-1.5 text-muted-foreground"
            @click="clearDateRange"
          >
            {{ t('activities_page.clear_dates') }}
          </Button>
        </div>
      </div>

      <div class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead
                class="rtl:text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                @click="toggleSort('user_name')"
              >
                <div class="flex items-center gap-1.5">
                  {{ t('activities_page.col_user') }}
                  <ArrowUp v-if="sortBy === 'user_name' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                  <ArrowDown v-else-if="sortBy === 'user_name' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                  <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
                </div>
              </TableHead>
              <TableHead class="rtl:text-right font-medium">{{ t('activities_page.col_activity') }}</TableHead>
              <TableHead
                class="rtl:text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                @click="toggleSort('created_at')"
              >
                <div class="flex items-center gap-1.5">
                  {{ t('activities_page.col_date') }}
                  <ArrowUp v-if="sortBy === 'created_at' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                  <ArrowDown v-else-if="sortBy === 'created_at' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                  <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell :colspan="3" class="py-14 text-center">
                <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 class="size-4 animate-spin" />
                  {{ t('activities_page.loading') }}
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="errorMessage">
              <TableCell :colspan="3" class="py-14 text-center">
                <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                  <ShieldAlert class="size-6" />
                  <span>{{ errorMessage }}</span>
                  <Button variant="outline" size="sm" @click="loadActivities()">
                    {{ t('common.retry') }}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="rows.length === 0">
              <TableCell :colspan="3" class="py-14 text-center text-sm text-muted-foreground">
                {{ emptyMessage }}
              </TableCell>
            </TableRow>
            <template v-else>
              <TableRow
                v-for="row in rows"
                :key="row.id"
                class="hover:bg-muted/30 transition-colors"
              >
                <TableCell class="font-medium">
                  <button
                    v-if="row.userId != null && canOpenUserProfile(row.userId)"
                    type="button"
                    class="text-[#2563eb] hover:underline text-start"
                    @click="navigateTo(userProfileHref(row.userId!))"
                  >
                    {{ row.userName }}
                  </button>
                  <span v-else>{{ row.userName }}</span>
                </TableCell>
                <TableCell class="text-sm">
                  <NuxtLink
                    v-if="row.subjectLink"
                    :to="row.subjectLink"
                    class="text-[#2563eb] hover:underline"
                  >
                    {{ row.activityLabel }}
                  </NuxtLink>
                  <span v-else class="text-muted-foreground">{{ row.activityLabel }}</span>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground whitespace-nowrap">
                  {{ formatDate(row.createdAt) }}
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>

        <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p class="text-xs text-muted-foreground">
            {{
              t('activities_page.pagination', {
                from: (currentPage - 1) * pagination.per_page + 1,
                to: Math.min(currentPage * pagination.per_page, pagination.total),
                total: pagination.total,
              })
            }}
          </p>
          <div class="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              class="size-8"
              :disabled="currentPage <= 1 || loading"
              @click="goToPage(currentPage - 1)"
            >
              <ChevronRight class="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              class="size-8"
              :disabled="currentPage >= pagination.last_page || loading"
              @click="goToPage(currentPage + 1)"
            >
              <ChevronLeft class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
