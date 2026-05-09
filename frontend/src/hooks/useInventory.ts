import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inventoryApi } from '@/api/inventory.api'
import type { StockAdjustment, BulkStockUpdate } from '@/api/inventory.api'

export const inventoryKeys = {
  all: ['inventory'] as const,
  summary: () => [...inventoryKeys.all, 'summary'] as const,
  history: (params?: Record<string, unknown>) => [...inventoryKeys.all, 'history', params] as const,
  lowStock: () => [...inventoryKeys.all, 'low-stock'] as const,
}

export function useStockSummary() {
  return useQuery({
    queryKey: inventoryKeys.summary(),
    queryFn: () => inventoryApi.getSummary(),
    staleTime: 15_000,
  })
}

export function useInventoryHistory(params?: {
  product_id?: string
  movement_type?: string
  page?: number
  size?: number
}) {
  return useQuery({
    queryKey: inventoryKeys.history(params as Record<string, unknown>),
    queryFn: () => inventoryApi.getHistory(params),
    staleTime: 15_000,
  })
}

export function useLowStockAlerts() {
  return useQuery({
    queryKey: inventoryKeys.lowStock(),
    queryFn: () => inventoryApi.getLowStock(),
    staleTime: 30_000,
  })
}

export function useStockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StockAdjustment) => inventoryApi.stockIn(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock added successfully')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to add stock'
      toast.error(msg)
    },
  })
}

export function useStockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StockAdjustment) => inventoryApi.stockOut(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock removed successfully')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to remove stock'
      toast.error(msg)
    },
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BulkStockUpdate) => inventoryApi.adjust(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock adjusted')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to adjust stock'
      toast.error(msg)
    },
  })
}
