<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const allocationId = computed(() => String(route.params.allocationId ?? ''))
const distributorId = computed(() => String(route.query.distributor_id ?? ''))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('distributors_show.stock_allocation_action_edit') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ $t('distributors_show.stock_allocation_stub_subtitle', { id: allocationId }) }}
        </p>
      </div>
    </div>

    <div class="rounded-lg border p-6 text-sm text-muted-foreground">
      {{ $t('distributors_show.stock_allocation_edit_stub_body') }}
    </div>

    <div class="flex items-center gap-2">
      <Button variant="outline" as-child>
        <NuxtLink :to="{ path: `/distributors/show/${distributorId || ''}`, query: { tab: 'stock-allocation' } }">
          {{ $t('distributors_show.back') }}
        </NuxtLink>
      </Button>
    </div>
  </div>
</template>
