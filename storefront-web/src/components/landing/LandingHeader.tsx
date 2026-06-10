import { Store } from 'lucide-react'
import { vendorAppUrl, adminAppUrl } from '@/lib/appUrls'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

const NAV = [
  { label: 'Stores', href: '#stores' },
  { label: 'Apps', href: '#apps' },
  { label: 'Demo', href: '#demo' },
  { label: 'Community', href: '#community' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Help', href: '#help' },
]

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <Store className="w-7 h-7 text-[#64C3A0]" />
          <span className="font-bold text-lg text-[#1e3d34]">KITERP</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          {NAV.map((item) => (
            <a key={item.label} href={item.href} className="hover:text-[#64C3A0] transition-colors">
              {item.label}
            </a>
          ))}
        </nav>

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
          <a
            href={adminAppUrl}
            className="hidden lg:inline text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#64C3A0]/40 hover:text-[#64C3A0] transition-colors"
          >
            Admin
          </a>
        </div>
      </div>
    </header>
  )
}
