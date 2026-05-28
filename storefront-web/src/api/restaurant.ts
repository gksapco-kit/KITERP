/**
 * Public restaurant API — no customer auth required.
 * Used by the QR table order page and online reservation form.
 */
import axios from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'

const BASE = getStorefrontApiBaseUrl()

const client = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' }, timeout: 15000 })

export interface PublicMenuItem {
  id: string
  name: string
  description?: string | null
  price: number
  category?: string | null
  tax_rate: number
  image_url?: string | null
  is_available: boolean
}

export interface PublicMenuCategory {
  category: string
  items: PublicMenuItem[]
}

export interface PublicTableInfo {
  vendor: { id: string; name: string; slug: string }
  table: { id: string; label: string; capacity: number; zone_name?: string | null }
  menu: PublicMenuCategory[]
}

export interface GuestOrderItem {
  product_id: string
  name: string
  qty: number
  unit_price: number
  notes?: string
}

export const restaurantApi = {
  getTableMenu: async (vendorSlug: string, qrToken: string): Promise<PublicTableInfo> => {
    const res = await client.get(`/public/restaurant/${vendorSlug}/table/${qrToken}`)
    return res.data
  },

  submitGuestOrder: async (
    vendorSlug: string,
    qrToken: string,
    body: { items: GuestOrderItem[]; guest_name?: string; notes?: string }
  ) => {
    const res = await client.post(`/public/restaurant/${vendorSlug}/table/${qrToken}/order`, body)
    return res.data as { order_id: string; table_label: string; status: string; items: unknown[]; created: boolean }
  },

  submitReservation: async (
    vendorSlug: string,
    body: {
      guest_name: string; guest_phone?: string; guest_email?: string
      reservation_date: string; reservation_time: string; party_size?: number; notes?: string
    }
  ) => {
    const res = await client.post(`/public/restaurant/${vendorSlug}/reserve`, body)
    return res.data as { id: string; status: string; guest_name: string; reservation_date: string; reservation_time: string; party_size: number }
  },
}
