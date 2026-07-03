import { Store } from 'lucide-react'
import { vendorAppUrl } from '@/lib/appUrls'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <Store className="w-7 h-7 text-[#64C3A0]" />
          <span className="font-bold text-lg text-[#1e3d34]">KITERP</span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={`${vendorAppUrl}/login`}
            className="hidden sm:inline text-sm font-medium text-gray-600 hover:text-[#64C3A0] transition-colors"
          >
            Sign in
          </a>
          <a
            href={VENDOR_SIGNUP_PATH}
            className="kiterp-btn-primary text-sm px-4 py-2 sm:px-5 sm:py-2.5"
          >
            Sign up
          </a>
        </div>
      </div>
    </header>
  )
}
