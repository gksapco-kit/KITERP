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
          'flex h-10 min-h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm transition-all',
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

  const fieldLabel = 'mb-1 block text-sm font-medium text-slate-700'
  const fieldRow = 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3'
  const inputClass = 'h-10 text-sm'

  return (
    <div className="vendor-register flex min-h-dvh min-h-screen w-full flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/register" className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-base font-semibold text-slate-900">KITERP</span>
          </Link>
          <p className="text-xs text-slate-600 sm:text-sm">
            Already a vendor?{' '}
            <Link to="/login" className="font-semibold text-[hsl(204.42deg_94.86%_48.34%)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:py-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:gap-8 md:items-start">

            {/* Marketing — tablet/desktop only */}
            <aside className="hidden md:block md:sticky md:top-4">
              <h1 className="text-xl font-bold leading-tight text-slate-900 lg:text-2xl">
                Start selling online{' '}
                <span className="text-[hsl(204.42deg_94.86%_48.34%)]">in minutes</span>
              </h1>
              <p className="mt-2 text-sm leading-snug text-slate-600">
                Branded store, orders, inventory, and reports — one dashboard.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <f.icon className="h-4 w-4 text-primary" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{f.title}</span>
                      <span className="block text-xs text-slate-500">{f.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                Secured by KITERP
              </p>
            </aside>

            {/* Signup form */}
            <section className="w-full min-w-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md sm:p-5">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Create your business</h2>
                  <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Fill in the details below to get started.</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
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
                          <TypeDropdown
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            error={errors.business_category?.message}
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

                  <p className="text-xs leading-snug text-slate-500">
                    Email <span className="text-slate-400">or</span> phone required. Phone signups use OTP after submit.
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
                            error={errors.phone?.message}
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
                      <PwField {...register('password')} placeholder="Min. 8 characters" error={errors.password?.message} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Confirm Password</label>
                      <PwField
                        {...register('confirm_password')}
                        placeholder="Re-enter password"
                        error={errors.confirm_password?.message}
                      />
                    </div>
                  </div>

                  <div className="pt-3">
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 w-full rounded-lg border-0 text-base font-semibold text-white shadow-sm hover:opacity-95"
                    style={{ backgroundColor: '#64c3a0' }}
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

                <p className="mt-3 text-center text-[11px] text-slate-500 sm:text-xs">
                  By signing up, you agree to our{' '}
                  <a href="#" className="text-[hsl(204.42deg_94.86%_48.34%)] hover:underline">Terms</a>
                  {' '}and{' '}
                  <a href="#" className="text-[hsl(204.42deg_94.86%_48.34%)] hover:underline">Privacy Policy</a>.
                </p>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <HelpAccordion />
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

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
