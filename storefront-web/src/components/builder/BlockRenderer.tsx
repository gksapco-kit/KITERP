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
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { PublicBlock, PublicSite, LiveItem, StyleConfig } from '@/blocks/registry'
import { DEFAULT_STYLE } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'
import { useVendor } from '@/contexts/VendorContext'
import { useLiveDataFetch } from '@/contexts/LiveDataFetchContext'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import NavBlock from '@/components/builder/blocks/NavBlock'
import FooterBlock from '@/components/builder/blocks/FooterBlock'
import SectionShapeDivider from './SectionShapeDivider'
import { BlockOverlayLayers } from './BlockOverlayLayers'
import { overlayMinContainerHeight, type BlockOverlayItem } from '@/lib/blockOverlays'
import { buildBlockColorStyleCss, type BlockColorProps, type ThemeColors } from '@/lib/blockColorOverrides'
import { blockShadowIsActive, resolveBlockBoxShadow } from '@/lib/blockSectionStyle'
import { buildFieldStylesCss, sectionTransformStyle } from '@/lib/fieldTextStyles'
import { getBlockScrollAnimationClass } from '@/lib/builderScrollAnimations'
import {
  mergeBlockSectionStyles,
  readRawBlockStyleOverrides,
  resolveBreakpointStyleOverrides,
} from '@/lib/blockStyleOverrides'

// Lazy-import heavy block families; nav/footer stay eager (every page, unreliable @fs lazy on Windows).
const HeroBlock = lazy(() => import('@/components/builder/blocks/HeroBlock'))
const FeaturesBlock = lazy(() => import('@/components/builder/blocks/FeaturesBlock'))
const ProductGridBlock = lazy(() => import('@/components/builder/blocks/ProductGridBlock'))
const ServicesCardsBlock = lazy(() => import('@/components/builder/blocks/ServicesCardsBlock'))
const TestimonialsBlock = lazy(() => import('@/components/builder/blocks/TestimonialsBlock'))
const TeamGridBlock = lazy(() => import('@/components/builder/blocks/TeamGridBlock'))
const StatsBlock = lazy(() => import('@/components/builder/blocks/StatsBlock'))
const CtaBlock = lazy(() => import('@/components/builder/blocks/CtaBlock'))
const ContactFormBlock = lazy(() => import('@/components/builder/blocks/ContactFormBlock'))
const MapEmbedBlock = lazy(() => import('@/components/builder/blocks/MapEmbedBlock'))
const FaqBlock = lazy(() => import('@/components/builder/blocks/FaqBlock'))
const PricingBlock = lazy(() => import('@/components/builder/blocks/PricingBlock'))
const RichTextBlock = lazy(() => import('@/components/builder/blocks/RichTextBlock'))
const ImageBlock = lazy(() => import('@/components/builder/blocks/ImageBlock'))
const VideoEmbedBlock = lazy(() => import('@/components/builder/blocks/VideoEmbedBlock'))
const GalleryMasonryBlock = lazy(() => import('@/components/builder/blocks/GalleryMasonryBlock'))
const SocialLinksBlock = lazy(() => import('@/components/builder/blocks/SocialLinksBlock'))
const CountdownBlock = lazy(() => import('@/components/builder/blocks/CountdownBlock'))
const AnnouncementBarBlock = lazy(() => import('@/components/builder/blocks/AnnouncementBarBlock'))
const MarqueeStripBlock = lazy(() => import('@/components/builder/blocks/MarqueeStripBlock'))
const NewsletterBlock = lazy(() => import('@/components/builder/blocks/NewsletterBlock'))
const TrustLogosBlock = lazy(() => import('@/components/builder/blocks/TrustLogosBlock'))
const TimelineBlock = lazy(() => import('@/components/builder/blocks/TimelineBlock'))
const AboutSplitBlock = lazy(() => import('@/components/builder/blocks/AboutSplitBlock'))
const BookingWidgetBlock = lazy(() => import('@/components/builder/blocks/BookingWidgetBlock'))
const BookingSlotPickerBlock = lazy(() => import('@/components/builder/blocks/BookingSlotPickerBlock'))
const LiveStockBlock = lazy(() => import('@/components/builder/blocks/LiveStockBlock'))
const OrderStatusBlock = lazy(() => import('@/components/builder/blocks/OrderStatusBlock'))
const CouponBannerBlock = lazy(() => import('@/components/builder/blocks/CouponBannerBlock'))
const PaymentMethodsStripBlock = lazy(() => import('@/components/builder/blocks/PaymentMethodsStripBlock'))
const ProductReviewsBlock = lazy(() => import('@/components/builder/blocks/ProductReviewsBlock'))
const SearchBarBlock = lazy(() => import('@/components/builder/blocks/SearchBarBlock'))
const CookieConsentBlock = lazy(() => import('@/components/builder/blocks/CookieConsentBlock'))
const ProductDetailBlock = lazy(() => import('@/components/builder/blocks/ProductDetailBlock'))
const CheckoutFormBlock = lazy(() => import('@/components/builder/blocks/CheckoutFormBlock'))
const RecentlyViewedBlock = lazy(() => import('@/components/builder/blocks/RecentlyViewedBlock'))
const ProductFiltersBlock = lazy(() => import('@/components/builder/blocks/ProductFiltersBlock'))
const BlogGridBlock = lazy(() => import('@/components/builder/blocks/BlogGridBlock'))
const CartDrawerBlock = lazy(() => import('@/components/builder/blocks/CartDrawerBlock'))
const LiveQuoteBlock = lazy(() => import('@/components/builder/blocks/LiveQuoteBlock'))
const CommerceLibraryBlock = lazy(() => import('@/components/builder/blocks/CommerceLibraryBlock'))

// ── Context helpers ────────────────────────────────────────────────────────

export function mergeStyle(site: Partial<StyleConfig>, overrides: Record<string, unknown> = {}): StyleConfig {
  return { ...DEFAULT_STYLE, ...site, ...(overrides as Partial<StyleConfig>) }
}

export function mergePageStyle(site: Partial<StyleConfig>, pageId?: string | null): StyleConfig {
  const pageStyles = (site as { page_styles?: Record<string, Record<string, unknown>> }).page_styles
  const pageOverrides = pageId && pageStyles ? pageStyles[pageId] : undefined
  return mergeStyle(site, pageOverrides || {})
}

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

type LiveResource = 'products' | 'services' | 'testimonials' | 'team' | 'kpis' | 'profile' | 'pages' | 'categories' | 'customers' | 'orders' | 'bookings' | 'media' | 'stores'

const BLOCK_LIVE_RESOURCE: Record<string, LiveResource> = {
  product_grid: 'products', live_stock: 'products', live_quote: 'products', related_products: 'products', product_detail: 'products',
  cart_drawer: 'products',
  category_cards: 'categories',
  services_cards: 'services', booking_widget: 'services', booking_slot_picker: 'services', services_list: 'services',
  testimonials: 'testimonials', testimonials_grid: 'testimonials', product_reviews: 'testimonials',
  team_grid: 'team',
  stats: 'kpis',
  contact_form: 'profile', map_embed: 'profile', about_split: 'profile', social_links: 'profile',
  footer: 'pages', nav: 'pages',
  product_filters: 'categories',
  gallery_masonry: 'media', portfolio_grid: 'media',
  trust_logos: 'customers',
}

function inferCommerceLiveResource(blockType: string): LiveResource | undefined {
  if (blockType.startsWith('product.')) return blockType.includes('categories') || blockType.includes('filters') ? 'categories' : 'products'
  if (blockType.startsWith('service.')) {
    if (blockType.includes('testimonial')) return 'testimonials'
    if (blockType.includes('team')) return 'team'
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

function useLiveData(block: PublicBlock, site: PublicSite, limit = 12) {
  const customFetch = useLiveDataFetch()
  const dataSource = block.props?.data_source as { type?: string; selected_ids?: string[]; limit?: number; auto?: boolean } | undefined
  const sourceType = typeof dataSource?.type === 'string'
    ? dataSource.type.replace(/^internal_/, '')
    : undefined
  const resource = (sourceType && sourceType !== 'external_api' ? sourceType : BLOCK_LIVE_RESOURCE[block.block_type] || inferCommerceLiveResource(block.block_type)) as LiveResource | undefined
  const effectiveLimit = Number(dataSource?.limit ?? limit) || limit
  const embeddedPagesKey = resource === 'pages'
    ? (site.pages || []).map(p => `${p.id}:${p.slug}:${p.title}:${p.show_in_nav}:${p.is_homepage}`).join('|')
    : ''
  const [data, setData] = useState<LiveItem[] | null>(null)

  useEffect(() => {
    if (!resource || !site.id) { setData([]); return }
    if (resource === 'pages' && site.pages?.length) {
      setData(sitePagesToLiveItems(site, effectiveLimit))
      return
    }
    const params = dataSource?.selected_ids?.length
      ? { ids: dataSource.selected_ids.join(',') }
      : undefined
    const selectedIds = dataSource?.selected_ids || []
    const applySelection = (items: LiveItem[]) =>
      selectedIds.length
        ? items.filter(item => item.id && selectedIds.includes(item.id))
        : items

    if (customFetch) {
      customFetch(site.id, resource, effectiveLimit, params)
        .then(items => setData(applySelection(items)))
        .catch(() => setData([]))
      return
    }

    publicSitesApi.getLiveResource(site.id, resource, effectiveLimit, params)
      .then(r => setData(applySelection(r.items)))
      .catch(() => setData([]))
  }, [customFetch, site.id, resource, effectiveLimit, embeddedPagesKey, dataSource?.selected_ids?.join(',')])

  return data
}

// ── Individual block renderer ──────────────────────────────────────────────

function blockLayoutKey(props: Record<string, unknown> | undefined): string {
  if (!props) return ''
  return [
    props.layout, props.variant, props.nav_style, props.nav_layout, props.footer_style,
    props.bg_style, props.bg_color, props.columns, props.image_position, props.card_style,
    props.gradient_preset, props.nav_bg, props.footer_bg, props.overlay, props.compact,
    props.block_shadow, props.item_gap, props.image_height_pct, props.card_padding,
    props.show_stock, props.show_add_button, props.show_badges, props.show_count, props.show_book_link,
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
    if (block.block_type.includes('.')) {
      return <CommerceLibraryBlock {...commonProps} blockType={block.block_type} />
    }
    switch (block.block_type) {
      case 'nav':              return <NavBlock {...commonProps} />
      case 'footer':           return <FooterBlock {...commonProps} />
      case 'announcement_bar': return <AnnouncementBarBlock {...commonProps} />
      case 'marquee_strip':    return <MarqueeStripBlock style={style} props={p} />
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
      case 'image_gallery':
      case 'portfolio_grid':   return <GalleryMasonryBlock {...commonProps} />
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
      case 'blog_list':        return <BlogGridBlock {...commonProps} />
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
        return <div className="w-full" dangerouslySetInnerHTML={{ __html: (p.html as string) || '' }} />
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
  const rawStyleOverrides = readRawBlockStyleOverrides(block)
  const resolvedOverrides = resolveBreakpointStyleOverrides(rawStyleOverrides)
  const sectionStyles = mergeBlockSectionStyles(p, resolvedOverrides)
  const paddingTop = sectionStyles.paddingTop
  const paddingBottom = sectionStyles.paddingBottom
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
  const sectionScaleRaw = p.section_scale as number | undefined
  const sectionScale =
    typeof sectionScaleRaw === 'number' && Number.isFinite(sectionScaleRaw) && sectionScaleRaw > 0 && sectionScaleRaw !== 1
      ? Math.min(2, Math.max(0.5, sectionScaleRaw))
      : undefined

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

  const sfBid = `sf${block.id.replace(/-/g, '')}`
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
      role={resolvedBlockLink ? 'link' : undefined}
      tabIndex={resolvedBlockLink ? 0 : undefined}
      aria-label={resolvedBlockLink ? `Open ${resolvedBlockLink}` : undefined}
      onClick={resolvedBlockLink ? e => activateBlockLink(e.target) : undefined}
      onKeyDown={resolvedBlockLink ? e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activateBlockLink(e.target)
        }
      } : undefined}
      className={[
        'builder-block relative w-full',
        hasBlockShadow ? 'builder-block--has-shadow' : '',
        resolvedBlockLink ? 'cursor-pointer' : '',
        shellStack,
        sectionStyles.fontSizeClass,
        !block.visible_on_mobile ? 'hidden sm:block' : '',
        !block.visible_on_tablet ? 'sm:hidden lg:block' : '',
        !block.visible_on_desktop ? 'lg:hidden' : '',
        getBlockScrollAnimationClass(block.animation),
      ].filter(Boolean).join(' ')}
      style={Object.keys(wrapperStyle).length ? wrapperStyle : undefined}
    >
      {topShape && topShape !== 'none' && (
        <SectionShapeDivider shape={topShape} fillColor={shapeColor} position="top" />
      )}
      {(fontSizePx || textScaleEm || blockColorCss || fieldStyleCss) && (
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
        `}</style>
      )}
      {sectionScale ? (
        // Scale is applied to an inner wrapper (NOT the measured .builder-block
        // element) so the builder's selection/handle overlay — which reads
        // offsetWidth/getBoundingClientRect on the outer element — stays aligned.
        // `zoom` still reflows, so the outer element grows/shrinks to fit.
        <div style={{ zoom: sectionScale } as CSSProperties}>
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
}

const SHELL_BLOCK_TYPES = new Set(['nav', 'announcement_bar'])

/** Leading announcement/nav blocks stay outside overflow-x-clip so sticky headers work. */
function splitLeadingShellBlocks(blocks: PublicBlock[]) {
  const shellBlocks: PublicBlock[] = []
  let index = 0
  while (index < blocks.length) {
    const blockType = blocks[index]?.block_type
    if (!blockType || !SHELL_BLOCK_TYPES.has(blockType)) break
    shellBlocks.push(blocks[index])
    index += 1
  }
  return { shellBlocks, contentBlocks: blocks.slice(index) }
}

export default function BlockRenderer({ blocks, site, pageId, branchCode }: BlockRendererProps) {
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

  const { shellBlocks, contentBlocks } = splitLeadingShellBlocks(visibleBlocks)

  const pageStyle = {
    backgroundColor: style.bg_color,
    color: style.text_color,
    fontFamily: style.font_body,
    fontSize: style.font_size_base ? `${style.font_size_base}px` : undefined,
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

  return (
    <div className="builder-page min-w-0" style={pageStyle}>
      {(style.font_heading || style.font_size_heading) && (
        <style>{`
          .builder-page h1,
          .builder-page h2,
          .builder-page h3 {
            font-family: ${JSON.stringify(style.font_heading)};
            ${style.font_size_heading ? `font-size: ${style.font_size_heading}px;` : ''}
          }
        `}</style>
      )}
      {shellBlocks.length > 0 && (
        <div className="sticky top-0 z-50 w-full">
          {shellBlocks.map(renderBlock)}
        </div>
      )}
      <div className="builder-page-content min-w-0 overflow-x-clip">
        {contentBlocks.map(renderBlock)}
      </div>
    </div>
  )
}
