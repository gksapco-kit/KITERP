import { Outlet, Link, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom'
import { cn, imgUrl } from '@/lib/utils'
import {
  Store, AlertTriangle, Loader2,
  Phone, Mail, Clock, Facebook, Instagram, Twitter, Youtube, Globe,
  ArrowUp, Search, User, ChevronDown, Package, LogOut, ShoppingCart, MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart, useCustomerLogout, useCustomerMe } from '@/hooks/useStore'
import { UnifiedNav, AnnouncementBar } from '@/kit/header/UnifiedNav'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { VendorProvider, useVendor } from '@/contexts/VendorContext'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { BuilderSiteProvider, useBuilderSite } from '@/contexts/BuilderSiteContext'
import { getWbCatalogTemplateId } from '@/storefront/catalogTemplateIds'
import { useAssignedStorefrontTemplateId } from '@/hooks/useAssignedStorefrontTemplateId'
import { isLegacyHomeTemplateId, resolveLiveCatalogTemplateId } from '@/lib/storefrontTemplateAssignment'
import { useState, useRef, useEffect } from 'react'
import CrmChatWidget from '@/components/CrmChatWidget'
import { CustomerNotificationsBell } from '@/components/CustomerNotificationsBell'
import { useJourneyBeacon } from '@/hooks/useJourneyBeacon'
import { BranchProvider, useBranch } from '@/contexts/BranchContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { StoreBranchPicker } from '@/components/store/StoreBranchPicker'

// ── Shared sub-components ─────────────────────────────────────────────────────

function SearchForm({ onSearch, searchQuery, setSearchQuery, accentColor, dark = false }: {
  onSearch: (e: React.FormEvent) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  accentColor: string
  dark?: boolean
}) {
  return (
    <form onSubmit={onSearch} className="flex w-full">
      <div className="flex w-full rounded-lg overflow-hidden shadow-sm ring-1 ring-black/10">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products & services..."
          className={cn(
            'flex-1 px-4 py-2.5 text-sm focus:outline-none',
            dark ? 'bg-white/15 text-white placeholder-white/60 focus:bg-white/20' : 'bg-white text-gray-900 placeholder-gray-400'
          )}
        />
        <button type="submit" className="px-4 flex items-center justify-center transition-opacity hover:opacity-90 shrink-0" style={{ backgroundColor: accentColor }}>
          <Search className="w-4 h-4 text-white" />
        </button>
      </div>
    </form>
  )
}

function AccountDropdown({ isAuthenticated, customer, storePath, logout, accountOpen, setAccountOpen, accountRef, dark = false }: {
  isAuthenticated: boolean
  customer: any
  storePath: (p: string) => string
  logout: () => void
  accountOpen: boolean
  setAccountOpen: (v: boolean) => void
  accountRef: React.RefObject<HTMLDivElement>
  dark?: boolean
}) {
  const textClass = dark ? 'text-white' : 'text-gray-700'
  const subTextClass = dark ? 'text-white/70' : 'text-gray-500'
  const hoverClass = dark ? 'hover:bg-white/10' : 'hover:bg-gray-50'
  return (
    <div ref={accountRef} className="relative">
      <button onClick={() => setAccountOpen(!accountOpen)}
        className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors text-sm font-medium', hoverClass, textClass)}>
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">{isAuthenticated ? customer?.full_name?.split(' ')[0] || 'Account' : 'Sign In'}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {accountOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-1.5 overflow-hidden max-h-[90vh] overflow-y-auto">
          {isAuthenticated ? (
            <>
              <div className="px-4 py-3 bg-gray-50 border-b">
                <p className="font-semibold text-gray-900 text-sm">{customer?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{customer?.email}</p>
              </div>
              <Link to={storePath('/account')} onClick={() => setAccountOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <User className="w-4 h-4 text-gray-400" /> My Account
              </Link>
              <Link to={storePath('/account/orders')} onClick={() => setAccountOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <Package className="w-4 h-4 text-gray-400" /> My Orders
              </Link>
              <div className="border-t my-1" />
              <button onClick={() => { logout(); setAccountOpen(false) }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          ) : (
            <div className="px-4 py-3">
              <Link to={storePath('/login')} onClick={() => setAccountOpen(false)}>
                <Button className="w-full" size="sm">Sign In</Button>
              </Link>
              <p className="text-xs text-gray-500 mt-2 text-center">
                New customer?{' '}
                <Link to={storePath('/register')} onClick={() => setAccountOpen(false)}
                  className="text-blue-600 hover:underline font-medium">Register</Link>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CartButton({ itemCount, to, dark = false }: { itemCount: number; to: string; dark?: boolean }) {
  const textClass = dark ? 'text-white' : 'text-gray-700'
  return (
    <Link to={to} className={cn('relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-black/5 text-sm font-medium', dark && 'hover:bg-white/10', textClass)}>
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        {itemCount > 0 && (
          <span className="absolute -top-2 -right-2 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 shadow-sm">
            {itemCount}
          </span>
        )}
      </div>
      <span className="hidden sm:inline">Cart</span>
    </Link>
  )
}

function MobileMenu({ menuOpen, navLinks, storePath, isAuthenticated, logout, setMenuOpen }: {
  menuOpen: boolean
  navLinks: { to: string; label: string; end?: boolean }[]
  storePath: (p: string) => string
  isAuthenticated: boolean
  logout: () => void
  setMenuOpen: (v: boolean) => void
}) {
  if (!menuOpen) return null
  return (
    <div className="md:hidden bg-white border-b shadow-xl z-40 animate-in slide-in-from-top-2 duration-200">
      <div className="px-4 py-3 space-y-0.5">
        {navLinks.map((link) => (
          <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
            className="flex items-center py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
            {link.label}
          </Link>
        ))}
        <div className="border-t my-2" />
        {isAuthenticated ? (
          <>
            <Link to={storePath('/account')} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              <User className="w-4 h-4 text-gray-400" /> My Account
            </Link>
            <Link to={storePath('/account/orders')} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              <Package className="w-4 h-4 text-gray-400" /> My Orders
            </Link>
            <button onClick={() => { logout(); setMenuOpen(false) }}
              className="flex items-center gap-2 w-full text-left py-2.5 px-3 text-sm text-red-600 hover:bg-red-50 rounded-lg">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </>
        ) : (
          <>
            <Link to={storePath('/login')} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 py-2.5 px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg">
              Sign In
            </Link>
            <Link to={storePath('/register')} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              Create Account
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ── Footer variants ───────────────────────────────────────────────────────────

function footerSurface(theme: ReturnType<typeof useTheme>) {
  const isLight = theme.template !== 'dark'
  return {
    isLight,
    style: { backgroundColor: isLight ? theme.colors.background : theme.colors.secondary },
    rootClass: isLight ? 'text-gray-700 border-t border-gray-200' : 'text-gray-300',
    titleClass: isLight ? 'text-gray-900' : 'text-white',
    linkClass: isLight ? 'hover:text-gray-900 transition-colors' : 'hover:text-white transition-colors',
    mutedClass: isLight ? 'text-gray-600' : 'text-gray-300',
    borderClass: isLight ? 'border-gray-200' : 'border-white/10',
    iconClass: isLight ? 'text-gray-400' : 'text-white/60',
    socialClass: isLight
      ? 'p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-600'
      : 'p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors',
    backToTopClass: isLight
      ? 'bg-gray-50 hover:bg-gray-100 border-b border-gray-200 text-gray-700'
      : 'bg-white/5 hover:bg-white/10 border-b border-white/10',
    brandLinkStyle: { color: theme.colors.primary },
  }
}

function FooterSimple({ vendor, storePath, theme }: { vendor: any; storePath: (p: string) => string; theme: ReturnType<typeof useTheme> }) {
  const surface = footerSurface(theme)
  return (
    <footer style={surface.style} className={cn('mt-auto', surface.rootClass)}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          {vendor?.logo_url ? (
            <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="h-7 rounded object-contain" />
          ) : (
            <Store className={cn('w-5 h-5', surface.iconClass)} />
          )}
          <span className={cn('font-semibold', surface.titleClass)}>{vendor?.display_name}</span>
        </div>
        <div className={cn('flex items-center gap-4 text-xs', surface.mutedClass)}>
          <Link to={storePath('/products')} className={surface.linkClass}>Products</Link>
          <Link to={storePath('/services')} className={surface.linkClass}>Services</Link>
          <Link to={storePath('/policies')} className={surface.linkClass}>Policies</Link>
          <Link to={storePath('/account')} className={surface.linkClass}>Account</Link>
        </div>
        <p className={cn('text-xs', surface.mutedClass)}>&copy; {new Date().getFullYear()} {vendor?.display_name}</p>
      </div>
    </footer>
  )
}

function FooterStandard({ vendor, storePath, theme }: { vendor: any; storePath: (p: string) => string; theme: ReturnType<typeof useTheme> }) {
  const surface = footerSurface(theme)
  return (
    <footer style={surface.style} className={cn('mt-auto', surface.rootClass)}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {vendor?.logo_url ? (
                <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="h-8 rounded object-contain" />
              ) : (
                <Store className={cn('w-6 h-6', surface.iconClass)} />
              )}
              <span className={cn('font-bold text-base', surface.titleClass)}>{vendor?.display_name}</span>
            </div>
            {vendor?.description && <p className={cn('text-sm leading-relaxed line-clamp-3', surface.mutedClass)}>{vendor.description}</p>}
            {vendor?.social_links && (
              <div className="flex gap-2 mt-4">
                {vendor.social_links.facebook && <a href={vendor.social_links.facebook} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Facebook className="w-4 h-4" /></a>}
                {vendor.social_links.instagram && <a href={vendor.social_links.instagram} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Instagram className="w-4 h-4" /></a>}
                {vendor.social_links.twitter && <a href={vendor.social_links.twitter} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Twitter className="w-4 h-4" /></a>}
                {vendor.social_links.youtube && <a href={vendor.social_links.youtube} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Youtube className="w-4 h-4" /></a>}
              </div>
            )}
          </div>
          <div>
            <h4 className={cn('font-semibold text-sm mb-4', surface.titleClass)}>Shop</h4>
            <div className="space-y-2.5 text-sm">
              <Link to={storePath('/')} className={cn('block', surface.linkClass)}>Home</Link>
              <Link to={storePath('/products')} className={cn('block', surface.linkClass)}>All Products</Link>
              <Link to={storePath('/services')} className={cn('block', surface.linkClass)}>All Services</Link>
              <Link to={storePath('/policies')} className={cn('block', surface.linkClass)}>Store Policies</Link>
            </div>
          </div>
          <div>
            <h4 className={cn('font-semibold text-sm mb-4', surface.titleClass)}>Contact</h4>
            <div className="space-y-2.5 text-sm">
              {vendor?.primary_phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" />{vendor.primary_phone}</p>}
              {vendor?.primary_email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" />{vendor.primary_email}</p>}
              {(vendor?.city || vendor?.street_address) && (
                <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{[vendor.street_address, vendor.city].filter(Boolean).join(', ')}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className={cn('border-t py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs', surface.borderClass, surface.mutedClass)}>
          <p>&copy; {new Date().getFullYear()} {vendor?.display_name}. All rights reserved.</p>
          <p>Powered by <Link to="/" className="hover:underline font-medium" style={surface.brandLinkStyle}>KITERP</Link></p>
        </div>
      </div>
    </footer>
  )
}

function FooterFull({ vendor, storePath, theme }: { vendor: any; storePath: (p: string) => string; theme: ReturnType<typeof useTheme> }) {
  const surface = footerSurface(theme)
  return (
    <footer style={surface.style} className={cn('mt-auto', surface.rootClass)}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={cn('w-full flex items-center justify-center gap-2 transition-colors py-3 text-sm', surface.backToTopClass)}>
          <ArrowUp className="w-4 h-4" /> Back to top
        </button>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10">
          <div>
            <h4 className={cn('font-semibold text-sm mb-4', surface.titleClass)}>Get to Know Us</h4>
            <div className="space-y-2.5 text-sm">
              <Link to={storePath('/')} className={cn('block', surface.linkClass)}>About {vendor?.display_name}</Link>
              <Link to={storePath('/products')} className={cn('block', surface.linkClass)}>All Products</Link>
              <Link to={storePath('/services')} className={cn('block', surface.linkClass)}>All Services</Link>
              <Link to={storePath('/policies')} className={cn('block', surface.linkClass)}>Store Policies</Link>
            </div>
          </div>
          <div>
            <h4 className={cn('font-semibold text-sm mb-4', surface.titleClass)}>Your Account</h4>
            <div className="space-y-2.5 text-sm">
              <Link to={storePath('/account')} className={cn('block', surface.linkClass)}>My Profile</Link>
              <Link to={storePath('/account/orders')} className={cn('block', surface.linkClass)}>Your Orders</Link>
              <Link to={storePath('/account/bookings')} className={cn('block', surface.linkClass)}>My Bookings</Link>
              <Link to={storePath('/cart')} className={cn('block', surface.linkClass)}>Cart</Link>
            </div>
          </div>
          <div>
            <h4 className={cn('font-semibold text-sm mb-4', surface.titleClass)}>Contact Us</h4>
            <div className="space-y-2.5 text-sm">
              {vendor?.primary_phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" />{vendor.primary_phone}</p>}
              {vendor?.support_phone && vendor.support_phone !== vendor.primary_phone && (
                <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" />{vendor.support_phone}</p>
              )}
              {Array.isArray((vendor?.settings as Record<string, unknown> | undefined)?.support_phones) &&
                ((vendor!.settings as Record<string, unknown>).support_phones as string[])
                  .filter((p) => typeof p === 'string' && p.trim() && p !== vendor?.primary_phone && p !== vendor?.support_phone)
                  .map((phone) => (
                    <p key={phone} className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      {phone}
                    </p>
                  ))}
              {vendor?.primary_email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" />{vendor.primary_email}</p>}
              {vendor?.support_email && vendor.support_email !== vendor.primary_email && (
                <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" />{vendor.support_email}</p>
              )}
              {Array.isArray((vendor?.settings as Record<string, unknown> | undefined)?.support_emails) &&
                ((vendor!.settings as Record<string, unknown>).support_emails as string[])
                  .filter(
                    (e) =>
                      typeof e === 'string' &&
                      e.trim() &&
                      e.toLowerCase() !== vendor?.primary_email?.toLowerCase() &&
                      e.toLowerCase() !== vendor?.support_email?.toLowerCase(),
                  )
                  .map((email) => (
                    <p key={email} className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      {email}
                    </p>
                  ))}
              {(vendor?.street_address || vendor?.city) && (
                <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{[vendor.street_address, vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(', ')}</span>
                </p>
              )}
              {vendor?.gstin && <p className={cn('text-xs', surface.mutedClass)}>GSTIN: {vendor.gstin}</p>}
            </div>
          </div>
          <div>
            <h4 className={cn('font-semibold text-sm mb-4', surface.titleClass)}>Business Hours</h4>
            <div className="space-y-1 text-xs">
              {vendor?.business_hours && Object.keys(vendor.business_hours).length > 0 ? (
                Object.entries(vendor.business_hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between">
                    <span className="capitalize">{day}</span>
                    <span>{(hours as any)?.closed ? 'Closed' : `${(hours as any)?.open || '?'} – ${(hours as any)?.close || '?'}`}</span>
                  </div>
                ))
              ) : (
                <p className={cn('flex items-center gap-1.5', surface.mutedClass)}><Clock className="w-3.5 h-3.5" />Contact us for hours</p>
              )}
            </div>
            {vendor?.social_links && Object.keys(vendor.social_links).length > 0 && (
              <div className="mt-5">
                <h4 className={cn('font-semibold text-sm mb-2.5', surface.titleClass)}>Follow Us</h4>
                <div className="flex gap-2 flex-wrap">
                  {vendor.social_links.facebook && <a href={vendor.social_links.facebook} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Facebook className="w-4 h-4" /></a>}
                  {vendor.social_links.instagram && <a href={vendor.social_links.instagram} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Instagram className="w-4 h-4" /></a>}
                  {vendor.social_links.twitter && <a href={vendor.social_links.twitter} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Twitter className="w-4 h-4" /></a>}
                  {vendor.social_links.youtube && <a href={vendor.social_links.youtube} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Youtube className="w-4 h-4" /></a>}
                  {vendor.social_links.website && <a href={vendor.social_links.website} target="_blank" rel="noopener noreferrer" className={surface.socialClass}><Globe className="w-4 h-4" /></a>}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={cn('border-t py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs', surface.borderClass, surface.mutedClass)}>
          <p>&copy; {new Date().getFullYear()} {vendor?.display_name}. All rights reserved.</p>
          <p>Powered by <Link to="/" className="hover:underline font-medium" style={surface.brandLinkStyle}>KITERP</Link></p>
        </div>
      </div>
    </footer>
  )
}

// ── Main StoreContent ─────────────────────────────────────────────────────────

function StoreContent() {
  const { pathname } = useLocation()
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { builderSite } = useBuilderSite()
  const { isLoading, error } = useVendor()
  const vendor = useEffectiveVendor()
  const { storePath } = useBranch()
  const assignedTemplateId = useAssignedStorefrontTemplateId()
  const { isAuthenticated, customer } = useAuthStore()
  const { itemCount } = useCartStore()
  const logout = useCustomerLogout()
  const navigate = useNavigate()
  const theme = useTheme()

  useCustomerMe()
  useCart()
  useJourneyBeacon(vendor?.id, customer?.id)

  const isHrAuthPage =
    !!vendorSlug &&
    (pathname === `/store/${vendorSlug}/hr/login` ||
      pathname === `/store/${vendorSlug}/hr/change-password`)

  // Employee HR / ESS lives under /store/:slug/hr — resolve vendor via X-Vendor-Slug on the API.
  // Do not block on public catalog so /hr/login still opens when the business front vendor is missing or pending.
  const isEmployeeHrArea =
    !!vendorSlug &&
    (isHrAuthPage ||
      pathname === `/store/${vendorSlug}/hr` ||
      pathname.startsWith(`/store/${vendorSlug}/hr/`))

  // Sign-in pages must render even while catalog vendor fetch is in flight (or failed).
  if (isLoading && !isHrAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading store...</p>
        </div>
      </div>
    )
  }

  if (isLoading && isHrAuthPage) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    )
  }

  if (isEmployeeHrArea && (error || !vendor)) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        {error ? (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-950 text-sm px-4 py-2.5 text-center leading-snug">
            Public store preview is unavailable for <span className="font-mono font-semibold">{vendorSlug}</span>.
            Employee sign-in below still uses this slug with the API.
          </div>
        ) : null}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-500 mb-6">{error || 'The store you are looking for does not exist or is no longer available.'}</p>
          <Link to="/"><Button size="lg">Back to Home</Button></Link>
        </div>
      </div>
    )
  }

  const wbCatalogTemplateId = getWbCatalogTemplateId(builderSite?.style_config as Record<string, unknown> | undefined)
  const catalogTemplateId =
    assignedTemplateId && isLegacyHomeTemplateId(assignedTemplateId)
      ? null
      : resolveLiveCatalogTemplateId(assignedTemplateId, wbCatalogTemplateId)
  const usesAssignedLegacyHome = Boolean(assignedTemplateId && isLegacyHomeTemplateId(assignedTemplateId))

  const navLinks = [
    { to: storePath('/'), label: 'Home', end: true },
    { to: storePath('/products'), label: 'Products' },
    { to: storePath('/services'), label: 'Services' },
    { to: storePath('/blog'), label: 'Blog' },
    { to: storePath('/policies'), label: 'Policies' },
  ]

  const headerStyle = theme.header_style || 'classic'
  const stickyHeader = theme.sticky_header !== false
  const showSearch = theme.show_search !== false
  const footerStyle = theme.footer_style || 'standard'
  const count = itemCount()

  const builderHomePage = builderSite?.pages?.find(p => p.is_homepage) || builderSite?.pages?.[0]
  const hasSavedBuilderBlocks = Boolean(builderHomePage?.blocks?.length)
  const isStoreHome =
    !!vendorSlug &&
    (pathname === `/store/${vendorSlug}` || pathname === `/store/${vendorSlug}/`)
  const isBuilderPreview =
    !!vendorSlug &&
    (pathname === `/store/${vendorSlug}/preview` || pathname.startsWith(`/store/${vendorSlug}/preview/`))
  const catalogHomeLayout = Boolean(
    catalogTemplateId &&
      isStoreHome &&
      builderSite &&
      !hasSavedBuilderBlocks &&
      !usesAssignedLegacyHome,
  )
  const builderOwnedLayout = Boolean(builderSite && isStoreHome && hasSavedBuilderBlocks)

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADER — UnifiedNav from kit
  // ─────────────────────────────────────────────────────────────────────────────

  const kitNavVariant =
    headerStyle === 'transparent' ? 'transparent'
    : headerStyle === 'centered' ? 'centered'
    : 'bordered'

  const kitUser = isAuthenticated && customer
    ? { id: customer.id, name: customer.full_name ?? customer.email ?? '', email: customer.email ?? '' }
    : null

  const kitLinks = navLinks.map((l) => ({ label: l.label, href: l.to }))

  const logoNode = vendor.logo_url ? (
    <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="h-9 max-w-[160px] object-contain" />
  ) : (
    <span className="font-bold text-lg shrink-0">{vendor.display_name}</span>
  )

  const headerNode = (
    <>
      {theme.custom_announcement && (
        <AnnouncementBar message={theme.custom_announcement} />
      )}
      <UnifiedNav
        logo={logoNode}
        logoHomeTo={storePath('/')}
        afterLogo={<StoreBranchPicker className="hidden sm:inline-flex" />}
        sheetExtra={<StoreBranchPicker className="w-full max-w-none" compact />}
        links={kitLinks}
        extraTray={isAuthenticated ? <CustomerNotificationsBell storePath={storePath} /> : undefined}
        showSearch={showSearch}
        showCart
        showAccount
        cartCount={count}
        cartHref={storePath('/cart')}
        user={kitUser}
        variant={kitNavVariant as any}
        sticky={stickyHeader}
        onSearch={(q) => navigate(storePath(`/products?search=${encodeURIComponent(q)}`))}
        onSignOut={logout}
        accountPaths={{
          signIn: storePath('/login'),
          register: storePath('/register'),
          account: storePath('/account'),
          orders: storePath('/account/orders'),
          bookings: storePath('/account/bookings'),
          wishlist: storePath('/account/wishlist'),
          profile: storePath('/account/profile'),
          notifications: storePath('/account/notifications'),
        }}
      />
    </>
  )

  // ── Footer selection ────────────────────────────────────────────────────────
  const footerNode = footerStyle === 'simple'
    ? <FooterSimple vendor={vendor} storePath={storePath} theme={theme} />
    : footerStyle === 'full'
      ? <FooterFull vendor={vendor} storePath={storePath} theme={theme} />
      : <FooterStandard vendor={vendor} storePath={storePath} theme={theme} />

  // HR / ESS portal — render without store nav/footer/cart
  if (isEmployeeHrArea) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <main className="flex-1 min-h-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    )
  }

  if (catalogHomeLayout || builderOwnedLayout || isBuilderPreview) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: theme.colors.background, fontFamily: theme.font_body || theme.font }}>
        <main className="flex-1">
          <Outlet />
        </main>
        {!isBuilderPreview && vendor?.id && (
          <CrmChatWidget
            vendorId={vendor.id}
            vendorName={vendor.display_name}
            themeColor={theme.colors.primary}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: theme.colors.background, fontFamily: theme.font_body || theme.font }}>
      {headerNode}

      <main className="flex-1">
        <Outlet />
      </main>

      {footerNode}

      {vendor?.id && (
        <CrmChatWidget
          vendorId={vendor.id}
          vendorName={vendor.display_name}
          themeColor={theme.colors.primary}
        />
      )}
    </div>
  )
}

export default function StoreLayout() {
  return (
    <VendorProvider>
      <BuilderSiteProvider>
        <BranchProvider>
          <ThemeProvider>
            <StoreContent />
          </ThemeProvider>
        </BranchProvider>
      </BuilderSiteProvider>
    </VendorProvider>
  )
}
