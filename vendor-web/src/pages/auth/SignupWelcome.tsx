import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Store, ArrowRight, Sparkles, Mail, PartyPopper } from 'lucide-react'
import { COMPANY_TYPES } from '@/data/companyTypes'

export type SignupWelcomeState = {
  fullName?: string
  businessCategory?: string
  businessName?: string
  vendorSlug?: string
  verificationHint?: string
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

const PARTICLE_COLORS = [
  'bg-amber-400',
  'bg-rose-400',
  'bg-violet-500',
  'bg-emerald-400',
  'bg-sky-400',
  'bg-fuchsia-400',
]

type BurstParticle = {
  dx: number
  dy: number
  rot: number
  delay: number
  color: string
  size: 'sm' | 'md'
}

function CelebrationBlast() {
  const particles = useMemo(() => {
    const mk = (n: number, baseDelay: number, distMul: number, spreadDeg: number): BurstParticle[] =>
      Array.from({ length: n }, (_, i) => {
        const spread = (spreadDeg * Math.PI) / 180
        const base = (-90 * Math.PI) / 180
        const t = n <= 1 ? 0 : i / (n - 1) - 0.5
        const angle = base + t * spread
        const dist = (118 + (i % 6) * 15) * distMul
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          rot: ((i * 53) % 420) - 210,
          delay: baseDelay + i * 18,
          color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
          size: distMul < 1 ? 'sm' : 'md',
        }
      })
    return [...mk(30, 0, 1, 138), ...mk(18, 340, 0.62, 160)]
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className={`signup-celebrate-particle absolute bottom-[24%] left-1/2 rounded-sm shadow-sm ${p.color} ${
            p.size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'
          }`}
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              animationDelay: `${p.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
      <div className="absolute bottom-[30%] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-yellow-300/90 blur-[2px] shadow-[0_0_24px_rgba(250,204,21,0.85)]" />
    </div>
  )
}

export default function SignupWelcome() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as SignupWelcomeState

  useEffect(() => {
    if (!state?.businessName && !state?.vendorSlug) {
      navigate('/', { replace: true })
    }
  }, [state?.businessName, state?.vendorSlug, navigate])

  if (!state?.businessName && !state?.vendorSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting…
      </div>
    )
  }

  const businessDisplay = state.businessName?.trim() || state.vendorSlug || 'your business'
  const greetName = firstNameFromFull(state.fullName)
  const categoryLabel = displayBusinessCategory(state.businessCategory)

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/40 via-50% to-indigo-50 flex flex-col overflow-hidden">
      <CelebrationBlast />

      <header className="relative z-10 border-b border-white/60 bg-white/70 backdrop-blur-md shrink-0">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <Store className="w-6 h-6 text-blue-600" />
            <span className="font-bold">KITERP</span>
          </div>
          <Link to="/" className="text-sm text-blue-600 font-medium hover:underline">
            Skip to dashboard
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="signup-welcome-pop w-full max-w-md text-center">
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-[2rem] bg-emerald-400/35 animate-ping" style={{ animationDuration: '1.8s' }} />
            <span className="absolute inset-2 rounded-3xl bg-gradient-to-br from-amber-300/50 to-rose-400/40 animate-pulse" />
            <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-xl shadow-teal-600/30 ring-[10px] ring-white/90">
              <PartyPopper className="h-10 w-10 text-white drop-shadow-md" aria-hidden />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 mb-4 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            You&apos;re in — account created
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-bold text-slate-900 tracking-tight">
            Welcome, {greetName}!{' '}
            <span className="inline-block animate-[signup-welcome-pop_0.6s_ease-out_0.15s_both]" aria-hidden>
              🎉
            </span>
          </h1>

          <p className="mt-3 text-slate-700 text-[15px] leading-relaxed">
            Your{' '}
            <span className="font-semibold text-indigo-800">{categoryLabel}</span>{' '}
            <span className="font-bold text-slate-900">{businessDisplay}</span> is live on KITERP.
          </p>

          {state.vendorSlug ? (
            <p className="mt-2 text-sm font-mono text-slate-500">Slug: {state.vendorSlug}</p>
          ) : null}

          <p className="mt-4 text-sm text-slate-500">
            You&apos;re signed in. Continue to your dashboard to add products, customize your storefront, and more.
          </p>

          {state.verificationHint ? (
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-left">
              <div className="flex gap-2 items-start">
                <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Verify your email</p>
                  <p className="text-xs text-blue-800/90 mt-1">
                    We sent a code to your inbox. In development you can use:
                  </p>
                  <p className="mt-2 font-mono text-lg font-bold tracking-widest text-blue-950">
                    {state.verificationHint}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="mt-8 w-full sm:w-auto min-w-[240px] h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20"
            onClick={() => navigate('/', { replace: true })}
          >
            Continue to dashboard
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  )
}
