<script setup lang="ts">
export interface SalesDocumentPrintField {
  label: string
  value: string
}

export interface SalesDocumentPrintItem {
  product: string
  description?: string
  variation: string
  qty: string
  unitPrice: string
  discountPercentage: string
  lineDiscount: string
  rowTotal: string
}

export interface SalesDocumentPrintTotal {
  label: string
  value: string
  emphasize?: boolean
}

const props = defineProps<{
  title: string
  reference: string
  fields: SalesDocumentPrintField[]
  descriptionHtml?: string
  descriptionLabel?: string
  itemsLabel: string
  productLabel: string
  variationLabel: string
  qtyLabel: string
  unitPriceLabel: string
  discountPercentageLabel: string
  lineDiscountLabel: string
  rowTotalLabel: string
  items: SalesDocumentPrintItem[]
  totals: SalesDocumentPrintTotal[]
  termsLabel?: string
  termsHtml?: string
  notesLabel?: string
  notesHtml?: string
}>()
</script>

<template>
  <div class="print-sheet hidden print:block text-black bg-white">
    <header class="print-sheet__header flex items-end justify-between gap-4 border-b-2 border-black pb-3">
      <div class="min-w-0">
        <h1 class="text-[18pt] font-bold leading-tight tracking-tight">{{ props.title }}</h1>
      </div>
      <p class="shrink-0 text-[13pt] font-semibold tabular-nums">{{ props.reference }}</p>
    </header>

    <section class="print-sheet__meta mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-[11pt]">
      <div v-for="(field, index) in props.fields" :key="`${field.label}-${index}`" class="min-w-0">
        <p class="text-[9pt] leading-tight text-neutral-600">{{ field.label }}</p>
        <p class="mt-0.5 font-semibold leading-snug whitespace-pre-wrap break-words">{{ field.value || '—' }}</p>
      </div>
    </section>

    <section v-if="props.descriptionHtml" class="mt-4 text-[11pt]">
      <p class="text-[9pt] text-neutral-600">{{ props.descriptionLabel }}</p>
      <div class="rich-text-content prose prose-sm mt-1 max-w-none text-black" v-html="props.descriptionHtml" />
    </section>

    <section class="print-sheet__items mt-5">
      <h2 class="mb-2 text-[12pt] font-bold">{{ props.itemsLabel }}</h2>
      <table class="w-full table-fixed border-collapse text-[10.5pt]">
        <colgroup>
          <col style="width: 28%">
          <col style="width: 14%">
          <col style="width: 8%">
          <col style="width: 12%">
          <col style="width: 12%">
          <col style="width: 13%">
          <col style="width: 13%">
        </colgroup>
        <thead>
          <tr class="border-y-2 border-black text-start">
            <th class="py-2 pe-2 text-start font-bold">{{ props.productLabel }}</th>
            <th class="py-2 pe-2 text-start font-bold">{{ props.variationLabel }}</th>
            <th class="py-2 pe-2 text-start font-bold">{{ props.qtyLabel }}</th>
            <th class="py-2 pe-2 text-start font-bold">{{ props.unitPriceLabel }}</th>
            <th class="py-2 pe-2 text-start font-bold">{{ props.discountPercentageLabel }}</th>
            <th class="py-2 pe-2 text-start font-bold">{{ props.lineDiscountLabel }}</th>
            <th class="py-2 text-start font-bold">{{ props.rowTotalLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in props.items" :key="index" class="border-b border-neutral-400 align-top">
            <td class="py-2 pe-2 text-start">
              <span class="block font-semibold">{{ item.product }}</span>
              <span v-if="item.description" class="mt-0.5 block text-[9pt] text-neutral-600">{{ item.description }}</span>
            </td>
            <td class="py-2 pe-2 text-start break-words">{{ item.variation }}</td>
            <td class="py-2 pe-2 text-start tabular-nums">{{ item.qty }}</td>
            <td class="py-2 pe-2 text-start tabular-nums">{{ item.unitPrice }}</td>
            <td class="py-2 pe-2 text-start tabular-nums">{{ item.discountPercentage }}</td>
            <td class="py-2 pe-2 text-start tabular-nums">{{ item.lineDiscount }}</td>
            <td class="py-2 text-start font-semibold tabular-nums">{{ item.rowTotal }}</td>
          </tr>
          <tr v-if="!props.items.length">
            <td colspan="7" class="py-4 text-center text-neutral-600">—</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="print-sheet__footer mt-6">
      <section class="ms-auto w-full max-w-[42%] space-y-2 text-[11pt]">
        <div
          v-for="(total, index) in props.totals"
          :key="`${total.label}-${index}`"
          class="flex items-baseline justify-between gap-6 border-b border-neutral-300 pb-1.5"
          :class="total.emphasize ? 'border-b-2 border-black pt-1 text-[13pt] font-bold' : ''"
        >
          <span>{{ total.label }}</span>
          <span class="tabular-nums">{{ total.value }}</span>
        </div>
      </section>

      <section v-if="props.termsHtml" class="mt-6 break-inside-avoid text-[10.5pt]">
        <h2 class="mb-1 text-[11pt] font-bold">{{ props.termsLabel }}</h2>
        <div class="rich-text-content prose prose-sm max-w-none text-black" v-html="props.termsHtml" />
      </section>

      <section v-if="props.notesHtml" class="mt-4 break-inside-avoid text-[10.5pt]">
        <h2 class="mb-1 text-[11pt] font-bold">{{ props.notesLabel }}</h2>
        <div class="rich-text-content prose prose-sm max-w-none text-black" v-html="props.notesHtml" />
      </section>
    </footer>
  </div>
</template>
