 // ── Plans ────────────────────────────────────────────────────────
export interface VendorPlanInfo {
  id: string
  name: string
  slug: string
  description?: string
  price_monthly: number
  price_yearly?: number
  currency: string
  max_products: number
  max_services: number
  max_team_members: number
  max_storage_mb: number
  features: Record<string, boolean>
  is_featured: boolean
}

// ── User & Auth ─────────────────────────────────────────────────
export interface VendorRoleInfo {
  vendor_id: string
  role: string
  role_id?: string | null
  role_name: string
  permissions: string[]
  is_active: boolean
}

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  is_superuser?: boolean
  is_email_verified?: boolean
  is_phone_verified?: boolean
  is_2fa_enabled?: boolean
  vendor_role?: VendorRoleInfo | null
  created_at: string
  updated_at: string
}

export interface Token {
  access_token: string
  refresh_token: string
  token_type: string
}

/** Response from POST /auth/vendor-handoff/redeem */
export interface VendorHandoffRedeem extends Token {
  vendor: Vendor
}

// ── Vendor Roles & Team ────────────────────────────────────────
export interface VendorRole {
  id: string
  vendor_id: string
  name: string
  slug: string
  description?: string
  permissions: string[]
  is_system: boolean
  is_active: boolean
  assigned_users?: number
  created_at: string
  updated_at?: string
}

export interface TeamMember {
  id: string
  vendor_id: string
  user_id: string
  role: string
  role_id?: string | null
  role_name: string
  store_id?: string | null
  /** Resolved business unit for store-locked surfaces (POS): explicit store_id, or default store for owners/admins. Only present on /team/me. */
  effective_store_id?: string | null
  permissions: string[]
  is_active: boolean
  invited_at?: string | null
  accepted_at?: string | null
  access_starts_at?: string | null
  access_ends_at?: string | null
  access_end_source?: 'manual' | 'hr_lwd' | null
  access_sync_note?: string | null
  created_at: string
  user?: {
    id: string
    email: string
    full_name: string
    phone?: string
    avatar_url?: string
    is_active: boolean
    is_email_verified?: boolean
    is_phone_verified?: boolean
  } | null
}

// ── Vendor ──────────────────────────────────────────────────────
export interface Vendor {
  id: string
  business_name: string
  display_name: string
  slug: string
  subdomain: string
  business_type: string
  offering_type: 'products' | 'services' | 'both'
  industry?: string
  description?: string
  primary_email: string
  primary_phone: string
  support_email?: string
  support_phone?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
  service_radius_km?: number
  gstin?: string
  pan_number?: string
  is_gst_registered?: boolean
  default_tax_rate?: number | null
  /** ISO-2 tax regime country; also mirrored in settings.tax_country_code */
  tax_country_code?: string
  logo_url?: string
  banner_url?: string
  business_hours?: Record<string, { open: string; close: string; closed?: boolean }>
  store_holidays?: Array<{ date: string; label?: string; closed?: boolean }>
  order_acceptance_enabled?: boolean
  order_acceptance_hours?: Record<string, { open: string; close: string; closed?: boolean }>
  social_links?: Record<string, string>
  settings?: Record<string, unknown>
  theme_config?: Record<string, unknown>
  // External domain & DNS configuration
  external_domain_enabled?: boolean
  external_domain_scope?: 'all' | 'per_unit'
  external_domain_dns_mode?: 'kit_assisted' | 'self_managed'
  external_domain_name?: string
  external_domain_registrar?: string
  external_domain_reg_email?: string
  external_domain_holder?: string
  external_domain_expiry?: string
  external_domain_access_status?: 'not_requested' | 'pending' | 'active' | 'revoked'
  external_domain_recovery_contact?: string
  external_domain_notes?: string
  status: string
  verification_status: string
  verified_at?: string
  rejection_reason?: string | null
  activated_at?: string
  created_at: string
  updated_at: string
}

// ── Vendor Verification Documents ───────────────────────────────
export type VendorDocumentType =
  | 'business_registration'
  | 'tax_id'
  | 'id_proof'
  | 'address_proof'
  | 'bank_proof'

export type VendorDocumentStatus = 'pending' | 'approved' | 'rejected'

export interface VendorDocument {
  id: string
  vendor_id: string
  document_type: VendorDocumentType
  file_url: string
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  status: VendorDocumentStatus
  rejection_reason?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string | null
}

// ── Product ─────────────────────────────────────────────────────
export interface Product {
  id: string
  vendor_id: string
  // Basic
  name: string
  slug: string
  material_code?: string
  description?: string
  short_description?: string
  brand?: string
  product_type: string
  category?: string
  subcategory?: string
  tags: string[]
  // Unit of Measure
  uom: string
  uom_quantity?: number
  // Pricing
  price: number
  compare_at_price?: number
  cost_price?: number
  /** Inventory valuation: moving_average (MAP) | standard_price */
  valuation_method?: 'moving_average' | 'standard_price'
  currency: string
  discount_percentage?: number
  discount_amount?: number
  discount_start_date?: string
  discount_end_date?: string
  offer_label?: string
  is_on_sale: boolean
  // Tax
  is_taxable: boolean
  tax_rate?: number
  hsn_code?: string
  gst_rate?: number
  // Inventory
  sku?: string
  barcode?: string
  track_inventory: boolean
  batch_managed?: boolean
  serial_managed?: boolean
  shelf_life_days?: number | null
  retest_days?: number | null
  qc_required_on_receipt?: boolean
  qc_required_on_production?: boolean
  quantity: number
  low_stock_threshold: number
  reorder_point?: number
  reorder_quantity?: number
  stock_status: string
  allow_backorders: boolean
  // Lifecycle
  expiration_date?: string
  manufacture_date?: string
  best_before_date?: string
  warranty_period_days?: number
  warranty_type?: string
  // Return
  return_policy?: string
  return_days?: number
  is_returnable: boolean
  return_conditions?: string
  refund_policy?: string
  // Shipping
  weight_kg?: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
  shipping_class?: string
  requires_shipping: boolean
  shipping_cost_type?: string
  shipping_cost?: number
  free_shipping_threshold?: number
  // Visibility
  status: string
  is_featured: boolean
  is_visible: boolean
  is_new_arrival: boolean
  is_best_seller: boolean
  store_scope?: 'all' | 'selected'
  store_ids?: string[]
  allow_quote_request: boolean
  quote_form_config: QuoteFormField[]
  // SEO
  meta_title?: string
  meta_description?: string
  meta_keywords: string[]
  og_image_url?: string
  canonical_url?: string
  // Advanced
  attributes: Record<string, unknown>
  specifications: Record<string, unknown>
  custom_fields: Record<string, unknown>
  related_product_ids: string[]
  upsell_product_ids: string[]
  cross_sell_product_ids: string[]
  addons?: import('@/lib/catalogAddons').CatalogAddon[]
  // Digital
  is_digital: boolean
  download_url?: string
  download_limit?: number
  download_expiry_days?: number
  // Subscription
  is_subscription: boolean
  subscription_interval?: string
  subscription_price?: number
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  // Audit
  created_by?: string
  updated_by?: string
  version_number: number
  view_count: number
  purchase_count: number
  // Relations
  images: ProductImage[]
  variants: ProductVariant[]
  created_at: string
  updated_at?: string
  published_at?: string
  deleted_at?: string | null
}

export type PriceRuleType = 'party' | 'location' | 'scheduled' | 'quantity' | 'channel'

export interface ProductPriceRule {
  id: string
  product_id: string
  variant_id?: string | null
  rule_type: PriceRuleType
  name: string
  customer_id?: string | null
  customer_group?: string | null
  state?: string | null
  city?: string | null
  pincode?: string | null
  region?: string | null
  country?: string | null
  start_date?: string | null
  end_date?: string | null
  min_quantity?: number | null
  max_quantity?: number | null
  channel?: string | null
  price?: number | null
  discount_percentage?: number | null
  discount_amount?: number | null
  priority: number
  is_active: boolean
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface ProductImage {
  id: string
  url: string
  alt_text?: string
  position: number
  is_primary: boolean
  media_type?: 'image' | 'video' | 'model3d'
}

export interface ProductVariant {
  id: string
  name: string
  sku?: string
  barcode?: string
  uom: string
  uom_quantity?: number
  price_type?: string
  price: number
  compare_at_price?: number
  cost_price?: number
  currency: string
  discount_percentage?: number
  discount_amount?: number
  offer_label?: string
  is_on_sale: boolean
  is_taxable: boolean
  tax_rate?: number
  hsn_code?: string
  gst_rate?: number
  quantity: number
  low_stock_threshold: number
  stock_status: string
  reorder_point?: number
  reorder_quantity?: number
  allow_backorders: boolean
  track_inventory: boolean
  max_quantity_per_order?: number
  min_quantity_per_order?: number
  weight_kg?: number
  expiration_date?: string
  manufacture_date?: string
  best_before_date?: string
  warranty_period_days?: number
  warranty_type?: string
  is_returnable?: boolean
  return_days?: number
  refund_policy?: string
  return_policy?: string
  return_conditions?: string
  color?: string
  attributes: Record<string, unknown>
  media?: { url: string; media_type: 'image' | 'video' | 'model3d'; is_primary: boolean; alt_text?: string; position: number }[]
  // Subscription (variant-level)
  subscription_interval?: string
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  subscription_schedule_modes?: string[]
  is_active: boolean
  created_at?: string
}

// ── Service Plan ─────────────────────────────────────────────────
export interface ServicePlan {
  id: string
  service_id: string
  name: string
  description?: string
  price?: number
  uom: string
  price_type: string
  subscription_interval?: string
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  subscription_schedule_modes: string[]
  duration_minutes?: number
  max_quantity_per_order?: number
  min_quantity_per_order?: number
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface ServiceMediaItem {
  id: string
  url: string
  media_type: 'image' | 'video' | 'model3d'
  is_primary: boolean
  alt_text?: string
  position: number
}

export interface QuoteFormField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'email' | 'phone' | 'select'
  required: boolean
  enabled: boolean
  placeholder?: string
  options?: string[]  // for select type
}

// ── Service ─────────────────────────────────────────────────────
export interface Service {
  id: string
  vendor_id: string
  // Basic
  name: string
  slug: string
  material_code?: string
  description?: string
  short_description?: string
  brand?: string
  service_type: string
  category?: string
  subcategory?: string
  tags: string[]
  // Pricing
  price_type: string
  price?: number
  price_min?: number
  price_max?: number
  currency: string
  discount_percentage?: number
  discount_amount?: number
  discount_start_date?: string
  discount_end_date?: string
  offer_label?: string
  // Tax
  is_taxable: boolean
  tax_rate?: number
  sac_code?: string
  gst_rate?: number
  // Configuration
  uom: string
  service_mode: string
  duration_minutes?: number
  buffer_minutes: number
  service_capacity: number
  // Subscription
  is_subscription: boolean
  subscription_interval?: string
  subscription_price?: number
  subscription_price_type: string
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  subscription_schedule_modes: string[]
  // Booking & Quotes
  requires_booking: boolean
  booking_label?: string
  subscription_label?: string
  quote_request_label?: string
  allow_quote_request: boolean
  quote_form_config: QuoteFormField[]
  max_bookings_per_slot: number
  advance_booking_days: number
  booking_lead_time_hours?: number
  cancellation_policy?: string
  cancellation_hours?: number
  rescheduling_policy?: string
  no_show_policy?: string
  // Lifecycle
  service_expiry_date?: string
  validity_period_days?: number
  renewal_required: boolean
  // Visibility
  status: string
  is_featured: boolean
  is_visible: boolean
  is_popular: boolean
  is_new_service: boolean
  store_scope?: 'all' | 'selected'
  store_ids?: string[]
  // Media
  image_url?: string
  gallery: string[]
  media: ServiceMediaItem[]
  /** Present when API includes business front aggregates */
  avg_rating?: number
  // SEO
  meta_title?: string
  meta_description?: string
  meta_keywords: string[]
  // Advanced
  service_packages: unknown[]
  addons: import('@/lib/catalogAddons').CatalogAddon[] | string[]
  prerequisites?: string
  whats_included: string[]
  whats_not_included: string[]
  service_areas: string[]
  // Audit
  created_by?: string
  updated_by?: string
  version_number: number
  change_history: any[]
  view_count: number
  booking_count: number
  // Relations
  availability: ServiceAvailability[]
  plans: ServicePlan[]
  created_at: string
  updated_at?: string
  published_at?: string
}

export interface ServiceAvailability {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

// ── Customer ────────────────────────────────────────────────────
export interface Customer {
  id: string
  vendor_id: string
  full_name: string
  email?: string
  phone?: string
  /** Pricing group — drives which "party" price rules (retail/wholesale/distributor/agent/…) apply at checkout & POS. */
  customer_group?: string
  /** Default sales area — new orders/invoices inherit this; dues fall back to it. */
  sales_area_id?: string | null
  gstin?: string
  pan_number?: string
  cin?: string
  company_name?: string
  wholesale_license_number?: string | null
  wholesale_license_expires?: string | null
  notes?: string
  billing_address?: {
    street?: string
    city?: string
    state?: string
    pincode?: string
  }
  opening_balance?: number
  is_active: boolean
  total_orders: number
  total_spent: number
  // Bank Details
  bank_name?: string | null
  account_number?: string | null
  account_holder_name?: string | null
  account_type?: string | null
  ifsc_code?: string | null
  created_at: string
  updated_at?: string
}

/** Returned by checkCustomerDuplicates when a phone/email already exists. */
export interface CustomerDuplicateMatch {
  id: string
  full_name: string
  phone?: string
  email?: string
  company_name?: string
  gstin?: string
  total_orders: number
  created_at: string
  /** true = belongs to this vendor's own customer list */
  is_own_vendor: boolean
  /** id of the linked customer group (if any) */
  linked_customer_id?: string
}

// ── Order ───────────────────────────────────────────────────────
export interface OrderPricingCondition {
  id: string
  step_no: number
  /** header_discount | freight | surcharge | special | tax_override */
  condition_type: string
  description: string
  /** percent | fixed */
  calc_type: string
  value: number
  base_amount?: number | null
  condition_amount: number
  is_manual: boolean
  notes?: string | null
  created_at?: string
}

export interface OrderPartner {
  id: string
  /** buyer | ship_to | bill_to | payer | contact | other */
  role: string
  customer_id?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  company_name?: string | null
  gstin?: string | null
  address?: Record<string, unknown> | null
  notes?: string | null
}

export interface DeliveryLine {
  id: string
  delivery_id: string
  order_line_id?: string | null
  line_no: number
  product_id?: string | null
  variant_id?: string | null
  product_name?: string | null
  sku?: string | null
  unit?: string | null
  planned_qty: number
  picked_qty: number
  packed_qty: number
  issued_qty: number
  /** open | picking | picked | packed | issued */
  status: string
  batch_number?: string | null
  serial_number?: string | null
  notes?: string | null
}

export interface OrderDelivery {
  id: string
  delivery_number: string
  order_id: string
  /** standard | returns */
  delivery_type: string
  /** draft | picking | packed | goods_issued | cancelled */
  status: string
  planned_gi_date?: string | null
  actual_gi_date?: string | null
  carrier?: string | null
  tracking_number?: string | null
  shipping_address?: Record<string, unknown> | null
  notes?: string | null
  created_at: string
  updated_at: string
  lines: DeliveryLine[]
}

export interface OrderLineSchedule {
  id: string
  schedule_no: number
  requested_date?: string | null
  confirmed_date?: string | null
  requested_qty: number
  confirmed_qty: number
  shipped_qty: number
  /** open | committed | partial | shipped | closed | cancelled */
  status: string
  /** in_stock | purchase_order | lead_time | manual | none */
  commitment_source: string
  notes?: string | null
}

export interface OrderLine {
  id: string
  line_no: number
  parent_line_id?: string | null
  product_id?: string | null
  variant_id?: string | null
  service_id?: string | null
  item_type: 'product' | 'service'
  item_name: string
  item_sku?: string | null
  item_image_url?: string | null
  /** standard | free_of_charge | return | text_line */
  line_type: string
  ordered_qty: number
  committed_qty: number
  shipped_qty: number
  invoiced_qty: number
  returned_qty: number
  rejected_qty: number
  unit_of_measure: string
  list_price: number
  net_price: number
  discount_pct: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  line_total: number
  plant_id?: string | null
  storage_location_id?: string | null
  cost_center_id?: string | null
  profit_center_id?: string | null
  batch_number?: string | null
  serial_numbers?: string[]
  rejection_reason?: string | null
  line_notes?: string | null
  price_rule_id?: string | null
  price_rule_type?: string | null
  /** Delivery schedule commitments (Phase-3). */
  schedules?: OrderLineSchedule[]
  created_at: string
  updated_at: string
}

export interface OrderItem {
  product_id: string
  variant_id?: string
  name: string
  qty: number
  price: number
  image_url?: string
  /** Present when this order line originated from a service booking. */
  booking_id?: string
  booking_number?: string
  booking_date?: string
}

export interface OrderAttachmentRef {
  url: string
  kind: 'image' | 'video'
}

export interface OrderStatusHistoryItem {
  id: string
  from_status?: string | null
  to_status: string
  changed_by?: string | null
  changed_by_role?: string | null
  notes?: string | null
  timestamp: string
}

export interface Order {
  id: string
  order_number: string
  vendor_id: string
  customer_id: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  items: OrderItem[]
  item_count: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_amount: number
  total: number
  status: string
  payment_status: string
  /** online | pos | booking | quote */
  source?: string
  store_id?: string
  store_name?: string
  store_code?: string
  sales_area_id?: string
  delivery_channel_id?: string
  pos_transaction_id?: string
  // Phase-1 header enrichment
  /** standard | quotation | return | credit_note | debit_note | sample */
  order_type?: string
  payment_terms_code?: string
  payment_terms_days?: number
  shipping_terms?: string
  order_reason?: string
  requested_delivery_date?: string
  pricing_date?: string
  currency?: string
  exchange_rate?: number
  fulfillment_block?: string
  billing_block?: string
  /** ok | watch | blocked | not_checked */
  credit_status?: string
  /** open | partial | complete | not_relevant */
  fulfillment_status?: string
  /** open | partial | complete | not_relevant */
  billing_status?: string
  placed_by_name?: string
  placed_by_type?: 'customer' | 'staff' | 'cashier'
  payment_method?: string
  payment_reference?: string
  payment_proof?: {
    utr?: string
    screenshot_url?: string
    status?: string
    submitted_at?: string
    reviewed_at?: string
    review_notes?: string
  } | null
  shipping_address?: Record<string, string>
  tracking_number?: string
  tracking_url?: string
  delivery_staff_id?: string
  delivery_staff_name?: string
  delivery_staff_email?: string
  delivery_staff_phone?: string
  delivery_assigned_at?: string
  delivery_status?: string
  notes?: string
  cancel_reason?: string
  cancel_attachments?: OrderAttachmentRef[]
  return_type?: string
  return_reason?: string
  return_status?: string
  return_notes?: string
  return_attachments?: OrderAttachmentRef[]
  refund_amount?: number
  return_tracking_number?: string
  return_tracking_url?: string
  return_requested_at?: string
  return_resolved_at?: string
  created_at: string
  updated_at: string
  confirmed_at?: string
  shipped_at?: string
  delivered_at?: string
  status_history?: OrderStatusHistoryItem[]
  /** Normalized line items (Phase-2). Present on detail view; may be absent on list view. */
  order_lines?: OrderLine[]
  /** Outbound delivery documents (Phase-4). */
  deliveries?: OrderDelivery[]
  /** Partner functions (Phase-6). */
  partners?: OrderPartner[]
  /** Header-level pricing conditions (Phase-7). */
  pricing_conditions?: OrderPricingCondition[]
}

export interface OrderStats {
  total_orders: number
  pending_orders: number
  completed_orders: number
  total_revenue: number
  today_orders: number
  today_revenue: number
}

// ── Review ──────────────────────────────────────────────────────
export interface Review {
  id: string
  vendor_id: string
  customer_id: string
  customer_name?: string
  review_type: 'product' | 'service'
  product_id?: string
  service_id?: string
  order_id?: string
  rating: number
  title?: string
  comment?: string
  reply?: string
  replied_at?: string
  is_verified_purchase: boolean
  is_visible: boolean
  is_flagged: boolean
  created_at: string
  updated_at?: string
}

// ── Inventory ──────────────────────────────────────────────────
export interface InventoryMovement {
  id: string
  vendor_id: string
  product_id: string
  variant_id?: string | null
  store_id?: string | null
  storage_location_id?: string | null
  storage_location_name?: string | null
  movement_type: string
  quantity: number
  quantity_before: number
  quantity_after: number
  reason?: string
  reference_type?: string
  reference_id?: string | null
  performed_by?: string | null
  created_at: string
}

export interface StockSummaryItem {
  product_id: string
  product_name: string
  sku?: string
  current_stock: number
  low_stock_threshold: number
  is_low_stock: boolean
}

// ── Category ────────────────────────────────────────────────────
export interface CustomField {
  name: string
  type: string
  options?: string[]
  required?: boolean
}

export interface VendorCategory {
  id: string
  vendor_id: string
  parent_id?: string | null
  name: string
  slug: string
  description?: string
  image_url?: string | null
  applies_to: 'product' | 'service' | 'rental' | 'both'
  is_active: boolean
  sort_order: number
  custom_fields: CustomField[]
  children: VendorCategory[]
  created_at?: string
  updated_at?: string
}

// ── Product Group ───────────────────────────────────────────────
export type ProductGroupType = 'general' | 'pricing' | 'bundle' | 'reporting'

export interface ProductGroupItem {
  id: string
  group_id: string
  item_type: 'product' | 'service'
  item_id: string | null
  name: string
  sku?: string | null
  price: number
  image_url?: string | null
  status?: string | null
  quantity: number
  sort_order: number
  created_at?: string
}

export interface ProductGroupAncestor {
  id: string
  name: string
  slug: string
}

export interface ProductGroupEffectivePricing {
  source_id: string | null
  source_name: string | null
  discount_type: 'none' | 'percentage' | 'fixed'
  discount_value: number
  inherited: boolean
}

export interface ProductGroup {
  id: string
  vendor_id: string
  // ── Hierarchy ────────────────────────────────────────────────
  parent_id?: string | null
  code?: string | null
  level: number
  path: string
  // ── Basic info ───────────────────────────────────────────────
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  group_types: ProductGroupType[]
  is_active: boolean
  sort_order: number
  // ── Pricing ──────────────────────────────────────────────────
  discount_type: 'none' | 'percentage' | 'fixed'
  discount_value: number
  bundle_price?: number | null
  bundle_discount_type: 'none' | 'percentage' | 'fixed'
  bundle_discount_value: number
  // ── Relations (returned on detail endpoint) ───────────────────
  item_count: number
  items?: ProductGroupItem[]
  children?: ProductGroup[]
  ancestors?: ProductGroupAncestor[]
  effective_pricing?: ProductGroupEffectivePricing
  created_at?: string
  updated_at?: string
}

export interface ProductGroupFlatOption {
  id: string
  name: string
  code?: string | null
  level: number
  label: string
}

// ── Storage Location ────────────────────────────────────────────
export interface StorageLocation {
  id: string
  vendor_id: string
  store_id: string
  plant_id?: string | null
  parent_id?: string | null
  name: string
  code?: string | null
  description?: string | null
  is_active: boolean
  sort_order: number
  /** unrestricted | quarantine | rejected | returns */
  stock_type?: string
  custom_fields: CustomField[]
  children: StorageLocation[]
  created_at?: string
  updated_at?: string
}

// ── Plant ────────────────────────────────────────────────────────
export interface Plant {
  id: string
  vendor_id: string
  store_id: string
  name: string
  code?: string | null
  description?: string | null
  address: Record<string, string>
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

// ── Business Partner ────────────────────────────────────────────
export interface BusinessPartnerRole {
  id: string
  role: string
  customer_id?: string | null
  supplier_id?: string | null
  attributes?: Record<string, unknown>
  is_active: boolean
  created_at?: string
}

export interface BusinessPartner {
  id: string
  vendor_id: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  gstin?: string | null
  pan_number?: string | null
  cin?: string | null
  company_name?: string | null
  address?: Record<string, string> | null
  bank_name?: string | null
  account_number?: string | null
  account_holder_name?: string | null
  account_type?: string | null
  ifsc_code?: string | null
  opening_balance?: number
  notes?: string | null
  avatar_url?: string | null
  is_active: boolean
  party_status: string
  payment_blocked: boolean
  hold_until?: string | null
  roles: BusinessPartnerRole[]
  created_at?: string
  updated_at?: string
}

// ── Supplier ────────────────────────────────────────────────────
export type PartyType = 'customer' | 'supplier' | 'employee' | 'partner' | 'contractor'

export interface Supplier {
  id: string
  vendor_id: string
  name: string
  party_type: 'supplier' | 'employee' | 'partner' | 'contractor'
  contact_name?: string
  email?: string
  phone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  notes?: string
  gstin?: string
  pan_number?: string
  opening_balance?: number
  is_active: boolean
  // Bank Details
  bank_name?: string | null
  account_number?: string | null
  account_holder_name?: string | null
  account_type?: string | null
  ifsc_code?: string | null
  created_at: string
  updated_at?: string
}

// ── Purchase Order ──────────────────────────────────────────────
export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  variant_id?: string | null
  product_name?: string
  product_sku?: string
  variant_name?: string
  variant_sku?: string
  variant_barcode?: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  total_cost: number
  plant_id?: string | null
  storage_location_id?: string | null
  notes?: string
}

export interface PurchaseOrderReceipt {
  id: string
  purchase_order_id: string
  received_by?: string | null
  received_at?: string
  notes?: string
  items: { item_id: string; product_id: string; variant_id?: string | null; quantity_received: number }[]
}

export interface PurchaseOrder {
  id: string
  vendor_id: string
  supplier_id: string
  supplier_name?: string
  po_number: string
  status: string
  order_date?: string
  expected_delivery_date?: string
  notes?: string
  subtotal: number
  tax_amount: number
  total: number
  created_by?: string
  created_at: string
  updated_at?: string
  received_at?: string
  closed_at?: string
  items: PurchaseOrderItem[]
  receipts: PurchaseOrderReceipt[]
}

// ── Procurement: Sourcing ────────────────────────────────────────
export interface PurchasingInfoRecord {
  id: string
  vendor_id: string
  supplier_id: string
  product_id: string
  variant_id?: string | null
  plant_id?: string | null
  currency: string
  price: number
  price_unit: number
  min_order_qty: number
  max_order_qty?: number | null
  order_unit: string
  lead_time_days: number
  planned_delivery_days: number
  valid_from?: string | null
  valid_to?: string | null
  is_active: boolean
  notes?: string | null
  // enriched
  supplier_name?: string
  supplier_contact_name?: string | null
  product_name?: string
  product_sku?: string | null
  product_description?: string | null
  created_at?: string
  updated_at?: string
}

export interface SourceList {
  id: string
  vendor_id: string
  product_id: string
  variant_id?: string | null
  supplier_id: string
  plant_id?: string | null
  valid_from?: string | null
  valid_to?: string | null
  is_fixed: boolean
  is_blocked: boolean
  priority: number
  notes?: string | null
  supplier_name?: string
  supplier_contact_name?: string | null
  product_name?: string
  product_sku?: string | null
  product_description?: string | null
  created_at?: string
  updated_at?: string
}

// ── Procurement: Purchase Requisition ───────────────────────────
export interface PurchaseRequisitionItem {
  id: string
  requisition_id: string
  line_number?: number
  item_type?: 'product' | 'service' | 'asset' | 'consumption' | 'other'
  product_id?: string | null
  service_id?: string | null
  variant_id?: string | null
  description?: string
  asset_category_id?: string | null
  quantity: number
  uom?: string
  unit_of_measure?: string
  estimated_price?: number | null
  plant_id?: string | null
  plant_name?: string | null
  storage_location_id?: string | null
  storage_location_name?: string | null
  needed_by_date?: string | null
  account_assignment?: string | null
  notes?: string | null
  converted_qty?: number
  quantity_ordered?: number
  purchase_order_id?: string | null
  is_converted?: boolean
  suggested_supplier_id?: string | null
  suggested_supplier_name?: string | null
  product_name?: string
  product_sku?: string
  service_name?: string
  variant_name?: string
}

export interface PurchaseRequisitionApproval {
  id: string
  requisition_id: string
  approver_id?: string | null
  approver_name?: string | null
  level: number
  status: 'pending' | 'approved' | 'rejected' | 'skipped'
  comments?: string | null
  remarks?: string | null
  actioned_at?: string | null
  decided_at?: string | null
  created_at?: string | null
}

export interface PurchaseRequisition {
  id: string
  vendor_id: string
  pr_number: string
  status: 'draft' | 'submitted' | 'open' | 'approved' | 'rejected' | 'partially_converted' | 'converted' | 'cancelled'
  requisition_type?: 'product' | 'service' | 'asset' | 'consumption' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  requested_by?: string | null
  requested_by_name?: string | null
  department?: string | null
  store_id?: string | null
  store_name?: string | null
  procurement_source?: 'supplier' | 'internal'
  bu_scope?: 'within_bu' | 'cross_bu' | null
  from_store_id?: string | null
  from_store_name?: string | null
  to_store_id?: string | null
  to_store_name?: string | null
  header_supplier_id?: string | null
  header_supplier_name?: string | null
  title?: string | null
  notes?: string | null
  approver_message?: string | null
  required_date?: string | null
  submitted_at?: string | null
  approved_at?: string | null
  items: PurchaseRequisitionItem[]
  approvals: PurchaseRequisitionApproval[]
  created_at: string
  updated_at?: string
}

// ── Procurement: Vendor Invoice (AP) ────────────────────────────
export interface VendorInvoiceItem {
  id: string
  invoice_id: string
  line_number: number
  po_item_id?: string | null
  product_id?: string | null
  description: string
  invoiced_qty: number
  uom: string
  unit_price: number
  discount_pct: number
  hsn_code?: string | null
  cgst_rate: number
  sgst_rate: number
  igst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total: number
  match_status: string
  product_name?: string
}

export interface VendorInvoice {
  id: string
  vendor_id: string
  supplier_id: string
  purchase_order_id?: string | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  currency: string
  exchange_rate: number
  status: 'draft' | 'posted' | 'matched' | 'partial_match' | 'blocked' | 'paid' | 'cancelled'
  match_status: 'unmatched' | 'matched' | 'partial' | 'blocked_qty' | 'blocked_price'
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_tax: number
  total: number
  amount_paid: number
  payment_reference?: string | null
  notes?: string | null
  posted_at?: string | null
  paid_at?: string | null
  supplier_name?: string
  po_number?: string | null
  items: VendorInvoiceItem[]
  created_at: string
  updated_at?: string
}

// ── Procurement: Goods Management ───────────────────────────────
export interface GoodsBatch {
  id: string
  vendor_id: string
  product_id: string
  variant_id?: string | null
  plant_id?: string | null
  storage_location_id?: string | null
  purchase_order_id?: string | null
  batch_number: string
  serial_number?: string | null
  expiry_date?: string | null
  manufacture_date?: string | null
  quantity_received: number
  quantity_available: number
  quantity_reserved: number
  uom: string
  unit_cost?: number | null
  quality_status: 'unrestricted' | 'quality_inspection' | 'blocked'
  source_type: string
  notes?: string | null
  product_name?: string
  variant_name?: string
  created_at?: string
  updated_at?: string
}

export interface GoodsMovementLine {
  id?: string
  product_id: string
  variant_id?: string | null
  batch_id?: string | null
  quantity: number
  uom: string
  unit_cost?: number | null
  from_plant_id?: string | null
  from_storage_location_id?: string | null
  to_plant_id?: string | null
  to_storage_location_id?: string | null
  product_name?: string
}

export interface GoodsMovementDocument {
  id: string
  vendor_id: string
  document_number: string
  movement_type: string
  movement_type_label?: string
  reference_type?: string | null
  reference_id?: string | null
  posting_date: string
  document_date?: string | null
  plant_id?: string | null
  plant_name?: string | null
  storage_location_id?: string | null
  from_storage_location_id?: string | null
  to_storage_location_id?: string | null
  purchase_order_id?: string | null
  notes?: string | null
  performed_by?: string | null
  performed_by_name?: string | null
  created_by_name?: string | null
  lines: GoodsMovementLine[]
  created_at?: string
}

// ── Procurement: Material Valuation ─────────────────────────────
export interface MaterialValuation {
  id: string
  vendor_id: string
  product_id: string
  variant_id?: string | null
  plant_id?: string | null
  valuation_method: 'moving_average' | 'standard_price'
  total_stock: number
  total_value: number
  moving_avg_price: number
  standard_price?: number | null
  currency: string
  last_updated?: string | null
  product_name?: string
  created_at?: string
  updated_at?: string
}

// ── Procurement: Service Entry Sheet ────────────────────────────
export interface ServiceEntrySheet {
  id: string
  vendor_id: string
  supplier_id: string
  purchase_order_id?: string | null
  ses_number: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'invoiced'
  service_period_from?: string | null
  service_period_to?: string | null
  description?: string | null
  total_amount: number
  currency: string
  submitted_by?: string | null
  accepted_by?: string | null
  submitted_at?: string | null
  accepted_at?: string | null
  notes?: string | null
  supplier_name?: string
  po_number?: string | null
  created_at?: string
  updated_at?: string
}

// ── Procurement: Subcontracting Order ───────────────────────────
export interface SubcontractingComponent {
  product_id?: string
  variant_id?: string | null
  qty_required: number
  qty_issued?: number
  uom?: string
  batch_number?: string | null
  product_name?: string
}

export interface SubcontractingOrder {
  id: string
  vendor_id: string
  purchase_order_id: string
  supplier_id: string
  plant_id?: string | null
  ref: string
  status: 'open' | 'components_issued' | 'in_progress' | 'received' | 'closed' | 'cancelled'
  components: SubcontractingComponent[]
  finished_product_id?: string | null
  finished_variant_id?: string | null
  qty_expected: number
  qty_received: number
  notes?: string | null
  supplier_name?: string
  po_number?: string
  created_at?: string
  updated_at?: string
}

// ── Procurement: Consignment Stock ──────────────────────────────
export interface ConsignmentStock {
  id: string
  vendor_id: string
  supplier_id: string
  product_id: string
  variant_id?: string | null
  plant_id?: string | null
  storage_location_id?: string | null
  purchase_order_id?: string | null
  po_number?: string | null
  quantity_available: number
  quantity_withdrawn: number
  unit_price: number
  currency: string
  updated_at?: string | null
  supplier_name?: string
  product_name?: string
}

// ── Invoice Template ────────────────────────────────────────────
export interface InvoiceTemplateSections {
  show_logo: boolean
  show_header: boolean
  show_customer_details: boolean
  show_customer_gstin: boolean
  show_shipping_address: boolean
  show_bank_details: boolean
  show_signature: boolean
  show_tax_breakdown: boolean
  show_notes: boolean
  show_terms: boolean
}

export interface InvoiceTemplateBankDetails {
  account_name?: string
  account_number?: string
  ifsc?: string
  bank_name?: string
  upi_id?: string
}

export interface InvoiceTemplate {
  id: string
  vendor_id: string
  name: string
  is_default: boolean
  sections: InvoiceTemplateSections
  bank_details: InvoiceTemplateBankDetails
  signature_url?: string | null
  header_text?: string | null
  footer_text?: string | null
  terms_text?: string | null
  created_at: string
  updated_at?: string | null
}

// ── Merchandising ────────────────────────────────────────────────
export type RelationType = 'cross_sell' | 'upsell'
export type TriggerStage = 'PDP' | 'CART' | 'CHECKOUT'

export interface BundleItem {
  id: string
  bundle_id: string
  product_id: string
  product_name?: string
  product_sku?: string
  quantity: number
  sort_order: number
}

export interface Bundle {
  id: string
  vendor_id: string
  name: string
  slug: string
  description?: string
  discount_type: 'none' | 'percentage' | 'fixed'
  discount_value: number
  is_active: boolean
  items: BundleItem[]
  created_at?: string
  updated_at?: string
}

export type TargetType = 'product' | 'category'

export interface UpsellMapping {
  id: string
  vendor_id: string
  source_product_id: string
  target_type: TargetType
  target_product_id?: string
  target_product_name?: string
  target_product_sku?: string
  target_category?: string
  relation_type: RelationType
  bundle_id?: string
  bundle_name?: string
  trigger_stage: TriggerStage
  priority: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface ProductMerchandising {
  cross_sell: UpsellMapping[]
  upsell: UpsellMapping[]
}

// ── HR & Staff Management ────────────────────────────────────────

export interface HRDepartment {
  id: string
  vendor_id: string
  name: string
  code?: string
  description?: string
  parent_id?: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface HRDesignation {
  id: string
  vendor_id: string
  name: string
  level: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface HRAddress {
  street?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
}

export interface FamilyMember {
  name: string
  relation: string
  dob?: string
  phone?: string
  gender?: string
  blood_group?: string
}

export interface EmployeeProfile {
  id: string
  vendor_id: string
  vendor_user_id?: string | null
  full_name?: string | null
  employee_code: string
  // Credentials
  employee_code_custom?: string | null
  store_id?: string | null
  tagged_to_type?: string | null
  tagged_to_label?: string | null
  // Personal
  date_of_birth?: string | null
  gender?: string | null
  blood_group?: string | null
  marital_status?: string | null
  nationality?: string | null
  // Contact
  personal_email?: string | null
  personal_phone?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relation?: string | null
  // Addresses
  current_address?: HRAddress
  permanent_address?: HRAddress
  // Employment
  department_id?: string | null
  designation_id?: string | null
  manager_id?: string | null
  employment_type: string
  date_of_joining?: string | null
  date_of_exit?: string | null
  probation_end_date?: string | null
  notice_period_days: number
  status: string  // active / on_notice / exited / probation
  // Bank
  bank_name?: string | null
  account_number?: string | null
  account_holder_name?: string | null
  account_type?: string | null
  ifsc_code?: string | null
  pan_number?: string | null
  aadhaar_number?: string | null
  uan_number?: string | null
  esi_number?: string | null
  // Exit
  lwd?: string | null
  exit_reason?: string | null
  exit_interview_notes?: string | null
  exit_clearance?: Record<string, boolean>
  notice_served?: boolean | null
  // Family
  family_members?: FamilyMember[]
  is_active: boolean
  created_at: string
  updated_at?: string
  // Loaded relations
  department?: HRDepartment | null
  designation?: HRDesignation | null
  manager?: Pick<EmployeeProfile, 'id' | 'full_name' | 'employee_code' | 'employee_code_custom' | 'vendor_user'> | null
  vendor_user?: {
    id: string
    user?: { id?: string; full_name: string; email: string; phone?: string; avatar_url?: string }
  } | null
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  document_type: string
  document_name: string
  file_url?: string | null
  expiry_date?: string | null
  notes?: string | null
  verified_by?: string | null
  verified_at?: string | null
  created_at: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  clock_in?: string | null
  clock_out?: string | null
  clock_in_location?: { lat: number; lng: number; address?: string } | null
  clock_out_location?: { lat: number; lng: number; address?: string } | null
  status: string  // present / absent / half_day / late / on_leave / holiday / week_off
  work_hours?: number | null
  overtime_hours?: number | null
  notes?: string | null
  marked_by?: string | null
  approval_status?: string | null  // pending / approved / rejected
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  created_at: string
  employee?: Partial<EmployeeProfile>
}

export interface LeavePolicy {
  id: string
  vendor_id: string
  name: string
  code: string
  days_per_year: number
  carry_forward: boolean
  max_carry_forward_days: number
  is_paid: boolean
  is_active: boolean
  created_at: string
}

export interface LeaveBalance {
  id: string
  employee_id: string
  leave_policy_id: string
  year: number
  allocated: number
  used: number
  carried_forward: number
  available: number
  leave_policy?: LeavePolicy
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_policy_id: string
  from_date: string
  to_date: string
  days: number
  reason?: string | null
  status: string  // pending / approved / rejected / cancelled
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  is_half_day: boolean
  half_day_type?: string | null
  created_at: string
  employee?: Partial<EmployeeProfile>
  leave_policy?: LeavePolicy
}

export interface Holiday {
  id: string
  vendor_id: string
  name: string
  date: string
  is_optional: boolean
  year: number
  created_at: string
}

export interface SalaryStructure {
  id: string
  employee_id: string
  effective_from: string
  is_active: boolean
  earnings: Record<string, number>
  deductions: Record<string, number>
  ctc_annual: number
  ctc_monthly: number
  gross_monthly: number
  net_monthly: number
  created_at: string
  employee?: Partial<EmployeeProfile>
}

export interface PayrollEntry {
  id: string
  payroll_run_id: string
  employee_id: string
  earnings: Record<string, number>
  deductions: Record<string, number>
  days_worked: number
  days_absent: number
  leave_days: number
  overtime_hours: number
  gross_amount: number
  total_deductions: number
  net_amount: number
  status: string
  created_at: string
  employee?: Partial<EmployeeProfile>
  payroll_run?: Partial<PayrollRun>
}

export interface PayrollRun {
  id: string
  vendor_id: string
  month: number
  year: number
  version: number
  status: string  // draft / processing / processed / paid
  processed_by?: string | null
  processed_at?: string | null
  total_gross: number
  total_deductions: number
  total_net: number
  employee_count: number
  notes?: string | null
  created_at: string
  entries?: PayrollEntry[]
}

export interface OfferLetter {
  id: string
  vendor_id: string
  candidate_name: string
  candidate_email?: string | null
  candidate_phone?: string | null
  designation_id?: string | null
  department_id?: string | null
  store_id?: string | null
  offered_ctc?: number | null
  offered_date?: string | null
  joining_date?: string | null
  expiry_date?: string | null
  status: string  // draft / sent / accepted / rejected / expired
  template_content?: string | null
  template_id?: string | null
  notes?: string | null
  sent_at?: string | null
  responded_at?: string | null
  created_at: string
  updated_at?: string
  designation?: HRDesignation | null
  department?: HRDepartment | null
}

export interface OfferLetterTemplate {
  id: string
  vendor_id: string
  name: string
  description?: string | null
  body_html: string
  layout?: string
  is_default: boolean
  accent_color?: string
  watermark_enabled?: boolean
  watermark_text?: string | null
  watermark_opacity?: string
  watermark_style?: string
  logo_url?: string | null
  show_logo?: boolean
  logo_shape?: string
  designation_id?: string | null
  department_id?: string | null
  store_id?: string | null
  created_at: string
  updated_at?: string
  designation?: HRDesignation | null
  department?: HRDepartment | null
  store?: { id: string; name: string } | null
}

export interface AttendanceSummary {
  employee_id: string
  employee_code: string
  present: number
  absent: number
  late: number
  half_day: number
  on_leave: number
  holiday: number
  week_off: number
  overtime_hours: number
  total_work_hours: number
}

// ── HR: Recruitment ─────────────────────────────────────────────
export interface JobPosting {
  id: string
  vendor_id: string
  title: string
  department_id?: string | null
  designation_id?: string | null
  store_id?: string | null
  employment_type?: string
  location?: string
  openings?: number
  salary_min?: number | null
  salary_max?: number | null
  description?: string
  requirements?: string
  benefits?: string
  status: 'draft' | 'open' | 'closed' | 'on_hold'
  public_slug?: string | null
  posted_at?: string | null
  closes_at?: string | null
  created_at: string
  updated_at?: string
  department?: HRDepartment | null
  designation?: HRDesignation | null
}

export interface Candidate {
  id: string
  vendor_id: string
  full_name: string
  email?: string
  phone?: string
  resume_url?: string
  current_company?: string
  current_designation?: string
  total_experience_years?: number
  current_ctc?: number
  expected_ctc?: number
  notice_period_days?: number
  location?: string
  source?: string
  skills?: string[]
  tags?: string[]
  notes?: string
  created_at: string
  updated_at?: string
  applications?: JobApplication[]
}

export interface JobApplication {
  id: string
  vendor_id: string
  candidate_id: string
  job_posting_id: string
  current_stage: 'applied' | 'screening' | 'shortlisted' | 'interviewing' | 'offer_made' | 'hired' | 'rejected' | 'withdrawn'
  rating?: number
  owner_user_id?: string
  rejection_reason?: string
  cover_letter?: string
  applied_at: string
  moved_at?: string
  candidate?: Candidate
  job_posting?: JobPosting
  interviews?: InterviewRound[]
}

export interface InterviewRound {
  id: string
  vendor_id: string
  application_id: string
  round_number: number
  round_name?: string
  scheduled_at?: string
  duration_min?: number
  mode?: string
  location_or_link?: string
  interviewer_user_ids?: string[]
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled'
  rating?: number
  feedback?: string
  recommendation?: string
  application?: JobApplication
}

export interface OnboardingTemplateItem {
  id: string
  template_id: string
  sequence: number
  title: string
  description?: string
  category?: string
  default_due_offset_days?: number
  default_assignee_role?: string
}

export interface OnboardingTemplate {
  id: string
  vendor_id: string
  name: string
  description?: string
  designation_id?: string
  department_id?: string
  is_default?: boolean
  items?: OnboardingTemplateItem[]
  created_at: string
}

export interface OnboardingTask {
  id: string
  checklist_id: string
  sequence: number
  title: string
  description?: string
  category?: string
  due_date?: string
  assignee_user_id?: string
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
  completed_at?: string
  attachment_url?: string
  notes?: string
}

export interface OnboardingChecklist {
  id: string
  vendor_id: string
  employee_id: string
  template_id?: string
  started_at: string
  target_completion_date?: string
  completed_at?: string
  status: 'in_progress' | 'completed' | 'overdue'
  tasks?: OnboardingTask[]
}

// ── HR: Performance ─────────────────────────────────────────────
export interface KPITemplateItem {
  key: string
  label: string
  weight: number
}

export interface ReviewCycle {
  id: string
  vendor_id: string
  name: string
  description?: string
  period_start: string
  period_end: string
  review_type?: string
  rating_scale_max?: number
  self_review_required?: boolean
  manager_review_required?: boolean
  peer_review_count?: number
  enable_kpi_scoring?: boolean
  kpi_template?: KPITemplateItem[]
  status: 'draft' | 'launched' | 'closed'
  launched_at?: string
  closes_at?: string
  closed_at?: string
  created_at: string
}

export interface PerformanceGoal {
  id: string
  vendor_id: string
  employee_id: string
  cycle_id?: string
  parent_id?: string
  title: string
  description?: string
  category?: string
  target_value?: string
  weight?: number
  progress_pct?: number
  start_date?: string
  target_date?: string
  status: 'active' | 'completed' | 'dropped' | 'on_hold'
}

export interface ReviewKPIScore {
  id: string
  review_id: string
  kpi_key: string
  label?: string
  weight?: number
  self_score?: number
  manager_score?: number
  comments?: string
}

export interface PerformanceReview {
  id: string
  vendor_id: string
  cycle_id: string
  employee_id: string
  reviewer_user_id?: string
  status: 'draft' | 'self_pending' | 'self_submitted' | 'manager_pending' | 'manager_submitted' | 'acknowledged' | 'closed'
  self_assessment?: string
  self_rating?: number
  self_submitted_at?: string
  manager_comments?: string
  overall_rating?: number
  strengths?: string
  improvement_areas?: string
  promotion_recommended?: boolean
  salary_change_suggestion_pct?: number
  manager_submitted_at?: string
  employee_acknowledgement?: string
  acknowledged_at?: string
  kpi_scores?: ReviewKPIScore[]
}

export interface Feedback {
  id: string
  vendor_id: string
  from_user_id?: string
  to_employee_id: string
  feedback_type?: string
  visibility?: string
  title?: string
  body: string
  related_competency?: string
  created_at: string
}

// ── HR: Compliance ──────────────────────────────────────────────
export interface Policy {
  id: string
  vendor_id: string
  title: string
  category?: string
  summary?: string
  body?: string
  version: number
  status: 'draft' | 'published' | 'archived'
  effective_from?: string
  expires_on?: string
  requires_acknowledgement?: boolean
  audience?: string
  audience_filter?: Record<string, unknown>
  attachment_url?: string
  published_at?: string
  published_by?: string
  acknowledgements?: PolicyAcknowledgement[]
  created_at: string
}

export interface PolicyAcknowledgement {
  id: string
  policy_id: string
  employee_id: string
  policy_version: number
  acknowledged_at: string
  ip_address?: string
}

export interface ComplianceCertification {
  id: string
  vendor_id: string
  employee_id: string
  name: string
  type?: string
  issued_by?: string
  cert_number?: string
  issued_on?: string
  expires_on?: string
  document_url?: string
  notes?: string
  status: 'active' | 'expired' | 'revoked'
}

export interface ComplianceAuditLog {
  id: string
  vendor_id: string
  actor_user_id?: string
  actor_label?: string
  action: string
  entity_type: string
  entity_id?: string
  summary?: string
  diff?: Record<string, [unknown, unknown]>
  ip_address?: string
  created_at: string
}

// ── HR: Training ────────────────────────────────────────────────
export interface QuizOption {
  id: string
  text: string
  is_correct?: boolean
}

export interface QuizQuestion {
  id: string
  course_id: string
  sequence: number
  question: string
  question_type: 'single' | 'multi' | 'true_false'
  options?: QuizOption[]
  explanation?: string
  points?: number
}

export interface TrainingCourse {
  id: string
  program_id: string
  sequence: number
  title: string
  content_type: 'text' | 'video' | 'pdf' | 'quiz' | 'scorm'
  content_url?: string
  body_html?: string
  duration_min?: number
  pass_score_pct?: number
  is_required?: boolean
  questions?: QuizQuestion[]
}

export interface TrainingProgram {
  id: string
  vendor_id: string
  name: string
  description?: string
  category?: string
  cover_image_url?: string
  is_mandatory?: boolean
  target_audience?: string
  audience_filter?: Record<string, unknown>
  estimated_hours?: number
  issues_certificate?: boolean
  status: 'draft' | 'published' | 'archived'
  courses?: TrainingCourse[]
  created_at: string
}

export interface TrainingEnrollment {
  id: string
  vendor_id: string
  program_id: string
  employee_id: string
  enrolled_at: string
  due_date?: string
  status: 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'overdue'
  progress_pct: number
  completed_at?: string
  certificate_url?: string
  completions?: CourseCompletion[]
}

export interface CourseCompletion {
  id: string
  enrollment_id: string
  course_id: string
  started_at: string
  completed_at?: string
  score_pct?: number
  passed: boolean
  attempts: number
}

// ── HR: ESS ─────────────────────────────────────────────────────
export interface Announcement {
  id: string
  vendor_id: string
  title: string
  body: string
  category?: string
  audience?: string
  audience_filter?: Record<string, unknown>
  pinned?: boolean
  cover_image_url?: string
  attachment_url?: string
  publish_at?: string
  expires_at?: string
  status: 'draft' | 'published' | 'archived'
  read_by_me?: boolean
  created_at: string
}

export interface ExpenseClaim {
  id: string
  vendor_id: string
  employee_id: string
  claim_number?: string
  title: string
  category?: string
  expense_date?: string
  currency?: string
  amount: number
  description?: string
  receipts?: { url: string; name?: string }[]
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
  submitted_at?: string
  approver_user_id?: string
  decided_at?: string
  decision_note?: string
  paid_at?: string
  payment_reference?: string
  created_at: string
}

export interface HelpdeskTicketComment {
  id: string
  ticket_id: string
  author_user_id?: string
  is_staff_reply: boolean
  is_internal: boolean
  body: string
  attachment_url?: string
  created_at: string
}

export interface HelpdeskTicket {
  id: string
  vendor_id: string
  employee_id: string
  ticket_number?: string
  category?: string
  subject: string
  description?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  assignee_user_id?: string
  sla_due_at?: string
  resolved_at?: string
  closed_at?: string
  is_anonymous?: boolean
  attachment_url?: string
  comments?: HelpdeskTicketComment[]
  created_at: string
}

export interface ESSProfile {
  employee: {
    id: string
    employee_code?: string
    department?: HRDepartment | null
    designation?: HRDesignation | null
    vendor_user?: { user?: User; store_id?: string }
    [k: string]: unknown
  } | null
  pending_policies: Policy[]
  announcements: Announcement[]
  expense_summary: { draft: number; submitted: number; approved: number }
  ticket_summary: { open: number; in_progress: number; resolved: number }
  training_summary: { enrolled: number; completed: number; overdue: number }
}

// ── Restaurant Outlet ───────────────────────────────────────────
export interface RestaurantOutlet {
  id: string
  vendor_id: string
  store_id: string
  name: string
  code?: string | null
  cuisine?: string | null
  phone?: string | null
  email?: string | null
  address?: Record<string, unknown>
  settings?: Record<string, unknown>
  is_active: boolean
  is_default: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface RestaurantMenuCategoryOut {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  mode: 'all_active' | 'curated' | 'by_categories'
  product_ids: string[]
  service_ids: string[]
  vendor_category_ids: string[]
}

export interface RestaurantMenuZoneLinkOut {
  id: string
  zone_id: string
  zone_name?: string | null
  link_token: string
}

export interface RestaurantMenuOut {
  id: string
  restaurant_id: string
  name: string
  is_active: boolean
  sort_order: number
  categories: RestaurantMenuCategoryOut[]
  zone_links: RestaurantMenuZoneLinkOut[]
}

// ── Paginated ───────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}
