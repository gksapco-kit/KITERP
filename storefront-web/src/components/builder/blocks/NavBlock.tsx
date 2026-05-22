import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { MapPin, ChevronDown } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useCartStore } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import { useCustomerLogout } from '@/hooks/useStore'
import { imgUrl } from '@/lib/utils'
import { UnifiedNav, AnnouncementBar } from '@/kit/header/UnifiedNav'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { storeApi, type StoreLocation } from '@/api/store'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function NavBlock({ site, style, props, liveItems, branchCode: branchFromBlocks }: Props) {
  const { storePath, vendor } = useVendor()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, customer } = useAuthStore()
  const { itemCount } = useCartStore()
  const logout = useCustomerLogout()

  const [branches, setBranches] = useState<StoreLocation[]>([])

  useEffect(() => {
    let cancelled = false
    storeApi
      .listBranches()
      .then((r) => {
        if (!cancelled) setBranches(r.stores || [])
      })
      .catch(() => {
        if (!cancelled) setBranches([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const urlBranch = searchParams.get('branch')
  const effectiveBranch = urlBranch || branchFromBlocks || null

  const setBranchParam = (code: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (code) next.set('branch', code)
    else next.delete('branch')
    const qs = next.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true })
  }

  const selectedBranch = useMemo(() => {
    if (!effectiveBranch || !branches.length) return null
    return branches.find((b) => b.code === effectiveBranch || b.id === effectiveBranch) ?? null
  }, [branches, effectiveBranch])

  const brand =
    (props.brand as string) ||
    site.name ||
    vendor?.display_name ||
    'Store'
  const logoUrl =
    (props.logo_url as string | null) ||
    site.logo_url ||
    vendor?.logo_url ||
    null
  const ctaLabel = (props.cta_label as string | null) || null
  const ctaUrl = (props.cta_url as string | null) || '/contact'
  const navStyle = (style.nav_style as 'default' | 'transparent' | undefined) || 'default'
  const announcement = (props.announcement as string | undefined) || null

  const rawLinks = (props.nav_links as Array<{ label: string; url: string }> | undefined) || []
  const kitLinks: NavLinkItem[] =
    liveItems.length > 0
      ? liveItems.map((item) => ({ label: item.title, href: storePath(item.url || '/') }))
      : rawLinks.map((l) => ({ label: l.label, href: storePath(l.url) }))

  if (kitLinks.length === 0) {
    kitLinks.push(
      { label: 'Home', href: storePath('/') },
      { label: 'Products', href: storePath('/products') },
      { label: 'Services', href: storePath('/services') },
    )
  }

  const kitUser = isAuthenticated && customer
    ? { id: customer.id, name: customer.full_name ?? customer.email ?? '', email: customer.email ?? '', phone: customer.phone ?? undefined }
    : null

  const logo = logoUrl ? (
    <img src={imgUrl(logoUrl)} alt={brand} className="h-8 w-auto object-contain" />
  ) : (
    <span className="font-bold text-lg text-primary">{brand}</span>
  )

  const showBranchPicker = branches.length > 1

  const branchDesktop = showBranchPicker ? (
    <div className="hidden md:flex items-center shrink-0 ml-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 max-w-[200px] font-normal" aria-label="Choose store location">
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{selectedBranch?.name || 'All locations'}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => setBranchParam(null)}>All locations</DropdownMenuItem>
          {branches.map((b) => (
            <DropdownMenuItem key={b.id} onClick={() => setBranchParam(b.code || b.id)}>
              {b.name}
              {b.address?.city ? <span className="text-muted-foreground text-xs ml-1">({b.address.city})</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null

  const branchSheet = showBranchPicker ? (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Store location</p>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          className="text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
          onClick={() => setBranchParam(null)}
        >
          All locations
        </button>
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            className="text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
            onClick={() => setBranchParam(b.code || b.id)}
          >
            {b.name}
            {b.address?.city ? <span className="text-muted-foreground"> — {b.address.city}</span> : null}
          </button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <>
      {announcement && <AnnouncementBar message={announcement} />}
      <UnifiedNav
        logo={logo}
        logoHomeTo={storePath('/')}
        afterLogo={branchDesktop}
        sheetExtra={branchSheet}
        links={kitLinks}
        showSearch
        showCart
        showAccount
        cartCount={itemCount()}
        cartHref={storePath('/cart')}
        user={kitUser}
        cta={ctaLabel ? { label: ctaLabel, href: storePath(ctaUrl) } : undefined}
        variant={navStyle === 'transparent' ? 'transparent' : 'bordered'}
        sticky
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
}
