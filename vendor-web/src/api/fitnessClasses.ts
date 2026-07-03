import apiClient from './client'

export interface VendorFitnessClass {
  id: string
  vendor_id: string
  name: string
  slug: string
  instructor?: string | null
  type: string
  duration: number
  intensity: number
  date?: string | null
  time?: string | null
  capacity: number
  booked: number
  studio?: string | null
  price?: number | null
  currency: string
  cta_label: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorFitnessClassCreate {
  name: string
  slug?: string
  instructor?: string
  type?: string
  duration?: number
  intensity?: number
  date?: string
  time?: string
  capacity?: number
  booked?: number
  studio?: string
  price?: number | null
  currency?: string
  cta_label?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorFitnessClassUpdate = Partial<VendorFitnessClassCreate>

export interface VendorFitnessClassListResponse {
  items: VendorFitnessClass[]
  total: number
  page: number
  size: number
  pages: number
}

export const fitnessClassesApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorFitnessClassListResponse> => {
    const res = await apiClient.get('/vendors/me/fitness-classes', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorFitnessClass> => {
    const res = await apiClient.get(`/vendors/me/fitness-classes/${id}`)
    return res.data
  },

  create: async (data: VendorFitnessClassCreate): Promise<VendorFitnessClass> => {
    const res = await apiClient.post('/vendors/me/fitness-classes', data)
    return res.data
  },

  update: async (id: string, data: VendorFitnessClassUpdate): Promise<VendorFitnessClass> => {
    const res = await apiClient.patch(`/vendors/me/fitness-classes/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/fitness-classes/${id}`)
  },
}
