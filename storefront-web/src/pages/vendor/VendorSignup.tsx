import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { VendorSignupShell } from '@/components/auth/VendorSignupShell'
import { SIGNUP_BRAND, SIGNUP_BRAND_HOVER } from '@/components/auth/signupTheme'
import { Loader2, Rocket, Eye, EyeOff, Check, Smartphone, Mail, X } from 'lucide-react'
import axios from 'axios'
import { buildVendorWelcomeUrl, vendorAppUrl } from '@/lib/appUrls'
import { extractAuthApiDetail } from '@/lib/otpAuth'
import { VENDOR_SIGNUP_PATH, VENDOR_VERIFY_EMAIL_PATH } from '@/lib/vendorSignupPaths'

// Same-origin `/api/v1` in dev (Vite proxies to backend); set `VITE_API_URL` if the API is elsewhere.
const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

const STOREFRONT_VENDOR_SIGNUP_DRAFT_KEY = 'kiterp:storefront-vendor-signup-draft'
const DRAFT_VERSION = 1

// Curated subset of business categories (full list is editable later in Settings).
const BUSINESS_CATEGORIES: { group: string; options: { value: string; label: string }[] }[] = [
  {
    group: 'Retail & Shop',
    options: [
      { value: 'shop', label: 'Shop' },
      { value: 'store', label: 'Store' },
      { value: 'supermarket', label: 'Supermarket' },
      { value: 'jewellery_store', label: 'Jewellery Store' },
      { value: 'electronics_store', label: 'Electronics Store' },
      { value: 'clothing_store', label: 'Clothing / Apparel' },
      { value: 'beauty_store', label: 'Beauty & Cosmetics' },
      { value: 'hardware_store', label: 'Hardware Store' },
    ],
  },
  {
    group: 'Food & Hospitality',
    options: [
      { value: 'restaurant', label: 'Restaurant' },
      { value: 'cafe', label: 'Café / Coffee Shop' },
      { value: 'bakery', label: 'Bakery' },
      { value: 'fast_food', label: 'Fast Food Outlet' },
      { value: 'cloud_kitchen', label: 'Cloud Kitchen' },
      { value: 'hotel', label: 'Hotel' },
      { value: 'guest_house', label: 'Guest House / Inn' },
    ],
  },
  {
    group: 'Health & Wellness',
    options: [
      { value: 'hospital', label: 'Hospital' },
      { value: 'clinic', label: 'Clinic' },
      { value: 'dental_clinic', label: 'Dental Clinic' },
      { value: 'pharmacy', label: 'Pharmacy' },
      { value: 'diagnostic_lab', label: 'Diagnostic Lab' },
      { value: 'gym', label: 'Gym / Fitness Center' },
      { value: 'salon', label: 'Salon / Beauty Parlour' },
      { value: 'spa', label: 'Spa / Wellness Center' },
    ],
  },
  {
    group: 'Business & Services',
    options: [
      { value: 'company', label: 'Company' },
      { value: 'office', label: 'Office' },
      { value: 'it_software', label: 'IT / Software' },
      { value: 'consulting', label: 'Consulting Firm' },
      { value: 'warehouse', label: 'Warehouse' },
      { value: 'factory', label: 'Factory / Manufacturing' },
      { value: 'logistics', label: 'Logistics / Delivery' },
      { value: 'real_estate', label: 'Real Estate' },
      { value: 'travel_agency', label: 'Travel Agency' },
      { value: 'event_management', label: 'Event Management' },
      { value: 'photography_studio', label: 'Photography Studio' },
    ],
  },
  {
    group: 'Education & Finance',
    options: [
      { value: 'school', label: 'School' },
      { value: 'college', label: 'College / Institute' },
      { value: 'coaching', label: 'Coaching Center' },
      { value: 'bank', label: 'Bank / Financial Service' },
      { value: 'accounting', label: 'Accounting / CA Firm' },
      { value: 'law_firm', label: 'Law Firm' },
    ],
  },
  {
    group: 'Other',
    options: [
      { value: 'automotive', label: 'Automotive Service / Garage' },
      { value: 'car_showroom', label: 'Car Showroom' },
      { value: 'individual', label: 'Individual / Freelancer' },
      { value: 'other', label: 'Other' },
    ],
  },
]

const schema = z
  .object({
    full_name: z.string().min(2, 'Enter your full name').max(255),
    business_name: z.string().min(2, 'Enter your business/brand name').max(255),
    business_category: z.string().min(1, 'Pick a business category'),
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

type FormData = z.infer<typeof schema>

type VendorSignupDraft = {
  v: number
  full_name: string
  business_name: string
  business_category: string
  email: string
  phone: string
}

function loadSignupDraft(): Partial<FormData> {
  try {
    const raw = localStorage.getItem(STOREFRONT_VENDOR_SIGNUP_DRAFT_KEY)
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

function maskPhoneTail(phone: string): string {
  const dig = phone.replace(/\D/g, '')
  if (dig.length < 4) return phone
  return `•••• ${dig.slice(-4)}`
}

type PendingSignup = {
  full_name: string
  business_name: string
  business_category: string
  email?: string
  phone?: string
  password: string
}

type OtpChannel = 'phone' | 'email'

export default function VendorSignup() {
  const navigate = useNavigate()
  const initialDraft = useMemo(() => loadSignupDraft(), [])
  const restoredToastRef = useRef(false)
  const otpAutoSentRef = useRef(false)

  const [loading, setLoading] = useState(false)
  const [checkingContact, setCheckingContact] = useState(false)
  const [modalOtpSending, setModalOtpSending] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('phone')
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null)
  const [modalOtp, setModalOtp] = useState('')
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)
  const [otpSendError, setOtpSendError] = useState<string | null>(null)

  const closeOtpModal = useCallback(() => {
    setOtpModalOpen(false)
    setPendingSignup(null)
    setModalOtp('')
    setOtpSentTo(null)
    setOtpSendError(null)
    otpAutoSentRef.current = false
  }, [])

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      business_name: '',
      business_category: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      ...initialDraft,
    },
  })

  const persistSlice = useWatch({
    control,
    name: ['full_name', 'business_name', 'business_category', 'email', 'phone'],
  })

  useEffect(() => {
    const [full_name, business_name, business_category, email, phone] = persistSlice
    const draft: VendorSignupDraft = {
      v: DRAFT_VERSION,
      full_name: full_name ?? '',
      business_name: business_name ?? '',
      business_category: business_category ?? '',
      email: email ?? '',
      phone: phone ?? '',
    }
    localStorage.setItem(STOREFRONT_VENDOR_SIGNUP_DRAFT_KEY, JSON.stringify(draft))
  }, [persistSlice])

  useEffect(() => {
    if (restoredToastRef.current) return
    if (initialDraft.full_name || initialDraft.phone || initialDraft.email) {
      toast.message('Restored your saved signup details. Passwords are not stored — please re-enter them.', {
        duration: 5000,
      })
    }
    restoredToastRef.current = true
  }, [initialDraft.email, initialDraft.full_name, initialDraft.phone])

  const sendOtp = async (channel: OtpChannel, target: string) => {
    if (channel === 'phone') {
      const res = await axios.post(`${API_URL}/auth/vendor-signup/send-phone-otp`, { phone: target.trim() })
      const d = res.data as { to?: string; dev_hint?: string }
      setOtpSentTo(d.to || maskPhoneTail(target))
      if (d.dev_hint) {
        setModalOtp(d.dev_hint)
        toast.message(`Dev mode: your code is ${d.dev_hint}`, { duration: 12_000 })
      } else {
        toast.success(`Verification code sent${d.to ? ` to ${d.to}` : ''}`)
      }
      return
    }
    const email = target.trim().toLowerCase()
    const res = await axios.post(`${API_URL}/auth/vendor-signup/send-email-otp`, { email })
    const d = res.data as { to?: string; dev_hint?: string }
    setOtpSentTo(email)
    if (d.dev_hint) {
      setModalOtp(d.dev_hint)
      toast.message(`Dev mode: your code is ${d.dev_hint}`, { duration: 12_000 })
    } else {
      toast.success(`Verification code sent to ${email}`)
    }
  }

  useEffect(() => {
    if (!otpModalOpen) {
      otpAutoSentRef.current = false
      return
    }
    const target = otpChannel === 'phone' ? pendingSignup?.phone : pendingSignup?.email
    if (!target || otpAutoSentRef.current) return
    otpAutoSentRef.current = true
    setModalOtp('')
    setOtpSendError(null)
    ;(async () => {
      setModalOtpSending(true)
      try {
        await sendOtp(otpChannel, target)
      } catch (err: unknown) {
        otpAutoSentRef.current = false
        const msg = extractAuthApiDetail(err, 'Could not send verification code', otpChannel)
        setOtpSendError(msg)
        toast.error(msg)
      } finally {
        setModalOtpSending(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpModalOpen, otpChannel, pendingSignup?.phone, pendingSignup?.email])

  const completeSignup = async (payload: {
    full_name: string
    business_name: string
    business_category: string
    email?: string
    phone?: string
    phone_otp?: string
    email_otp?: string
    password: string
  }) => {
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/auth/vendor-signup`, payload)

      const emailTrim = (payload.email || '').trim()
      const emailOk = emailTrim.length > 0 && z.string().email().safeParse(emailTrim).success

      const result = res.data as {
        access_token: string
        refresh_token?: string
        vendor_slug: string
        vendor_id: string
        verification_code_hint?: string | null
      }

      localStorage.removeItem(STOREFRONT_VENDOR_SIGNUP_DRAFT_KEY)
      closeOtpModal()

      if (emailOk && result.verification_code_hint) {
        navigate(VENDOR_VERIFY_EMAIL_PATH, {
          state: {
            email: emailTrim,
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            vendor_slug: result.vendor_slug,
            vendor_id: result.vendor_id,
            verification_code_hint: result.verification_code_hint,
          },
        })
      } else {
        window.location.href = buildVendorWelcomeUrl({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          vendor_slug: result.vendor_slug,
          business_name: payload.business_name,
          full_name: payload.full_name,
          business_category: payload.business_category,
        })
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(typeof err.response.data.detail === 'string' ? err.response.data.detail : 'Registration failed — check your details')
      } else {
        setError('Could not connect to the server — please check your internet connection and try again')
      }
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
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
    setError('')
    try {
      await axios.post(`${API_URL}/auth/vendor-signup/check-contact`, {
        email: emailOk ? emailTrim : undefined,
        phone: phoneOk ? phoneTrim : undefined,
      })
    } catch (err: unknown) {
      let msg = extractAuthApiDetail(err, 'This email or phone is already registered')
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

    // Prefer email OTP when both are valid (SendGrid on prod; SMS needs Twilio).
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

    if (phoneOk) {
      setOtpChannel('phone')
      setPendingSignup({
        full_name: data.full_name,
        business_name: data.business_name,
        business_category: data.business_category,
        email: undefined,
        phone: phoneTrim,
        password: data.password,
      })
      setOtpModalOpen(true)
      return
    }
  }

  const submitWithOtp = async () => {
    const otp = modalOtp.replace(/\D/g, '').slice(0, 6)
    if (!pendingSignup || otp.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    await completeSignup({
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

  const resendOtp = async () => {
    const target = otpChannel === 'phone' ? pendingSignup?.phone : pendingSignup?.email
    if (!target) return
    setModalOtpSending(true)
    setOtpSendError(null)
    otpAutoSentRef.current = false
    try {
      await sendOtp(otpChannel, target)
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : 'Could not send OTP'
      setOtpSendError(msg)
      toast.error(msg)
    } finally {
      setModalOtpSending(false)
    }
  }

  const fieldLabel = 'mb-0.5 block text-xs font-medium text-slate-700'
  const fieldRow = 'grid grid-cols-1 gap-2 sm:grid-cols-2'
  const inputClass = 'h-9 text-sm'

  return (
    <>
    <VendorSignupShell signInHref={`${vendorAppUrl}/login`}>
              <div className="w-full rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm md:p-4">
                <div className="mb-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">Create your business</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Fill in the details below to get started.</p>
                </div>

                {error && (
                  <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
                  {/* Row 1 — Business Name + Business Category */}
                  <div className={fieldRow}>
                    <div>
                      <label className={fieldLabel}>
                        Business Name / Brand
                      </label>
                      <Input
                        {...register('business_name')}
                        placeholder="e.g. Fresh Mart"
                        className={inputClass}
                      />
                      {errors.business_name && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.business_name.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={fieldLabel}>
                        Business Category
                      </label>
                      <select
                        {...register('business_category')}
                        defaultValue=""
                        className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#64C3A0] focus:border-[#64C3A0]"
                      >
                        <option value="" disabled>Select category…</option>
                        {BUSINESS_CATEGORIES.map((g) => (
                          <optgroup key={g.group} label={g.group}>
                            {g.options.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {errors.business_category && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.business_category.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2 — Full Name (alone) */}
                  <div>
                    <label className={fieldLabel}>Full Name</label>
                    <Input
                      {...register('full_name')}
                      placeholder="Your full name"
                      className={inputClass}
                    />
                    {errors.full_name && (
                      <p className="text-xs text-red-500 mt-0.5">{errors.full_name.message}</p>
                    )}
                  </div>

                  <p className="text-[11px] leading-snug text-slate-500">
                    Email or phone required. We send a 6-digit code to your email (or SMS if email is omitted).
                  </p>
                  {/* Row 3 — Phone + Email */}
                  <div className={fieldRow}>
                    <div>
                      <label className={fieldLabel}>Phone Number</label>
                      <Controller
                        control={control}
                        name="phone"
                        render={({ field }) => (
                          <PhoneInput
                            id="phone"
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.phone?.message}
                            defaultCountryIso="IN"
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
                      {errors.email && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 4 — Password + Confirm Password */}
                  <div className={fieldRow}>
                    <div>
                      <label className={fieldLabel}>Password</label>
                      <div className="relative">
                        <Input
                          {...register('password')}
                          type={showPw ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          className={`${inputClass} pr-9`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.password.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={fieldLabel}>Confirm Password</label>
                      <Input
                        {...register('confirm_password')}
                        type="password"
                        placeholder="Re-enter password"
                        className={inputClass}
                      />
                      {errors.confirm_password && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.confirm_password.message}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-10 w-full rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-95"
                    style={{ backgroundColor: SIGNUP_BRAND }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SIGNUP_BRAND_HOVER }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SIGNUP_BRAND }}
                    disabled={loading || otpModalOpen || checkingContact}
                  >
                    {checkingContact ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking…
                      </>
                    ) : loading && !otpModalOpen ? (
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
                </form>

                <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
    </VendorSignupShell>

      {otpModalOpen && pendingSignup ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sf-vendor-otp-title"
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
              <h3 id="sf-vendor-otp-title" className="text-lg font-bold text-slate-900">
                {otpChannel === 'phone' ? 'Verify your phone' : 'Verify your email'}
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-snug">
                Enter the 6-digit code we sent to{' '}
                <span className="font-semibold text-slate-800 break-all">
                  {otpChannel === 'email'
                    ? pendingSignup.email
                    : (otpSentTo ?? maskPhoneTail(pendingSignup.phone ?? ''))}
                </span>
              </p>
            </div>

            {otpSendError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {otpSendError}
              </div>
            ) : null}

            {modalOtpSending ? (
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
                    if (e.key === 'Enter' && modalOtp.replace(/\D/g, '').length === 6) void submitWithOtp()
                  }}
                  className="h-14 text-center text-2xl font-semibold tracking-[0.35em] font-mono border-slate-200 focus-visible:ring-[#64C3A0]"
                  autoFocus
                />

                <div className="flex flex-col gap-2 mt-5">
                  <Button
                    type="button"
                    className="w-full h-11 font-bold text-white"
                    style={{ backgroundColor: SIGNUP_BRAND }}
                    disabled={loading || modalOtp.replace(/\D/g, '').length !== 6}
                    onClick={() => void submitWithOtp()}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating your business…</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" />Verify &amp; create account</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={modalOtpSending}
                    onClick={() => void resendOtp()}
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
