import apiClient from './client'
import type { Vendor, Product, Service, ServiceMediaItem, Customer, Order, OrderStats, Review, PaginatedResponse, VendorRole, TeamMember, VendorCategory, Supplier, PurchaseOrder, OrderAttachmentRef, InvoiceTemplate, VendorPlanInfo, Bundle, ProductMerchandising, ProductPriceRule, VendorDocument, VendorDocumentType } from '@/types'

// ── Restaurant extra types ────────────────────────────────────────
export interface ReservationItem {
  id: string
  vendor_id: string
  table_id?: string | null
  table_label?: string | null
  guest_name: string
  guest_phone?: string | null
  guest_email?: string | null
  reservation_date: string
  reservation_time: string
  party_size: number
  status: string
  notes?: string | null
  source: string
  created_at?: string | null
}

export interface RestaurantReportDashboard {
  today: { open_orders: number; total_orders: number; total_covers: number; restaurant_revenue: number }
  kots_by_status: Record<string, number>
  tables: { total: number; by_status: Record<string, number> }
  upcoming_reservations: number
}

// ── Modifier types ────────────────────────────────────────────────
export interface ModifierOption {
  id: string
  group_id: string
  name: string
  price_delta: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export interface ModifierGroup {
  id: string
  product_id: string
  name: string
  selection_type: 'single' | 'multiple'
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
  is_active: boolean
  options: ModifierOption[]
}

export interface SelectedModifier {
  group_id: string
  group_name: string
  option_id: string
  option_name: string
  price_delta: number
}

// ── Restaurant types ───────────────────────────────────────────────
export interface RestaurantOrderItem {
  product_id?: string
  name: string
  qty: number
  unit_price: number
  tax_rate?: number
  item_type?: string
  notes?: string
  modifiers?: SelectedModifier[]
}

export interface RestaurantKOT {
  id: string
  order_id: string
  table_id?: string | null
  table_label?: string | null
  kot_number: number
  status: string
  items: RestaurantOrderItem[]
  notes?: string | null
  covers?: number | null
  order_status?: string | null
  created_at?: string | null
}

export interface RestaurantOrder {
  id: string
  vendor_id: string
  table_id?: string | null
  table_label?: string | null
  status: string
  covers: number
  server_name?: string | null
  items: RestaurantOrderItem[]
  notes?: string | null
  pos_transaction_id?: string | null
  kots: RestaurantKOT[]
  created_at?: string | null
  updated_at?: string | null
}

export interface StoreAddress {
  street?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
  latitude?: number
  longitude?: number
}

export interface StoreRecord {
  id: string
  vendor_id: string
  name: string
  code?: string
  description?: string
  phone?: string
  email?: string
  address: StoreAddress
  manager_id?: string
  is_active: boolean
  is_default: boolean
  settings: Record<string, unknown>
  inventory_count?: number
  staff_count?: number
  created_at?: string
  updated_at?: string
  staff?: StoreStaffMember[]
}

export interface StoreInventoryItem {
  id: string
  product_id: string
  variant_id?: string
  quantity: number
  low_stock_threshold: number
  product_name: string
  product_sku?: string
  updated_at?: string
}

export interface StoreStaffMember {
  id: string
  user_id: string
  role: string
  is_active: boolean
  name?: string
  email?: string
  phone?: string
}

export interface VariantMediaItem {
  url: string
  media_type: 'image' | 'video' | 'model3d'
  is_primary: boolean
  alt_text?: string
  position: number
}

export const vendorApi = {
  getMyVendor: async (): Promise<Vendor> => {
    const response = await apiClient.get('/vendors/me')
    return response.data
  },

  updateMyVendor: async (data: Partial<Vendor>): Promise<Vendor> => {
    const response = await apiClient.put('/vendors/me', data)
    return response.data
  },

  // ── Categories ──────────────────────────────────────────────
  listCategories: async (params?: Record<string, unknown>): Promise<{ categories: VendorCategory[] }> => {
    const response = await apiClient.get('/vendors/me/categories', { params })
    return response.data
  },

  getCategoryCatalogues: async (id: string): Promise<{ category: VendorCategory; products: any[]; services: any[]; product_count: number; service_count: number }> => {
    const response = await apiClient.get(`/vendors/me/categories/${id}/catalogues`)
    return response.data
  },

  createCategory: async (data: Record<string, unknown>): Promise<VendorCategory> => {
    const response = await apiClient.post('/vendors/me/categories', data)
    return response.data
  },

  updateCategory: async (id: string, data: Record<string, unknown>): Promise<VendorCategory> => {
    const response = await apiClient.put(`/vendors/me/categories/${id}`, data)
    return response.data
  },

  deleteCategory: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/categories/${id}`)
  },

  // ── Products ──────────────────────────────────────────────
  listProducts: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Product>> => {
    const response = await apiClient.get('/vendors/me/products', { params })
    return response.data
  },

  barcodeLookup: async (code: string): Promise<{
    match_level: 'product' | 'variant'
    product: Product
    variant: {
      id: string; name: string; sku?: string; barcode?: string
      price?: number; compare_at_price?: number; cost_price?: number
      quantity: number; attributes: Record<string, string>; color?: string
      is_active: boolean; is_on_sale: boolean; uom?: string
      hsn_code?: string; tax_rate?: number
    } | null
  }> => {
    const response = await apiClient.get('/vendors/me/products/barcode-lookup', { params: { code } })
    return response.data
  },

  createProduct: async (data: Record<string, unknown>, imageFiles?: File[], primaryImageIndex?: number): Promise<Product> => {
    const form = new FormData()
    form.append('product_data', JSON.stringify(data))
    if (imageFiles) {
      for (const file of imageFiles) {
        form.append('images', file)
      }
    }
    if (primaryImageIndex !== undefined && primaryImageIndex >= 0) {
      form.append('primary_image_index', String(primaryImageIndex))
    }
    const response = await apiClient.post('/vendors/me/products', form)
    return response.data
  },

  getProduct: async (id: string): Promise<Product> => {
    const response = await apiClient.get(`/vendors/me/products/${id}`)
    return response.data
  },

  updateProduct: async (id: string, data: Record<string, unknown>): Promise<Product> => {
    const response = await apiClient.put(`/vendors/me/products/${id}`, data)
    return response.data
  },

  deleteProduct: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/products/${id}`)
  },

  // ── Services ──────────────────────────────────────────────
  listServices: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Service>> => {
    const response = await apiClient.get('/vendors/me/services', { params })
    return response.data
  },

  createService: async (data: Record<string, unknown>): Promise<Service> => {
    const response = await apiClient.post('/vendors/me/services', data)
    return response.data
  },

  getService: async (id: string): Promise<Service> => {
    const response = await apiClient.get(`/vendors/me/services/${id}`)
    return response.data
  },

  updateService: async (id: string, data: Record<string, unknown>): Promise<Service> => {
    const response = await apiClient.put(`/vendors/me/services/${id}`, data)
    return response.data
  },

  deleteService: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/services/${id}`)
  },

  // ── Product Images ──────────────────────────────────────────
  // ── Vendor Logo & Banner ──────────────────────────────────────
  uploadVendorLogo: async (file: File): Promise<{ logo_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data
  },

  // ── Vendor Verification (KYC documents + submit for review) ─────────
  listVendorDocuments: async (): Promise<VendorDocument[]> => {
    const response = await apiClient.get('/vendors/me/documents')
    return response.data
  },

  uploadVendorDocument: async (
    documentType: VendorDocumentType,
    file: File,
  ): Promise<VendorDocument> => {
    const form = new FormData()
    form.append('document_type', documentType)
    form.append('file', file)
    const response = await apiClient.post('/vendors/me/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  submitVendorForReview: async (): Promise<Vendor> => {
    const response = await apiClient.post('/vendors/me/submit-review')
    return response.data
  },

  // ── Invoice Settings ──────────────────────────────────────────────────
  getInvoiceSettings: async (): Promise<Record<string, unknown>> => {
    const response = await apiClient.get('/vendors/me/invoices/settings')
    return response.data
  },

  updateInvoiceSettings: async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await apiClient.put('/vendors/me/invoices/settings', data)
    return response.data
  },

  uploadInvoiceSignature: async (file: File): Promise<{ signature_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/vendors/me/invoices/settings/signature', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data
  },

  getQuotationSettings: async (): Promise<Record<string, unknown>> => {
    const response = await apiClient.get('/vendors/me/invoices/settings/quotation')
    return response.data
  },

  updateQuotationSettings: async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await apiClient.put('/vendors/me/invoices/settings/quotation', data)
    return response.data
  },

  uploadQuotationSignature: async (file: File): Promise<{ signature_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/vendors/me/invoices/settings/quotation-signature', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data
  },

  uploadVendorBanner: async (file: File): Promise<{ banner_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/banner', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data
  },

  /** Upload branding file without updating vendor logo/banner (for per-unit overrides). */
  uploadVendorBrandingAsset: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/branding-asset', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data
  },

  uploadVendorExtraBanner: async (file: File): Promise<{ banner_url: string; extra_banners: string[] }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/extra-banner', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data
  },

  removeVendorExtraBanner: async (url: string): Promise<{ extra_banners: string[] }> => {
    const response = await apiClient.delete('/uploads/vendor/extra-banner', { params: { url } })
    return response.data
  },

  sendDomainDeactivationOtp: async (): Promise<{ sent: boolean; to: string; dev_hint?: string }> => {
    const response = await apiClient.post('/vendors/me/domain/send-deactivation-otp')
    return response.data
  },

  verifyDomainDeactivationOtp: async (code: string) => {
    const response = await apiClient.post('/vendors/me/domain/verify-deactivation-otp', { code })
    return response.data
  },

  /** Blog Manager — cover image; returns path to send as ``cover_url`` on create/update. */
  uploadBlogCover: async (file: File): Promise<{ cover_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/blog-cover', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  uploadProductImage: async (productId: string, file: File): Promise<{ id: string; url: string; alt_text: string; position: number; is_primary: boolean; media_type: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/uploads/products/${productId}/images`, form)
    return response.data
  },

  deleteProductImage: async (productId: string, imageId: string): Promise<void> => {
    await apiClient.delete(`/uploads/products/${productId}/images/${imageId}`)
  },

  setPrimaryProductImage: async (productId: string, imageId: string): Promise<void> => {
    await apiClient.put(`/uploads/products/${productId}/images/${imageId}/primary`)
  },

  reorderProductImages: async (productId: string, imageIds: string[]): Promise<void> => {
    await apiClient.put(`/uploads/products/${productId}/images/reorder`, { image_ids: imageIds })
  },

  // ── Variant Media ───────────────────────────────────────────
  uploadVariantMedia: async (variantId: string, file: File): Promise<{ media: VariantMediaItem[]; added: VariantMediaItem }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/uploads/variants/${variantId}/media`, form)
    return response.data
  },

  deleteVariantMedia: async (variantId: string, url: string): Promise<{ media: VariantMediaItem[] }> => {
    const response = await apiClient.delete(`/uploads/variants/${variantId}/media`, { params: { url } })
    return response.data
  },

  setPrimaryVariantMedia: async (variantId: string, url: string): Promise<{ media: VariantMediaItem[] }> => {
    const response = await apiClient.put(`/uploads/variants/${variantId}/media/primary`, null, { params: { url } })
    return response.data
  },

  reorderVariantMedia: async (variantId: string, mediaUrls: string[]): Promise<{ media: VariantMediaItem[] }> => {
    const response = await apiClient.put(`/uploads/variants/${variantId}/media/reorder`, { media_urls: mediaUrls })
    return response.data
  },

  // ── Price Rules ────────────────────────────────────────────
  listPriceRules: async (productId: string, ruleType?: string): Promise<ProductPriceRule[]> => {
    const params: Record<string, string> = {}
    if (ruleType) params.rule_type = ruleType
    const response = await apiClient.get(`/vendors/me/products/${productId}/price-rules`, { params })
    return response.data
  },

  createPriceRule: async (productId: string, data: Omit<ProductPriceRule, 'id' | 'product_id' | 'created_at' | 'updated_at'>): Promise<ProductPriceRule> => {
    const response = await apiClient.post(`/vendors/me/products/${productId}/price-rules`, data)
    return response.data
  },

  updatePriceRule: async (productId: string, ruleId: string, data: Partial<ProductPriceRule>): Promise<ProductPriceRule> => {
    const response = await apiClient.put(`/vendors/me/products/${productId}/price-rules/${ruleId}`, data)
    return response.data
  },

  deletePriceRule: async (productId: string, ruleId: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/products/${productId}/price-rules/${ruleId}`)
  },

  // ── Service Media ──────────────────────────────────────────
  uploadServiceMedia: async (serviceId: string, file: File): Promise<{ media: ServiceMediaItem[]; item: ServiceMediaItem }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/uploads/services/${serviceId}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  deleteServiceMedia: async (serviceId: string, mediaId: string): Promise<{ media: ServiceMediaItem[] }> => {
    const response = await apiClient.delete(`/uploads/services/${serviceId}/media/${mediaId}`)
    return response.data
  },

  setPrimaryServiceMedia: async (serviceId: string, mediaId: string): Promise<{ media: ServiceMediaItem[] }> => {
    const response = await apiClient.put(`/uploads/services/${serviceId}/media/${mediaId}/primary`)
    return response.data
  },

  reorderServiceMedia: async (serviceId: string, mediaIds: string[]): Promise<{ media: ServiceMediaItem[] }> => {
    const response = await apiClient.put(`/uploads/services/${serviceId}/media/reorder`, { media_ids: mediaIds })
    return response.data
  },

  // Legacy service image endpoints
  uploadServiceImage: async (serviceId: string, file: File): Promise<{ image_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/uploads/services/${serviceId}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  uploadServiceGalleryImage: async (serviceId: string, file: File): Promise<{ gallery: string[]; added: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/uploads/services/${serviceId}/gallery`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  deleteServiceGalleryImage: async (serviceId: string, url: string): Promise<void> => {
    await apiClient.delete(`/uploads/services/${serviceId}/gallery`, { params: { url } })
  },

  // ── Orders ────────────────────────────────────────────────
  listOrders: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Order>> => {
    const response = await apiClient.get('/vendors/me/orders', { params })
    return response.data
  },

  getOrder: async (id: string): Promise<Order> => {
    const response = await apiClient.get(`/vendors/me/orders/${id}`)
    return response.data
  },

  uploadOrderMedia: async (orderId: string, file: File): Promise<{ url: string; kind: 'image' | 'video' }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/vendors/me/orders/${orderId}/upload-media`, form)
    return response.data
  },

  assignOrderDelivery: async (id: string, data: { staff_id?: string; staff_name: string }): Promise<Order> => {
    const response = await apiClient.put(`/vendors/me/orders/${id}/assign-delivery`, data)
    return response.data
  },

  updateOrderStatus: async (id: string, data: Record<string, unknown>): Promise<Order> => {
    const response = await apiClient.put(`/vendors/me/orders/${id}/status`, data)
    return response.data
  },

  resolveReturn: async (id: string, data: { action: 'approve' | 'reject'; notes?: string; refund_amount?: number }): Promise<Order> => {
    const response = await apiClient.post(`/vendors/me/orders/${id}/return-resolve`, data)
    return response.data
  },

  requestReturnExchange: async (
    id: string,
    data: {
      return_type: 'return' | 'exchange'
      reason: string
      attachments?: OrderAttachmentRef[]
    },
  ): Promise<Order> => {
    const response = await apiClient.post(`/vendors/me/orders/${id}/return-request`, data)
    return response.data
  },

  getOrderStats: async (): Promise<OrderStats> => {
    const response = await apiClient.get('/vendors/me/orders/stats')
    return response.data
  },

  getInvoiceByOrder: async (orderId: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.get(`/vendors/me/invoices/by-order/${orderId}`)
    return response.data
  },

  // ── Customers ─────────────────────────────────────────────
  listCustomers: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Customer>> => {
    const response = await apiClient.get('/vendors/me/customers', { params })
    return response.data
  },

  getCustomer: async (id: string): Promise<Customer> => {
    const response = await apiClient.get(`/vendors/me/customers/${id}`)
    return response.data
  },

  createCustomer: async (data: Record<string, unknown>): Promise<Customer> => {
    const response = await apiClient.post('/vendors/me/customers', data)
    return response.data
  },

  /**
   * Client-side duplicate detection: searches existing customers by phone and/or
   * email and returns matches as CustomerDuplicateMatch records. No dedicated
   * backend endpoint needed — the dedup migration removed unique constraints so
   * duplicates are allowed; we surface them here before creating a new record.
   */
  checkCustomerDuplicates: async (params: {
    phone?: string
    email?: string
  }): Promise<import('@/types').CustomerDuplicateMatch[]> => {
    const seen = new Set<string>()
    const results: import('@/types').CustomerDuplicateMatch[] = []
    const add = (items: Customer[]) => {
      for (const c of items) {
        if (!seen.has(c.id)) {
          seen.add(c.id)
          results.push({
            id: c.id,
            full_name: c.full_name,
            phone: c.phone,
            email: c.email,
            company_name: c.company_name,
            gstin: c.gstin,
            total_orders: c.total_orders ?? 0,
            created_at: c.created_at,
            is_own_vendor: true,
          })
        }
      }
    }
    const searches: Promise<void>[] = []
    if (params.phone?.trim()) {
      searches.push(
        apiClient.get('/vendors/me/customers', { params: { search: params.phone.trim(), size: 10 } })
          .then(r => add((r.data?.items || []).filter((c: Customer) => c.phone === params.phone)))
          .catch(() => {}),
      )
    }
    if (params.email?.trim()) {
      searches.push(
        apiClient.get('/vendors/me/customers', { params: { search: params.email.trim(), size: 10 } })
          .then(r => add((r.data?.items || []).filter((c: Customer) => c.email?.toLowerCase() === params.email!.trim().toLowerCase())))
          .catch(() => {}),
      )
    }
    await Promise.all(searches)
    return results
  },

  updateCustomer: async (id: string, data: Record<string, unknown>): Promise<Customer> => {
    const response = await apiClient.put(`/vendors/me/customers/${id}`, data)
    return response.data
  },

  gstLookup: async (gstin: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.get('/vendors/me/customers/gst-lookup', { params: { gstin } })
    return response.data
  },

  // ── Reviews ─────────────────────────────────────────────
  listReviews: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Review>> => {
    const response = await apiClient.get('/vendors/me/reviews', { params })
    return response.data
  },

  getReview: async (id: string): Promise<Review> => {
    const response = await apiClient.get(`/vendors/me/reviews/${id}`)
    return response.data
  },

  replyToReview: async (id: string, reply: string): Promise<Review> => {
    const response = await apiClient.post(`/vendors/me/reviews/${id}/reply`, { reply })
    return response.data
  },

  toggleReviewVisibility: async (id: string, is_visible: boolean): Promise<Review> => {
    const response = await apiClient.patch(`/vendors/me/reviews/${id}/visibility`, { is_visible })
    return response.data
  },

  // ── Team ──────────────────────────────────────────────────────
  listTeamMembers: async (params?: Record<string, unknown>): Promise<PaginatedResponse<TeamMember>> => {
    const response = await apiClient.get('/vendors/me/team', { params })
    return response.data
  },

  getMyMembership: async (): Promise<TeamMember> => {
    const response = await apiClient.get('/vendors/me/team/me')
    return response.data
  },

  getTeamMember: async (id: string): Promise<TeamMember> => {
    const response = await apiClient.get(`/vendors/me/team/${id}`)
    return response.data
  },

  listAssignableTeamRoles: async (): Promise<{
    builtin_roles: { slug: string; name: string }[]
    custom_roles: VendorRole[]
  }> => {
    const response = await apiClient.get('/vendors/me/team/assignable-roles')
    return response.data
  },

  inviteTeamMember: async (data: {
    email: string
    full_name: string
    phone?: string
    role: string
    role_id?: string
    password: string
    access_starts_at?: string
    access_ends_at?: string
    employee_profile_id?: string
  }): Promise<TeamMember & { _otp?: string }> => {
    const response = await apiClient.post('/vendors/me/team', data)
    return response.data
  },

  sendTeamVerificationOtp: async (memberId: string): Promise<{
    otp: string
    expires_in_minutes: number
    contact: string
    channel: string
  }> => {
    const response = await apiClient.post(`/vendors/me/team/${memberId}/send-verification`)
    return response.data
  },

  verifyTeamMemberOtp: async (memberId: string, otp: string, channel: 'email' | 'phone'): Promise<TeamMember> => {
    const response = await apiClient.post(`/vendors/me/team/${memberId}/verify`, { otp, channel })
    return response.data
  },

  updateTeamMember: async (id: string, data: {
    role?: string
    role_id?: string
    is_active?: boolean
    access_starts_at?: string | null
    access_ends_at?: string | null
    clear_access_ends_at?: boolean
  }): Promise<TeamMember> => {
    const response = await apiClient.put(`/vendors/me/team/${id}`, data)
    return response.data
  },

  removeTeamMember: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/team/${id}`)
  },

  // ── Roles ─────────────────────────────────────────────────────
  listRoles: async (): Promise<{ roles: VendorRole[] }> => {
    const response = await apiClient.get('/vendors/me/roles')
    return response.data
  },

  getRole: async (id: string): Promise<VendorRole> => {
    const response = await apiClient.get(`/vendors/me/roles/${id}`)
    return response.data
  },

  createRole: async (data: {
    name: string
    description?: string
    permissions: string[]
  }): Promise<VendorRole> => {
    const response = await apiClient.post('/vendors/me/roles', data)
    return response.data
  },

  updateRole: async (id: string, data: {
    name?: string
    description?: string
    permissions?: string[]
    is_active?: boolean
  }): Promise<VendorRole> => {
    const response = await apiClient.put(`/vendors/me/roles/${id}`, data)
    return response.data
  },

  deleteRole: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/roles/${id}`)
  },

  listAllPermissions: async (): Promise<{ permissions: Record<string, { key: string; action: string }[]>; all: string[] }> => {
    const response = await apiClient.get('/vendors/me/roles/permissions')
    return response.data
  },

  listDefaultRoles: async (): Promise<{ roles: { name: string; permissions: string[]; is_system: boolean }[] }> => {
    const response = await apiClient.get('/vendors/me/roles/defaults')
    return response.data
  },

  // ── POS ────────────────────────────────────────────────────────
  posOpenSession: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/pos/sessions/open', data)
    return response.data
  },
  posCloseSession: async (sessionId: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/pos/sessions/${sessionId}/close`, data)
    return response.data
  },
  posGetCurrentSession: async () => {
    const response = await apiClient.get('/vendors/me/pos/sessions/current')
    return response.data
  },
  posListSessions: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/pos/sessions', { params })
    return response.data
  },
  // ── Product Modifiers ─────────────────────────────────────────────
  productListModifiers: async (productId: string): Promise<{ items: ModifierGroup[] }> => {
    const response = await apiClient.get(`/vendors/me/products/${productId}/modifiers`)
    return response.data
  },
  productCreateModifierGroup: async (productId: string, body: {
    name: string; selection_type?: string; is_required?: boolean; min_select?: number; max_select?: number; sort_order?: number; is_active?: boolean
  }) => {
    const response = await apiClient.post(`/vendors/me/products/${productId}/modifiers`, body)
    return response.data as ModifierGroup
  },
  productUpdateModifierGroup: async (productId: string, groupId: string, body: Partial<{ name: string; selection_type: string; is_required: boolean; min_select: number; max_select: number; sort_order: number; is_active: boolean }>) => {
    const response = await apiClient.patch(`/vendors/me/products/${productId}/modifiers/${groupId}`, body)
    return response.data as ModifierGroup
  },
  productDeleteModifierGroup: async (productId: string, groupId: string) => {
    await apiClient.delete(`/vendors/me/products/${productId}/modifiers/${groupId}`)
  },
  productCreateModifierOption: async (productId: string, groupId: string, body: { name: string; price_delta?: number; is_default?: boolean; is_active?: boolean; sort_order?: number }) => {
    const response = await apiClient.post(`/vendors/me/products/${productId}/modifiers/${groupId}/options`, body)
    return response.data as ModifierOption
  },
  productUpdateModifierOption: async (productId: string, groupId: string, optionId: string, body: Partial<{ name: string; price_delta: number; is_default: boolean; is_active: boolean; sort_order: number }>) => {
    const response = await apiClient.patch(`/vendors/me/products/${productId}/modifiers/${groupId}/options/${optionId}`, body)
    return response.data as ModifierOption
  },
  productDeleteModifierOption: async (productId: string, groupId: string, optionId: string) => {
    await apiClient.delete(`/vendors/me/products/${productId}/modifiers/${groupId}/options/${optionId}`)
  },

  posCreateTransaction: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/pos/transactions', data)
    return response.data
  },
  /** All POS transactions for the vendor (includes walk-in; not limited to Order mirror rows). */
  posListTransactions: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/pos/transactions', { params })
    return response.data as { items: Record<string, unknown>[]; total: number; page: number; size: number; pages: number }
  },
  posGetTransactions: async (sessionId: string, params?: Record<string, unknown>) => {
    const response = await apiClient.get(`/vendors/me/pos/sessions/${sessionId}/transactions`, { params })
    return response.data
  },
  posGetZReport: async (sessionId: string) => {
    const response = await apiClient.get(`/vendors/me/pos/sessions/${sessionId}/z-report`)
    return response.data
  },
  posLookupTransaction: async (txnNumber: string) => {
    const response = await apiClient.get('/vendors/me/pos/transactions/lookup', { params: { txn_number: txnNumber } })
    return response.data
  },
  posGetTransaction: async (txnId: string) => {
    const response = await apiClient.get(`/vendors/me/pos/transactions/${txnId}`)
    return response.data
  },
  /** Soft-delete (void) a credit or debit memo; records reason in notes and sets status voided. */
  posVoidMemo: async (txnId: string, data?: { reason?: string }) => {
    const response = await apiClient.post(`/vendors/me/pos/transactions/${txnId}/void`, data ?? {})
    return response.data
  },
  /** Update memo lines, customer, discount, and payment split in place. */
  posUpdateMemo: async (txnId: string, data: Record<string, unknown>) => {
    const response = await apiClient.patch(`/vendors/me/pos/transactions/${txnId}/memo`, data)
    return response.data
  },

  // ── Restaurant (floor / kitchen / POS table tagging) ───────────
  restaurantListZones: async (): Promise<{ items: Array<{ id: string; vendor_id: string; name: string; sort_order: number }> }> => {
    const response = await apiClient.get('/vendors/me/restaurant/zones')
    return response.data
  },
  restaurantCreateZone: async (body: { name: string; sort_order?: number }) => {
    const response = await apiClient.post('/vendors/me/restaurant/zones', body)
    return response.data
  },
  restaurantPatchZone: async (zoneId: string, body: { name?: string; sort_order?: number }) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/zones/${zoneId}`, body)
    return response.data
  },
  restaurantDeleteZone: async (zoneId: string) => {
    await apiClient.delete(`/vendors/me/restaurant/zones/${zoneId}`)
  },
  restaurantListTables: async (params?: { zone_id?: string }): Promise<{
    items: Array<{ id: string; zone_id?: string | null; zone_name?: string | null; label: string; capacity: number; is_active: boolean }>
  }> => {
    const response = await apiClient.get('/vendors/me/restaurant/tables', { params })
    return response.data
  },
  restaurantCreateTable: async (body: { label: string; zone_id?: string | null; capacity?: number; sort_order?: number; is_active?: boolean }) => {
    const response = await apiClient.post('/vendors/me/restaurant/tables', body)
    return response.data
  },
  restaurantPatchTable: async (tableId: string, body: Record<string, unknown>) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/tables/${tableId}`, body)
    return response.data
  },
  restaurantDeleteTable: async (tableId: string) => {
    await apiClient.delete(`/vendors/me/restaurant/tables/${tableId}`)
  },
  restaurantKitchenTickets: async (params?: { include_done?: boolean }) => {
    const response = await apiClient.get('/vendors/me/restaurant/kitchen-tickets', { params })
    return response.data as {
      items: Array<{
        transaction_id: string
        transaction_number: string
        table_label?: string | null
        kitchen_ticket_status: string
        items: Record<string, unknown>[]
        total: number
        notes?: string | null
        created_at?: string | null
      }>
    }
  },
  restaurantPatchKitchenTicket: async (txnId: string, kitchen_ticket_status: 'new' | 'preparing' | 'ready' | 'done') => {
    const response = await apiClient.patch(`/vendors/me/restaurant/kitchen-tickets/${txnId}`, { kitchen_ticket_status })
    return response.data
  },

  // ── Restaurant Orders (open tabs) ─────────────────────────────────
  restaurantCreateOrder: async (body: { table_id: string; covers?: number; server_name?: string; notes?: string }) => {
    const response = await apiClient.post('/vendors/me/restaurant/orders', body)
    return response.data as RestaurantOrder
  },
  restaurantListOrders: async (params?: { status?: string }) => {
    const response = await apiClient.get('/vendors/me/restaurant/orders', { params })
    return response.data as { items: RestaurantOrder[] }
  },
  restaurantGetOrder: async (orderId: string) => {
    const response = await apiClient.get(`/vendors/me/restaurant/orders/${orderId}`)
    return response.data as RestaurantOrder
  },
  restaurantSendKOT: async (orderId: string, body: { items: RestaurantOrderItem[]; notes?: string }) => {
    const response = await apiClient.post(`/vendors/me/restaurant/orders/${orderId}/send-kot`, body)
    return response.data as RestaurantKOT
  },
  restaurantRequestBill: async (orderId: string) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/orders/${orderId}/request-bill`, {})
    return response.data as { id: string; status: string }
  },
  restaurantCloseOrder: async (orderId: string, pos_transaction_id: string) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/orders/${orderId}/close`, { pos_transaction_id })
    return response.data as { id: string; status: string }
  },
  restaurantVoidOrder: async (orderId: string) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/orders/${orderId}/void`, {})
    return response.data as { id: string; status: string }
  },

  // ── KOTs ──────────────────────────────────────────────────────────
  restaurantListKOTs: async (params?: { include_done?: boolean }) => {
    const response = await apiClient.get('/vendors/me/restaurant/kots', { params })
    return response.data as { items: RestaurantKOT[] }
  },
  restaurantPatchKOT: async (kotId: string, status: 'new' | 'preparing' | 'ready' | 'done') => {
    const response = await apiClient.patch(`/vendors/me/restaurant/kots/${kotId}`, { status })
    return response.data as { id: string; status: string }
  },
  restaurantSetTableStatus: async (tableId: string, status: 'free' | 'seated' | 'ordering' | 'billed' | 'dirty') => {
    const response = await apiClient.patch(`/vendors/me/restaurant/tables/${tableId}/status`, { status })
    return response.data as { id: string; status: string }
  },
  restaurantGenerateQR: async (tableId: string) => {
    const response = await apiClient.post(`/vendors/me/restaurant/tables/${tableId}/generate-qr`, {})
    return response.data as { id: string; qr_token: string }
  },

  // ── Reservations ─────────────────────────────────────────────────
  restaurantListReservations: async (params?: { date_from?: string; date_to?: string; status?: string }) => {
    const response = await apiClient.get('/vendors/me/restaurant/reservations', { params })
    return response.data as { items: ReservationItem[] }
  },
  restaurantCreateReservation: async (body: {
    guest_name: string; guest_phone?: string; guest_email?: string
    reservation_date: string; reservation_time: string; party_size?: number
    table_id?: string; notes?: string; source?: string
  }) => {
    const response = await apiClient.post('/vendors/me/restaurant/reservations', body)
    return response.data as ReservationItem
  },
  restaurantUpdateReservation: async (
    id: string,
    body: {
      status?: string
      table_id?: string
      guest_name?: string
      guest_phone?: string
      guest_email?: string
      reservation_date?: string
      reservation_time?: string
      party_size?: number
      notes?: string
    },
  ) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/reservations/${id}`, body)
    return response.data as ReservationItem
  },
  restaurantSeatReservation: async (id: string, body: { table_id: string; covers?: number }) => {
    const response = await apiClient.post(`/vendors/me/restaurant/reservations/${id}/seat`, body)
    return response.data as { reservation: ReservationItem; order_id: string; table_id?: string }
  },
  restaurantDeleteReservation: async (id: string) => {
    await apiClient.delete(`/vendors/me/restaurant/reservations/${id}`)
  },

  restaurantGetMenuSettings: async () => {
    const response = await apiClient.get('/vendors/me/restaurant/menu')
    return response.data as {
      mode: 'all_active' | 'curated'
      product_ids: string[]
      items: Array<{ id: string; name: string; category?: string; price: number; status: string }>
    }
  },
  restaurantUpdateMenuSettings: async (body: { mode: 'all_active' | 'curated'; product_ids: string[] }) => {
    const response = await apiClient.put('/vendors/me/restaurant/menu', body)
    return response.data as { mode: string; product_ids: string[] }
  },
  restaurantListDineInProducts: async () => {
    const response = await apiClient.get('/vendors/me/restaurant/dine-in-products')
    return response.data as { items: Array<{ id: string; name: string; sku?: string; price: number; tax_rate?: number; category?: string; item_type?: string }> }
  },

  // ── Restaurant Reports ────────────────────────────────────────────
  restaurantReportDashboard: async () => {
    const response = await apiClient.get('/vendors/me/reports/restaurant')
    return response.data as RestaurantReportDashboard
  },
  restaurantReportKotsByHour: async (days?: number) => {
    const response = await apiClient.get('/vendors/me/reports/restaurant/kots-by-hour', { params: { days: days ?? 1 } })
    return response.data as { data: Array<{ hour: number; kots: number }> }
  },

  // ── Invoices ──────────────────────────────────────────────────
  listInvoices: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/invoices', { params })
    return response.data
  },
  createInvoice: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/invoices', data)
    return response.data
  },
  getInvoice: async (id: string) => {
    const response = await apiClient.get(`/vendors/me/invoices/${id}`)
    return response.data
  },
  updateInvoice: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/invoices/${id}`, data)
    return response.data
  },
  recordInvoicePayment: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/invoices/${id}/payment`, data)
    return response.data
  },
  convertEstimate: async (id: string) => {
    const response = await apiClient.post(`/vendors/me/invoices/${id}/convert`)
    return response.data
  },

  // ── Invoice Templates ────────────────────────────────────────────
  listInvoiceTemplates: async (): Promise<{ items: InvoiceTemplate[] }> => {
    const response = await apiClient.get('/vendors/me/invoice-templates')
    return response.data
  },

  createInvoiceTemplate: async (data: Record<string, unknown>): Promise<InvoiceTemplate> => {
    const response = await apiClient.post('/vendors/me/invoice-templates', data)
    return response.data
  },

  updateInvoiceTemplate: async (id: string, data: Record<string, unknown>): Promise<InvoiceTemplate> => {
    const response = await apiClient.put(`/vendors/me/invoice-templates/${id}`, data)
    return response.data
  },

  deleteInvoiceTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/invoice-templates/${id}`)
  },

  setDefaultTemplate: async (id: string): Promise<InvoiceTemplate> => {
    const response = await apiClient.post(`/vendors/me/invoice-templates/${id}/set-default`)
    return response.data
  },

  // ── Coupons ───────────────────────────────────────────────────
  listCoupons: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/coupons', { params })
    return response.data
  },
  createCoupon: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/coupons', data)
    return response.data
  },
  updateCoupon: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/coupons/${id}`, data)
    return response.data
  },
  deleteCoupon: async (id: string) => {
    await apiClient.delete(`/vendors/me/coupons/${id}`)
  },
  validateCoupon: async (code: string, orderTotal: number) => {
    const response = await apiClient.post('/vendors/me/coupons/validate', { code, order_total: orderTotal })
    return response.data as { valid: boolean; discount_amount: number; message: string; coupon?: Record<string, unknown> }
  },

  // ── Loyalty ───────────────────────────────────────────────────
  getLoyaltyProgram: async () => {
    const response = await apiClient.get('/vendors/me/loyalty/program')
    return response.data
  },
  updateLoyaltyProgram: async (data: Record<string, unknown>) => {
    const response = await apiClient.put('/vendors/me/loyalty/program', data)
    return response.data
  },
  getLoyaltyAccount: async (customerId: string) => {
    const response = await apiClient.get(`/vendors/me/loyalty/accounts/${customerId}`)
    return response.data as { id: string; customer_id: string; points_balance: number; lifetime_earned: number; lifetime_redeemed: number; tier: string }
  },
  getLoyaltyTransactions: async (customerId: string, params?: Record<string, unknown>) => {
    const response = await apiClient.get(`/vendors/me/loyalty/accounts/${customerId}/transactions`, { params })
    return response.data
  },

  // ── Reports ───────────────────────────────────────────────────
  getDashboardStats: async () => {
    const response = await apiClient.get('/vendors/me/reports/dashboard')
    return response.data
  },
  getSalesByDay: async (days?: number) => {
    const response = await apiClient.get('/vendors/me/reports/sales-by-day', { params: { days } })
    return response.data
  },
  getTopProducts: async (limit?: number) => {
    const response = await apiClient.get('/vendors/me/reports/top-products', { params: { limit } })
    return response.data
  },
  getTopCustomers: async (limit?: number) => {
    const response = await apiClient.get('/vendors/me/reports/top-customers', { params: { limit } })
    return response.data
  },
  getOrdersByStatus: async () => {
    const response = await apiClient.get('/vendors/me/reports/orders-by-status')
    return response.data
  },
  getRevenueSummary: async () => {
    const response = await apiClient.get('/vendors/me/reports/revenue-summary')
    return response.data
  },

  // ── Plans ─────────────────────────────────────────────────────
  getAvailablePlans: async () => {
    const response = await apiClient.get('/vendors/plans')
    return response.data as VendorPlanInfo[]
  },

  getMyPlan: async () => {
    const response = await apiClient.get('/vendors/me/plan')
    return response.data as { plan: VendorPlanInfo | null; message?: string }
  },

  changePlan: async (planId: string) => {
    const response = await apiClient.put('/vendors/me/plan', { plan_id: planId })
    return response.data
  },

  // ── Template ──────────────────────────────────────────────────
  getTemplateConfig: async () => {
    const response = await apiClient.get('/vendors/me/template')
    return response.data
  },
  getTemplatePresets: async () => {
    const response = await apiClient.get('/vendors/me/template/presets')
    return response.data
  },
  updateTemplateConfig: async (data: Record<string, unknown>) => {
    const response = await apiClient.put('/vendors/me/template', data)
    return response.data
  },
  applyTemplatePreset: async (presetId: string) => {
    const response = await apiClient.post(`/vendors/me/template/apply-preset/${presetId}`)
    return response.data
  },

  // ── Business Front Builder ────────────────────────────────────────
  getStorefrontBuilderConfig: async (): Promise<Record<string, unknown> | null> => {
    try {
      const response = await apiClient.get('/vendors/me/template')
      return (response.data?.builder_config as Record<string, unknown>) ?? null
    } catch {
      return null
    }
  },
  updateStorefrontBuilderConfig: async (config: Record<string, unknown>): Promise<void> => {
    await apiClient.put('/vendors/me/template', { builder_config: config })
  },

  // ── Suppliers ──────────────────────────────────────────────────
  listSuppliers: async (params?: Record<string, unknown>): Promise<{ items: Supplier[]; total: number }> => {
    const response = await apiClient.get('/vendors/me/suppliers', { params })
    return response.data
  },

  createSupplier: async (data: Record<string, unknown>): Promise<Supplier> => {
    const response = await apiClient.post('/vendors/me/suppliers', data)
    return response.data
  },

  getSupplier: async (id: string): Promise<Supplier> => {
    const response = await apiClient.get(`/vendors/me/suppliers/${id}`)
    return response.data
  },

  updateSupplier: async (id: string, data: Record<string, unknown>): Promise<Supplier> => {
    const response = await apiClient.put(`/vendors/me/suppliers/${id}`, data)
    return response.data
  },

  deleteSupplier: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/suppliers/${id}`)
  },

  // ── Purchase Orders ───────────────────────────────────────────
  listPurchaseOrders: async (params?: Record<string, unknown>): Promise<PaginatedResponse<PurchaseOrder>> => {
    const response = await apiClient.get('/vendors/me/purchase-orders', { params })
    return response.data
  },

  createPurchaseOrder: async (data: Record<string, unknown>): Promise<PurchaseOrder> => {
    const response = await apiClient.post('/vendors/me/purchase-orders', data)
    return response.data
  },

  getPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.get(`/vendors/me/purchase-orders/${id}`)
    return response.data
  },

  updatePurchaseOrder: async (id: string, data: Record<string, unknown>): Promise<PurchaseOrder> => {
    const response = await apiClient.put(`/vendors/me/purchase-orders/${id}`, data)
    return response.data
  },

  sendPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/vendors/me/purchase-orders/${id}/send`)
    return response.data
  },

  receivePurchaseOrderItems: async (id: string, data: Record<string, unknown>): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/vendors/me/purchase-orders/${id}/receive`, data)
    return response.data
  },

  closePurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/vendors/me/purchase-orders/${id}/close`)
    return response.data
  },

  cancelPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/vendors/me/purchase-orders/${id}/cancel`)
    return response.data
  },

  // ── Inventory ─────────────────────────────────────────────────
  inventoryStockIn: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/inventory/stock-in', data)
    return response.data
  },

  inventoryStockOut: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/inventory/stock-out', data)
    return response.data
  },

  inventoryAdjust: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/inventory/adjust', data)
    return response.data
  },

  inventoryHistory: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/inventory/history', { params })
    return response.data
  },

  inventorySummary: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/inventory/summary', { params })
    return response.data
  },

  inventoryLowStock: async () => {
    const response = await apiClient.get('/vendors/me/inventory/low-stock')
    return response.data
  },

  // ── Bookings ───────────────────────────────────────────────────
  listBookings: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/bookings', { params })
    return response.data
  },

  createBooking: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/bookings', data)
    return response.data
  },

  getBooking: async (id: string) => {
    const response = await apiClient.get(`/vendors/me/bookings/${id}`)
    return response.data
  },

  updateBooking: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/bookings/${id}/status`, data)
    return response.data
  },

  updateBookingStatus: async (id: string, data: { status: string; cancel_reason?: string; note?: string; delivery_notes?: string }) => {
    const response = await apiClient.put(`/vendors/me/bookings/${id}/status`, data)
    return response.data
  },

  assignBookingStaff: async (id: string, data: { staff_id?: string; staff_name: string }) => {
    const response = await apiClient.put(`/vendors/me/bookings/${id}/assign`, data)
    return response.data
  },

  addBookingFollowup: async (id: string, data: { content: string; type?: string }) => {
    const response = await apiClient.post(`/vendors/me/bookings/${id}/followups`, data)
    return response.data
  },

  updateBookingNotes: async (id: string, data: { internal_notes?: string; delivery_notes?: string }) => {
    const response = await apiClient.put(`/vendors/me/bookings/${id}/notes`, data)
    return response.data
  },

  uploadBookingAttachment: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post(`/vendors/me/bookings/${id}/attachments`, form)
    return response.data
  },

  deleteBookingAttachment: async (id: string, attachmentId: string) => {
    const response = await apiClient.delete(`/vendors/me/bookings/${id}/attachments/${attachmentId}`)
    return response.data
  },

  getBookingTodaySummary: async () => {
    const response = await apiClient.get('/vendors/me/bookings/today-summary')
    return response.data
  },

  generateBookingOtp: async (id: string) => {
    const response = await apiClient.post(`/vendors/me/bookings/${id}/send-completion-otp`)
    return response.data as { sent: boolean; expires_in_minutes: number; dev_hint?: string }
  },

  verifyBookingOtp: async (id: string, otp: string) => {
    const response = await apiClient.post(`/vendors/me/bookings/${id}/verify-otp`, { otp })
    return response.data
  },

  // ── Projects ───────────────────────────────────────────────────
  getProjectsOverview: async () => {
    const response = await apiClient.get('/vendors/me/projects/overview')
    return response.data
  },

  listProjects: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/projects', { params })
    return response.data
  },

  createProject: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/projects', data)
    return response.data
  },

  getProject: async (id: string) => {
    const response = await apiClient.get(`/vendors/me/projects/${id}`)
    return response.data
  },

  updateProject: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/projects/${id}`, data)
    return response.data
  },

  deleteProject: async (id: string) => {
    const response = await apiClient.delete(`/vendors/me/projects/${id}`)
    return response.data
  },

  listProjectTasks: async (projectId: string) => {
    const response = await apiClient.get(`/vendors/me/projects/${projectId}/tasks`)
    return response.data
  },

  createProjectTask: async (projectId: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/projects/${projectId}/tasks`, data)
    return response.data
  },

  updateProjectTask: async (projectId: string, taskId: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/projects/${projectId}/tasks/${taskId}`, data)
    return response.data
  },

  deleteProjectTask: async (projectId: string, taskId: string) => {
    const response = await apiClient.delete(`/vendors/me/projects/${projectId}/tasks/${taskId}`)
    return response.data
  },

  reorderProjectTasks: async (
    projectId: string,
    items: Array<{ id: string; status: string; position: number }>,
  ) => {
    const response = await apiClient.put(`/vendors/me/projects/${projectId}/tasks/reorder`, { items })
    return response.data
  },

  // ── Notifications ──────────────────────────────────────────────
  listNotifications: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/notifications', { params })
    return response.data
  },

  getNotificationStats: async () => {
    const response = await apiClient.get('/vendors/me/notifications/stats')
    return response.data
  },

  sendTestNotification: async (phone: string) => {
    const response = await apiClient.post('/vendors/me/notifications/send-test', null, { params: { phone } })
    return response.data
  },

  // ── Merchandising ────────────────────────────────────────────────
  listBundles: async (): Promise<{ items: Bundle[]; total: number }> => {
    const response = await apiClient.get('/vendors/me/merchandising/bundles')
    return response.data
  },

  createBundle: async (data: Record<string, unknown>): Promise<Bundle> => {
    const response = await apiClient.post('/vendors/me/merchandising/bundles', data)
    return response.data
  },

  updateBundle: async (id: string, data: Record<string, unknown>): Promise<Bundle> => {
    const response = await apiClient.put(`/vendors/me/merchandising/bundles/${id}`, data)
    return response.data
  },

  deleteBundle: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/merchandising/bundles/${id}`)
  },

  getProductMerchandising: async (productId: string): Promise<ProductMerchandising> => {
    const response = await apiClient.get(`/vendors/me/merchandising/products/${productId}/merchandising`)
    return response.data
  },

  syncProductMerchandising: async (productId: string, data: { mappings: Array<Record<string, unknown>> }): Promise<ProductMerchandising> => {
    const response = await apiClient.put(`/vendors/me/merchandising/products/${productId}/merchandising`, data)
    return response.data
  },

  // ── MRP / BOM / Stock Reservations ────────────────────────────────────────
  getProductBOM: async (productId: string): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.get(`/vendors/me/products/${productId}/bom`)
    return response.data
  },

  putProductBOM: async (productId: string, items: Record<string, unknown>[]): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.put(`/vendors/me/products/${productId}/bom`, items)
    return response.data
  },

  calculateMRP: async (body: { items: Record<string, unknown>[]; order_type: string; order_id: string }): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.post('/vendors/me/mrp/calculate', body)
    return response.data
  },

  listReservations: async (params?: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.get('/vendors/me/stock-reservations', { params })
    return response.data
  },

  createReservations: async (data: { order_type: string; order_id: string; items: Record<string, unknown>[] }): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.post('/vendors/me/stock-reservations', data)
    return response.data
  },

  releaseReservation: async (id: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.delete(`/vendors/me/stock-reservations/${id}`)
    return response.data
  },

  releaseAllReservations: async (params: { order_type: string; order_id: string }): Promise<Record<string, unknown>> => {
    const response = await apiClient.delete('/vendors/me/stock-reservations', { params })
    return response.data
  },

  // ── HR: Departments ──────────────────────────────────────────────
  hrListDepartments: async () => {
    const r = await apiClient.get('/vendors/me/hr/departments')
    return r.data
  },
  hrCreateDepartment: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/departments', data)
    return r.data
  },
  hrUpdateDepartment: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/departments/${id}`, data)
    return r.data
  },
  hrDeleteDepartment: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/departments/${id}`)
  },

  // ── HR: Designations ─────────────────────────────────────────────
  hrListDesignations: async () => {
    const r = await apiClient.get('/vendors/me/hr/designations')
    return r.data
  },
  hrCreateDesignation: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/designations', data)
    return r.data
  },
  hrUpdateDesignation: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/designations/${id}`, data)
    return r.data
  },
  hrDeleteDesignation: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/designations/${id}`)
  },

  // ── HR: Employees ────────────────────────────────────────────────
  hrNextEmployeeCode: async (storeId?: string) => {
    const r = await apiClient.get('/vendors/me/hr/employees/next-code', { params: storeId ? { store_id: storeId } : {} })
    return r.data as { next_code: string }
  },
  hrListEmployees: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/hr/employees', { params })
    return r.data
  },
  hrListEmployeesEligibleForAccess: async (params?: { search?: string; limit?: number }) => {
    const r = await apiClient.get('/vendors/me/hr/employees/eligible-for-access', { params })
    return r.data as {
      items: {
        id: string
        full_name?: string | null
        employee_code?: string
        personal_email?: string | null
        personal_phone?: string | null
        department?: string | null
        designation?: string | null
      }[]
    }
  },
  hrGetEmployee: async (id: string) => {
    const r = await apiClient.get(`/vendors/me/hr/employees/${id}`)
    return r.data
  },
  hrCreateEmployee: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/employees', data)
    return r.data
  },
  hrUpdateEmployee: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/employees/${id}`, data)
    return r.data
  },
  hrSetEmployeePortalPassword: async (empId: string, password: string) => {
    const r = await apiClient.post(`/vendors/me/hr/employees/${empId}/portal-password`, { password })
    return r.data as { success: boolean; message?: string }
  },
  hrGenerateEmployeeOtp: async (empId: string) => {
    const r = await apiClient.post(`/vendors/me/hr/employees/${empId}/portal-otp`)
    return r.data as { otp: string; employee_name: string; login: string }
  },
  hrListDocuments: async (empId: string) => {
    const r = await apiClient.get(`/vendors/me/hr/employees/${empId}/documents`)
    return r.data
  },
  hrAddDocument: async (empId: string, data: Record<string, unknown>) => {
    const r = await apiClient.post(`/vendors/me/hr/employees/${empId}/documents`, data)
    return r.data
  },
  hrDeleteDocument: async (empId: string, docId: string) => {
    await apiClient.delete(`/vendors/me/hr/employees/${empId}/documents/${docId}`)
  },
  hrUploadDocumentFile: async (empId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const r = await apiClient.post(`/uploads/hr/${empId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data as { file_url: string; original_name: string; content_type: string; is_image: boolean; size: number }
  },

  // ── HR: Attendance ───────────────────────────────────────────────
  hrClockIn: async (location?: { lat: number; lng: number }) => {
    const r = await apiClient.post('/vendors/me/hr/attendance/clock-in', { location })
    return r.data
  },
  hrClockOut: async (location?: { lat: number; lng: number }) => {
    const r = await apiClient.post('/vendors/me/hr/attendance/clock-out', { location })
    return r.data
  },
  hrMyToday: async () => {
    const r = await apiClient.get('/vendors/me/hr/attendance/my-today')
    return r.data
  },
  hrListAttendance: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/hr/attendance', { params })
    return r.data
  },
  hrMarkAttendance: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/attendance/mark', data)
    return r.data
  },
  hrUpdateAttendance: async (recordId: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/attendance/${recordId}`, data)
    return r.data
  },
  hrMarkAttendanceRange: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/attendance/mark-range', data)
    return r.data
  },
  hrSeedTestData: async (days = 30) => {
    const r = await apiClient.post(`/vendors/me/hr/seed-test-data?days=${days}`)
    return r.data
  },
  hrAttendanceReport: async (month: number, year: number) => {
    const r = await apiClient.get('/vendors/me/hr/attendance/report', { params: { month, year } })
    return r.data
  },

  // ── HR: Leaves ───────────────────────────────────────────────────
  hrListLeavePolicies: async () => {
    const r = await apiClient.get('/vendors/me/hr/leaves/policies')
    return r.data
  },
  hrCreateLeavePolicy: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/leaves/policies', data)
    return r.data
  },
  hrUpdateLeavePolicy: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/leaves/policies/${id}`, data)
    return r.data
  },
  hrGetLeaveBalances: async (employeeId: string, year?: number) => {
    const r = await apiClient.get('/vendors/me/hr/leaves/balances', { params: { employee_id: employeeId, year } })
    return r.data
  },
  hrSubmitLeaveRequest: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/leaves/request', data)
    return r.data
  },
  hrListLeaveRequests: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/hr/leaves/requests', { params })
    return r.data
  },
  hrApproveLeave: async (id: string) => {
    const r = await apiClient.put(`/vendors/me/hr/leaves/requests/${id}/approve`)
    return r.data
  },
  hrRejectLeave: async (id: string, reason?: string) => {
    const r = await apiClient.put(`/vendors/me/hr/leaves/requests/${id}/reject`, { rejection_reason: reason })
    return r.data
  },
  hrCancelLeave: async (id: string) => {
    const r = await apiClient.put(`/vendors/me/hr/leaves/requests/${id}/cancel`)
    return r.data
  },
  hrMyLeaves: async (year?: number) => {
    const r = await apiClient.get('/vendors/me/hr/leaves/my', { params: { year } })
    return r.data
  },
  hrListHolidays: async (year?: number) => {
    const r = await apiClient.get('/vendors/me/hr/leaves/holidays', { params: { year } })
    return r.data
  },
  hrCreateHoliday: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/leaves/holidays', data)
    return r.data
  },
  hrDeleteHoliday: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/leaves/holidays/${id}`)
  },

  // ── HR: Salary ───────────────────────────────────────────────────
  hrListSalaryStructures: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/hr/salary/structures', { params })
    return r.data
  },
  hrCreateSalaryStructure: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/salary/structures', data)
    return r.data
  },
  hrGetSalaryStructure: async (id: string) => {
    const r = await apiClient.get(`/vendors/me/hr/salary/structures/${id}`)
    return r.data
  },

  // ── HR: Payroll ──────────────────────────────────────────────────
  hrListPayrollRuns: async (year?: number) => {
    const r = await apiClient.get('/vendors/me/hr/payroll', { params: { year } })
    return r.data
  },
  hrProcessPayroll: async (data: { month: number; year: number }) => {
    const r = await apiClient.post('/vendors/me/hr/payroll/process', data)
    return r.data
  },
  hrGetPayrollRun: async (id: string) => {
    const r = await apiClient.get(`/vendors/me/hr/payroll/${id}`)
    return r.data
  },
  hrFinalizePayroll: async (id: string) => {
    const r = await apiClient.put(`/vendors/me/hr/payroll/${id}/finalize`)
    return r.data
  },
  hrMarkPayrollPaid: async (id: string) => {
    const r = await apiClient.put(`/vendors/me/hr/payroll/${id}/mark-paid`)
    return r.data
  },
  hrDeletePayrollRun: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/payroll/${id}`)
  },
  hrDownloadPayrollCsv: async (id: string, filename: string) => {
    const r = await apiClient.get(`/vendors/me/hr/payroll/${id}/export-csv`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  },
  hrGetPayslip: async (runId: string, entryId: string) => {
    const r = await apiClient.get(`/vendors/me/hr/payroll/${runId}/entries/${entryId}`)
    return r.data
  },
  hrGetPayslipHtmlUrl: (runId: string, entryId: string) =>
    `/api/v1/vendors/me/hr/payroll/${runId}/entries/${entryId}/payslip-html`,
  hrMyPayslips: async () => {
    const r = await apiClient.get('/vendors/me/hr/payroll/my-payslips')
    return r.data
  },

  // ── HR: Offer Letters ─────────────────────────────────────────────
  hrListOffers: async () => {
    const r = await apiClient.get('/vendors/me/hr/offers')
    return r.data
  },
  hrCreateOffer: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/offers', data)
    return r.data
  },
  hrUpdateOffer: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/offers/${id}`, data)
    return r.data
  },
  hrSendOffer: async (id: string) => {
    const r = await apiClient.post(`/vendors/me/hr/offers/${id}/send`)
    return r.data
  },
  hrGetOfferHtmlUrl: (id: string) => `/api/v1/vendors/me/hr/offers/${id}/pdf`,
  hrGetOfferHtml: async (id: string): Promise<string> => {
    const r = await apiClient.get(`/vendors/me/hr/offers/${id}/pdf`, { responseType: 'text' })
    return r.data as string
  },
  hrDeleteOffer: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/offers/${id}`)
  },

  // ── Offer Letter Templates ────────────────────────────────────────
  hrListOfferTemplates: async (params?: { designation_id?: string; department_id?: string; store_id?: string }) => {
    const r = await apiClient.get('/vendors/me/hr/offer-templates', { params })
    return r.data as import('../types').OfferLetterTemplate[]
  },
  hrGetOfferTemplate: async (id: string) => {
    const r = await apiClient.get(`/vendors/me/hr/offer-templates/${id}`)
    return r.data as import('../types').OfferLetterTemplate
  },
  hrCreateOfferTemplate: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/hr/offer-templates', data)
    return r.data as import('../types').OfferLetterTemplate
  },
  hrUpdateOfferTemplate: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/offer-templates/${id}`, data)
    return r.data as import('../types').OfferLetterTemplate
  },
  hrDeleteOfferTemplate: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/offer-templates/${id}`)
  },
  hrSetDefaultOfferTemplate: async (id: string) => {
    const r = await apiClient.post(`/vendors/me/hr/offer-templates/${id}/default`)
    return r.data as import('../types').OfferLetterTemplate
  },

  // ════════════════════════════════════════════════════════════════
  // HR: Recruitment & Onboarding
  // ════════════════════════════════════════════════════════════════
  hrListJobs: async (status?: string) => (await apiClient.get('/vendors/me/hr/jobs', { params: { status } })).data,
  hrGetJob: async (id: string) => (await apiClient.get(`/vendors/me/hr/jobs/${id}`)).data,
  hrCreateJob: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/jobs', d)).data,
  hrUpdateJob: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/jobs/${id}`, d)).data,
  hrDeleteJob: async (id: string) => { await apiClient.delete(`/vendors/me/hr/jobs/${id}`) },

  hrListCandidates: async (search?: string) => (await apiClient.get('/vendors/me/hr/candidates', { params: { search } })).data,
  hrGetCandidate: async (id: string) => (await apiClient.get(`/vendors/me/hr/candidates/${id}`)).data,
  hrCreateCandidate: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/candidates', d)).data,
  hrUpdateCandidate: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/candidates/${id}`, d)).data,
  hrDeleteCandidate: async (id: string) => { await apiClient.delete(`/vendors/me/hr/candidates/${id}`) },

  hrListApplications: async (params?: { job_id?: string; stage?: string }) => (await apiClient.get('/vendors/me/hr/applications', { params })).data,
  hrGetApplication: async (id: string) => (await apiClient.get(`/vendors/me/hr/applications/${id}`)).data,
  hrCreateApplication: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/applications', d)).data,
  hrMoveApplicationStage: async (id: string, d: { stage: string; rejection_reason?: string; rating?: number }) =>
    (await apiClient.post(`/vendors/me/hr/applications/${id}/move-stage`, d)).data,
  hrDeleteApplication: async (id: string) => { await apiClient.delete(`/vendors/me/hr/applications/${id}`) },

  hrListInterviews: async (upcoming = true) => (await apiClient.get('/vendors/me/hr/interviews', { params: { upcoming } })).data,
  hrCreateInterview: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/interviews', d)).data,
  hrUpdateInterview: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/interviews/${id}`, d)).data,
  hrDeleteInterview: async (id: string) => { await apiClient.delete(`/vendors/me/hr/interviews/${id}`) },

  hrListOnbTemplates: async () => (await apiClient.get('/vendors/me/hr/onboarding/templates')).data,
  hrGetOnbTemplate: async (id: string) => (await apiClient.get(`/vendors/me/hr/onboarding/templates/${id}`)).data,
  hrCreateOnbTemplate: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/onboarding/templates', d)).data,
  hrUpdateOnbTemplate: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/onboarding/templates/${id}`, d)).data,
  hrDeleteOnbTemplate: async (id: string) => { await apiClient.delete(`/vendors/me/hr/onboarding/templates/${id}`) },

  hrListChecklists: async (status?: string) => (await apiClient.get('/vendors/me/hr/onboarding/checklists', { params: { status } })).data,
  hrGetChecklist: async (id: string) => (await apiClient.get(`/vendors/me/hr/onboarding/checklists/${id}`)).data,
  hrCreateChecklist: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/onboarding/checklists', d)).data,
  hrUpdateOnbTask: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/onboarding/tasks/${id}`, d)).data,
  hrMyChecklist: async () => (await apiClient.get('/vendors/me/hr/onboarding/my-checklist')).data,

  // ════════════════════════════════════════════════════════════════
  // HR: Performance
  // ════════════════════════════════════════════════════════════════
  hrListCycles: async () => (await apiClient.get('/vendors/me/hr/perf/cycles')).data,
  hrGetCycle: async (id: string) => (await apiClient.get(`/vendors/me/hr/perf/cycles/${id}`)).data,
  hrCreateCycle: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/perf/cycles', d)).data,
  hrUpdateCycle: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/perf/cycles/${id}`, d)).data,
  hrLaunchCycle: async (id: string) => (await apiClient.post(`/vendors/me/hr/perf/cycles/${id}/launch`)).data,
  hrCloseCycle: async (id: string) => (await apiClient.post(`/vendors/me/hr/perf/cycles/${id}/close`)).data,
  hrDeleteCycle: async (id: string) => { await apiClient.delete(`/vendors/me/hr/perf/cycles/${id}`) },

  hrListGoals: async (params?: { employee_id?: string; cycle_id?: string }) => (await apiClient.get('/vendors/me/hr/perf/goals', { params })).data,
  hrCreateGoal: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/perf/goals', d)).data,
  hrUpdateGoal: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/perf/goals/${id}`, d)).data,
  hrDeleteGoal: async (id: string) => { await apiClient.delete(`/vendors/me/hr/perf/goals/${id}`) },

  hrListReviews: async (params?: { cycle_id?: string; employee_id?: string; status?: string }) =>
    (await apiClient.get('/vendors/me/hr/perf/reviews', { params })).data,
  hrGetReview: async (id: string) => (await apiClient.get(`/vendors/me/hr/perf/reviews/${id}`)).data,
  hrSubmitSelfReview: async (id: string, d: Record<string, unknown>) =>
    (await apiClient.put(`/vendors/me/hr/perf/reviews/${id}/self`, d)).data,
  hrSubmitManagerReview: async (id: string, d: Record<string, unknown>) =>
    (await apiClient.put(`/vendors/me/hr/perf/reviews/${id}/manager`, d)).data,
  hrAcknowledgeReview: async (id: string, note?: string) =>
    (await apiClient.put(`/vendors/me/hr/perf/reviews/${id}/acknowledge`, { note })).data,
  hrMyPerformance: async () => (await apiClient.get('/vendors/me/hr/perf/me')).data,

  hrListFeedback: async (employee_id?: string) => (await apiClient.get('/vendors/me/hr/perf/feedback', { params: { employee_id } })).data,
  hrCreateFeedback: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/perf/feedback', d)).data,
  hrDeleteFeedback: async (id: string) => { await apiClient.delete(`/vendors/me/hr/perf/feedback/${id}`) },

  // ════════════════════════════════════════════════════════════════
  // HR: Compliance
  // ════════════════════════════════════════════════════════════════
  hrListPolicies: async (status?: string) => (await apiClient.get('/vendors/me/hr/policies', { params: { status } })).data,
  hrGetPolicy: async (id: string) => (await apiClient.get(`/vendors/me/hr/policies/${id}`)).data,
  hrCreatePolicy: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/policies', d)).data,
  hrUpdatePolicy: async (id: string, d: Record<string, unknown>, bumpVersion = false) =>
    (await apiClient.put(`/vendors/me/hr/policies/${id}`, d, { params: { bump_version: bumpVersion } })).data,
  hrPublishPolicy: async (id: string) => (await apiClient.post(`/vendors/me/hr/policies/${id}/publish`)).data,
  hrDeletePolicy: async (id: string) => { await apiClient.delete(`/vendors/me/hr/policies/${id}`) },
  hrAcknowledgePolicy: async (id: string) => (await apiClient.post(`/vendors/me/hr/policies/${id}/acknowledge`)).data,
  hrMyPendingPolicies: async () => (await apiClient.get('/vendors/me/hr/policies/me/pending')).data,

  hrListCertifications: async (params?: { employee_id?: string; expiring_within_days?: number }) =>
    (await apiClient.get('/vendors/me/hr/certifications', { params })).data,
  hrCreateCertification: async (d: Record<string, unknown>) =>
    (await apiClient.post('/vendors/me/hr/certifications', d)).data,
  hrUpdateCertification: async (id: string, d: Record<string, unknown>) =>
    (await apiClient.put(`/vendors/me/hr/certifications/${id}`, d)).data,
  hrDeleteCertification: async (id: string) => { await apiClient.delete(`/vendors/me/hr/certifications/${id}`) },

  hrListAuditLogs: async (params?: { entity_type?: string; entity_id?: string; limit?: number }) =>
    (await apiClient.get('/vendors/me/hr/audit-logs', { params })).data,
  hrDownloadAuditCsv: async () => {
    const r = await apiClient.get('/vendors/me/hr/audit-logs/export-csv', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `hr-audit-logs-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  },

  // ════════════════════════════════════════════════════════════════
  // HR: Training
  // ════════════════════════════════════════════════════════════════
  hrListPrograms: async (status?: string) => (await apiClient.get('/vendors/me/hr/training/programs', { params: { status } })).data,
  hrGetProgram: async (id: string) => (await apiClient.get(`/vendors/me/hr/training/programs/${id}`)).data,
  hrCreateProgram: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/training/programs', d)).data,
  hrUpdateProgram: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/training/programs/${id}`, d)).data,
  hrDeleteProgram: async (id: string) => { await apiClient.delete(`/vendors/me/hr/training/programs/${id}`) },

  hrCreateCourse: async (programId: string, d: Record<string, unknown>) =>
    (await apiClient.post(`/vendors/me/hr/training/programs/${programId}/courses`, d)).data,
  hrUpdateCourse: async (id: string, d: Record<string, unknown>) =>
    (await apiClient.put(`/vendors/me/hr/training/courses/${id}`, d)).data,
  hrDeleteCourse: async (id: string) => { await apiClient.delete(`/vendors/me/hr/training/courses/${id}`) },

  hrEnrollEmployees: async (d: { program_id: string; employee_ids: string[]; due_date?: string }) =>
    (await apiClient.post('/vendors/me/hr/training/enroll', d)).data,
  hrListEnrollments: async (params?: { program_id?: string; employee_id?: string }) =>
    (await apiClient.get('/vendors/me/hr/training/enrollments', { params })).data,
  hrGetEnrollment: async (id: string) => (await apiClient.get(`/vendors/me/hr/training/enrollments/${id}`)).data,
  hrCompleteCourse: async (eid: string, d: { course_id: string; score_pct?: number; passed?: boolean; answers?: Record<string, unknown> }) =>
    (await apiClient.post(`/vendors/me/hr/training/enrollments/${eid}/complete-course`, d)).data,
  hrMyTraining: async () => (await apiClient.get('/vendors/me/hr/training/me')).data,
  hrCertificateUrl: (cid: string) => `/api/v1/vendors/me/hr/training/certificates/${cid}/download`,

  // ════════════════════════════════════════════════════════════════
  // HR: ESS
  // ════════════════════════════════════════════════════════════════
  hrEssProfile: async () => (await apiClient.get('/vendors/me/hr/ess/me/profile')).data,
  hrListAnnouncements: async (status?: string) => (await apiClient.get('/vendors/me/hr/ess/announcements', { params: { status } })).data,
  hrMyAnnouncements: async () => (await apiClient.get('/vendors/me/hr/ess/me/announcements')).data,
  hrCreateAnnouncement: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/ess/announcements', d)).data,
  hrUpdateAnnouncement: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/ess/announcements/${id}`, d)).data,
  hrDeleteAnnouncement: async (id: string) => { await apiClient.delete(`/vendors/me/hr/ess/announcements/${id}`) },
  hrMarkAnnouncementRead: async (id: string) => { await apiClient.post(`/vendors/me/hr/ess/announcements/${id}/read`) },

  hrListExpenses: async (params?: { status?: string; employee_id?: string }) =>
    (await apiClient.get('/vendors/me/hr/ess/expenses', { params })).data,
  hrUploadExpenseReceipt: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const r = await apiClient.post('/vendors/me/hr/ess/expenses/receipt', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    })
    return r.data as { url: string; name: string; content_type?: string; is_image?: boolean; size?: number }
  },
  hrMyExpenses: async () => (await apiClient.get('/vendors/me/hr/ess/me/expenses')).data,
  hrGetExpense: async (id: string) => (await apiClient.get(`/vendors/me/hr/ess/expenses/${id}`)).data,
  hrCreateExpense: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/ess/expenses', d)).data,
  hrUpdateExpense: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/ess/expenses/${id}`, d)).data,
  hrDecideExpense: async (id: string, d: { decision: string; note?: string }) =>
    (await apiClient.post(`/vendors/me/hr/ess/expenses/${id}/decide`, d)).data,
  hrMarkExpensePaid: async (id: string, d: { payment_reference?: string }) =>
    (await apiClient.post(`/vendors/me/hr/ess/expenses/${id}/mark-paid`, d)).data,
  hrDeleteExpense: async (id: string) => { await apiClient.delete(`/vendors/me/hr/ess/expenses/${id}`) },

  hrListTickets: async (params?: { status?: string; assignee_user_id?: string }) =>
    (await apiClient.get('/vendors/me/hr/ess/tickets', { params })).data,
  hrMyTickets: async () => (await apiClient.get('/vendors/me/hr/ess/me/tickets')).data,
  hrGetTicket: async (id: string) => (await apiClient.get(`/vendors/me/hr/ess/tickets/${id}`)).data,
  hrCreateTicket: async (d: Record<string, unknown>) => (await apiClient.post('/vendors/me/hr/ess/tickets', d)).data,
  hrUpdateTicket: async (id: string, d: Record<string, unknown>) => (await apiClient.put(`/vendors/me/hr/ess/tickets/${id}`, d)).data,
  hrAddTicketComment: async (id: string, d: { body: string; is_internal?: boolean; attachment_url?: string }) =>
    (await apiClient.post(`/vendors/me/hr/ess/tickets/${id}/comments`, d)).data,
  hrDeleteTicket: async (id: string) => { await apiClient.delete(`/vendors/me/hr/ess/tickets/${id}`) },

  // ── Stores ───────────────────────────────────────────────────────
  listStores: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/stores', { params })
    return r.data as { stores: StoreRecord[]; total: number }
  },
  createStore: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/stores', data)
    return r.data as { store: StoreRecord; message: string }
  },
  getStore: async (id: string) => {
    const r = await apiClient.get(`/vendors/me/stores/${id}`)
    return r.data as { store: StoreRecord }
  },
  updateStore: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/stores/${id}`, data)
    return r.data as { store: StoreRecord; message: string }
  },
  deleteStore: async (id: string) => {
    await apiClient.delete(`/vendors/me/stores/${id}`)
  },
  getStoreInventory: async (storeId: string, params?: Record<string, unknown>) => {
    const r = await apiClient.get(`/vendors/me/stores/${storeId}/inventory`, { params })
    return r.data as { items: StoreInventoryItem[]; total: number; page: number; size: number }
  },
  setStoreInventory: async (storeId: string, productId: string, data: { quantity: number; low_stock_threshold?: number }) => {
    const r = await apiClient.put(`/vendors/me/stores/${storeId}/inventory/${productId}`, data)
    return r.data
  },
  transferStock: async (data: { from_store_id: string; to_store_id: string; product_id: string; quantity: number; reason?: string }) => {
    const r = await apiClient.post('/vendors/me/stores/transfer', data)
    return r.data
  },
  getStoreStaff: async (storeId: string) => {
    const r = await apiClient.get(`/vendors/me/stores/${storeId}/staff`)
    return r.data as { staff: StoreStaffMember[] }
  },
  assignStaffStore: async (data: { staff_id: string; store_id: string | null }) => {
    const r = await apiClient.post('/vendors/me/stores/assign-staff', data)
    return r.data
  },

  // ── Production orders ────────────────────────────────────────────
  listProductionOrders: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/production-orders', { params })
    return r.data as { items: Record<string, unknown>[]; total: number }
  },
  getProductionOrder: async (id: string) => {
    const r = await apiClient.get(`/vendors/me/production-orders/${id}`)
    return r.data as Record<string, unknown>
  },
  createProductionOrder: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/production-orders', data)
    return r.data as Record<string, unknown>
  },
  updateProductionOrder: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/production-orders/${id}`, data)
    return r.data as Record<string, unknown>
  },
  deleteProductionOrder: async (id: string) => {
    await apiClient.delete(`/vendors/me/production-orders/${id}`)
  },
  importLocalProductionOrders: async (data: { orders: Record<string, unknown>[]; default_store_id?: string }) => {
    const r = await apiClient.post('/vendors/me/production-orders/import-local', data)
    return r.data as { created: number; skipped: number }
  },
}
