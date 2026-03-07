<script setup lang="ts">
import KpiCard from '@/components/Cards/Demo.vue'
import { ShoppingCart, FileText } from 'lucide-vue-next'

const cards = [
  {
    id: 'sales_today',
    title: 'المبيعات اليوم',
    value: '٢٤,٥٠٠ د.ع',
    change: '+١٢٪',
    changeType: 'up' as const,
    description: 'تتجه نحو الأعلى هذا الشهر',
    subtitle: 'مقارنة بأمس',
    icon: ShoppingCart,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    roles: ['admin', 'manager', 'sales', 'agent'],
    link: '/sales/invoices',
  },
  {
    id: 'pending_invoices',
    title: 'الفواتير المعلقة',
    value: '١٨',
    change: '+٣',
    changeType: 'down' as const,
    description: 'تحتاج مراجعة فورية',
    subtitle: 'مقارنة بالأمس',
    icon: FileText,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    roles: ['admin', 'manager', 'accountant'],
    link: '/sales/invoices',
  },
]
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
    <div class="p-6">
      <h1 class="text-2xl font-bold">لوحة التحكم</h1>
      <p class="text-muted-foreground">مرحباً بك في نظام KAMU</p>
    </div>
    <div class="grid auto-rows-min gap-4 md:grid-cols-3">
          <KpiCard v-for="card in cards" :key="card.id" v-bind="card" class="col-span-1"/>
  </div>

    <div class="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
  </div>
</template>
