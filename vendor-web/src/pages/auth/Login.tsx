import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { authKeys } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SmartLoginInput } from '@/components/ui/SmartLoginInput'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2, Eye, EyeOff, Lock, Phone, MessageCircle, HelpCircle, ChevronDown, ChevronUp, ServerOff, RefreshCw, Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { checkBackendReachable, getBackendHealthUrl } from '@/lib/apiHealth'
import { isValidEmailOrPhoneLogin } from '@/lib/loginIdentifier'
import { extractApiError, parseAmbiguousVendorLogin, type AmbiguousVendorOption } from '@/lib/errorMessages'
import { toast } from 'sonner'

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE as string | undefined
const SUPPORT_CHAT_URL = import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined
/** Localhost vendor-web: same email on multiple businesses — must match backend VENDOR_LOGIN_DEFAULT_SLUG or ?vendor= */
const ENV_VENDOR_LOGIN_SLUG = (import.meta.env.VITE_VENDOR_LOGIN_SLUG as string | undefined)?.trim()

const schema = z.object({
  login: z.string().min(3, 'Enter your email or phone number').refine(
    (val) => isValidEmailOrPhoneLogin(val),
    'Enter a valid email or phone number',
  ),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof schema>

const SAVED_LOGIN_KEY = 'kiterp_vendor_saved_login'

function readSavedLogin(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(SAVED_LOGIN_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const vendorSlugForLogin = useMemo(() => {
    const q = (searchParams.get('vendor') || searchParams.get('slug') || '').trim()
    return q || ENV_VENDOR_LOGIN_SLUG || undefined
  }, [searchParams])

  const savedLogin = useMemo(() => readSavedLogin(), [])
  const [rememberEmail, setRememberEmail] = useState(() => !!savedLogin)
  const [ambiguousVendors, setAmbiguousVendors] = useState<AmbiguousVendorOption[] | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setTokens } = useAuthStore()

  const loginMut = useMutation({
    mutationFn: (vars: { login: string; password: string; vendorSlug?: string; persistLogin: boolean }) =>
      authApi.login(vars.login, vars.password, vars.vendorSlug),
    onSuccess: (tokens, vars) => {
      setAmbiguousVendors(null)
      setTokens(tokens)
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
      toast.success('Login successful!')
      try {
        if (vars.persistLogin) localStorage.setItem(SAVED_LOGIN_KEY, vars.login.trim())
        else localStorage.removeItem(SAVED_LOGIN_KEY)
      } catch {
        /* ignore quota / private mode */
      }
      if (vars.vendorSlug && typeof window !== 'undefined') {
        try {
          const u = new URL(window.location.href)
          u.searchParams.set('vendor', vars.vendorSlug)
          window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
        } catch {
          /* ignore */
        }
      }
      navigate('/')
    },
    onError: (err) => {
      const amb = parseAmbiguousVendorLogin(err)
      if (amb) {
        setAmbiguousVendors(amb.vendors)
        return
      }
      toast.error(extractApiError(err, 'Login failed — check your email/phone and password'))
    },
  })

  const { register, control, handleSubmit, getValues, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { login: savedLogin, password: '' },
    shouldUnregister: false,
  })
  const [showPw, setShowPw] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [checkingApi, setCheckingApi] = useState(false)

  const runHealth = () => {
    setCheckingApi(true)
    setApiOk(null)
    void checkBackendReachable().then((ok) => {
      setApiOk(ok)
      setCheckingApi(false)
    })
  }

  useEffect(() => {
    runHealth()
  }, [])

  const showOffline = apiOk === false

  const onSubmit = (data: LoginForm) => {
    setAmbiguousVendors(null)
    const loginTrim = data.login.trim()
    loginMut.mutate({
      login: loginTrim,
      password: data.password,
      vendorSlug: vendorSlugForLogin,
      persistLogin: rememberEmail,
    })
  }

  const continueWithVendor = (slug: string) => {
    const { login, password } = getValues()
    if (!login?.trim() || !password) {
      toast.error('Enter your email and password first.')
      return
    }
    loginMut.mutate({
      login: login.trim(),
      password,
      vendorSlug: slug,
      persistLogin: rememberEmail,
    })
  }

  return (
    <Card className="w-full shadow-lg shadow-gray-200/50">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">User Login</CardTitle>
        <p className="text-base leading-snug text-gray-600">Sign in to manage your business operations</p>
      </CardHeader>

      <CardContent className="w-full space-y-5">
        {showOffline && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 space-y-2"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <ServerOff className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">API server is not reachable</p>
                <p className="text-red-800/90 text-xs mt-1">
                  The vendor app cannot talk to the backend. Start the API (port <strong>8000</strong>), then
                  use <em>Retry check</em> or refresh the page.
                </p>
                <ol className="list-decimal pl-4 mt-2 space-y-0.5 text-xs text-red-800/90">
                  <li>
                    From the repo root, run:{' '}
                    <code className="bg-red-100/80 px-1 rounded">docker compose up -d postgres redis backend</code>
                  </li>
                  <li>
                    Or run <code className="bg-red-100/80 px-1 rounded">.\start-dev.ps1</code> to start backend + this UI.
                  </li>
                  <li>
                    Open <code className="bg-red-100/80 px-1 rounded">http://localhost:8000/health</code> — you should
                    see <code className="bg-red-100/80 px-1 rounded">{`{"status":"healthy"}`}</code>.
                  </li>
                </ol>
                <p className="text-[10px] text-red-700/80 mt-1.5 break-all">
                  Health check URL used: {getBackendHealthUrl()}
                </p>
                <button
                  type="button"
                  onClick={runHealth}
                  disabled={checkingApi}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-900 bg-white/80 border border-red-200 rounded-md px-2 py-1 hover:bg-white"
                >
                  {checkingApi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Retry check
                </button>
              </div>
            </div>
          </div>
        )}
        {apiOk === null && checkingApi && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking API…
          </p>
        )}

        {ambiguousVendors && ambiguousVendors.length > 0 && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-2"
            role="region"
            aria-label="Choose business to sign in"
          >
            <p className="font-medium text-amber-900">Choose your business</p>
            <p className="text-xs text-amber-800/90">
              This sign-in is used on more than one account. Select the business you want to open.
            </p>
            <div className="flex flex-col gap-1.5">
              {ambiguousVendors.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  disabled={loginMut.isPending}
                  onClick={() => continueWithVendor(v.slug)}
                  className="flex items-center gap-2 w-full text-left rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100/80 disabled:opacity-60"
                >
                  <Store className="w-4 h-4 shrink-0 text-amber-700" />
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  <span className="text-[10px] font-mono text-amber-700 shrink-0">{v.slug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          id="vendor-login-form"
          autoComplete="on"
          onSubmit={handleSubmit(onSubmit)}
          className="w-full space-y-4"
        >
          <div className="w-full space-y-2">
            <Controller
              name="login"
              control={control}
              render={({ field }) => (
                <SmartLoginInput
                  fieldLabel="Email or Phone"
                  comfortable
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.login?.message}
                  defaultCountryIso="IN"
                  inferCountryFromLocation
                  autoFocus
                  inputId="login"
                  name="login"
                  autoComplete="username"
                />
              )}
            />
          </div>

          <div className="w-full space-y-2">
            <div className="flex min-h-8 items-center justify-between gap-2">
              <Label htmlFor="password" className="text-[0.95rem] font-semibold text-gray-800">
                Password
              </Label>
              <span className="invisible shrink-0 select-none whitespace-nowrap text-[0.95rem] font-semibold" aria-hidden>
                Use phone instead
              </span>
            </div>
            <div className="relative w-full">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                placeholder="Enter password"
                className="h-[calc(2.75rem*0.95)] min-h-[calc(2.75rem*0.95)] w-full rounded-md border-input pl-10 pr-10 text-[0.95rem]"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            className="h-[calc(2.75rem*0.95)] min-h-[calc(2.75rem*0.95)] w-full rounded-md px-4 text-[0.95rem] font-bold"
            disabled={loginMut.isPending}
          >
            {loginMut.isPending
              ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                  Signing in…
                </>
              )
              : 'Sign In'}
          </Button>

          <div className="flex justify-center pt-1">
            <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg py-1 pr-1">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={e => setRememberEmail(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary sm:h-[1.125rem] sm:w-[1.125rem]"
              />
              <span className="text-[0.95rem] leading-snug text-gray-700">Remember my email on this device</span>
            </label>
          </div>
        </form>

        <div className="space-y-4 border-t border-gray-100 pt-5">
          <p className="text-center text-sm leading-relaxed text-gray-500">
            New vendor?{' '}
            <Link
              to="/register"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Create your business
            </Link>
          </p>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="inline-block rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Help accordion */}
        <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            className={cn(
              'w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 transition-colors',
              helpOpen ? 'bg-accent' : 'hover:bg-gray-50',
            )}
          >
            <HelpCircle className="w-4 h-4 text-primary/80 shrink-0" />
            <span className="flex-1 text-left">Help &amp; Support</span>
            {helpOpen
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {helpOpen && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-2">
              {/* Forgot password shortcut */}
              <Link
                to="/forgot-password"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  'text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all',
                )}
              >
                <span className="text-base">🔑</span>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">Reset my password</p>
                  <p className="text-[11px] text-gray-500">Send a reset code to your email</p>
                </div>
              </Link>

              {/* Call support */}
              {SUPPORT_PHONE ? (
                <a
                  href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    'text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all',
                  )}
                >
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">Call support</p>
                    <p className="text-[11px] text-gray-500 font-mono">{SUPPORT_PHONE}</p>
                  </div>
                </a>
              ) : (
                <a
                  href="mailto:support@kiterp.com"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    'text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all',
                  )}
                >
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">Contact support</p>
                    <p className="text-[11px] text-gray-500">support@kiterp.com</p>
                  </div>
                </a>
              )}

              {/* Chat support */}
              <a
                href={SUPPORT_CHAT_URL || 'mailto:support@kiterp.com'}
                target={SUPPORT_CHAT_URL ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  'text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all',
                )}
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium leading-tight">Chat with us</p>
                  <p className="text-[11px] text-gray-500">
                    {SUPPORT_CHAT_URL ? 'WhatsApp / live chat' : 'support@kiterp.com'}
                  </p>
                </div>
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
