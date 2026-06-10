/** Shared grid + card sizing for product/service catalog blocks. */

export const MIN_CATALOG_GRID_COLUMNS = 1
export const MAX_CATALOG_GRID_COLUMNS = 12

export function clampNumber(raw: unknown, fallback: number, min: number, max: number): number {
  return Math.min(Math.max(Number(raw ?? fallback) || fallback, min), max)
}

export function clampCatalogColumns(
  raw: unknown,
  fallback = 4,
  blockType = 'product_grid',
  minOverride?: number,
): number {
  const min = minOverride ?? (blockType === 'menu_grid' ? 1 : 2)
  return Math.min(
    Math.max(Number(raw ?? fallback) || fallback, min),
    MAX_CATALOG_GRID_COLUMNS,
  )
}

export const CATALOG_GRID_COL_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  7: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7',
  8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
  9: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9',
  10: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
  11: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11',
  12: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12',
}

export function catalogGridResponsiveColClass(columns: number): string {
  if (columns <= 1) return 'grid-cols-1'
  if (columns <= 2) return CATALOG_GRID_COL_CLASS[2]
  return CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[4]
}

export interface CatalogCardLayout {
  columns: number
  itemGap: number
  imageHeightPct: number
  cardPadding: number
  cardStyle: string
  isCompactCard: boolean
  isMinimalCard: boolean
  cardRadius: string
  showBadges: boolean
  showStock: boolean
  showAddButton: boolean
  showBookLink: boolean
}

export function readCatalogCardLayout(
  props: Record<string, unknown>,
  blockType = 'product_grid',
  options?: { defaultColumns?: number },
): CatalogCardLayout {
  const defaultColumns = options?.defaultColumns ?? (blockType === 'menu_grid' ? 2 : 4)
  const cardStyle = String(props.card_style ?? 'default')
  const isCompactCard = cardStyle === 'compact' || props.compact === true
  const isMinimalCard = cardStyle === 'minimal'

  return {
    columns: clampCatalogColumns(props.columns, defaultColumns, blockType),
    itemGap: clampNumber(props.item_gap, 24, 0, 80),
    imageHeightPct: clampNumber(
      props.image_height_pct,
      isMinimalCard ? 72 : isCompactCard ? 88 : 100,
      40,
      100,
    ),
    cardPadding: clampNumber(
      props.card_padding,
      isMinimalCard ? 8 : isCompactCard ? 10 : 16,
      4,
      32,
    ),
    cardStyle,
    isCompactCard,
    isMinimalCard,
    cardRadius: isMinimalCard ? 'rounded-lg' : isCompactCard ? 'rounded-xl' : 'rounded-2xl',
    showBadges: props.show_badges !== false,
    showStock: props.show_stock !== false && !isMinimalCard,
    showAddButton: props.show_add_button !== false,
    showBookLink: props.show_book_link !== false && props.show_add_button !== false,
  }
}
