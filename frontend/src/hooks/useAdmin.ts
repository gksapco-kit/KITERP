import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  adminApi,
  type ListVendorsParams,
  type AdminVendorUpdatePayload,
} from '@/api/admin.api'
import { platformStaffKeys } from '@/hooks/usePlatformStaff'

export const adminKeys = {
  all: ['admin'] as const,
  vendors: () => [...adminKeys.all, 'vendors'] as const,
  vendorsList: (params?: ListVendorsParams) => [...adminKeys.vendors(), params] as const,
  vendorStats: () => [...adminKeys.all, 'vendor-stats'] as const,
  vendor: (id: string) => [...adminKeys.vendors(), id] as const,
  relationshipManagerOptions: () => [...adminKeys.all, 'relationship-manager-options'] as const,
}

export function useAdminVendorStats() {
  return useQuery({
    queryKey: adminKeys.vendorStats(),
    queryFn: () => adminApi.getVendorStats(),
    staleTime: 30 * 1000,
  })
}

export function useAdminVendors(
  params?: ListVendorsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: adminKeys.vendorsList(params),
    queryFn: () => adminApi.listVendors(params!),
    staleTime: 30 * 1000, // 30 seconds
    enabled: options?.enabled ?? true,
  })
}

export function useRelationshipManagerOptions(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.relationshipManagerOptions(),
    queryFn: () => adminApi.listRelationshipManagerOptions(),
    staleTime: 60 * 1000,
    enabled,
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
      if ('relationship_manager_user_id' in variables.data) {
        queryClient.invalidateQueries({ queryKey: platformStaffKeys.all })
      }
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

export function useDeleteVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vendorId: string) => adminApi.deleteVendor(vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
      queryClient.invalidateQueries({ queryKey: adminKeys.vendorStats() })
      toast.success('Business account deleted.')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete business account'
      toast.error(message)
    },
  })
}

/** Approve a vendor's domain request (set access_status → active) */
export function useApproveDomainRequest(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      adminApi.updateVendor(vendorId, { external_domain_access_status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendor(vendorId) })
      toast.success('Domain request approved — status set to Active.')
    },
    onError: () => toast.error('Failed to approve domain request.'),
  })
}

/** Reject / revoke a vendor's domain request (set access_status → revoked) */
export function useRejectDomainRequest(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      adminApi.updateVendor(vendorId, { external_domain_access_status: 'revoked' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendor(vendorId) })
      toast.success('Domain request revoked.')
    },
    onError: () => toast.error('Failed to revoke domain request.'),
  })
}

export function useVendorRmQueriesForVendor(vendorId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: vendorId ? ([...adminKeys.vendor(vendorId), 'rm-queries'] as const) : ['admin', 'rm-queries', 'noop'],
    queryFn: () =>
      adminApi.listVendorRmQueries({
        vendor_id: vendorId,
        page: 1,
        size: 100,
      }),
    enabled: Boolean(vendorId && enabled),
    staleTime: 15 * 1000,
  })
}

export function usePatchVendorRmQueryStatus(vendorId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      queryId,
      status,
    }: {
      queryId: string
      status: 'open' | 'in_progress' | 'closed'
    }) => adminApi.patchVendorRmQuery(queryId, status),
    onSuccess: () => {
      if (vendorId) {
        queryClient.invalidateQueries({ queryKey: [...adminKeys.vendor(vendorId), 'rm-queries'] })
      }
      toast.success('Query status updated')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update query'
      toast.error(typeof message === 'string' ? message : 'Failed to update query')
    },
  })
}
