<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search, Plus, Pencil, Copy, Trash2, Loader2, ShieldAlert } from 'lucide-vue-next'
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
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

interface RoleItem {
  id: string
  name_en: string
  name_ar: string
}

interface RolesPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface RolesResponse {
  status: string
  status_code: number
  data: {
    roles: RoleItem[]
    pagination: RolesPagination
  }
}

const { $api } = useApi()

const roles = ref<RoleItem[]>([])
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const pagination = ref<RolesPagination | null>(null)

const filteredRoles = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return roles.value

  return roles.value.filter(role =>
    role.name_en.toLowerCase().includes(query) ||
    role.name_ar.toLowerCase().includes(query),
  )
})

const loadRoles = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await $api<RolesResponse>('/roles')
    roles.value = data.data.roles ?? []
    pagination.value = data.data.pagination ?? null
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? 'تعذر تحميل قائمة الصلاحيات حالياً'
  } finally {
    loading.value = false
  }
}

const goToCreateRole = async () => {
  await navigateTo('/roles/create')
}

const handleEdit = (role: RoleItem) => {
  toast(`تعديل: ${role.name_ar}`)
}

const handleClone = (role: RoleItem) => {
  toast(`نسخ: ${role.name_ar}`)
}

const handleDelete = (role: RoleItem) => {
  toast.error(`حذف: ${role.name_ar}`)
}

onMounted(loadRoles)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">إدارة الصلاحيات</h1>
        <p class="text-sm text-muted-foreground mt-1">
          إدارة أدوار المستخدمين والصلاحيات المرتبطة بها
        </p>
      </div>

      
    </div>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="relative">
        <Search class="absolute top-1/2 -translate-y-1/2 right-3 size-4 text-muted-foreground" />
        <Input
          v-model="search"
          placeholder="ابحث باسم الصلاحية بالعربي أو الإنجليزي..."
          class="pr-9 w-80 h-9"
        />
      </div>
     
      <Button class="gap-2 bg-[#215260] hover:bg-[#215260]/90 text-[#CFE030]" as-child>
        <NuxtLink to="/roles/create">
          <Plus class="size-4" />
          إنشاء صلاحية
        </NuxtLink>
      </Button>
     
    </div>

    <div class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="text-right font-medium">اسم الصلاحية (EN)</TableHead>
            <TableHead class="text-right font-medium">اسم الصلاحية (AR)</TableHead>
            <TableHead class="text-right font-medium">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="3" class="py-14 text-center">
              <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" />
                جاري تحميل الصلاحيات...
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="errorMessage">
            <TableCell :colspan="3" class="py-14 text-center">
              <div class="flex flex-col items-center gap-2 text-sm text-red-500">
                <ShieldAlert class="size-6" />
                <span>{{ errorMessage }}</span>
                <Button variant="outline" size="sm" @click="loadRoles">إعادة المحاولة</Button>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-else-if="filteredRoles.length === 0">
            <TableCell :colspan="3" class="py-14 text-center text-sm text-muted-foreground">
              لا توجد صلاحيات مطابقة للبحث
            </TableCell>
          </TableRow>

          <TableRow
            v-for="role in filteredRoles"
            v-else
            :key="role.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <TableCell class="font-medium">{{ role.name_en }}</TableCell>
            <TableCell class="font-medium">{{ role.name_ar }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-3 text-sm">
                <button class="inline-flex items-center gap-1 text-[#2563eb] hover:underline" @click="handleEdit(role)">
                  <Pencil class="size-3.5" />
                  تعديل
                </button>
                <button class="inline-flex items-center gap-1 text-muted-foreground hover:underline" @click="handleClone(role)">
                  <Copy class="size-3.5" />
                  نسخ
                </button>
                <button class="inline-flex items-center gap-1 text-red-500 hover:underline" @click="handleDelete(role)">
                  <Trash2 class="size-3.5" />
                  حذف
                </button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      
    </div>
    <p v-if="pagination" class="text-xs text-muted-foreground">
        إجمالي {{ pagination.total }} صلاحية
      </p>
  </div>
</template>
