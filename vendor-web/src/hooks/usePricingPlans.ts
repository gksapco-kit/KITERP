import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  pricingPlansApi,
  type PricingPlanCreate,
  type PricingPlanUpdate,
} from '@/api/pricingPlans'

const KEYS = {
  all: ['pricing-plans'] as const,
  list: (params?: object) => ['pricing-plans', 'list', params] as const,
}

export function usePricingPlans(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => pricingPlansApi.list(params),
  })
}

export function useCreatePricingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PricingPlanCreate) => pricingPlansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Plan created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create plan')),
  })
}

export function useUpdatePricingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PricingPlanUpdate }) =>
      pricingPlansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Plan saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save plan')),
  })
}

export function useDeletePricingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pricingPlansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Plan deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete plan')),
  })
}

export function useTogglePricingPlanActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      pricingPlansApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Plan updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update plan')),
  })
}
