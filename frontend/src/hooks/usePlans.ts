import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { plansApi, type PlanCreate, type PlanUpdate } from '@/api/plans.api'

export const planKeys = {
  all: ['plans'] as const,
  list: () => [...planKeys.all, 'list'] as const,
  vendorPlan: (vendorId: string) => [...planKeys.all, 'vendor', vendorId] as const,
}

export function usePlans() {
  return useQuery({
    queryKey: planKeys.list(),
    queryFn: plansApi.list,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanCreate) => plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.list() })
      toast.success('Plan created')
    },
    onError: () => toast.error('Failed to create plan'),
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: PlanUpdate }) =>
      plansApi.update(planId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.list() })
      toast.success('Plan updated')
    },
    onError: () => toast.error('Failed to update plan'),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => plansApi.delete(planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all })
      toast.success('Plan deleted. Vendors on this plan no longer have it assigned.')
    },
    onError: () => toast.error('Failed to delete plan'),
  })
}

export function useUpdatePlanFeatures() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, features }: { planId: string; features: Record<string, boolean> }) =>
      plansApi.updateFeatures(planId, features),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all })
      toast.success('Plan features updated')
    },
    onError: () => toast.error('Failed to update features'),
  })
}

export function useVendorPlan(vendorId: string) {
  return useQuery({
    queryKey: planKeys.vendorPlan(vendorId),
    queryFn: () => plansApi.getVendorPlan(vendorId),
    enabled: !!vendorId,
  })
}

export function useAssignPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorId, planId }: { vendorId: string; planId: string }) =>
      plansApi.assignPlanToVendor(vendorId, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all })
      toast.success('Plan assigned to vendor')
    },
    onError: () => toast.error('Failed to assign plan'),
  })
}
