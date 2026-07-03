import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  recurringPlansApi,
  type VendorRecurringPlanCreate,
  type VendorRecurringPlanUpdate,
} from '@/api/recurringPlans'

const KEYS = {
  all: ['vendor-recurring-plans'] as const,
  list: (params?: object) => ['vendor-recurring-plans', 'list', params] as const,
}

export function useRecurringPlans(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => recurringPlansApi.list(params),
  })
}

export function useCreateRecurringPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorRecurringPlanCreate) => recurringPlansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Recurring plan created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create recurring plan')),
  })
}

export function useUpdateRecurringPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorRecurringPlanUpdate }) =>
      recurringPlansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Recurring plan saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save recurring plan')),
  })
}

export function useDeleteRecurringPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => recurringPlansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Recurring plan deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete recurring plan')),
  })
}

export function useToggleRecurringPlanActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      recurringPlansApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Recurring plan updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update recurring plan')),
  })
}
