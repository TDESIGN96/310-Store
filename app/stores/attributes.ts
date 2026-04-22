import { defineStore } from 'pinia'

export interface AttributeValueOption {
  id: number
  attribute_id: number
  name: string
  sort_order: number
}

export interface AttributeOption {
  id: number
  name: string
  values: AttributeValueOption[]
}

interface AttributesListResponse {
  data?: {
    attributes?: Array<{
      id: number
      name?: string
      values?: Array<{
        id: number
        attribute_id: number
        name: string
        sort_order: number
      }>
    }>
  }
  attributes?: Array<{
    id: number
    name?: string
    values?: Array<{
      id: number
      attribute_id: number
      name: string
      sort_order: number
    }>
  }>
}

export const useAttributesStore = defineStore('attributes', () => {
  const options = ref<AttributeOption[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const optionById = computed(() => new Map(options.value.map(a => [a.id, a])))

  const valuesByAttributeId = computed(() => {
    const map = new Map<number, AttributeValueOption[]>()
    for (const attr of options.value) {
      map.set(attr.id, [...attr.values].sort((a, b) => a.sort_order - b.sort_order))
    }
    return map
  })

  const valueById = computed(() => {
    const map = new Map<number, AttributeValueOption>()
    for (const attr of options.value) {
      for (const v of attr.values) map.set(v.id, v)
    }
    return map
  })

  const valueName = (id: number) => valueById.value.get(id)?.name ?? `#${id}`
  const attributeName = (id: number) => optionById.value.get(id)?.name ?? `#${id}`

  const load = async (force = false) => {
    if (loading.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      const { $api } = useApi()
      const res = await $api<AttributesListResponse>('/attributes', {
        params: { page: 1, per_page: 100 },
      })
      const list = res.data?.attributes ?? res.attributes ?? []
      options.value = list.map(attr => ({
        id: Number(attr.id),
        name: String(attr.name ?? ''),
        values: (attr.values ?? []).map(v => ({
          id: Number(v.id),
          attribute_id: Number(v.attribute_id),
          name: String(v.name ?? ''),
          sort_order: Number(v.sort_order ?? 0),
        })),
      }))
      loaded.value = true
    }
    finally {
      loading.value = false
    }
  }

  return {
    options,
    loading,
    loaded,
    optionById,
    valuesByAttributeId,
    valueById,
    load,
    valueName,
    attributeName,
  }
})
