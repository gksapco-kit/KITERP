import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { yieldApi, type YieldDayCloseInput, type YieldProfileInput } from '@/api/yield'

const KEYS = {
  all: ['vendor-yield'] as const,
  profiles: ['vendor-yield', 'profiles'] as const,
  templates: ['vendor-yield', 'templates'] as const,
  products: ['vendor-yield', 'products'] as const,
  day: (date: string) => ['vendor-yield', 'day', date] as const,
}

export function useYieldProfiles() {
  return useQuery({ queryKey: KEYS.profiles, queryFn: yieldApi.listProfiles, staleTime: 60_000 })
}

export function useYieldTemplates() {
  return useQuery({ queryKey: KEYS.templates, queryFn: yieldApi.templates, staleTime: Infinity })
}

export function useYieldProducts() {
  return useQuery({ queryKey: KEYS.products, queryFn: yieldApi.products, staleTime: 30_000 })
}

export function useYieldDay(date: string) {
  return useQuery({ queryKey: KEYS.day(date), queryFn: () => yieldApi.day(date), enabled: !!date })
}

export function useSaveYieldProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: YieldProfileInput }) =>
      id ? yieldApi.updateProfile(id, data) : yieldApi.createProfile(data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.profiles })
      toast.success(vars.id ? 'Yield profile saved' : 'Yield profile created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save yield profile')),
  })
}

export function useDeleteYieldProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => yieldApi.deleteProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.profiles })
      toast.success('Yield profile deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete yield profile')),
  })
}

export function useCloseYieldDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: YieldDayCloseInput) => yieldApi.closeDay(data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.day(vars.business_date) })
      qc.invalidateQueries({ queryKey: KEYS.products })
      toast.success('Day closed')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to close the day')),
  })
}

export function useReopenYieldDay(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (closeId: string) => yieldApi.reopenDay(closeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.day(date) })
      toast.success('Day reopened')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to reopen the day')),
  })
}
