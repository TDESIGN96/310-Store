<script setup lang="ts">
import type { Component } from "vue"
import { computed } from "vue"
import { Loader2 } from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ActionType = "link" | "button"
type ActionTone = "default" | "danger" | "warning" | "success" | "muted"
type ActionAlign = "start" | "end"
type ActionVariant = "invoice" | "link"

export interface TableRowActionItem {
  key: string
  label: string
  type: ActionType
  to?: string
  onClick?: () => void
  icon?: Component
  visible?: boolean
  disabled?: boolean
  loading?: boolean
  tone?: ActionTone
  class?: string
}

const props = withDefaults(defineProps<{
  actions: TableRowActionItem[]
  align?: ActionAlign
  variant?: ActionVariant
}>(), {
  align: "end",
  variant: "invoice",
})

const alignClass = computed(() => (props.align === "start" ? "justify-start" : "justify-end"))

const visibleActions = computed(() => props.actions.filter(action => action.visible !== false))

const toneClass = (action: TableRowActionItem) => cn(
  (action.tone === "default" || !action.tone) && "text-[#000]",
  action.tone === "danger" && "text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30",
  action.tone === "warning" && "text-amber-700 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30",
  action.tone === "success" && "text-green-700 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30",
  action.tone === "muted" && "text-muted-foreground border-muted hover:text-foreground",
)

const invoiceActionClass = (action: TableRowActionItem) => cn(
  "h-8  px-2",
  toneClass(action),
  action.class,
)

const linkActionClass = (action: TableRowActionItem) => cn(
  "h-8 px-2",
  toneClass(action),
  action.class,
)

const handleClick = (action: TableRowActionItem) => {
  if (action.disabled || action.loading) {
    return
  }
  action.onClick?.()
}
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-wrap items-center',
        alignClass,
        variant === 'invoice' ? 'gap-1' : 'gap-1',
      )
    "
  >
    <template v-for="action in visibleActions" :key="action.key">
      <template v-if="variant === 'invoice'">
        <Button
          v-if="action.type === 'link' && action.to"
          variant="outline"
          size="sm"
          :class="invoiceActionClass(action)"
          :disabled="action.disabled || action.loading"
          as-child
        >
          <NuxtLink :to="action.to">
            <Loader2 v-if="action.loading" class="size-3.5 animate-spin" />
            <component :is="action.icon" v-else-if="action.icon" class="size-3.5" />
            {{ action.label }}
          </NuxtLink>
        </Button>
        <Button
          v-else
          variant="outline"
          size="sm"
          :class="invoiceActionClass(action)"
          :disabled="action.disabled || action.loading"
          @click="handleClick(action)"
        >
          <Loader2 v-if="action.loading" class="size-3.5 animate-spin" />
          <component :is="action.icon" v-else-if="action.icon" class="size-3.5" />
          {{ action.label }}
        </Button>
      </template>

      <template v-else>
        <Button
          v-if="action.type === 'link' && action.to"
          variant="outline"
          size="sm"
          :class="linkActionClass(action)"
          :disabled="action.disabled || action.loading"
          as-child
        >
          <NuxtLink
            :to="action.to"
            :aria-disabled="action.disabled || action.loading ? 'true' : undefined"
            @click.prevent="action.disabled || action.loading"
          >
            <Loader2 v-if="action.loading" class="size-3.5 animate-spin" />
            <component :is="action.icon" v-else-if="action.icon" class="size-3.5" />
            {{ action.label }}
          </NuxtLink>
        </Button>
        <Button
          v-else
          variant="outline"
          size="sm"
          :class="linkActionClass(action)"
          :disabled="action.disabled || action.loading"
          @click="handleClick(action)"
        >
          <Loader2 v-if="action.loading" class="size-3.5 animate-spin" />
          <component :is="action.icon" v-else-if="action.icon" class="size-3.5" />
          {{ action.label }}
        </Button>
      </template>
    </template>
  </div>
</template>
