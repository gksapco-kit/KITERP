import apiClient from './client'

export interface BlogPost {
  id: string
  vendor_id: string
  slug: string
  title: string
  excerpt?: string | null
  content?: string | null
  cover_url?: string | null
  author_name?: string | null
  author_avatar_url?: string | null
  category?: string | null
  tags: string[]
  reading_minutes?: number | null
  is_published: boolean
  published_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface BlogPostCreate {
  title: string
  slug?: string
  excerpt?: string
  content?: string
  cover_url?: string
  author_name?: string
  author_avatar_url?: string
  category?: string
  tags?: string[]
  reading_minutes?: number
  is_published?: boolean
}

export type BlogPostUpdate = Partial<BlogPostCreate>

export interface BlogListResponse {
  items: BlogPost[]
  total: number
  page: number
  size: number
  pages: number
}

export interface BlogSettings {
  blog_enabled: boolean
}

export const blogApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_published?: boolean
  }): Promise<BlogListResponse> => {
    const res = await apiClient.get('/vendors/me/blog', { params })
    return res.data
  },

  get: async (id: string): Promise<BlogPost> => {
    const res = await apiClient.get(`/vendors/me/blog/${id}`)
    return res.data
  },

  create: async (data: BlogPostCreate): Promise<BlogPost> => {
    const res = await apiClient.post('/vendors/me/blog', data)
    return res.data
  },

  update: async (id: string, data: BlogPostUpdate): Promise<BlogPost> => {
    const res = await apiClient.patch(`/vendors/me/blog/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/blog/${id}`)
  },

  publish: async (id: string): Promise<BlogPost> => {
    const res = await apiClient.patch(`/vendors/me/blog/${id}`, { is_published: true })
    return res.data
  },

  unpublish: async (id: string): Promise<BlogPost> => {
    const res = await apiClient.patch(`/vendors/me/blog/${id}`, { is_published: false })
    return res.data
  },

  getSettings: async (): Promise<BlogSettings> => {
    const res = await apiClient.get('/vendors/me/blog/settings')
    return res.data
  },

  updateSettings: async (data: BlogSettings): Promise<BlogSettings> => {
    const res = await apiClient.patch('/vendors/me/blog/settings', data)
    return res.data
  },
}
