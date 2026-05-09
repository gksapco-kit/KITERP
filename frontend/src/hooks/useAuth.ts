import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'

import { authApi } from '@/api/auth.api'
import { API_URL } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import type { UserCreate } from '@/types/user'

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

export function useMe() {
  const { setUser, accessToken } = useAuthStore()

  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const user = await authApi.getMe()
      setUser(user)
      return user
    },
    enabled: !!accessToken,
    retry: false,
  })
}

export function useLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setTokens } = useAuthStore()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (tokens) => {
      setTokens(tokens)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Login successful!')
      navigate('/dashboard')
    },
    onError: (error: unknown) => {
      const ax = error as AxiosError<{ detail?: string | Record<string, unknown> }>
      if (ax.code === 'ECONNABORTED' || ax.message?.toLowerCase().includes('timeout')) {
        toast.error(
          'Request timed out — start the backend on port 8000 or fix VITE_API_URL in frontend/.env',
          { duration: 12_000 },
        )
        return
      }
      if (!ax.response) {
        const hint = import.meta.env.DEV
          ? `${API_URL} via Vite → ensure backend is on port 8000 (see frontend/vite.config.ts proxy)`
          : `${API_URL}`
        toast.error(`Cannot reach the API (${hint}).`, { duration: 12_000 })
        return
      }
      const d = ax.response.data?.detail
      const message =
        typeof d === 'string' ? d : d != null ? JSON.stringify(d).slice(0, 200) : 'Login failed'
      toast.error(message)
    },
  })
}

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: UserCreate) => authApi.register(data),
    onSuccess: () => {
      toast.success('Registration successful! Please login.')
      navigate('/login')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Registration failed'
      toast.error(message)
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()

  return () => {
    logout()
    queryClient.clear()
    navigate('/login')
    toast.success('Logged out successfully')
  }
}
