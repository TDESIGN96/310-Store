<script setup lang="ts">
import type { Component } from 'vue'
import {
  ArrowRight,
  BarChart3,
  RotateCcw,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

definePageMeta({ layout: 'default' })

interface ReportCard {
  slug: string
  titleKey: string
  descriptionKey: string
  icon: Component
  available: boolean
}

const { t } = useI18n()
const { can } = usePermissions()
const canViewReports = computed(() => can('reports.index') || can('reports.show'))

const reportCards: ReportCard[] = [
  {
    slug: 'sales-summary',
    titleKey: 'reports_hub.cards.sales_summary.title',
    descriptionKey: 'reports_hub.cards.sales_summary.description',
    icon: BarChart3,
    available: true,
  },
  {
    slug: 'distributors-performance',
    titleKey: 'reports_hub.cards.distributors_performance.title',
    descriptionKey: 'reports_hub.cards.distributors_performance.description',
    icon: Users,
    available: false,
  },
  {
    slug: 'product-profitability',
    titleKey: 'reports_hub.cards.product_profitability.title',
    descriptionKey: 'reports_hub.cards.product_profitability.description',
    icon: TrendingUp,
    available: false,
  },
  {
    slug: 'sales-returns-analysis',
    titleKey: 'reports_hub.cards.sales_returns_analysis.title',
    descriptionKey: 'reports_hub.cards.sales_returns_analysis.description',
    icon: RotateCcw,
    available: false,
  },
  {
    slug: 'warehouse-movement',
    titleKey: 'reports_hub.cards.warehouse_movement.title',
    descriptionKey: 'reports_hub.cards.warehouse_movement.description',
    icon: Warehouse,
    available: false,
  },
  {
    slug: 'damage-analysis',
    titleKey: 'reports_hub.cards.damage_analysis.title',
    descriptionKey: 'reports_hub.cards.damage_analysis.description',
    icon: ShieldAlert,
    available: false,
  },
  {
    slug: 'purchase-summary',
    titleKey: 'reports_hub.cards.purchase_summary.title',
    descriptionKey: 'reports_hub.cards.purchase_summary.description',
    icon: ShoppingCart,
    available: true,
  },
]

const cardPath = (card: ReportCard) => `/reports/${card.slug}`
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ t('reports_hub.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('reports_hub.subtitle') }}</p>
    </div>

    <div
      v-if="!canViewReports"
      class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
    >
      {{ t('reports_sales_summary.no_permission') }}
    </div>

    <div
      v-else
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <NuxtLink
        v-for="card in reportCards"
        :key="card.slug"
        :to="cardPath(card)"
        class="group block h-full"
      >
        <Card class="h-full overflow-hidden py-0 shadow-sm transition-colors hover:border-primary/40">
          <div class="flex items-center justify-between gap-2 border-b bg-section-items border-section-items px-4 py-3 text-white">
            <div class="flex items-center gap-2">
              <component :is="card.icon" class="size-4 shrink-0" />
              <h2 class="text-sm font-semibold leading-snug">{{ t(card.titleKey) }}</h2>
            </div>
            <Badge
              v-if="!card.available"
              variant="secondary"
              class="border-white/20 bg-white/10 text-white"
            >
              {{ t('reports_hub.coming_soon_title') }}
            </Badge>
          </div>
          <CardContent class="flex h-full flex-col gap-4 px-4 py-4">
            <p class="flex-1 text-sm text-muted-foreground leading-relaxed">
              {{ t(card.descriptionKey) }}
            </p>
            <div class="flex items-center gap-1 text-sm font-medium text-primary">
              <span>{{ card.available ? t('reports_sales_summary.generate_report') : t('reports_hub.coming_soon_title') }}</span>
              <ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </div>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>
