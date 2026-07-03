import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  propertiesApi,
  type VendorPropertyCreate,
  type VendorPropertyUpdate,
} from '@/api/properties'

const KEYS = {
  all: ['vendor-properties'] as const,
  list: (params?: object) => ['vendor-properties', 'list', params] as const,
}

export function useProperties(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => propertiesApi.list(params),
  })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorPropertyCreate) => propertiesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Property created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create property')),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorPropertyUpdate }) =>
      propertiesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Property saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save property')),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Property deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete property')),
  })
}

export function useTogglePropertyActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      propertiesApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Property updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update property')),
  })
}
