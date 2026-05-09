import apiClient from './client'

export interface ServiceCreate {
  name: string
  slug?: string
  description?: string
  short_description?: string
  category?: string
  subcategory?: string
  tags: string[]
  price_type: string
  price?: number
  price_min?: number
  price_max?: number
  currency: string
  is_taxable: boolean
  tax_rate?: number
  sac_code?: string
  uom: string
  service_mode: string
  duration_minutes?: number
  buffer_minutes: number
  requires_booking: boolean
  max_bookings_per_slot: number
  advance_booking_days: number
  cancellation_policy?: string
  status?: string
  is_featured: boolean
  is_visible: boolean
  image_url?: string
}

export interface ServiceUpdate {
  name?: string
  description?: string
  short_description?: string
  category?: string
  price_type?: string
  price?: number
  is_taxable?: boolean
  tax_rate?: number
  sac_code?: string
  uom?: string
  service_mode?: string
  duration_minutes?: number
  status?: string
  is_featured?: boolean
  is_visible?: boolean
}

export interface Service {
  id: string
  vendor_id: string
  name: string
  slug: string
  description?: string
  short_description?: string
  category?: string
  subcategory?: string
  tags: string[]
  price_type: string
  price?: number
  price_min?: number
  price_max?: number
  currency: string
  is_taxable: boolean
  tax_rate?: number
  sac_code?: string
  uom: string
  service_mode: string
  duration_minutes?: number
  buffer_minutes: number
  requires_booking: boolean
  max_bookings_per_slot: number
  advance_booking_days: number
  cancellation_policy?: string
  status: string
  is_featured: boolean
  is_visible: boolean
  image_url?: string
  gallery: string[]
  created_at: string
  updated_at: string
}

export interface ServiceListResponse {
  items: Service[]
  total: number
  page: number
  size: number
  pages: number
}

export const serviceApi = {
  list: async (params?: {
    page?: number
    size?: number
    status?: string
    category?: string
    search?: string
  }): Promise<ServiceListResponse> => {
    const response = await apiClient.get('/vendors/me/services', { params })
    return response.data
  },

  get: async (id: string): Promise<Service> => {
    const response = await apiClient.get(`/vendors/me/services/${id}`)
    return response.data
  },

  create: async (data: ServiceCreate): Promise<Service> => {
    const response = await apiClient.post('/vendors/me/services', data)
    return response.data
  },

  update: async (id: string, data: ServiceUpdate): Promise<Service> => {
    const response = await apiClient.put(`/vendors/me/services/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/services/${id}`)
  },
}
