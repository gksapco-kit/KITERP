import { Store } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { vendorAppUrl } from '@/lib/appUrls'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

export function LandingHeader() {
  const { pathname } = useLocation()
  const partnersActive = pathname === '/partners' || pathname.startsWith('/partners/')

  return (
    <header className="sticky top-0 z-50 border-b border-[#1e3d34]/06 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#64C3A0]/50 to-transparent" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[4.25rem] flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 sm:gap-8 min-w-0">
          <Link
            to="/"
            className="group flex items-center gap-2.5 shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64C3A0]/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#7dceb0,#64C3A0)] text-white shadow-sm shadow-[#64C3A0]/30 ring-1 ring-white/40 transition group-hover:scale-[1.03]">
              <Store className="w-[18px] h-[18px]" strokeWidth={2.25} />
            </span>
            <span className="font-bold text-[17px] tracking-tight text-[#1e3d34]">
              KIT<span className="text-[#3d9a7a]">ERP</span>
            </span>
          </Link>

          <nav className="flex items-center">
            <Link
              to="/partners"
              className={`text-sm font-medium transition-colors ${
                partnersActive
                  ? 'text-[#3d9a7a]'
                  : 'text-[#1e3d34]/55 hover:text-[#1e3d34]'
              }`}
            >
              Our Partners
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <a
            href={`${vendorAppUrl}/login`}
            className="hidden sm:inline-flex items-center rounded-full border border-[#1e3d34]/10 bg-white px-4 py-2 text-sm font-medium text-[#1e3d34]/75 hover:border-[#64C3A0]/35 hover:text-[#1e3d34] hover:bg-[#eef9f4] transition-all"
          >
            Sign in
          </a>
          <a
            href={VENDOR_SIGNUP_PATH}
            className="inline-flex items-center rounded-full bg-[#64C3A0] px-4 sm:px-5 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(100,195,160,0.35)] hover:bg-[#52b38f] hover:shadow-[0_8px_20px_rgba(100,195,160,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            Sign up
          </a>
        </div>
      </div>
    </header>
  )
}
