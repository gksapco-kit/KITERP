import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useCustomerRegister, useCustomerLogin } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { storeApi } from '@/api/store'
import { formatCustomerAuthError } from '@/lib/errorMessages'
import { extractAuthApiDetail, resetCodeWasIssued } from '@/lib/otpAuth'
import { imgUrl } from '@/lib/utils'
import {
  Loader2, Store, ShieldCheck, Check, Eye, EyeOff, MapPin, Mail, Smartphone, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStoreTheme } from './authStoreTheme'

const phoneRegex = /^\+?\d{10,15}$/

const schema = z.object({
  full_name: z.string().min(2, 'Enter your full name').max(255),
  email: z.string().optional().refine(
    (val) => !val || z.string().email().safeParse(val).success,
    'Enter a valid email',
  ),
  phone: z.string().optional().refine(
    (val) => !val || phoneRegex.test(val),
    'Enter a valid phone number (e.g. +919876543210)',
  ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, { message: "Passwords don't match", path: ['confirm_password'] })
  .refine((d) => d.email || d.phone, { message: 'Either email or phone number is required', path: ['phone'] })

type FormData = z.infer<typeof schema>
type OtpChannel = 'email' | 'phone'

export default function Register() {
  const registerMut = useCustomerRegister()
  const loginMut = useCustomerLogin()
  const { vendor, storePath } = useVendor()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const [otpOpen, setOtpOpen] = useState(false)
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('email')
  const [pending, setPending] = useState<FormData | null>(null)
  const [otp, setOtp] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpSendError, setOtpSendError] = useState<string | null>(null)
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)
  const [devHint, setDevHint] = useState<string | undefined>()
  const autoSentRef = useRef(false)

  const closeOtp = useCallback(() => {
    setOtpOpen(false)
    setPending(null)
    setOtp('')
    setOtpSendError(null)
    setOtpSentTo(null)
    setDevHint(undefined)
    autoSentRef.current = false
  }, [])

  const sendOtp = useCallback(async (channel: OtpChannel, data: FormData) => {
    setOtpSending(true)
    setOtpSendError(null)
    try {
      const payload =
        channel === 'email'
          ? { email: data.email!.trim().toLowerCase() }
          : { phone: data.phone!.trim() }
      const res = await storeApi.sendSignupOtp(payload)
      if (!resetCodeWasIssued(res)) {
        throw new Error('Could not send verification code')
      }
      setOtpSentTo(res.to || (channel === 'email' ? data.email! : data.phone!))
      setDevHint(res.dev_hint)
      toast.success(channel === 'email' ? 'Verification code sent to your email' : 'Verification code sent to your phone')
    } catch (err: unknown) {
      const msg = extractAuthApiDetail(err, 'Could not send verification code', channel)
      setOtpSendError(msg)
      toast.error(msg)
      throw err
    } finally {
      setOtpSending(false)
    }
  }, [])

  useEffect(() => {
    if (!otpOpen || !pending || autoSentRef.current) return
    autoSentRef.current = true
    void sendOtp(otpChannel, pending).catch(() => {
      autoSentRef.current = false
    })
  }, [otpOpen, pending, otpChannel, sendOtp])

  const onSubmit = (data: FormData) => {
    const emailOk = !!(data.email && z.string().email().safeParse(data.email).success)
    const phoneOk = !!(data.phone && phoneRegex.test(data.phone))
    // Prefer email OTP when both are valid (same as vendor signup).
    const channel: OtpChannel = emailOk ? 'email' : 'phone'
    if (!emailOk && !phoneOk) {
      toast.error('Provide a valid email or phone number')
      return
    }
    setOtpChannel(channel)
    setPending(data)
    setOtp('')
    setOtpSendError(null)
    setDevHint(undefined)
    autoSentRef.current = false
    setOtpOpen(true)
  }

  const completeRegister = (otpCode: string) => {
    if (!pending) return
    registerMut.mutate(
      {
        full_name: pending.full_name,
        email: pending.email || undefined,
        password: pending.password,
        phone: pending.phone || undefined,
        otp_code: otpCode,
      },
      {
        onSuccess: () => {
          const loginId = pending.email || pending.phone || ''
          closeOtp()
          loginMut.mutate(
            { login: loginId, password: pending.password },
            {
              onSuccess: () => {
                const from = (location.state as { from?: string | { pathname?: string; search?: string } } | null)?.from
                if (typeof from === 'string' && from) {
                  navigate(from, { replace: true })
                } else if (from && typeof from === 'object' && from.pathname) {
                  navigate(`${from.pathname}${from.search || ''}`, { replace: true })
                } else {
                  navigate(storePath('/'))
                }
              },
            },
          )
        },
      },
    )
  }

  const onVerifyOtp = () => {
    const code = otp.replace(/\D/g, '').slice(0, 6)
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    completeRegister(code)
  }

  const isLoading = registerMut.isPending || loginMut.isPending

  const { primary, background, linkColor, btnText, panelGradient, fontFamily } = useAuthStoreTheme()

  const locationLabel = [vendor?.city, vendor?.state].filter(Boolean).join(', ')

  return (
    <>
    <div
      className="h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4 overflow-hidden"
      style={{ backgroundColor: background, fontFamily }}
    >
      <div className="w-full max-w-4xl max-h-full rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-200 flex flex-col md:flex-row md:max-h-[min(640px,100%)]">

        {/* ── Left brand panel ── */}
        <div
          className="relative hidden md:flex flex-col items-center justify-center px-6 py-6 md:w-[38%] shrink-0 overflow-hidden"
          style={{ background: panelGradient }}
        >
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -right-12 w-64 h-64 rounded-full bg-white/8" />

          <div className="relative z-10 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl ring-2 ring-white/25">
              {vendor?.logo_url ? (
                <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="w-14 h-14 rounded-lg object-contain" />
              ) : (
                <Store className="w-8 h-8 text-white" />
              )}
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                {vendor?.display_name || 'Our Store'}
              </h1>
              {vendor?.description && (
                <p className="mt-1 text-xs text-white/70 leading-relaxed line-clamp-2 max-w-[200px]">
                  {vendor.description}
                </p>
              )}
            </div>

            {locationLabel && (
              <span className="inline-flex items-center gap-1.5 text-white/75 text-[11px] bg-white/15 px-2.5 py-1 rounded-full">
                <MapPin className="w-3 h-3 shrink-0" />
                {locationLabel}
              </span>
            )}

            <div className="flex flex-col gap-1.5 mt-1 w-full">
              {['Fast checkout', 'Order & booking tracking', 'Exclusive deals & offers', 'Secure & private'].map((b) => (
                <div key={b} className="flex items-center gap-2 text-white/70 text-[11px]">
                  <Check className="w-3 h-3 shrink-0 text-white/90" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="absolute bottom-3 text-white/50 text-[11px]">Powered by KITERP</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 bg-white px-4 py-4 sm:px-6 sm:py-5 flex flex-col justify-center min-h-0">
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-3">
              <h2 className="text-xl font-bold text-gray-900">Create account</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Join{' '}
                <span className="font-semibold text-gray-700">{vendor?.display_name || 'us'}</span>
                {' '}today — OTP verification required
              </p>
            </div>

            {(registerMut.isError || loginMut.isError) && (
              <div className="mb-2.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
                {formatCustomerAuthError(
                  registerMut.error ?? loginMut.error,
                  'Registration failed. Please try again.',
                )}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Full Name</label>
                <Input {...register('full_name')} placeholder="John Doe" className="h-9 border-gray-300" />
                {errors.full_name && <p className="text-[11px] text-red-500 mt-0.5">{errors.full_name.message}</p>}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5 space-y-2.5">
                <p className="text-[11px] text-gray-500">
                  Provide <span className="font-medium text-gray-700">email or phone</span> (at least one) — we will send an OTP
                </p>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Email <span className="text-gray-400 font-normal">optional</span>
                  </label>
                  <Input {...register('email')} type="email" placeholder="you@example.com" className="h-9 border-gray-300 bg-white" />
                  {errors.email && <p className="text-[11px] text-red-500 mt-0.5">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Phone <span className="text-gray-400 font-normal">optional</span>
                  </label>
                  <Controller name="phone" control={control} render={({ field }) => (
                    <PhoneInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      defaultCountryIso="IN"
                      size="sm"
                      showStatusHints={false}
                    />
                  )} />
                  {errors.phone && <p className="text-[11px] text-red-500 mt-0.5">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Password</label>
                  <div className="relative">
                    <Input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" className="h-9 pr-9 border-gray-300" />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[11px] text-red-500 mt-0.5">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Confirm</label>
                  <div className="relative">
                    <Input {...register('confirm_password')} type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password" className="h-9 pr-9 border-gray-300" />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {errors.confirm_password && <p className="text-[11px] text-red-500 mt-0.5">{errors.confirm_password.message}</p>}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-9 font-bold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primary, color: btnText }}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Continue — verify OTP
              </Button>
            </form>

            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] text-gray-400 font-medium">Already have an account?</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <Link to={storePath('/login')}>
              <Button variant="outline" className="w-full h-9 font-medium border-2 hover:bg-gray-50" style={{ borderColor: linkColor, color: linkColor }}>
                Sign In
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-gray-400">
              <ShieldCheck className="w-3 h-3" />
              <span>Secured by KITERP</span>
            </div>
          </div>
        </div>

      </div>
    </div>

      {otpOpen && pending ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-signup-otp-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeOtp()
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-6 sm:p-8"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeOtp}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${primary}18` }}
              >
                {otpChannel === 'phone' ? (
                  <Smartphone className="w-7 h-7" style={{ color: primary }} />
                ) : (
                  <Mail className="w-7 h-7" style={{ color: primary }} />
                )}
              </div>
              <h3 id="customer-signup-otp-title" className="text-lg font-bold text-slate-900">
                {otpChannel === 'phone' ? 'Verify your phone' : 'Verify your email'}
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-snug">
                Enter the 6-digit code we sent to{' '}
                <span className="font-semibold text-slate-800 break-all">
                  {otpSentTo || (otpChannel === 'email' ? pending.email : pending.phone)}
                </span>
              </p>
              {devHint ? (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  Dev code: <span className="font-mono font-semibold">{devHint}</span>
                </p>
              ) : null}
            </div>

            {otpSendError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {otpSendError}
              </div>
            ) : null}

            {otpSending ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-600">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: primary }} />
                Sending code…
              </div>
            ) : (
              <>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="• • • • • •"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otp.replace(/\D/g, '').length === 6) onVerifyOtp()
                  }}
                  className="h-14 text-center text-2xl font-semibold tracking-[0.35em] font-mono border-slate-200"
                  autoFocus
                />

                <div className="flex flex-col gap-2 mt-5">
                  <Button
                    type="button"
                    className="w-full h-11 font-bold"
                    style={{ backgroundColor: primary, color: btnText }}
                    disabled={isLoading || otp.replace(/\D/g, '').length !== 6}
                    onClick={onVerifyOtp}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" />Verify &amp; create account</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={otpSending}
                    onClick={() => {
                      autoSentRef.current = false
                      void sendOtp(otpChannel, pending)
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
