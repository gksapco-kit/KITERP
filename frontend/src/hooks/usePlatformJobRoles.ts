import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  adminApi,
  type PlatformJobRoleCreatePayload,
  type PlatformJobRoleUpdatePayload,
} from '@/api/admin.api'

export const platformJobRoleKeys = {
  all: ['platform-job-roles'] as const,
  list: (includeInactive = false) => [...platformJobRoleKeys.all, 'list', includeInactive] as const,
  permissions: () => [...platformJobRoleKeys.all, 'permissions'] as const,
}

export function usePlatformJobRoles(includeInactive = false) {
  return useQuery({
    queryKey: platformJobRoleKeys.list(includeInactive),
    queryFn: () => adminApi.listPlatformJobRoles({ include_inactive: includeInactive }),
    staleTime: 30 * 1000,
  })
}

export function usePlatformJobRolePermissions() {
  return useQuery({
    queryKey: platformJobRoleKeys.permissions(),
    queryFn: () => adminApi.listPlatformJobRolePermissions(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePlatformJobRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlatformJobRoleCreatePayload) => adminApi.createPlatformJobRole(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformJobRoleKeys.all })
      toast.success('Role created')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not create role')
    },
  })
}

export function useUpdatePlatformJobRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: PlatformJobRoleUpdatePayload }) =>
      adminApi.updatePlatformJobRole(roleId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformJobRoleKeys.all })
      toast.success('Role updated')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not update role')
    },
  })
}

export function useDeletePlatformJobRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => adminApi.deletePlatformJobRole(roleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformJobRoleKeys.all })
      toast.success('Role deleted')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not delete role')
    },
  })
}
