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
  is_open?: boolean
  settings?: Record<string, string>
}

export const storeApi = {
  // Auth
  sendSignupOtp: async (data: { email?: string; phone?: string }): Promise<{
    sent: boolean; channel: 'email' | 'phone'; to: string; expires_at?: string; dev_hint?: string
  }> => {
    const res = await apiClient.post('/store/auth/send-signup-otp', data); return res.data
  },
  register: async (data: {
    full_name: string; email?: string; password: string; phone?: string; otp_code: string
  }): Promise<Customer> => {
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
  recordProductView: async (
    slug: string,
    visitorId: string,
  ): Promise<{ slug: string; view_count: number; counted: boolean }> => {
    const res = await apiClient.post(`/catalog/products/${slug}/view`, {
      visitor_id: visitorId,
    })
    return res.data
  },
  listServices: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Service>> => {
    const res = await apiClient.get('/catalog/services', { params }); return res.data
  },
  getService: async (slug: string): Promise<Service> => {
    const res = await apiClient.get(`/catalog/services/${slug}`); return res.data
  },
  recordServiceView: async (
    slug: string,
    visitorId: string,
  ): Promise<{ slug: string; view_count: number; counted: boolean }> => {
    const res = await apiClient.post(`/catalog/services/${slug}/view`, {
      visitor_id: visitorId,
    })
    return res.data
  },

  // Cart
  getCart: async (): Promise<Cart> => {
    const res = await apiClient.get('/store/cart'); return res.data
  },
  addToCart: async (item: {
    product_id?: string
    service_id?: string
    item_type?: 'product' | 'service'
    variant_id?: string
    name: string
    qty: number
    price: number
    image_url?: string
  }): Promise<Cart> => {
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

  // Wishlist
  getWishlist: async () => {
    const res = await apiClient.get('/store/wishlist'); return res.data as {
      id: string; items: Array<{
        product_id: string; variant_id?: string; name: string; price: number
        image_url?: string; slug?: string; saved_at?: string
      }>
    }
  },
  toggleWishlistItem: async (item: {
    product_id: string; variant_id?: string; name: string; price: number; image_url?: string; slug?: string
  }) => {
    const res = await apiClient.post('/store/wishlist/toggle', item); return res.data
  },
  removeWishlistItem: async (productId: string) => {
    const res = await apiClient.delete(`/store/wishlist/items/${productId}`); return res.data
  },
  syncWishlist: async (items: Array<Record<string, unknown>>) => {
    const res = await apiClient.put('/store/wishlist/sync', items); return res.data
  },

  // Subscriptions
  listSubscriptions: async () => {
    const res = await apiClient.get('/store/subscriptions'); return res.data
  },
  createSubscription: async (data: {
    item_type: 'product' | 'service'
    product_id?: string
    variant_id?: string
    service_id?: string
    item_name: string
    interval: string
    price_per_cycle: number
    qty?: number
    schedule_config?: Record<string, unknown>
    payment_method?: string
  }) => {
    const res = await apiClient.post('/store/subscriptions', data); return res.data
  },
  updateSubscription: async (id: string, status: 'paused' | 'active' | 'cancelled') => {
    const res = await apiClient.patch(`/store/subscriptions/${id}`, { status }); return res.data
  },

  // Marketplace leads
  createMarketplaceLead: async (data: {
    title: string; category: string; subcategory?: string; description?: string
    budget_min?: number; budget_max?: number; location_text?: string
    location_lat?: number; location_lng?: number; radius_km?: number; photos?: string[]
  }) => {
    const res = await apiClient.post('/store/marketplace/leads', data); return res.data
  },
  listMarketplaceLeads: async () => {
    const res = await apiClient.get('/store/marketplace/leads'); return res.data
  },
  acceptMarketplaceQuote: async (leadId: string, quoteId: string) => {
    const res = await apiClient.post(`/store/marketplace/leads/${leadId}/quotes/${quoteId}/accept`); return res.data
  },

  listRentalAssets: async (params?: {
    quantity?: number
    weight?: number
    start_date?: string
    end_date?: string
    category?: string
  }) => {
    const res = await apiClient.get('/store/rentals/assets', { params }); return res.data
  },
  getRentalAsset: async (id: string) => {
    const res = await apiClient.get(`/store/rentals/assets/${id}`); return res.data
  },

  // Paginated catalog endpoint — same namespace as products/services
  listCatalogRentals: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/catalog/rentals', { params }); return res.data
  },
  getCatalogRental: async (slug: string) => {
    const res = await apiClient.get(`/catalog/rentals/${slug}`); return res.data
  },
  createRentalBooking: async (data: {
    asset_id: string
    start_date: string
    end_date: string
    start_time?: string
    end_time?: string
    quantity?: number
    weight_requested?: number
    pricing_plan?: string
    notes?: string
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    delivery_address?: string
    needs_delivery?: boolean
    additional_charge_ids?: string[]
  }) => {
    const res = await apiClient.post('/store/rentals/bookings', data); return res.data
  },
  listMyRentalBookings: async () => {
    const res = await apiClient.get('/store/rentals/my-bookings'); return res.data
  },
  getMyRentalBooking: async (id: string) => {
    const res = await apiClient.get(`/store/rentals/my-bookings/${id}`); return res.data
  },
  payRentalBooking: async (id: string, data: { payment_method?: string; payment_reference?: string }) => {
    const res = await apiClient.post(`/store/rentals/my-bookings/${id}/pay`, data); return res.data
  },
  cancelRentalBooking: async (id: string) => {
    const res = await apiClient.post(`/store/rentals/my-bookings/${id}/cancel`); return res.data
  },

  // Checkout preview & payments
  guestCheckoutPreview: async (data: {
    items: Array<{
      product_id?: string
      service_id?: string
      item_type?: string
      variant_id?: string
      name: string
      qty: number
      price: number
      image_url?: string
    }>
    shipping_method_id?: string
    coupon_code?: string
    shipping_state?: string
    store_id?: string
    branch_code?: string
  }) => {
    const res = await apiClient.post('/store/checkout/guest-preview', data)
    return res.data
  },
  guestCheckout: async (data: {
    customer: { full_name: string; email: string; phone?: string }
    items: Array<{
      product_id?: string
      service_id?: string
      item_type?: string
      variant_id?: string
      name: string
      qty: number
      price: number
      image_url?: string
    }>
    shipping_address: Record<string, string>
    payment_method: string
    shipping_method_id?: string
    notes?: string
    coupon_code?: string
    branch_code?: string
    store_id?: string
  }) => {
    const res = await apiClient.post('/store/orders/guest-checkout', data)
    return res.data
  },
  changePassword: async (data: { current_password: string; new_password: string }) => {
    const res = await apiClient.post('/store/auth/change-password', data)
    return res.data
  },
  forgotPasswordEmail: async (email: string): Promise<{ sent: boolean; to: string; expires_at?: string; dev_hint?: string }> => {
    const res = await apiClient.post('/store/auth/forgot-password', { email })
    return res.data
  },
  forgotPasswordPhone: async (phone: string): Promise<{ sent: boolean; to: string; expires_at?: string; dev_hint?: string }> => {
    const res = await apiClient.post('/store/auth/forgot-password-phone', { phone })
    return res.data
  },
  resetPassword: async (data: {
    email?: string
    phone?: string
    code: string
    new_password: string
  }) => {
    const res = await apiClient.post('/store/auth/reset-password', data)
    return res.data
  },
  getNotificationPreferences: async () => {
    const res = await apiClient.get('/store/auth/notification-preferences'); return res.data
  },
  updateNotificationPreferences: async (prefs: Record<string, boolean>) => {
    const res = await apiClient.put('/store/auth/notification-preferences', prefs); return res.data
  },
  fileOrderDispute: async (orderId: string, data: { reason: string; dispute_type?: string; amount?: number }) => {
    const res = await apiClient.post(`/store/orders/${orderId}/dispute`, data); return res.data
  },

  checkoutPreview: async (data: {
    shipping_method_id?: string
    coupon_code?: string
    shipping_state?: string
    store_id?: string
    branch_code?: string
  }) => {
    const res = await apiClient.post('/store/checkout/preview', data)
    return res.data as {
      subtotal: number
      discount_amount: number
      shipping_amount: number
      tax_amount: number
      cgst_amount: number
      sgst_amount: number
      igst_amount: number
      total: number
      currency: string
      shipping_methods: Array<{
        id: string
        label: string
        description?: string
        amount: number
        estimated_days_min?: number
        estimated_days_max?: number
      }>
      payment_methods: string[]
      connected_payments?: Array<{ provider: string; label: string; public_key?: string | null }>
      tax_lines: Array<{ label: string; amount: number }>
      razorpay_key_id?: string | null
      razorpay_enabled?: boolean
      manual_upi?: {
        enabled: boolean
        upi_id?: string | null
        qr_code_url?: string | null
        label?: string
        business_name?: string
        logo_url?: string | null
      } | null
      coupon_valid?: boolean
      coupon_message?: string
    }
  },
  createRazorpayOrder: async (orderId: string) => {
    const res = await apiClient.post('/store/checkout/payments/razorpay/create', { order_id: orderId })
    return res.data as {
      key_id: string
      razorpay_order_id: string
      amount: number
      currency: string
      order_id: string
      dev_mode?: boolean
      checkout_config_id?: string | null
      prefill?: { name?: string; email?: string; contact?: string }
    }
  },
  verifyRazorpayPayment: async (data: {
    order_id: string
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => {
    const res = await apiClient.post('/store/checkout/payments/razorpay/verify', data)
    return res.data
  },

  // Orders
  checkout: async (data: {
    shipping_address: Record<string, string>
    payment_method: string
    shipping_method_id?: string
    notes?: string
    coupon_code?: string
    branch_code?: string
    store_id?: string
  }): Promise<Order> => {
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
  submitPaymentProof: async (orderId: string, data: { utr: string; screenshot_url: string }): Promise<Order> => {
    const res = await apiClient.post(`/store/orders/${orderId}/payment-proof`, data)
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
  getBookingSlots: async (serviceId: string, bookingDate: string, planId?: string) => {
    const res = await apiClient.get('/store/bookings/slots', {
      params: { service_id: serviceId, booking_date: bookingDate, plan_id: planId || undefined },
    })
    return res.data as { slots: Array<{ start: string; end: string; start_time: string; available: boolean }>; date: string }
  },
  createBooking: async (data: {
    service_id: string; plan_id?: string; booking_date: string; start_time?: string
    notes?: string; payment_method?: string; order_id?: string
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

  submitContactQuery: async (data: {
    name: string
    email?: string
    phone?: string
    message: string
  }): Promise<{ ok: boolean; id: string; message: string }> => {
    const res = await apiClient.post('/catalog/contact-queries', data)
    return res.data
  },
}
