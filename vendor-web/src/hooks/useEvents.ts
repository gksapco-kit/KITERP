import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  eventsApi,
  type VendorEventCreate,
  type VendorEventUpdate,
} from '@/api/events'

const KEYS = {
  all: ['vendor-events'] as const,
  list: (params?: object) => ['vendor-events', 'list', params] as const,
}

export function useEvents(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => eventsApi.list(params),
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorEventCreate) => eventsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Event created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create event')),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorEventUpdate }) =>
      eventsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Event saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save event')),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Event deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete event')),
  })
}

export function useToggleEventActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      eventsApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Event updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update event')),
  })
}
