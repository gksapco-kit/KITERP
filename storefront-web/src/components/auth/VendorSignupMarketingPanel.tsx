import { Rocket, Users, BarChart3, ShieldCheck, Store } from 'lucide-react'
import { SIGNUP_BRAND, SIGNUP_BRAND_MUTED } from './signupTheme'

const FEATURES = [
  { icon: Rocket, title: 'Quick Setup', desc: 'Live in under 5 minutes.' },
  { icon: Users, title: 'Customer Portal', desc: 'Logins, orders & bookings.' },
  { icon: BarChart3, title: 'Full Dashboard', desc: 'Orders, inventory, POS, reports.' },
  { icon: ShieldCheck, title: 'Secure & Trusted', desc: 'SSL & payments built-in.' },
] as const

type VendorSignupMarketingPanelProps = {
  homeHref?: string
  showLogo?: boolean
}

export function VendorSignupMarketingPanel({
  homeHref = '/',
  showLogo = true,
}: VendorSignupMarketingPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {showLogo ? (
        <a href={homeHref} className="mb-4 inline-flex shrink-0 items-center gap-2 self-start transition-opacity hover:opacity-80 xl:mb-5">
          <Store className="h-5 w-5 xl:h-6 xl:w-6" style={{ color: SIGNUP_BRAND }} aria-hidden />
          <span className="text-base font-bold tracking-tight text-slate-900 xl:text-lg">KITERP</span>
        </a>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <h1 className="text-2xl font-bold leading-[1.12] tracking-tight text-slate-900 xl:text-[2rem]">
          Start selling online
          <br />
          <span style={{ color: SIGNUP_BRAND }}>in minutes</span>
        </h1>
        <p className="mt-2 max-w-md text-sm leading-snug text-slate-600 xl:mt-3 xl:text-[15px]">
          Create your branded store, manage products &amp; services, accept orders, and grow your business.
        </p>

        <ul className="mt-4 space-y-2.5 xl:mt-5 xl:space-y-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg xl:h-9 xl:w-9"
                style={{ backgroundColor: `${SIGNUP_BRAND}22` }}
              >
                <f.icon className="h-4 w-4 xl:h-[18px] xl:w-[18px]" style={{ color: SIGNUP_BRAND_MUTED }} strokeWidth={2} />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-sm font-semibold leading-tight text-slate-900">{f.title}</span>
                <span className="block text-xs leading-snug text-slate-500">{f.desc}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 flex shrink-0 items-center gap-2 text-xs text-slate-400 xl:mt-6 xl:text-sm">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 xl:h-4 xl:w-4" style={{ color: SIGNUP_BRAND }} aria-hidden />
          Secured by KITERP
        </p>
      </div>
    </div>
  )
}
