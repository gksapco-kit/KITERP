import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  bookingResourcesApi,
  type VendorBookingResourceCreate,
  type VendorBookingResourceUpdate,
} from '@/api/bookingResources'

const KEYS = {
  all: ['vendor-booking-resources'] as const,
  list: (params?: object) => ['vendor-booking-resources', 'list', params] as const,
}

export function useBookingResources(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => bookingResourcesApi.list(params),
  })
}

export function useCreateBookingResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorBookingResourceCreate) => bookingResourcesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Resource added')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to add resource')),
  })
}

export function useUpdateBookingResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorBookingResourceUpdate }) =>
      bookingResourcesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Resource saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save resource')),
  })
}

export function useDeleteBookingResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bookingResourcesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Resource deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete resource')),
  })
}

export function useToggleBookingResourceActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      bookingResourcesApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Resource updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update resource')),
  })
}

export function useToggleBookingResourceAvailable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_available }: { id: string; is_available: boolean }) =>
      bookingResourcesApi.update(id, { is_available }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Resource updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update resource')),
  })
}
