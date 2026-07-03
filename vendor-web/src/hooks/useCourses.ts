import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  coursesApi,
  type VendorCourseCreate,
  type VendorCourseUpdate,
} from '@/api/courses'

const KEYS = {
  all: ['vendor-courses'] as const,
  list: (params?: object) => ['vendor-courses', 'list', params] as const,
}

export function useCourses(params?: {
  page?: number
  size?: number
  search?: string
  is_active?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => coursesApi.list(params),
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorCourseCreate) => coursesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Course created')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to create course')),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorCourseUpdate }) =>
      coursesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Course saved')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to save course')),
  })
}

export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => coursesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Course deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete course')),
  })
}

export function useToggleCourseActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      coursesApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Course updated')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to update course')),
  })
}
