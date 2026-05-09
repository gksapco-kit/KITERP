import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productApi } from '@/api/product.api'
import type { ProductCreate, ProductUpdate } from '@/types/product'

export const productKeys = {
  all: ['products'] as const,
  list: (params?: Record<string, unknown>) => [...productKeys.all, 'list', params] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}

export function useProducts(params?: {
  page?: number
  size?: number
  status?: string
  category?: string
  search?: string
}) {
  return useQuery({
    queryKey: productKeys.list(params as Record<string, unknown>),
    queryFn: () => productApi.list(params),
    staleTime: 30_000,
  })
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: () => productApi.get(productId),
    enabled: !!productId,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProductCreate) => productApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      toast.success('Product created')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create product'
      toast.error(msg)
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) => productApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      toast.success('Product updated')
    },
    onError: () => toast.error('Failed to update product'),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      toast.success('Product deleted')
    },
    onError: () => toast.error('Failed to delete product'),
  })
}
