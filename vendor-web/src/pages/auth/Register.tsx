import { useState, useRef, useEffect, useMemo, useCallback, forwardRef } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { useVendorSignup } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { HelpAccordion } from '@/components/auth/HelpAccordion'
import { VendorSignupShell } from '@/components/auth/VendorSignupShell'
import { SIGNUP_BRAND, SIGNUP_BRAND_HOVER } from '@/components/auth/signupTheme'
import {

  Loader2, Eye, EyeOff, Check, ChevronDown, Pencil, Plus, X,
  Rocket, Smartphone, LogIn, Mail,
} from 'lucide-react';

import { cn } from '@/lib/utils'
import { formatFormFieldError } from '@/lib/formFieldErrors'
import { CompanyTypeDropdown } from '@/components/common/CompanyTypeDropdown'
import { VENDOR_REGISTER_DRAFT_KEY, clearVendorRegisterDraft } from '@/lib/vendorRegisterDraft'

const DRAFT_VERSION = 1

type VendorSignupDraft = {
  v: number
  full_name: string
  business_name: string
  business_category?: string
  email: string
  phone: string
}

// ── Zod schema (OTP is collected in the modal, not on the main form) ────────

const signupSchema = z
  .object({
    full_name: z.string().min(2, 'Enter your full name'),
    business_name: z.string().min(2, 'Enter your business / brand name'),
    business_category: z.string().optional(),
    email: z.string(),
    phone: z.string(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  })
  .superRefine((d, ctx) => {
    const emailTrim = d.email.trim()
    const emailOk = emailTrim.length > 0 && z.string().email().safeParse(emailTrim).success
    const digits = d.phone.replace(/\D/g, '')
    const phoneOk = digits.length >= 10
    if (!emailOk && !phoneOk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid email or a complete phone number',
        path: ['email'],
      })
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid email or a complete phone number',
        path: ['phone'],
      })
    }
    if (emailTrim.length > 0 && !emailOk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid email address',
        path: ['email'],
      })
    }
  })

type SignupForm = z.infer<typeof signupSchema>

const EMPTY_SIGNUP_DEFAULTS: SignupForm = {
  full_name: '',
  business_name: '',
  business_category: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
}

function loadSignupDraft(): Partial<SignupForm> {
  try {
    const raw = localStorage.getItem(VENDOR_REGISTER_DRAFT_KEY)
    if (!raw) return {}
    const d = JSON.parse(raw) as VendorSignupDraft
    if (!d || d.v !== DRAFT_VERSION) return {}
    return {
      full_name: d.full_name ?? '',
      business_name: d.business_name ?? '',
      business_category: d.business_category ?? '',
      email: d.email ?? '',
      phone: d.phone ?? '',
      password: '',
      confirm_password: '',
    }
  } catch {
    return {}
  }
}

type PendingSignup = {
  full_name: string
  business_name: string
  business_category?: string
  email?: string
  phone?: string
  password: string
}

type OtpChannel = 'phone' | 'email'

// ── Simple password input (ref-forwarding for RHF) ─────────────────────────

const PwField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(({ error, className, ...props }, ref) => {
  const [show, setShow] = useState(false)
  return (
    <div>
      <div className="relative">
        <Input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={cn(
            'h-10 text-sm pr-10 focus-visible:ring-primary/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
})
PwField.displayName = 'PwField'

// ── Main page (standalone layout — not wrapped in AuthLayout) ──────────────

function maskPhoneTail(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length < 4) return phone
  return `•••• ${d.slice(-4)}`
}

export default function Register() {
  const { isAuthenticated } = useAuthStore()
  const signupMut = useVendorSignup()
  const initialDraft = useMemo(() => loadSignupDraft(), [])
  const restoredToastRef = useRef(false)
  const otpAutoSentRef = useRef(false)

  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('phone')
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null)
  const [modalOtp, setModalOtp] = useState('')
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)
  const [checkingContact, setCheckingContact] = useState(false)

  const closeOtpModal = useCallback(() => {
    setOtpModalOpen(false)
    setPendingSignup(null)
    setModalOtp('')
    setOtpSentTo(null)
    otpAutoSentRef.current = false
  }, [])

  useEscapeToClose(closeOtpModal, otpModalOpen && !!pendingSignup)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      ...EMPTY_SIGNUP_DEFAULTS,
      ...initialDraft,
    },
  })

  const persistSlice = useWatch({
    control,
    name: ['full_name', 'business_name', 'business_category', 'email', 'phone'],
  })

  useEffect(() => {
    // After signup succeeds, never write the old slice back (would resurrect the draft).
    if (signupMut.isSuccess) return
    const [full_name, business_name, business_category, email, phone] = persistSlice
    const draft: VendorSignupDraft = {
      v: DRAFT_VERSION,
      full_name: full_name ?? '',
      business_name: business_name ?? '',
      business_category: business_category ?? '',
      email: email ?? '',
      phone: phone ?? '',
    }
    localStorage.setItem(VENDOR_REGISTER_DRAFT_KEY, JSON.stringify(draft))
  }, [persistSlice, signupMut.isSuccess])

  useEffect(() => {
    if (restoredToastRef.current) return
    if (initialDraft.full_name || initialDraft.phone || initialDraft.email) {
      toast.message('Restored your saved signup details. Passwords are not stored — please re-enter them.', {
        duration: 5000,
      })
    }
    restoredToastRef.current = true
  }, [initialDraft.email, initialDraft.full_name, initialDraft.phone])

  const sendOtpMut = useMutation({
    mutationFn: async ({ channel, target }: { channel: OtpChannel; target: string }) => {
      if (channel === 'phone') {
        return authApi.vendorSignupSendPhoneOtp(target.trim())
      }
      return authApi.vendorSignupSendEmailOtp(target.trim())
    },
    onSuccess: (res, { channel, target }) => {
      const normalizedTarget = target.trim().toLowerCase()
      setOtpSentTo(
        channel === 'email'
          ? normalizedTarget
          : res.to || maskPhoneTail(target),
      )
      toast.success(
        `Verification code sent to ${channel === 'email' ? normalizedTarget : res.to || target}`,
      )
    },
    onError: (err: unknown) => {
      otpAutoSentRef.current = false
      closeOtpModal()
      const msg =
        typeof (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : 'Could not send verification code'
      toast.error(msg)
    },
  })

  useEffect(() => {
    if (!otpModalOpen) {
      otpAutoSentRef.current = false
      return
    }
    const target = otpChannel === 'phone' ? pendingSignup?.phone : pendingSignup?.email
    if (!target || otpAutoSentRef.current) return
    otpAutoSentRef.current = true
    setModalOtp('')
    sendOtpMut.mutate({ channel: otpChannel, target })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-send when modal or target changes
  }, [otpModalOpen, otpChannel, pendingSignup?.phone, pendingSignup?.email])

  useEffect(() => {
    if (!signupMut.isSuccess) return
    clearVendorRegisterDraft()
    reset(EMPTY_SIGNUP_DEFAULTS)
    closeOtpModal()
  }, [signupMut.isSuccess, closeOtpModal, reset])

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = async (data: SignupForm) => {
    const emailTrim = data.email.trim()
    const phoneTrim = data.phone.trim()
    const digits = phoneTrim.replace(/\D/g, '')
    const phoneOk = phoneTrim.startsWith('+') && digits.length >= 10 && digits.length <= 15
    const emailOk = emailTrim.length > 0 && z.string().email().safeParse(emailTrim).success

    if (phoneTrim && !phoneOk) {
      toast.error('Enter a valid mobile number with country code (e.g. +91XXXXXXXXXX)')
      return
    }

    setCheckingContact(true)
    try {
      await authApi.vendorSignupCheckContact({
        email: emailOk ? emailTrim : undefined,
        phone: phoneOk ? phoneTrim : undefined,
      })
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      let msg =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw) && raw[0] && typeof (raw[0] as { msg?: string }).msg === 'string'
            ? (raw[0] as { msg: string }).msg
            : 'This email or phone is already registered'
      if (msg === 'Email already registered') {
        msg =
          'This email is already registered. No verification code is sent. Use a different email, or ask your admin to delete the test account from Business Accounts.'
      } else if (msg === 'Phone number already registered') {
        msg =
          'This phone number is already registered. No verification code is sent. Use a different number, or ask your admin to remove the old account.'
      }
      toast.error(msg)
      return
    } finally {
      setCheckingContact(false)
    }

    if (phoneOk) {
      setOtpChannel('phone')
      setPendingSignup({
        full_name: data.full_name,
        business_name: data.business_name,
        business_category: data.business_category,
        email: emailOk ? emailTrim : undefined,
        phone: phoneTrim,
        password: data.password,
      })
      setOtpModalOpen(true)
      return
    }

    if (emailOk) {
      setOtpChannel('email')
      setPendingSignup({
        full_name: data.full_name,
        business_name: data.business_name,
        business_category: data.business_category,
        email: emailTrim,
        phone: undefined,
        password: data.password,
      })
      setOtpModalOpen(true)
      return
    }
  }

  const submitSignupWithOtp = () => {
    const otp = modalOtp.replace(/\D/g, '').slice(0, 6)
    if (!pendingSignup || otp.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    signupMut.mutate({
      full_name: pendingSignup.full_name,
      business_name: pendingSignup.business_name,
      business_category: pendingSignup.business_category,
      email: pendingSignup.email,
      phone: pendingSignup.phone,
      phone_otp: otpChannel === 'phone' ? otp : undefined,
      email_otp: otpChannel === 'email' ? otp : undefined,
      password: pendingSignup.password,
    })
  }

  const fieldLabel = 'mb-0.5 block text-xs font-medium text-slate-700'
  const fieldRow = 'grid grid-cols-1 gap-2 sm:grid-cols-2'
  const inputClass = 'h-9 text-sm'

  return (
    <>
    <VendorSignupShell homeHref="/register" signInHref="/login">
              <div className="w-full rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm md:p-4">
                <div className="mb-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">Create your business</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Fill in the details below to get started.</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
                  <div className={fieldRow}>
                    <div>
                      <label className={fieldLabel}>Business Name / Brand</label>
                      <Input {...register('business_name')} placeholder="e.g. Fresh Mart" className={inputClass} />
                      {errors.business_name && <p className="mt-0.5 text-xs text-red-500">{errors.business_name.message}</p>}
                    </div>
                    <div>
                      <label className={fieldLabel}>Business Category</label>
                      <Controller
                        control={control}
                        name="business_category"
                        render={({ field }) => (
                          <CompanyTypeDropdown
                            tone="signup"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Select category…"
                            error={errors.business_category?.message ? formatFormFieldError(errors.business_category.message, 'Business category') : undefined}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabel}>Full Name</label>
                    <Input {...register('full_name')} placeholder="Your full name" className={inputClass} />
                    {errors.full_name && <p className="mt-0.5 text-xs text-red-500">{errors.full_name.message}</p>}
                  </div>

                  <p className="text-[11px] leading-snug text-slate-500">
                    Email or phone required. Phone signups use OTP after submit.
                  </p>

                  <div className={fieldRow}>
                    <div>
                      <label className={fieldLabel}>Phone Number</label>
                      <Controller
                        control={control}
                        name="phone"
                        render={({ field }) => (
                          <PhoneInput
                            id="r-phone"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            error={errors.phone?.message ? formatFormFieldError(errors.phone.message, 'Phone') : undefined}
                            defaultCountryIso="IN"
                            inferCountryFromLocation
                            subtleFeedback
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Contact Email</label>
                      <Input
                        {...register('email')}
                        type="email"
                        placeholder="Optional if you use phone"
                        className={inputClass}
                      />
                      {errors.email && <p className="mt-0.5 text-xs text-red-500">{errors.email.message}</p>}
                    </div>
                  </div>

                  <div className={fieldRow}>
                    <div>
                      <label className={fieldLabel}>Password</label>
                      <PwField {...register('password')} placeholder="Min. 8 characters" error={errors.password?.message ? formatFormFieldError(errors.password.message, 'Password') : undefined} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Confirm Password</label>
                      <PwField
                        {...register('confirm_password')}
                        placeholder="Re-enter password"
                        error={errors.confirm_password?.message ? formatFormFieldError(errors.confirm_password.message, 'Confirm password') : undefined}
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                  <Button
                    type="submit"
                    size="lg"
                    className="h-10 w-full rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-95"
                    style={{ backgroundColor: SIGNUP_BRAND }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SIGNUP_BRAND_HOVER }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SIGNUP_BRAND }}
                    disabled={signupMut.isPending || otpModalOpen || checkingContact}
                  >
                    {checkingContact ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking…
                      </>
                    ) : signupMut.isPending && !otpModalOpen ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-4 w-4" />
                        Create your business
                      </>
                    )}
                  </Button>
                  </div>
                </form>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[0.8625rem] font-semibold text-slate-500">Already have an account?</span>
                  <Link
                    to="/login"
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                      'bg-gradient-to-r from-sky-50 to-blue-50 text-[hsl(204.42deg_94.86%_48.34%)]',
                      'border border-sky-200/60',
                      'hover:from-sky-100 hover:to-blue-100 hover:border-sky-300/80 hover:underline',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    )}
                  >
                    <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Sign in
                  </Link>
                </div>

                <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
                  By signing up, you agree to our{' '}
                  <a href="#" className="font-medium hover:underline" style={{ color: SIGNUP_BRAND }}>Terms</a>
                  {' '}and{' '}
                  <a href="#" className="font-medium hover:underline" style={{ color: SIGNUP_BRAND }}>Privacy Policy</a>.
                </p>

                <div className="mt-2 border-t border-slate-100 pt-2">
                  <HelpAccordion />
                </div>
              </div>
    </VendorSignupShell>

      {otpModalOpen && pendingSignup ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-otp-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeOtpModal()
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-6 sm:p-8"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeOtpModal}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ring-4" style={{ backgroundColor: `${SIGNUP_BRAND}18`, boxShadow: `0 0 0 4px ${SIGNUP_BRAND}1a` }}>
                {otpChannel === 'phone' ? (
                  <Smartphone className="w-7 h-7" style={{ color: SIGNUP_BRAND }} />
                ) : (
                  <Mail className="w-7 h-7" style={{ color: SIGNUP_BRAND }} />
                )}
              </div>
              <h3 id="vendor-otp-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
                {otpChannel === 'phone' ? 'Verify your phone' : 'Verify your email'}
              </h3>
              <div className="mt-2 space-y-1.5 text-sm text-slate-600 sm:text-base">
                <p>Enter the 6-digit code we sent to</p>
                <p className="font-semibold text-slate-800 break-all px-1">
                  {otpChannel === 'email'
                    ? pendingSignup.email
                    : (otpSentTo ?? maskPhoneTail(pendingSignup.phone ?? ''))}
                </p>
              </div>
            </div>

            {sendOtpMut.isPending ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-600">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: SIGNUP_BRAND }} />
                Sending code…
              </div>
            ) : (
              <>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="• • • • • •"
                  maxLength={6}
                  value={modalOtp}
                  onChange={(e) => setModalOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && modalOtp.replace(/\D/g, '').length === 6) submitSignupWithOtp()
                  }}
                  className="h-14 text-center text-2xl font-semibold tracking-[0.35em] font-mono border-slate-200 focus-visible:ring-[#64C3A0]"
                  autoFocus
                />

                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    type="button"
                    className="w-full min-h-12 rounded-xl px-4 py-3 text-lg font-bold text-white sm:min-h-14 sm:text-xl"
                    style={{ backgroundColor: SIGNUP_BRAND }}
                    disabled={signupMut.isPending || modalOtp.replace(/\D/g, '').length !== 6}
                    onClick={submitSignupWithOtp}
                  >
                    {signupMut.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin sm:h-6 sm:w-6" />
                        Creating your business…
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                        Verify &amp; create account
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full rounded-xl text-base font-semibold sm:min-h-12 sm:text-lg"
                    disabled={sendOtpMut.isPending}
                    onClick={() => {
                      const target = otpChannel === 'phone' ? pendingSignup?.phone : pendingSignup?.email
                      if (target) sendOtpMut.mutate({ channel: otpChannel, target })
                    }}
                  >
                    Resend code
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
