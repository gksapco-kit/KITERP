import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SmartLoginInput } from '@/components/ui/SmartLoginInput'
import { useCustomerLogin } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { setVendorContext } from '@/api/client'
import { imgUrl, cn, focusRingClassName } from '@/lib/utils'
import { isValidEmailOrPhoneLogin } from '@/lib/loginIdentifier'
import { formatCustomerAuthError } from '@/lib/errorMessages'
import {
  Loader2, Store, ShieldCheck, Eye, EyeOff, MapPin, Star, Clock,
  AlertCircle, ChevronLeft,
} from 'lucide-react'
import { useAuthStoreTheme } from './authStoreTheme'
import { useIsCustomerLoggedIn, useHasActiveCustomerSession } from '@/hooks/useAuthHydrated'

import { safeLocalGet, safeLocalRemove, safeLocalSet } from '@/lib/safeStorage'

function customerLoginStorageKey(vendorId: string | undefined): string {
  return vendorId ? `kiterp_customer_login_${vendorId}` : ''
}

function readCustomerSavedLogin(vendorId: string | undefined): string {
  const k = customerLoginStorageKey(vendorId)
  if (!k || typeof window === 'undefined') return ''
  return safeLocalGet(k) ?? ''
}

const schema = z.object({
  login: z.string().min(3, 'Enter your email or phone number').refine(
    (val) => isValidEmailOrPhoneLogin(val),
    'Enter a valid email or phone number',
  ),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const loginMut = useCustomerLogin({ silentError: true })
  const { vendor, isLoading: vendorLoading, error: vendorError, storePath } = useVendor()
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [showPw, setShowPw] = useState(false)
  const { ready: authReady } = useIsCustomerLoggedIn()
  const { hasSession } = useHasActiveCustomerSession()
  const browseHomeRef = useRef(false)

  const from = useMemo(() => {
    const stateFrom = (routeLocation.state as { from?: unknown } | null)?.from
    const queryFrom = new URLSearchParams(routeLocation.search).get('from')
    const raw = stateFrom ?? queryFrom
    if (typeof raw === 'string' && raw.trim()) {
      const path = raw.trim()
      // Only allow same-store relative / absolute storefront paths (block open redirects).
      if (path.startsWith('/') && !path.startsWith('//')) return path
    }
    if (raw && typeof raw === 'object' && raw !== null && 'pathname' in raw) {
      const loc = raw as { pathname?: string; search?: string }
      if (typeof loc.pathname === 'string' && loc.pathname.startsWith('/')) {
        return `${loc.pathname}${loc.search || ''}`
      }
    }
    return storePath('/')
  }, [routeLocation.state, routeLocation.search, storePath])

  // Valid session — continue to the saved return URL (usually checkout).
  useEffect(() => {
    if (browseHomeRef.current) return
    if (authReady && hasSession) {
      navigate(from, { replace: true })
    }
  }, [authReady, hasSession, from, navigate])

  const savedForVendor = useMemo(() => readCustomerSavedLogin(vendor?.id), [vendor?.id])
  const [rememberEmail, setRememberEmail] = useState(() => !!savedForVendor)

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<{ login: string; password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { login: savedForVendor, password: '' },
  })

  useEffect(() => {
    if (vendor?.id && vendor.slug) {
      setVendorContext(vendor.slug, vendor.id)
    }
  }, [vendor?.id, vendor?.slug])

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
    if (vendorLoading || vendorError) return
    if (vendor?.id && vendor.slug) {
      setVendorContext(vendor.slug, vendor.id)
    }
    loginMut.mutate(data, {
      onSuccess: () => {
        if (vendor?.id) {
          const k = customerLoginStorageKey(vendor.id)
          if (rememberEmail) safeLocalSet(k, data.login.trim())
          else safeLocalRemove(k)
        }
        navigate(from)
      },
    })
  }

  const { primary, secondary, background, linkColor, btnText, panelGradient, fontFamily } = useAuthStoreTheme()

  const location = [vendor?.city, vendor?.state].filter(Boolean).join(', ')
  const authError = loginMut.isError ? formatCustomerAuthError(loginMut.error) : null
  const loginBlocked = vendorLoading || Boolean(vendorError) || !vendor?.id

  return (
    <div
      className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 sm:py-10"
      style={{ backgroundColor: background, fontFamily }}
    >
      <div className="w-full max-w-[920px] overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_24px_64px_-24px_rgba(15,23,42,0.28)] flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">

        {/* ── Left brand panel ── */}
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden px-8 py-10 md:w-[42%] shrink-0 min-h-[220px] md:min-h-0"
          style={{ background: panelGradient }}
        >
          <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-5 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/15 shadow-xl ring-1 ring-white/25 backdrop-blur-sm">
              {vendor?.logo_url ? (
                <img
                  src={imgUrl(vendor.logo_url)}
                  alt={vendor.display_name}
                  className="h-20 w-20 rounded-xl object-contain"
                />
              ) : (
                <Store className="h-10 w-10 text-white" />
              )}
            </div>

            <div className="flex flex-col items-center">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                {vendor?.display_name || 'Our Store'}
              </h1>
              {vendor?.description && (
                <p className="mt-2 line-clamp-2 max-w-[240px] text-sm leading-relaxed text-white/75">
                  {vendor.description}
                </p>
              )}
            </div>

            {location && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-medium text-white/90 ring-1 ring-white/20">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {location}
              </span>
            )}

            <div className="hidden md:flex w-full max-w-[220px] flex-col gap-1.5">
              {[
                { icon: ShieldCheck, label: 'Secure & private login' },
                { icon: Star, label: 'Trusted store' },
                { icon: Clock, label: 'Fast checkout' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/85 ring-1 ring-white/10"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="absolute bottom-3 text-[11px] text-white/50">Powered by KIT ERP</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex flex-1 flex-col bg-white px-6 py-8 sm:px-9 sm:py-9">
          <div className="mx-auto w-full max-w-[340px] flex-1 flex flex-col">
            <Link
              to={storePath('/')}
              replace
              onClick={() => { browseHomeRef.current = true }}
              className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to store
            </Link>

            <div className="mb-6">
              <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Sign in to{' '}
                <span className="font-semibold text-gray-700">
                  {vendor?.display_name || 'your account'}
                </span>
              </p>
            </div>

            {vendorError && (
              <div
                role="alert"
                className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Store unavailable</p>
                  <p className="mt-0.5 leading-snug">{vendorError}</p>
                </div>
              </div>
            )}

            {authError && (
              <div
                role="alert"
                className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">Couldn&apos;t sign in</p>
                  <p className="mt-0.5 text-red-700/90 leading-snug">{authError}</p>
                </div>
              </div>
            )}

            <form
              id="storefront-login-form"
              autoComplete="on"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-1"
              noValidate
            >
              <Controller
                name="login"
                control={control}
                render={({ field }) => (
                  <SmartLoginInput
                    fieldLabel="Email or phone"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.login?.message}
                    defaultCountryIso="IN"
                    inputId="login"
                    name="login"
                    autoComplete="username"
                  />
                )}
              />

              <div className="pt-1">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link
                    to={storePath('/forgot-password')}
                    className={cn('text-xs font-semibold transition-colors hover:underline rounded-md', focusRingClassName)}
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
                    className={`h-11 rounded-xl border-gray-300 pr-11 ${
                      errors.password ? 'border-red-400 focus-visible:ring-red-200' : ''
                    }`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 transition-colors hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className={cn(
                  'mt-1 min-h-[1.125rem] text-xs leading-snug',
                  errors.password ? 'text-red-600' : 'text-transparent',
                )}>
                  {errors.password?.message || '\u00a0'}
                </p>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={e => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-gray-300"
                  style={{ accentColor: secondary }}
                />
                <span className="text-sm text-gray-600">Remember my email on this device</span>
              </label>

              <Button
                type="submit"
                className="mt-4 min-h-12 w-full rounded-xl px-4 py-3 text-base font-bold shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-[0.99]"
                style={{ backgroundColor: primary, color: btnText }}
                disabled={loginMut.isPending || loginBlocked}
              >
                {loginMut.isPending && (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
                )}
                {vendorLoading ? 'Loading store…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              New customer?{' '}
              <Link
                to={storePath('/register')}
                state={routeLocation.state}
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: linkColor }}
              >
                Create an account
              </Link>
            </p>

            <div className="mt-auto pt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Secured by KIT ERP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
