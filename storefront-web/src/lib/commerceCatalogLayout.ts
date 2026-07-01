import {
  CATALOG_GRID_COL_CLASS,
  clampCatalogColumns,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'

/** Layout props passed from the builder into commerce-kit components. */
export interface CommerceCatalogLayoutProps {
  columns: number
  gap: number
  imageHeightPct: number
  cardPadding: number
  itemLimit: number
  cardStyle: string
  showTags: boolean
  showCta: boolean
  showBookLink: boolean
  showStock: boolean
}

function resolveCommerceBlockFamily(blockType: string): string {
  if (blockType.startsWith('service.')) return 'services_cards'
  if (blockType === 'product.categories') return 'category_cards'
  if (blockType.startsWith('menu.')) return 'menu_grid'
  if (blockType.startsWith('vertical.')) return 'product_grid'
  return 'product_grid'
}

function defaultColumnsFor(blockType: string): number {
  if (blockType === 'service.list') return 1
  if (blockType === 'service.grid') return 3
  if (blockType === 'product.categories') return 4
  if (blockType === 'recently_viewed' || blockType === 'product.recentlyViewed') return 6
  if (blockType.startsWith('vertical.')) return 3
  return 4
}

export function extractCommerceCatalogLayout(
  props: Record<string, unknown>,
  blockType: string,
): CommerceCatalogLayoutProps {
  const family = resolveCommerceBlockFamily(blockType)
  const layout = readCatalogCardLayout(props, family, {
    defaultColumns: defaultColumnsFor(blockType),
  })
  const itemLimit = Math.min(
    50,
    Math.max(
      1,
      Number(props.show_count ?? props.max ?? props.count ?? 12) || 12,
    ),
  )

  return {
    columns: layout.columns,
    gap: layout.itemGap,
    imageHeightPct: layout.imageHeightPct,
    cardPadding: layout.cardPadding,
    itemLimit,
    cardStyle: layout.cardStyle,
    showTags: layout.showBadges,
    showCta: layout.showAddButton,
    showBookLink: layout.showBookLink,
    showStock: layout.showStock,
  }
}

export function catalogGridClassName(columns: number, blockType = 'product_grid'): string {
  const cols = clampCatalogColumns(columns, 4, blockType)
  return CATALOG_GRID_COL_CLASS[cols] || CATALOG_GRID_COL_CLASS[4]
}

export function carouselCardWidthClass(columns: number): string {
  if (columns >= 8) return 'w-40'
  if (columns >= 6) return 'w-44'
  if (columns >= 4) return 'w-52'
  return 'w-60'
}

export type CategoryShowcaseLayout = 'grid' | 'carousel' | 'strip' | 'list' | 'banner' | 'overlay' | 'compact'

const CATEGORY_SHOWCASE_LAYOUTS: CategoryShowcaseLayout[] = [
  'grid', 'carousel', 'strip', 'list', 'banner', 'overlay', 'compact',
]

/** Map builder preset props to a Category Showcase layout the component renders. */
export function resolveCategoryShowcaseLayout(props: Record<string, unknown>): CategoryShowcaseLayout {
  const layout = String(props.layout ?? '')
  if (CATEGORY_SHOWCASE_LAYOUTS.includes(layout as CategoryShowcaseLayout)) {
    return layout as CategoryShowcaseLayout
  }
  const variant = String(props.variant ?? '')
  if (variant === 'carousel') return 'carousel'
  if (variant === 'list' || variant === 'minimal') return 'list'
  if (variant === 'strip') return 'strip'
  if (variant === 'banner' || variant === 'featured' || variant === 'hero') return 'banner'
  if (variant === 'overlay' || variant === 'editorial') return 'overlay'
  if (variant === 'compact') return 'compact'
  return 'grid'
}

/** Commerce registry variant id (grid vs carousel wrapper). */
export function categoryShowcaseVariantId(props: Record<string, unknown>): 'grid' | 'carousel' {
  const layout = resolveCategoryShowcaseLayout(props)
  return layout === 'carousel' || layout === 'strip' ? 'carousel' : 'grid'
}

export function cardStylePadding(cardStyle: string, cardPadding?: number): number {
  if (cardPadding != null) return cardPadding
  if (cardStyle === 'minimal') return 8
  if (cardStyle === 'compact') return 10
  return 12
}
