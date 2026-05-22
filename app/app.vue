<script setup lang="ts">
import 'vue-sonner/style.css'
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'

const { locale, localeProperties } = useI18n()

/** Reka UI + HTML: follow each locale’s `dir` in nuxt.config / i18n (e.g. ar → rtl, en → ltr) */
const htmlDir = computed<'ltr' | 'rtl'>(() =>
  localeProperties.value.dir === 'rtl' ? 'rtl' : 'ltr',
)

/** Mirror toast corner so stacks sit on the “end” side per reading direction */
const toasterPosition = computed(() =>
  htmlDir.value === 'rtl' ? 'bottom-left' : 'bottom-right',
)

useHead(() => ({
  title: 'KAMU',
  titleTemplate: (titleChunk?: string) => titleChunk ? `${titleChunk} | KAMU` : 'KAMU',
  htmlAttrs: {
    lang: String(localeProperties.value.language ?? locale.value).split('-')[0],
    dir: htmlDir.value,
  },
  bodyAttrs: {
    dir: htmlDir.value,
  },
}))
</script>

<template>
  <ConfigProvider :dir="htmlDir">
    <div class="min-h-dvh" :dir="htmlDir">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
    <Toaster
      :dir="htmlDir"
      :position="toasterPosition"
    />
  </ConfigProvider>
</template>