import apiClient from './client'
import type { User, Token, VendorHandoffRedeem } from '@/types'

export const authApi = {
  redeemVendorHandoff: async (handoffToken: string): Promise<VendorHandoffRedeem> => {
    const response = await apiClient.post('/auth/vendor-handoff/redeem', {
      handoff_token: handoffToken,
    })
    return response.data
  },

  /** Optional vendorSlug scopes login when the same email exists on multiple User rows (dev: env or ?vendor=). */
  login: async (email: string, password: string, vendorSlug?: string, totpCode?: string): Promise<Token> => {
    // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)
    const s = vendorSlug?.trim()
    if (s) params.append('vendor_slug', s)
    const code = totpCode?.trim()
    if (code) params.append('totp_code', code)
    const response = await apiClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  updateMe: async (data: {
    full_name?: string
    phone?: string | null
    avatar_url?: string | null
  }): Promise<User> => {
    const response = await apiClient.patch('/auth/me', data)
    return response.data
  },

  changePassword: async (data: {
    current_password: string
    new_password: string
  }): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/change-password', data)
    return response.data
  },

  uploadAvatar: async (file: File): Promise<{ url: string; avatar_url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post('/uploads/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // ── Email verification ────────────────────────────────────────────
  resendEmailVerification: async (): Promise<OtpSendResponse> => {
    const response = await apiClient.post('/auth/email/resend-verification')
    return response.data
  },

  verifyEmailCode: async (code: string): Promise<User> => {
    const response = await apiClient.post('/auth/email/verify', { code })
    return response.data
  },

  // ── Email change ──────────────────────────────────────────────────
  requestEmailChange: async (data: { new_email: string; password: string }): Promise<OtpSendResponse> => {
    const response = await apiClient.post('/auth/email/request-change', data)
    return response.data
  },

  confirmEmailChange: async (code: string): Promise<User> => {
    const response = await apiClient.post('/auth/email/confirm-change', { code })
    return response.data
  },

  // ── Phone OTP (dev-mode SMS) ──────────────────────────────────────
  sendPhoneOtp: async (phone?: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post('/auth/phone/send-otp', phone ? { phone } : {})
    return response.data
  },

  verifyPhoneOtp: async (code: string): Promise<User> => {
    const response = await apiClient.post('/auth/phone/verify-otp', { code })
    return response.data
  },

  // ── Vendor signup ─────────────────────────────────────────────────
  vendorSignup: async (payload: VendorSignupPayload): Promise<VendorSignupResult> => {
    const response = await apiClient.post('/auth/vendor-signup', payload)
    return response.data
  },

  vendorSignupSendPhoneOtp: async (phone: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post('/auth/vendor-signup/send-phone-otp', { phone })
    return response.data
  },

  vendorSignupSendEmailOtp: async (email: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post('/auth/vendor-signup/send-email-otp', { email: email.trim().toLowerCase() })
    return response.data
  },

  /** Call before OTP modal / signup — 400 if email or phone already exists on a user. */
  vendorSignupCheckContact: async (payload: { email?: string; phone?: string }): Promise<{ available: boolean }> => {
    const response = await apiClient.post('/auth/vendor-signup/check-contact', payload)
    return response.data
  },

  setup2fa: async (): Promise<{ secret: string; provisioning_uri: string }> => {
    const response = await apiClient.post('/auth/2fa/setup')
    return response.data
  },

  enable2fa: async (code: string): Promise<{ enabled: boolean }> => {
    const response = await apiClient.post('/auth/2fa/enable', { code })
    return response.data
  },

  disable2fa: async (code: string): Promise<{ enabled: boolean }> => {
    const response = await apiClient.post('/auth/2fa/disable', { code })
    return response.data
  },

  sendAccountDeleteOtp: async (password: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post('/auth/me/delete/send-otp', { password })
    return response.data
  },

  deleteAccount: async (code: string): Promise<void> => {
    await apiClient.delete('/auth/me', { data: { code } })
  },
}

export interface VendorSignupPayload {
  full_name: string
  business_name: string
  business_category?: string
  email?: string
  phone?: string
  phone_otp?: string
  email_otp?: string
  password: string
}

export interface VendorSignupResult {
  access_token: string
  refresh_token: string
  token_type: string
  user_id: string
  vendor_id: string
  vendor_slug: string
  verification_code_hint?: string
}

export interface OtpSendResponse {
  sent: boolean
  channel: 'email' | 'phone'
  to: string
  expires_at: string
  /** Returned only in dev mode (no SMTP/SMS configured). UI can autofill from this. */
  dev_hint?: string
}
