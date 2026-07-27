import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Customer, Token } from '@/types'
import {
  clearScopedCustomerTokens,
  writeScopedCustomerTokens,
} from '@/lib/customerAuthStorage'
import { safeLocalStateStorage } from '@/lib/safeStorage'

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
        writeScopedCustomerTokens(tokens.access_token, tokens.refresh_token)
        set({ accessToken: tokens.access_token, isAuthenticated: true })
      },
      logout: () => {
        clearScopedCustomerTokens()
        set({ customer: null, accessToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'customer-auth-storage',
      storage: createJSONStorage(() => safeLocalStateStorage),
      partialize: (s) => ({ customer: s.customer, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }),
    },
  ),
)
