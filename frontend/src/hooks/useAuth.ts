import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'

import { authApi } from '@/api/auth.api'
import { API_URL } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import type { UserCreate } from '@/types/user'

/** Readable message from FastAPI `{ detail: ... }` or empty/HTML proxy errors. */
export function formatLoginError(
  ax: AxiosError<{ detail?: unknown; type?: string; message?: string }>,
): string {
  const status = ax.response?.status
  const raw = ax.response?.data
  if (raw == null || (typeof raw === 'object' && raw !== null && Object.keys(raw).length === 0)) {
    if (status === 503) {
      return (
        'Database error (HTTP 503). Run: docker compose exec backend alembic upgrade heads — ' +
        'then restart the backend container.'
      )
    }
    if (status === 500) {
      return (
        'Server error (HTTP 500). Restart the API container/process so startup migrations run, then check logs: ' +
        'docker compose logs backend --tail 100'
      )
    }
    return status
      ? `Login failed (HTTP ${status}). Is the API running on port 8000? Run: docker compose up -d backend postgres redis`
      : 'Login failed'
  }
  if (typeof raw === 'string') {
    const s = raw.trim().slice(0, 240)
    return s || `Login failed (HTTP ${status ?? '?'})`
  }
  const d = raw.detail
  const errType = typeof raw.type === 'string' ? raw.type : ''
  if (typeof d === 'string') {
    const msg = d.trim() || 'Login failed'
    let out = errType ? `${msg} (${errType})` : msg
    if (status === 503 && typeof raw === 'object' && raw !== null && typeof raw.message === 'string') {
      const hint = raw.message.trim()
      if (hint) out = `${out}. ${hint}`
    }
    return out
  }
  if (Array.isArray(d)) {
    const parts = d.map((item) =>
      typeof item === 'object' && item !== null && 'msg' in item
        ? String((item as { msg: unknown }).msg)
        : JSON.stringify(item),
    )
    return parts.join('; ') || 'Login failed'
  }
  if (d != null && typeof d === 'object') return JSON.stringify(d).slice(0, 200)
  return 'Login failed'
}

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

  return useMutation({
    mutationFn: async ({ login, password }: { login: string; password: string }) => {
      const tokens = await authApi.login(login, password)
      const store = useAuthStore.getState()
      store.setTokens(tokens)
      try {
        const user = await authApi.getMe()
        store.setUser(user)
        return user
      } catch (err: unknown) {
        store.logout()
        throw err
      }
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user)
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
      toast.error(formatLoginError(ax))
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
