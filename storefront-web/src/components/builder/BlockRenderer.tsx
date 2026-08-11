
/**
 * BlockRenderer — maps every wb_block type to its storefront React component.
 *
 * This is the core of the P0 milestone: once a site is published via the
 * vendor builder, the storefront fetches the wb_* data from /public/sites/
 * and renders it here, block by block.
 *
 * Design decisions:
 *  - Each block receives `props` (content), `style` (the site-level StyleConfig),
 *    and `overrides` (block-level style_overrides) — they merge to compute the
 *    final look.
 *  - Blocks that need live ERP data fetch it lazily via publicSitesApi.
 *  - Unknown block types render a neutral placeholder in dev, nothing in prod.
 */
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { PublicBlock, PublicSite, LiveItem, StyleConfig } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'
import { useVendor } from '@/contexts/VendorContext'
import { useLiveDataFetch } from '@/contexts/LiveDataFetchContext'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { buildSiteThemeCss, sanitizeCustomCss } from '@/lib/siteThemeCss'
import { normalizeSiteBorderRadius } from '@/lib/siteBorderRadius'
import NavBlock from '@/components/builder/blocks/NavBlock'
import FooterBlock from '@/components/builder/blocks/FooterBlock'
import ProductGridBlock from '@/components/builder/blocks/ProductGridBlock'
import SectionShapeDivider from './SectionShapeDivider'
import { BlockOverlayLayers } from './BlockOverlayLayers'
import { overlayMinContainerHeight, type BlockOverlayItem } from '@/lib/blockOverlays'
import { buildBlockColorStyleCss, type BlockColorProps, type ThemeColors } from '@/lib/blockColorOverrides'
import { blockShadowIsActive, resolveBlockBoxShadow } from '@/lib/blockSectionStyle'
import { buildFieldStylesCss, sectionTransformStyle } from '@/lib/fieldTextStyles'
import { getBlockScrollAnimationClass } from '@/lib/builderScrollAnimations'
import { blockTypeSupportsBlockLink } from '@/lib/blockLinkPolicy'
import {
  buildResponsiveSectionSpacingCss,
  mergeBlockSectionStyles,
  readRawBlockStyleOverrides,
  resolveBlockSectionSpacing,
  resolveBreakpointStyleOverrides,
} from '@/lib/blockStyleOverrides'
import {
  mergePageStyle,
  splitLeadingShellBlocks,
  splitTrailingShellBlocks,
} from '@/lib/blockRendererUtils'

/** Retry once on Vite stale-chunk / Windows @fs failures before surfacing to the route error boundary. */
function lazyBlock<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await importer()
    } catch (first) {
      await new Promise(r => setTimeout(r, 250))
      try {
        return await importer()
      } catch {
        throw first
      }
    }
  })
}

// Lazy-import heavy block families; nav/footer/product grid stay eager
// (common shells + unreliable @fs / HMR lazy chunks on Windows).
const HeroBlock = lazyBlock(() => import('@/components/builder/blocks/HeroBlock'))
const FeaturesBlock = lazyBlock(() => import('@/components/builder/blocks/FeaturesBlock'))
const ServicesCardsBlock = lazyBlock(() => import('@/components/builder/blocks/ServicesCardsBlock'))
const RentalGridBlock = lazyBlock(() => import('@/components/builder/blocks/RentalGridBlock'))
const TestimonialsBlock = lazyBlock(() => import('@/components/builder/blocks/TestimonialsBlock'))
const TeamGridBlock = lazyBlock(() => import('@/components/builder/blocks/TeamGridBlock'))
const StatsBlock = lazyBlock(() => import('@/components/builder/blocks/StatsBlock'))
const CtaBlock = lazyBlock(() => import('@/components/builder/blocks/CtaBlock'))
const ContactFormBlock = lazyBlock(() => import('@/components/builder/blocks/ContactFormBlock'))
const MapEmbedBlock = lazyBlock(() => import('@/components/builder/blocks/MapEmbedBlock'))
const FaqBlock = lazyBlock(() => import('@/components/builder/blocks/FaqBlock'))
const PricingBlock = lazyBlock(() => import('@/components/builder/blocks/PricingBlock'))
const RichTextBlock = lazyBlock(() => import('@/components/builder/blocks/RichTextBlock'))
const ImageBlock = lazyBlock(() => import('@/components/builder/blocks/ImageBlock'))
const VideoEmbedBlock = lazyBlock(() => import('@/components/builder/blocks/VideoEmbedBlock'))
const GalleryMasonryBlock = lazyBlock(() => import('@/components/builder/blocks/GalleryMasonryBlock'))
const PortfolioGridBlock = lazyBlock(() => import('@/components/builder/blocks/PortfolioGridBlock'))
const VideoGalleryBlock = lazyBlock(() => import('@/components/builder/blocks/VideoGalleryBlock'))
const SocialLinksBlock = lazyBlock(() => import('@/components/builder/blocks/SocialLinksBlock'))
const CountdownBlock = lazyBlock(() => import('@/components/builder/blocks/CountdownBlock'))
const AnnouncementBarBlock = lazyBlock(() => import('@/components/builder/blocks/AnnouncementBarBlock'))
const MarqueeStripBlock = lazyBlock(() => import('@/components/builder/blocks/MarqueeStripBlock'))
const NewsletterBlock = lazyBlock(() => import('@/components/builder/blocks/NewsletterBlock'))
const TrustLogosBlock = lazyBlock(() => import('@/components/builder/blocks/TrustLogosBlock'))
const TimelineBlock = lazyBlock(() => import('@/components/builder/blocks/TimelineBlock'))
const AboutSplitBlock = lazyBlock(() => import('@/components/builder/blocks/AboutSplitBlock'))
const BookingWidgetBlock = lazyBlock(() => import('@/components/builder/blocks/BookingWidgetBlock'))
const BookingSlotPickerBlock = lazyBlock(() => import('@/components/builder/blocks/BookingSlotPickerBlock'))
const LiveStockBlock = lazyBlock(() => import('@/components/builder/blocks/LiveStockBlock'))
const OrderStatusBlock = lazyBlock(() => import('@/components/builder/blocks/OrderStatusBlock'))
const CouponBannerBlock = lazyBlock(() => import('@/components/builder/blocks/CouponBannerBlock'))
const PaymentMethodsStripBlock = lazyBlock(() => import('@/components/builder/blocks/PaymentMethodsStripBlock'))
const ProductReviewsBlock = lazyBlock(() => import('@/components/builder/blocks/ProductReviewsBlock'))
const SearchBarBlock = lazyBlock(() => import('@/components/builder/blocks/SearchBarBlock'))
const CookieConsentBlock = lazyBlock(() => import('@/components/builder/blocks/CookieConsentBlock'))
const ProductDetailBlock = lazyBlock(() => import('@/components/builder/blocks/ProductDetailBlock'))
const CheckoutFormBlock = lazyBlock(() => import('@/components/builder/blocks/CheckoutFormBlock'))
const RecentlyViewedBlock = lazyBlock(() => import('@/components/builder/blocks/RecentlyViewedBlock'))
const ProductFiltersBlock = lazyBlock(() => import('@/components/builder/blocks/ProductFiltersBlock'))
const BlogGridBlock = lazyBlock(() => import('@/components/builder/blocks/BlogGridBlock'))
const CartDrawerBlock = lazyBlock(() => import('@/components/builder/blocks/CartDrawerBlock'))
const LiveQuoteBlock = lazyBlock(() => import('@/components/builder/blocks/LiveQuoteBlock'))
const CommerceLibraryBlock = lazyBlock(() => import('@/components/builder/blocks/CommerceLibraryBlock'))
const HtmlEmbedBlock = lazyBlock(() => import('@/components/builder/blocks/HtmlEmbedBlock'))

export interface BlockProps {
  block: PublicBlock
  site: PublicSite
  style: StyleConfig
  /** If provided, live ERP data is pre-loaded. */
  liveData?: { items: LiveItem[]; count: number }
  branchCode?: string | null
}

function BlockSkeleton() {
  return <div className="w-full py-8 bg-gray-50 animate-pulse rounded" />
}

/** Shell / chrome blocks load without a skeleton pulse. */
const SUSPENSE_NULL_FALLBACK_BLOCKS = new Set([
  'nav', 'footer', 'announcement_bar', 'marquee_strip',
  'search_bar', 'cookie_consent', 'recently_viewed', 'cart_drawer',
])

// ── Live data hook ─────────────────────────────────────────────────────────

type LiveResource = 'products' | 'services' | 'rentals' | 'testimonials' | 'team' | 'kpis' | 'profile' | 'pages' | 'categories' | 'customers' | 'orders' | 'bookings' | 'media' | 'stores' | 'blog' | 'plans' | 'properties' | 'courses' | 'fitness_classes' | 'vehicles' | 'events' | 'recurring_plans' | 'booking_wizard_steps' | 'booking_resources'

const BLOCK_LIVE_RESOURCE: Record<string, LiveResource> = {
  product_grid: 'products', live_stock: 'products', live_quote: 'products', related_products: 'products', product_detail: 'products',
  cart_drawer: 'products',
  category_cards: 'categories',
  services_cards: 'services', booking_widget: 'services', booking_slot_picker: 'services', services_list: 'services',
  rental_grid: 'rentals', rental_list: 'rentals',
  testimonials: 'testimonials', testimonials_grid: 'testimonials', product_reviews: 'testimonials',
  team_grid: 'team',
  stats: 'kpis',
  contact_form: 'profile', map_embed: 'profile', about_split: 'profile', social_links: 'profile',
  footer: 'pages', nav: 'pages',
  product_filters: 'categories',
  gallery_masonry: 'media', portfolio_grid: 'media',
  trust_logos: 'customers',
  blog_grid: 'blog', blog_featured: 'blog', blog_list: 'blog',
  pricing: 'plans',
  'service.pricing': 'plans',
  'vertical.propertyListing': 'properties',
  'vertical.propertyDetail': 'properties',
  'vertical.courseCatalog': 'courses',
  'vertical.courseDetail': 'courses',
  'vertical.fitnessSchedule': 'fitness_classes',
  'vertical.autoInventory': 'vehicles',
  'vertical.vehicleDetail': 'vehicles',
  'vertical.eventListing': 'events',
  'vertical.ticketPicker': 'events',
  'booking.recurring': 'recurring_plans',
  // Explicit override — without this, inferCommerceLiveResource()'s generic 'booking.' prefix match
  // would wrongly connect this to the unrelated 'bookings' resource.
  'booking.wizard': 'booking_wizard_steps',
  'booking.resource': 'booking_resources',
}

function inferCommerceLiveResource(blockType: string): LiveResource | undefined {
  if (blockType.startsWith('product.')) return blockType.includes('categories') || blockType.includes('filters') ? 'categories' : 'products'
  if (blockType.startsWith('service.')) {
    if (blockType.includes('testimonial')) return 'testimonials'
    if (blockType.includes('team')) return 'team'
    if (blockType.includes('pricing')) return 'plans'
    return 'services'
  }
  if (blockType.startsWith('menu.')) return 'products'
  if (blockType.startsWith('booking.')) return 'bookings'
  if (blockType.startsWith('commerce.')) return 'products'
  return undefined
}

/** Prefer embedded site pages (builder draft / hydrated public site) over a network fetch. */
function sitePagesToLiveItems(site: PublicSite, limit: number): LiveItem[] {
  const pages = site.pages || []
  if (!pages.length) return []
  const seen = new Set<string>()
  const items: LiveItem[] = []
  const sorted = [...pages]
    .filter(p => p.show_in_nav !== false && p.is_published !== false)
    .sort((a, b) => {
      if (a.is_homepage !== b.is_homepage) return a.is_homepage ? -1 : 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
  for (const page of sorted) {
    let url = page.is_homepage ? '/' : `/${String(page.slug || '').replace(/^\/+|\/+$/g, '')}`
    if (url === '/home') url = '/'
    if (seen.has(url)) continue
    seen.add(url)
    items.push({
      id: page.id,
      title: page.title?.trim() || (page.is_homepage ? 'Home' : (page.slug || 'Page')),
      subtitle: page.slug,
      url,
      meta: {
        is_homepage: page.is_homepage,
        slug: page.slug,
        page_type: page.page_type,
      },
    })
    if (items.length >= limit) break
  }
  return items
}

function resolveLiveSiteId(site: PublicSite): string {
  const override = (site.live_site_id || site.source_site_id || '').trim()
  return override || site.id
}

function useLiveData(block: PublicBlock, site: PublicSite, limit = 12) {
  const customFetch = useLiveDataFetch()
  const dataSource = block.props?.data_source as { type?: string; selected_ids?: string[]; limit?: number; auto?: boolean } | undefined
  const sourceType = typeof dataSource?.type === 'string'
    ? dataSource.type.replace(/^internal_/, '')
    : undefined
  const resource = (sourceType && sourceType !== 'external_api' ? sourceType : BLOCK_LIVE_RESOURCE[block.block_type] || inferCommerceLiveResource(block.block_type)) as LiveResource | undefined
  const effectiveLimit = Number(dataSource?.limit ?? limit) || limit
  const liveSiteId = resolveLiveSiteId(site)
  const embeddedPagesKey = resource === 'pages'
    ? (site.pages || []).map(p => `${p.id}:${p.slug}:${p.title}:${p.show_in_nav}:${p.is_homepage}`).join('|')
    : ''
  const [data, setData] = useState<LiveItem[] | null>(null)

  useEffect(() => {
    if (!resource || !liveSiteId) { setData([]); return }
    if (resource === 'pages' && site.pages?.length) {
      setData(sitePagesToLiveItems(site, effectiveLimit))
      return
    }
    let cancelled = false
    const params = dataSource?.selected_ids?.length
      ? { ids: dataSource.selected_ids.join(',') }
      : undefined
    const selectedIds = dataSource?.selected_ids || []
    const applySelection = (items: LiveItem[]) =>
      selectedIds.length
        ? items.filter(item => item.id && selectedIds.includes(item.id))
        : items

    const apply = (items: LiveItem[]) => {
      if (!cancelled) setData(applySelection(items))
    }
    const applyEmpty = () => {
      // Only clear if this request is still current — a late failure must not
      // wipe a successful response from a newer effect run.
      if (!cancelled) setData([])
    }

    if (customFetch) {
      customFetch(liveSiteId, resource, effectiveLimit, params)
        .then(apply)
        .catch(applyEmpty)
      return () => { cancelled = true }
    }

    publicSitesApi.getLiveResource(liveSiteId, resource, effectiveLimit, params)
      .then(r => apply(r.items))
      .catch(applyEmpty)
    return () => { cancelled = true }
  }, [customFetch, liveSiteId, resource, effectiveLimit, embeddedPagesKey, dataSource?.selected_ids?.join(',')])

  return data
}

// ── Individual block renderer ──────────────────────────────────────────────

function blockLayoutKey(props: Record<string, unknown> | undefined): string {
  if (!props) return ''
  return [
    props.layout, props.variant, props.nav_style, props.nav_layout, props.footer_style,
    props.bg_style, props.bg_color, props.columns, props.image_position, props.card_style,
    props.show_stats, props.media_type,
    props.gradient_preset, props.nav_bg, props.footer_bg, props.overlay, props.compact,
    props.block_shadow, props.item_gap, props.image_height_pct, props.image_width_pct, props.image_aspect, props.image_object_fit, props.card_padding,
    props.show_stock, props.show_add_button, props.add_button_style, props.show_quantity_controls, props.show_badges, props.show_count, props.show_book_link,
  ].map(v => String(v ?? '')).join(':')
}

export function SingleBlock({
  block,
  site,
  style,
  branchCode,
  pageBlocks,
}: Omit<BlockProps, 'liveData'> & { pageBlocks?: PublicBlock[] }) {
  const { storePath } = useVendor()
  const customFetch = useLiveDataFetch()
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas ?? false
  const liveItems = useLiveData(block, site, (block.props.show_count as number | undefined) || 12)
  const p = block.props as Record<string, unknown>

  const commonProps = {
    site,
    style,
    props: p,
    liveItems: liveItems ?? [],
    branchCode,
    blockId: block.id,
    isEditorCanvas,
    pageBlocks: pageBlocks?.map(b => ({ block_type: b.block_type, props: b.props as Record<string, unknown> })),
  }

  const inner = (() => {
    if (block.block_type === 'service.pricing') {
      return <PricingBlock {...commonProps} />
    }
    if (block.block_type === 'service.faq') {
      return <FaqBlock {...commonProps} />
    }
    if (block.block_type.includes('.')) {
      return <CommerceLibraryBlock {...commonProps} blockType={block.block_type} />
    }
    switch (block.block_type) {
      case 'nav':              return <NavBlock {...commonProps} />
      case 'footer':           return <FooterBlock {...commonProps} />
      case 'announcement_bar': return <AnnouncementBarBlock {...commonProps} />
      case 'marquee_strip':    return <MarqueeStripBlock style={style} props={p} blockId={block.id} />
      case 'hero':
      case 'hero_split':
      case 'hero_minimal':     return <HeroBlock {...commonProps} blockType={block.block_type} />
      case 'features':
      case 'features_alternating':
      case 'features_icons':   return <FeaturesBlock {...commonProps} blockType={block.block_type} />
      case 'product_detail':   return <ProductDetailBlock {...commonProps} />
      case 'checkout_form':    return <CheckoutFormBlock {...commonProps} />
      case 'product_grid':
      case 'menu_grid':
      case 'category_cards':
      case 'related_products': return <ProductGridBlock {...commonProps} blockType={block.block_type} />
      case 'services_cards':
      case 'services_list':    return <ServicesCardsBlock {...commonProps} />
      case 'rental_grid':
      case 'rental_list':      return <RentalGridBlock {...commonProps} />
      case 'testimonials':
      case 'testimonials_grid': return <TestimonialsBlock {...commonProps} />
      case 'product_reviews':  return <ProductReviewsBlock {...commonProps} />
      case 'team_grid':
      case 'team_list':        return <TeamGridBlock {...commonProps} />
      case 'stats':            return <StatsBlock {...commonProps} />
      case 'cta':              return <CtaBlock {...commonProps} />
      case 'contact_form':     return <ContactFormBlock {...commonProps} />
      case 'map_embed':
      case 'map_contact':      return <MapEmbedBlock {...commonProps} />
      case 'faq':              return <FaqBlock {...commonProps} />
      case 'pricing':          return <PricingBlock {...commonProps} />
      case 'rich_text':        return <RichTextBlock {...commonProps} />
      case 'image_block':      return <ImageBlock {...commonProps} />
      case 'video_embed':      return <VideoEmbedBlock {...commonProps} />
      case 'gallery_masonry':
      case 'gallery_grid':
      case 'image_gallery':      return <GalleryMasonryBlock {...commonProps} />
      case 'portfolio_grid':     return <PortfolioGridBlock {...commonProps} />
      case 'video_gallery':      return <VideoGalleryBlock {...commonProps} />
      case 'social_links':     return <SocialLinksBlock {...commonProps} />
      case 'countdown':        return <CountdownBlock {...commonProps} />
      case 'newsletter':       return <NewsletterBlock {...commonProps} />
      case 'trust_logos':      return <TrustLogosBlock {...commonProps} />
      case 'timeline':         return <TimelineBlock {...commonProps} />
      case 'about_split':      return <AboutSplitBlock {...commonProps} />
      case 'booking_widget':        return <BookingWidgetBlock {...commonProps} />
      case 'booking_slot_picker':   return <BookingSlotPickerBlock {...commonProps} />
      case 'live_stock':       return <LiveStockBlock {...commonProps} />
      case 'order_status':     return <OrderStatusBlock {...commonProps} />
      case 'coupon_banner':
      case 'offer_banner':
      case 'promo_strip':      return <CouponBannerBlock {...commonProps} />
      case 'payment_methods_strip': return <PaymentMethodsStripBlock {...commonProps} />
      case 'search_bar':       return <SearchBarBlock {...commonProps} />
      case 'cookie_consent':   return <CookieConsentBlock {...commonProps} />
      case 'recently_viewed':  return <RecentlyViewedBlock {...commonProps} />
      case 'product_filters':  return <ProductFiltersBlock {...commonProps} />
      case 'blog_grid':
      case 'blog_featured':
      case 'blog_list':        return <BlogGridBlock {...commonProps} blockType={block.block_type} />
      case 'cart_drawer':      return <CartDrawerBlock {...commonProps} />
      case 'live_quote':       return <LiveQuoteBlock {...commonProps} />
      case 'ab_test_block':
      case 'personalization_block':
        return (
          <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <h2 className="text-2xl font-bold mb-2" style={{ color: style.text_color }}>
                {(p.headline as string) || (p.default_content as string) || 'Personalized content'}
              </h2>
              {Boolean(p.subtitle || p.mobile_content) && (
                <p className="text-sm text-gray-500">
                  {(p.subtitle as string) || (p.mobile_content as string)}
                </p>
              )}
            </div>
          </section>
        )
      case 'divider':
        return (
          <div style={{ padding: `${Number(p.spacing ?? 40)}px 0` }}>
            <hr style={{ borderColor: (p.color as string) || '#e5e7eb' }} className="border-t" />
          </div>
        )
      case 'spacer':
        return <div style={{ height: `${Number(p.height ?? 80)}px` }} />
      case 'html_embed':
        return <HtmlEmbedBlock {...commonProps} />
      default:
        return import.meta.env.DEV
          ? <div className="py-4 px-6 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded">Unknown block type: <strong>{block.block_type}</strong></div>
          : null
    }
  })()

  if (!inner) return null

  /** Keep shell blocks above later sections so sticky nav / bars are not painted over by following content. */
  const shellStack =
    block.block_type === 'nav' || block.block_type === 'announcement_bar'
      ? 'z-[35]'
      : ''

  const tf = p.text_transform
  const textTransformCss =
    typeof tf === 'string' && ['uppercase', 'lowercase', 'capitalize'].includes(tf.toLowerCase())
      ? (tf.toLowerCase() as 'uppercase' | 'lowercase' | 'capitalize')
      : undefined
  const fontPxRaw = p.font_size_px as number | undefined
  const fontSizePx =
    typeof fontPxRaw === 'number' && Number.isFinite(fontPxRaw) && fontPxRaw > 0
      ? Math.round(Math.min(72, Math.max(8, fontPxRaw)))
      : undefined
  const textScaleRaw = p.text_scale as number | undefined
  const textScaleEm =
    !fontSizePx && typeof textScaleRaw === 'number' && Number.isFinite(textScaleRaw) && textScaleRaw > 0 && textScaleRaw !== 1
      ? textScaleRaw
      : undefined

  const topShape = typeof p.top_shape === 'string' ? p.top_shape : undefined
  const bottomShape = typeof p.bottom_shape === 'string' ? p.bottom_shape : undefined
  const shapeColor = (typeof p.shape_color === 'string' && p.shape_color) || style.surface_color || style.bg_color || '#ffffff'
  const hasShape = (topShape && topShape !== 'none') || (bottomShape && bottomShape !== 'none')
  const sfBid = `sf${block.id.replace(/-/g, '')}`
  const rawStyleOverrides = readRawBlockStyleOverrides(block)
  const previewBreakpoint = isEditorCanvas
    ? (builderCanvas?.previewBreakpoint ?? 'desktop')
    : 'desktop'
  const resolvedOverrides = resolveBreakpointStyleOverrides(rawStyleOverrides, previewBreakpoint)
  const sectionSpacing = resolveBlockSectionSpacing(block, previewBreakpoint)
  const responsiveSpacingCss = !isEditorCanvas
    ? buildResponsiveSectionSpacingCss(sfBid, block)
    : ''
  const useResponsiveSpacingCss = responsiveSpacingCss.length > 0
  const sectionStyles = mergeBlockSectionStyles(p, resolvedOverrides)
  const paddingTop = useResponsiveSpacingCss && !isEditorCanvas ? 0 : sectionSpacing.paddingTop
  const paddingBottom = useResponsiveSpacingCss && !isEditorCanvas ? 0 : sectionSpacing.paddingBottom
  const blockShadow = resolveBlockBoxShadow(p)
  const hasBlockShadow = blockShadowIsActive(p)
  const overlays = (Array.isArray(p.overlays) ? p.overlays : []) as BlockOverlayItem[]
  const overlayMinH = overlayMinContainerHeight(overlays)
  const minHeightRaw = p.min_height as number | undefined
  const minHeightPx =
    typeof minHeightRaw === 'number' && Number.isFinite(minHeightRaw) && minHeightRaw > 0
      ? Math.round(minHeightRaw)
      : 0
  const sectionMinHeight = Math.max(minHeightPx, overlayMinH)

  // Whole-section size — scales the section AND everything inside it (text, media,
  // padding) while still reflowing layout (unlike transform: scale, which would
  // leave gaps/overlap). `zoom` is the only CSS that grows the section's footprint.
  const sectionScale = (() => {
    if (useResponsiveSpacingCss && !isEditorCanvas) return undefined
    const s = sectionSpacing.sectionScale
    return s !== 1 ? s : undefined
  })()

  const wrapperStyle: CSSProperties = {}
  if (block.animation_delay) wrapperStyle.animationDelay = `${block.animation_delay}ms`
  if (textTransformCss) wrapperStyle.textTransform = textTransformCss
  if (paddingTop > 0) wrapperStyle.paddingTop = `${paddingTop}px`
  if (paddingBottom > 0) wrapperStyle.paddingBottom = `${paddingBottom}px`
  if (sectionStyles.backgroundColor) wrapperStyle.backgroundColor = sectionStyles.backgroundColor
  if (sectionStyles.color) wrapperStyle.color = sectionStyles.color
  if (hasShape) wrapperStyle.position = 'relative'
  if (sectionMinHeight > 0) wrapperStyle.minHeight = `${sectionMinHeight}px`
  if (blockShadow) wrapperStyle.boxShadow = blockShadow
  Object.assign(wrapperStyle, sectionTransformStyle(p))

  const blockColorProps = p as BlockColorProps
  const blockThemeColors: ThemeColors = {
    primary_color: style.primary_color || '#6366f1',
    text_color: style.text_color || '#111827',
    surface_color: style.surface_color || style.bg_color || '#f9fafb',
    bg_color: style.bg_color || '#ffffff',
  }
  const blockColorCss = buildBlockColorStyleCss('data-sf-bid', sfBid, blockColorProps, blockThemeColors)
  const fieldStyleCss = buildFieldStylesCss('data-sf-bid', sfBid, p)
  const blockLink = typeof p.block_link_url === 'string' ? p.block_link_url.trim() : ''
  const blockLinkNewTab = Boolean(p.block_link_new_tab)
  const resolvedBlockLink = blockLink
    ? blockLink.startsWith('http') || blockLink.startsWith('mailto:') || blockLink.startsWith('tel:') || blockLink.startsWith('#')
      ? blockLink
      : storePath(blockLink.startsWith('/') ? blockLink : `/${blockLink}`)
    : ''
  const enableBlockLink = Boolean(resolvedBlockLink) && !isEditorCanvas && blockTypeSupportsBlockLink(block.block_type)
  const blockSuspenseFallback = SUSPENSE_NULL_FALLBACK_BLOCKS.has(block.block_type)
    ? null
    : <BlockSkeleton />
  const overlayLayers = overlays.length > 0 && !isEditorCanvas
    ? <BlockOverlayLayers overlays={overlays} />
    : null
  const blockBody = (
    <>
      {inner}
      {overlayLayers}
    </>
  )
  const activateBlockLink = (eventTarget: EventTarget | null) => {
    if (!resolvedBlockLink || !(eventTarget instanceof HTMLElement)) return
    if (eventTarget.closest('a, button, input, textarea, select, label, [role="button"]')) return
    if (blockLinkNewTab) window.open(resolvedBlockLink, '_blank', 'noopener,noreferrer')
    else window.location.href = resolvedBlockLink
  }

  return (
    <div
      data-sf-bid={sfBid}
      data-block-id={block.id}
      role={enableBlockLink ? 'link' : undefined}
      tabIndex={enableBlockLink ? 0 : undefined}
      aria-label={enableBlockLink ? `Open ${resolvedBlockLink}` : undefined}
      onClick={enableBlockLink ? e => activateBlockLink(e.target) : undefined}
      onKeyDown={enableBlockLink ? e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activateBlockLink(e.target)
        }
      } : undefined}
      className={[
        'builder-block relative w-full',
        hasBlockShadow ? 'builder-block--has-shadow' : '',
        enableBlockLink ? 'cursor-pointer' : '',
        shellStack,
        sectionStyles.fontSizeClass,
        // Editor: honor canvas device preview (media queries see the browser, not canvas width).
        // Live: keep Tailwind responsive visibility classes.
        isEditorCanvas
          ? (
              (previewBreakpoint === 'mobile' && block.visible_on_mobile === false)
              || (previewBreakpoint === 'tablet' && block.visible_on_tablet === false)
              || (previewBreakpoint === 'desktop' && block.visible_on_desktop === false)
                ? 'hidden'
                : ''
            )
          : [
              !block.visible_on_mobile ? 'hidden sm:block' : '',
              !block.visible_on_tablet ? 'sm:hidden lg:block' : '',
              !block.visible_on_desktop ? 'lg:hidden' : '',
            ].filter(Boolean).join(' '),
        getBlockScrollAnimationClass(block.animation),
      ].filter(Boolean).join(' ')}
      style={Object.keys(wrapperStyle).length ? wrapperStyle : undefined}
    >
      {topShape && topShape !== 'none' && (
        <SectionShapeDivider shape={topShape} fillColor={shapeColor} position="top" />
      )}
      {(fontSizePx || textScaleEm || blockColorCss || fieldStyleCss || responsiveSpacingCss) && (
        <style>{`
          [data-sf-bid="${sfBid}"] h1,
          [data-sf-bid="${sfBid}"] h2,
          [data-sf-bid="${sfBid}"] h3,
          [data-sf-bid="${sfBid}"] h4,
          [data-sf-bid="${sfBid}"] p,
          [data-sf-bid="${sfBid}"] li,
          [data-sf-bid="${sfBid}"] blockquote,
          [data-sf-bid="${sfBid}"] [data-text-key] {
            ${fontSizePx ? `font-size: ${fontSizePx}px !important;` : ''}
            ${textScaleEm ? `font-size: ${textScaleEm}em !important;` : ''}
          }
          ${blockColorCss}
          ${fieldStyleCss}
          ${responsiveSpacingCss}
        `}</style>
      )}
      {sectionScale ? (
        // Scale is applied to an inner wrapper (NOT the measured .builder-block
        // element) so the builder's selection/handle overlay — which reads
        // offsetWidth/getBoundingClientRect on the outer element — stays aligned.
        // `zoom` still reflows, so the outer element grows/shrinks to fit.
        <div className="builder-block-zoom-wrap" style={{ zoom: sectionScale } as CSSProperties}>
          <Suspense fallback={blockSuspenseFallback}>{blockBody}</Suspense>
        </div>
      ) : (
        <Suspense fallback={blockSuspenseFallback}>{blockBody}</Suspense>
      )}
      {bottomShape && bottomShape !== 'none' && (
        <SectionShapeDivider shape={bottomShape} fillColor={shapeColor} position="bottom" />
      )}
    </div>
  )
}

// ── Main renderer ──────────────────────────────────────────────────────────

/** Normalize branch id/code from URL or JSON so 1000 matches "1000". */
function branchKey(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function blockVisibleForBranch(block: PublicBlock, branchFromUrl: string): boolean {
  if (!block.visible) return false
  const raw = block.visible_branches as unknown
  const list = Array.isArray(raw) ? raw : []
  if (!branchFromUrl || list.length === 0) return true
  return list.some((vb) => branchKey(vb) === branchFromUrl)
}

interface BlockRendererProps {
  blocks: PublicBlock[]
  site: PublicSite
  /** When set, merges style_config.page_styles[pageId] onto site theme. */
  pageId?: string | null
  /** Query-string branch code for branch-scoped visibility. */
  branchCode?: string | null
  /** Builder canvas pins shell outside transform — skip inner sticky wrapper. */
  suppressShellSticky?: boolean
}

export default function BlockRenderer({ blocks, site, pageId, branchCode, suppressShellSticky = false }: BlockRendererProps) {
  const style = mergePageStyle(site.style_config as Partial<StyleConfig>, pageId)
  const location = useLocation()
  const branchTrim = branchKey(branchCode)

  const { visibleBlocks, visibleCountIgnoringBranch } = useMemo(() => {
    const visibleCountIgnoringBranch = blocks.filter((b) => b.visible).length
    const visibleBlocks = blocks.filter((b) => blockVisibleForBranch(b, branchTrim))
    return { visibleBlocks, visibleCountIgnoringBranch }
  }, [blocks, branchTrim])

  const clearBranchHref = useMemo(() => {
    const next = new URLSearchParams(location.search)
    next.delete('branch')
    const qs = next.toString()
    return `${location.pathname}${qs ? `?${qs}` : ''}`
  }, [location.pathname, location.search])

  if (branchTrim && visibleBlocks.length === 0 && visibleCountIgnoringBranch > 0) {
    return (
      <div
        className="builder-page min-w-0 overflow-x-clip min-h-[50vh] flex flex-col items-center justify-center px-6 py-16 text-center"
        style={{ backgroundColor: style.bg_color, color: style.text_color, fontFamily: style.font_body }}
      >
        <p className="text-lg font-medium text-balance max-w-md">
          No sections are configured for location <span className="font-mono font-semibold">{branchTrim}</span>.
        </p>
        <p className="mt-2 text-sm opacity-80 max-w-md">
          Open the site without a branch filter, or pick another location from the header if available.
        </p>
        <Link
          to={clearBranchHref}
          className="mt-6 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: style.primary_color }}
        >
          View full site
        </Link>
      </div>
    )
  }

  const { shellBlocks, contentBlocks: afterLeadingShell } = splitLeadingShellBlocks(visibleBlocks)
  const { middleBlocks, trailingShellBlocks } = splitTrailingShellBlocks(afterLeadingShell)

  const pageStyle = {
    backgroundColor: style.bg_color,
    color: style.text_color,
    fontFamily: style.font_body,
  } as const

  const renderBlock = (block: PublicBlock) => (
    <SingleBlock
      key={`${block.id}:${blockLayoutKey(block.props as Record<string, unknown>)}`}
      block={block}
      site={site}
      style={style}
      branchCode={branchCode}
      pageBlocks={visibleBlocks}
    />
  )

  const siteRadiusMode = normalizeSiteBorderRadius(style.border_radius)

  const renderShell = shellBlocks.length > 0 && !suppressShellSticky
  const blocksToRender = suppressShellSticky ? visibleBlocks : middleBlocks
  const trailingToRender = suppressShellSticky ? [] : trailingShellBlocks

  const pageCustomCss = sanitizeCustomCss(style.custom_css)

  return (
    <div className="builder-page min-w-0" style={pageStyle} data-site-radius={siteRadiusMode}>
      <style>{buildSiteThemeCss(style)}</style>
      {pageCustomCss ? <style data-page-custom-css>{pageCustomCss}</style> : null}
      {renderShell && (
        <div className="sticky top-0 z-50 w-full">
          {shellBlocks.map(renderBlock)}
        </div>
      )}
      <div className="builder-page-content min-w-0 overflow-x-clip">
        {blocksToRender.map(renderBlock)}
      </div>
      {trailingToRender.map(renderBlock)}
    </div>
  )
}
