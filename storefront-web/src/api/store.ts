import apiClient from './client'
import type { Token, Customer, VendorInfo, Product, Service, Cart, CartItem, Order, Booking, PaginatedResponse, ReviewsResponse, Review, StoreCategory } from '@/types'

export interface StoreBlogPost {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  content?: string | null
  cover_url?: string | null
  author_name?: string | null
  author_avatar_url?: string | null
  category?: string | null
  tags: string[]
  reading_minutes?: number | null
  published_at?: string | null
}

export interface StoreNotification {
  id: string
  title: string
  message?: string | null
  type: string
  is_read: boolean
  reference_id?: string | null
  reference_type?: string | null
  created_at?: string | null
}

export interface StoreLocation {
  id: string
  name: string
  code?: string
  description?: string
  phone?: string
  email?: string
  address: {
    street?: string
    city?: string
    state?: string
    pincode?: string
  }
  is_default: boolean
  settings?: Record<string, string>
}

export const storeApi = {
  // Auth
  register: async (data: { full_name: string; email?: string; password: string; phone?: string }): Promise<Customer> => {
    const res = await apiClient.post('/store/auth/register', data); return res.data
  },
  login: async (login: string, password: string): Promise<Token> => {
    const res = await apiClient.post('/store/auth/login', { login, password }); return res.data
  },
  getMe: async (): Promise<Customer> => {
    const res = await apiClient.get('/store/auth/me'); return res.data
  },
  updateMe: async (data: Partial<Customer>): Promise<Customer> => {
    const res = await apiClient.put('/store/auth/me', data); return res.data
  },

  // Catalog
  getStoreInfo: async (): Promise<VendorInfo> => {
    const res = await apiClient.get('/catalog/info'); return res.data
  },
  listBranches: async (): Promise<{ stores: StoreLocation[]; total: number }> => {
    const res = await apiClient.get('/catalog/stores'); return res.data
  },
  listCategories: async (params?: Record<string, unknown>): Promise<{ categories: StoreCategory[] }> => {
    const res = await apiClient.get('/catalog/categories', { params }); return res.data
  },
  listProducts: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Product>> => {
    const res = await apiClient.get('/catalog/products', { params }); return res.data
  },
  getProduct: async (slug: string): Promise<Product> => {
    const res = await apiClient.get(`/catalog/products/${slug}`); return res.data
  },
  listServices: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Service>> => {
    const res = await apiClient.get('/catalog/services', { params }); return res.data
  },
  getService: async (slug: string): Promise<Service> => {
    const res = await apiClient.get(`/catalog/services/${slug}`); return res.data
  },

  // Cart
  getCart: async (): Promise<Cart> => {
    const res = await apiClient.get('/store/cart'); return res.data
  },
  addToCart: async (item: { product_id: string; name: string; qty: number; price: number; image_url?: string }): Promise<Cart> => {
    const res = await apiClient.post('/store/cart/items', item); return res.data
  },
  updateCartItem: async (index: number, qty: number): Promise<Cart> => {
    const res = await apiClient.put(`/store/cart/items/${index}`, { qty }); return res.data
  },
  removeCartItem: async (index: number): Promise<Cart> => {
    const res = await apiClient.delete(`/store/cart/items/${index}`); return res.data
  },
  clearCart: async (): Promise<Cart> => {
    const res = await apiClient.delete('/store/cart'); return res.data
  },

  // Orders
  checkout: async (data: { shipping_address: Record<string, string>; payment_method: string; notes?: string; coupon_code?: string }): Promise<Order> => {
    const res = await apiClient.post('/store/orders/checkout', data); return res.data
  },
  listOrders: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Order>> => {
    const res = await apiClient.get('/store/orders', { params }); return res.data
  },
  getOrder: async (id: string): Promise<Order> => {
    const res = await apiClient.get(`/store/orders/${id}`); return res.data
  },
  uploadOrderMedia: async (orderId: string, file: File): Promise<{ url: string; kind: 'image' | 'video' }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await apiClient.post(`/store/orders/${orderId}/upload-media`, form)
    return res.data
  },
  cancelOrder: async (
    id: string,
    payload: { reason: string; attachments?: { url: string; kind: 'image' | 'video' }[] },
  ): Promise<Order> => {
    const res = await apiClient.post(`/store/orders/${id}/cancel`, payload)
    return res.data
  },
  requestReturn: async (
    id: string,
    data: {
      return_type: 'return' | 'exchange'
      reason: string
      attachments?: { url: string; kind: 'image' | 'video' }[]
    },
  ): Promise<Order> => {
    const res = await apiClient.post(`/store/orders/${id}/return`, data)
    return res.data
  },
  getOrderInvoice: async (id: string): Promise<Record<string, unknown>> => {
    const res = await apiClient.get(`/store/orders/${id}/invoice`); return res.data
  },

  // In-app notifications (order status, etc.)
  getNotificationStats: async (): Promise<{ total: number; unread: number }> => {
    const res = await apiClient.get('/store/notifications/stats'); return res.data
  },
  listNotifications: async (params?: { limit?: number; unread_only?: boolean }): Promise<{ items: StoreNotification[] }> => {
    const res = await apiClient.get('/store/notifications', { params }); return res.data
  },
  markNotificationRead: async (id: string): Promise<{ status: string }> => {
    const res = await apiClient.patch(`/store/notifications/${id}/read`); return res.data
  },
  markAllNotificationsRead: async (): Promise<{ status: string; marked_read: number }> => {
    const res = await apiClient.patch('/store/notifications/read-all'); return res.data
  },
  requestQuote: async (data: {
    service_id?: string; service_name?: string
    product_id?: string; product_name?: string
    item_type?: 'service' | 'product'
    form_data?: Record<string, string>
    message?: string; preferred_date?: string; preferred_time?: string
  }): Promise<Order> => {
    const res = await apiClient.post('/store/orders/quote-request', data); return res.data
  },

  // Reviews
  getProductReviews: async (productId: string, params?: Record<string, unknown>): Promise<ReviewsResponse> => {
    const res = await apiClient.get(`/store/reviews/product/${productId}`, { params }); return res.data
  },
  getServiceReviews: async (serviceId: string, params?: Record<string, unknown>): Promise<ReviewsResponse> => {
    const res = await apiClient.get(`/store/reviews/service/${serviceId}`, { params }); return res.data
  },
  submitReview: async (data: {
    review_type: 'product' | 'service'; product_id?: string; service_id?: string
    order_id?: string; rating: number; title?: string; comment?: string
  }): Promise<Review> => {
    const res = await apiClient.post('/store/reviews', data); return res.data
  },

  // Bookings
  createBooking: async (data: {
    service_id: string; booking_date: string; start_time?: string
    notes?: string; payment_method?: string
  }): Promise<Booking> => {
    const res = await apiClient.post('/store/bookings', data); return res.data
  },
  listBookings: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Booking>> => {
    const res = await apiClient.get('/store/bookings', { params }); return res.data
  },
  getBooking: async (id: string): Promise<Booking> => {
    const res = await apiClient.get(`/store/bookings/${id}`); return res.data
  },
  cancelBooking: async (id: string, reason?: string): Promise<Booking> => {
    const res = await apiClient.post(`/store/bookings/${id}/cancel`, { reason }); return res.data
  },

  // Coupons
  listPublicCoupons: async () => {
    const res = await apiClient.get('/store/coupons'); return res.data
  },
  validateCoupon: async (code: string, order_total: number) => {
    const res = await apiClient.post('/store/coupons/validate', { code, order_total }); return res.data
  },

  // Blog
  listBlogPosts: async (params?: {
    page?: number
    size?: number
    category?: string
    tag?: string
  }): Promise<{ items: StoreBlogPost[]; total: number; page: number; size: number; pages: number }> => {
    const res = await apiClient.get('/catalog/blog', { params }); return res.data
  },
  getBlogPost: async (slug: string): Promise<StoreBlogPost> => {
    const res = await apiClient.get(`/catalog/blog/${slug}`); return res.data
  },
}
