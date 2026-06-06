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
import SectionShapeDivider from './SectionShapeDivider'

// Lazy-import the heavy block families to keep initial bundle small
const NavBlock = lazy(() => import('./blocks/NavBlock'))
const FooterBlock = lazy(() => import('./blocks/FooterBlock'))
const HeroBlock = lazy(() => import('./blocks/HeroBlock'))
const FeaturesBlock = lazy(() => import('./blocks/FeaturesBlock'))
const ProductGridBlock = lazy(() => import('./blocks/ProductGridBlock'))
const ServicesCardsBlock = lazy(() => import('./blocks/ServicesCardsBlock'))
const TestimonialsBlock = lazy(() => import('./blocks/TestimonialsBlock'))
const TeamGridBlock = lazy(() => import('./blocks/TeamGridBlock'))
const StatsBlock = lazy(() => import('./blocks/StatsBlock'))
const CtaBlock = lazy(() => import('./blocks/CtaBlock'))
const ContactFormBlock = lazy(() => import('./blocks/ContactFormBlock'))
const MapEmbedBlock = lazy(() => import('./blocks/MapEmbedBlock'))
const FaqBlock = lazy(() => import('./blocks/FaqBlock'))
const PricingBlock = lazy(() => import('./blocks/PricingBlock'))
const RichTextBlock = lazy(() => import('./blocks/RichTextBlock'))
const ImageBlock = lazy(() => import('./blocks/ImageBlock'))
const VideoEmbedBlock = lazy(() => import('./blocks/VideoEmbedBlock'))
const GalleryMasonryBlock = lazy(() => import('./blocks/GalleryMasonryBlock'))
const SocialLinksBlock = lazy(() => import('./blocks/SocialLinksBlock'))
const CountdownBlock = lazy(() => import('./blocks/CountdownBlock'))
const AnnouncementBarBlock = lazy(() => import('./blocks/AnnouncementBarBlock'))
const MarqueeStripBlock = lazy(() => import('./blocks/MarqueeStripBlock'))
const NewsletterBlock = lazy(() => import('./blocks/NewsletterBlock'))
const TrustLogosBlock = lazy(() => import('./blocks/TrustLogosBlock'))
const TimelineBlock = lazy(() => import('./blocks/TimelineBlock'))
const AboutSplitBlock = lazy(() => import('./blocks/AboutSplitBlock'))
const BookingWidgetBlock = lazy(() => import('./blocks/BookingWidgetBlock'))
const BookingSlotPickerBlock = lazy(() => import('./blocks/BookingSlotPickerBlock'))
const LiveStockBlock = lazy(() => import('./blocks/LiveStockBlock'))
const OrderStatusBlock = lazy(() => import('./blocks/OrderStatusBlock'))
const CouponBannerBlock = lazy(() => import('./blocks/CouponBannerBlock'))
const PaymentMethodsStripBlock = lazy(() => import('./blocks/PaymentMethodsStripBlock'))
const ProductReviewsBlock = lazy(() => import('./blocks/ProductReviewsBlock'))
const SearchBarBlock = lazy(() => import('./blocks/SearchBarBlock'))
const CookieConsentBlock = lazy(() => import('./blocks/CookieConsentBlock'))
const ProductDetailBlock = lazy(() => import('./blocks/ProductDetailBlock'))
const CheckoutFormBlock = lazy(() => import('./blocks/CheckoutFormBlock'))
const RecentlyViewedBlock = lazy(() => import('./blocks/RecentlyViewedBlock'))
const ProductFiltersBlock = lazy(() => import('./blocks/ProductFiltersBlock'))
const BlogGridBlock = lazy(() => import('./blocks/BlogGridBlock'))
const CartDrawerBlock = lazy(() => import('./blocks/CartDrawerBlock'))
const LiveQuoteBlock = lazy(() => import('./blocks/LiveQuoteBlock'))
const CommerceLibraryBlock = lazy(() => import('./blocks/CommerceLibraryBlock'))

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

function useLiveData(block: PublicBlock, site: PublicSite, limit = 12) {
  const dataSource = block.props?.data_source as { type?: string; selected_ids?: string[]; limit?: number; auto?: boolean } | undefined
  const sourceType = typeof dataSource?.type === 'string'
    ? dataSource.type.replace(/^internal_/, '')
    : undefined
  const resource = (sourceType && sourceType !== 'external_api' ? sourceType : BLOCK_LIVE_RESOURCE[block.block_type] || inferCommerceLiveResource(block.block_type)) as LiveResource | undefined
  const effectiveLimit = Number(dataSource?.limit ?? limit) || limit
  const [data, setData] = useState<LiveItem[] | null>(null)

  useEffect(() => {
    if (!resource || !site.id) { setData([]); return }
    const params = dataSource?.selected_ids?.length
      ? { ids: dataSource.selected_ids.join(',') }
      : undefined
    publicSitesApi.getLiveResource(site.id, resource, effectiveLimit, params)
      .then(r => {
        const selectedIds = dataSource?.selected_ids || []
        const items = selectedIds.length
          ? r.items.filter(item => item.id && selectedIds.includes(item.id))
          : r.items
        setData(items)
      })
      .catch(() => setData([]))
  }, [site.id, resource, effectiveLimit, dataSource?.selected_ids?.join(',')])

  return data
}

// ── Individual block renderer ──────────────────────────────────────────────

export function SingleBlock({
  block,
  site,
  style,
  branchCode,
  pageBlocks,
}: Omit<BlockProps, 'liveData'> & { pageBlocks?: PublicBlock[] }) {
  const { storePath } = useVendor()
  const liveItems = useLiveData(block, site, (block.props.show_count as number | undefined) || 12)
  const p = block.props as Record<string, unknown>

  const commonProps = {
    site,
    style,
    props: p,
    liveItems: liveItems ?? [],
    branchCode,
    pageBlocks: pageBlocks?.map(b => ({ block_type: b.block_type, props: b.props as Record<string, unknown> })),
  }

  const inner = (() => {
    if (block.block_type.includes('.')) {
      return (
        <Suspense fallback={<BlockSkeleton />}>
          <CommerceLibraryBlock {...commonProps} blockType={block.block_type} />
        </Suspense>
      )
    }
    switch (block.block_type) {
      case 'nav':              return <Suspense fallback={null}><NavBlock {...commonProps} /></Suspense>
      case 'footer':           return <Suspense fallback={null}><FooterBlock {...commonProps} /></Suspense>
      case 'announcement_bar': return <Suspense fallback={null}><AnnouncementBarBlock {...commonProps} /></Suspense>
      case 'marquee_strip':    return <Suspense fallback={null}><MarqueeStripBlock style={style} props={p} /></Suspense>
      case 'hero':
      case 'hero_split':
      case 'hero_minimal':     return <Suspense fallback={<BlockSkeleton />}><HeroBlock {...commonProps} blockType={block.block_type} /></Suspense>
      case 'features':
      case 'features_alternating':
      case 'features_icons':   return <Suspense fallback={<BlockSkeleton />}><FeaturesBlock {...commonProps} blockType={block.block_type} /></Suspense>
      case 'product_detail':   return <Suspense fallback={<BlockSkeleton />}><ProductDetailBlock {...commonProps} /></Suspense>
      case 'checkout_form':    return <Suspense fallback={<BlockSkeleton />}><CheckoutFormBlock {...commonProps} /></Suspense>
      case 'product_grid':
      case 'menu_grid':
      case 'category_cards':
      case 'related_products': return <Suspense fallback={<BlockSkeleton />}><ProductGridBlock {...commonProps} blockType={block.block_type} /></Suspense>
      case 'services_cards':
      case 'services_list':    return <Suspense fallback={<BlockSkeleton />}><ServicesCardsBlock {...commonProps} /></Suspense>
      case 'testimonials':
      case 'testimonials_grid': return <Suspense fallback={<BlockSkeleton />}><TestimonialsBlock {...commonProps} /></Suspense>
      case 'product_reviews':  return <Suspense fallback={<BlockSkeleton />}><ProductReviewsBlock {...commonProps} /></Suspense>
      case 'team_grid':
      case 'team_list':        return <Suspense fallback={<BlockSkeleton />}><TeamGridBlock {...commonProps} /></Suspense>
      case 'stats':            return <Suspense fallback={<BlockSkeleton />}><StatsBlock {...commonProps} /></Suspense>
      case 'cta':              return <Suspense fallback={<BlockSkeleton />}><CtaBlock {...commonProps} /></Suspense>
      case 'contact_form':     return <Suspense fallback={<BlockSkeleton />}><ContactFormBlock {...commonProps} /></Suspense>
      case 'map_embed':
      case 'map_contact':      return <Suspense fallback={<BlockSkeleton />}><MapEmbedBlock {...commonProps} /></Suspense>
      case 'faq':              return <Suspense fallback={<BlockSkeleton />}><FaqBlock {...commonProps} /></Suspense>
      case 'pricing':          return <Suspense fallback={<BlockSkeleton />}><PricingBlock {...commonProps} /></Suspense>
      case 'rich_text':        return <Suspense fallback={<BlockSkeleton />}><RichTextBlock {...commonProps} /></Suspense>
      case 'image_block':      return <Suspense fallback={<BlockSkeleton />}><ImageBlock {...commonProps} /></Suspense>
      case 'video_embed':      return <Suspense fallback={<BlockSkeleton />}><VideoEmbedBlock {...commonProps} /></Suspense>
      case 'gallery_masonry':
      case 'gallery_grid':
      case 'image_gallery':
      case 'portfolio_grid':   return <Suspense fallback={<BlockSkeleton />}><GalleryMasonryBlock {...commonProps} /></Suspense>
      case 'social_links':     return <Suspense fallback={<BlockSkeleton />}><SocialLinksBlock {...commonProps} /></Suspense>
      case 'countdown':        return <Suspense fallback={<BlockSkeleton />}><CountdownBlock {...commonProps} /></Suspense>
      case 'newsletter':       return <Suspense fallback={<BlockSkeleton />}><NewsletterBlock {...commonProps} /></Suspense>
      case 'trust_logos':      return <Suspense fallback={<BlockSkeleton />}><TrustLogosBlock {...commonProps} /></Suspense>
      case 'timeline':         return <Suspense fallback={<BlockSkeleton />}><TimelineBlock {...commonProps} /></Suspense>
      case 'about_split':      return <Suspense fallback={<BlockSkeleton />}><AboutSplitBlock {...commonProps} /></Suspense>
      case 'booking_widget':        return <Suspense fallback={<BlockSkeleton />}><BookingWidgetBlock {...commonProps} /></Suspense>
      case 'booking_slot_picker':   return <Suspense fallback={<BlockSkeleton />}><BookingSlotPickerBlock {...commonProps} /></Suspense>
      case 'live_stock':       return <Suspense fallback={<BlockSkeleton />}><LiveStockBlock {...commonProps} /></Suspense>
      case 'order_status':     return <Suspense fallback={<BlockSkeleton />}><OrderStatusBlock {...commonProps} /></Suspense>
      case 'coupon_banner':
      case 'offer_banner':
      case 'promo_strip':      return <Suspense fallback={<BlockSkeleton />}><CouponBannerBlock {...commonProps} /></Suspense>
      case 'payment_methods_strip': return <Suspense fallback={<BlockSkeleton />}><PaymentMethodsStripBlock {...commonProps} /></Suspense>
      case 'search_bar':       return <Suspense fallback={null}><SearchBarBlock {...commonProps} /></Suspense>
      case 'cookie_consent':   return <Suspense fallback={null}><CookieConsentBlock {...commonProps} /></Suspense>
      case 'recently_viewed':  return <Suspense fallback={null}><RecentlyViewedBlock {...commonProps} /></Suspense>
      case 'product_filters':  return <Suspense fallback={<BlockSkeleton />}><ProductFiltersBlock {...commonProps} /></Suspense>
      case 'blog_grid':
      case 'blog_featured':
      case 'blog_list':        return <Suspense fallback={<BlockSkeleton />}><BlogGridBlock {...commonProps} /></Suspense>
      case 'cart_drawer':      return <Suspense fallback={null}><CartDrawerBlock {...commonProps} /></Suspense>
      case 'live_quote':       return <Suspense fallback={<BlockSkeleton />}><LiveQuoteBlock {...commonProps} /></Suspense>
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
  const paddingTop = Number(p.padding_top ?? block.style_overrides?.padding_top ?? 0)
  const paddingBottom = Number(p.padding_bottom ?? block.style_overrides?.padding_bottom ?? 0)

  const wrapperStyle: CSSProperties = {}
  if (block.animation_delay) wrapperStyle.animationDelay = `${block.animation_delay}ms`
  if (textTransformCss) wrapperStyle.textTransform = textTransformCss
  if (paddingTop > 0) wrapperStyle.paddingTop = `${paddingTop}px`
  if (paddingBottom > 0) wrapperStyle.paddingBottom = `${paddingBottom}px`
  if (hasShape) wrapperStyle.position = 'relative'

  const sfBid = `sf${block.id.replace(/-/g, '')}`
  const blockLink = typeof p.block_link_url === 'string' ? p.block_link_url.trim() : ''
  const blockLinkNewTab = Boolean(p.block_link_new_tab)
  const resolvedBlockLink = blockLink
    ? blockLink.startsWith('http') || blockLink.startsWith('mailto:') || blockLink.startsWith('tel:') || blockLink.startsWith('#')
      ? blockLink
      : storePath(blockLink.startsWith('/') ? blockLink : `/${blockLink}`)
    : ''
  const activateBlockLink = (eventTarget: EventTarget | null) => {
    if (!resolvedBlockLink || !(eventTarget instanceof HTMLElement)) return
    if (eventTarget.closest('a, button, input, textarea, select, label, [role="button"]')) return
    if (blockLinkNewTab) window.open(resolvedBlockLink, '_blank', 'noopener,noreferrer')
    else window.location.href = resolvedBlockLink
  }

  return (
    <div
      data-sf-bid={sfBid}
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
        resolvedBlockLink ? 'cursor-pointer' : '',
        shellStack,
        !block.visible_on_mobile ? 'hidden sm:block' : '',
        !block.visible_on_tablet ? 'sm:hidden lg:block' : '',
        !block.visible_on_desktop ? 'lg:hidden' : '',
        block.animation === 'fade-in' ? 'animate-fade-in' : '',
        block.animation === 'slide-up' ? 'animate-slide-up' : '',
      ].filter(Boolean).join(' ')}
      style={Object.keys(wrapperStyle).length ? wrapperStyle : undefined}
    >
      {topShape && topShape !== 'none' && (
        <SectionShapeDivider shape={topShape} fillColor={shapeColor} position="top" />
      )}
      {(fontSizePx || textScaleEm) && (
        <style>{`
          [data-sf-bid="${sfBid}"] h1,
          [data-sf-bid="${sfBid}"] h2,
          [data-sf-bid="${sfBid}"] h3,
          [data-sf-bid="${sfBid}"] h4,
          [data-sf-bid="${sfBid}"] p,
          [data-sf-bid="${sfBid}"] li,
          [data-sf-bid="${sfBid}"] blockquote {
            ${fontSizePx ? `font-size: ${fontSizePx}px !important;` : ''}
            ${textScaleEm ? `font-size: ${textScaleEm}em !important;` : ''}
          }
        `}</style>
      )}
      {inner}
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

  return (
    <div
      className="builder-page min-w-0 overflow-x-clip"
      style={{
        backgroundColor: style.bg_color,
        color: style.text_color,
        fontFamily: style.font_body,
        fontSize: style.font_size_base ? `${style.font_size_base}px` : undefined,
      }}
    >
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
      {visibleBlocks.map(block => (
        <SingleBlock
          key={block.id}
          block={block}
          site={site}
          style={style}
          branchCode={branchCode}
          pageBlocks={visibleBlocks}
        />
      ))}
    </div>
  )
}
