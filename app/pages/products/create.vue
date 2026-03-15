<script setup lang="ts">
import { ArrowRight, PackagePlus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })
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
        <h1 class="text-2xl font-bold tracking-tight">إنشاء منتج</h1>
        <p class="text-sm text-muted-foreground mt-1">أضف منتجاً جديداً إلى المخزون</p>
      </div>
    </div>

    <div class="rounded-lg border p-8 text-center">
      <div class="flex flex-col items-center gap-2 text-muted-foreground">
        <PackagePlus class="size-8 opacity-60" />
        <p class="text-sm font-medium">صفحة إنشاء المنتج جاهزة للموديل/الفورم</p>
        <p class="text-xs">يمكننا الآن ربطها بفورم إضافة المنتج و endpoint الإنشاء.</p>
      </div>
    </div>
  </div>
</template>
