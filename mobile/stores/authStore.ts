import { create } from 'zustand'
import type { User, Customer, Token, UserRole } from '../types'
import { setAuthToken, setVendorId, setVendorSlug } from '../api/client'

interface VendorInfo {
  id: string
  slug: string
  display_name: string
  logo_url?: string
}

interface AuthState {
  // Common
  role: UserRole | null
  accessToken: string | null
  isAuthenticated: boolean

  // Vendor user
  user: User | null

  // Customer
  customer: Customer | null
  vendorId: string | null
  vendorSlug: string | null
  vendorInfo: VendorInfo | null

  setRole: (role: UserRole) => void
  setVendorAuth: (user: User, tokens: Token) => void
  setCustomerAuth: (customer: Customer, tokens: Token, vendor: VendorInfo) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  accessToken: null,
  isAuthenticated: false,
  user: null,
  customer: null,
  vendorId: null,
  vendorSlug: null,
  vendorInfo: null,

  setRole: (role) => set({ role }),

  setVendorAuth: (user, tokens) => {
    setAuthToken(tokens.access_token)
    set({
      role: 'vendor', user, accessToken: tokens.access_token,
      isAuthenticated: true, customer: null, vendorId: null, vendorSlug: null, vendorInfo: null,
    })
  },

  setCustomerAuth: (customer, tokens, vendor) => {
    setAuthToken(tokens.access_token)
    setVendorId(vendor.id)
    setVendorSlug(vendor.slug)
    set({
      role: 'customer', customer, accessToken: tokens.access_token,
      isAuthenticated: true, user: null,
      vendorId: vendor.id, vendorSlug: vendor.slug, vendorInfo: vendor,
    })
  },

  logout: () => {
    setAuthToken(null)
    setVendorId(null)
    setVendorSlug(null)
    set({
      role: null, user: null, customer: null, accessToken: null,
      isAuthenticated: false, vendorId: null, vendorSlug: null, vendorInfo: null,
    })
  },
}))
