export interface Token { access_token: string; refresh_token: string; token_type: string }

export interface User {
  id: string; email: string; full_name: string; phone?: string; is_active: boolean; is_superuser?: boolean
}

export interface Customer {
  id: string; vendor_id: string; full_name: string; email: string; phone?: string
  shipping_addresses: Address[]; total_orders: number; total_spent: number
}

export interface Address {
  street_address: string; city: string; state: string; postal_code: string; country: string; label?: string
}

export interface Vendor {
  id: string; business_name: string; display_name: string; slug: string; description?: string
  primary_email: string; primary_phone: string; status: string
}

export interface ProductVariant {
  id: string
  name?: string
  price: number
  compare_at_price?: number | null
  is_active?: boolean
  price_type?: string
  quantity?: number
  stock_status?: string
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  category?: string
  price: number
  compare_at_price?: number | null
  currency?: string
  images: { url: string; is_primary: boolean }[]
  variants?: ProductVariant[]
  status: string
  quantity: number
  stock_status?: string
}

export interface Service {
  id: string; name: string; slug: string; description?: string; category?: string
  price_type: string; price?: number; duration_minutes?: number; image_url?: string
}

export interface CartItem {
  product_id: string
  variant_id?: string
  name: string
  qty: number
  price: number
  image_url?: string
}

export interface Cart { id: string; items: CartItem[]; item_count: number; subtotal: number; discount_amount: number }

export interface Order {
  id: string
  order_number: string
  items: CartItem[]
  item_count: number
  subtotal: number
  tax_amount: number
  total: number
  status: string
  payment_status: string
  payment_method?: string
  payment_proof?: {
    status?: string
    utr?: string
    screenshot_url?: string
  } | null
  shipping_address?: Record<string, string>
  created_at: string
}

export type ManualUpiConfig = {
  enabled: boolean
  upi_id?: string | null
  qr_code_url?: string | null
  label?: string
  business_name?: string | null
  logo_url?: string | null
}


export interface OrderStats {
  total_orders: number; pending_orders: number; completed_orders: number
  total_revenue: number; today_orders: number; today_revenue: number
}

export interface PaginatedResponse<T> { items: T[]; total: number; page: number; size: number; pages: number }

export type UserRole = 'vendor' | 'customer'
