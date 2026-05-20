import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { apiError } from '@/lib/errorMessages'
import { useVendorStore } from '@/stores/vendorStore'

const STORAGE_KEY = 'production_orders_v1'
const MIGRATED_KEY = 'production_orders_db_migrated_v1'

export const productionOrderKeys = {
  all: ['production-orders'] as const,
  list: (params?: Record<string, unknown>) => [...productionOrderKeys.all, 'list', params] as const,
  detail: (id: string) => [...productionOrderKeys.all, 'detail', id] as const,
}

function loadLocalOrders(): Record<string, unknown>[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function useProductionOrders(params?: {
  store_id?: string
  type?: string
  status?: string
  search?: string
}) {
  const queryParams = { ...params, size: 500 }
  return useQuery({
    queryKey: productionOrderKeys.list(queryParams),
    queryFn: async () => {
      const res = await vendorApi.listProductionOrders(queryParams)
      return (res.items || []) as Record<string, unknown>[]
    },
    staleTime: 10_000,
  })
}

export function useProductionOrder(id: string | null) {
  return useQuery({
    queryKey: productionOrderKeys.detail(id ?? ''),
    queryFn: () => vendorApi.getProductionOrder(id!),
    enabled: !!id,
  })
}

export function useCreateProductionOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createProductionOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionOrderKeys.all })
      toast.success('Production order created')
    },
    onError: apiError('Could not create production order'),
  })
}

export function useUpdateProductionOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      vendorApi.updateProductionOrder(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productionOrderKeys.all })
      qc.invalidateQueries({ queryKey: productionOrderKeys.detail(v.id) })
    },
    onError: apiError('Could not update production order'),
  })
}

export function useDeleteProductionOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteProductionOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionOrderKeys.all })
      toast.success('Order deleted')
    },
    onError: apiError('Could not delete production order'),
  })
}

export function useImportLocalProductionOrders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { orders: Record<string, unknown>[]; default_store_id?: string }) =>
      vendorApi.importLocalProductionOrders(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: productionOrderKeys.all })
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(MIGRATED_KEY, '1')
      toast.success(`Imported ${res.created} order(s) from this browser`)
    },
    onError: apiError('Could not import local orders'),
  })
}

/** One-time migration from localStorage + refetch when store filter changes. */
export function useProductionOrdersBootstrap() {
  const { selectedStore } = useVendorStore()
  const importLocal = useImportLocalProductionOrders()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || localStorage.getItem(MIGRATED_KEY)) return
    const local = loadLocalOrders()
    if (!local.length) {
      localStorage.setItem(MIGRATED_KEY, '1')
      return
    }
    ran.current = true
    importLocal.mutate({
      orders: local,
      default_store_id: selectedStore?.id,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore?.id])
}
