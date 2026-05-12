import { useEffect, useMemo, Fragment } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Store, ArrowRight, Mail, Check } from 'lucide-react'
import { COMPANY_TYPES } from '@/data/companyTypes'
import { cn } from '@/lib/utils'

export type SignupWelcomeState = {
  fullName?: string
  businessCategory?: string
  businessName?: string
  vendorSlug?: string
  verificationHint?: string
  /** Number of launch checklist steps already finished (1–4). Defaults to 1 (account) after signup. */
  launchStepsComplete?: number
  /** Billing / subscription label shown on the roadmap card (e.g. Starter). */
  planName?: string
  /** From vendor profile when known — picks catalog "Next" link (`/products` vs `/services`). */
  offeringType?: 'products' | 'services' | 'both'
}

type LaunchStep = {
  id: string
  label: string
  description: string
  nextHref: string
}

const LAUNCH_STEPS: LaunchStep[] = [
  {
    id: 'account',
    label: 'Account',
    description: 'Vendor login, business profile, and verification on KITERP.',
    nextHref: '/storefront-builder',
  },
  {
    id: 'storefront',
    label: 'Storefront',
    description: 'Template, branding, and pages for your public store URL.',
    nextHref: '/storefront-builder',
  },
  {
    id: 'catalog',
    label: 'Catalog',
    description: 'Products, services, and categories so checkout and POS can sell.',
    nextHref: '/products',
  },
  {
    id: 'go-live',
    label: 'Go live',
    description: 'Notifications, locations, and sharing your live store with customers.',
    nextHref: '/',
  },
]

const TOTAL_STEPS = LAUNCH_STEPS.length

function catalogHref(offering?: SignupWelcomeState['offeringType']): string {
  if (offering === 'services') return '/services'
  if (offering === 'products' || offering === 'both' || !offering) return '/products'
  return '/products'
}

function stepsWithCatalogHref(offering?: SignupWelcomeState['offeringType']): LaunchStep[] {
  const cat = catalogHref(offering)
  return LAUNCH_STEPS.map((s, i) => (i === 2 ? { ...s, nextHref: cat } : s))
}

function stripEmoji(s: string): string {
  return s.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim()
}

function displayBusinessCategory(raw?: string): string {
  const t = raw?.trim()
  if (!t) return 'business'
  const preset = COMPANY_TYPES.find((c) => c.value === t)
  if (preset) return stripEmoji(preset.label)
  return t
}

function firstNameFromFull(full?: string): string {
  const t = full?.trim()
  if (!t) return 'there'
  const w = t.split(/\s+/)[0]
  return w || 'there'
}

function clampComplete(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 1
  return Math.min(TOTAL_STEPS, Math.max(1, v))
}

function topStatusBadge(complete: number): string {
  if (complete >= 4) return 'STORE LIVE'
  if (complete >= 3) return 'CATALOG READY'
  if (complete >= 2) return 'STOREFRONT READY'
  return 'ACCOUNT READY'
}

function segmentTone(segmentIndex: number, complete: number): 'done' | 'active' | 'pending' {
  if (segmentIndex < complete - 1) return 'done'
  if (segmentIndex === complete - 1) return 'active'
  return 'pending'
}

function nextHrefForActiveStep(complete: number, steps: LaunchStep[]): string {
  if (complete < 1 || complete > TOTAL_STEPS) return '/'
  const activeIndex = complete
  return steps[activeIndex]?.nextHref ?? '/'
}

function tourHref(offering?: SignupWelcomeState['offeringType']): string {
  return catalogHref(offering)
}

function TopConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + (i % 7) * 13) % 100}%`,
        top: `${4 + (i * 11) % 28}%`,
        delay: (i % 12) * 80,
        duration: 2.8 + (i % 5) * 0.35,
        w: i % 3 === 0 ? 6 : 5,
        h: i % 2 === 0 ? 8 : 7,
        rotate: (i * 41) % 180,
        color: ['bg-sky-500', 'bg-amber-400', 'bg-emerald-500', 'bg-rose-500', 'bg-violet-500', 'bg-blue-600'][i % 6],
      })),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-90" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={cn('absolute rounded-[1px] shadow-sm animate-pulse', p.color)}
          style={{
            left: p.left,
            top: p.top,
            width: p.w,
            height: p.h,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

/** Compact email verification — top-right header (fits one viewport, no page scroll). */
function HeaderEmailVerify({ hint }: { hint: string }) {
  return (
    <div className="flex max-w-[58%] flex-col items-end gap-0.5 text-right sm:max-w-[50%]">
      <div className="flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 shrink-0 text-blue-600 sm:h-4 sm:w-4" aria-hidden />
        <p className="text-[11px] font-semibold leading-tight text-blue-900 sm:text-xs">Verify your email</p>
      </div>
      <p className="hidden text-[9px] leading-snug text-blue-800/85 sm:block">Dev / inbox code:</p>
      <p className="font-mono text-sm font-bold leading-none tracking-widest text-blue-950 sm:text-base">{hint}</p>
    </div>
  )
}

export default function SignupWelcome() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as SignupWelcomeState

  const steps = useMemo(() => stepsWithCatalogHref(state.offeringType), [state.offeringType])

  useEffect(() => {
    if (!state?.businessName && !state?.vendorSlug) {
      navigate('/', { replace: true })
    }
  }, [state?.businessName, state?.vendorSlug, navigate])

  if (!state?.businessName && !state?.vendorSlug) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting…
      </div>
    )
  }

  const businessDisplay = state.businessName?.trim() || state.vendorSlug || 'your business'
  const greetName = firstNameFromFull(state.fullName)
  const categoryLabel = displayBusinessCategory(state.businessCategory)
  const displayGreet = greetName === 'there' ? 'there' : greetName
  const complete = clampComplete(state.launchStepsComplete)
  const planLabel = (state.planName || 'Starter').trim() || 'Starter'
  const badge = topStatusBadge(complete)
  const nextHref = nextHrefForActiveStep(complete, steps)

  return (
    <div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#f0f4f4] text-slate-800"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgb(148 163 184 / 0.12) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(148 163 184 / 0.12) 1px, transparent 1px)
        `,
        backgroundSize: '44px 44px',
      }}
    >
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-[14rem] w-[min(90vw,36rem)] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-[80px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[12rem] w-[min(70vw,24rem)] rounded-full bg-sky-400/15 blur-[70px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-12 top-1/4 h-[12rem] w-[16rem] rounded-full bg-amber-300/18 blur-[72px]"
        aria-hidden
      />

      {/* App bar — KIT ERP left; verify email top-right when present */}
      <header className="relative z-20 flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/90 px-3 backdrop-blur-md sm:h-12 sm:px-5">
        <span className="text-sm font-bold tracking-tight text-slate-900 sm:text-[15px]">KIT ERP</span>
        {state.verificationHint ? (
          <HeaderEmailVerify hint={state.verificationHint} />
        ) : (
          <span className="w-px shrink-0" aria-hidden />
        )}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <TopConfetti />

        <div className="signup-welcome-pop relative z-10 mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 py-2 text-center sm:px-5">
          <div className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-white/90 bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-sm sm:px-3 sm:text-[11px]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="truncate">{badge}</span>
          </div>

          <h1
            className="mt-1.5 max-w-[22ch] shrink-0 font-serif text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:mt-2 sm:text-[1.65rem]"
            style={{ fontFamily: "'Fraunces', ui-serif, Georgia, serif" }}
          >
            Welcome,{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 bg-clip-text text-transparent">
              {displayGreet}
            </span>
            .
          </h1>

          <p className="mt-1 max-w-md shrink-0 px-1 text-[13px] leading-snug text-slate-600 sm:text-sm">
            Your {categoryLabel.toLowerCase()}{' '}
            <span className="font-bold text-slate-900">{businessDisplay}</span> is live and ready for its first
            customer.
          </p>

          <div className="mt-2 flex w-full max-w-md shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.3)] sm:mt-3 sm:rounded-2xl sm:p-4">
            <div className="flex shrink-0 items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 shadow-sm sm:h-10 sm:w-10 sm:rounded-xl">
                  <Store className="h-4 w-4 text-white sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-slate-900 sm:text-base">{businessDisplay}</span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80 sm:text-[10px]">
                      <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3} aria-hidden />
                      LIVE
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px]">
                    {categoryLabel} · Owned by {displayGreet === 'there' ? 'you' : displayGreet}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Plan</p>
                <p className="text-xs font-bold text-slate-900 sm:text-sm">{planLabel}</p>
              </div>
            </div>

            <div className="mt-2 flex shrink-0 items-center justify-between border-t border-slate-100 pt-2 sm:mt-3 sm:pt-2.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Launch roadmap
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-800/90">
                {complete} of {TOTAL_STEPS} complete
              </span>
            </div>

            <div className="mt-1.5 sm:mt-2">
              <div className="flex items-start justify-center">
                {steps.map((step, i) => {
                  const done = i < complete
                  const current = i === complete && complete < TOTAL_STEPS
                  const doneEmerald = done && i !== 1
                  const doneAmber = done && i === 1

                  return (
                    <Fragment key={step.id}>
                      {i > 0 && (
                        <div
                          className={cn(
                            'mt-[0.9rem] h-0.5 min-w-0 flex-1 sm:mt-[1.15rem]',
                            segmentTone(i - 1, complete) === 'done' && 'bg-emerald-500',
                            segmentTone(i - 1, complete) === 'active' && 'bg-amber-500',
                            segmentTone(i - 1, complete) === 'pending' && 'bg-slate-200',
                          )}
                          aria-hidden
                        />
                      )}
                      <div className="flex w-[4.1rem] shrink-0 flex-col items-center sm:w-[4.85rem]">
                        <div
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold sm:h-9 sm:w-9 sm:text-xs',
                            doneEmerald &&
                              'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/25',
                            doneAmber &&
                              'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm ring-2 ring-amber-400/35',
                            current &&
                              'border-2 border-red-500/90 bg-white text-red-600 shadow-[0_0_0_3px_rgba(248,113,113,0.2)]',
                            !done && !current && 'border border-slate-200 bg-slate-50 text-slate-400',
                          )}
                        >
                          {done ? <Check className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={2.5} /> : i + 1}
                        </div>
                        <span
                          className={cn(
                            'mt-1 text-center text-[8px] font-semibold uppercase leading-tight tracking-tight sm:text-[9px]',
                            done && i === 1 && 'text-amber-900',
                            done && i !== 1 && 'text-emerald-800',
                            current && 'text-red-700',
                            !done && !current && 'text-slate-400',
                          )}
                        >
                          {step.label}
                        </span>
                        <p
                          className={cn(
                            'mt-0.5 line-clamp-3 max-w-full px-0.5 text-center text-[6.5px] font-normal normal-case leading-[1.25] text-slate-500 sm:text-[7.5px]',
                            current && 'text-slate-600',
                          )}
                        >
                          {step.description}
                        </p>
                        {current && (
                          <Link
                            to={nextHref}
                            className="mt-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-amber-600 sm:mt-1 sm:px-2 sm:text-[9px]"
                          >
                            Next
                          </Link>
                        )}
                      </div>
                    </Fragment>
                  )
                })}
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="mt-2 h-10 w-full max-w-xs shrink-0 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white shadow-md shadow-slate-900/15 hover:bg-slate-800 sm:mt-3 sm:h-11 sm:max-w-sm sm:text-[15px]"
            onClick={() => navigate('/', { replace: true })}
          >
            Continue to dashboard
            <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <Link
            to={tourHref(state.offeringType)}
            className="mt-1 shrink-0 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 sm:mt-1.5 sm:text-[13px]"
          >
            {state.offeringType === 'services' ? 'Open services catalog' : 'Take a 60-second catalog tour'}
          </Link>
        </div>
      </div>
    </div>
  )
}
