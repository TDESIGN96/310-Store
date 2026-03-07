<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'

interface KpiCard {
  id: string
  title: string
  value: string
  change: string
  changeType: 'up' | 'down' | 'neutral'
  description: string        // ← add this
  subtitle?: string          // ← add this (optional)
  icon: any
  color: string
  bg: string
  roles: string[]
  link: string
}

defineProps<KpiCard>()
</script>

<template>
  <Card class="rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all">
    <CardContent class="p-5">

      <!-- Top row: change badge + title -->
      <div class="flex items-center justify-between gap-2 mb-3">

        <!-- Change Badge -->
        <div
          :class="[
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border',
            changeType === 'up'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : changeType === 'down'
                ? 'bg-red-50 text-red-500 border-red-200'
                : 'bg-muted text-muted-foreground border-border'
          ]"
        >
          <TrendingUp   v-if="changeType === 'up'"      class="size-3" />
          <TrendingDown v-else-if="changeType === 'down'" class="size-3" />
          <Minus        v-else                            class="size-3" />
          <span>{{ change }}</span>
        </div>

        <!-- Title -->
        <span class="text-sm text-muted-foreground font-medium">{{ title }}</span>

      </div>

      <!-- Value -->
      <p class="text-3xl font-bold tracking-tight text-foreground text-right mb-3">
        {{ value }}
      </p>

      <!-- Divider -->
      <div class="border-t border-border/50 pt-3">
        <!-- Description -->
        <p class="text-sm font-semibold text-foreground text-right leading-snug">
          {{ description }}
        </p>
        <!-- Subtitle -->
        <p v-if="subtitle" class="text-xs text-muted-foreground text-right mt-0.5">
          {{ subtitle }}
        </p>
      </div>

    </CardContent>
  </Card>
</template>