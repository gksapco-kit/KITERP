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

interface MaterialsPreviewItem {
  item_type?: string
  product_id: string
  qty: number
  name?: string
}

/**
 * Live BOM/MRP explosion preview for a production order's finished-product
 * line items — used to show required materials + stock availability before
 * (or regardless of) the order being confirmed/reserved.
 */
export function useProductionMaterialsPreview(
  order: { id: string; store_id?: string | null; items?: MaterialsPreviewItem[] } | null,
) {
  const productItems = (order?.items || []).filter(
    (i) => (i.item_type ?? 'product') === 'product' && i.product_id && i.qty > 0,
  )
  return useQuery({
    queryKey: ['production-mrp-preview', order?.id, order?.store_id, JSON.stringify(productItems)],
    queryFn: () =>
      vendorApi.calculateMRP({
        items: productItems.map((i) => ({ product_id: i.product_id, qty: i.qty, name: i.name })),
        order_type: 'production_order',
        order_id: order!.id,
        store_id: order?.store_id || undefined,
      }),
    enabled: !!order?.id && productItems.length > 0,
    staleTime: 15_000,
  })
}

// ── Work Centers & Routing Operations (Phase 5) ────────────────────────────

export const workCenterKeys = {
  all: ['work-centers'] as const,
  list: (params?: Record<string, unknown>) => [...workCenterKeys.all, 'list', params] as const,
}

export function useWorkCenters(params?: { is_active?: boolean; plant_id?: string }) {
  return useQuery({
    queryKey: workCenterKeys.list(params),
    queryFn: async () => (await vendorApi.listWorkCenters(params)).items,
    staleTime: 30_000,
  })
}

export function useCreateWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createWorkCenter(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workCenterKeys.all })
      toast.success('Work center created')
    },
    onError: apiError('Could not create work center'),
  })
}

export function useUpdateWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      vendorApi.updateWorkCenter(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workCenterKeys.all })
      toast.success('Work center updated')
    },
    onError: apiError('Could not update work center'),
  })
}

export function useDeleteWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorApi.deleteWorkCenter(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workCenterKeys.all })
      toast.success('Work center removed')
    },
    onError: apiError('Could not remove work center'),
  })
}

export const productionOperationKeys = {
  all: ['production-operations'] as const,
  list: (orderId: string) => [...productionOperationKeys.all, orderId] as const,
}

export function useProductionOperations(orderId: string | null) {
  return useQuery({
    queryKey: productionOperationKeys.list(orderId ?? ''),
    queryFn: async () => (await vendorApi.listProductionOperations(orderId!)).items,
    enabled: !!orderId,
    staleTime: 5_000,
  })
}

export function useCreateProductionOperation(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorApi.createProductionOperation(orderId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionOperationKeys.list(orderId) })
      toast.success('Operation added')
    },
    onError: apiError('Could not add operation'),
  })
}

export function useUpdateProductionOperation(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ opId, data }: { opId: string; data: Record<string, unknown> }) =>
      vendorApi.updateProductionOperation(orderId, opId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionOperationKeys.list(orderId) })
    },
    onError: apiError('Could not update operation'),
  })
}

export function useDeleteProductionOperation(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opId: string) => vendorApi.deleteProductionOperation(orderId, opId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionOperationKeys.list(orderId) })
      toast.success('Operation removed')
    },
    onError: apiError('Could not remove operation'),
  })
}

export function useReorderProductionOperations(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => vendorApi.reorderProductionOperations(orderId, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionOperationKeys.list(orderId) })
    },
    onError: apiError('Could not reorder operations'),
  })
}

export function useProductionAnalytics(params?: { store_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['production-analytics', params],
    queryFn: () => vendorApi.getProductionAnalytics(params),
    staleTime: 30_000,
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
