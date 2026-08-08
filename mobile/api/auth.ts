import apiClient from './client'
import type { Token, User, Customer } from '../types'

/** Turn FastAPI / axios error payloads into a readable string. */
export function apiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const status = err?.response?.status as number | undefined
  if (status === 502 || status === 503 || status === 504) {
    return 'Server is temporarily unavailable. Please try again in a moment.'
  }
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
    return 'Request timed out. Check your internet connection and try again.'
  }
  if (!err?.response && (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK')) {
    return 'Network error. Check your connection, or restart Expo with EXPO_PUBLIC_API_URL set to https://kiterp.com/api/v1'
  }

  const detail = err?.response?.data?.detail
  const soften = (msg: string) => {
    if (/maximum credits|credits exceeded|over quota|trial|0 emails|email provider limit|plan reached/i.test(msg)) {
      return 'Email delivery is temporarily unavailable (provider limit reached). Please use phone OTP, or try again later.'
    }
    if (/sendgrid.*401|api key was rejected|unauthorized|sendgrid send failed/i.test(msg)) {
      return "We couldn't send email right now. Please use phone OTP, or try again later."
    }
    if (/FROM_EMAIL|Sender Authentication|\.env\.config|SENDGRID_API_KEY/i.test(msg)) {
      return "We couldn't send email from this store right now. Please use phone OTP, or contact the store."
    }
    return msg
  }
  if (typeof detail === 'string' && detail.trim()) return soften(detail)
  if (Array.isArray(detail) && detail.length) {
    return soften(
      detail
        .map((d: any) => {
          if (typeof d === 'string') return d
          const loc = Array.isArray(d?.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : ''
          const msg = d?.msg || d?.message || 'Invalid value'
          return loc ? `${loc}: ${msg}` : msg
        })
        .join('\n'),
    )
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return soften(detail.message)
  }
  if (status && status >= 500) {
    return 'Server error. Please try again shortly.'
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
