import apiClient from './client'

export interface VendorTestimonial {
  id: string
  vendor_id: string
  name: string
  role?: string | null
  company?: string | null
  quote: string
  avatar_url?: string | null
  rating: number
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorTestimonialCreate {
  name: string
  role?: string
  company?: string
  quote: string
  avatar_url?: string
  rating?: number
  sort_order?: number
  is_active?: boolean
}

export type VendorTestimonialUpdate = Partial<VendorTestimonialCreate>

export interface VendorTestimonialListResponse {
  items: VendorTestimonial[]
  total: number
  page: number
  size: number
  pages: number
}

export const testimonialsApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorTestimonialListResponse> => {
    const res = await apiClient.get('/vendors/me/testimonials', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorTestimonial> => {
    const res = await apiClient.get(`/vendors/me/testimonials/${id}`)
    return res.data
  },

  create: async (data: VendorTestimonialCreate): Promise<VendorTestimonial> => {
    const res = await apiClient.post('/vendors/me/testimonials', data)
    return res.data
  },

  update: async (id: string, data: VendorTestimonialUpdate): Promise<VendorTestimonial> => {
    const res = await apiClient.patch(`/vendors/me/testimonials/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/testimonials/${id}`)
  },

  uploadAvatar: async (file: File): Promise<{ image_url: string; url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post('/uploads/vendor/testimonial-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
