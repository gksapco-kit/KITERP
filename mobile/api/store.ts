import apiClient from './client'
import type { Product, Service, Cart, Order, PaginatedResponse } from '../types'

export type StoreCategory = {
  id?: string
  name: string
  slug?: string
  image_url?: string
  children?: StoreCategory[]
}

export const storeApi = {
  listProducts: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Product>> =>
    (await apiClient.get('/catalog/products', { params })).data,
  getProduct: async (slug: string): Promise<Product> =>
    (await apiClient.get(`/catalog/products/${slug}`)).data,
  listCategories: async (): Promise<StoreCategory[]> => {
    const data = (await apiClient.get('/catalog/categories')).data
    if (Array.isArray(data?.categories)) return data.categories
    if (Array.isArray(data)) return data
    return []
  },
  listServices: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Service>> =>
    (await apiClient.get('/catalog/services', { params })).data,

  // Cart
  getCart: async (): Promise<Cart> => (await apiClient.get('/store/cart')).data,
  addToCart: async (item: {
    product_id: string
    variant_id?: string
    name: string
    qty: number
    price: number
    image_url?: string
  }): Promise<Cart> =>
    (await apiClient.post('/store/cart/items', item)).data,
  updateCartItem: async (index: number, qty: number): Promise<Cart> =>
    (await apiClient.put(`/store/cart/items/${index}`, { qty })).data,
  removeCartItem: async (index: number): Promise<Cart> =>
    (await apiClient.delete(`/store/cart/items/${index}`)).data,

  // Orders
  checkout: async (data: Record<string, unknown>): Promise<Order> =>
    (await apiClient.post('/store/orders/checkout', data)).data,
  listOrders: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Order>> =>
    (await apiClient.get('/store/orders', { params })).data,
  getOrder: async (id: string): Promise<Order> =>
    (await apiClient.get(`/store/orders/${id}`)).data,
}
