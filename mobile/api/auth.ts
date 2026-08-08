import apiClient from './client'
import type { Token, User, Customer } from '../types'

/** Turn FastAPI / axios error payloads into a readable string. */
export function apiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d: any) => {
        if (typeof d === 'string') return d
        const loc = Array.isArray(d?.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : ''
        const msg = d?.msg || d?.message || 'Invalid value'
        return loc ? `${loc}: ${msg}` : msg
      })
      .join('\n')
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message
  }
  return err?.message || fallback
}

export const authApi = {
  // Vendor/Admin auth
  vendorLogin: async (email: string, password: string): Promise<Token> => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    const res = await apiClient.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
  vendorMe: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me')
    return res.data
  },

  // Customer auth
  customerRegister: async (data: {
    full_name: string
    email?: string
    phone?: string
    password: string
    otp_code: string
  }): Promise<Customer> => {
    const res = await apiClient.post('/store/auth/register', data)
    return res.data
  },
  customerSendSignupOtp: async (data: { email?: string; phone?: string }) => {
    const res = await apiClient.post('/store/auth/send-signup-otp', data)
    return res.data as {
      sent: boolean
      channel: string
      to: string
      expires_at?: string
      dev_hint?: string
    }
  },
  /** API expects `login` (email or phone), not `email`. */
  customerLogin: async (login: string, password: string): Promise<Token> => {
    const res = await apiClient.post('/store/auth/login', {
      login: login.trim(),
      password,
    })
    return res.data
  },
  customerMe: async (): Promise<Customer> => {
    const res = await apiClient.get('/store/auth/me')
    return res.data
  },
}
