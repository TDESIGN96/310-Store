<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const id = computed(() => route.params.id)
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/products">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_page.show_title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('products_page.show_subtitle', { id: String(id) }) }}
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-8 text-center text-muted-foreground">
      <Package class="mx-auto size-10 opacity-40 mb-3" />
      <p class="text-sm">{{ t('products_page.show_placeholder') }}</p>
      <Button class="mt-4 gap-2" variant="outline" as-child>
        <NuxtLink :to="`/products/edit/${id}`">{{ t('common.edit') }}</NuxtLink>
      </Button>
    </div>
  </div>
</template>
