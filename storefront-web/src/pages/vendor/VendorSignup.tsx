import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Store, Loader2, ShieldCheck, Rocket, Users, BarChart3, Eye, EyeOff, Check, Smartphone, X } from 'lucide-react'
import axios from 'axios'
import { vendorAppUrl } from '@/lib/appUrls'

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

type PendingPhoneSignup = {
  full_name: string
  business_name: string
  business_category: string
  email?: string
  phone: string
  password: string
}

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
  const [pendingPhoneSignup, setPendingPhoneSignup] = useState<PendingPhoneSignup | null>(null)
  const [modalOtp, setModalOtp] = useState('')
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)

  const closeOtpModal = useCallback(() => {
    setOtpModalOpen(false)
    setPendingPhoneSignup(null)
    setModalOtp('')
    setOtpSentTo(null)
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

  const sendOtpToPhone = async (phone: string) => {
    const res = await axios.post(`${API_URL}/auth/vendor-signup/send-phone-otp`, { phone: phone.trim() })
    const d = res.data as { to?: string; dev_hint?: string }
    setOtpSentTo(d.to || maskPhoneTail(phone))
    toast.success(`OTP sent${d.to ? ` to ${d.to}` : ''}`)
    if (d.dev_hint) toast.message(`Dev OTP: ${d.dev_hint}`, { duration: 12_000 })
  }

  useEffect(() => {
    if (!otpModalOpen) {
      otpAutoSentRef.current = false
      return
    }
    if (!pendingPhoneSignup?.phone || otpAutoSentRef.current) return
    otpAutoSentRef.current = true
    setModalOtp('')
    ;(async () => {
      setModalOtpSending(true)
      try {
        await sendOtpToPhone(pendingPhoneSignup.phone)
      } catch (err: unknown) {
        otpAutoSentRef.current = false
        const msg =
          axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string'
            ? err.response.data.detail
            : 'Could not send OTP'
        toast.error(msg)
      } finally {
        setModalOtpSending(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpModalOpen, pendingPhoneSignup?.phone])

  const completeSignup = async (payload: {
    full_name: string
    business_name: string
    business_category: string
    email?: string
    phone?: string
    phone_otp?: string
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
        navigate('/vendor/verify-email', {
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
        const url = new URL(vendorAppUrl)
        url.searchParams.set('token', result.access_token)
        if (result.refresh_token) url.searchParams.set('refresh', result.refresh_token)
        window.location.href = url.toString()
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
    const digits = data.phone.replace(/\D/g, '')
    const phoneOk = digits.length >= 10
    const emailOk = emailTrim.length > 0 && z.string().email().safeParse(emailTrim).success

    setCheckingContact(true)
    setError('')
    try {
      await axios.post(`${API_URL}/auth/vendor-signup/check-contact`, {
        email: emailOk ? emailTrim : undefined,
        phone: phoneOk ? data.phone.trim() : undefined,
      })
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : 'This email or phone is already registered'
      toast.error(msg)
      return
    } finally {
      setCheckingContact(false)
    }

    if (phoneOk) {
      setPendingPhoneSignup({
        full_name: data.full_name,
        business_name: data.business_name,
        business_category: data.business_category,
        email: emailOk ? emailTrim : undefined,
        phone: data.phone.trim(),
        password: data.password,
      })
      setOtpModalOpen(true)
      return
    }

    await completeSignup({
      full_name: data.full_name,
      business_name: data.business_name,
      business_category: data.business_category,
      email: emailOk ? emailTrim : undefined,
      password: data.password,
    })
  }

  const submitPhoneWithOtp = async () => {
    const otp = modalOtp.replace(/\D/g, '').slice(0, 6)
    if (!pendingPhoneSignup || otp.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    await completeSignup({
      full_name: pendingPhoneSignup.full_name,
      business_name: pendingPhoneSignup.business_name,
      business_category: pendingPhoneSignup.business_category,
      email: pendingPhoneSignup.email,
      phone: pendingPhoneSignup.phone,
      phone_otp: otp,
      password: pendingPhoneSignup.password,
    })
  }

  const resendOtp = async () => {
    if (!pendingPhoneSignup?.phone) return
    setModalOtpSending(true)
    try {
      await sendOtpToPhone(pendingPhoneSignup.phone)
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : 'Could not send OTP'
      toast.error(msg)
    } finally {
      setModalOtpSending(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-base text-gray-900">KITERP</span>
          </a>
          <a href={`${vendorAppUrl}/login`} className="text-sm text-gray-500 hover:text-gray-700">
            Already a vendor? <span className="text-blue-600 font-medium">Sign in</span>
          </a>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-6xl mx-auto px-4 py-4 sm:py-6">
          <div className="grid h-full lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-10 items-stretch">
            {/* Left — Benefits (compact, hidden on small screens) */}
            <div className="hidden lg:flex flex-col justify-center pr-2">
              <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 leading-tight">
                Start selling online<br />
                <span className="text-blue-600">in minutes</span>
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Create your branded store, manage products & services, accept orders, and grow your business.
              </p>

              <div className="space-y-3 mt-5">
                {[
                  { icon: Rocket, title: 'Quick Setup', desc: 'Live in under 5 minutes.' },
                  { icon: Users, title: 'Customer Portal', desc: 'Logins, orders & bookings.' },
                  { icon: BarChart3, title: 'Full Dashboard', desc: 'Orders, inventory, POS, reports.' },
                  { icon: ShieldCheck, title: 'Secure & Trusted', desc: 'SSL & payments built-in.' },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <f.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{f.title}</h3>
                      <p className="text-xs text-gray-500 leading-snug">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="flex items-center gap-1.5 mt-6 text-xs text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Secured by KITERP
              </p>
            </div>

            {/* Right — Signup Form (no internal scroll) */}
            <div className="h-full flex items-center justify-center min-h-0">
              <div className="w-full bg-white rounded-2xl border shadow-xl p-5 sm:p-6 max-h-full">
                <div className="text-center mb-3 lg:hidden">
                  <Store className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                </div>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Create your Business</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Fill in the details below to get started
                  </p>
                </div>

                {error && (
                  <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  {/* Row 1 — Business Name + Business Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">
                        Business Name / Brand
                      </label>
                      <Input
                        {...register('business_name')}
                        placeholder="e.g. Fresh Mart"
                        className="h-10"
                      />
                      {errors.business_name && (
                        <p className="text-[11px] text-red-500 mt-0.5">{errors.business_name.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">
                        Business Category
                      </label>
                      <select
                        {...register('business_category')}
                        defaultValue=""
                        className="w-full h-10 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <p className="text-[11px] text-red-500 mt-0.5">{errors.business_category.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2 — Full Name (alone) */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Full Name</label>
                    <Input
                      {...register('full_name')}
                      placeholder="Your full name"
                      className="h-10"
                    />
                    {errors.full_name && (
                      <p className="text-[11px] text-red-500 mt-0.5">{errors.full_name.message}</p>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-500">
                    Provide <strong className="font-medium text-gray-700">either</strong> email <strong className="font-medium text-gray-700">or</strong> phone. After Create My Business, phone sign-ups open a secure popup for your OTP.
                  </p>
                  {/* Row 3 — Phone + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Phone Number</label>
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
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Contact Email</label>
                      <Input
                        {...register('email')}
                        type="email"
                        placeholder="Optional if you use phone"
                        className="h-10"
                      />
                      {errors.email && (
                        <p className="text-[11px] text-red-500 mt-0.5">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 4 — Password + Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Password</label>
                      <div className="relative">
                        <Input
                          {...register('password')}
                          type={showPw ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          className="h-10 pr-9"
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
                        <p className="text-[11px] text-red-500 mt-0.5">{errors.password.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Confirm Password</label>
                      <Input
                        {...register('confirm_password')}
                        type="password"
                        placeholder="Re-enter password"
                        className="h-10"
                      />
                      {errors.confirm_password && (
                        <p className="text-[11px] text-red-500 mt-0.5">{errors.confirm_password.message}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90 mt-1"
                    disabled={loading || otpModalOpen || checkingContact}
                  >
                    {checkingContact ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : loading && !otpModalOpen ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4 mr-2" />
                    )}
                    {checkingContact ? 'Checking…' : 'Create My Business'}
                  </Button>
                </form>

                <p className="text-[11px] text-gray-400 text-center mt-3">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {otpModalOpen && pendingPhoneSignup ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px]"
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
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3 ring-4 ring-blue-500/10">
                <Smartphone className="w-7 h-7 text-blue-600" />
              </div>
              <h3 id="sf-vendor-otp-title" className="text-lg font-bold text-slate-900">
                Verify your phone
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-snug">
                Enter the 6-digit code we sent to{' '}
                <span className="font-semibold text-slate-800">{otpSentTo ?? maskPhoneTail(pendingPhoneSignup.phone)}</span>
              </p>
            </div>

            {modalOtpSending ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-600">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
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
                    if (e.key === 'Enter' && modalOtp.replace(/\D/g, '').length === 6) void submitPhoneWithOtp()
                  }}
                  className="h-14 text-center text-2xl font-semibold tracking-[0.35em] font-mono border-slate-200 focus-visible:ring-blue-500"
                  autoFocus
                />

                <div className="flex flex-col gap-2 mt-5">
                  <Button
                    type="button"
                    className="w-full h-11 font-bold bg-primary hover:bg-primary/90"
                    disabled={loading || modalOtp.replace(/\D/g, '').length !== 6}
                    onClick={() => void submitPhoneWithOtp()}
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
    </div>
  )
}
