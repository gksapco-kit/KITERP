import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { User, Token } from '@/types'
import { useVendorStore } from '@/stores/vendorStore'
import {
  clearAuthTokens,
  clearLegacyAuthLocalStorage,
  setAuthTokens,
} from '@/lib/authTokenStorage'

clearLegacyAuthLocalStorage()

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setTokens: (tokens: Token) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (tokens) => {
        setAuthTokens(tokens.access_token, tokens.refresh_token)
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
        })
      },
      logout: () => {
        clearAuthTokens()
        try {
          useVendorStore.getState().clearVendor()
        } catch {
          /* ignore if vendor store not ready */
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'vendor-auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && state?.refreshToken) {
          setAuthTokens(state.accessToken, state.refreshToken)
        }
      },
    }
  )
)
