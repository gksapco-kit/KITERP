import apiClient from './client'

function vendorHeaders(slug: string) {
  return { headers: { 'X-Vendor-Slug': slug } }
}

export interface StorefrontVendor {
  id: string
  business_name: string
  display_name: string
  slug: string
  description?: string
  logo_url?: string
  banner_url?: string
  theme_config: Record<string, string>
  primary_email?: string
  primary_phone?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  service_radius_km?: number
}

export interface StorefrontProduct {
  id: string
  name: string
  slug: string
  description?: string
  short_description?: string
  category?: string
  price: number
  compare_at_price?: number
  currency: string
  is_taxable: boolean
  tax_rate?: number
  images: { id: string; url: string; alt_text?: string; position: number; is_primary: boolean }[]
  variants: { id: string; name: string; price: number; quantity: number; attributes: Record<string, string> }[]
  avg_rating?: number
  review_count?: number
  quantity: number
  track_inventory: boolean
}

export interface StorefrontService {
  id: string
  name: string
  slug: string
  description?: string
  short_description?: string
  category?: string
  price_type: string
  price?: number
  base_price: number
  price_min?: number
  price_max?: number
  currency: string
  is_taxable: boolean
  tax_rate?: number
  uom?: string
  service_mode?: string
  duration_minutes?: number
  cancellation_policy?: string
  image_url?: string
  avg_rating?: number
  review_count?: number
}

export interface CartItem {
  product_id: string
  variant_id?: string
  name: string
  qty: number
  price: number
  image_url?: string
}

export interface Cart {
  id: string
  vendor_id: string
  customer_id: string
  items: CartItem[]
  coupon_code?: string
  discount_amount: number
  item_count: number
  subtotal: number
}

export interface ShippingAddress {
  street_address: string
  city: string
  state: string
  postal_code: string
  country: string
  label?: string
}

export interface StorefrontOrder {
  id: string
  order_number: string
  vendor_id: string
  customer_id: string
  items: CartItem[]
  item_count: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_amount: number
  total: number
  status: string
  payment_status: string
  payment_method?: string
  shipping_address?: ShippingAddress
  tracking_number?: string
  tracking_url?: string
  notes?: string
  cancel_reason?: string
  created_at: string
  updated_at: string
}

export const storefrontApi = {
  getVendor: async (slug: string): Promise<StorefrontVendor> => {
    const response = await apiClient.get(`/catalog/vendor/${slug}`)
    return response.data
  },

  getProducts: async (slug: string, params?: {
    page?: number
    size?: number
    category?: string
    search?: string
  }): Promise<{ items: StorefrontProduct[]; total: number; page: number; pages: number }> => {
    const response = await apiClient.get('/catalog/products', {
      params,
      ...vendorHeaders(slug),
    })
    return response.data
  },

  getProduct: async (slug: string, productSlug: string): Promise<StorefrontProduct> => {
    const response = await apiClient.get(`/catalog/products/${productSlug}`, vendorHeaders(slug))
    return response.data
  },

  getServices: async (slug: string, params?: {
    page?: number
    size?: number
    category?: string
    search?: string
  }): Promise<{ items: StorefrontService[]; total: number; page: number; pages: number }> => {
    const response = await apiClient.get('/catalog/services', {
      params,
      ...vendorHeaders(slug),
    })
    return response.data
  },

  getService: async (slug: string, serviceSlug: string): Promise<StorefrontService> => {
    const response = await apiClient.get(`/catalog/services/${serviceSlug}`, vendorHeaders(slug))
    return response.data
  },

  // Cart
  getCart: async (slug: string): Promise<Cart> => {
    const response = await apiClient.get('/store/cart', vendorHeaders(slug))
    return response.data
  },

  addToCart: async (slug: string, item: CartItem): Promise<Cart> => {
    const response = await apiClient.post('/store/cart/items', item, vendorHeaders(slug))
    return response.data
  },

  updateCartItem: async (slug: string, index: number, qty: number): Promise<Cart> => {
    const response = await apiClient.put(`/store/cart/items/${index}`, { qty }, vendorHeaders(slug))
    return response.data
  },

  removeCartItem: async (slug: string, index: number): Promise<Cart> => {
    const response = await apiClient.delete(`/store/cart/items/${index}`, vendorHeaders(slug))
    return response.data
  },

  clearCart: async (slug: string): Promise<Cart> => {
    const response = await apiClient.delete('/store/cart', vendorHeaders(slug))
    return response.data
  },

  // Orders
  checkout: async (slug: string, data: {
    shipping_address: ShippingAddress
    payment_method: string
    notes?: string
  }): Promise<StorefrontOrder> => {
    const response = await apiClient.post('/store/orders/checkout', data, vendorHeaders(slug))
    return response.data
  },

  getOrders: async (slug: string, params?: { page?: number; size?: number }): Promise<{
    items: StorefrontOrder[]; total: number; page: number; pages: number
  }> => {
    const response = await apiClient.get('/store/orders', { params, ...vendorHeaders(slug) })
    return response.data
  },

  getOrder: async (slug: string, orderId: string): Promise<StorefrontOrder> => {
    const response = await apiClient.get(`/store/orders/${orderId}`, vendorHeaders(slug))
    return response.data
  },

  // Auth
  customerLogin: async (slug: string, email: string, password: string) => {
    const response = await apiClient.post('/store/auth/login', { email, password }, vendorHeaders(slug))
    return response.data
  },

  customerRegister: async (slug: string, data: { full_name: string; email: string; password: string; phone?: string }) => {
    const response = await apiClient.post('/store/auth/register', data, vendorHeaders(slug))
    return response.data
  },
}
