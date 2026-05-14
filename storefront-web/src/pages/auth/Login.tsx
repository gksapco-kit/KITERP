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

  // Pull primary colour from vendor theme_config, fall back to indigo
  const themeConfig = vendor?.theme_config as Record<string, unknown> | undefined
  const styleConfig = themeConfig?.style as Record<string, unknown> | undefined
  const primaryColor: string = (styleConfig?.primary_color as string) || '#4F46E5'

  const city = vendor?.city
  const state = vendor?.state
  const location = [city, state].filter(Boolean).join(', ')

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col md:flex-row">

        {/* ── Left brand panel ── */}
        <div
          className="relative flex flex-col items-center justify-center p-10 md:w-[42%] shrink-0 overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${primaryColor}99 100%)`,
          }}
        >
          {/* Background decorative circles */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -right-12 w-72 h-72 rounded-full bg-white/8" />
          <div className="absolute top-1/2 -right-8 w-32 h-32 rounded-full bg-white/5" />

          <div className="relative z-10 flex flex-col items-center text-center gap-5">
            {/* Logo */}
            <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl ring-4 ring-white/25">
              {vendor?.logo_url ? (
                <img
                  src={imgUrl(vendor.logo_url)}
                  alt={vendor.display_name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
              ) : (
                <Store className="w-11 h-11 text-white" />
              )}
            </div>

            {/* Store name & description */}
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {vendor?.display_name || 'Our Store'}
              </h1>
              {vendor?.description && (
                <p className="mt-2 text-sm text-white/70 leading-relaxed line-clamp-3 max-w-[220px]">
                  {vendor.description}
                </p>
              )}
            </div>

            {/* Location */}
            {location && (
              <span className="inline-flex items-center gap-1.5 text-white/75 text-xs bg-white/15 px-3 py-1.5 rounded-full">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {location}
              </span>
            )}

            {/* Trust badges */}
            <div className="flex flex-col gap-2 mt-1 w-full">
              {[
                { icon: ShieldCheck, label: 'Secure & private login' },
                { icon: Star,        label: 'Trusted store' },
                { icon: Clock,       label: 'Fast checkout' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-white/65 text-xs">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Powered by */}
          <p className="absolute bottom-4 text-white/35 text-[11px]">Powered by KITERP</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex flex-col justify-center bg-white px-8 py-10">
          <div className="w-full max-w-sm mx-auto">
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-sm text-gray-500 mt-1">
                Sign in to{' '}
                <span className="font-semibold text-gray-700">
                  {vendor?.display_name || 'your account'}
                </span>
              </p>
            </div>

            {/* Error banner */}
            {loginMut.isError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-800">
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
                      className="h-11"
                      inputId="login"
                      name="login"
                      autoComplete="username"
                    />
                  )}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-11 pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message as string}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="min-h-12 w-full rounded-xl px-4 py-3 text-lg font-bold text-white transition-opacity hover:opacity-90 sm:min-h-14 sm:px-6 sm:py-3.5 sm:text-xl"
                style={{ backgroundColor: primaryColor }}
                disabled={loginMut.isPending}
              >
                {loginMut.isPending && (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin sm:h-6 sm:w-6" />
                )}
                Sign In
              </Button>

              <div className="flex justify-center">
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={e => setRememberEmail(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-gray-300"
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="text-sm text-gray-600">Remember my email on this device</span>
                </label>
              </div>
            </form>

            <p className="mt-5 border-t border-gray-100 pt-5 text-center text-sm leading-relaxed text-gray-500">
              New customer?{' '}
              <Link
                to={storePath('/register')}
                className="font-semibold hover:underline underline-offset-2"
                style={{ color: primaryColor }}
              >
                Create an account
              </Link>
            </p>

            <p className="mt-3 text-center">
              <Link
                to={storePath('/forgot-password')}
                className="text-xs font-medium hover:underline transition-colors"
                style={{ color: primaryColor }}
              >
                Forgot password?
              </Link>
            </p>

            {/* Security note */}
            <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secured by KITERP</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
