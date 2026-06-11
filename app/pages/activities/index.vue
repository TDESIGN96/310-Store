<script setup lang="ts">
import formatDateToIso from '@/hooks/useFormatDateHook'
import { computed, onMounted, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import {
  Search,
  Loader2,
  ShieldAlert,
  History,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import PaginationArrowButtons from '@/components/app/table/PaginationArrowButtons.vue'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ActivitiesPagination,
  type ActivityTableRow,
  extractActivitiesList,
  extractActivitiesPagination,
  parseActivityTableRow,
} from '@/utils/activitiesResponse'
import { formatDisplayDate } from '@/utils/formatDisplayDate'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const authStore = useAuthStore()
const { $api } = useApi()
const { canAccess } = usePermissions()

/** API envelope for GET `/activities` (supports several Laravel response shapes). */
interface ActivitiesResponse {
  status?: string
  status_code?: number
  data?: unknown
  activities?: unknown[]
  pagination?: ActivitiesPagination
  message?: string | null
}

/** User list item for filter dropdown. */
interface UserListItem {
  id: number
  name: string
}

/** API envelope for GET `/users`. */
interface UsersResponse {
  users?: UserListItem[]
  pagination?: { last_page?: number }
  data?: {
    users?: UserListItem[]
    pagination?: { last_page?: number }
  }
}

/** Sortable columns for `sortBy[column]` / `sortBy[direction]`. */
type SortField = 'created_at' | 'user_name'

const canViewLog = computed(() => canAccess('activities'))

/**
 * Whether the current user may open the profile for this activity’s user (self or `users` permission).
 */
function canOpenUserProfile(userId: number): boolean {
  if (authStore.user?.id === userId)
    return true
  return canAccess('users')
}

/** In-app route for the user linked to an activity row. */
function userProfileHref(userId: number): string {
  return authStore.user?.id === userId ? '/profile' : `/users/show/${userId}`
}

const rows = ref<ActivityTableRow[]>([])
const loading = ref(false)
const { listLoadError, clearListLoadError, setListLoadErrorFromException } = useResourceListLoadError('activities_page')
const pagination = ref<ActivitiesPagination | null>(null)
const currentPage = ref(1)

const search = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const sortBy = ref<SortField | ''>('')
const sortOrder = ref<'asc' | 'desc'>('asc')
const filterUserId = ref<'all' | string>('all')
const userOptions = ref<{ id: number; name: string }[]>([])
const loadingUsers = ref(false)

/** Today as `YYYY-MM-DD` in UTC (matches interpreting filter dates as UTC calendar days). */
function utcYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * `YYYY-MM-DD` from the date inputs: start or end of that **UTC** calendar day, as ISO Zulu
 * (e.g. `2026-04-08` → `2026-04-08T00:00:00.000Z` / `2026-04-08T23:59:59.999Z`), no local offset shift.
 */
function civilYmdToIsoBoundary(ymd: string, endOfDay: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) {
    return formatDateToIso(new Date()) ?? ''
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const ms = Date.UTC(
    y,
    mo - 1,
    d,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  )
  return formatDateToIso(new Date(ms)) ?? formatDateToIso(new Date()) ?? ''
}

/** Values allowed on GET `/activities` query (includes bracket keys and array filter `value`). */
type ActivitiesQueryParams = Record<string, string | number | (string | null)[]>

/**
 * Builds query params for GET `/activities`: pagination, optional search, date range, user filter, and sort.
 */
function buildActivitiesQueryParams(page: number): { params: ActivitiesQueryParams } {
  const params: ActivitiesQueryParams = { page }
  const q = search.value.trim()
  if (q) {
    params.search = q
    params.name = q
  }

  let filterIndex = 0

  if (dateFrom.value || dateTo.value) {
    params[`filters[${filterIndex}][column]`] = 'created_at'
    const fromYmd = dateFrom.value.trim() || utcYmd(new Date())
    const toYmd = dateTo.value.trim() || utcYmd(new Date())
    params[`filters[${filterIndex}][value][0]`] = civilYmdToIsoBoundary(fromYmd, false)
    params[`filters[${filterIndex}][value][1]`] = civilYmdToIsoBoundary(toYmd, true)
    params[`filters[${filterIndex}][condition]`] = 'between'
    params[`filters[${filterIndex}][operator]`] = 'and'
    filterIndex++
  }

  if (filterUserId.value !== 'all') {
    params[`filters[${filterIndex}][column]`] = 'user_id'
    params[`filters[${filterIndex}][value]`] = filterUserId.value
    params[`filters[${filterIndex}][condition]`] = '='
    params[`filters[${filterIndex}][operator]`] = 'and'
  }

  if (sortBy.value) {
    params['sortBy[column]'] = sortBy.value
    params['sortBy[direction]'] = sortOrder.value
  }
  return { params }
}

/**
 * Parses the activities API response into table rows and pagination state.
 * @param requestedPage Page number sent in the request (fallback if the API omits `current_page`).
 */
function mapActivitiesResponse(
  data: ActivitiesResponse,
  requestedPage: number,
): {
  rows: ActivityTableRow[]
  pagination: ActivitiesPagination | null
  resolvedPage: number
} {
  const list = extractActivitiesList(data)
  const parsed: ActivityTableRow[] = []
  for (const item of list) {
    if (item && typeof item === 'object') {
      const row = parseActivityTableRow(item as Record<string, unknown>)
      if (row)
        parsed.push(row)
    }
  }
  const pag = extractActivitiesPagination(data)
  return {
    rows: parsed,
    pagination: pag,
    resolvedPage: pag?.current_page ?? requestedPage,
  }
}

/**
 * Fetches one page of activities; no-ops when the user lacks `activities` access.
 */
async function loadActivities(page = currentPage.value): Promise<void> {
  if (!canViewLog.value)
    return
  loading.value = true
  clearListLoadError()
  try {
    const { params } = buildActivitiesQueryParams(page)
    const data = await $api<ActivitiesResponse>('/activities', {
      method: 'GET',
      params,
    })
    const { rows: nextRows, pagination: nextPag, resolvedPage } = mapActivitiesResponse(data, page)
    rows.value = nextRows
    pagination.value = nextPag
    currentPage.value = resolvedPage
  }
  catch (error: unknown) {
    setListLoadErrorFromException(error)
  }
  finally {
    loading.value = false
  }
}

/**
 * Loads user options for the filter dropdown from GET /users (paginated).
 */
async function loadUserOptions(): Promise<void> {
  loadingUsers.value = true
  try {
    const aggregated: UserListItem[] = []
    let page = 1
    let lastPage = 1
    const maxPages = 50

    do {
      const data = await $api<UsersResponse>('/users', {
        params: {
          page,
          per_page: 100,
        },
      })
      const list = data.users ?? data.data?.users ?? []
      aggregated.push(...list)
      lastPage = data.pagination?.last_page ?? data.data?.pagination?.last_page ?? 1
      page++
    } while (page <= lastPage && page <= maxPages)

    userOptions.value = aggregated
      .map(user => ({
        id: user.id,
        name: user.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  catch {
    // Fail silently - dropdown stays on "All users" only
    userOptions.value = []
  }
  finally {
    loadingUsers.value = false
  }
}

/** Resets to page 1 and reloads (used after filters/sort change). */
function resetPageAndLoad(): void {
  currentPage.value = 1
  void loadActivities(1)
}

/**
 * Changes the current page if it is in range; otherwise does nothing.
 */
function goToPage(page: number): void {
  if (page < 1 || (pagination.value && page > pagination.value.last_page))
    return
  void loadActivities(page)
}

/**
 * Toggles sort direction for the active column, or sets a new column with ascending order.
 */
function toggleSort(field: SortField): void {
  if (sortBy.value === field)
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  resetPageAndLoad()
}

watchDebounced(
  search,
  (newSearch) => {
    // If the user manually types something that doesn't match the selected user, clear the dropdown
    if (filterUserId.value !== 'all') {
      const selectedUser = userOptions.value.find(u => u.id === Number(filterUserId.value))
      if (!selectedUser || selectedUser.name !== newSearch.trim()) {
        filterUserId.value = 'all'
      }
    }
    currentPage.value = 1
    void loadActivities(1)
  },
  { debounce: 500 },
)

watch([dateFrom, dateTo], () => {
  resetPageAndLoad()
})

watch(filterUserId, (newUserId) => {
  // When a user is selected from dropdown, also populate the search box with their name
  if (newUserId !== 'all') {
    const selectedUser = userOptions.value.find(u => u.id === Number(newUserId))
    if (selectedUser) {
      search.value = selectedUser.name
    }
  }
  else {
    search.value = ''
  }
  resetPageAndLoad()
})

/** Clears date inputs and reloads from page 1. */
function clearDateRange(): void {
  dateFrom.value = ''
  dateTo.value = ''
  resetPageAndLoad()
}

/** Formats an ISO-ish datetime string for the current UI locale. */
function formatActivityDate(iso: string): string {
  return formatDisplayDate(iso, { withTime: true })
}

const emptyMessage = computed(() => {
  if (rows.value.length > 0 || loading.value || listLoadError.value)
    return ''
  return t('activities_page.empty')
})

onMounted(() => {
  if (canViewLog.value) {
    void loadActivities()
    void loadUserOptions()
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      
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
        <Select v-model="filterUserId">
          <SelectTrigger class="h-9 w-full sm:w-[200px] gap-2">
            <Filter class="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue :placeholder="t('activities_page.filter_user')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('activities_page.filter_user_all') }}</SelectItem>
            <SelectItem
              v-for="user in userOptions"
              :key="user.id"
              :value="String(user.id)"
            >
              {{ user.name }}
            </SelectItem>
          </SelectContent>
        </Select>
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
                class="text-start font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                @click="toggleSort('user_name')"
              >
                <div class="flex items-center gap-1.5">
                  {{ t('activities_page.col_user') }}
                  <ArrowUp v-if="sortBy === 'user_name' && sortOrder === 'asc'" class="size-3.5 text-[#215260]" />
                  <ArrowDown v-else-if="sortBy === 'user_name' && sortOrder === 'desc'" class="size-3.5 text-[#215260]" />
                  <ArrowUpDown v-else class="size-3.5 text-muted-foreground/50" />
                </div>
              </TableHead>
              <TableHead class="text-start font-medium">{{ t('activities_page.col_activity') }}</TableHead>
              <TableHead
                class="text-end font-medium cursor-pointer select-none hover:text-foreground transition-colors"
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
            <TableRow v-else-if="listLoadError">
              <TableCell :colspan="3" class="py-14 text-center">
                <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                  <ShieldAlert class="size-6" />
                  <p class="font-medium text-center">{{ listLoadError.title }}</p>
                  <p class="text-center text-red-600/90 dark:text-red-400/90 max-w-md leading-relaxed">
                    {{ listLoadError.detail }}
                  </p>
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
                class="hover:bg-muted/30 transition-colors align-middle"
              >
                <TableCell class="font-medium">
                  <button
                    v-if="row.userId != null && canOpenUserProfile(row.userId)"
                    type="button"
                    class="text-[#2563eb] hover:underline text-start cursor-pointer"
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
                    class="text-[#2563eb] hover:underline text-start cursor-pointer"
                  >
                    {{ row.activityLabel }}
                  </NuxtLink>
                  <span v-else class="text-muted-foreground">{{ row.activityLabel }}</span>
                </TableCell>
                <TableCell class="text-end text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  {{ formatActivityDate(row.createdAt) }}
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
          <PaginationArrowButtons
            :current-page="currentPage"
            :last-page="pagination.last_page"
            :loading="loading"
            @prev="goToPage(currentPage - 1)"
            @next="goToPage(currentPage + 1)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
