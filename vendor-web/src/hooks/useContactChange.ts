import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { contactChangeApi, type ContactFieldType } from '@/api/contactChange'
import { authKeys } from '@/hooks/useAuth'
import { apiError } from '@/lib/errorMessages'

export const contactChangeKeys = {
  all: ['contact-change-requests'] as const,
  mine: () => [...contactChangeKeys.all, 'mine'] as const,
}

export function useMyContactChangeRequests() {
  return useQuery({
    queryKey: contactChangeKeys.mine(),
    queryFn: () => contactChangeApi.listMine(),
  })
}

export function useCreateContactChangeRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: contactChangeApi.create,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: contactChangeKeys.mine() })
      toast.success(
        variables.field_type === 'email'
          ? 'Email change request submitted for approval'
          : 'Phone change request submitted for approval',
      )
    },
    onError: apiError('Could not submit change request'),
  })
}

export function useCancelContactChangeRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: contactChangeApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactChangeKeys.mine() })
      toast.success('Change request cancelled')
    },
    onError: apiError('Could not cancel request'),
  })
}

export function pendingContactChange(
  requests: { field_type: ContactFieldType; status: string }[] | undefined,
  field: ContactFieldType,
) {
  return requests?.find(r => r.field_type === field && r.status === 'pending')
}
