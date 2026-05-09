import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { serviceApi } from '@/api/service.api'
import type { ServiceCreate, ServiceUpdate } from '@/api/service.api'

export const serviceKeys = {
  all: ['services'] as const,
  list: (params?: Record<string, unknown>) => [...serviceKeys.all, 'list', params] as const,
  detail: (id: string) => [...serviceKeys.all, 'detail', id] as const,
}

export function useServices(params?: {
  page?: number
  size?: number
  status?: string
  category?: string
  search?: string
}) {
  return useQuery({
    queryKey: serviceKeys.list(params as Record<string, unknown>),
    queryFn: () => serviceApi.list(params),
    staleTime: 30_000,
  })
}

export function useService(id: string) {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => serviceApi.get(id),
    enabled: !!id,
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ServiceCreate) => serviceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.all })
      toast.success('Service created')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create service'
      toast.error(msg)
    },
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceUpdate }) => serviceApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.all })
      toast.success('Service updated')
    },
    onError: () => toast.error('Failed to update service'),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => serviceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.all })
      toast.success('Service deleted')
    },
    onError: () => toast.error('Failed to delete service'),
  })
}
