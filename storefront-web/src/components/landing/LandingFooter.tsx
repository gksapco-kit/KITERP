import { Store } from 'lucide-react'
import { vendorAppUrl, adminAppUrl } from '@/lib/appUrls'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

export function LandingFooter() {
  return (
    <footer id="help" className="bg-[#1e3d34] text-gray-400 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-6 h-6 text-[#64C3A0]" />
              <span className="text-white font-bold">KITERP</span>
            </div>
            <p className="text-sm leading-relaxed">
              Multi-vendor commerce, services, HR, and storefront builder — all on one KIT ERP platform.
            </p>
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-3">Get started</p>
            <ul className="space-y-2 text-sm">
              <li><a href={VENDOR_SIGNUP_PATH} className="hover:text-white transition-colors">Create your business</a></li>
              <li><a href={`${vendorAppUrl}/login`} className="hover:text-white transition-colors">Vendor login</a></li>
              <li><a href={adminAppUrl} className="hover:text-white transition-colors">Admin portal</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-3">Platform</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#apps" className="hover:text-white transition-colors">Apps</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-3">Community</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#community" className="hover:text-white transition-colors">Vendor community</a></li>
            </ul>
          </div>
        </div>
        <p className="text-center text-xs border-t border-white/10 pt-8">
          &copy; {new Date().getFullYear()} KITERP. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
