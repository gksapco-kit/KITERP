import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  vehiclesApi,
  type VendorVehicleCreate,
  type VendorVehicleUpdate,
} from '@/api/vehicles'

const KEYS = {
  all: ['vendor-vehicles'] as const,
  list: (params?: object) => ['vendor-vehicles', 'list', params] as const,
}

export function useVehicles(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => vehiclesApi.list(params),
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorVehicleCreate) => vehiclesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Vehicle created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create vehicle')),
  })
}

export function useUpdateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorVehicleUpdate }) =>
      vehiclesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Vehicle saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save vehicle')),
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Vehicle deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete vehicle')),
  })
}

export function useToggleVehicleActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      vehiclesApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Vehicle updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update vehicle')),
  })
}
