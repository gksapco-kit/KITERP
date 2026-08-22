import { Store } from 'lucide-react'
import { Link } from 'react-router-dom'
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
              <span className="text-white font-bold">KIT ERP</span>
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
              <li><Link to="/apps" className="hover:text-white transition-colors">All apps</Link></li>
              <li><Link to="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-3">Community</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/partners" className="hover:text-white transition-colors">Our Partners</Link></li>
              <li><Link to="/#community" className="hover:text-white transition-colors">Vendor community</Link></li>
              <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link to="/lead" className="hover:text-white transition-colors">Add new lead</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact us</Link></li>
            </ul>
          </div>
        </div>
        <p className="text-center text-xs border-t border-white/10 pt-8">
          &copy; {new Date().getFullYear()} KIT ERP. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
