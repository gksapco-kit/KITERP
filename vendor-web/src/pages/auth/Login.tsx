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
import { cn, focusRingClassName } from '@/lib/utils'
import { formatFormFieldError } from '@/lib/formFieldErrors'
import { checkBackendReachable, getBackendHealthUrl } from '@/lib/apiHealth'
import { resolveApiBaseUrl } from '@/lib/apiBase'
import { isValidEmailOrPhoneLogin } from '@/lib/loginIdentifier'
import { extractApiError, parseAmbiguousVendorLogin, parseRequires2fa, type AmbiguousVendorOption } from '@/lib/errorMessages'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE as string | undefined
const SUPPORT_CHAT_URL = import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined
/** Hyperlink color on vendor login — follows theme primary. */
const LOGIN_LINK_COLOR =
  'text-primary underline-offset-2 hover:underline hover:opacity-90'
const LOGIN_LINK_TOGGLE = cn(
  'text-primary',
  'hover:bg-primary/10 dark:hover:bg-primary/15',
)

const schema = z.object({
  login: z.string().min(3, 'Enter your email or phone number').refine(
    (val) => isValidEmailOrPhoneLogin(val),
    'Enter a valid email or phone number',
  ),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof schema>

const SAVED_LOGIN_KEY = 'kiterp_vendor_saved_login'

function getUnreachableApiMessage(): string {
  if (import.meta.env.DEV) {
    return 'Cannot sign in — the API on port 8000 is not reachable. If you just saved backend code, wait ~30s for reload, then retry. Otherwise start Docker and run: docker compose up -d postgres redis backend'
  }
  const healthUrl = getBackendHealthUrl()
  return `Cannot sign in — the API is not reachable. Open ${healthUrl} (expect {"status":"healthy"}), then on the server run: docker compose -f docker-compose.prod.yml --env-file .env.config logs backend`
}

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return import.meta.env.DEV
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

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
  /** Only scope login when the user picks a business (?vendor= / ambiguous picker). Env slug is a hint only. */
  const vendorSlugForLogin = useMemo(() => {
    return (searchParams.get('vendor') || searchParams.get('slug') || '').trim() || undefined
  }, [searchParams])

  const savedLogin = useMemo(() => readSavedLogin(), [])
  const [rememberEmail, setRememberEmail] = useState(() => !!savedLogin)
  const [ambiguousVendors, setAmbiguousVendors] = useState<AmbiguousVendorOption[] | null>(null)
  const [needs2fa, setNeeds2fa] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setTokens } = useAuthStore()

  const loginMut = useMutation({
    mutationFn: (vars: { login: string; password: string; vendorSlug?: string; totpCode?: string; persistLogin: boolean }) =>
      authApi.login(vars.login, vars.password, vars.vendorSlug, vars.totpCode),
    onSuccess: (tokens, vars) => {
      setAmbiguousVendors(null)
      setNeeds2fa(false)
      setTotpCode('')
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
      if (parseRequires2fa(err)) {
        setNeeds2fa(true)
        return
      }
      const ax = err as AxiosError
      const status = ax.response?.status
      const backendUnreachable =
        apiOk === false ||
        !ax.response ||
        status === 502 ||
        status === 503 ||
        ax.code === 'ERR_NETWORK'
      if (backendUnreachable) {
        toast.error(getUnreachableApiMessage())
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

  // Dev: backend reloads on file save (uvicorn --reload) — keep retrying instead of showing a hard error.
  useEffect(() => {
    if (!import.meta.env.DEV || apiOk !== false || checkingApi) return undefined
    const id = window.setInterval(() => runHealth(), 5000)
    return () => window.clearInterval(id)
  }, [apiOk, checkingApi])

  const showOffline = apiOk === false

  const submitLogin = (login: string, password: string, vendorSlug?: string) => {
    setAmbiguousVendors(null)
    loginMut.mutate({
      login: login.trim(),
      password,
      vendorSlug,
      totpCode: needs2fa ? totpCode.trim() : undefined,
      persistLogin: rememberEmail,
    })
  }

  const onSubmit = (data: LoginForm) => {
    submitLogin(data.login, data.password, vendorSlugForLogin)
  }

  const continueWithVendor = (slug: string) => {
    const { login, password } = getValues()
    if (!login?.trim() || !password) {
      toast.error('Enter your email and password first.')
      return
    }
    submitLogin(login, password, slug)
  }

  return (
    <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/40">
      <CardHeader className="space-y-0.5 px-5 pt-[1.2475rem] pb-[0.65625rem]">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">User Login</CardTitle>
        <p className="text-sm leading-snug text-muted-foreground">Sign in to manage your business operations</p>
      </CardHeader>

      <CardContent className="w-full space-y-[0.9975rem] px-5 pb-[1.2475rem] pt-0">
        {showOffline && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-xs text-foreground space-y-1.5 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-50"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <ServerOff className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-red-900 dark:text-red-100">API server is not reachable</p>
                <p className="text-red-800/90 dark:text-red-200/90 text-xs mt-1">
                  {isLocalDevHost()
                    ? <>The backend on port <strong>8000</strong> is down or still restarting after a code change. Wait a moment, click <em>Retry check</em>, or confirm Docker + <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded">vendor-web npm run dev</code> are running.</>
                    : <>The vendor app cannot reach the API through this site. Confirm the backend container is running, then use <em>Retry check</em>.</>}
                </p>
                {isLocalDevHost() ? (
                <ol className="list-decimal pl-4 mt-2 space-y-0.5 text-xs text-red-800/90 dark:text-red-200/90">
                  <li>
                    From the repo root, run:{' '}
                    <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">docker compose up -d postgres redis backend</code>
                  </li>
                  <li>
                    In separate terminals, run <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">npm run dev</code> in{' '}
                    <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">vendor-web</code> (and other apps as needed).
                  </li>
                  <li>
                    Open <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">http://127.0.0.1:8000/health</code> — you should
                    see <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">{`{"status":"healthy"}`}</code>.
                  </li>
                </ol>
                ) : (
                <ol className="list-decimal pl-4 mt-2 space-y-0.5 text-xs text-red-800/90 dark:text-red-200/90">
                  <li>
                    On the server:{' '}
                    <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">docker compose -f docker-compose.prod.yml --env-file .env.config ps</code>
                  </li>
                  <li>
                    Check backend logs:{' '}
                    <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">docker compose -f docker-compose.prod.yml logs backend</code>
                  </li>
                  <li>
                    API base used by this page:{' '}
                    <code className="bg-red-100/80 dark:bg-red-950/80 px-1 rounded text-foreground">{resolveApiBaseUrl()}</code>
                  </li>
                </ol>
                )}
                <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1.5 break-all">
                  Health check URL used: {getBackendHealthUrl()}
                </p>
                <button
                  type="button"
                  onClick={runHealth}
                  disabled={checkingApi}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-900 dark:text-red-100 bg-white/80 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-md px-2 py-1 hover:bg-white dark:hover:bg-red-900/70"
                >
                  {checkingApi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Retry check
                </button>
              </div>
            </div>
          </div>
        )}
        {apiOk === null && checkingApi && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Checking API… {import.meta.env.DEV ? '(up to ~30s while backend reloads)' : ''}
          </p>
        )}

        {ambiguousVendors && ambiguousVendors.length > 0 && (
          <div
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2.5 text-xs text-foreground space-y-1.5 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-50"
            role="region"
            aria-label="Choose business to sign in"
          >
            <p className="font-medium text-amber-950 dark:text-amber-100">Choose your business</p>
            <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
              This sign-in is used on more than one account. Select the business you want to open.
            </p>
            <div className="flex flex-col gap-1.5">
              {ambiguousVendors.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  disabled={loginMut.isPending}
                  onClick={() => continueWithVendor(v.slug)}
                  className="flex items-center gap-2 w-full text-left rounded-md border border-amber-400/50 dark:border-amber-600/50 bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-amber-100/80 dark:hover:bg-amber-950/50 disabled:opacity-60"
                >
                  <Store className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  <span className="text-xs font-mono text-amber-800 dark:text-amber-300 shrink-0">{v.slug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          id="vendor-login-form"
          autoComplete="on"
          onSubmit={handleSubmit(onSubmit)}
          className="w-full space-y-[0.748125rem]"
        >
          <div className="w-full space-y-1">
            <Controller
              name="login"
              control={control}
              render={({ field }) => (
                <SmartLoginInput
                  fieldLabel="Email or Phone"
                  comfortable
                  dense
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.login?.message ? formatFormFieldError(errors.login.message, 'Email or Phone') : undefined}
                  defaultCountryIso="IN"
                  inferCountryFromLocation
                  autoFocus
                  inputId="login"
                  name="login"
                  autoComplete="username"
                  hyperlinkClassName={LOGIN_LINK_TOGGLE}
                />
              )}
            />
          </div>

          <div className="w-full space-y-1">
            <div className="flex min-h-[1.745625rem] items-center justify-between gap-2">
              <Label htmlFor="password" autoHelp={false} className="text-xs font-medium text-foreground">
                Password
              </Label>
              <span className="invisible shrink-0 select-none whitespace-nowrap text-xs font-medium text-foreground" aria-hidden>
                Use phone instead
              </span>
            </div>
            <div className="relative w-full">
              <Lock
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                placeholder="Enter password"
                className="h-[calc(2.75rem*0.95*0.76*1.05)] min-h-[calc(2.75rem*0.95*0.76*1.05)] w-full rounded-md border-input pl-9 pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {needs2fa && (
            <div className="w-full space-y-1">
              <Label htmlFor="totp_code" className="text-xs font-medium text-foreground">
                Authenticator code
              </Label>
              <Input
                id="totp_code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="h-[calc(2.75rem*0.95*0.76*1.05)] min-h-[calc(2.75rem*0.95*0.76*1.05)] w-full text-xs tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Enter the code from your authenticator app.</p>
            </div>
          )}

          <Button
            type="submit"
            className="h-[calc(2.75rem*0.95*0.76*1.05)] min-h-[calc(2.75rem*0.95*0.76*1.05)] w-full rounded-md px-3 text-xs font-bold"
            disabled={loginMut.isPending || (needs2fa && totpCode.length < 6)}
          >
            {loginMut.isPending
              ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  Signing in…
                </>
              )
              : needs2fa ? 'Verify & Sign In' : 'Sign In'}
          </Button>

          <div className="flex justify-center">
            <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg pr-1">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={e => setRememberEmail(e.target.checked)}
                className="h-3.5 w-3.5 shrink-0 rounded border-input text-primary focus:ring-ring sm:h-4 sm:w-4"
              />
              <span className="text-xs leading-snug text-foreground">Remember my email on this device</span>
            </label>
          </div>
        </form>

        {/* Help accordion — before footer links so Tab reaches it after the checkbox */}
        <div className="mt-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            className={cn(
              'w-full flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors',
              focusRingClassName,
              helpOpen ? 'bg-accent' : 'hover:bg-muted/60',
            )}
            aria-expanded={helpOpen}
          >
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-left">Help &amp; Support</span>
            {helpOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {helpOpen && (
            <div className="px-3 py-2 border-t border-border bg-muted/40 space-y-1">
              {/* Forgot password shortcut */}
              <Link
                to="/forgot-password"
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                  'text-xs text-foreground hover:bg-background/80 hover:shadow-sm transition-all',
                  focusRingClassName,
                )}
              >
                <span className="text-sm">🔑</span>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">Reset my password</p>
                  <p className="text-xs text-muted-foreground">Send a reset code to your email</p>
                </div>
              </Link>

              {/* Call support */}
              {SUPPORT_PHONE ? (
                <a
                  href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                    'text-xs text-foreground hover:bg-background/80 hover:shadow-sm transition-all',
                    focusRingClassName,
                  )}
                >
                  <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">Call support</p>
                    <p className="text-xs text-muted-foreground font-mono">{SUPPORT_PHONE}</p>
                  </div>
                </a>
              ) : (
                <a
                  href="mailto:support@kiterp.com"
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                    'text-xs text-foreground hover:bg-background/80 hover:shadow-sm transition-all',
                    focusRingClassName,
                  )}
                >
                  <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">Contact support</p>
                    <p className="text-xs text-muted-foreground">support@kiterp.com</p>
                  </div>
                </a>
              )}

              {/* Chat support */}
              <a
                href={SUPPORT_CHAT_URL || 'mailto:support@kiterp.com'}
                target={SUPPORT_CHAT_URL ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                  'text-xs text-foreground hover:bg-background/80 hover:shadow-sm transition-all',
                  focusRingClassName,
                )}
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium leading-tight">Chat with us</p>
                  <p className="text-xs text-muted-foreground">
                    {SUPPORT_CHAT_URL ? 'WhatsApp / live chat' : 'support@kiterp.com'}
                  </p>
                </div>
              </a>
            </div>
          )}
        </div>

        <div className="space-y-[0.748125rem] border-t border-border pt-[0.9975rem]">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[0.8625rem] font-semibold text-muted-foreground">No account yet?</span>
            <Link
              to="/register"
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                'border border-primary/30 bg-primary/10 text-primary',
                'hover:border-primary/45 hover:bg-primary/15 hover:underline',
                'dark:border-primary/35 dark:bg-primary/15 dark:hover:bg-primary/20',
                focusRingClassName,
              )}
            >
              <Store className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Create your business
            </Link>
          </div>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className={cn(
                'inline-block rounded-md px-2 py-1 text-xs font-medium transition-colors',
                LOGIN_LINK_COLOR,
                'hover:bg-primary/10 dark:hover:bg-primary/15',
                focusRingClassName,
              )}
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
