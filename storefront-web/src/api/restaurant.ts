/**
 * Public restaurant API — no customer auth required.
 */
import axios from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const BASE = getStorefrontApiBaseUrl()

const client = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' }, timeout: 15000 })

export interface PublicModifierOption {
  id: string
  name: string
  price_delta: number
  is_default?: boolean
}

export interface PublicModifierGroup {
  id: string
  name: string
  selection_type: 'single' | 'multiple' | string
  is_required: boolean
  min_select?: number
  options: PublicModifierOption[]
}

export interface PublicMenuItem {
  id: string
  name: string
  description?: string | null
  price: number
  category?: string | null
  tax_rate: number
  image_url?: string | null
  stock_status?: string | null
  is_available: boolean
  tags?: string[]
  modifier_groups?: PublicModifierGroup[]
}

export interface PublicMenuSubcategory {
  name: string
  items: PublicMenuItem[]
}

export interface PublicMenuCategory {
  category: string
  items: PublicMenuItem[]
  subcategories?: PublicMenuSubcategory[]
}

export interface PublicTableInfo {
  vendor: { id: string; name: string; slug: string }
  table: { id: string; label: string; capacity: number; zone_name?: string | null }
  menu: PublicMenuCategory[]
  menu_truncated?: boolean
}

export interface GuestOrderModifier {
  group_id: string
  group_name: string
  option_id: string
  option_name: string
  price_delta: number
}

export interface GuestOrderItem {
  product_id: string
  name: string
  qty: number
  unit_price: number
  notes?: string
  modifiers?: GuestOrderModifier[]
}

export interface ZoneMenuItem {
  id: string
  item_type: 'product' | 'service'
  name: string
  description?: string | null
  price: number
  category?: string | null
  subcategory?: string | null
  image_url?: string | null
}

export interface ZoneMenuCategory {
  id: string
  name: string
  mode: 'all_active' | 'curated' | 'by_categories'
  items: ZoneMenuItem[]
  children: ZoneMenuCategory[]
}

export interface ZoneMenuInfo {
  vendor: { id: string; name: string; slug: string }
  zone: { id: string; name: string | null }
  menu: { id: string; name: string; categories: ZoneMenuCategory[] }
}

export const restaurantApi = {
  getTableMenu: async (vendorSlug: string, qrToken: string): Promise<PublicTableInfo> => {
    const res = await client.get(`/public/restaurant/${vendorSlug}/table/${qrToken}`)
    return res.data
  },

  getZoneMenu: async (vendorSlug: string, linkToken: string): Promise<ZoneMenuInfo> => {
    const res = await client.get(`/public/restaurant/${vendorSlug}/menu/${linkToken}`)
    return res.data
  },

  submitGuestOrder: async (
    vendorSlug: string,
    qrToken: string,
    body: { items: GuestOrderItem[]; guest_name?: string; guest_phone?: string; notes?: string },
  ) => {
    const res = await client.post(`/public/restaurant/${vendorSlug}/table/${qrToken}/order`, body)
    return res.data as { order_id: string; table_label: string; status: string; items: unknown[]; created: boolean }
  },

  submitReservation: async (
    vendorSlug: string,
    body: {
      guest_name: string
      guest_phone?: string
      guest_email?: string
      reservation_date: string
      reservation_time: string
      party_size?: number
      notes?: string
    },
  ) => {
    const res = await client.post(`/public/restaurant/${vendorSlug}/reserve`, body)
    return res.data as {
      id: string
      status: string
      guest_name: string
      reservation_date: string
      reservation_time: string
      party_size: number
    }
  },
}
