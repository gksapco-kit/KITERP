import { Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { vendorAppUrl } from '@/lib/appUrls'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

type Props = { variant?: 'home' | 'campaign' }

export function LandingHeader({ variant = 'home' }: Props) {
  const appsHref = variant === 'campaign' ? '/apps' : '/#apps'
  const pricingHref = variant === 'campaign' ? '#pricing' : '/#pricing'
  const communityHref = '/#community'

  return (
    <>
      <header className="kiterp-landing-header fixed top-0 inset-x-0 z-50 border-b border-[#1e3d34]/06 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 shadow-[0_1px_0_rgba(30,61,52,0.04)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#64C3A0]/55 to-transparent" aria-hidden />
        <div className="kiterp-landing-header-inner mx-auto flex h-14 sm:h-[4.25rem] w-full items-center justify-between gap-2 sm:gap-4">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2 sm:gap-2.5 shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64C3A0]/40"
          >
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#7dceb0,#64C3A0)] text-white shadow-sm shadow-[#64C3A0]/30 ring-1 ring-white/40 transition group-hover:scale-[1.03]">
              <Store className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2.25} />
            </span>
            <span className="font-bold text-base sm:text-[17px] tracking-tight text-[#1e3d34]">
              KIT <span className="text-[#3d9a7a]">ERP</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-[#1e3d34]/70" aria-label="Primary">
            {variant === 'campaign' ? (
              <Link to="/apps" className="rounded-full px-3 py-1.5 hover:text-[#1e3d34] hover:bg-[#eef9f4] transition-colors">
                Apps
              </Link>
            ) : (
              <a href={appsHref} className="rounded-full px-3 py-1.5 hover:text-[#1e3d34] hover:bg-[#eef9f4] transition-colors">
                Apps
              </a>
            )}
            <a href={pricingHref} className="rounded-full px-3 py-1.5 hover:text-[#1e3d34] hover:bg-[#eef9f4] transition-colors">
              Pricing
            </a>
            <a href={communityHref} className="rounded-full px-3 py-1.5 hover:text-[#1e3d34] hover:bg-[#eef9f4] transition-colors">
              Community
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
            <a
              href={`${vendorAppUrl}/login`}
              className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1.5 sm:border sm:border-[#1e3d34]/10 sm:bg-white sm:px-4 sm:py-2 text-sm font-medium text-[#1e3d34]/75 hover:text-[#1e3d34] sm:hover:border-[#64C3A0]/35 sm:hover:bg-[#eef9f4] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64C3A0]/40"
            >
              Sign in
            </a>
            <a
              href={VENDOR_SIGNUP_PATH}
              className="inline-flex items-center whitespace-nowrap rounded-full bg-[#64C3A0] px-3 sm:px-5 py-1.5 sm:py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(100,195,160,0.35)] hover:bg-[#52b38f] hover:shadow-[0_8px_20px_rgba(100,195,160,0.45)] sm:hover:-translate-y-0.5 active:translate-y-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64C3A0]/45 focus-visible:ring-offset-2"
            >
              Sign up
            </a>
          </div>
        </div>
      </header>
      <div className="kiterp-landing-header-spacer" aria-hidden />
    </>
  )
}
