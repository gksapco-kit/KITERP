import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { adminApi, type ListVendorsParams, type AdminVendorUpdatePayload } from '@/api/admin.api'

export const adminKeys = {
  all: ['admin'] as const,
  vendors: () => [...adminKeys.all, 'vendors'] as const,
  vendorsList: (params?: ListVendorsParams) => [...adminKeys.vendors(), params] as const,
  vendorStats: () => [...adminKeys.all, 'vendor-stats'] as const,
  vendor: (id: string) => [...adminKeys.vendors(), id] as const,
}

export function useAdminVendorStats() {
  return useQuery({
    queryKey: adminKeys.vendorStats(),
    queryFn: () => adminApi.getVendorStats(),
    staleTime: 30 * 1000,
  })
}

export function useAdminVendors(params?: ListVendorsParams) {
  return useQuery({
    queryKey: adminKeys.vendorsList(params),
    queryFn: () => adminApi.listVendors(params),
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useAdminVendor(vendorId: string) {
  return useQuery({
    queryKey: adminKeys.vendor(vendorId),
    queryFn: () => adminApi.getVendor(vendorId),
    enabled: !!vendorId,
  })
}

export function useVendorOwner(vendorId: string) {
  return useQuery({
    queryKey: [...adminKeys.vendor(vendorId), 'owner'] as const,
    queryFn: () => adminApi.getVendorOwner(vendorId),
    enabled: !!vendorId,
  })
}

export function useUpdateAdminVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ vendorId, data }: { vendorId: string; data: AdminVendorUpdatePayload }) =>
      adminApi.updateVendor(vendorId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendor(variables.vendorId) })
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
      queryClient.invalidateQueries({ queryKey: adminKeys.vendorStats() })
      toast.success('Vendor updated successfully!')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update vendor'
      toast.error(message)
    },
  })
}

export function useApproveVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vendorId: string) => adminApi.approveVendor(vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
      queryClient.invalidateQueries({ queryKey: adminKeys.vendorStats() })
      toast.success('Vendor approved successfully!')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to approve vendor'
      toast.error(message)
    },
  })
}

export function useRejectVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ vendorId, reason }: { vendorId: string; reason: string }) =>
      adminApi.rejectVendor(vendorId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
      toast.success('Vendor rejected.')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to reject vendor'
      toast.error(message)
    },
  })
}
