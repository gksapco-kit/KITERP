import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Customer, Token } from '@/types'

interface AuthState {
  customer: Customer | null; accessToken: string | null; isAuthenticated: boolean
  setCustomer: (c: Customer | null) => void
  setTokens: (t: Token) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null, accessToken: null, isAuthenticated: false,
      setCustomer: (customer) => set({ customer, isAuthenticated: !!customer }),
      setTokens: (tokens) => {
        localStorage.setItem('customer_access_token', tokens.access_token)
        localStorage.setItem('customer_refresh_token', tokens.refresh_token)
        set({ accessToken: tokens.access_token, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('customer_access_token')
        localStorage.removeItem('customer_refresh_token')
        set({ customer: null, accessToken: null, isAuthenticated: false })
      },
    }),
    { name: 'customer-auth-storage', partialize: (s) => ({ customer: s.customer, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }) }
  )
)
