<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

const PLACEHOLDER_SLUGS = [] as const

const route = useRoute()
const { t } = useI18n()

const slug = computed(() => String(route.params.slug ?? ''))

if (!PLACEHOLDER_SLUGS.includes(slug.value as typeof PLACEHOLDER_SLUGS[number])) {
  await navigateTo('/reports', { replace: true })
}

const titleKey = computed(() => 'reports_hub.coming_soon_title')
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-4">
    <div class="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-transparent p-10 text-center">
      <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 p-5">
        <Loader2 class="size-10 animate-spin text-primary/70" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t(titleKey) }}
      </h1>
      <p class="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {{ t('reports_hub.coming_soon_desc') }}
      </p>
      <Button
        as-child
        variant="outline"
        class="mt-8"
      >
        <NuxtLink to="/reports" class="inline-flex items-center gap-2">
          <ArrowRight class="size-4 rtl:rotate-180" />
          {{ t('reports_hub.back_to_reports') }}
        </NuxtLink>
      </Button>
    </div>
  </div>
</template>
