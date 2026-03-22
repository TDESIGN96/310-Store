<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, PackagePlus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

const { t } = useI18n()

/**
 * When the product form is implemented, use:
 * `const { getErrorMessage, getFieldErrors, isValidationError } = useApiError()`
 * and `const { t } = useI18n()` — reset errors on submit; 422 → getFieldErrors; else getErrorMessage.
 */
const formError = ref('')
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
        <h1 class="text-2xl font-bold tracking-tight">{{ t('products_create.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('products_create.subtitle') }}</p>
      </div>
    </div>

    <div
      v-if="formError"
      class="rounded-md bg-red-500/10 border border-red-200 text-red-600 text-sm px-4 py-3"
    >
      {{ formError }}
    </div>

    <div class="rounded-lg border p-8 text-center">
      <div class="flex flex-col items-center gap-2 text-muted-foreground">
        <PackagePlus class="size-8 opacity-60" />
        <p class="text-sm font-medium">{{ t('products_create.ready') }}</p>
        <p class="text-xs">{{ t('products_create.ready_hint') }}</p>
      </div>
    </div>
  </div>
</template>
