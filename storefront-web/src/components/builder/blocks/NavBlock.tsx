import { useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, User, X, Home } from 'lucide-react'
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
import { resolveNavBlockShell } from '@/lib/navBlockLayout'
import {
  isNavLinkActive,
  resolveCurrentNavActiveKey,
  resolveNavBlockLinks,
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

  const forceNavLinksVisible = isEditorCanvas || previewShell === true

  // Only offer the multi-store selector when the vendor runs a single website
  // shared across all stores; per-unit websites are tied to one store.
  const singleWebsiteForAllStores = resolveStorefrontLinkMode(vendor?.settings) === 'single'
  const showBranchPicker = singleWebsiteForAllStores
  const primary = style.primary_color || '#64C3A0'
  const borderRadius = siteRadiusPx(style.border_radius, 'sm')

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
      className={cn(resolveNavBrandContainerClass(brandLayout, shell.isCentered), 'max-w-[min(100%,260px)]')}
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
      className={cn(resolveNavBrandContainerClass(brandLayout, shell.isCentered), 'max-w-[min(100%,260px)]')}
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

  const linksNode = kitLinks.length > 0 && (
    <nav className={cn(
      'flex items-center gap-1 flex-wrap min-w-0',
      shell.isCentered ? 'justify-center' : 'justify-center',
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
            onClick={builderCanvas?.onNavigate && !isEditorCanvas ? (e) => {
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
              shell.isCompact ? 'py-1.5' : 'py-3',
            ),
            shell.isCentered
              ? 'flex flex-col items-center text-center gap-2'
              : 'flex items-center justify-between gap-3',
            shell.isElevated && '!mx-3 sm:!mx-4 !max-w-none mt-2 rounded-xl shadow-lg border border-black/5',
          )}
        >
          {shell.isCentered ? (
            <>
              {logoNode}
              {linksNode}
              {actionsNode}
            </>
          ) : (
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
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
          )}
        </div>
      </header>
    </>
  )
}
