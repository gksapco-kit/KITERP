import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  adminApi,
  type PlatformStaffCreatePayload,
  type PlatformStaffUpdatePayload,
} from '@/api/admin.api'

export const platformStaffKeys = {
  all: ['platform-staff'] as const,
}

export const platformStaffAuditKeys = {
  all: ['platform-staff-audit'] as const,
  me: (page: number, size: number) => [...platformStaffAuditKeys.all, 'me', page, size] as const,
  member: (userId: string, page: number, size: number) =>
    [...platformStaffAuditKeys.all, 'member', userId, page, size] as const,
}

export function usePlatformStaffList() {
  return useQuery({
    queryKey: platformStaffKeys.all,
    queryFn: () => adminApi.listPlatformStaff(),
    staleTime: 30 * 1000,
  })
}

export function usePlatformStaffAudit(scope: 'me' | 'member', memberUserId: string | undefined, page: number, size: number) {
  const enabled = scope === 'me' || !!memberUserId
  return useQuery({
    queryKey:
      scope === 'me'
        ? platformStaffAuditKeys.me(page, size)
        : platformStaffAuditKeys.member(memberUserId!, page, size),
    queryFn: () =>
      scope === 'me'
        ? adminApi.listMyPlatformStaffAudit({ page, size })
        : adminApi.listPlatformStaffAuditForMember(memberUserId!, { page, size }),
    enabled,
    staleTime: 15 * 1000,
  })
}

export function useCreatePlatformStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlatformStaffCreatePayload) => adminApi.createPlatformStaff(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformStaffKeys.all })
      qc.invalidateQueries({ queryKey: platformStaffAuditKeys.all })
      toast.success('Support user added — they can sign in at this admin URL with email or phone.')
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to add support user'
      toast.error(typeof msg === 'string' ? msg : 'Failed to add support user')
    },
  })
}

export function useUpdatePlatformStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: PlatformStaffUpdatePayload }) =>
      adminApi.updatePlatformStaff(userId, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: platformStaffKeys.all })
      qc.invalidateQueries({ queryKey: platformStaffAuditKeys.all })
      if (variables.data.remove_access) {
        toast.success('Platform access removed for this user.')
      } else {
        toast.success('Support user updated.')
      }
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Update failed'
      toast.error(typeof msg === 'string' ? msg : 'Update failed')
    },
  })
}

export function useResetPlatformStaffPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminApi.resetPlatformStaffPassword(userId, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformStaffKeys.all })
      qc.invalidateQueries({ queryKey: platformStaffAuditKeys.all })
      toast.success('Password reset — share the new password with this user securely.')
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not reset password'
      toast.error(typeof msg === 'string' ? msg : 'Could not reset password')
    },
  })
}
