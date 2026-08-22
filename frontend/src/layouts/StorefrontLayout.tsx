import { useState } from 'react'
import { Outlet, useParams, NavLink, Link } from 'react-router-dom'
import { Store, ShoppingCart, Phone, Mail, MapPin, Menu, X } from 'lucide-react'
import { useStorefrontVendor } from '@/hooks/useStorefront'
import { cn } from '@/lib/utils'

export default function StorefrontLayout() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { data: vendor, isLoading, error } = useStorefrontVendor(vendorSlug || '')

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">Loading store…</p>
        </div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <Store className="w-16 h-16 text-gray-300 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Store Not Found</h1>
          <p className="text-gray-500 mt-2">
            The store you're looking for doesn't exist or is not yet active.
          </p>
          <Link to="/" className="inline-block mt-6 text-primary hover:underline">
            Go to homepage
          </Link>
        </div>
      </div>
    )
  }

  const themeColor = vendor.theme_config?.primary_color || '#2563eb'
  const base = `/store/${vendorSlug}`
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { to: base, label: 'Home', end: true },
    { to: `${base}/products`, label: 'Products' },
    { to: `${base}/services`, label: 'Services' },
    { to: `${base}/about`, label: 'About' },
    { to: `${base}/contact`, label: 'Contact' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        {/* Top bar */}
        <div className="bg-gray-900 text-gray-300 text-xs py-1.5">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {vendor.primary_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {vendor.primary_phone}
                </span>
              )}
              {vendor.primary_email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {vendor.primary_email}
                </span>
              )}
            </div>
            {vendor.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {vendor.city}, {vendor.state}
              </span>
            )}
          </div>
        </div>

        {/* Main nav */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to={base} className="flex items-center gap-3 shrink-0">
            {vendor.logo_url ? (
              <img src={vendor.logo_url} alt={vendor.display_name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: themeColor }}>
                {vendor.display_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">{vendor.display_name}</h1>
              {vendor.description && (
                <p className="text-xs text-gray-500 line-clamp-1 max-w-[300px]">{vendor.description}</p>
              )}
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                  )
                }
                style={({ isActive }) => isActive ? { backgroundColor: themeColor } : {}}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={`${base}/cart`}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-gray-600" />
            </Link>
            <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b shadow-lg">
          <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                  )
                }
                style={({ isActive }) => isActive ? { backgroundColor: themeColor } : {}}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Content */}
      <main className="flex-1">
        <Outlet context={{ vendor, themeColor }} />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-3">{vendor.display_name}</h3>
              <p className="text-sm leading-relaxed">{vendor.description}</p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Quick Links</h3>
              <div className="space-y-2 text-sm">
                <Link to={base} className="block hover:text-white transition-colors">Home</Link>
                <Link to={`${base}/products`} className="block hover:text-white transition-colors">Products</Link>
                <Link to={`${base}/services`} className="block hover:text-white transition-colors">Services</Link>
                <Link to={`${base}/contact`} className="block hover:text-white transition-colors">Contact Us</Link>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Contact</h3>
              <div className="space-y-2 text-sm">
                {vendor.primary_email && <p>{vendor.primary_email}</p>}
                {vendor.primary_phone && <p>{vendor.primary_phone}</p>}
                {vendor.city && <p>{vendor.city}, {vendor.state}</p>}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs">
            &copy; {new Date().getFullYear()} {vendor.display_name}. Powered by KIT ERP
          </div>
        </div>
      </footer>
    </div>
  )
}
