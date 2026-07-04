import apiClient from './client'

export interface VendorBookingResource {
  id: string
  vendor_id: string
  name: string
  resource_type: string
  capacity: number
  description?: string | null
  features: string[]
  price_per_hour: number
  currency: string
  is_available: boolean
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorBookingResourceCreate {
  name: string
  resource_type?: string
  capacity?: number
  description?: string
  features?: string[]
  price_per_hour?: number
  currency?: string
  is_available?: boolean
  sort_order?: number
  is_active?: boolean
}

export type VendorBookingResourceUpdate = Partial<VendorBookingResourceCreate>

export interface VendorBookingResourceListResponse {
  items: VendorBookingResource[]
  total: number
  page: number
  size: number
  pages: number
}

export const bookingResourcesApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorBookingResourceListResponse> => {
    const res = await apiClient.get('/vendors/me/booking-resources', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorBookingResource> => {
    const res = await apiClient.get(`/vendors/me/booking-resources/${id}`)
    return res.data
  },

  create: async (data: VendorBookingResourceCreate): Promise<VendorBookingResource> => {
    const res = await apiClient.post('/vendors/me/booking-resources', data)
    return res.data
  },

  update: async (id: string, data: VendorBookingResourceUpdate): Promise<VendorBookingResource> => {
    const res = await apiClient.patch(`/vendors/me/booking-resources/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/booking-resources/${id}`)
  },
}
