import { ref } from 'vue'

export interface InvoiceWarehouseOption {
  id: number
  name_ar: string
  name_en: string
  status?: string
}

interface WarehousesResponse {
  data?: {
    warehouses?: InvoiceWarehouseOption[]
    pagination?: { last_page?: number }
  }
  warehouses?: InvoiceWarehouseOption[]
  pagination?: { last_page?: number }
}

export const useInvoiceWarehouses = () => {
  const { $api } = useApi()
  const loadingWarehouses = ref(false)

  const loadActiveWarehouses = async (): Promise<InvoiceWarehouseOption[]> => {
    loadingWarehouses.value = true
    try {
      const aggregated: InvoiceWarehouseOption[] = []
      let page = 1
      let lastPage = 1
      const maxPages = 50

      do {
        const data = await $api<WarehousesResponse>('/warehouses', {
          params: { page, per_page: 100, status: 'active' },
        })
        const list = data.data?.warehouses ?? data.warehouses ?? []
        aggregated.push(...list)
        lastPage = data.data?.pagination?.last_page ?? data.pagination?.last_page ?? 1
        page++
      } while (page <= lastPage && page <= maxPages)

      return aggregated.filter(w => String(w.status ?? 'active').toLowerCase() === 'active')
    }
    finally {
      loadingWarehouses.value = false
    }
  }

  return {
    loadingWarehouses,
    loadActiveWarehouses,
  }
}
