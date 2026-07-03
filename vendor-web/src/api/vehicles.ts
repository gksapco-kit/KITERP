import apiClient from './client'

export interface VendorVehicle {
  id: string
  vendor_id: string
  slug: string
  year: number
  make: string
  model: string
  trim?: string | null
  condition: string
  price: number
  currency: string
  mileage: number
  fuel: string
  transmission: string
  body_style?: string | null
  exterior_color?: string | null
  image_url?: string | null
  stock_number?: string | null
  location_note?: string | null
  cta_label: string
  highlights: string[]
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorVehicleCreate {
  year?: number
  make: string
  model: string
  trim?: string
  condition?: string
  price?: number
  currency?: string
  mileage?: number
  fuel?: string
  transmission?: string
  body_style?: string
  exterior_color?: string
  image_url?: string
  stock_number?: string
  location_note?: string
  cta_label?: string
  highlights?: string[]
  slug?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorVehicleUpdate = Partial<VendorVehicleCreate>

export interface VendorVehicleListResponse {
  items: VendorVehicle[]
  total: number
  page: number
  size: number
  pages: number
}

export const vehiclesApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorVehicleListResponse> => {
    const res = await apiClient.get('/vendors/me/vehicles', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorVehicle> => {
    const res = await apiClient.get(`/vendors/me/vehicles/${id}`)
    return res.data
  },

  create: async (data: VendorVehicleCreate): Promise<VendorVehicle> => {
    const res = await apiClient.post('/vendors/me/vehicles', data)
    return res.data
  },

  update: async (id: string, data: VendorVehicleUpdate): Promise<VendorVehicle> => {
    const res = await apiClient.patch(`/vendors/me/vehicles/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/vehicles/${id}`)
  },

  uploadImage: async (file: File): Promise<{ image_url: string; url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post('/uploads/vendor/vehicle-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
