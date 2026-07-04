import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  bookingWizardStepsApi,
  type VendorBookingWizardStepCreate,
  type VendorBookingWizardStepUpdate,
} from '@/api/bookingWizardSteps'

const KEYS = {
  all: ['vendor-booking-wizard-steps'] as const,
  list: (params?: object) => ['vendor-booking-wizard-steps', 'list', params] as const,
}

export function useBookingWizardSteps(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => bookingWizardStepsApi.list(params),
  })
}

export function useCreateBookingWizardStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorBookingWizardStepCreate) => bookingWizardStepsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Step added')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to add step')),
  })
}

export function useUpdateBookingWizardStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorBookingWizardStepUpdate }) =>
      bookingWizardStepsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Step saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save step')),
  })
}

export function useDeleteBookingWizardStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bookingWizardStepsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Step deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete step')),
  })
}

export function useToggleBookingWizardStepActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      bookingWizardStepsApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Step updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update step')),
  })
}
