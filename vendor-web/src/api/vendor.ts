import apiClient from './client'
import type { Vendor, Product, Service, ServiceMediaItem, Customer, Order, OrderStats, Review, PaginatedResponse, VendorRole, TeamMember, VendorCategory, Supplier, PurchaseOrder, OrderAttachmentRef, InvoiceTemplate, VendorPlanInfo, Bundle, ProductMerchandising, ProductPriceRule, VendorDocument, VendorDocumentType, PurchasingInfoRecord, SourceList, PurchaseRequisition, VendorInvoice, GoodsBatch, GoodsMovementDocument, MaterialValuation, ServiceEntrySheet, RestaurantOutlet, RestaurantMenuOut, RestaurantMenuCategoryOut, RestaurantMenuZoneLinkOut } from '@/types'

// ── Restaurant extra types ────────────────────────────────────────
export interface ReservationItem {
  id: string
  vendor_id: string
  restaurant_id?: string | null
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

// ── MRP / BOM / Stock Reservations ──────────────────────────────────
export interface BOMItemRecord {
  id: string
  product_id: string
  component_id: string
  component_name: string
  component_sku?: string | null
  component_uom?: string | null
  qty_per_unit: number
  notes?: string | null
  created_at?: string | null
}

export type MRPLineStatus = 'ok' | 'partial' | 'short' | 'no_bom'

export interface MRPResultLine {
  component_id: string
  component_name: string
  component_sku?: string | null
  component_uom?: string | null
  is_leaf: boolean
  bom_depth: number
  required_qty: number
  reserve_qty: number
  in_stock: number
  reserved_by_others: number
  already_reserved_for_order: number
  available: number
  shortage: number
  status: MRPLineStatus
  source_items: string[]
}

export type StockReservationStatus = 'active' | 'released' | 'consumed'

export interface StockReservationRecord {
  id: string
  vendor_id: string
  order_type: string
  order_id: string
  store_id?: string | null
  storage_location_id?: string | null
  product_id: string
  product_name?: string | null
  variant_id?: string | null
  reserved_qty: number
  status: StockReservationStatus
  notes?: string | null
  created_at?: string | null
  released_at?: string | null
  consumed_at?: string | null
}

// ── Production Routing: Work Centers & Operations ──────────────────
export interface WorkCenterRecord {
  id: string
  vendor_id: string
  plant_id?: string | null
  code: string
  name: string
  description?: string | null
  capacity_per_day?: number | null
  cost_per_hour: number
  is_active: boolean
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export type ProductionOperationStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export interface ProductionOperationRecord {
  id: string
  vendor_id: string
  production_order_id: string
  work_center_id?: string | null
  sequence: number
  name: string
  status: ProductionOperationStatus
  planned_hours: number
  actual_hours?: number | null
  planned_start?: string | null
  planned_end?: string | null
  started_at?: string | null
  completed_at?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductionAnalytics {
  range: { from: string; to: string }
  totals: {
    orders: number
    completed: number
    cancelled: number
    in_progress: number
    on_time: number
    late: number
    on_time_rate: number | null
    avg_cycle_days: number | null
  }
  by_status: { status: string; count: number }[]
  by_type: { type: string; count: number }[]
  cost: {
    planned_material: number
    actual_material: number
    planned_labor: number
    actual_labor: number
    planned_total: number
    actual_total: number
    variance: number
    variance_pct: number | null
  }
  trend: { date: string; created: number; completed: number }[]
  top_delayed: { id: string; ref: string; target_date: string; completed_date: string; days_late: number }[]
  work_center_utilization: { work_center_id: string | null; name: string; planned_hours: number; actual_hours: number; capacity_per_day: number | null }[]
  by_store: { store_id: string | null; store_name: string; orders: number; completed: number }[]
}

// ── Sales Manager analytics ───────────────────────────────────────
export interface SalesKpi { value: number; prev: number; delta_pct: number | null }
export interface SalesTrendPoint { date: string; orders: number; revenue: number; units: number }
export interface SalesGroupRow { orders: number; revenue: number }
export interface SalesOverview {
  range: { from: string; to: string; days: number; prev_from: string; prev_to: string }
  generated_at: string
  kpis: {
    revenue: SalesKpi; orders: SalesKpi; units: SalesKpi; avg_order_value: SalesKpi
    customers: SalesKpi; new_customers: SalesKpi; discount: SalesKpi; tax: SalesKpi
    shipping: SalesKpi; refunds: SalesKpi; net_sales: SalesKpi; gross_sales: SalesKpi
  }
  trend: SalesTrendPoint[]
  by_status: ({ status: string } & SalesGroupRow)[]
  by_source: ({ source: string } & SalesGroupRow)[]
  by_payment_method: ({ method: string } & SalesGroupRow)[]
  by_payment_status: ({ status: string } & SalesGroupRow)[]
  by_store: ({ store_id: string | null; store_name: string } & SalesGroupRow)[]
  top_customers: { customer_id: string; name: string; email?: string | null; orders: number; spent: number }[]
  top_products: { product_id: string; name: string; qty: number; revenue: number }[]
  by_category: { category: string; qty: number; revenue: number }[]
  hourly: { hour: number; orders: number; revenue: number }[]
  by_dow: { dow: number; label: string; orders: number; revenue: number }[]
  coupons: { coupon: string; orders: number; discount: number }[]
  discounts: { orders_with_discount: number; total_discount: number }
  fulfillment: {
    avg_ship_hours: number; avg_delivery_hours: number; delivered_orders: number
    cancelled_orders: number; returned_orders: number; total_orders: number; cancellation_rate: number
  }
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

export interface RestaurantOrderAdjustments {
  service_charge_pct?: number | null
  tip_amount?: number | null
  discount_amount?: number | null
  discount_pct?: number | null
}

export interface RestaurantKOTSettings {
  mode: 'sequential' | 'per_order'
  start_number: number
  end_number: number
  reset: 'daily' | 'continuous'
  next_number: number
  last_reset_date?: string | null
  next_preview: number
}

export interface RestaurantOrder {
  id: string
  vendor_id: string
  restaurant_id?: string | null
  table_id?: string | null
  table_label?: string | null
  status: string
  covers: number
  server_name?: string | null
  items: RestaurantOrderItem[]
  notes?: string | null
  adjustments: RestaurantOrderAdjustments
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
  label?: string
}

export interface StoreRecord {
  id: string
  vendor_id: string
  /** NULL/undefined = this is a Business Unit (root); set = this is a Branch under that BU. */
  parent_id?: string | null
  /** 'business_unit' (root) or 'branch' (child of a business unit). */
  unit_type?: 'business_unit' | 'branch'
  name: string
  code?: string
  description?: string
  phone?: string
  email?: string
  address: StoreAddress
  manager_id?: string
  is_active: boolean
  is_open: boolean
  is_default: boolean
  settings: Record<string, unknown>
  inventory_count?: number
  staff_count?: number
  /** Number of branches under this business unit (only set on business-unit rows). */
  branch_count?: number
  created_at?: string
  updated_at?: string
  staff?: StoreStaffMember[]
}

// ── Sales & Distribution ──────────────────────────────────────────
// Sales Organization is not a separate resource — it reuses StoreRecord
// (a business unit, i.e. unit_type === 'business_unit').

export interface DivisionRecord {
  id: string
  vendor_id: string
  code: string
  name: string
  description?: string | null
  is_active: boolean
  is_default: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type DistributionChannelType = 'retail' | 'wholesale' | 'online' | 'pos' | 'b2b' | 'marketplace' | 'other'

export interface DistributionChannelRecord {
  id: string
  vendor_id: string
  code: string
  name: string
  channel_type: DistributionChannelType
  description?: string | null
  is_active: boolean
  is_default: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type DeliveryChannelMode = 'own_fleet' | 'courier' | 'pickup' | 'third_party' | 'postal' | 'other'

export interface DeliveryChannelRecord {
  id: string
  vendor_id: string
  code: string
  name: string
  mode: DeliveryChannelMode
  description?: string | null
  lead_time_days?: number | null
  base_charge: number
  settings: Record<string, unknown>
  is_active: boolean
  is_default: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface SalesAreaRecord {
  id: string
  vendor_id: string
  /** Effective store scope (business unit or branch). Same as persisted business_unit_id column. */
  store_id?: string
  unit_type?: 'business_unit' | 'branch'
  business_unit_id: string
  business_unit_name?: string | null
  business_unit_code?: string | null
  branch_id?: string | null
  branch_name?: string | null
  branch_code?: string | null
  distribution_channel_id: string
  distribution_channel_name?: string | null
  distribution_channel_code?: string | null
  division_id: string
  division_name?: string | null
  division_code?: string | null
  code?: string | null
  name?: string | null
  is_active: boolean
  is_default: boolean
  created_at?: string
  updated_at?: string
}

export interface MessageEmailRecipient {
  id: string
  email: string
  label?: string
}

export interface MessagePhoneRecipient {
  id: string
  phone: string
  label?: string
}

export type NotificationEventType =
  | 'new_orders'
  | 'order_status_updates'
  | 'customer_inquiries'
  | 'system_notifications'

export interface CustomerMessageTemplate {
  id: string
  name: string
  subject?: string
  message: string
  start_at: string
  end_at: string
  channels: Array<'email' | 'sms' | 'whatsapp'>
  enabled?: boolean
}

/** Scheduled message template — same shape for customer and vendor/team alerts. */
export type MessageTemplate = CustomerMessageTemplate

export interface EventRecipients {
  email_recipients: MessageEmailRecipient[]
  phone_recipients: MessagePhoneRecipient[]
  customer_templates?: MessageTemplate[]
  vendor_templates?: MessageTemplate[]
}

export interface CustomerChannelPrefs {
  email: boolean
  sms: boolean
  whatsapp: boolean
}

export type VendorChannelPrefs = CustomerChannelPrefs

export interface StoreMessageConfig {
  events: Record<NotificationEventType, EventRecipients>
  vendor_channels: VendorChannelPrefs
  customer_channels: CustomerChannelPrefs
}

export type DeliveryChannelStatus = {
  ready: boolean
  provider?: string | null
  missing: string[]
}

export type MessageDeliveryStatus = {
  email: DeliveryChannelStatus
  sms: DeliveryChannelStatus
  whatsapp: DeliveryChannelStatus
  integrations_url: string
}

export interface StoreInventoryItem {
  id: string
  product_id: string
  variant_id?: string
  storage_location_id?: string | null
  storage_location_name?: string | null
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

const SKIP_AUTO_REFRESH = { headers: { 'X-Skip-Auto-Refresh': 'true' } }

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

  // ── Storage Locations ───────────────────────────────────────
  listStorageLocations: async (params: { store_id?: string; plant_id?: string; tree?: boolean; is_active?: boolean }): Promise<{ locations: import('@/types').StorageLocation[] }> => {
    const response = await apiClient.get('/vendors/me/storage-locations', { params })
    return response.data
  },

  createStorageLocation: async (data: Record<string, unknown>): Promise<import('@/types').StorageLocation> => {
    const response = await apiClient.post('/vendors/me/storage-locations', data)
    return response.data
  },

  updateStorageLocation: async (id: string, data: Record<string, unknown>): Promise<import('@/types').StorageLocation> => {
    const response = await apiClient.put(`/vendors/me/storage-locations/${id}`, data)
    return response.data
  },

  deleteStorageLocation: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/storage-locations/${id}`)
  },

  // ── Plants ────────────────────────────────────────────────────
  listPlants: async (params?: { store_id?: string; is_active?: boolean }): Promise<{ plants: import('@/types').Plant[] }> => {
    const response = await apiClient.get('/vendors/me/plants', { params: params ?? {} })
    return response.data
  },

  createPlant: async (data: Record<string, unknown>): Promise<import('@/types').Plant> => {
    const response = await apiClient.post('/vendors/me/plants', data)
    return response.data
  },

  updatePlant: async (id: string, data: Record<string, unknown>): Promise<import('@/types').Plant> => {
    const response = await apiClient.put(`/vendors/me/plants/${id}`, data)
    return response.data
  },

  deletePlant: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/plants/${id}`)
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

  getServiceBOM: async (serviceId: string): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.get(`/vendors/me/services/${serviceId}/bom`)
    return response.data
  },

  putServiceBOM: async (serviceId: string, items: Record<string, unknown>[]): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.put(`/vendors/me/services/${serviceId}/bom`, items)
    return response.data
  },

  getServiceResources: async (serviceId: string): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.get(`/vendors/me/services/${serviceId}/resources`)
    return response.data
  },

  putServiceResources: async (serviceId: string, items: Record<string, unknown>[]): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.put(`/vendors/me/services/${serviceId}/resources`, items)
    return response.data
  },

  getServiceCostSummary: async (serviceId: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.get(`/vendors/me/services/${serviceId}/cost-summary`)
    return response.data
  },

  reserveServiceMaterials: async (serviceId: string, data: { order_id: string; order_type?: string; qty?: number }): Promise<Record<string, unknown>[]> => {
    const response = await apiClient.post(`/vendors/me/services/${serviceId}/reserve-materials`, data)
    return response.data
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

  /** Category image — returns path to send as ``image_url`` on create/update. */
  uploadCategoryImage: async (file: File): Promise<{ image_url: string; url?: string }> => {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post('/uploads/vendor/category-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const data = response.data as { image_url?: string; url?: string }
    return { image_url: data.image_url || data.url || '', url: data.url || data.image_url }
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
    const response = await apiClient.post('/vendors/me/customers', data, { timeout: 30_000 })
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
    const phoneKey = (p: string) => {
      const d = p.replace(/\D/g, '')
      return d.length >= 10 ? d.slice(-10) : d
    }
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
      const needle = phoneKey(params.phone.trim())
      searches.push(
        apiClient.get('/vendors/me/customers', { params: { search: params.phone.trim(), size: 10 } })
          .then(r => add((r.data?.items || []).filter((c: Customer) => c.phone && phoneKey(c.phone) === needle)))
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

  deleteCustomer: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/customers/${id}`)
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
    otp: string | null
    sms_sent?: boolean
    email_sent?: boolean
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
  posGetCurrentSession: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/pos/sessions/current', { params })
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

  // ── Restaurant Outlets (CRUD — tagged under a Store/BU) ────────
  listRestaurants: async (params?: { store_id?: string }): Promise<{ items: RestaurantOutlet[] }> => {
    const response = await apiClient.get('/vendors/me/restaurants', { params })
    return response.data
  },
  createRestaurant: async (body: {
    store_id: string; name: string; code?: string; cuisine?: string;
    phone?: string; email?: string; address?: Record<string, unknown>; settings?: Record<string, unknown>; is_active?: boolean;
  }): Promise<RestaurantOutlet> => {
    const response = await apiClient.post('/vendors/me/restaurants', body)
    return response.data
  },
  getRestaurant: async (id: string): Promise<RestaurantOutlet> => {
    const response = await apiClient.get(`/vendors/me/restaurants/${id}`)
    return response.data
  },
  updateRestaurant: async (id: string, body: Partial<{
    name: string; code: string; cuisine: string; phone: string; email: string;
    address: Record<string, unknown>; settings: Record<string, unknown>; is_active: boolean; is_default: boolean;
  }>): Promise<RestaurantOutlet> => {
    const response = await apiClient.patch(`/vendors/me/restaurants/${id}`, body)
    return response.data
  },
  deleteRestaurant: async (id: string) => {
    await apiClient.delete(`/vendors/me/restaurants/${id}`)
  },

  // ── Restaurant (floor / kitchen / POS table tagging) ───────────
  restaurantListZones: async (params?: { restaurant_id?: string }): Promise<{ items: Array<{ id: string; vendor_id: string; restaurant_id: string | null; name: string; floor: string | null; sort_order: number }> }> => {
    const response = await apiClient.get('/vendors/me/restaurant/zones', { params })
    return response.data
  },
  restaurantCreateZone: async (body: { name: string; sort_order?: number; restaurant_id?: string; floor?: string }) => {
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
  restaurantListTables: async (params?: { zone_id?: string; restaurant_id?: string }): Promise<{
    items: Array<{
      id: string
      restaurant_id?: string | null
      zone_id?: string | null
      zone_name?: string | null
      label: string
      capacity: number
      sort_order: number
      is_active: boolean
      status: string
      qr_token?: string | null
    }>
  }> => {
    const response = await apiClient.get('/vendors/me/restaurant/tables', { params })
    return response.data
  },
  restaurantCreateTable: async (body: { label: string; zone_id?: string | null; restaurant_id?: string; capacity?: number; sort_order?: number; is_active?: boolean }) => {
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
  restaurantListOrders: async (params?: { status?: string; restaurant_id?: string }) => {
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
  restaurantTransferOrder: async (orderId: string, tableId: string) => {
    const response = await apiClient.post(`/vendors/me/restaurant/orders/${orderId}/transfer`, { table_id: tableId })
    return response.data as RestaurantOrder
  },
  restaurantMergeOrders: async (sourceOrderId: string, targetOrderId: string) => {
    const response = await apiClient.post(`/vendors/me/restaurant/orders/${sourceOrderId}/merge`, { target_order_id: targetOrderId })
    return response.data as RestaurantOrder
  },
  restaurantSetOrderAdjustments: async (orderId: string, body: RestaurantOrderAdjustments) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/orders/${orderId}/adjustments`, body)
    return response.data as { id: string; adjustments: RestaurantOrderAdjustments }
  },

  // ── KOTs ──────────────────────────────────────────────────────────
  restaurantListKOTs: async (params?: { include_done?: boolean; restaurant_id?: string }) => {
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
  restaurantListReservations: async (params?: { date_from?: string; date_to?: string; status?: string; restaurant_id?: string }) => {
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
  restaurantUpdateReservationStatus: async (id: string, body: { status: string; table_id?: string }) => {
    const response = await apiClient.patch(`/vendors/me/restaurant/reservations/${id}/status`, body)
    return response.data as ReservationItem
  },

  restaurantGetMenuSettings: async (restaurantId?: string) => {
    const response = await apiClient.get('/vendors/me/restaurant/menu', {
      params: restaurantId ? { restaurant_id: restaurantId } : undefined,
    })
    return response.data as {
      mode: 'all_active' | 'curated'
      product_ids: string[]
      category_order: string[]
      scope: 'vendor' | 'outlet'
      items: Array<{ id: string; name: string; category?: string; price: number; status: string }>
    }
  },
  restaurantUpdateMenuSettings: async (
    body: { mode: 'all_active' | 'curated'; product_ids: string[]; category_order?: string[] },
    restaurantId?: string,
  ) => {
    const response = await apiClient.put('/vendors/me/restaurant/menu', body, {
      params: restaurantId ? { restaurant_id: restaurantId } : undefined,
    })
    return response.data as { mode: string; product_ids: string[]; category_order: string[]; scope: string }
  },

  // ── Named menus (multi-menu, tree categories, zone links) ────────
  restaurantListMenus: async (restaurantId?: string) => {
    const response = await apiClient.get('/vendors/me/restaurant/menus', {
      params: restaurantId ? { restaurant_id: restaurantId } : undefined,
    })
    return response.data as { items: RestaurantMenuOut[] }
  },
  restaurantGetMenu: async (menuId: string) => {
    const response = await apiClient.get(`/vendors/me/restaurant/menus/${menuId}`)
    return response.data as RestaurantMenuOut
  },
  restaurantCreateMenu: async (body: { restaurant_id: string; name: string; zone_ids?: string[] }) => {
    const response = await apiClient.post('/vendors/me/restaurant/menus', body)
    return response.data as RestaurantMenuOut
  },
  restaurantUpdateMenuDetails: async (menuId: string, body: { name?: string; is_active?: boolean; sort_order?: number }) => {
    const response = await apiClient.put(`/vendors/me/restaurant/menus/${menuId}`, body)
    return response.data as RestaurantMenuOut
  },
  restaurantDeleteMenu: async (menuId: string) => {
    await apiClient.delete(`/vendors/me/restaurant/menus/${menuId}`)
  },
  restaurantSyncMenuZones: async (menuId: string, zoneIds: string[]) => {
    const response = await apiClient.put(`/vendors/me/restaurant/menus/${menuId}/zones`, { zone_ids: zoneIds })
    return response.data as { items: RestaurantMenuZoneLinkOut[] }
  },
  restaurantCreateMenuCategory: async (menuId: string, body: { name: string; parent_id?: string | null }) => {
    const response = await apiClient.post(`/vendors/me/restaurant/menus/${menuId}/categories`, body)
    return response.data as RestaurantMenuCategoryOut
  },
  restaurantUpdateMenuCategory: async (
    menuId: string,
    categoryId: string,
    body: Partial<{
      name: string
      mode: 'all_active' | 'curated' | 'by_categories'
      product_ids: string[]
      service_ids: string[]
      vendor_category_ids: string[]
    }>,
  ) => {
    const response = await apiClient.put(`/vendors/me/restaurant/menus/${menuId}/categories/${categoryId}`, body)
    return response.data as RestaurantMenuCategoryOut
  },
  restaurantDeleteMenuCategory: async (menuId: string, categoryId: string) => {
    await apiClient.delete(`/vendors/me/restaurant/menus/${menuId}/categories/${categoryId}`)
  },
  restaurantMoveMenuCategory: async (menuId: string, categoryId: string, direction: 'up' | 'down') => {
    const response = await apiClient.post(`/vendors/me/restaurant/menus/${menuId}/categories/${categoryId}/move`, { direction })
    return response.data as RestaurantMenuOut
  },
  restaurantGetKOTSettings: async (restaurantId: string) => {
    const response = await apiClient.get('/vendors/me/restaurant/kot-settings', {
      params: { restaurant_id: restaurantId },
    })
    return response.data as RestaurantKOTSettings
  },
  restaurantUpdateKOTSettings: async (
    restaurantId: string,
    body: Partial<{
      mode: 'sequential' | 'per_order'
      start_number: number
      end_number: number
      reset: 'daily' | 'continuous'
      next_number: number
      reset_counter_now: boolean
    }>,
  ) => {
    const response = await apiClient.patch('/vendors/me/restaurant/kot-settings', body, {
      params: { restaurant_id: restaurantId },
    })
    return response.data as RestaurantKOTSettings
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
  // store_id scopes results to a business unit; omit/undefined = all units.
  getDashboardStats: async (storeId?: string) => {
    const response = await apiClient.get('/vendors/me/reports/dashboard', { params: { store_id: storeId || undefined } })
    return response.data
  },
  getSalesByDay: async (days?: number, storeId?: string) => {
    const response = await apiClient.get('/vendors/me/reports/sales-by-day', { params: { days, store_id: storeId || undefined } })
    return response.data
  },
  getTopProducts: async (limit?: number, storeId?: string) => {
    const response = await apiClient.get('/vendors/me/reports/top-products', { params: { limit, store_id: storeId || undefined } })
    return response.data
  },
  getTopCustomers: async (limit?: number, storeId?: string) => {
    const response = await apiClient.get('/vendors/me/reports/top-customers', { params: { limit, store_id: storeId || undefined } })
    return response.data
  },
  getOrdersByStatus: async (storeId?: string) => {
    const response = await apiClient.get('/vendors/me/reports/orders-by-status', { params: { store_id: storeId || undefined } })
    return response.data
  },
  getRevenueSummary: async (storeId?: string) => {
    const response = await apiClient.get('/vendors/me/reports/revenue-summary', { params: { store_id: storeId || undefined } })
    return response.data
  },

  // ── Sales Manager (date-range analytics) ──────────────────────
  getSalesOverview: async (params: { date_from?: string; date_to?: string; store_id?: string }) => {
    const response = await apiClient.get('/vendors/me/sales-reports/overview', {
      params: {
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
        store_id: params.store_id || undefined,
      },
    })
    return response.data as SalesOverview
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

  // ── Business Partners ─────────────────────────────────────────
  listBusinessPartners: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/business-partners', { params })
    return response.data as { items: import('@/types').BusinessPartner[]; total: number; page: number; size: number }
  },

  createBusinessPartner: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/business-partners', data)
    return response.data as import('@/types').BusinessPartner
  },

  getBusinessPartner: async (id: string) => {
    const response = await apiClient.get(`/vendors/me/business-partners/${id}`)
    return response.data as import('@/types').BusinessPartner
  },

  updateBusinessPartner: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/business-partners/${id}`, data)
    return response.data as import('@/types').BusinessPartner
  },

  addBusinessPartnerRole: async (id: string, role: string, attributes?: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/business-partners/${id}/roles`, { role, attributes })
    return response.data as import('@/types').BusinessPartner
  },

  removeBusinessPartnerRole: async (id: string, role: string) => {
    await apiClient.delete(`/vendors/me/business-partners/${id}/roles/${role}`)
  },

  checkBusinessPartnerDuplicate: async (params: { name: string; phone?: string; email?: string; gstin?: string }) => {
    const response = await apiClient.get('/vendors/me/business-partners/check-duplicate', { params })
    return response.data as import('@/types').BusinessPartner
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

  // ── Procurement: Info Records ─────────────────────────────────
  listInfoRecords: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/info-records', { params })
    return response.data
  },
  createInfoRecord: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/info-records', data)
    return response.data
  },
  updateInfoRecord: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/info-records/${id}`, data)
    return response.data
  },
  deleteInfoRecord: async (id: string) => {
    await apiClient.delete(`/vendors/me/procurement/info-records/${id}`)
  },

  // ── Procurement: Source List ──────────────────────────────────
  listSourceList: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/source-list', { params })
    return response.data
  },
  createSourceListEntry: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/source-list', data)
    return response.data
  },
  updateSourceListEntry: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/source-list/${id}`, data)
    return response.data
  },
  deleteSourceListEntry: async (id: string) => {
    await apiClient.delete(`/vendors/me/procurement/source-list/${id}`)
  },

  // ── Procurement: Purchase Requisitions ───────────────────────
  listRequisitions: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/requisitions', { params })
    return response.data
  },
  getRequisition: async (id: string) => {
    const response = await apiClient.get(`/vendors/me/procurement/requisitions/${id}`)
    return response.data
  },
  getProcurementProductContext: async (
    productId: string,
    params?: { variant_id?: string; store_id?: string; plant_id?: string },
  ) => {
    const response = await apiClient.get(
      `/vendors/me/procurement/requisitions/product-context/${productId}`,
      { params },
    )
    return response.data
  },
  createRequisition: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/requisitions', data)
    return response.data
  },
  updateRequisition: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/requisitions/${id}`, data)
    return response.data
  },
  submitRequisition: async (id: string) => {
    const response = await apiClient.post(`/vendors/me/procurement/requisitions/${id}/submit`)
    return response.data
  },
  approveRequisition: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/procurement/requisitions/${id}/approve`, data)
    return response.data
  },
  cancelRequisition: async (id: string, reason?: string) => {
    const response = await apiClient.post(`/vendors/me/procurement/requisitions/${id}/cancel`, { reason })
    return response.data
  },

  // ── Procurement: Vendor Invoices (AP) ────────────────────────
  listVendorInvoices: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/vendor-invoices', { params })
    return response.data
  },
  createVendorInvoice: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/vendor-invoices', data)
    return response.data
  },
  updateVendorInvoice: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/vendor-invoices/${id}`, data)
    return response.data
  },
  postVendorInvoice: async (id: string) => {
    const response = await apiClient.post(`/vendors/me/procurement/vendor-invoices/${id}/post`)
    return response.data
  },
  matchVendorInvoice: async (id: string, data?: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/procurement/vendor-invoices/${id}/match`, data)
    return response.data
  },
  cancelVendorInvoice: async (id: string) => {
    const response = await apiClient.post(`/vendors/me/procurement/vendor-invoices/${id}/cancel`)
    return response.data
  },

  // ── Procurement: Goods Batches ────────────────────────────────
  listGoodsBatches: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/goods-batches', { params })
    return response.data
  },
  createGoodsBatch: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/goods-batches', data)
    return response.data
  },
  updateGoodsBatch: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/goods-batches/${id}`, data)
    return response.data
  },

  // ── Procurement: Goods Movements ─────────────────────────────
  listGoodsMovements: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/goods-movements', { params })
    return response.data
  },
  createGoodsMovement: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/goods-movements', data)
    return response.data
  },

  // ── Procurement: Material Valuation ──────────────────────────
  listMaterialValuation: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/material-valuation', { params })
    return response.data
  },
  upsertMaterialValuation: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/material-valuation', data)
    return response.data
  },
  updateMaterialValuation: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/material-valuation/${id}`, data)
    return response.data
  },

  // ── Procurement: Service Entry Sheets ────────────────────────
  listServiceEntrySheets: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/procurement/service-entry-sheets', { params })
    return response.data
  },
  createServiceEntrySheet: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/vendors/me/procurement/service-entry-sheets', data)
    return response.data
  },
  updateServiceEntrySheet: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/vendors/me/procurement/service-entry-sheets/${id}`, data)
    return response.data
  },
  submitServiceEntrySheet: async (id: string) => {
    const response = await apiClient.post(`/vendors/me/procurement/service-entry-sheets/${id}/submit`)
    return response.data
  },
  approveServiceEntrySheet: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.post(`/vendors/me/procurement/service-entry-sheets/${id}/approve`, data)
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

  inventoryLowStock: async (params?: Record<string, unknown>) => {
    const response = await apiClient.get('/vendors/me/inventory/low-stock', { params })
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

  sendCustomerNotification: async (data: {
    customer_id: string
    title: string
    message: string
    include_reach_back?: boolean
    reference_id?: string
  }) => {
    const response = await apiClient.post('/vendors/me/notifications/customer', data)
    return response.data as { ok: boolean; notification_id: string }
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
  getProductBOM: async (productId: string): Promise<BOMItemRecord[]> => {
    const response = await apiClient.get(`/vendors/me/products/${productId}/bom`)
    return response.data
  },

  putProductBOM: async (productId: string, items: Array<{ component_id: string; qty_per_unit: number; notes?: string | null }>): Promise<BOMItemRecord[]> => {
    const response = await apiClient.put(`/vendors/me/products/${productId}/bom`, items)
    return response.data
  },

  calculateMRP: async (body: {
    items: Array<{ product_id: string; qty: number; name?: string }>
    order_type: string
    order_id: string
    store_id?: string | null
  }): Promise<MRPResultLine[]> => {
    const response = await apiClient.post('/vendors/me/mrp/calculate', body)
    return response.data
  },

  listReservations: async (params?: { order_type?: string; order_id?: string; status?: string; store_id?: string }): Promise<StockReservationRecord[]> => {
    const response = await apiClient.get('/vendors/me/stock-reservations', { params })
    return response.data
  },

  createReservations: async (data: {
    order_type: string
    order_id: string
    store_id?: string | null
    storage_location_id?: string | null
    items: Array<{ product_id: string; variant_id?: string; reserved_qty: number; notes?: string }>
  }): Promise<StockReservationRecord[]> => {
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

  // ── Production Routing: Work Centers & Operations ─────────────────────────
  listWorkCenters: async (params?: { is_active?: boolean; plant_id?: string }): Promise<{ items: WorkCenterRecord[]; total: number }> => {
    const response = await apiClient.get('/vendors/me/work-centers', { params })
    return response.data
  },

  createWorkCenter: async (data: Partial<WorkCenterRecord>): Promise<WorkCenterRecord> => {
    const response = await apiClient.post('/vendors/me/work-centers', data)
    return response.data
  },

  updateWorkCenter: async (id: string, data: Partial<WorkCenterRecord>): Promise<WorkCenterRecord> => {
    const response = await apiClient.put(`/vendors/me/work-centers/${id}`, data)
    return response.data
  },

  deleteWorkCenter: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/work-centers/${id}`)
  },

  listProductionOperations: async (orderId: string): Promise<{ items: ProductionOperationRecord[]; total: number }> => {
    const response = await apiClient.get(`/vendors/me/production-orders/${orderId}/operations`)
    return response.data
  },

  createProductionOperation: async (orderId: string, data: Partial<ProductionOperationRecord>): Promise<ProductionOperationRecord> => {
    const response = await apiClient.post(`/vendors/me/production-orders/${orderId}/operations`, data)
    return response.data
  },

  updateProductionOperation: async (orderId: string, opId: string, data: Partial<ProductionOperationRecord>): Promise<ProductionOperationRecord> => {
    const response = await apiClient.put(`/vendors/me/production-orders/${orderId}/operations/${opId}`, data)
    return response.data
  },

  deleteProductionOperation: async (orderId: string, opId: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/production-orders/${orderId}/operations/${opId}`)
  },

  reorderProductionOperations: async (orderId: string, ids: string[]): Promise<{ items: ProductionOperationRecord[] }> => {
    const response = await apiClient.put(`/vendors/me/production-orders/${orderId}/operations/reorder/apply`, { ids })
    return response.data
  },

  getProductionAnalytics: async (params?: { store_id?: string; date_from?: string; date_to?: string }): Promise<ProductionAnalytics> => {
    const response = await apiClient.get('/vendors/me/production/analytics', { params })
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
    const r = await apiClient.post('/vendors/me/hr/offer-templates', data, SKIP_AUTO_REFRESH)
    return r.data as import('../types').OfferLetterTemplate
  },
  hrUpdateOfferTemplate: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/hr/offer-templates/${id}`, data, SKIP_AUTO_REFRESH)
    return r.data as import('../types').OfferLetterTemplate
  },
  hrDeleteOfferTemplate: async (id: string) => {
    await apiClient.delete(`/vendors/me/hr/offer-templates/${id}`, SKIP_AUTO_REFRESH)
  },
  hrSetDefaultOfferTemplate: async (id: string) => {
    const r = await apiClient.post(`/vendors/me/hr/offer-templates/${id}/default`, undefined, SKIP_AUTO_REFRESH)
    return r.data as import('../types').OfferLetterTemplate
  },
  hrPreviewOfferTemplate: async (data: { body_html: string; layout?: string; sample?: Record<string, string> }): Promise<string> => {
    const r = await apiClient.post('/vendors/me/hr/offer-templates/preview', data, { responseType: 'text' })
    return r.data as string
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
  listBranches: async (businessUnitId: string, params?: Record<string, unknown>) => {
    const r = await apiClient.get(`/vendors/me/stores/${businessUnitId}/branches`, { params })
    return r.data as { branches: StoreRecord[]; total: number }
  },

  // ── Sales & Distribution: Divisions ────────────────────────────
  listDivisions: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/sales-config/divisions', { params })
    return r.data as { divisions: DivisionRecord[]; total: number }
  },
  createDivision: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/sales-config/divisions', data)
    return r.data as { division: DivisionRecord; message: string }
  },
  updateDivision: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/sales-config/divisions/${id}`, data)
    return r.data as { division: DivisionRecord; message: string }
  },
  deleteDivision: async (id: string) => {
    await apiClient.delete(`/vendors/me/sales-config/divisions/${id}`)
  },

  // ── Sales & Distribution: Distribution Channels ─────────────────
  listDistributionChannels: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/sales-config/distribution-channels', { params })
    return r.data as { distribution_channels: DistributionChannelRecord[]; total: number }
  },
  createDistributionChannel: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/sales-config/distribution-channels', data)
    return r.data as { distribution_channel: DistributionChannelRecord; message: string }
  },
  updateDistributionChannel: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/sales-config/distribution-channels/${id}`, data)
    return r.data as { distribution_channel: DistributionChannelRecord; message: string }
  },
  deleteDistributionChannel: async (id: string) => {
    await apiClient.delete(`/vendors/me/sales-config/distribution-channels/${id}`)
  },

  // ── Sales & Distribution: Delivery Channels ─────────────────────
  listDeliveryChannels: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/sales-config/delivery-channels', { params })
    return r.data as { delivery_channels: DeliveryChannelRecord[]; total: number }
  },
  createDeliveryChannel: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/sales-config/delivery-channels', data)
    return r.data as { delivery_channel: DeliveryChannelRecord; message: string }
  },
  updateDeliveryChannel: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/sales-config/delivery-channels/${id}`, data)
    return r.data as { delivery_channel: DeliveryChannelRecord; message: string }
  },
  deleteDeliveryChannel: async (id: string) => {
    await apiClient.delete(`/vendors/me/sales-config/delivery-channels/${id}`)
  },

  // ── Sales & Distribution: Sales Areas (BU x Channel x Division) ──
  listSalesAreas: async (params?: Record<string, unknown>) => {
    const r = await apiClient.get('/vendors/me/sales-config/sales-areas', { params })
    return r.data as { sales_areas: SalesAreaRecord[]; total: number }
  },
  createSalesArea: async (data: Record<string, unknown>) => {
    const r = await apiClient.post('/vendors/me/sales-config/sales-areas', data)
    return r.data as { sales_area: SalesAreaRecord; message: string }
  },
  updateSalesArea: async (id: string, data: Record<string, unknown>) => {
    const r = await apiClient.put(`/vendors/me/sales-config/sales-areas/${id}`, data)
    return r.data as { sales_area: SalesAreaRecord; message: string }
  },
  deleteSalesArea: async (id: string) => {
    await apiClient.delete(`/vendors/me/sales-config/sales-areas/${id}`)
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
  getStoreMessageConfig: async (storeId: string) => {
    const r = await apiClient.get(`/vendors/me/stores/${storeId}/message-config`)
    return r.data as { store_id: string; store_name: string; message_config: StoreMessageConfig }
  },
  getMessageDeliveryStatus: async () => {
    const r = await apiClient.get('/vendors/me/message-delivery-status')
    return r.data as MessageDeliveryStatus
  },
  updateStoreMessageConfig: async (storeId: string, data: StoreMessageConfig) => {
    const r = await apiClient.put(`/vendors/me/stores/${storeId}/message-config`, data)
    return r.data as { store: StoreRecord; message_config: StoreMessageConfig; message: string }
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

  // ── Schema catalog (Models explorer) ─────────────────────────
  listSchemaModels: async () => {
    const r = await apiClient.get('/vendors/me/schema/models')
    return r.data as {
      models: SchemaModelRecord[]
      model_count: number
      table_count: number
      column_count: number
      api_bound_columns: number
      user_mapped_columns: number
      mappings: SchemaFieldMappingRecord[]
      vendor_resolved?: boolean
    }
  },

  listSchemaFieldMappings: async () => {
    const r = await apiClient.get('/vendors/me/schema/mappings')
    return r.data as { items: SchemaFieldMappingRecord[]; total: number }
  },

  createSchemaFieldMapping: async (data: SchemaFieldMappingInput) => {
    const r = await apiClient.post('/vendors/me/schema/mappings', data)
    return r.data as SchemaFieldMappingRecord
  },

  updateSchemaFieldMapping: async (id: string, data: Partial<SchemaFieldMappingInput>) => {
    const r = await apiClient.patch(`/vendors/me/schema/mappings/${id}`, data)
    return r.data as SchemaFieldMappingRecord
  },

  deleteSchemaFieldMapping: async (id: string) => {
    await apiClient.delete(`/vendors/me/schema/mappings/${id}`)
  },

  listTableDataTables: async () => {
    const r = await apiClient.get('/vendors/me/schema/table-data/tables')
    return r.data as TableDataCatalogResponse
  },

  findTableDataValue: async (q: string) => {
    const r = await apiClient.get('/vendors/me/schema/table-data/find', { params: { q } })
    return r.data as TableDataFindResult
  },

  browseTableData: async (
    table: string,
    params?: { q?: string; page?: number; page_size?: number },
  ) => {
    const r = await apiClient.get(`/vendors/me/schema/table-data/${encodeURIComponent(table)}`, {
      params,
    })
    return r.data as TableDataRows
  },
}

export type SchemaApiBinding = {
  method: string
  path: string
  schema: string
  direction: 'read' | 'write'
}

export type SchemaModelRecord = {
  model: string
  table: string
  module: string
  domain: string
  column_count: number
  columns: SchemaColumnRecord[]
  api_exposed_columns?: number
}

export type SchemaFieldMappingRecord = {
  id: string
  vendor_id: string
  table_name: string
  column_name: string
  ui_label: string
  help_short?: string | null
  help_full?: string | null
  screens: string[]
  note?: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type SchemaFieldMappingInput = {
  table_name: string
  column_name: string
  ui_label: string
  help_short?: string
  help_full?: string
  screens?: string[]
  note?: string
}

export type SchemaColumnRecord = {
  name: string
  type: string
  nullable: boolean
  primary_key: boolean
  unique: boolean
  foreign_keys: string[]
  api_bindings?: SchemaApiBinding[]
  user_mapping?: SchemaFieldMappingRecord | null
  is_virtual?: boolean
  json_parent?: string | null
}

export type TableDataCatalogResponse = {
  models: SchemaModelRecord[]
  model_count: number
  table_count: number
  scope: 'vendor'
}

export type TableDataCellMatch = {
  table: string
  column: string
  value: string
  domain?: string
}

export type TableDataFindHit = {
  table: string
  domain?: string
  matched_columns: string[]
  row_count: number
  rows: Record<string, unknown>[]
  cell_matches?: TableDataCellMatch[]
}

export type TableDataFindResult = {
  query: string
  scope?: 'vendor' | 'platform'
  search_mode: 'uuid' | 'text'
  hits: TableDataFindHit[]
  matches: TableDataCellMatch[]
  match_count: number
  hit_count: number
  tables_scanned: number
}

export type TableDataRows = {
  table: string
  domain?: string
  scope?: 'vendor' | 'platform'
  columns: string[]
  page: number
  page_size: number
  total: number
  rows: Record<string, unknown>[]
}
