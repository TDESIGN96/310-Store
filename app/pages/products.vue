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

definePageMeta({ layout: 'default' })

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

// ── Dummy Data (replace with useQuery later) ──
const products = ref<Product[]>([
  { id: 1,  image: '', name: 'كرتون تغليف A4',       sku: 'PKG-001', category: 'تغليف',    price: 2500,  stock: 5,   status: 'active' },
  { id: 2,  image: '', name: 'طابعة حرارية XP-80',   sku: 'PRT-002', category: 'أجهزة',    price: 85000, stock: 12,  status: 'active' },
  { id: 3,  image: '', name: 'ورق A4 ريم',           sku: 'PPR-003', category: 'قرطاسية',  price: 4500,  stock: 0,   status: 'inactive' },
  { id: 4,  image: '', name: 'قلم باركود USB',       sku: 'SCN-004', category: 'أجهزة',    price: 35000, stock: 8,   status: 'active' },
  { id: 5,  image: '', name: 'لاصق شفاف كبير',       sku: 'PKG-005', category: 'تغليف',    price: 1200,  stock: 45,  status: 'active' },
  { id: 6,  image: '', name: 'دفتر فواتير 3 نسخ',   sku: 'STN-006', category: 'قرطاسية',  price: 3500,  stock: 22,  status: 'active' },
  { id: 7,  image: '', name: 'حقيبة توصيل متوسطة',  sku: 'DEL-007', category: 'شحن',      price: 7500,  stock: 3,   status: 'active' },
  { id: 8,  image: '', name: 'ميزان رقمي 30 كغ',    sku: 'WGH-008', category: 'أجهزة',    price: 45000, stock: 6,   status: 'inactive' },
  { id: 9,  image: '', name: 'شريط لاصق مطبوع',     sku: 'PKG-009', category: 'تغليف',    price: 2000,  stock: 60,  status: 'active' },
  { id: 10, image: '', name: 'درج كاشير معدني',      sku: 'POS-010', category: 'أجهزة',    price: 120000,stock: 2,   status: 'active' },
  { id: 11, image: '', name: 'كيس بلاستيك مطبوع',   sku: 'PKG-011', category: 'تغليف',    price: 800,   stock: 200, status: 'active' },
  { id: 12, image: '', name: 'طابعة فواتير A5',      sku: 'PRT-012', category: 'أجهزة',    price: 95000, stock: 4,   status: 'active' },
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
const formatPrice = (price: number) =>
  price.toLocaleString('ar-IQ') + ' د.ع'

// ── Stock badge ──
const stockBadge = (stock: number) => {
  if (stock === 0) return { label: 'نفد المخزون', class: 'bg-red-500/10 text-red-600 border-red-200' }
  if (stock <= 5)  return { label: 'مخزون منخفض', class: 'bg-amber-500/10 text-amber-600 border-amber-200' }
  return { label: String(stock), class: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' }
}

// ── Columns ──
const columns: ColumnDef<Product>[] = [
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
    header: 'المنتج',
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
    header: 'الفئة',
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
      'السعر',
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
      'المخزون',
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
    header: 'الحالة',
    cell: ({ row }) => {
      const active = row.original.status === 'active'
      return h('span', {
        class: `text-xs px-2 py-0.5 rounded-full border font-medium ${
          active
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
            : 'bg-muted text-muted-foreground border-border'
        }`
      }, active ? 'نشط' : 'غير نشط')
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
            }, () => [h(Eye, { class: 'size-4' }), 'عرض']),
            h(DropdownMenuItem, {
              class: 'gap-2 cursor-pointer',
              onClick: () => navigateTo(`/products/${product.id}/edit`)
            }, () => [h(Pencil, { class: 'size-4' }), 'تعديل']),
            h(DropdownMenuSeparator),
            h(DropdownMenuItem, {
              class: 'gap-2 cursor-pointer text-red-500 focus:text-red-500',
              onClick: () => { deleteTarget.value = product; deleteDialogOpen.value = true }
            }, () => [h(Trash2, { class: 'size-4' }), 'حذف']),
          ])
        ]
      })
    },
  },
]

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
  columns,
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

// ── Export (stub — connect to real export later) ──
const exportToExcel = () => {
  console.log('export', filteredData.value)
  // TODO: use xlsx library to export
}
</script>

<template>
  <div class="flex flex-col gap-4">

    <!-- ── Page Header ── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">المنتجات</h1>
        <p class="text-sm text-muted-foreground mt-1">
          إجمالي {{ products.length }} منتج
        </p>
      </div>
      <Button class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
        <NuxtLink to="/products/create">
          <Plus class="size-4" />
          منتج جديد
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
            placeholder="ابحث بالاسم أو الرمز..."
            class="pr-9 w-56 h-9"
          />
        </div>

        <!-- Category Filter -->
        <Select v-model="categoryFilter">
          <SelectTrigger class="w-36 h-9 gap-2">
            <Filter class="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="الفئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
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
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
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
          حذف {{ selectedCount }} منتج
        </Button>

        <!-- Export -->
        <Button
          variant="outline"
          size="sm"
          class="gap-2 h-9"
          @click="exportToExcel"
        >
          <Download class="size-4" />
          تصدير
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
                <p class="text-sm font-medium">لا توجد منتجات</p>
                <p class="text-xs opacity-60">جرب تغيير معايير البحث أو أضف منتجاً جديداً</p>
                <Button size="sm" class="gap-2 mt-1 bg-[#215260] text-[#CFE030]" as-child>
                  <NuxtLink to="/products/create">
                    <Plus class="size-3.5" />
                    منتج جديد
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
        عرض
        {{ table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 }}
        -
        {{ Math.min(
          (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
          filteredData.length
        ) }}
        من {{ filteredData.length }} منتج
        <span v-if="selectedCount > 0" class="mr-2 text-[#215260] font-medium">
          ({{ selectedCount }} محدد)
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
          صفحة {{ table.getState().pagination.pageIndex + 1 }}
          من {{ table.getPageCount() }}
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
          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من حذف منتج
            <strong>{{ deleteTarget?.name }}</strong>؟
            لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            class="bg-red-500 hover:bg-red-600"
            @click="confirmDelete"
          >
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ── Bulk Delete Dialog ── -->
    <AlertDialog :open="bulkDeleteOpen" @update:open="bulkDeleteOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد الحذف المتعدد</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من حذف {{ selectedCount }} منتج؟
            لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            class="bg-red-500 hover:bg-red-600"
            @click="confirmBulkDelete"
          >
            حذف الكل
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>