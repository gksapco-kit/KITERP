import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  testimonialsApi,
  type VendorTestimonialCreate,
  type VendorTestimonialUpdate,
} from '@/api/testimonials'

const KEYS = {
  all: ['vendor-testimonials'] as const,
  list: (params?: object) => ['vendor-testimonials', 'list', params] as const,
}

export function useTestimonials(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => testimonialsApi.list(params),
  })
}

export function useCreateTestimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorTestimonialCreate) => testimonialsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Testimonial created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create testimonial')),
  })
}

export function useUpdateTestimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorTestimonialUpdate }) =>
      testimonialsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Testimonial saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save testimonial')),
  })
}

export function useDeleteTestimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => testimonialsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Testimonial deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete testimonial')),
  })
}

export function useToggleTestimonialActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      testimonialsApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Testimonial updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update testimonial')),
  })
}
