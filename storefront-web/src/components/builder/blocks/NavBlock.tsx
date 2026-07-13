import { useMemo, useState, useCallback, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, User, X, Home, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useVendor } from '@/contexts/VendorContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { useStorePath } from '@/hooks/useStorePath'
import { useCartStore, selectCartItemCount } from '@/stores/cartStore'
import { useCart } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { imgUrl, cn } from '@/lib/utils'
import { AnnouncementBar } from '@/kit/header/UnifiedNav'
import { Input } from '@/components/ui/input'
import { StoreBranchPicker } from '@/components/store/StoreBranchPicker'
import { resolveStorefrontLinkMode } from '@/lib/storefrontTemplateAssignment'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import type { NavLinkItem } from '@/kit/types'
import { readNavHeaderBarSize, resolveNavBlockShell } from '@/lib/navBlockLayout'
import {
  isNavLinkActive,
  resolveCurrentNavActiveKey,
  resolveNavBlockLinks,
  resolveNavCtaLabel,
} from '@/lib/siteNavPages'
import { isVendorBlogEnabled } from '@/lib/catalogNavCapabilities'
import {
  builderPageSlugFromNavPath,
  isDraftPreviewShellHref,
  resolveStoreNavPathFromHref,
  shouldOpenCatalogPreviewForNavPath,
  sitePageSlugSet,
} from '@/lib/previewNavRouting'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { siteRadiusPx } from '@/lib/siteBorderRadius'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'
import { BuilderCtaButton } from '@/components/builder/BuilderCtaButton'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import {
  readNavBrandGap,
  readNavBrandLayout,
  resolveNavBrandContainerClass,
  resolveNavBrandTextClass,
  resolveNavLogoPresentation,
} from '@/lib/navBrandStyle'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
  isEditorCanvas?: boolean
}

export default function NavBlock({
  site,
  style,
  props,
  liveItems,
  branchCode: _branchFromBlocks,
  blockId,
  isEditorCanvas = false,
}: Props) {
  const { vendor, previewShell, openBuilderForPage } = useVendor()
  const effectiveVendor = useEffectiveVendor()
  const storePath = useStorePath()
  const builderCanvas = useBuilderCanvas()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, customer } = useAuthStore()
  const cartCount = useCartStore(selectCartItemCount)
  useCart()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
  }, [customer?.avatar_url])

  const sitePageSlugs = useMemo(() => sitePageSlugSet(site), [site])

  const openBuilderPageFromPath = useCallback((rawPath: string) => {
    if (!openBuilderForPage) return false
    const pathname = resolveStoreNavPathFromHref(rawPath, storePath)
    if (shouldOpenCatalogPreviewForNavPath(pathname, sitePageSlugs)) return false
    openBuilderForPage(builderPageSlugFromNavPath(pathname))
    return true
  }, [openBuilderForPage, sitePageSlugs, storePath])

  const navigateStorePath = useCallback((rawPath: string) => {
    if (isEditorCanvas) return
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
  }, [isEditorCanvas, builderCanvas, storePath, previewShell, openBuilderPageFromPath, navigate])

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

  const brandFallback = effectiveVendor?.display_name?.trim() || vendor?.display_name?.trim() || 'Store'
  const brand = ((props.brand as string) || '').trim() || brandFallback
  const brandLogoProp = ((props.brand_logo as string) || '').trim()
  const logoUrl = brandLogoProp || effectiveVendor?.logo_url?.trim() || vendor?.logo_url?.trim() || null
  const showLogo = props.show_logo !== false
  const showLogoImage = showLogo && (!!logoUrl || (isEditorCanvas && !!blockId))
  const showBrandName = props.show_brand_name !== false
  const showNavLinks = props.show_nav_links !== false
  const showSearch = props.show_search !== false
  const showCart = props.show_cart !== false
  const showAccount = props.show_login !== false && props.show_account !== false
  const ctaLabel = resolveNavCtaLabel(props.cta_label as string | null)
  const ctaUrl = (props.cta_url as string | null) || '/contact'
  const announcement = (props.announcement as string | undefined) || null

  const shell = resolveNavBlockShell(props, style)
  const headerBarSize = readNavHeaderBarSize(props)
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
      liveItems.map((item): { title: string; url?: string } => ({
        title: item.title,
        url: item.url == null ? undefined : item.url,
      })),
      {
        previewShell: previewShell === true,
        isEditorCanvas,
        offeringType: vendor?.offering_type,
        blogEnabled: isVendorBlogEnabled(vendor?.settings),
      },
    )
  }, [showNavLinks, navLinksSource, rawLinks, liveItems, site, storePath, location.pathname, previewShell, isEditorCanvas, vendor?.offering_type, vendor?.settings])

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

  // Desktop/tablet canvas / draft preview: keep links visible for editing.
  // Phone canvas: show the real hamburger chrome (md breakpoint ≈ 768px).
  const previewBp = builderCanvas?.previewBreakpoint ?? 'desktop'
  const forceNavLinksVisible =
    previewShell === true
    || (isEditorCanvas && previewBp !== 'mobile')
  const narrowNavPreview = isEditorCanvas && previewBp === 'mobile'

  // Only offer the multi-store selector when the vendor runs a single website
  // shared across all stores; per-unit websites are tied to one store.
  const singleWebsiteForAllStores = resolveStorefrontLinkMode(vendor?.settings) === 'single'
  const showBranchPicker = singleWebsiteForAllStores
  const primary = style.primary_color || '#64C3A0'
  const borderRadius = siteRadiusPx(style.border_radius, 'sm')

  const navLinkClass = (href: string, compact: boolean, mobile = false) => {
    const active = isNavLinkActive(href, currentNavKey, storePath)
    return cn(
      'rounded-md font-medium transition-colors',
      mobile
        ? 'block px-3 py-2.5 text-base'
        : cn('text-sm whitespace-nowrap', compact ? 'px-2 py-1' : 'px-3 py-2'),
      active
        ? mobile
          ? 'font-semibold bg-primary/10'
          : 'font-semibold underline decoration-2 underline-offset-4'
        : mobile
          ? 'hover:bg-muted/60'
          : 'hover:opacity-80',
    )
  }

  const navLinkStyle = (href: string): React.CSSProperties => {
    const active = isNavLinkActive(href, currentNavKey, storePath)
    return active
      ? { color: primary }
      : { color: shell.navTextCol }
  }

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  const renderNavLinkItem = (link: NavLinkItem, mobile = false) => {
    const className = navLinkClass(link.href, shell.isCompact, mobile)
    const style = mobile ? navLinkStyle(link.href) : navLinkStyle(link.href)
    const ariaCurrent = isNavLinkActive(link.href, currentNavKey, storePath) ? 'page' as const : undefined
    const builderNavClick = builderCanvas?.onNavigate && !isEditorCanvas
      ? (e: React.MouseEvent) => {
          e.preventDefault()
          if (mobile) closeMobileMenu()
          builderCanvas.onNavigate!(link.href)
        }
      : mobile
        ? () => closeMobileMenu()
        : undefined

    if (previewShell) {
      return (
        <a
          key={link.href}
          href={link.href}
          onClick={(e) => {
            if (mobile) closeMobileMenu()
            previewNavClick(e, link.href)
          }}
          className={className}
          style={style}
          aria-current={ariaCurrent}
        >
          {link.label}
        </a>
      )
    }

    return (
      <Link
        key={link.href}
        to={link.href}
        onClick={builderNavClick}
        className={className}
        style={style}
        aria-current={ariaCurrent}
      >
        {link.label}
      </Link>
    )
  }

  const homePath = storePath('/')
  const showLogoImageResolved = showLogoImage && (logoUrl || (isEditorCanvas && blockId))
  const showBrandText = showBrandName && brand
  const showHomeFallback = !showLogoImageResolved && !showBrandText

  const brandLayout = readNavBrandLayout(props)
  const brandGap = readNavBrandGap(props)
  const logoPresentation = resolveNavLogoPresentation(props, shell.isCompact)

  const logoImageNode = showLogoImageResolved ? (
    isEditorCanvas && blockId ? (
      <BuilderSectionImage
        blockId={blockId}
        field="brand_logo"
        blockProps={props}
        src={logoUrl ? imgUrl(logoUrl) : ''}
        alt={brand}
        empty={!logoUrl}
        className={logoPresentation.className}
        style={logoPresentation.style}
      />
    ) : logoUrl ? (
      <img
        src={imgUrl(logoUrl)}
        alt={brand}
        className={logoPresentation.className}
        style={logoPresentation.style}
      />
    ) : null
  ) : null

  const brandTextClass = cn(resolveNavBrandTextClass(props, shell.isCompact))
  const brandTextStyle = { color: shell.navBrandCol, fontFamily: style.font_heading }

  const brandTextNode = showBrandText ? (
    isEditorCanvas && blockId ? (
      <BuilderTextField
        fieldKey="brand"
        blockId={blockId}
        blockProps={props}
        value={brand}
        as="span"
        className={brandTextClass}
        style={brandTextStyle}
        placeholder="Brand name"
      />
    ) : (
      <span className={brandTextClass} style={brandTextStyle}>
        {brand}
      </span>
    )
  ) : null

  const logoNode = previewShell ? (
    <a
      href={homePath}
      onClick={(e) => previewNavClick(e, homePath)}
      className={cn(resolveNavBrandContainerClass(brandLayout, shell.isCentered), 'min-w-0 max-w-[min(100%,180px)] sm:max-w-[min(100%,260px)] md:max-w-[min(100%,260px)]')}
      style={{ gap: brandGap }}
      aria-label={showHomeFallback ? 'Home' : brand}
    >
      {logoImageNode}
      {showBrandText && brandTextNode}
      {showHomeFallback && (
        <span className={cn('inline-flex items-center gap-1.5 font-semibold', shell.isCompact ? 'text-sm' : 'text-base')} style={{ color: shell.navBrandCol }}>
          <Home className={cn(shell.isCompact ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
          Home
        </span>
      )}
    </a>
  ) : (
    <Link
      to={homePath}
      className={cn(resolveNavBrandContainerClass(brandLayout, shell.isCentered), 'min-w-0 max-w-[min(100%,180px)] sm:max-w-[min(100%,260px)] md:max-w-[min(100%,260px)]')}
      style={{ gap: brandGap }}
      aria-label={showHomeFallback ? 'Home' : brand}
    >
      {logoImageNode}
      {showBrandText && brandTextNode}
      {showHomeFallback && (
        <span className={cn('inline-flex items-center gap-1.5 font-semibold', shell.isCompact ? 'text-sm' : 'text-base')} style={{ color: shell.navBrandCol }}>
          <Home className={cn(shell.isCompact ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
          Home
        </span>
      )}
    </Link>
  )

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    closeSearch()
    closeMobileMenu()
    navigateStorePath(`/products?search=${encodeURIComponent(q)}`)
  }

  const mobileSearchBarNode = showSearch && searchOpen && (
    <form onSubmit={submitSearch} className="flex flex-1 items-center gap-1.5 min-w-0">
      <Input
        autoFocus
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search products, prices, variants…"
        className="h-9 text-sm flex-1 min-w-0"
        aria-label="Search products"
      />
      <button
        type="submit"
        className="p-2 rounded-lg hover:opacity-70 transition-opacity shrink-0"
        style={{ color: shell.navTextCol }}
        aria-label="Submit search"
      >
        <Search className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={closeSearch}
        className="p-2 rounded-lg hover:opacity-70 transition-opacity shrink-0"
        style={{ color: shell.navTextCol }}
        aria-label="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </form>
  )

  const mobileCartNode = showCart && (
    builderCanvas?.onNavigate ? (
      <button
        type="button"
        onClick={() => navigateStorePath('/cart')}
        className="p-2 rounded-lg hover:opacity-70 transition-opacity relative"
        style={{ color: shell.navTextCol }}
        aria-label="Cart"
      >
        <ShoppingBag className="w-7 h-7" />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
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
        <ShoppingBag className="w-7 h-7" />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </a>
    ) : (
      <Link to={storePath('/cart')} className="p-2 rounded-lg hover:opacity-70 transition-opacity relative" style={{ color: shell.navTextCol }} aria-label="Cart">
        <ShoppingBag className="w-7 h-7" />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </Link>
    )
  )

  const mobileActionsNode = (
    <div className="flex items-center gap-0.5 shrink-0 ml-auto">
      {showSearch && !searchOpen && (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="inline-flex p-2 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: shell.navTextCol }}
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      )}
      {mobileCartNode}
    </div>
  )

  const showMobileMenu = !forceNavLinksVisible

  const mobileMenuNode = showMobileMenu && (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('shrink-0 -ml-1 h-9 w-9', !narrowNavPreview && 'md:hidden')}
          style={{ color: shell.navTextCol }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(100vw-2rem,20rem)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle style={{ color: shell.navTextCol }}>Menu</SheetTitle>
        </SheetHeader>
        {kitLinks.length > 0 && (
          <nav className="mt-6 flex flex-col gap-0.5">
            {kitLinks.map(link => renderNavLinkItem(link, true))}
          </nav>
        )}
        {showBranchPicker && (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide opacity-60" style={{ color: shell.navTextCol }}>
              Store location
            </p>
            <div className="px-3">
              <StoreBranchPicker />
            </div>
          </div>
        )}
        {showAccount && (
          <div className="mt-6 flex flex-col gap-1 border-t pt-4 px-1">
            {builderCanvas?.onNavigate ? (
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  navigateStorePath(isAuthenticated ? '/account' : '/login')
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted/60"
                style={{ color: shell.navTextCol }}
              >
                <User className="h-4 w-4" /> {isAuthenticated ? 'My Account' : 'Sign in'}
              </button>
            ) : previewShell ? (
              <a
                href={storePath(isAuthenticated ? '/account' : '/login')}
                onClick={(e) => {
                  closeMobileMenu()
                  previewNavClick(e, storePath(isAuthenticated ? '/account' : '/login'))
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted/60"
                style={{ color: shell.navTextCol }}
              >
                <User className="h-4 w-4" /> {isAuthenticated ? 'My Account' : 'Sign in'}
              </a>
            ) : (
              <Link
                to={storePath(isAuthenticated ? '/account' : '/login')}
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted/60"
                style={{ color: shell.navTextCol }}
              >
                <User className="h-4 w-4" /> {isAuthenticated ? 'My Account' : 'Sign in'}
              </Link>
            )}
          </div>
        )}
        {ctaLabel && (
          <div className="mt-4 px-3 pb-2">
            {isEditorCanvas && blockId ? (
              <BuilderCtaButton
                fieldKey="cta_label"
                blockId={blockId}
                blockProps={props}
                label={ctaLabel}
                href={ctaUrl}
                className={cn(
                  'w-full text-sm font-semibold hover:opacity-90 transition-opacity text-center',
                  shell.isCompact ? 'px-3 py-2' : 'px-4 py-2.5',
                  shell.isTransparentCta && 'ring-2 ring-white/30',
                )}
                style={{
                  backgroundColor: primary,
                  borderRadius,
                  color: '#fff',
                  boxShadow: shell.isTransparentCta ? `0 4px 14px ${primary}66` : undefined,
                }}
              />
            ) : previewShell ? (
              <a
                href={storePath(ctaUrl)}
                onClick={(e) => {
                  closeMobileMenu()
                  previewNavClick(e, storePath(ctaUrl))
                }}
                className={cn(
                  'inline-flex w-full items-center justify-center text-sm font-semibold hover:opacity-90 transition-opacity',
                  shell.isCompact ? 'px-3 py-2' : 'px-4 py-2.5',
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
                onClick={closeMobileMenu}
                className={cn(
                  'inline-flex w-full items-center justify-center text-sm font-semibold hover:opacity-90 transition-opacity no-underline',
                  shell.isCompact ? 'px-3 py-2' : 'px-4 py-2.5',
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
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )

  const renderMobileHeaderRow = () => searchOpen ? (
    <div className={cn('flex w-full items-center gap-2 min-w-0', !narrowNavPreview && 'md:hidden')}>
      {mobileMenuNode}
      {mobileSearchBarNode}
      {mobileCartNode}
    </div>
  ) : (
    <div className={cn('flex w-full items-center justify-between gap-2 min-w-0', !narrowNavPreview && 'md:hidden')}>
      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
        {mobileMenuNode}
        <div className="min-w-0 flex-1 overflow-hidden">
          {logoNode}
        </div>
      </div>
      {mobileActionsNode}
    </div>
  )

  const linksNode = kitLinks.length > 0 && (
    <nav className={cn(
      'flex items-center gap-1 flex-wrap min-w-0',
      shell.isCentered ? 'justify-center' : 'justify-center',
      forceNavLinksVisible ? 'flex' : narrowNavPreview ? 'hidden' : 'hidden md:flex',
    )}>
      {kitLinks.map(link => renderNavLinkItem(link))}
    </nav>
  )

  const accountInitial =
    (customer?.full_name || customer?.email || 'U').trim().charAt(0).toUpperCase() || 'U'
  const avatarSrc = imgUrl((customer?.avatar_url || '').trim())
  const showAvatarImage = isAuthenticated && !!avatarSrc && !avatarFailed
  const accountAvatarNode = showAvatarImage ? (
    <img
      src={avatarSrc}
      alt={customer?.full_name || 'Account'}
      className="w-9 h-9 rounded-full object-cover"
      onError={() => setAvatarFailed(true)}
    />
  ) : isAuthenticated ? (
    <span
      className="flex w-9 h-9 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ backgroundColor: primary }}
    >
      {accountInitial}
    </span>
  ) : (
    <User className="w-7 h-7" />
  )

  const actionsNode = (
    <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
      {showCart && (
        builderCanvas?.onNavigate ? (
          <button
            type="button"
            onClick={() => navigateStorePath('/cart')}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity relative"
            style={{ color: shell.navTextCol }}
            aria-label="Cart"
          >
            <ShoppingBag className="w-7 h-7" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
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
            <ShoppingBag className="w-7 h-7" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </a>
        ) : (
          <Link to={storePath('/cart')} className="p-2 rounded-lg hover:opacity-70 transition-opacity relative" style={{ color: shell.navTextCol }} aria-label="Cart">
            <ShoppingBag className="w-7 h-7" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        )
      )}
      {showAccount && (
        <div className="hidden md:block">
          {builderCanvas?.onNavigate ? (
            <button
              type="button"
              onClick={() => navigateStorePath(isAuthenticated ? '/account' : '/login')}
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: shell.navTextCol }}
              aria-label="Account"
            >
              {accountAvatarNode}
            </button>
          ) : previewShell ? (
            <a
              href={storePath(isAuthenticated ? '/account' : '/login')}
              onClick={(e) => previewNavClick(e, storePath(isAuthenticated ? '/account' : '/login'))}
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: shell.navTextCol }}
              aria-label="Account"
            >
              {accountAvatarNode}
            </a>
          ) : (
            <Link to={storePath(isAuthenticated ? '/account' : '/login')} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: shell.navTextCol }} aria-label="Account">
              {accountAvatarNode}
            </Link>
          )}
        </div>
      )}
      {showBranchPicker && !shell.isCentered && (
        <div className="hidden md:flex items-center shrink-0">
          <StoreBranchPicker />
        </div>
      )}
      {ctaLabel && (
        <BuilderCtaButton
          fieldKey="cta_label"
          blockId={blockId}
          blockProps={props}
          label={ctaLabel}
          href={ctaUrl}
          className={cn(
            'hidden md:inline-flex text-sm font-semibold whitespace-nowrap hover:opacity-90 transition-opacity',
            shell.isCompact ? 'px-3 py-1.5' : 'px-4 py-2',
            shell.isTransparentCta && 'ring-2 ring-white/30',
          )}
          style={{
            backgroundColor: primary,
            borderRadius,
            color: '#fff',
            boxShadow: shell.isTransparentCta ? `0 4px 14px ${primary}66` : undefined,
          }}
        />
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
            builderSectionContainerClass(
              'relative',
              // Keep original compact/default padding unless Header bar size is set.
              headerBarSize == null
                ? (shell.isCompact ? 'py-1.5' : 'py-3')
                : undefined,
            ),
            shell.isCentered
              ? 'flex flex-col items-center text-center gap-2'
              : 'flex items-center justify-between gap-3',
            shell.isElevated && '!mx-3 sm:!mx-4 !max-w-none mt-2 rounded-xl shadow-lg border border-black/5',
          )}
          style={headerBarSize != null ? { minHeight: headerBarSize } : undefined}
        >
          {shell.isCentered ? (
            <>
              {renderMobileHeaderRow()}
              <div className={cn(
                'flex-col items-center text-center gap-2 w-full',
                narrowNavPreview ? 'hidden' : 'hidden md:flex',
              )}>
                {logoNode}
                {linksNode}
                {actionsNode}
              </div>
            </>
          ) : (
            <>
              {renderMobileHeaderRow()}
              <div className={cn(
                'w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3',
                narrowNavPreview ? 'hidden' : 'hidden md:grid',
              )}>
                <div className="col-start-1 flex items-center gap-2 min-w-0 justify-self-start">
                  {logoNode}
                </div>
                <div className="col-start-2 flex min-w-0 justify-center">
                  {linksNode}
                </div>
                <div className="col-start-3 flex min-w-0 justify-self-end">
                  {actionsNode}
                </div>
              </div>
            </>
          )}
        </div>
      </header>
    </>
  )
}
