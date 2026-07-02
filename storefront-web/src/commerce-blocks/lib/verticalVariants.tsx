import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The 10 layout variants the builder offers for every commerce/vertical library
 * block (see COMMERCE_VARIANT_PRESETS in vendor-web). Each vertical component maps
 * these ids to a visibly different rendering so the "Section style" picker actually
 * changes the preview.
 */
export const VERTICAL_VARIANT_IDS = [
  'default', 'compact', 'featured', 'minimal', 'card', 'split', 'editorial', 'list', 'grid', 'hero',
] as const

export type VerticalVariant = (typeof VERTICAL_VARIANT_IDS)[number]

export const VERTICAL_VARIANT_NAMES: Record<VerticalVariant, string> = {
  default: 'Classic Default',
  compact: 'Compact Dense',
  featured: 'Featured Spotlight',
  minimal: 'Minimal Clean',
  card: 'Card Containers',
  split: 'Split Columns',
  editorial: 'Editorial Wide',
  list: 'List Rows',
  grid: 'Grid Tiles',
  hero: 'Bold Hero',
}

export function normalizeVerticalVariant(value: unknown): VerticalVariant {
  const v = String(value ?? '').trim()
  return (VERTICAL_VARIANT_IDS as readonly string[]).includes(v) ? (v as VerticalVariant) : 'default'
}

/**
 * Deterministic gradient placeholder used when an editable vertical item has no image.
 * Keeps preview looking like the original mock cards until the vendor uploads a real image.
 */
export function verticalSwatch(seed: string, w = 600, h = 400): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hash},35%,75%)'/><stop offset='1' stop-color='hsl(${(hash + 30) % 360},35%,55%)'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(%23g)'/></svg>`,
  )}`
}

export type CardTreatment = 'bordered' | 'shadow' | 'plain' | 'editorial'

export function cardTreatmentClass(card: CardTreatment): string {
  switch (card) {
    case 'shadow':
      return 'rounded-xl border border-border/60 bg-card shadow-md'
    case 'plain':
      return 'rounded-lg bg-transparent'
    case 'editorial':
      return 'rounded-none border-b border-border bg-transparent'
    case 'bordered':
    default:
      return 'rounded-lg border border-border bg-card'
  }
}

/* ── Card-catalog blocks (Course Catalog, Event Listing) ───────────────────── */

export type CatalogMode = 'grid' | 'list' | 'featured' | 'split'

export interface CatalogVariantStyle {
  mode: CatalogMode
  columns: number
  gap: number
  card: CardTreatment
  cardClass: string
  bigTitle: boolean
  hero: boolean
}

export function catalogVariantStyle(value: unknown): CatalogVariantStyle {
  const v = normalizeVerticalVariant(value)
  const s = (
    mode: CatalogMode,
    columns: number,
    gap: number,
    card: CardTreatment,
    extra?: Partial<Pick<CatalogVariantStyle, 'bigTitle' | 'hero'>>,
  ): CatalogVariantStyle => ({
    mode,
    columns,
    gap,
    card,
    cardClass: cardTreatmentClass(card),
    bigTitle: extra?.bigTitle ?? false,
    hero: extra?.hero ?? false,
  })

  switch (v) {
    case 'compact':
      return s('grid', 4, 12, 'bordered')
    case 'featured':
      return s('featured', 3, 20, 'bordered')
    case 'minimal':
      return s('grid', 3, 28, 'plain')
    case 'card':
      return s('grid', 3, 22, 'shadow')
    case 'split':
      return s('split', 2, 20, 'bordered', { bigTitle: true })
    case 'editorial':
      return s('grid', 2, 28, 'editorial', { bigTitle: true })
    case 'list':
      return s('list', 1, 12, 'bordered')
    case 'hero':
      return s('grid', 3, 20, 'bordered', { hero: true })
    case 'grid':
      return s('grid', 4, 20, 'bordered')
    case 'default':
    default:
      return s('grid', 3, 20, 'bordered')
  }
}

/* ── Detail blocks (Course Detail, Ticket Picker, Vehicle Detail) ──────────── */

export type SidebarPosition = 'right' | 'left' | 'bottom'

export interface DetailVariantStyle {
  sidebar: SidebarPosition
  card: CardTreatment
  cardClass: string
  hero: boolean
  wide: boolean
  containerClass: string
  gapClass: string
}

export function detailVariantStyle(value: unknown): DetailVariantStyle {
  const v = normalizeVerticalVariant(value)
  const make = (
    sidebar: SidebarPosition,
    card: CardTreatment,
    extra?: Partial<Pick<DetailVariantStyle, 'hero' | 'wide' | 'containerClass' | 'gapClass'>>,
  ): DetailVariantStyle => ({
    sidebar,
    card,
    cardClass: cardTreatmentClass(card),
    hero: extra?.hero ?? false,
    wide: extra?.wide ?? false,
    containerClass: extra?.containerClass ?? 'mx-auto max-w-5xl',
    gapClass: extra?.gapClass ?? 'gap-6',
  })

  switch (v) {
    case 'compact':
      return make('right', 'bordered', { containerClass: 'mx-auto max-w-4xl', gapClass: 'gap-4' })
    case 'featured':
      return make('right', 'bordered', { hero: true })
    case 'minimal':
      return make('right', 'plain', { gapClass: 'gap-8' })
    case 'card':
      return make('right', 'shadow')
    case 'split':
      return make('left', 'bordered')
    case 'editorial':
      return make('right', 'editorial', { wide: true, containerClass: 'mx-auto max-w-6xl', gapClass: 'gap-10' })
    case 'list':
      return make('bottom', 'bordered')
    case 'grid':
      return make('right', 'bordered', { wide: true, containerClass: 'mx-auto max-w-6xl' })
    case 'hero':
      return make('left', 'bordered', { hero: true })
    case 'default':
    default:
      return make('right', 'bordered')
  }
}

/** Wraps a detail block's main + aside in the layout dictated by the variant. */
export function DetailShell({
  style,
  main,
  aside,
}: {
  style: DetailVariantStyle
  main: ReactNode
  aside: ReactNode
}) {
  if (style.sidebar === 'bottom') {
    return (
      <div className={cn(style.containerClass, 'flex flex-col', style.gapClass)}>
        <div className="min-w-0">{main}</div>
        <aside className="w-full">{aside}</aside>
      </div>
    )
  }
  if (style.sidebar === 'left') {
    return (
      <div className={cn(style.containerClass, 'grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]', style.gapClass)}>
        <aside className="lg:sticky lg:top-4 lg:self-start">{aside}</aside>
        <div className="min-w-0">{main}</div>
      </div>
    )
  }
  return (
    <div className={cn(style.containerClass, 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]', style.gapClass)}>
      <div className="min-w-0">{main}</div>
      <aside className="lg:sticky lg:top-4 lg:self-start">{aside}</aside>
    </div>
  )
}
