type PageBlock = {
  id?: string
  block_type?: string
  sort_order?: number
  props?: Record<string, unknown>
}

const COMMERCE_PRODUCT_LISTING_TYPES = new Set([
  'product.carousel',
  'product.grid',
  'product.crossSell',
  'product.recentlyViewed',
  'product.search',
  'product.wishlist',
])

const PRODUCT_GRID_TYPE = 'product_grid'

function blockSortOrder(block: PageBlock): number {
  return Number(block.sort_order ?? 0)
}

function readShowCount(block: PageBlock): number {
  const raw = Number(block.props?.show_count)
  return Number.isFinite(raw) && raw > 0 ? raw : 12
}

function hasManualProductSelection(block: PageBlock): boolean {
  const ds = block.props?.data_source as { selected_ids?: string[] } | undefined
  return Boolean(ds?.selected_ids?.length)
}

export function isWellnessRetailPageLayout(
  pageBlocks: PageBlock[] | undefined,
  siteStyle?: Record<string, unknown>,
): boolean {
  const imageCat = String(siteStyle?.image_category_id || '').toLowerCase()
  return Boolean(
    pageBlocks?.some(b => b.block_type === 'category_cards' && b.props?.layout === 'wellness')
    || siteStyle?.wb_catalog_template_id === 'storefront_grocery'
    || imageCat === 'wellness'
    || imageCat === 'grocery',
  )
}

/** Classic product_grid that falls back to wellness category showcases (typically 8–9 cards). */
export function isWellnessShowcaseProductGrid(block: PageBlock): boolean {
  if (block.block_type !== PRODUCT_GRID_TYPE) return false
  const title = String(block.props?.title || '').trim().toLowerCase()
  if (hasManualProductSelection(block)) return false
  if (title === 'featured products' || title === 'our bestsellers') return true
  if (readShowCount(block) >= 8) return true
  if (block.props?.layout === 'editorial' && block.props?.featured_spotlight !== false) return true
  return false
}

function pickLiveProductGridToKeep(grids: PageBlock[]): PageBlock | undefined {
  if (!grids.length) return undefined
  const ranked = grids.map(block => ({
    block,
    showCount: readShowCount(block),
    manual: hasManualProductSelection(block),
    showcase: isWellnessShowcaseProductGrid(block),
  }))

  return ranked.reduce((best, cur) => {
    if (cur.manual && !best.manual) return cur
    if (!cur.manual && best.manual) return best
    if (!cur.showcase && best.showcase) return cur
    if (cur.showcase && !best.showcase) return best
    return cur.showCount < best.showCount ? cur : best
  }).block
}

/**
 * Drop duplicate product grids on a page:
 * - Keep the live ERP block (commerce grid/carousel or smaller classic grid, e.g. 2 products)
 * - Remove the wellness showcase grid (typically 8 placeholder category cards)
 */
export function findRedundantWellnessProductGridIds(
  pageBlocks: PageBlock[] | undefined,
  siteStyle?: Record<string, unknown>,
): string[] {
  if (!pageBlocks?.length) return []

  const sorted = [...pageBlocks].sort((a, b) => blockSortOrder(a) - blockSortOrder(b))
  const classicGrids = sorted.filter(b => b.block_type === PRODUCT_GRID_TYPE)
  const commerceListings = sorted.filter(b => COMMERCE_PRODUCT_LISTING_TYPES.has(String(b.block_type)))

  // Live commerce listing + classic duplicate → remove all classic grids.
  if (commerceListings.length > 0 && classicGrids.length > 0) {
    return classicGrids.map(b => b.id).filter(Boolean) as string[]
  }

  if (classicGrids.length >= 2) {
    const keeper = pickLiveProductGridToKeep(classicGrids)
    return classicGrids
      .filter(b => b.id && b.id !== keeper?.id)
      .map(b => b.id!)
  }

  // Single showcase-only grid on a wellness page with no other live listing — still drop it
  // when a commerce block exists elsewhere on the page (handled above). For one grid only, keep it.
  if (
    classicGrids.length === 1
    && isWellnessShowcaseProductGrid(classicGrids[0])
    && isWellnessRetailPageLayout(pageBlocks, siteStyle)
    && commerceListings.length === 0
  ) {
    return []
  }

  return []
}

export function shouldHideRedundantWellnessProductGrid(
  blockId: string | undefined,
  pageBlocks: PageBlock[] | undefined,
  siteStyle?: Record<string, unknown>,
): boolean {
  if (!blockId) return false
  return findRedundantWellnessProductGridIds(pageBlocks, siteStyle).includes(blockId)
}

export function pruneRedundantWellnessProductGrids<T extends PageBlock>(
  blocks: T[],
  siteStyle?: Record<string, unknown>,
): { blocks: T[]; removedIds: string[] } {
  const removedIds = findRedundantWellnessProductGridIds(blocks, siteStyle)
  if (!removedIds.length) return { blocks, removedIds: [] }
  const drop = new Set(removedIds)
  return {
    blocks: blocks.filter(b => !b.id || !drop.has(b.id)),
    removedIds,
  }
}
