<script setup lang="ts">
import { ref, computed, h } from 'vue'
import type { ColumnDef, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState } from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import {
  Plus, Search, Filter, Download,
  MoreHorizontal, Pencil, Trash2,
  Eye, ArrowUpDown, ArrowUp, ArrowDown,
  PackageX, ChevronLeft, ChevronRight,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

definePageMeta({
  layout: 'default',
  middleware: [
    () => {
      const authStore = useAuthStore()
      if (!authStore.hasPermission('view_products')) {
        return navigateTo('/mainCards')
      }
    },
  ],
})

const { t, tm, locale } = useI18n()

// ── Types ──
interface Product {
  id: number
  image: string
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: 'active' | 'inactive'
}

// ── Dummy Data (replace with useQuery later) — neutral English labels; UI strings are localized ──
const products = ref<Product[]>([
  { id: 1,  image: '', name: 'A4 packaging carton', sku: 'PKG-001', category: 'Packaging', price: 2500, stock: 5, status: 'active' },
  { id: 2,  image: '', name: 'Thermal printer XP-80', sku: 'PRT-002', category: 'Devices', price: 85000, stock: 12, status: 'active' },
  { id: 3,  image: '', name: 'A4 paper ream', sku: 'PPR-003', category: 'Stationery', price: 4500, stock: 0, status: 'inactive' },
  { id: 4,  image: '', name: 'USB barcode pen', sku: 'SCN-004', category: 'Devices', price: 35000, stock: 8, status: 'active' },
  { id: 5,  image: '', name: 'Large clear tape', sku: 'PKG-005', category: 'Packaging', price: 1200, stock: 45, status: 'active' },
  { id: 6,  image: '', name: '3-copy invoice book', sku: 'STN-006', category: 'Stationery', price: 3500, stock: 22, status: 'active' },
  { id: 7,  image: '', name: 'Medium delivery bag', sku: 'DEL-007', category: 'Shipping', price: 7500, stock: 3, status: 'active' },
  { id: 8,  image: '', name: 'Digital scale 30 kg', sku: 'WGH-008', category: 'Devices', price: 45000, stock: 6, status: 'inactive' },
  { id: 9,  image: '', name: 'Printed adhesive tape', sku: 'PKG-009', category: 'Packaging', price: 2000, stock: 60, status: 'active' },
  { id: 10, image: '', name: 'Metal cash drawer', sku: 'POS-010', category: 'Devices', price: 120000, stock: 2, status: 'active' },
  { id: 11, image: '', name: 'Printed plastic bag', sku: 'PKG-011', category: 'Packaging', price: 800, stock: 200, status: 'active' },
  { id: 12, image: '', name: 'A5 receipt printer', sku: 'PRT-012', category: 'Devices', price: 95000, stock: 4, status: 'active' },
])

// Replace ref([...]) with:
// const { data: products, isLoading } = useQuery({
//   queryKey: queryKeys.products.list,
//   queryFn: () => $api('/products'),
// })


// ── Categories for filter ──
const categories = computed(() => {
  const cats = [...new Set(products.value.map(p => p.category))]
  return cats
})

// ── State ──
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<RowSelectionState>({})
const globalFilter = ref('')
const categoryFilter = ref('all')
const statusFilter = ref('all')
const deleteDialogOpen = ref(false)
const deleteTarget = ref<Product | null>(null)
const bulkDeleteOpen = ref(false)

// ── Format price ──
const formatPrice = (price: number) => {
  const loc = locale.value === 'ar' ? 'ar-IQ' : 'en-US'
  return price.toLocaleString(loc) + t('products_page.currency_suffix')
}

// ── Stock badge ──
const stockBadge = (stock: number) => {
  if (stock === 0) return { label: t('products_page.stock_out'), class: 'bg-red-500/10 text-red-600 border-red-200' }
  if (stock <= 5) return { label: t('products_page.stock_low'), class: 'bg-amber-500/10 text-amber-600 border-amber-200' }
  return { label: String(stock), class: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' }
}

// ── Columns ──
const columns = computed<ColumnDef<Product>[]>(() => [
  // Checkbox
  {
    id: 'select',
    header: ({ table }) => h(Checkbox, {
      checked: table.getIsAllPageRowsSelected(),
      'onUpdate:checked': (val: boolean) => table.toggleAllPageRowsSelected(val),
    }),
    cell: ({ row }) => h(Checkbox, {
      checked: row.getIsSelected(),
      'onUpdate:checked': (val: boolean) => row.toggleSelected(val),
    }),
    enableSorting: false,
  },
  // Image + Name
  {
    id: 'product',
    header: t('products_page.col_product'),
    cell: ({ row }) => {
      const product = row.original
      return h('div', { class: 'flex items-center gap-3' }, [
        h('div', {
          class: 'size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground border'
        }, product.sku.slice(0, 3)),
        h('div', { class: 'flex flex-col' }, [
          h('span', { class: 'text-sm font-medium leading-tight' }, product.name),
          h('span', { class: 'text-xs text-muted-foreground mt-0.5' }, product.sku),
        ])
      ])
    },
  },
  // Category
  {
    accessorKey: 'category',
    header: t('products_page.col_category'),
    cell: ({ row }) => h(Badge, { variant: 'secondary', class: 'text-xs' }, () => row.original.category),
  },
  // Price
  {
    accessorKey: 'price',
    header: ({ column }) => h(Button, {
      variant: 'ghost',
      class: 'h-auto p-0 font-medium hover:bg-transparent gap-1',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    }, () => [
      t('products_page.col_price'),
      column.getIsSorted() === 'asc'
        ? h(ArrowUp, { class: 'size-3' })
        : column.getIsSorted() === 'desc'
          ? h(ArrowDown, { class: 'size-3' })
          : h(ArrowUpDown, { class: 'size-3 opacity-40' })
    ]),
    cell: ({ row }) => h('span', { class: 'font-medium tabular-nums' }, formatPrice(row.original.price)),
  },
  // Stock
  {
    accessorKey: 'stock',
    header: ({ column }) => h(Button, {
      variant: 'ghost',
      class: 'h-auto p-0 font-medium hover:bg-transparent gap-1',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    }, () => [
      t('products_page.col_stock'),
      column.getIsSorted() === 'asc'
        ? h(ArrowUp, { class: 'size-3' })
        : column.getIsSorted() === 'desc'
          ? h(ArrowDown, { class: 'size-3' })
          : h(ArrowUpDown, { class: 'size-3 opacity-40' })
    ]),
    cell: ({ row }) => {
      const badge = stockBadge(row.original.stock)
      return h('span', {
        class: `text-xs px-2 py-0.5 rounded-full border font-medium ${badge.class}`
      }, badge.label)
    },
  },
  // Status
  {
    accessorKey: 'status',
    header: t('products_page.col_status'),
    cell: ({ row }) => {
      const active = row.original.status === 'active'
      return h('span', {
        class: `text-xs px-2 py-0.5 rounded-full border font-medium ${
          active
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
            : 'bg-muted text-muted-foreground border-border'
        }`
      }, active ? t('common.active') : t('common.inactive'))
    },
  },
  // Actions
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const product = row.original
      return h(DropdownMenu, {}, {
        default: () => [
          h(DropdownMenuTrigger, { asChild: true }, () =>
            h(Button, { variant: 'ghost', size: 'icon', class: 'size-8' }, () =>
              h(MoreHorizontal, { class: 'size-4' })
            )
          ),
          h(DropdownMenuContent, { align: 'end' }, () => [
            h(DropdownMenuItem, {
              class: 'gap-2 cursor-pointer',
              onClick: () => navigateTo(`/products/${product.id}`)
            }, () => [h(Eye, { class: 'size-4' }), t('common.view')]),
            h(DropdownMenuItem, {
              class: 'gap-2 cursor-pointer',
              onClick: () => navigateTo(`/products/${product.id}/edit`)
            }, () => [h(Pencil, { class: 'size-4' }), t('common.edit')]),
            h(DropdownMenuSeparator),
            h(DropdownMenuItem, {
              class: 'gap-2 cursor-pointer text-red-500 focus:text-red-500',
              onClick: () => { deleteTarget.value = product; deleteDialogOpen.value = true }
            }, () => [h(Trash2, { class: 'size-4' }), t('common.delete')]),
          ])
        ]
      })
    },
  },
])

// ── Filtered data ──
const filteredData = computed(() => {
  let data = products.value
  if (categoryFilter.value !== 'all')
    data = data.filter(p => p.category === categoryFilter.value)
  if (statusFilter.value !== 'all')
    data = data.filter(p => p.status === statusFilter.value)
  if (globalFilter.value)
    data = data.filter(p =>
      p.name.includes(globalFilter.value) ||
      p.sku.includes(globalFilter.value)
    )
  return data
})

// ── Table instance ──
const table = useVueTable({
  get data() { return filteredData.value },
  get columns() { return columns.value },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  onSortingChange: updater => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onRowSelectionChange: updater => {
    rowSelection.value = typeof updater === 'function' ? updater(rowSelection.value) : updater
  },
  state: {
    get sorting() { return sorting.value },
    get rowSelection() { return rowSelection.value },
  },
  initialState: { pagination: { pageSize: 8 } },
})

// ── Selected rows ──
const selectedCount = computed(() => Object.keys(rowSelection.value).length)

// ── Delete actions ──
const confirmDelete = () => {
  if (deleteTarget.value) {
    products.value = products.value.filter(p => p.id !== deleteTarget.value!.id)
    deleteTarget.value = null
    deleteDialogOpen.value = false
  }
}

const confirmBulkDelete = () => {
  const selectedIds = table.getSelectedRowModel().rows.map(r => r.original.id)
  products.value = products.value.filter(p => !selectedIds.includes(p.id))
  rowSelection.value = {}
  bulkDeleteOpen.value = false
}

// ── Export (CSV — current filtered rows) ──
const exportToCSV = () => {
  const rows = filteredData.value
  if (rows.length === 0) {
    toast.error(t('products_page.export_no_data'))
    return
  }
  const headers = tm('products_page.export_headers') as unknown as string[]
  const dataRows = rows.map(p => [
    p.id,
    p.name,
    p.sku,
    p.category,
    formatPrice(p.price),
    p.stock,
    p.status === 'active' ? t('common.active') : t('common.inactive'),
  ])
  const csv = [headers, ...dataRows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.success(t('products_page.export_success'))
}
</script>

<template>
  <div class="flex flex-col gap-4">

    <!-- ── Page Header ── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_page.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('products_page.subtitle_total', { count: products.length }) }}
        </p>
      </div>
      <Button class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
        <NuxtLink to="/products/create">
          <Plus class="size-4" />
          {{ t('products_page.new_product') }}
        </NuxtLink>
      </Button>
    </div>

    <!-- ── Toolbar ── -->
    <div class="flex items-center justify-between gap-3 flex-wrap">

      <!-- Left: Search + Filters -->
      <div class="flex items-center gap-2 flex-wrap">

        <!-- Search -->
        <div class="relative">
          <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
          <Input
            v-model="globalFilter"
            :placeholder="t('products_page.search_placeholder')"
            class="pr-9 w-56 h-9"
          />
        </div>

        <!-- Category Filter -->
        <Select v-model="categoryFilter">
          <SelectTrigger class="w-36 h-9 gap-2">
            <Filter class="size-3.5 text-muted-foreground" />
            <SelectValue :placeholder="t('products_page.filter_category')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('products_page.all_categories') }}</SelectItem>
            <SelectItem
              v-for="cat in categories"
              :key="cat"
              :value="cat"
            >
              {{ cat }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Status Filter -->
        <Select v-model="statusFilter">
          <SelectTrigger class="w-36 h-9">
            <SelectValue :placeholder="t('products_page.filter_status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('products_page.all_statuses') }}</SelectItem>
            <SelectItem value="active">{{ t('common.active') }}</SelectItem>
            <SelectItem value="inactive">{{ t('common.inactive') }}</SelectItem>
          </SelectContent>
        </Select>

      </div>

      <!-- Right: Bulk Delete + Export -->
      <div class="flex items-center gap-2">

        <!-- Bulk Delete (shows only when rows selected) -->
        <Button
          v-if="selectedCount > 0"
          variant="destructive"
          size="sm"
          class="gap-2 h-9"
          @click="bulkDeleteOpen = true"
        >
          <Trash2 class="size-4" />
          {{ t('products_page.delete_selected', { count: selectedCount }) }}
        </Button>

        <!-- Export -->
        <Button
          variant="outline"
          size="sm"
          class="gap-2 h-9"
          @click="exportToCSV"
        >
          <Download class="size-4" />
          CSV
        </Button>

      </div>
    </div>

    <!-- ── Table ── -->
    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="bg-muted/40 hover:bg-muted/40"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="text-right font-medium"
            >
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <!-- Rows -->
          <template v-if="table.getRowModel().rows.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() ? 'selected' : ''"
              class="hover:bg-muted/30 transition-colors"
              :class="{ 'bg-muted/20': row.getIsSelected() }"
            >
              <TableCell
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
              >
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </TableCell>
            </TableRow>
          </template>

          <!-- Empty State -->
          <TableRow v-else>
            <TableCell :colspan="columns.length" class="py-16 text-center">
              <div class="flex flex-col items-center gap-3 text-muted-foreground">
                <PackageX class="size-10 opacity-20" />
                <p class="text-sm font-medium">{{ t('products_page.no_products') }}</p>
                <p class="text-xs opacity-60">{{ t('products_page.no_products_hint') }}</p>
                <Button size="sm" class="gap-2 mt-1 bg-[#215260] text-[#CFE030]" as-child>
                  <NuxtLink to="/products/create">
                    <Plus class="size-3.5" />
                    {{ t('products_page.new_product') }}
                  </NuxtLink>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- ── Pagination ── -->
    <div class="flex items-center justify-between px-1">

      <!-- Info -->
      <p class="text-sm text-muted-foreground">
        {{
          t('common.showing_range', {
            from: table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1,
            to: Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredData.length,
            ),
            total: filteredData.length,
          })
        }}
        <span v-if="selectedCount > 0" class="mr-2 text-[#215260] font-medium">
          {{ t('products_page.selected_suffix', { count: selectedCount }) }}
        </span>
      </p>

      <!-- Controls -->
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          <ChevronRight class="size-4" />
        </Button>

        <span class="text-sm text-muted-foreground px-2">
          {{
            t('common.page_of', {
              current: table.getState().pagination.pageIndex + 1,
              total: table.getPageCount(),
            })
          }}
        </span>

        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          <ChevronLeft class="size-4" />
        </Button>
      </div>

    </div>

    <!-- ── Delete Single Dialog ── -->
    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('products_page.delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('products_page.delete_body', { name: deleteTarget?.name ?? '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-red-500 hover:bg-red-600"
            @click="confirmDelete"
          >
            {{ t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ── Bulk Delete Dialog ── -->
    <AlertDialog :open="bulkDeleteOpen" @update:open="bulkDeleteOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('products_page.bulk_delete_title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('products_page.bulk_delete_body', { count: selectedCount }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-red-500 hover:bg-red-600"
            @click="confirmBulkDelete"
          >
            {{ t('products_page.delete_all') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>