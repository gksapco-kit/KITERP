import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blogApi, type BlogPostCreate, type BlogPostUpdate } from '@/api/blog'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const KEYS = {
  all: ['blog'] as const,
  list: (params?: object) => ['blog', 'list', params] as const,
  detail: (id: string) => ['blog', 'detail', id] as const,
  settings: ['blog', 'settings'] as const,
}

export function useBlogPosts(params?: {
  page?: number
  size?: number
  search?: string
  is_published?: boolean
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => blogApi.list(params),
  })
}

export function useBlogPost(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => blogApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateBlogPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BlogPostCreate) => blogApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Blog post created')
    },
    onError: () => toast.error('Failed to create post'),
  })
}

export function useUpdateBlogPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlogPostUpdate }) =>
      blogApi.update(id, data),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      toast.success('Post saved')
    },
    onError: () => toast.error('Failed to save post'),
  })
}

export function useDeleteBlogPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => blogApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success('Post deleted')
    },
    onError: () => toast.error('Failed to delete post'),
  })
}

export function usePublishBlogPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      publish ? blogApi.publish(id) : blogApi.unpublish(id),
    onSuccess: (_result, { publish }) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      toast.success(publish ? 'Post published' : 'Post unpublished')
    },
    onError: (err) => toast.error(extractApiError(err, 'Publish')),
  })
}

export function useBlogSettings() {
  return useQuery({
    queryKey: KEYS.settings,
    queryFn: () => blogApi.getSettings(),
  })
}

export function useUpdateBlogSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { blog_enabled: boolean }) => blogApi.updateSettings(data),
    onSuccess: (result) => {
      qc.setQueryData(KEYS.settings, result)
      toast.success(result.blog_enabled ? 'Blog enabled on your website' : 'Blog hidden from your website')
    },
    onError: () => toast.error('Failed to update blog settings'),
  })
}
