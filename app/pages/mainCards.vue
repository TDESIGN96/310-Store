<script setup lang="ts">
import KpiCard from '@/components/Cards/Demo.vue'
import { ShoppingCart, FileText } from 'lucide-vue-next'

definePageMeta({
  layout: 'default',
})

const { t } = useI18n()

const cards = computed(() => [
  {
    id: 'sales_today',
    title: t('dashboard.cards.sales_today.title'),
    value: t('dashboard.demo_sales_value'),
    change: t('dashboard.demo_sales_change'),
    changeType: 'up' as const,
    description: t('dashboard.cards.sales_today.description'),
    subtitle: t('dashboard.cards.sales_today.subtitle'),
    icon: ShoppingCart,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    roles: ['admin', 'manager', 'sales', 'agent'],
    link: '/invoices',
  },
  {
    id: 'pending_invoices',
    title: t('dashboard.cards.pending_invoices.title'),
    value: t('dashboard.demo_pending_value'),
    change: t('dashboard.demo_pending_change'),
    changeType: 'down' as const,
    description: t('dashboard.cards.pending_invoices.description'),
    subtitle: t('dashboard.cards.pending_invoices.subtitle'),
    icon: FileText,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    roles: ['admin', 'manager', 'accountant'],
    link: '/invoices',
  },
])
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
    <div class="p-6">
      <h1 class="text-2xl font-bold">{{ t('dashboard.title') }}</h1>
      <p class="text-muted-foreground">{{ t('dashboard.subtitle') }}</p>
    </div>
    <div class="grid auto-rows-min gap-4 md:grid-cols-3">
      <KpiCard v-for="card in cards" :key="card.id" v-bind="card" class="col-span-1" />
    </div>

  </div>
</template>
