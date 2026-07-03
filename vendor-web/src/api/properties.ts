import apiClient from './client'

export interface VendorProperty {
  id: string
  vendor_id: string
  title: string
  slug: string
  address?: string | null
  description?: string | null
  price?: number | null
  currency: string
  beds: number
  baths: number
  sqft: number
  type: string
  status: string
  image_url?: string | null
  gallery: string[]
  agent_name?: string | null
  agent_phone?: string | null
  agent_email?: string | null
  cta_label: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorPropertyCreate {
  title: string
  slug?: string
  address?: string
  description?: string
  price?: number | null
  currency?: string
  beds?: number
  baths?: number
  sqft?: number
  type?: string
  status?: string
  image_url?: string | null
  gallery?: string[]
  agent_name?: string
  agent_phone?: string
  agent_email?: string
  cta_label?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorPropertyUpdate = Partial<VendorPropertyCreate>

export interface VendorPropertyListResponse {
  items: VendorProperty[]
  total: number
  page: number
  size: number
  pages: number
}

export const propertiesApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorPropertyListResponse> => {
    const res = await apiClient.get('/vendors/me/properties', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorProperty> => {
    const res = await apiClient.get(`/vendors/me/properties/${id}`)
    return res.data
  },

  create: async (data: VendorPropertyCreate): Promise<VendorProperty> => {
    const res = await apiClient.post('/vendors/me/properties', data)
    return res.data
  },

  update: async (id: string, data: VendorPropertyUpdate): Promise<VendorProperty> => {
    const res = await apiClient.patch(`/vendors/me/properties/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/properties/${id}`)
  },

  uploadImage: async (file: File): Promise<{ image_url: string; url?: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/property-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const data = response.data as { image_url?: string; url?: string }
    return { image_url: data.image_url || data.url || '', url: data.url || data.image_url }
  },
}
