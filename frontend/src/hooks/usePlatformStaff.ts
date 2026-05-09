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

export function usePlatformStaffList() {
  return useQuery({
    queryKey: platformStaffKeys.all,
    queryFn: () => adminApi.listPlatformStaff(),
    staleTime: 30 * 1000,
  })
}

export function useCreatePlatformStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlatformStaffCreatePayload) => adminApi.createPlatformStaff(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformStaffKeys.all })
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
