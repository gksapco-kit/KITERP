import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { MapPin, ChevronDown, Search, ShoppingBag, User, X, Home } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useStorePath } from '@/hooks/useStorePath'
import { branchDisplayName } from '@/lib/branchStorefrontIdentity'
import { useCartStore, selectCartItemCount } from '@/stores/cartStore'
import { useCart } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { imgUrl, cn } from '@/lib/utils'
import { AnnouncementBar } from '@/kit/header/UnifiedNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { storeApi, type StoreLocation } from '@/api/store'
import { resolveStorefrontLinkMode } from '@/lib/storefrontTemplateAssignment'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'
import { resolveNavBlockShell } from '@/lib/navBlockLayout'
import {
  isNavLinkActive,
  resolveCurrentNavActiveKey,
  resolveNavBlockLinks,
} from '@/lib/siteNavPages'
import {
  builderPageSlugFromNavPath,
  isDraftPreviewShellHref,
  resolveStoreNavPathFromHref,
  shouldOpenCatalogPreviewForNavPath,
  sitePageSlugSet,
} from '@/lib/previewNavRouting'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  isEditorCanvas?: boolean
}

function resolveLogoUrl(props: Record<string, unknown>, site: PublicSite, vendorLogo?: string | null) {
  return (
    (props.brand_logo as string | null | undefined)
    || (props.logo_url as string | null | undefined)
    || site.logo_url
    || vendorLogo
    || null
  )
}

export default function NavBlock({
  site,
  style,
  props,
  liveItems,
  branchCode: branchFromBlocks,
  isEditorCanvas = false,
}: Props) {
  const { vendor, previewShell, openBuilderForPage } = useVendor()
  const storePath = useStorePath()
  const builderCanvas = useBuilderCanvas()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const cartCount = useCartStore(selectCartItemCount)
  useCart()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const sitePageSlugs = useMemo(() => sitePageSlugSet(site), [site])

  const openBuilderPageFromPath = useCallback((rawPath: string) => {
    if (!openBuilderForPage) return false
    const pathname = resolveStoreNavPathFromHref(rawPath, storePath)
    if (shouldOpenCatalogPreviewForNavPath(pathname, sitePageSlugs)) return false
    openBuilderForPage(builderPageSlugFromNavPath(pathname))
    return true
  }, [openBuilderForPage, sitePageSlugs, storePath])

  const navigateStorePath = useCallback((rawPath: string) => {
    if (builderCanvas?.onNavigate) {
      builderCanvas.onNavigate(rawPath)
      return
    }
    if (previewShell && openBuilderPageFromPath(rawPath)) return
    const href = storePath(rawPath)
    if (previewShell) {
      try {
        const url = new URL(href, window.location.origin)
        navigate({ pathname: url.pathname, search: url.search })
        return
      } catch {
        /* fall through */
      }
    }
    navigate(href)
  }, [builderCanvas, storePath, previewShell, openBuilderPageFromPath, navigate])

  const previewNavClick = useCallback((e: React.MouseEvent, href: string) => {
    if (!previewShell) return
    e.preventDefault()
    try {
      const url = new URL(href, window.location.origin)
      if (isDraftPreviewShellHref(url.pathname)) {
        if (url.searchParams.has('route')) {
          navigate({ pathname: url.pathname, search: url.search })
          return
        }
        openBuilderForPage?.(url.searchParams.get('page'))
        return
      }
    } catch {
      /* fall through */
    }
    if (openBuilderPageFromPath(href)) return
    navigate(href)
  }, [previewShell, openBuilderForPage, openBuilderPageFromPath, navigate])

  const [branches, setBranches] = useState<StoreLocation[]>([])

  useEffect(() => {
    let cancelled = false
    storeApi.listBranches()
      .then(r => { if (!cancelled) setBranches(r.stores || []) })
      .catch(() => { if (!cancelled) setBranches([]) })
    return () => { cancelled = true }
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
    return branches.find(b => b.code === effectiveBranch || b.id === effectiveBranch) ?? null
  }, [branches, effectiveBranch])

  const brand = (props.brand as string) || (selectedBranch ? branchDisplayName(selectedBranch) : null) || site.name || vendor?.display_name || 'Store'
  const logoUrl = resolveLogoUrl(
    props,
    site,
    selectedBranch?.settings?.logo_url || vendor?.logo_url,
  )
  const showLogo = props.show_logo !== false && !!logoUrl
  const showBrandName = props.show_brand_name !== false
  const showNavLinks = props.show_nav_links !== false
  const showSearch = props.show_search !== false
  const showCart = props.show_cart !== false
  const showAccount = props.show_login !== false && props.show_account !== false
  const ctaLabel = (props.cta_label as string | null) || null
  const ctaUrl = (props.cta_url as string | null) || '/contact'
  const announcement = (props.announcement as string | undefined) || null

  const shell = resolveNavBlockShell(props, style)
  const navLinksSource = (props.nav_links_source as string) || 'site_pages'
  const rawLinks = (props.nav_links as Array<{ label: string; url: string }> | undefined) || []

  const kitLinks: NavLinkItem[] = useMemo(() => {
    return resolveNavBlockLinks(
      site,
      storePath,
      location.pathname,
      {
        show_nav_links: props.show_nav_links as boolean | undefined,
        nav_links_source: navLinksSource,
        nav_links: rawLinks,
      },
      liveItems.map(item => ({ title: item.title, url: item.url })),
      {
        previewShell: previewShell === true,
        offeringType: vendor?.offering_type,
      },
    )
  }, [showNavLinks, navLinksSource, rawLinks, liveItems, site, storePath, location.pathname, previewShell, vendor?.offering_type])

  const currentNavKey = useMemo(
    () => resolveCurrentNavActiveKey(
      location,
      storePath,
      isEditorCanvas
        ? {
            slug: builderCanvas?.activePageSlug,
            isHomepage: builderCanvas?.activePageIsHomepage,
          }
        : null,
    ),
    [
      location.pathname,
      location.search,
      storePath,
      isEditorCanvas,
      builderCanvas?.activePageSlug,
      builderCanvas?.activePageIsHomepage,
    ],
  )

  const forceNavLinksVisible = isEditorCanvas || previewShell === true

  // Only offer the multi-store selector when the vendor runs a single website
  // shared across all stores; per-unit websites are tied to one store.
  const singleWebsiteForAllStores = resolveStorefrontLinkMode(vendor?.settings) === 'single'
  const showBranchPicker = singleWebsiteForAllStores && branches.length > 1
  const primary = style.primary_color || '#64C3A0'
  const borderRadius = style.border_radius === 'sharp' || style.border_radius === 'none' ? 0 : 8

  const navLinkClass = (href: string, compact: boolean) => {
    const active = isNavLinkActive(href, currentNavKey, storePath)
    return cn(
      'rounded-md text-sm font-medium transition-colors whitespace-nowrap',
      compact ? 'px-2 py-1' : 'px-3 py-2',
      active
        ? 'font-semibold underline decoration-2 underline-offset-4'
        : 'hover:opacity-80',
    )
  }

  const navLinkStyle = (href: string): React.CSSProperties => {
    const active = isNavLinkActive(href, currentNavKey, storePath)
    return active
      ? { color: primary }
      : { color: shell.navTextCol }
  }

  const homePath = storePath('/')
  const showLogoImage = showLogo && logoUrl
  const showBrandText = showBrandName && brand
  const showHomeFallback = !showLogoImage && !showBrandText

  const logoNode = previewShell ? (
    <a
      href={homePath}
      onClick={(e) => previewNavClick(e, homePath)}
      className="inline-flex items-center gap-2 min-w-0 shrink-0 max-w-[min(100%,220px)]"
      aria-label={showHomeFallback ? 'Home' : brand}
    >
      {showLogoImage && (
        <img
          src={imgUrl(logoUrl)}
          alt={brand}
          className={cn('w-auto object-contain shrink-0', shell.isCompact ? 'h-6 max-w-[100px]' : 'h-8 max-w-[120px]')}
        />
      )}
      {showBrandText && (
        <span className={cn('font-bold truncate', shell.isCompact ? 'text-sm' : 'text-base')} style={{ color: shell.navBrandCol, fontFamily: style.font_heading }}>
          {brand}
        </span>
      )}
      {showHomeFallback && (
        <span className={cn('inline-flex items-center gap-1.5 font-semibold', shell.isCompact ? 'text-sm' : 'text-base')} style={{ color: shell.navBrandCol }}>
          <Home className={cn(shell.isCompact ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
          Home
        </span>
      )}
    </a>
  ) : (
    <Link to={homePath} className="inline-flex items-center gap-2 min-w-0 shrink-0 max-w-[min(100%,220px)]" aria-label={showHomeFallback ? 'Home' : brand}>
      {showLogoImage && (
        <img
          src={imgUrl(logoUrl)}
          alt={brand}
          className={cn('w-auto object-contain shrink-0', shell.isCompact ? 'h-6 max-w-[100px]' : 'h-8 max-w-[120px]')}
        />
      )}
      {showBrandText && (
        <span className={cn('font-bold truncate', shell.isCompact ? 'text-sm' : 'text-base')} style={{ color: shell.navBrandCol, fontFamily: style.font_heading }}>
          {brand}
        </span>
      )}
      {showHomeFallback && (
        <span className={cn('inline-flex items-center gap-1.5 font-semibold', shell.isCompact ? 'text-sm' : 'text-base')} style={{ color: shell.navBrandCol }}>
          <Home className={cn(shell.isCompact ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
          Home
        </span>
      )}
    </Link>
  )

  const linksNode = kitLinks.length > 0 && (
    <nav className={cn(
      'flex items-center gap-1 flex-wrap min-w-0',
      shell.isCentered ? 'justify-center' : 'justify-center flex-1',
      forceNavLinksVisible ? 'flex' : 'hidden md:flex',
    )}>
      {kitLinks.map(link => (
        previewShell ? (
          <a
            key={link.href}
            href={link.href}
            onClick={(e) => previewNavClick(e, link.href)}
            className={navLinkClass(link.href, shell.isCompact)}
            style={navLinkStyle(link.href)}
            aria-current={isNavLinkActive(link.href, currentNavKey, storePath) ? 'page' : undefined}
          >
            {link.label}
          </a>
        ) : (
          <Link
            key={link.href}
            to={link.href}
            onClick={builderCanvas?.onNavigate ? (e) => {
              e.preventDefault()
              builderCanvas.onNavigate!(link.href)
            } : undefined}
            className={navLinkClass(link.href, shell.isCompact)}
            style={navLinkStyle(link.href)}
            aria-current={isNavLinkActive(link.href, currentNavKey, storePath) ? 'page' : undefined}
          >
            {link.label}
          </Link>
        )
      ))}
    </nav>
  )

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearchOpen(false)
    navigateStorePath(`/products?search=${encodeURIComponent(q)}`)
  }

  const actionsNode = (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      {showSearch && (
        searchOpen ? (
          <form onSubmit={submitSearch} className="flex items-center gap-1">
            <Input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className={cn('h-9 text-sm', shell.isCompact ? 'w-36' : 'w-44')}
            />
            <button
              type="submit"
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: shell.navTextCol }}
              aria-label="Submit search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: shell.navTextCol }}
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: shell.navTextCol }}
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )
      )}
      {showCart && (
        builderCanvas?.onNavigate ? (
          <button
            type="button"
            onClick={() => navigateStorePath('/cart')}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity relative"
            style={{ color: shell.navTextCol }}
            aria-label="Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        ) : previewShell ? (
          <a
            href={storePath('/cart')}
            onClick={(e) => previewNavClick(e, storePath('/cart'))}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity relative"
            style={{ color: shell.navTextCol }}
            aria-label="Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </a>
        ) : (
          <Link to={storePath('/cart')} className="p-2 rounded-lg hover:opacity-70 transition-opacity relative" style={{ color: shell.navTextCol }} aria-label="Cart">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        )
      )}
      {showAccount && (
        builderCanvas?.onNavigate ? (
          <button
            type="button"
            onClick={() => navigateStorePath(isAuthenticated ? '/account' : '/login')}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: shell.navTextCol }}
            aria-label="Account"
          >
            <User className="w-5 h-5" />
          </button>
        ) : previewShell ? (
          <a
            href={storePath(isAuthenticated ? '/account' : '/login')}
            onClick={(e) => previewNavClick(e, storePath(isAuthenticated ? '/account' : '/login'))}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: shell.navTextCol }}
            aria-label="Account"
          >
            <User className="w-5 h-5" />
          </a>
        ) : (
          <Link to={storePath(isAuthenticated ? '/account' : '/login')} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: shell.navTextCol }} aria-label="Account">
            <User className="w-5 h-5" />
          </Link>
        )
      )}
      {showBranchPicker && !shell.isCentered && (
        <div className="hidden md:flex items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 max-w-[160px] font-normal" aria-label="Choose store location">
                <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{selectedBranch?.name || 'All locations'}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => setBranchParam(null)}>All locations</DropdownMenuItem>
              {branches.map(b => (
                <DropdownMenuItem key={b.id} onClick={() => setBranchParam(b.code || b.id)}>
                  {b.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {ctaLabel && (
        previewShell ? (
          <a
            href={storePath(ctaUrl)}
            onClick={(e) => previewNavClick(e, storePath(ctaUrl))}
            className={cn(
              'text-sm font-semibold whitespace-nowrap hover:opacity-90 transition-opacity',
              shell.isCompact ? 'px-3 py-1.5' : 'px-4 py-2',
              shell.isTransparentCta && 'ring-2 ring-white/30',
            )}
            style={{
              backgroundColor: primary,
              borderRadius,
              color: '#fff',
              boxShadow: shell.isTransparentCta ? `0 4px 14px ${primary}66` : undefined,
            }}
          >
            {ctaLabel}
          </a>
        ) : (
          <Link
            to={storePath(ctaUrl)}
            className={cn(
              'text-sm font-semibold whitespace-nowrap hover:opacity-90 transition-opacity',
              shell.isCompact ? 'px-3 py-1.5' : 'px-4 py-2',
              shell.isTransparentCta && 'ring-2 ring-white/30',
            )}
            style={{
              backgroundColor: primary,
              borderRadius,
              color: '#fff',
              boxShadow: shell.isTransparentCta ? `0 4px 14px ${primary}66` : undefined,
            }}
          >
            {ctaLabel}
          </Link>
        )
      )}
    </div>
  )

  return (
    <>
      {announcement && <AnnouncementBar message={announcement} />}
      <header
        className={cn(
          'w-full',
          shell.isGlass && 'backdrop-blur-md',
          shell.navBg === 'transparent' && 'bg-background/80',
        )}
        style={{
          backgroundColor: shell.navBg === 'transparent' ? undefined : shell.navBg,
          borderBottom: shell.isElevated ? undefined : shell.navBorderBottom,
        }}
      >
        <div
          className={cn(
            'relative mx-auto max-w-full',
            shell.isCentered
              ? 'flex flex-col items-center text-center gap-2'
              : 'flex items-center justify-between gap-3',
            shell.isCompact ? 'py-1.5 px-4' : 'py-3 px-4 sm:px-6',
            shell.isElevated && 'mx-3 sm:mx-4 mt-2 rounded-xl shadow-lg border border-black/5',
          )}
        >
          {shell.isCentered ? (
            <>
              {logoNode}
              {linksNode}
              {actionsNode}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
                {logoNode}
              </div>
              {linksNode}
              {actionsNode}
            </>
          )}
        </div>
      </header>
    </>
  )
}
