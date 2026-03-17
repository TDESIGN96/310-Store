<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'default' })

const route = useRoute()
const userId = route.params.id as string
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <NuxtLink to="/users">
          <ArrowRight class="size-4" />
        </NuxtLink>
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">تعديل المستخدم</h1>
        <p class="text-sm text-muted-foreground mt-1">
          تعديل بيانات المستخدم رقم {{ userId }}
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-8 text-center text-muted-foreground">
      <p>صفحة تعديل المستخدم قيد التطوير.</p>
      <p class="text-sm mt-2">المستخدم: {{ userId }}</p>
    </div>
  </div>
</template>
