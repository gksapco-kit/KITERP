import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SmartLoginInput } from '@/components/ui/SmartLoginInput'
import { useCustomerLogin } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { imgUrl } from '@/lib/utils'
import { isValidEmailOrPhoneLogin } from '@/lib/loginIdentifier'
import { Loader2, Store, ShieldCheck, Eye, EyeOff, MapPin, Star, Clock } from 'lucide-react'
import { useAuthStoreTheme } from './authStoreTheme'

function customerLoginStorageKey(vendorId: string | undefined): string {
  return vendorId ? `kiterp_customer_login_${vendorId}` : ''
}

function readCustomerSavedLogin(vendorId: string | undefined): string {
  const k = customerLoginStorageKey(vendorId)
  if (!k || typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

const schema = z.object({
  login: z.string().min(3, 'Enter your email or phone number').refine(
    (val) => isValidEmailOrPhoneLogin(val),
    'Enter a valid email or phone number',
  ),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const loginMut = useCustomerLogin()
  const { vendor, storePath } = useVendor()
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [showPw, setShowPw] = useState(false)

  // Where to go after login — uses the ?from= query param or location state
  const from = (routeLocation.state as any)?.from
    ?? new URLSearchParams(routeLocation.search).get('from')
    ?? storePath('/')

  const savedForVendor = useMemo(() => readCustomerSavedLogin(vendor?.id), [vendor?.id])
  const [rememberEmail, setRememberEmail] = useState(() => !!savedForVendor)

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<{ login: string; password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { login: savedForVendor, password: '' },
  })

  useEffect(() => {
    if (vendor?.id) {
      const s = readCustomerSavedLogin(vendor.id)
      if (s) {
        setValue('login', s)
        setRememberEmail(true)
      }
    }
  }, [vendor?.id, setValue])

  const onSubmit = (data: { login: string; password: string }) => {
    loginMut.mutate(data, {
      onSuccess: () => {
        if (vendor?.id) {
          try {
            const k = customerLoginStorageKey(vendor.id)
            if (rememberEmail) localStorage.setItem(k, data.login.trim())
            else localStorage.removeItem(k)
          } catch {
            /* ignore */
          }
        }
        navigate(from)
      },
    })
  }

  // Store theme colors (Light/Dark preset from theme_config)
  const { primary, secondary, background, linkColor, btnText, panelGradient, fontFamily } = useAuthStoreTheme()

  const city = vendor?.city
  const state = vendor?.state
  const location = [city, state].filter(Boolean).join(', ')

  return (
    <div
      className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: background, fontFamily }}
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">

        {/* ── Left brand panel ── */}
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden p-10 md:w-[44%] shrink-0"
          style={{ background: panelGradient }}
        >
          {/* Layered decorative glows */}
          <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute top-1/2 -right-8 h-32 w-32 rounded-full bg-white/10" />
          {/* Subtle grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            {/* Logo */}
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white/15 shadow-2xl ring-1 ring-white/30 backdrop-blur-md">
              {vendor?.logo_url ? (
                <img
                  src={imgUrl(vendor.logo_url)}
                  alt={vendor.display_name}
                  className="h-24 w-24 rounded-2xl object-cover"
                />
              ) : (
                <Store className="h-12 w-12 text-white" />
              )}
            </div>

            {/* Store name & description */}
            <div className="flex flex-col items-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                {vendor?.display_name || 'Our Store'}
              </h1>
              <span className="mt-3 h-px w-12 rounded-full bg-white/40" />
              {vendor?.description && (
                <p className="mt-3 line-clamp-3 max-w-[230px] text-sm leading-relaxed text-white/75">
                  {vendor.description}
                </p>
              )}
            </div>

            {/* Location */}
            {location && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/20 backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {location}
              </span>
            )}

            {/* Trust badges */}
            <div className="mt-1 flex w-full max-w-[230px] flex-col gap-2">
              {[
                { icon: ShieldCheck, label: 'Secure & private login' },
                { icon: Star,        label: 'Trusted store' },
                { icon: Clock,       label: 'Fast checkout' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10 backdrop-blur-sm"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Powered by */}
          <p className="absolute bottom-4 text-xs text-white/55">Powered by KITERP</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex flex-1 flex-col justify-center bg-white px-8 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Welcome back</h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Sign in to{' '}
                <span className="font-semibold text-gray-700">
                  {vendor?.display_name || 'your account'}
                </span>
              </p>
            </div>

            {/* Error banner */}
            {loginMut.isError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                {(loginMut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                  || 'Invalid credentials. Please try again.'}
              </div>
            )}

            <form
              id="storefront-login-form"
              autoComplete="on"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
            >
              {/* Email or phone */}
              <div>
                <Controller
                  name="login"
                  control={control}
                  render={({ field }) => (
                    <SmartLoginInput
                      fieldLabel="Email or Phone"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      error={errors.login?.message as string | undefined}
                      defaultCountryIso="IN"
                      className="h-11 rounded-xl"
                      inputId="login"
                      name="login"
                      autoComplete="username"
                    />
                  )}
                />
              </div>

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                  <Link
                    to={storePath('/forgot-password')}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: linkColor }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-11 rounded-xl border-gray-300 pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message as string}</p>
                )}
              </div>

              {/* Remember me */}
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={e => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-gray-300"
                  style={{ accentColor: secondary }}
                />
                <span className="text-sm text-gray-600">Remember my email on this device</span>
              </label>

              {/* Submit */}
              <Button
                type="submit"
                className="min-h-12 w-full rounded-xl px-4 py-3 text-base font-bold shadow-lg shadow-black/5 transition-all hover:opacity-90 hover:shadow-xl active:scale-[0.99] sm:min-h-[3.25rem] sm:text-lg"
                style={{ backgroundColor: primary, color: btnText }}
                disabled={loginMut.isPending}
              >
                {loginMut.isPending && (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
                )}
                Sign In
              </Button>
            </form>

            <p className="mt-6 border-t border-gray-100 pt-5 text-center text-sm leading-relaxed text-gray-500">
              New customer?{' '}
              <Link
                to={storePath('/register')}
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: linkColor }}
              >
                Create an account
              </Link>
            </p>

            {/* Security note */}
            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Secured by KITERP</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
