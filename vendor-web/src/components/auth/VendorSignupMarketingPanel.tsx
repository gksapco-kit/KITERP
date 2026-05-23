import { Rocket, Users, BarChart3, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
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
  homeHref = '/register',
  showLogo = true,
}: VendorSignupMarketingPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {showLogo ? (
        <Link to={homeHref} className="mb-10 inline-flex items-center gap-2.5 self-start">
          <Store className="h-6 w-6" style={{ color: SIGNUP_BRAND }} aria-hidden />
          <span className="text-lg font-bold tracking-tight text-slate-900">KITERP</span>
        </Link>
      ) : null}

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 xl:text-[2.35rem]">
          Start selling online
          <br />
          <span style={{ color: SIGNUP_BRAND }}>in minutes</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
          Create your branded store, manage products &amp; services, accept orders, and grow your business.
        </p>

        <ul className="mt-8 space-y-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${SIGNUP_BRAND}22` }}
              >
                <f.icon className="h-[18px] w-[18px]" style={{ color: SIGNUP_BRAND_MUTED }} strokeWidth={2} />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-[15px] font-semibold leading-tight text-slate-900">{f.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-slate-500">{f.desc}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-10 flex items-center gap-2 text-sm text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: SIGNUP_BRAND }} aria-hidden />
          Secured by KITERP
        </p>
      </div>
    </div>
  )
}
