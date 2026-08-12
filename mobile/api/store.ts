import apiClient, { resolveVendorBySlug } from './client'
import type {
  Product,
  Service,
  Cart,
  Order,
  PaginatedResponse,
  ManualUpiConfig,
} from '../types'

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

  /** Manual UPI details from vendor theme (same source as website). */
  getManualUpi: async (vendorSlug: string): Promise<ManualUpiConfig | null> => {
    const vendor = await resolveVendorBySlug(vendorSlug)
    const theme = (vendor.theme_config || {}) as Record<string, any>
    const raw = theme?.checkout?.manual_upi as ManualUpiConfig | undefined
    if (!raw?.enabled) return null
    return {
      enabled: true,
      upi_id: raw.upi_id || null,
      qr_code_url: raw.qr_code_url || null,
      label: raw.label || 'UPI',
      business_name: vendor.display_name || vendor.business_name || null,
      logo_url: vendor.logo_url || null,
    }
  },

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

  guestCheckout: async (data: {
    customer: { full_name: string; email: string; phone?: string }
    items: Array<{
      product_id?: string
      variant_id?: string
      name: string
      qty: number
      price: number
      image_url?: string
    }>
    shipping_address: Record<string, string>
    payment_method: string
  }): Promise<Order & {
    access_token?: string
    refresh_token?: string
    customer?: { id: string; full_name: string; email: string; phone?: string }
  }> =>
    (await apiClient.post('/store/orders/guest-checkout', data)).data,

  listOrders: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Order>> =>
    (await apiClient.get('/store/orders', { params })).data,
  getOrder: async (id: string): Promise<Order> =>
    (await apiClient.get(`/store/orders/${id}`)).data,

  uploadOrderMedia: async (
    orderId: string,
    file: { uri: string; name: string; type: string },
  ): Promise<{ url: string; kind: string }> => {
    const form = new FormData()
    form.append('file', file as unknown as Blob)
    const res = await apiClient.post(`/store/orders/${orderId}/upload-media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
    return res.data
  },

  submitPaymentProof: async (
    orderId: string,
    data: { utr: string; screenshot_url: string },
  ): Promise<Order> =>
    (await apiClient.post(`/store/orders/${orderId}/payment-proof`, data)).data,

  listRentalAssets: async (params?: Record<string, unknown>): Promise<any[]> => {
    // Live catalog from vendor admin — no app rebuild needed for name/price/new items.
    // `_ts` avoids intermediary HTTP caches so pull-to-refresh always hits the API.
    const ts = Date.now()
    try {
      const data = (
        await apiClient.get('/catalog/rentals', {
          params: { page: 1, size: 100, _ts: ts, ...params },
        })
      ).data
      if (Array.isArray(data?.items)) return data.items
      if (Array.isArray(data)) return data
    } catch {
      /* fall through */
    }
    const data = (
      await apiClient.get('/store/rentals/assets', { params: { _ts: ts, ...params } })
    ).data
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.assets)) return data.assets
    return []
  },

  /** Fresh single-asset snapshot (name, rates, capacity) after vendor edits. */
  getRentalAsset: async (id: string): Promise<any> =>
    (await apiClient.get(`/store/rentals/assets/${id}`, { params: { _ts: Date.now() } })).data,

  /** Date-aware availability (catalog list ignores date holds / pending bookings). */
  searchAvailableRentals: async (params: {
    quantity?: number
    start_date: string
    end_date: string
    category?: string
  }): Promise<any[]> => {
    const data = (
      await apiClient.get('/store/rentals/assets', {
        params: {
          quantity: params.quantity ?? 1,
          start_date: params.start_date,
          end_date: params.end_date,
          category: params.category,
          _ts: Date.now(),
        },
      })
    ).data
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.assets)) return data.assets
    return []
  },

  getWishlist: async () =>
    (await apiClient.get('/store/wishlist')).data as {
      id: string
      items: Array<{
        product_id: string
        variant_id?: string
        name: string
        price: number
        image_url?: string
        slug?: string
        saved_at?: string
      }>
      item_count?: number
    },

  toggleWishlistItem: async (item: {
    product_id: string
    variant_id?: string
    name: string
    price: number
    image_url?: string
    slug?: string
  }) => (await apiClient.post('/store/wishlist/toggle', item)).data,

  removeWishlistItem: async (productId: string) =>
    (await apiClient.delete(`/store/wishlist/items/${productId}`)).data,

  createRentalBooking: async (data: {
    asset_id: string
    start_date: string
    end_date: string
    quantity?: number
    weight_requested?: number
    pricing_plan?: string
    notes?: string
    delivery_address?: string
    needs_delivery?: boolean
  }) => (await apiClient.post('/store/rentals/bookings', data)).data,

  listMyRentalBookings: async (): Promise<any[]> => {
    const data = (await apiClient.get('/store/rentals/my-bookings')).data
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    return []
  },

  getMyRentalBooking: async (id: string) =>
    (await apiClient.get(`/store/rentals/my-bookings/${id}`)).data,

  payRentalBooking: async (
    id: string,
    data: { payment_method?: string; payment_reference?: string } = {},
  ) => (await apiClient.post(`/store/rentals/my-bookings/${id}/pay`, data)).data,

  cancelRentalBooking: async (id: string) =>
    (await apiClient.post(`/store/rentals/my-bookings/${id}/cancel`)).data,
}
