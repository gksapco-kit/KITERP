import apiClient from './client'
import type { Vendor, Product, Service, Order, OrderStats, Customer, PaginatedResponse } from '../types'

export const vendorApi = {
  getMyVendor: async (): Promise<Vendor> => (await apiClient.get('/vendors/me')).data,
  listProducts: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Product>> => (await apiClient.get('/vendors/me/products', { params })).data,
  listServices: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Service>> => (await apiClient.get('/vendors/me/services', { params })).data,
  listOrders: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Order>> => (await apiClient.get('/vendors/me/orders', { params })).data,
  getOrder: async (id: string): Promise<Order> => (await apiClient.get(`/vendors/me/orders/${id}`)).data,
  updateOrderStatus: async (id: string, data: Record<string, unknown>): Promise<Order> => (await apiClient.put(`/vendors/me/orders/${id}/status`, data)).data,
  getOrderStats: async (): Promise<OrderStats> => (await apiClient.get('/vendors/me/orders/stats')).data,
  listCustomers: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Customer>> => (await apiClient.get('/vendors/me/customers', { params })).data,
}
