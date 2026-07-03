import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  fitnessClassesApi,
  type VendorFitnessClassCreate,
  type VendorFitnessClassUpdate,
} from '@/api/fitnessClasses'

const KEYS = {
  all: ['vendor-fitness-classes'] as const,
  list: (params?: object) => ['vendor-fitness-classes', 'list', params] as const,
}

export function useFitnessClasses(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => fitnessClassesApi.list(params),
  })
}

export function useCreateFitnessClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorFitnessClassCreate) => fitnessClassesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Class created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create class')),
  })
}

export function useUpdateFitnessClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorFitnessClassUpdate }) =>
      fitnessClassesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Class saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save class')),
  })
}

export function useDeleteFitnessClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fitnessClassesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Class deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete class')),
  })
}

export function useToggleFitnessClassActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      fitnessClassesApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Class updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update class')),
  })
}
