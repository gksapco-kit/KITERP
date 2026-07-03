import apiClient from './client'

export interface CourseSyllabusWeek {
  week: number
  title: string
  lessons?: number
  duration?: string
}

export interface CoursePerk {
  icon?: string
  text: string
}

export interface VendorCourse {
  id: string
  vendor_id: string
  title: string
  slug: string
  instructor?: string | null
  level: string
  category?: string | null
  description?: string | null
  duration?: string | null
  lessons: number
  rating: number
  reviews: number
  price?: number | null
  currency: string
  image_url?: string | null
  syllabus: CourseSyllabusWeek[]
  outcomes: string[]
  perks: CoursePerk[]
  enrolled_label?: string | null
  cta_label: string
  preview_cta_label: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorCourseCreate {
  title: string
  slug?: string
  instructor?: string
  level?: string
  category?: string
  description?: string
  duration?: string
  lessons?: number
  rating?: number
  reviews?: number
  price?: number | null
  currency?: string
  image_url?: string | null
  syllabus?: CourseSyllabusWeek[]
  outcomes?: string[]
  perks?: CoursePerk[]
  enrolled_label?: string
  cta_label?: string
  preview_cta_label?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorCourseUpdate = Partial<VendorCourseCreate>

export interface VendorCourseListResponse {
  items: VendorCourse[]
  total: number
  page: number
  size: number
  pages: number
}

export const coursesApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorCourseListResponse> => {
    const res = await apiClient.get('/vendors/me/courses', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorCourse> => {
    const res = await apiClient.get(`/vendors/me/courses/${id}`)
    return res.data
  },

  create: async (data: VendorCourseCreate): Promise<VendorCourse> => {
    const res = await apiClient.post('/vendors/me/courses', data)
    return res.data
  },

  update: async (id: string, data: VendorCourseUpdate): Promise<VendorCourse> => {
    const res = await apiClient.patch(`/vendors/me/courses/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/courses/${id}`)
  },

  uploadImage: async (file: File): Promise<{ image_url: string; url?: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/course-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const data = response.data as { image_url?: string; url?: string }
    return { image_url: data.image_url || data.url || '', url: data.url || data.image_url }
  },
}
