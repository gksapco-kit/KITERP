/**
 * Shared helpers for the "Silk Atelier" saree-boutique block family.
 *
 * These blocks are ADDITIVE: they only render when a site's own page data
 * contains one of the `silk_atelier_*` block types. No existing block or site is
 * affected by anything in this folder.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { ensureBuilderFontLoaded } from '@/lib/builderFontFamilies'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LiveItem, StyleConfig } from '@/blocks/registry'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useVendor } from '@/contexts/VendorContext'
import { prefetchStoreProducts } from '@/hooks/useStore'
import { useStorePath } from '@/hooks/useStorePath'
import { siteUsesSilkAtelierCatalog } from '@/lib/storefrontLayoutChrome'
import { imgUrl, cn } from '@/lib/utils'

// ── Theme ──────────────────────────────────────────────────────────────────

export interface SilkAtelierTheme {
  /** Deep maroon / plum — headers, headings, buttons. */
  primary: string
  /** Antique gold — borders, badges, eyebrows. */
  accent: string
  /** Raspberry — gradient heading words. */
  highlight: string
  /** Warm cream section background. */
  cream: string
  ink: string
  headingFont: string
  bodyFont: string
}

const DEFAULT_HEADING_FONT = 'Cormorant Garamond'
const DEFAULT_BODY_FONT = 'Montserrat'

export function useSilkAtelierTheme(style: StyleConfig, props: Record<string, unknown>): SilkAtelierTheme {
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
  const theme = useMemo(
    () => ({
      primary: str(props.primary_color, style.primary_color || '#5A0B3A'),
      accent: str(props.accent_color, style.accent_color || '#C9A04A'),
      highlight: str(props.highlight_color, str((style as unknown as Record<string, unknown>).highlight_color, '#9B1B6E')),
      cream: str(props.cream_color, style.bg_color || '#FBF5EA'),
      ink: str(props.ink_color, style.text_color || '#3B1A2C'),
      headingFont: style.font_heading || DEFAULT_HEADING_FONT,
      bodyFont: style.font_body || DEFAULT_BODY_FONT,
    }),
    [props, style],
  )
  useEffect(() => {
    ensureBuilderFontLoaded(theme.headingFont)
    ensureBuilderFontLoaded(theme.bodyFont)
  }, [theme.headingFont, theme.bodyFont])
  return theme
}

// ── Item helpers ───────────────────────────────────────────────────────────

export type ItemMeta = Record<string, unknown>

export function metaOf(item: LiveItem): ItemMeta {
  return (item.meta || {}) as ItemMeta
}

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

/**
 * True when a catalog product belongs to any of the given collection names.
 * Matches (case-insensitive) the product category, brand, tags, or title.
 * An empty filter list matches everything.
 */
export function matchesCollection(item: LiveItem, filters: string[] | undefined): boolean {
  const list = (filters || []).map(norm).filter(Boolean)
  if (list.length === 0) return true
  const meta = metaOf(item)
  const haystacks = [
    norm(meta.category),
    norm(meta.brand),
    norm(item.subtitle),
    ...((Array.isArray(meta.tags) ? meta.tags : []) as unknown[]).map(norm),
  ].filter(Boolean)
  const title = norm(item.title)
  return list.some((f) => haystacks.some((h) => h === f || h.includes(f)) || title.includes(f))
}

export function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

export function asObjectList<T extends Record<string, unknown>>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as T[]) : []
}

export function currencyPrefix(code: unknown): string {
  const c = String(code ?? 'INR').toUpperCase()
  return c === 'INR' ? 'Rs.' : c
}

export function formatAmount(amount: number, code?: unknown): string {
  return `${currencyPrefix(code)} ${Math.round(amount).toLocaleString('en-IN')}`
}

export function discountOf(item: LiveItem): number {
  const meta = metaOf(item)
  const price = Number(item.price ?? 0)
  const compare = Number(meta.compare_at_price ?? 0)
  if (price > 0 && compare > price) return Math.round(((compare - price) / compare) * 100)
  const pct = Number(meta.discount_percentage ?? 0)
  return pct > 0 ? Math.round(pct) : 0
}

/** Deterministic maroon/gold gradient used when a product has no photo yet. */
export function swatchImage(seed: string, w = 480, h = 640): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  const hueA = [330, 345, 12, 28, 280, 160][hash % 6]
  const hueB = (hueA + 24) % 360
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>`
    + `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>`
    + `<stop offset='0' stop-color='hsl(${hueA},55%,28%)'/><stop offset='1' stop-color='hsl(${hueB},60%,42%)'/></linearGradient></defs>`
    + `<rect width='${w}' height='${h}' fill='url(%23g)'/>`
    + `<g stroke='%23C9A04A' stroke-opacity='.55' fill='none'><rect x='14' y='14' width='${w - 28}' height='${h - 28}' rx='${Math.round(w / 2.2)}'/></g>`
    + `</svg>`,
  )}`
}

export function placeholderItems(count: number, label: string): LiveItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `placeholder-${label}-${i}`,
    title: `${label} — new designs arriving soon`,
    subtitle: label,
    image_url: swatchImage(`${label}-${i}`),
    price: null,
    url: null,
    meta: { placeholder: true },
  }))
}

/** Pick catalog items for a collection, falling back to elegant placeholders. */
export function pickItems(
  all: LiveItem[],
  filters: string[] | undefined,
  limit: number,
  label: string,
): { items: LiveItem[]; total: number; isPlaceholder: boolean } {
  const matched = all.filter((i) => matchesCollection(i, filters))
  if (matched.length === 0) {
    return { items: placeholderItems(Math.min(limit, 6), label), total: 0, isPlaceholder: true }
  }
  return { items: matched.slice(0, limit), total: matched.length, isPlaceholder: false }
}

// ── Links ──────────────────────────────────────────────────────────────────

function prefetchSilkAtelierCatalogLink(
  client: QueryClient,
  vendorSlug: string,
  storeRelativePath: string,
  silkCatalog: boolean,
) {
  if (!vendorSlug || !storeRelativePath.includes('products')) return
  const qIdx = storeRelativePath.indexOf('?')
  const qs = new URLSearchParams(qIdx >= 0 ? storeRelativePath.slice(qIdx + 1) : '')
  const category = qs.get('category')?.trim() || undefined
  const search = qs.get('search')?.trim() || undefined
  if (!category && !search) return
  const size = silkCatalog && category ? 100 : 12
  void prefetchStoreProducts(client, vendorSlug, {
    page: 1,
    size,
    category,
    search,
    sort: 'default',
  })
}

interface SilkAtelierLinkProps {
  to: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  ariaLabel?: string
}

/** Link that is safe inside the builder canvas and honours branch-aware store paths. */
export function SilkAtelierLink({ to, className, style, children, onClick, ariaLabel }: SilkAtelierLinkProps) {
  const storePath = useStorePath()
  const canvas = useBuilderCanvas()
  const queryClient = useQueryClient()
  const { vendorSlug } = useVendor()
  const { builderSite } = useBuilderSite()
  const silkCatalog = siteUsesSilkAtelierCatalog(builderSite)
  const target = (to || '/products').trim() || '/products'
  const external = /^(https?:|mailto:|tel:|#)/i.test(target)
  const internalPath = storePath(target.startsWith('/') ? target : `/${target}`)

  if (external) {
    return (
      <a
        href={target}
        className={className}
        style={style}
        aria-label={ariaLabel}
        onClick={onClick}
        {...(/^https?:/i.test(target) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (canvas?.onNavigate) {
      e.preventDefault()
      canvas.onNavigate(target)
    } else if (canvas?.isEditorCanvas) {
      e.preventDefault()
    }
  }

  return (
    <Link
      to={internalPath}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={handleClick}
      onMouseEnter={() => prefetchSilkAtelierCatalogLink(queryClient, vendorSlug, internalPath, silkCatalog)}
    >
      {children}
    </Link>
  )
}

/** Build a catalog URL for a collection name. */
export function collectionUrl(name: string, title?: string): string {
  const params = new URLSearchParams({ category: name })
  const display = (title || name).trim()
  if (display) params.set('collection', display)
  return `/products?${params.toString()}`
}

export type CatalogLinkContext = {
  /** Top-level mega-menu label (breadcrumb parent), e.g. "Banarasi Silks". */
  menu?: string
  /** Parent item URL — used to derive menu_category for the parent crumb link. */
  menuUrl?: string
}

/** Ensure /products links carry banner title + optional parent menu for breadcrumbs. */
export function withCollectionTitle(path: string, title: string, ctx?: string | CatalogLinkContext): string {
  const raw = (path || '').trim()
  if (!raw.includes('/products')) return raw
  const menuCtx: CatalogLinkContext | undefined =
    typeof ctx === 'string' ? { menu: ctx } : ctx
  const [base, query = ''] = raw.split('?')
  const params = new URLSearchParams(query)
  if (title.trim() && !params.get('collection')) params.set('collection', title.trim())
  if (menuCtx?.menu?.trim()) params.set('menu', menuCtx.menu.trim())
  if (menuCtx?.menuUrl?.trim()) {
    const parentQuery = menuCtx.menuUrl.split('?')[1] || ''
    const parentParams = new URLSearchParams(parentQuery)
    const parentCategory = parentParams.get('category')
    if (parentCategory) params.set('menu_category', parentCategory)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

// ── Product card ───────────────────────────────────────────────────────────

export type SilkAtelierCardShape = 'arch' | 'portrait' | 'rounded'

interface ProductCardProps {
  item: LiveItem
  theme: SilkAtelierTheme
  shape?: SilkAtelierCardShape
  showCode?: boolean
  width?: number
}

export function SilkAtelierProductCard({ item, theme, shape = 'arch', showCode = true, width = 188 }: ProductCardProps) {
  const meta = metaOf(item)
  const placeholder = meta.placeholder === true
  const discount = discountOf(item)
  const price = Number(item.price ?? 0)
  const compare = Number(meta.compare_at_price ?? 0)
  const sku = String(meta.sku ?? '').trim()
  const collection = String(meta.category ?? item.subtitle ?? '').trim()
  const img = imgUrl(item.image_url) || swatchImage(item.title)
  const radius = shape === 'arch' ? '999px 999px 16px 16px' : shape === 'portrait' ? '14px' : '18px'
  const ratio = shape === 'portrait' ? '3 / 4' : '3 / 4.1'

  return (
    <SilkAtelierLink
      to={placeholder || !item.url ? '/products' : item.url}
      className="group block shrink-0 snap-start"
      style={{ width }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: ratio,
          borderRadius: radius,
          background: '#2a1620',
          boxShadow: '0 10px 24px -14px rgba(90,11,58,.55)',
          outline: shape === 'arch' ? `1px solid ${theme.accent}55` : undefined,
          outlineOffset: shape === 'arch' ? '-6px' : undefined,
        }}
      >
        <img
          src={img}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {discount > 0 && !placeholder && (
          <span
            className="absolute left-1/2 bottom-3 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, #E9CF8F)`, color: theme.primary }}
          >
            {discount}% off
          </span>
        )}
      </div>
      <div className="px-1 pt-3">
        {showCode && (sku || collection) && !placeholder && (
          <p className="truncate text-[10px] uppercase tracking-[0.14em]" style={{ color: `${theme.ink}99` }}>
            {sku}
            {sku && collection ? ' · ' : ''}
            {collection}
          </p>
        )}
        <h3 className="mt-1 line-clamp-2 text-[13px] leading-snug" style={{ color: theme.ink, fontFamily: theme.bodyFont }}>
          {item.title}
        </h3>
        {!placeholder && price > 0 && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold" style={{ color: theme.primary }}>{formatAmount(price, meta.currency)}</span>
            {compare > price && (
              <span className="text-xs line-through" style={{ color: `${theme.ink}88` }}>{formatAmount(compare, meta.currency)}</span>
            )}
          </p>
        )}
      </div>
    </SilkAtelierLink>
  )
}

// ── Scroll row with arrows + gold progress bar ─────────────────────────────

export function SilkAtelierScrollRow({ children, theme, leading }: { children: ReactNode; theme: SilkAtelierTheme; leading?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const sync = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 0)
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    sync()
    const el = ref.current
    if (!el) return undefined
    const onResize = () => sync()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [sync, children])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const arrow = (dir: 1 | -1, enabled: boolean) => (
    <button
      type="button"
      onClick={() => scrollBy(dir)}
      disabled={!enabled}
      aria-label={dir === 1 ? 'Scroll right' : 'Scroll left'}
      className={cn(
        'absolute top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg transition sm:flex',
        dir === 1 ? 'right-1' : 'left-1',
        enabled ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{ border: `1px solid ${theme.accent}`, color: theme.primary }}
    >
      {dir === 1 ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
    </button>
  )

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={sync}
        className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {leading}
        {children}
      </div>
      {arrow(-1, canPrev)}
      {arrow(1, canNext)}
      <div className="mx-auto mt-2 h-[3px] w-40 overflow-hidden rounded-full" style={{ background: `${theme.accent}33` }}>
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${Math.max(18, progress * 100)}%`, background: theme.accent }}
        />
      </div>
    </div>
  )
}

// ── Small presentational helpers ───────────────────────────────────────────

export function Eyebrow({ children, theme, center }: { children: ReactNode; theme: SilkAtelierTheme; center?: boolean }) {
  return (
    <p
      className={cn('flex items-center gap-3 text-[11px] font-medium uppercase italic tracking-[0.28em]', center && 'justify-center')}
      style={{ color: theme.accent }}
    >
      <span>{children}</span>
      <span aria-hidden className="h-px w-12" style={{ background: theme.accent }} />
    </p>
  )
}

/** Heading where `accent` words are rendered in the highlight gradient. */
export function GradientHeading({
  before,
  accent,
  after,
  theme,
  className,
}: {
  before?: string
  accent?: string
  after?: string
  theme: SilkAtelierTheme
  className?: string
}) {
  return (
    <h2 className={cn('text-3xl leading-tight sm:text-4xl', className)} style={{ color: theme.primary, fontFamily: theme.headingFont }}>
      {before ? `${before} ` : null}
      {accent ? (
        <em
          className="font-normal italic"
          style={{
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.highlight})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {accent}
        </em>
      ) : null}
      {after ? ` ${after}` : null}
    </h2>
  )
}

export function PillLink({ to, children, theme, solid = true }: { to: string; children: ReactNode; theme: SilkAtelierTheme; solid?: boolean }) {
  return (
    <SilkAtelierLink
      to={to}
      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold italic transition hover:opacity-90"
      style={
        solid
          ? { background: theme.primary, color: '#fff' }
          : { border: `1px solid ${theme.primary}`, color: theme.primary, background: 'transparent' }
      }
    >
      {children}
    </SilkAtelierLink>
  )
}

export const CREAM_PATTERN: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='72' viewBox='0 0 56 72'><path d='M28 8c8 10 12 18 12 26a12 12 0 0 1-24 0c0-8 4-16 12-26z' fill='%23C9A04A' fill-opacity='.07'/></svg>\")",
}
