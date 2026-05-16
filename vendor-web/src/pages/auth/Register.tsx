import { useState, useRef, useEffect, useMemo, useCallback, forwardRef } from 'react'
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
import {
  Loader2, Eye, EyeOff, Store, Check, ChevronDown, Pencil, Plus, X,
  Rocket, Users, BarChart3, ShieldCheck, Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMPANY_TYPES, COMPANY_TYPE_GROUPS } from '@/data/companyTypes'
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

type PendingPhoneSignup = {
  full_name: string
  business_name: string
  business_category?: string
  email?: string
  phone: string
  password: string
}

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
          className={cn('h-11 min-h-11 text-base pr-10', className)}
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

// ── Business-type dropdown ─────────────────────────────────────────────────

function TypeDropdown({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (v: string) => { onChange(v); setShowCustom(false); setOpen(false) }
  const addCustom = () => {
    const v = customInput.trim()
    if (!v) return
    onChange(v)
    setShowCustom(false)
    setOpen(false)
  }

  const preset = COMPANY_TYPES.find((t) => t.value === value)
  const Icon = preset?.icon

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-11 min-h-11 w-full items-center gap-2.5 rounded-lg border bg-white px-3 text-base transition-all',
          open ? 'border-primary/60 ring-1 ring-primary/25' : 'border-gray-200 hover:border-gray-300',
          error ? 'border-red-400' : '',
        )}
      >
        {Icon ? (
          <>
            <span className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center shrink-0">
              <Icon className="w-3 h-3 text-blue-600" />
            </span>
            <span className="flex-1 text-left font-medium text-gray-800">{preset!.label}</span>
          </>
        ) : value ? (
          <>
            <span className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center shrink-0">
              <Pencil className="w-3 h-3 text-gray-500" />
            </span>
            <span className="flex-1 text-left font-medium text-gray-800">
              {value} <span className="text-xs text-gray-400">(custom)</span>
            </span>
          </>
        ) : (
            <span className="flex-1 text-left text-gray-400 text-sm sm:text-base">Select category…</span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {COMPANY_TYPE_GROUPS.map((group) => (
            <div key={group}>
              <p className="px-4 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 sticky top-0">
                {group}
              </p>
              {COMPANY_TYPES.filter((t) => t.group === group).map(({ value: v, label, icon: ItemIcon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => select(v)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-1.5 text-left hover:bg-blue-50 transition-colors',
                    value === v && 'bg-blue-50',
                  )}
                >
                  <span className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                    value === v ? 'bg-primary' : 'bg-gray-100',
                  )}>
                    <ItemIcon className={cn('w-3 h-3', value === v ? 'text-white' : 'text-gray-500')} />
                  </span>
                  <span className={cn('flex-1 text-sm', value === v ? 'font-semibold text-blue-700' : 'text-gray-700')}>
                    {label}
                  </span>
                  {value === v && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-100">
            {!showCustom ? (
              <button
                type="button"
                onClick={() => { setShowCustom(true); setCustomInput('') }}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 text-gray-500" />
                </span>
                <span className="text-sm text-gray-500 font-medium">+ Add custom type…</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2">
                <Input
                  autoFocus
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                  placeholder="e.g. Co-working, Lab, Studio…"
                  className="flex-1 h-8 text-sm"
                />
                <Button type="button" size="sm" className="h-8 px-3 shrink-0" onClick={addCustom}>Add</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Feature bullet list ────────────────────────────────────────────────────

const FEATURES = [
  { icon: Rocket,      title: 'Quick Setup',        desc: 'Live in under 5 minutes.' },
  { icon: Users,       title: 'Customer Portal',    desc: 'Logins, orders & bookings.' },
  { icon: BarChart3,   title: 'Full Dashboard',     desc: 'Orders, inventory, POS, reports.' },
  { icon: ShieldCheck, title: 'Secure & Trusted',   desc: 'SSL & payments built-in.' },
]

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
  const [pendingPhoneSignup, setPendingPhoneSignup] = useState<PendingPhoneSignup | null>(null)
  const [modalOtp, setModalOtp] = useState('')
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)
  const [checkingContact, setCheckingContact] = useState(false)

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

  const sendPhoneOtpMut = useMutation({
    mutationFn: (phone: string) => authApi.vendorSignupSendPhoneOtp(phone.trim()),
    onSuccess: (res, phone) => {
      const p = typeof phone === 'string' ? phone : ''
      setOtpSentTo(res.to || maskPhoneTail(p))
      toast.success(`OTP sent${res.to ? ` to ${res.to}` : ''}`)
      if (res.dev_hint) toast.message(`Dev OTP: ${res.dev_hint}`, { duration: 12_000 })
    },
    onError: (err: unknown) => {
      const msg =
        typeof (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : 'Could not send OTP'
      toast.error(msg)
    },
  })

  useEffect(() => {
    if (!otpModalOpen) {
      otpAutoSentRef.current = false
      return
    }
    if (!pendingPhoneSignup?.phone || otpAutoSentRef.current) return
    otpAutoSentRef.current = true
    setModalOtp('')
    sendPhoneOtpMut.mutate(pendingPhoneSignup.phone)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-send when modal or target phone changes
  }, [otpModalOpen, pendingPhoneSignup?.phone])

  useEffect(() => {
    if (!signupMut.isSuccess) return
    clearVendorRegisterDraft()
    reset(EMPTY_SIGNUP_DEFAULTS)
    closeOtpModal()
  }, [signupMut.isSuccess, closeOtpModal, reset])

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = async (data: SignupForm) => {
    const emailTrim = data.email.trim()
    const digits = data.phone.replace(/\D/g, '')
    const phoneOk = digits.length >= 10
    const emailOk = emailTrim.length > 0 && z.string().email().safeParse(emailTrim).success

    setCheckingContact(true)
    try {
      await authApi.vendorSignupCheckContact({
        email: emailOk ? emailTrim : undefined,
        phone: phoneOk ? data.phone.trim() : undefined,
      })
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw) && raw[0] && typeof (raw[0] as { msg?: string }).msg === 'string'
            ? (raw[0] as { msg: string }).msg
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

    signupMut.mutate({
      full_name: data.full_name,
      business_name: data.business_name,
      business_category: data.business_category,
      email: emailOk ? emailTrim : undefined,
      phone: undefined,
      password: data.password,
    })
  }

  const submitPhoneSignupWithOtp = () => {
    const otp = modalOtp.replace(/\D/g, '').slice(0, 6)
    if (!pendingPhoneSignup || otp.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    signupMut.mutate({
      full_name: pendingPhoneSignup.full_name,
      business_name: pendingPhoneSignup.business_name,
      business_category: pendingPhoneSignup.business_category,
      email: pendingPhoneSignup.email,
      phone: pendingPhoneSignup.phone,
      phone_otp: otp,
      password: pendingPhoneSignup.password,
    })
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex flex-col">
      {/* Top nav bar */}
      <header className="bg-white border-b shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-base text-gray-900">KITERP</span>
          </div>
          <p className="text-sm text-gray-500">
            Already a vendor?{' '}
            <Link to="/login" className="-mx-0.5 rounded-md px-1 py-2 font-semibold text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-6xl mx-auto px-4 py-4 sm:py-6">
          <div className="grid h-full lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-10 items-stretch">

            {/* Left — marketing panel */}
            <div className="hidden lg:flex flex-col justify-center pr-2">
              <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 leading-tight">
                Start selling online<br />
                <span className="text-blue-600">in minutes</span>
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Create your branded store, manage products &amp; services, accept orders, and grow your business.
              </p>

              <div className="space-y-3 mt-5">
                {FEATURES.map((f) => (
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

            {/* Right — form card */}
            <div className="flex h-full min-h-0 flex-col lg:justify-center">
              <div className="shrink-0 px-1 pb-3 pt-1 text-center lg:hidden">
                <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-[1.65rem]">
                  Start selling online{' '}
                  <span className="text-blue-600">in minutes</span>
                </h1>
                <p className="mt-1.5 text-sm leading-snug text-gray-600">
                  Create your branded store, manage products &amp; services, accept orders, and grow your business.
                </p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col lg:flex-none">
                <div className="max-h-full w-full flex-1 overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl sm:p-8 lg:flex-none">
                {/* Mobile logo */}
                <div className="mb-2 text-center lg:hidden">
                  <Store className="mx-auto mb-1 h-9 w-9 text-blue-600" />
                </div>

                <div className="mb-5">
                  <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Create your business</h2>
                  <p className="mt-1 text-sm text-gray-600">Fill in the details below to get started</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Row 1 — Business Name + Business Category */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Business Name / Brand</label>
                      <Input
                        {...register('business_name')}
                        placeholder="e.g. Fresh Mart"
                        className="h-11 min-h-11 text-base"
                      />
                      {errors.business_name && <p className="mt-1 text-xs text-red-500">{errors.business_name.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Business Category</label>
                      <Controller
                        control={control}
                        name="business_category"
                        render={({ field }) => (
                          <TypeDropdown
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            error={errors.business_category?.message}
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* Row 2 — Full Name */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Full Name</label>
                    <Input
                      {...register('full_name')}
                      placeholder="Your full name"
                      className="h-11 min-h-11 text-base"
                    />
                    {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>}
                  </div>

                  {/* Row 3 — Phone + Email (at least one required; phone needs OTP) */}
                  <p className="-mt-1 text-sm leading-snug text-gray-600">
                    Provide <strong className="font-medium text-gray-800">either</strong> a contact email <strong className="font-medium text-gray-800">or</strong> a mobile number. After you click Create your business, we will ask for a phone OTP in a secure popup.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone Number</label>
                      <Controller
                        control={control}
                        name="phone"
                        render={({ field }) => (
                          <PhoneInput
                            id="r-phone"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            error={errors.phone?.message}
                            defaultCountryIso="IN"
                            inferCountryFromLocation
                            comfortable
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Contact Email</label>
                      <Input
                        {...register('email')}
                        type="email"
                        placeholder="Optional if you use phone"
                        className="h-11 min-h-11 text-base"
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                    </div>
                  </div>

                  {/* Row 4 — Password + Confirm */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                      <PwField
                        {...register('password')}
                        placeholder="Min. 8 characters"
                        error={errors.password?.message}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm Password</label>
                      <PwField
                        {...register('confirm_password')}
                        placeholder="Re-enter password"
                        error={errors.confirm_password?.message}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 w-full min-h-12 rounded-xl bg-primary px-4 py-3 text-lg font-bold hover:bg-primary/90 sm:min-h-14 sm:px-6 sm:py-3.5 sm:text-xl"
                    disabled={signupMut.isPending || otpModalOpen || checkingContact}
                  >
                    {checkingContact ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin sm:h-6 sm:w-6" />
                        Checking…
                      </>
                    ) : signupMut.isPending && !otpModalOpen ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin sm:h-6 sm:w-6" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                        Create your business
                      </>
                    )}
                  </Button>
                </form>

                <p className="mt-4 text-center text-xs text-gray-500 sm:text-sm">
                  By signing up, you agree to our{' '}
                  <a href="#" className="underline hover:text-gray-700">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="underline hover:text-gray-700">Privacy Policy</a>.
                </p>

                <div className="mt-5">
                  <HelpAccordion />
                </div>
                </div>
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
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3 ring-4 ring-blue-500/10">
                <Smartphone className="w-7 h-7 text-blue-600" />
              </div>
              <h3 id="vendor-otp-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
                Verify your phone
              </h3>
              <p className="mt-2 text-sm leading-snug text-slate-600 sm:text-base">
                Enter the 6-digit code we sent to{' '}
                <span className="font-semibold text-slate-800">{otpSentTo ?? maskPhoneTail(pendingPhoneSignup.phone)}</span>
              </p>
            </div>

            {sendPhoneOtpMut.isPending ? (
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
                    if (e.key === 'Enter' && modalOtp.replace(/\D/g, '').length === 6) submitPhoneSignupWithOtp()
                  }}
                  className="h-14 text-center text-2xl font-semibold tracking-[0.35em] font-mono border-slate-200 focus-visible:ring-blue-500"
                  autoFocus
                />

                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    type="button"
                    className="w-full min-h-12 rounded-xl bg-primary px-4 py-3 text-lg font-bold hover:bg-primary/90 sm:min-h-14 sm:text-xl"
                    disabled={signupMut.isPending || modalOtp.replace(/\D/g, '').length !== 6}
                    onClick={submitPhoneSignupWithOtp}
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
                    disabled={sendPhoneOtpMut.isPending}
                    onClick={() => pendingPhoneSignup && sendPhoneOtpMut.mutate(pendingPhoneSignup.phone)}
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
