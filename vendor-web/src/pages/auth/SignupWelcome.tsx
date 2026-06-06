import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Store, ArrowRight, Mail, Check, Sparkles } from 'lucide-react'
import { COMPANY_TYPES } from '@/data/companyTypes'
import { cn } from '@/lib/utils'
import { SIGNUP_BRAND } from '@/components/auth/signupTheme'

export type SignupWelcomeState = {
  fullName?: string
  businessCategory?: string
  businessName?: string
  vendorSlug?: string
  verificationHint?: string
  launchStepsComplete?: number
  planName?: string
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
    description: 'Login, profile, and verification.',
    nextHref: '/storefront-builder',
  },
  {
    id: 'business front',
    label: 'Business front',
    description: 'Branding and your public store URL.',
    nextHref: '/storefront-builder',
  },
  {
    id: 'catalog',
    label: 'Catalog',
    description: 'Products and categories for checkout.',
    nextHref: '/products',
  },
  {
    id: 'go-live',
    label: 'Go live',
    description: 'Share your store with customers.',
    nextHref: '/',
  },
]

const TOTAL_STEPS = LAUNCH_STEPS.length

const PARTICLE_COLORS = [
  'bg-emerald-400',
  'bg-teal-300',
  'bg-sky-400',
  'bg-violet-400',
  'bg-amber-300',
  'bg-white/90',
]

function catalogHref(offering?: SignupWelcomeState['offeringType']): string {
  if (offering === 'services') return '/services'
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
  if (!t) return 'Business'
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
  if (complete >= 4) return 'Store live'
  if (complete >= 3) return 'Catalog ready'
  if (complete >= 2) return 'Business front ready'
  return 'Account ready'
}

function nextHrefForActiveStep(complete: number, steps: LaunchStep[]): string {
  if (complete < 1 || complete > TOTAL_STEPS) return '/'
  return steps[complete]?.nextHref ?? '/'
}

function tourHref(offering?: SignupWelcomeState['offeringType']): string {
  return catalogHref(offering)
}

type BlastParticle = {
  id: number
  dx: string
  dy: string
  rot: string
  delay: string
  size: number
  color: string
  shape: 'dot' | 'confetti'
  slow: boolean
}

function buildBlastParticles(count: number, minDist: number, spread: number, slow = false): BlastParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 5) * 0.09
    const dist = minDist + (i % 13) * spread + (i % 9) * (spread * 0.45)
    return {
      id: i + (slow ? 1000 : 0),
      dx: `${Math.cos(angle) * dist}vmin`,
      dy: `${Math.sin(angle) * dist}vmin`,
      rot: `${(i * 41 + (slow ? 90 : 0)) % 360}deg`,
      delay: `${(i % 12) * 12 + (slow ? 90 : 0)}ms`,
      size: i % 5 === 0 ? 10 : i % 3 === 0 ? 7 : 5,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      shape: i % 4 === 0 ? 'confetti' : 'dot',
      slow,
    }
  })
}

function FullPageBlastOverlay() {
  const fastParticles = useMemo(() => buildBlastParticles(48, 14, 3.2), [])
  const slowParticles = useMemo(() => buildBlastParticles(32, 22, 4.1, true), [])

  return (
    <div
      className="signup-blast-overlay-out pointer-events-none fixed inset-0 z-[200] overflow-hidden"
      aria-hidden
    >
      <div className="signup-screen-flash absolute inset-0 bg-gradient-to-br from-emerald-100 via-white to-teal-50" />

      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        <span className="signup-blast-core absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/80 shadow-[0_0_120px_40px_rgba(100,195,160,0.75)]" />
        <span className="signup-blast-ring absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-emerald-200/90 bg-emerald-400/25 shadow-[0_0_80px_rgba(100,195,160,0.6)]" />
        <span className="signup-blast-ring absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70 bg-white/30 [animation-delay:60ms]" />
        <span className="signup-blast-ring absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/50 [animation-delay:140ms]" />

        {[...fastParticles, ...slowParticles].map((p) => (
          <span
            key={p.id}
            className={cn(
              'absolute left-1/2 top-1/2 shadow-sm',
              p.slow ? 'signup-celebrate-particle-slow' : 'signup-celebrate-particle',
              p.shape === 'confetti' ? 'rounded-sm' : 'rounded-full',
              p.color,
            )}
            style={{
              width: p.size,
              height: p.shape === 'confetti' ? p.size * 1.6 : p.size,
              animationDelay: p.delay,
              ...({
                '--dx': p.dx,
                '--dy': p.dy,
                '--rot': p.rot,
              } as CSSProperties),
            }}
          />
        ))}
      </div>
    </div>
  )
}

function MeshBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(100,195,160,0.22),transparent_55%)]" />
      <div className="signup-welcome-orb absolute -left-16 top-20 h-56 w-56 rounded-full bg-emerald-500/20 blur-[80px]" />
      <div className="signup-welcome-orb absolute -right-10 bottom-10 h-64 w-64 rounded-full bg-violet-500/15 blur-[90px] [animation-delay:2s]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
    </div>
  )
}

function HeaderEmailVerify({ hint }: { hint: string }) {
  return (
    <div className="flex max-w-[58%] flex-col items-end gap-0.5 text-right sm:max-w-[50%]">
      <div className="flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-300/90" aria-hidden />
        <p className="text-xs font-medium text-white/80">Verify email</p>
      </div>
      <p className="font-mono text-sm font-semibold tracking-widest text-white">{hint}</p>
    </div>
  )
}

function StepPill({
  step,
  index,
  complete,
}: {
  step: LaunchStep
  index: number
  complete: number
}) {
  const done = index < complete
  const current = index === complete && complete < TOTAL_STEPS

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all',
        current && 'bg-white/10 ring-1 ring-emerald-400/40',
        !done && !current && 'opacity-45',
      )}
    >
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
          done && 'bg-emerald-400 text-slate-900',
          current && 'border border-emerald-300 bg-emerald-400/20 text-emerald-100',
          !done && !current && 'border border-white/15 bg-white/5 text-white/40',
        )}
      >
        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
      </div>
      <div className="min-w-0 text-left">
        <p className={cn('truncate text-xs font-semibold', current ? 'text-white' : 'text-white/75')}>
          {step.label}
        </p>
      </div>
      {current && (
        <span className="ml-auto shrink-0 rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
          Next
        </span>
      )}
    </div>
  )
}

export default function SignupWelcome() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as SignupWelcomeState
  const [showBlast, setShowBlast] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const steps = useMemo(() => stepsWithCatalogHref(state.offeringType), [state.offeringType])

  useEffect(() => {
    if (!state?.businessName && !state?.vendorSlug) {
      navigate('/', { replace: true })
    }
  }, [state?.businessName, state?.vendorSlug, navigate])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setShowBlast(false)
      setShowModal(true)
      return
    }
    const revealTimer = window.setTimeout(() => setShowModal(true), 920)
    const blastTimer = window.setTimeout(() => setShowBlast(false), 1280)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(blastTimer)
    }
  }, [])

  if (!state?.businessName && !state?.vendorSlug) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-950 text-sm text-slate-400">
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
  const progressPct = Math.round((complete / TOTAL_STEPS) * 100)
  const activeStep = steps[complete]
  const catalogLinkLabel =
    state.offeringType === 'services'
      ? 'Open services catalog'
      : 'Take a 60-second catalog tour'

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
      <MeshBackground />

      {showBlast && <FullPageBlastOverlay />}

      <header
        className={cn(
          'relative z-40 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/60 px-4 backdrop-blur-xl transition-opacity duration-300 sm:px-6',
          !showModal && 'opacity-0',
        )}
      >
        <span className="text-sm font-semibold tracking-tight text-white">KITERP</span>
        {state.verificationHint ? (
          <HeaderEmailVerify hint={state.verificationHint} />
        ) : (
          <span className="w-px shrink-0" aria-hidden />
        )}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
        {showModal && (
        <div
          className="signup-welcome-modal relative z-20 w-full max-w-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-welcome-title"
        >
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="signup-stagger-1 border-b border-white/10 bg-gradient-to-r from-emerald-500/20 via-transparent to-violet-500/15 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-emerald-500/25"
                    style={{ backgroundColor: SIGNUP_BRAND }}
                  >
                    <Store className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-base font-bold text-white">{businessDisplay}</p>
                    <p className="text-xs text-white/55">
                      {categoryLabel}
                      {displayGreet !== 'there' ? ` · ${displayGreet}` : ''}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-white/40">Plan</p>
                  <p className="text-xs font-bold text-white">{planLabel}</p>
                </div>
              </div>
            </div>

            <div className="signup-stagger-2 px-5 pt-5 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                <Sparkles className="h-3 w-3" aria-hidden />
                {badge}
              </span>

              <h1
                id="signup-welcome-title"
                className="mt-3 bg-gradient-to-br from-white via-white to-emerald-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-[1.65rem]"
              >
                Welcome{displayGreet !== 'there' ? `, ${displayGreet}` : ''}
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Your workspace is ready. Finish setup to launch{' '}
                <span className="font-medium text-white/90">{businessDisplay}</span>.
              </p>
            </div>

            <div className="signup-stagger-3 px-5 py-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-white/50">
                <span>Launch roadmap</span>
                <span className="tabular-nums text-white/80">
                  {complete}/{TOTAL_STEPS} · {progressPct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="signup-welcome-shimmer h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="mt-3 grid gap-1">
                {steps.map((step, i) => (
                  <StepPill key={step.id} step={step} index={i} complete={complete} />
                ))}
              </div>

              {activeStep && complete < TOTAL_STEPS && (
                <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs leading-relaxed text-white/55">
                  <span className="font-semibold text-emerald-200">Up next:</span>{' '}
                  {activeStep.description}
                </p>
              )}
            </div>

            <div className="signup-stagger-4 space-y-2.5 border-t border-white/10 bg-black/20 px-5 py-4">
              <Button
                type="button"
                size="lg"
                className="h-11 w-full rounded-xl border-0 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
                style={{ backgroundColor: SIGNUP_BRAND }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#52b893' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SIGNUP_BRAND }}
                onClick={() => navigate('/', { replace: true })}
              >
                Continue to dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              {complete < TOTAL_STEPS ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-full rounded-xl text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => navigate(nextHref, { replace: true })}
                >
                  Continue setup — {activeStep?.label}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Link
                  to={tourHref(state.offeringType)}
                  className="block text-center text-xs font-medium text-white/50 transition-colors hover:text-white/80"
                >
                  {catalogLinkLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
