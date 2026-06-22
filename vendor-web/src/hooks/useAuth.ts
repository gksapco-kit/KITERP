import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi, type VendorSignupPayload } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { apiError, isAxiosAuthError, isAxiosNetworkError } from '@/lib/errorMessages'
import { clearVendorRegisterDraft } from '@/lib/vendorRegisterDraft'

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
    retry: (failureCount, error) => {
      if (isAxiosAuthError(error)) return false
      if (isAxiosNetworkError(error)) {
        return failureCount < (import.meta.env.DEV ? 10 : 2)
      }
      return failureCount < 1
    },
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 8000),
    // Avoid logout loops when switching tabs during a backend reload.
    refetchOnWindowFocus: import.meta.env.PROD,
  })
}

export function useLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setTokens } = useAuthStore()

  return useMutation({
    mutationFn: ({ login, password, vendorSlug }: { login: string; password: string; vendorSlug?: string; persistLogin?: boolean }) =>
      authApi.login(login, password, vendorSlug),
    onSuccess: (tokens) => {
      setTokens(tokens)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Login successful!')
      navigate('/')
    },
    onError: apiError('Login failed — check your email/phone and password'),
  })
}

export function useUpdateMe() {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()

  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (user) => {
      setUser(user)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Profile updated')
    },
    onError: apiError('Could not update profile'),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully')
    },
    onError: apiError('Could not change password'),
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  const { setUser, user } = useAuthStore()

  return useMutation({
    mutationFn: async (file: File) => {
      const { url } = await authApi.uploadAvatar(file)
      const updated = await authApi.updateMe({ avatar_url: url })
      return updated
    },
    onSuccess: (updated) => {
      setUser(updated)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Avatar updated')
    },
    onError: apiError('Could not upload avatar'),
    meta: { previousAvatar: user?.avatar_url },
  })
}

// ── Email verification ───────────────────────────────────────────────
export function useResendEmailVerification() {
  return useMutation({
    mutationFn: authApi.resendEmailVerification,
    onSuccess: (res) => {
      const where = res.to ? ` to ${res.to}` : ''
      toast.success(`Verification code sent${where}`)
    },
    onError: apiError('Could not send verification code'),
  })
}

export function useVerifyEmailCode() {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  return useMutation({
    mutationFn: authApi.verifyEmailCode,
    onSuccess: (user) => {
      setUser(user)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Email verified')
    },
    onError: apiError('Invalid or expired code'),
  })
}

// ── Email change ─────────────────────────────────────────────────────
export function useRequestEmailChange() {
  return useMutation({
    mutationFn: authApi.requestEmailChange,
    onSuccess: (res) => {
      const where = res.to ? ` to ${res.to}` : ''
      toast.success(`Confirmation code sent${where}`)
    },
    onError: apiError('Could not start email change'),
  })
}

export function useConfirmEmailChange() {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  return useMutation({
    mutationFn: authApi.confirmEmailChange,
    onSuccess: (user) => {
      setUser(user)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Email updated')
    },
    onError: apiError('Could not confirm new email'),
  })
}

// ── Phone OTP ────────────────────────────────────────────────────────
export function useSendPhoneOtp() {
  return useMutation({
    mutationFn: (phone?: string) => authApi.sendPhoneOtp(phone),
    onSuccess: (res) => {
      const where = res.to ? ` to ${res.to}` : ''
      toast.success(`OTP sent${where}`)
    },
    onError: apiError('Could not send OTP'),
  })
}

export function useVerifyPhoneOtp() {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  return useMutation({
    mutationFn: authApi.verifyPhoneOtp,
    onSuccess: (user) => {
      setUser(user)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Phone verified')
    },
    onError: apiError('Invalid or expired OTP'),
  })
}

export function useVendorSignup() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: VendorSignupPayload) => authApi.vendorSignup(payload),
    onSuccess: (data, variables) => {
      // Clear before navigate: Router can unmount Register before its effects run; otherwise
      // localStorage keeps the draft and /register refills fields + “Restored…” toast.
      clearVendorRegisterDraft()
      setTokens({ access_token: data.access_token, refresh_token: data.refresh_token, token_type: 'bearer' })
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      navigate('/welcome', {
        replace: true,
        state: {
          fullName: variables.full_name,
          businessCategory: variables.business_category,
          businessName: variables.business_name,
          vendorSlug: data.vendor_slug,
          verificationHint: data.verification_code_hint ?? undefined,
        },
      })
    },
    onError: apiError('Sign up failed — check your details or try another email/phone'),
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

export function useRequestAccountDeleteOtp() {
  return useMutation({
    mutationFn: (password: string) => authApi.sendAccountDeleteOtp(password),
    onError: apiError('Could not send verification code'),
  })
}

export function useDeleteAccount() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()

  return useMutation({
    mutationFn: (code: string) => authApi.deleteAccount(code),
    onSuccess: () => {
      logout()
      queryClient.clear()
      navigate('/login')
      toast.success('Your account has been deleted')
    },
    onError: apiError('Could not delete account'),
  })
}
