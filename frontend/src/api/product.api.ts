import apiClient from './client'
import type { Product, ProductCreate, ProductUpdate, ProductListResponse } from '@/types/product'

export const productApi = {
  list: async (params?: {
    page?: number
    size?: number
    status?: string
    category?: string
    search?: string
  }): Promise<ProductListResponse> => {
    const response = await apiClient.get('/vendors/me/products', { params })
    return response.data
  },

  get: async (productId: string): Promise<Product> => {
    const response = await apiClient.get(`/vendors/me/products/${productId}`)
    return response.data
  },

  create: async (data: ProductCreate): Promise<Product> => {
    const form = new FormData()
    form.append('product_data', JSON.stringify(data))
    const response = await apiClient.post('/vendors/me/products', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  update: async (productId: string, data: ProductUpdate): Promise<Product> => {
    const response = await apiClient.put(`/vendors/me/products/${productId}`, data)
    return response.data
  },

  delete: async (productId: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/products/${productId}`)
  },
}
