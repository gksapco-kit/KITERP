export interface Token { access_token: string; refresh_token: string; token_type: string }

export interface Customer {
  id: string; vendor_id: string; full_name: string; email?: string; phone?: string
  shipping_addresses: Address[]; default_address_index: number
  total_orders: number; total_spent: number; created_at: string
}

export interface Address {
  street_address: string; city: string; state: string; postal_code: string
  country: string; label?: string
}

export interface VendorInfo {
  id: string; business_name: string; display_name: string; slug: string
  description?: string; logo_url?: string; banner_url?: string
  primary_email: string; primary_phone: string; support_email?: string
}

export interface ProductVariant {
  id: string; name: string
  sku?: string; barcode?: string; uom?: string
  price_type?: string
  price: number; compare_at_price?: number; cost_price?: number
  currency?: string; discount_percentage?: number; discount_amount?: number
  offer_label?: string; is_on_sale?: boolean
  is_taxable?: boolean; tax_rate?: number; hsn_code?: string; gst_rate?: number
  quantity?: number; low_stock_threshold?: number; stock_status?: string
  allow_backorders?: boolean; track_inventory?: boolean; weight_kg?: number
  expiration_date?: string; manufacture_date?: string; best_before_date?: string
  warranty_period_days?: number; warranty_type?: string
  is_returnable?: boolean; return_days?: number; refund_policy?: string
  return_policy?: string; return_conditions?: string
  color?: string; attributes?: Record<string, string>
  media?: { url: string; media_type: 'image' | 'video' | 'model3d'; is_primary: boolean; alt_text?: string; position: number }[]
  // Subscription (variant-level)
  subscription_interval?: string
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  subscription_schedule_modes?: string[]
  is_active?: boolean; created_at?: string
}

export interface ProductCard {
  id: string; name: string; slug: string
  price: number; compare_at_price?: number; currency?: string
  images: { id: string; url: string; alt_text?: string; is_primary: boolean; media_type?: 'image' | 'video' | 'model3d' }[]
  avg_rating?: number; review_count?: number
  stock_status?: string; brand?: string; category?: string
}

export interface Product {
  id: string; name: string; slug: string; description?: string; short_description?: string
  brand?: string; product_type?: string
  category?: string; subcategory?: string; tags?: string[]
  uom?: string
  price: number; compare_at_price?: number; cost_price?: number
  currency?: string; discount_percentage?: number; discount_amount?: number
  offer_label?: string; is_on_sale?: boolean
  sku?: string; barcode?: string; stock_status?: string; quantity?: number
  low_stock_threshold?: number
  specifications?: Record<string, string>
  warranty_type?: string; warranty_period_days?: number
  return_policy?: string; return_days?: number; return_conditions?: string
  refund_policy?: string; is_returnable?: boolean
  weight_kg?: number; shipping_cost?: number; free_shipping_threshold?: number
  shipping_cost_type?: string
  requires_shipping?: boolean; shipping_class?: string
  length_cm?: number; width_cm?: number; height_cm?: number
  images: { id: string; url: string; alt_text?: string; is_primary: boolean; media_type?: 'image' | 'video' | 'model3d' }[]
  variants?: ProductVariant[]
  cross_sell_products?: ProductCard[]
  upsell_products?: ProductCard[]
  // Subscription
  is_subscription?: boolean
  subscription_interval?: string
  subscription_price?: number
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number

  status: string; is_featured: boolean; is_new_arrival?: boolean; is_best_seller?: boolean
  allow_quote_request?: boolean
  quote_form_config?: QuoteFormField[]
  avg_rating?: number; review_count?: number
  rating_distribution?: Record<number, number>
  track_inventory?: boolean
  created_at?: string
}

export interface ServicePlan {
  id: string; service_id: string; name: string; description?: string
  price?: number; uom: string; price_type: string
  subscription_interval?: string
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  subscription_schedule_modes: string[]
  duration_minutes?: number
  requires_booking?: boolean
  max_bookings_per_slot?: number
  advance_booking_days?: number
  booking_lead_time_hours?: number
  cancellation_policy?: string
  cancellation_hours?: number
  rescheduling_policy?: string
  no_show_policy?: string
  availability?: { day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]
  is_active: boolean; sort_order: number
  created_at?: string
}

export interface ServiceAvailability {
  id: string; day_of_week: number
  start_time: string; end_time: string; is_available: boolean
}

export interface QuoteFormField {
  key: string
  label: string
  type:
    | 'text'
    | 'textarea'
    | 'date'
    | 'time'
    | 'number'
    | 'email'
    | 'phone'
    | 'select'
    | 'document'
    | 'photo_video'
    | 'photo_document'
    | 'location'
  required: boolean
  enabled: boolean
  placeholder?: string
  options?: string[]
}

export interface Service {
  id: string; name: string; slug: string; description?: string; short_description?: string
  brand?: string; service_type?: string
  category?: string; subcategory?: string; tags?: string[]
  uom?: string
  price_type: string; price?: number; price_min?: number; price_max?: number
  currency?: string; discount_percentage?: number; discount_amount?: number
  offer_label?: string
  service_mode?: string; duration_minutes?: number; buffer_minutes?: number
  service_capacity?: number
  // Subscription
  is_subscription?: boolean
  subscription_interval?: string
  subscription_price?: number
  subscription_price_type?: string
  subscription_trial_days?: number
  subscription_setup_fee?: number
  subscription_billing_cycles?: number
  subscription_schedule_modes?: string[]
  // Booking & Quotes
  requires_booking?: boolean
  allow_quote_request?: boolean
  quote_form_config?: QuoteFormField[]
  max_bookings_per_slot?: number
  advance_booking_days?: number
  booking_lead_time_hours?: number
  // Policies
  cancellation_policy?: string; cancellation_hours?: number; rescheduling_policy?: string
  // Details
  features?: string[]
  whats_included?: string[]; whats_not_included?: string[]
  prerequisites?: string; service_areas?: string[]
  image_url?: string; gallery?: string[]
  media?: { id: string; url: string; media_type: 'image' | 'video' | 'model3d'; is_primary: boolean; alt_text?: string; position: number }[]
  is_featured: boolean
  avg_rating?: number; review_count?: number
  rating_distribution?: Record<number, number>
  // Relations
  availability?: ServiceAvailability[]
  plans?: ServicePlan[]
  created_at?: string
}

export interface DisplayFields {
  product: Record<string, boolean>
  service: Record<string, boolean>
}

export interface Review {
  id: string; vendor_id: string; customer_id: string
  customer_name?: string; customer_avatar?: string
  review_type: 'product' | 'service'
  product_id?: string; service_id?: string; order_id?: string
  rating: number; title?: string; comment?: string
  reply?: string; replied_at?: string
  is_verified_purchase: boolean
  created_at: string; updated_at?: string
}

export interface ReviewsResponse {
  items: Review[]; total: number; page: number; size: number; pages: number
  avg_rating: number; review_count: number
  distribution: Record<number, number>
}

export interface CartItem {
  product_id: string; variant_id?: string; name: string; qty: number; price: number; image_url?: string
}

export interface Cart {
  id: string; items: CartItem[]; item_count: number; subtotal: number
  coupon_code?: string; discount_amount: number
}

export interface OrderItem { product_id: string; name: string; qty: number; price: number; image_url?: string }

export interface OrderAttachmentRef { url: string; kind: 'image' | 'video' }

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
  id: string; order_number: string; items: OrderItem[]; item_count: number
  subtotal: number; tax_amount: number; discount_amount: number; shipping_amount: number; total: number
  status: string; payment_status: string; payment_method?: string
  shipping_address?: Record<string, string>; tracking_number?: string; tracking_url?: string
  cancel_reason?: string
  cancel_attachments?: OrderAttachmentRef[]
  return_type?: string; return_reason?: string; return_status?: string
  return_notes?: string; refund_amount?: number
  return_attachments?: OrderAttachmentRef[]
  return_tracking_number?: string; return_tracking_url?: string
  return_requested_at?: string; return_resolved_at?: string
  created_at: string; updated_at?: string; confirmed_at?: string; shipped_at?: string; delivered_at?: string
  source?: string
  notes?: string
  status_history?: OrderStatusHistoryItem[]
}

export interface Booking {
  id: string; vendor_id: string; customer_id?: string; service_id?: string
  booking_number: string; service_name?: string; service_price: number
  booking_date: string; start_time?: string; end_time?: string; duration_minutes?: number
  status: string; customer_name?: string; customer_email?: string; customer_phone?: string
  notes?: string; cancel_reason?: string
  subtotal: number; tax_amount: number; discount_amount: number; total: number
  payment_status: string; payment_method?: string
  order_id?: string
  created_at: string
}

export interface StoreCategory {
  id: string; parent_id?: string | null; name: string; slug: string
  description?: string; applies_to: string; children?: StoreCategory[]
}

export interface PaginatedResponse<T> { items: T[]; total: number; page: number; size: number; pages: number }
