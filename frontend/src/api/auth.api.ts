import apiClient from './client'
import type { User, UserCreate, Token } from '@/types/user'

export const authApi = {
  register: async (data: UserCreate): Promise<User> => {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },

  login: async (login: string, password: string): Promise<Token> => {
    // Dedicated platform route: never tenant-scoped (see backend /auth/login/platform).
    const trimmed = login.trim()
    const compactPhone = trimmed.replace(/\s/g, '')
    const normalized = /^\+?\d{7,15}$/.test(compactPhone) ? compactPhone : trimmed
    const response = await apiClient.post('/auth/login/platform', {
      login: normalized,
      password,
    })
    return response.data
  },

  refreshToken: async (refreshToken: string): Promise<Token> => {
    const response = await apiClient.post('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },
}
