import { type CSSProperties, type ReactNode, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Star, Heart, FolderTree, Eye } from 'lucide-react'
import { useAddToCart, useCart, useCartProductQtyMap, useSetCatalogCartQty } from '@/hooks/useStore'
import { useStorePath } from '@/hooks/useStorePath'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import CategoryCardsWellness from '@/components/builder/blocks/CategoryCardsWellness'
import {
  WELLNESS_CATEGORY_FALLBACK_IMAGES,
  WELLNESS_DEFAULT_CATEGORY_TITLES,
  normalizeCategoryCardItems,
  resolveCategoryCardImage,
} from '@/lib/wellnessCategoryStyle'
import { sanitizeWellnessCategoryTitle } from '@/lib/wellnessTemplateCopy'
import { normalizeLiveProducts, resolveLiveCatalogStorePath, resolveLiveProductUrl } from '@/lib/liveProductUtils'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { CategoryCardTitle } from '@/components/builder/CategoryCardTitle'
import { BuilderCanvasProductImage } from '@/components/builder/BuilderCanvasProductImage'
import { CategoryEditorialImage } from '@/components/builder/CategoryEditorialImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import {
  isWellnessRetailContext,
  resolveWellnessSiteProducts,
} from '@/lib/wellnessProductFilter'
import { cn, imgUrl } from '@/lib/utils'
import { buildCategoryCatalogPath } from '@/lib/categoryCatalogLink'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { vendorDashboardUrl } from '@/lib/vendorDashboardUrl'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import {
  CATALOG_GRID_COL_CLASS,
  catalogGridColClassForBreakpoint,
  catalogGridResponsiveColClass,
  clampCatalogColumns,
  readCatalogCardLayout,
  buildCatalogImageShell,
  resolveCardRadiusPresentation,
} from '@/lib/catalogCardLayout'
import { CatalogAddOrQtyControl } from '@/components/catalog/CatalogAddOrQtyControl'
import {
  catalogTileImageWrapperClass,
  imageShapeFromProps,
  type ImageShape,
} from '@/lib/sectionItemLayout'
import {
  buildCatalogShapedTileTree,
  catalogShapedTileOverlayContentClass,
  catalogTileHostAspectStyle,
  catalogTileHostBackdropClass,
  catalogTileHostBackdropStyle,
  readCatalogTileShapeSettings,
} from '@/lib/catalogTileShapePresentation'
import type { BlockColorProps } from '@/lib/blockColorOverrides'
import {
  builderSectionBleedClass,
  builderSectionContainerClass,
  builderSectionContainerWithMax,
} from '@/lib/builderSectionLayout'

function SectionWithBg({
  bg,
  className,
  children,
}: {
  bg: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className="w-full" style={{ backgroundColor: bg }}>
      <section className={className ?? builderSectionContainerClass()}>{children}</section>
    </div>
  )
}

function openCatalogItemInBuilder(
  onNavigate: ((url: string) => void) | undefined,
  item: LiveItem,
): void {
  const path = resolveLiveProductUrl(item)
  if (!path || !onNavigate) return
  onNavigate(path)
}

function categorySectionBackground(style: StyleConfig, props: Record<string, unknown>): string {
  const p = props as BlockColorProps
  if (props.bg_style === 'dark') return p.bg_color_override || '#111827'
  return p.bg_color_override || style.bg_color || '#F9F9F5'
}

function resolveCategorySectionText(
  style: StyleConfig,
  props: BlockColorProps,
  darkSection: boolean,
): string {
  if (darkSection) return '#f9fafb'
  return props.text_color_override || style.text_color || '#111827'
}

/** Card labels sit on light tile surfaces — use Card text, not section header color. */
function resolveCategoryCardText(
  style: StyleConfig,
  props: BlockColorProps,
  darkSection: boolean,
): string {
  if (props.tile_text) return props.tile_text
  if (darkSection) return '#f9fafb'
  return style.text_color || '#111827'
}

function productViewCount(item: LiveItem): number | null {
  const raw = item.meta?.view_count
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

function ProductViewBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 shadow-sm"
      title={`${count.toLocaleString()} views`}
    >
      <Eye className="w-3 h-3 shrink-0" aria-hidden />
      {count.toLocaleString()}
    </span>
  )
}

function resolveCategoryCardPropData(
  props: Record<string, unknown>,
  liveItems: LiveItem[],
  options?: { skipTemplateDefaults?: boolean },
): {
  cats: ReturnType<typeof normalizeCategoryCardItems>
  propImageByTitle: Map<string, string | undefined>
} {
  const syncedFromCatalog = (() => {
    const ds = props.data_source
    return Boolean(ds && typeof ds === 'object' && (ds as { type?: string }).type === 'categories')
  })()
  const propCats = (() => {
    if (syncedFromCatalog) return []
    const raw = props.categories as { title?: string; image_url?: string }[] | undefined
    const list = Array.isArray(raw) ? raw.filter(c => c && typeof c === 'object') : []
    if (list.length > 0) {
      return list.map((c, i) => ({
        title: sanitizeWellnessCategoryTitle(c.title || `Category ${i + 1}`),
        image_url: c.image_url || WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
      }))
    }
    if (options?.skipTemplateDefaults) return []
    const defaults = WELLNESS_DEFAULT_CATEGORY_TITLES.map((title, i) => ({
      title,
      image_url: WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
    }))
    return defaults.map((c, i) => ({
      title: sanitizeWellnessCategoryTitle(c.title || `Category ${i + 1}`),
      image_url: c.image_url || WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
    }))
  })()
  const propImageByTitle = new Map(
    propCats.map(c => [String(c.title || '').toLowerCase(), c.image_url]),
  )
  const cats = normalizeCategoryCardItems(
    syncedFromCatalog || liveItems.length > 0 ? liveItems : propCats,
    propImageByTitle,
  )
  return { cats, propImageByTitle }
}

function categoryItemsReadOnly(_isEditorCanvas: boolean, liveItems: LiveItem[]): boolean {
  // Whenever live catalog rows are present, show those names (not stale props.categories
  // titles). Editing is disabled for synced tiles in the builder; on the storefront
  // readOnly just forces the live label path.
  return liveItems.length > 0
}

function readCategorySectionLayout(props: Record<string, unknown>) {
  const cardLayout = readCatalogCardLayout(props, 'category_cards', { defaultColumns: 3 })
  const limit = Math.min(200, Math.max(1, Number(props.show_count ?? props.max ?? 12) || 12))
  return { ...cardLayout, limit }
}

function categoryTitleClass(isMinimal: boolean, isCompact: boolean): string {
  if (isMinimal) return 'text-xs font-medium text-center line-clamp-2'
  if (isCompact) return 'text-sm font-medium text-center line-clamp-2'
  return 'text-base font-medium text-center'
}

function categoryImageAspectStyle(imageHeightPct: number, shape: ImageShape, clipToShape: boolean): CSSProperties | undefined {
  return catalogTileHostAspectStyle(imageHeightPct, shape, clipToShape)
}

/** Editorial overlay tiles: map image height % (40–100) to padding-bottom ratio. */
function categoryEditorialTilePaddingBottom(imageHeightPct: number): number {
  return Math.round(40 + (Math.min(100, Math.max(40, imageHeightPct)) / 100) * 85)
}

function CategorySectionHeader({
  title,
  textColor,
  style,
  blockId,
  blockProps,
  showTitle = true,
}: {
  title: string | null
  textColor: string
  style: StyleConfig
  blockId?: string
  blockProps: Record<string, unknown>
  showTitle?: boolean
}) {
  if (!showTitle) return null
  return (
    <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
      <BuilderTextField
        fieldKey="title"
        blockId={blockId}
        blockProps={blockProps}
        value={title ?? ''}
        as="h2"
        className="text-3xl sm:text-4xl md:text-5xl"
        style={{ fontFamily: style.font_heading, color: textColor }}
        placeholder="Section title"
      />
      <span className="text-sm underline opacity-80" style={{ color: textColor }}>View all</span>
    </div>
  )
}

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType?: string
  blockId?: string
  /** Other blocks on the same page — used to detect wellness category layout. */
  pageBlocks?: { block_type?: string; props?: Record<string, unknown> }[]
}

function mediaUrl(url: string | null | undefined) {
  return imgUrl(url)
}

export default function ProductGridBlock({ site, style, props, liveItems, blockType = 'product_grid', pageBlocks, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const previewBp = isEditorCanvas ? (builderCanvas?.previewBreakpoint ?? 'desktop') : 'desktop'
  const catalogCols = (n: number) => (
    isEditorCanvas
      ? catalogGridColClassForBreakpoint(n, previewBp)
      : (CATALOG_GRID_COL_CLASS[n] || CATALOG_GRID_COL_CLASS[4])
  )
  const siteStyle = { ...(site.style_config || {}), ...style } as Record<string, unknown>
  const storePath = useStorePath()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  useCart()
  const cartQtyByProduct = useCartProductQtyMap()
  const { setQty: setCatalogQty } = useSetCatalogCartQty()

  const isLiveCatalogProduct = (item: LiveItem) => {
    const id = String(item.id ?? '')
    return Boolean(id) && !id.startsWith('ph-') && !id.startsWith('wl-showcase-')
  }

  const handleProductCardClick = (e: MouseEvent, item: LiveItem) => {
    const detailPath = resolveLiveCatalogStorePath(item, storePath)
    if (isEditorCanvas) {
      e.preventDefault()
      e.stopPropagation()
      openCatalogItemInBuilder(builderCanvas?.onNavigate, item)
      return
    }
    if (!isLiveCatalogProduct(item) || !detailPath) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    navigate(detailPath)
  }

  const cartItemFromLive = (item: LiveItem) => ({
    product_id: String(item.id),
    name: item.title ?? 'Product',
    qty: 1,
    price: Number(item.price ?? 0),
    image_url: item.image_url ?? undefined,
  })

  const addLiveItemToCart = async (item: LiveItem) => {
    if (!item.id || String(item.id).startsWith('ph-')) return
    try {
      await addToCart.mutateAsync(cartItemFromLive(item) as any)
    } catch { /* mutation handles */ }
  }

  const handleCatalogQtyChange = async (item: LiveItem, qty: number) => {
    if (!item.id || String(item.id).startsWith('ph-')) return
    try {
      await setCatalogQty({
        productId: String(item.id),
        qty,
        addItem: cartItemFromLive(item) as any,
      })
    } catch { /* mutation handles */ }
  }

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Products'),
  })
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const columns = clampCatalogColumns(props.columns, 4, blockType)
  const itemGap = Math.max(0, Number(props.item_gap ?? 24) || 24)
  const showBadges = props.show_badges !== false
  const textColor = style.text_color || '#111827'

  const normalized = normalizeLiveProducts(liveItems)
  const wellnessSite = isWellnessRetailContext(props, siteStyle, pageBlocks)
  const catalogProducts = wellnessSite
    ? resolveWellnessSiteProducts(normalized, Number(props.show_count) || 12)
    : normalized

  /** ── Wellness / Vibrant Living category cards (circular images on organic blobs) ── */
  if (
    blockType === 'category_cards'
    && props.layout === 'wellness'
    && props.card_style !== 'compact'
    && props.card_style !== 'minimal'
  ) {
    const categoryLayout = readCategorySectionLayout(props)
    const eyebrow = (props.eyebrow as string) || ''
    const itemsReadOnly = categoryItemsReadOnly(isEditorCanvas, liveItems)
    const { cats, propImageByTitle } = resolveCategoryCardPropData(props, liveItems, {
      skipTemplateDefaults: isEditorCanvas,
    })

    if (cats.length === 0) {
      return (
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? undefined}
          message={isEditorCanvas
            ? 'Categories from your catalog will appear here once you add them.'
            : 'No categories to show yet.'}
          hint="Add categories in your dashboard, then they appear here automatically."
          actionHref={vendorDashboardUrl('/categories')}
          actionLabel="Add categories"
          icon={<FolderTree className="w-10 h-10" style={{ color: style.primary_color }} />}
        />
      )
    }

    return (
      <CategoryCardsWellness
        title={title}
        eyebrow={eyebrow}
        style={style}
        categories={cats}
        propImageByTitle={propImageByTitle}
        storePath={storePath}
        blockId={blockId}
        blockProps={props}
        maxItems={categoryLayout.limit}
        itemGap={categoryLayout.itemGap}
        columns={categoryLayout.columns}
        imageHeightPct={categoryLayout.imageHeightPct}
        cardPadding={categoryLayout.cardPadding}
        itemsReadOnly={itemsReadOnly}
      />
    )
  }

  /** ── Editorial category cards (matches vendor builder / Fashion browser) ── */
  if (blockType === 'category_cards' && props.layout === 'editorial') {
    const categoryLayout = readCategorySectionLayout(props)
    const {
      columns: editorialColumns,
      itemGap: editorialGap,
      imageHeightPct: editorialImageHeight,
      cardPadding: editorialCardPadding,
      limit: editorialLimit,
    } = categoryLayout
    const editorialImageShape = imageShapeFromProps(props)
    const editorialTileWrap = catalogTileImageWrapperClass(editorialImageShape)
    const editorialTileSettings = readCatalogTileShapeSettings(props)
    const editorialSectionBg = categorySectionBackground(style, props)
    const editorialTilePadding = categoryEditorialTilePaddingBottom(editorialImageHeight)
    const eyebrow = (props.eyebrow as string) || ''
    const itemsReadOnly = categoryItemsReadOnly(isEditorCanvas, liveItems)
    const { cats, propImageByTitle } = resolveCategoryCardPropData(props, liveItems, {
      skipTemplateDefaults: isEditorCanvas,
    })

    if (cats.length === 0) {
      return (
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? undefined}
          message={isEditorCanvas
            ? 'Categories from your catalog will appear here once you add them.'
            : 'No categories to show yet.'}
          hint="Add categories in your dashboard, then they appear here automatically."
          actionHref={vendorDashboardUrl('/categories')}
          actionLabel="Add categories"
          icon={<FolderTree className="w-10 h-10" style={{ color: style.primary_color }} />}
        />
      )
    }

    const editorialCardClass = 'group relative isolate overflow-hidden block w-full'

    return (
      <SectionWithBg bg={categorySectionBackground(style, props)}>
        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div>
            {(eyebrow || blockId) && (
              <BuilderTextField
                fieldKey="eyebrow"
                blockId={blockId}
                blockProps={props}
                value={eyebrow}
                as="span"
                className="text-xs uppercase tracking-[0.3em] opacity-70 block"
                style={{ color: textColor }}
                placeholder="Tagline"
              />
            )}
            <BuilderTextField
              fieldKey="title"
              blockId={blockId}
              blockProps={props}
              value={title}
              as="h2"
              className="text-3xl sm:text-4xl md:text-5xl mt-2"
              style={{ fontFamily: style.font_heading, color: textColor }}
            />
          </div>
          <span className="text-sm underline opacity-80 cursor-pointer" style={{ color: textColor }}>View all</span>
        </div>
        <div
          className={cn('grid', catalogCols(editorialColumns || 3))}
          style={{ gap: editorialGap }}
        >
          {cats.slice(0, editorialLimit).map((c, i) => {
            const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
            const shapedTile = buildCatalogShapedTileTree(
              {
                shape: editorialImageShape,
                tileWrap: editorialTileWrap,
                overlayDirection: 'bottom',
                sectionBg: editorialSectionBg,
                ...editorialTileSettings,
              },
              {
                image: (
                  <CategoryEditorialImage
                    src={c.image_url}
                    fallback={fallback}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    blockId={blockId}
                    arrayKey="categories"
                    index={i}
                    itemField="image_url"
                    blockProps={props}
                    readOnly={itemsReadOnly}
                  />
                ),
                overlayContent: (
                  <div className={catalogShapedTileOverlayContentClass()} style={{ padding: editorialCardPadding }}>
                    <CategoryCardTitle
                      index={i}
                      title={c.title}
                      blockId={blockId}
                      blockProps={props}
                      readOnly={itemsReadOnly}
                      as="h3"
                      className="text-2xl"
                      style={{ fontFamily: style.font_heading, color: '#fff' }}
                    />
                    <span className="text-xs uppercase tracking-[0.2em] text-white/80 pointer-events-none">Shop now →</span>
                  </div>
                ),
              },
            )
            const cardInner = (
              <div className="absolute inset-0">
                {shapedTile.node}
              </div>
            )
            if (isEditorCanvas) {
              return (
                <div
                  key={`${c.title}-${i}`}
                  className={editorialCardClass}
                  style={{ paddingBottom: `${editorialTilePadding}%` }}
                >
                  {cardInner}
                </div>
              )
            }
            return (
              <Link
                key={`${c.title}-${i}`}
                to={buildCategoryCatalogPath(c.title, c.appliesTo, storePath)}
                className={editorialCardClass}
                style={{ paddingBottom: `${editorialTilePadding}%` }}
              >
                {cardInner}
              </Link>
            )
          })}
        </div>
      </SectionWithBg>
    )
  }

  /** ── Category cards — list, strip, banner, overlay, masonry, grid ── */
  if (blockType === 'category_cards') {
    const categoryLayout = readCategorySectionLayout(props)
    const {
      columns: catColumns,
      itemGap: catGap,
      imageHeightPct,
      cardPadding,
      cardRadius,
      isMinimalCard,
      isCompactCard,
      limit: categoryLimit,
    } = categoryLayout
    const catLayout = String(props.layout ?? 'grid')
    const itemsReadOnly = categoryItemsReadOnly(isEditorCanvas, liveItems)
    const { cats, propImageByTitle } = resolveCategoryCardPropData(props, liveItems, {
      skipTemplateDefaults: isEditorCanvas,
    })
    const sectionBg = categorySectionBackground(style, props)
    const darkSection = props.bg_style === 'dark'
    const colorProps = props as BlockColorProps
    const sectionText = resolveCategorySectionText(style, colorProps, darkSection)
    const cardText = resolveCategoryCardText(style, colorProps, darkSection)
    const categoryImageShape = imageShapeFromProps(props)
    const categoryTileWrap = catalogTileImageWrapperClass(categoryImageShape)
    const categoryTileSettings = readCatalogTileShapeSettings(props)

    if (cats.length === 0) {
      return (
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? undefined}
          message={isEditorCanvas
            ? 'Categories from your catalog will appear here once you add them.'
            : 'No categories to show yet.'}
          hint="Add categories in your dashboard, then they appear here automatically."
          actionHref={vendorDashboardUrl('/categories')}
          actionLabel="Add categories"
          icon={<FolderTree className="w-10 h-10" style={{ color: style.primary_color }} />}
        />
      )
    }

    const wrapCategoryLink = (
      key: string,
      cat: { title: string; appliesTo?: string },
      cardInner: ReactNode,
      className?: string,
    ) => {
      if (isEditorCanvas) {
        return (
          <div key={key} className={cn('group block', className)}>
            {cardInner}
          </div>
        )
      }
      return (
        <Link
          key={key}
          to={buildCategoryCatalogPath(cat.title, cat.appliesTo, storePath)}
          className={cn('group block no-underline', className)}
        >
          {cardInner}
        </Link>
      )
    }

    if (catLayout === 'list') {
      return (
        <SectionWithBg bg={sectionBg} className={builderSectionContainerWithMax('max-w-3xl')}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div className="divide-y" style={{ borderColor: `${sectionText}22` }}>
            {cats.slice(0, categoryLimit).map((c, i) => wrapCategoryLink(
              `${c.title}-${i}`,
              c,
              <>
                <div className="flex items-center justify-between py-4 gap-4">
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    readOnly={itemsReadOnly}
                    as="span"
                    className="text-base font-medium"
                    style={{ fontFamily: style.font_heading, color: sectionText }}
                  />
                  <span className="text-sm opacity-60 shrink-0" style={{ color: sectionText }}>→</span>
                </div>
              </>,
            ))}
          </div>
        </SectionWithBg>
      )
    }

    if (catLayout === 'strip') {
      return (
        <SectionWithBg bg={sectionBg}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ gap: catGap }}>
            {cats.slice(0, categoryLimit).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              const stripSize = isMinimalCard ? 96 : isCompactCard ? 112 : 140
              return wrapCategoryLink(
                `${c.title}-${i}`,
                c,
                <>
                  <div
                    className={cn('relative shrink-0 snap-start overflow-hidden bg-gray-100 mb-2', cardRadius)}
                    style={{ width: stripSize, height: stripSize }}
                  >
                    <CategoryEditorialImage
                      src={c.image_url}
                      fallback={fallback}
                      alt={c.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      blockId={blockId}
                      arrayKey="categories"
                      index={i}
                    itemField="image_url"
                    blockProps={props}
                    readOnly={itemsReadOnly}
                  />
                  </div>
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    readOnly={itemsReadOnly}
                    as="span"
                    className={cn(categoryTitleClass(isMinimalCard, isCompactCard), 'block truncate')}
                    style={{ color: cardText, paddingTop: Math.max(2, cardPadding / 2) }}
                  />
                </>,
                isMinimalCard ? 'shrink-0 w-24 text-center' : isCompactCard ? 'shrink-0 w-28 text-center' : 'shrink-0 w-[140px] text-center',
              )
            })}
          </div>
        </SectionWithBg>
      )
    }

    if (catLayout === 'banner') {
      const bannerCols = catColumns <= 2 ? 2 : catColumns
      return (
        <SectionWithBg bg={sectionBg}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div
            className={cn('grid', catalogCols(bannerCols || 2))}
            style={{ gap: catGap }}
          >
            {cats.slice(0, categoryLimit).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              const shapedTile = buildCatalogShapedTileTree(
                {
                  shape: categoryImageShape,
                  tileWrap: categoryTileWrap,
                  overlayDirection: 'right',
                  sectionBg,
                  ...categoryTileSettings,
                },
                {
                  image: (
                    <CategoryEditorialImage
                      src={c.image_url}
                      fallback={fallback}
                      alt={c.title}
                      className="absolute inset-0 z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      blockId={blockId}
                      arrayKey="categories"
                      index={i}
                      itemField="image_url"
                      blockProps={props}
                      readOnly={itemsReadOnly}
                    />
                  ),
                  overlayContent: (
                    <div className="absolute bottom-4 left-4 right-4 z-[2]" style={{ padding: cardPadding }}>
                      <CategoryCardTitle
                        index={i}
                        title={c.title}
                        blockId={blockId}
                        blockProps={props}
                        readOnly={itemsReadOnly}
                        as="h3"
                        className={cn(
                          isMinimalCard ? 'text-sm' : isCompactCard ? 'text-base' : 'text-lg sm:text-xl',
                          'builder-tile-overlay-title font-semibold',
                          !colorProps.tile_text && 'text-white',
                        )}
                        style={{
                          fontFamily: style.font_heading,
                          ...(colorProps.tile_text ? { color: colorProps.tile_text } : {}),
                        }}
                      />
                    </div>
                  ),
                },
              )
              return wrapCategoryLink(
                `${c.title}-${i}`,
                c,
                <div
                  className={cn(
                    'builder-tile-card relative isolate w-full overflow-hidden',
                    cardRadius,
                    !shapedTile.frame.clipToShape && 'bg-gray-100',
                    catalogTileHostBackdropClass(categoryTileSettings.backdrop, shapedTile.frame.clipToShape, sectionBg),
                  )}
                  style={{
                    ...categoryImageAspectStyle(Math.max(40, Math.min(56, imageHeightPct * 0.5)), categoryImageShape, shapedTile.frame.clipToShape),
                    ...catalogTileHostBackdropStyle(categoryTileSettings.backdrop, shapedTile.frame.clipToShape, sectionBg),
                  }}
                >
                  {shapedTile.node}
                </div>,
              )
            })}
          </div>
        </SectionWithBg>
      )
    }

    if (catLayout === 'overlay') {
      return (
        <SectionWithBg bg={sectionBg}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div
            className={cn('grid', catalogCols(catColumns || 3))}
            style={{ gap: catGap }}
          >
            {cats.slice(0, categoryLimit).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              const shapedTile = buildCatalogShapedTileTree(
                {
                  shape: categoryImageShape,
                  tileWrap: categoryTileWrap,
                  overlayDirection: 'bottom',
                  sectionBg,
                  ...categoryTileSettings,
                },
                {
                  image: (
                    <CategoryEditorialImage
                      src={c.image_url}
                      fallback={fallback}
                      alt={c.title}
                      className="absolute inset-0 z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      blockId={blockId}
                      arrayKey="categories"
                      index={i}
                      itemField="image_url"
                      blockProps={props}
                      readOnly={itemsReadOnly}
                    />
                  ),
                  overlayContent: (
                    <div className={cn(catalogShapedTileOverlayContentClass(), 'right-0')} style={{ padding: cardPadding }}>
                      <CategoryCardTitle
                        index={i}
                        title={c.title}
                        blockId={blockId}
                        blockProps={props}
                        readOnly={itemsReadOnly}
                        as="h3"
                        className={cn(
                          isMinimalCard ? 'text-sm' : isCompactCard ? 'text-sm' : 'text-base',
                          'builder-tile-overlay-title font-semibold',
                          !colorProps.tile_text && 'text-white',
                        )}
                        style={{
                          fontFamily: style.font_heading,
                          ...(colorProps.tile_text ? { color: colorProps.tile_text } : {}),
                        }}
                      />
                    </div>
                  ),
                },
              )
              return wrapCategoryLink(
                `${c.title}-${i}`,
                c,
                <div
                  className={cn(
                    'builder-tile-card relative isolate w-full overflow-hidden',
                    cardRadius,
                    !shapedTile.frame.clipToShape && 'bg-gray-100',
                    catalogTileHostBackdropClass(categoryTileSettings.backdrop, shapedTile.frame.clipToShape, sectionBg),
                  )}
                  style={{
                    ...categoryImageAspectStyle(imageHeightPct, categoryImageShape, shapedTile.frame.clipToShape),
                    ...catalogTileHostBackdropStyle(categoryTileSettings.backdrop, shapedTile.frame.clipToShape, sectionBg),
                  }}
                >
                  {shapedTile.node}
                </div>,
              )
            })}
          </div>
        </SectionWithBg>
      )
    }

    if (catLayout === 'masonry') {
      return (
        <SectionWithBg bg={sectionBg}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div style={{ columnCount: catColumns, columnGap: catGap }}>
            {cats.slice(0, categoryLimit).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              const tall = i % 3 === 0
              return wrapCategoryLink(
                `${c.title}-${i}`,
                c,
                <>
                  <div
                    className={cn('relative w-full break-inside-avoid overflow-hidden bg-gray-100', cardRadius)}
                    style={{
                      marginBottom: catGap,
                      ...categoryImageAspectStyle(tall ? imageHeightPct : Math.max(40, imageHeightPct - 12), categoryImageShape, false),
                    }}
                  >
                    <CategoryEditorialImage
                      src={c.image_url}
                      fallback={fallback}
                      alt={c.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      blockId={blockId}
                      arrayKey="categories"
                      index={i}
                    itemField="image_url"
                    blockProps={props}
                    readOnly={itemsReadOnly}
                  />
                  </div>
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    readOnly={itemsReadOnly}
                    as="span"
                    className={cn(categoryTitleClass(isMinimalCard, isCompactCard), 'block')}
                    style={{ color: cardText, marginBottom: catGap, padding: `0 0 ${Math.max(4, cardPadding / 2)}px` }}
                  />
                </>,
              )
            })}
          </div>
        </SectionWithBg>
      )
    }

    if (catLayout === 'grid' || catLayout === '' || catLayout === 'wellness') {
      const shapedTileSettings = {
        shape: categoryImageShape,
        tileWrap: categoryTileWrap,
        sectionBg,
        ...categoryTileSettings,
      }

      return (
        <SectionWithBg bg={sectionBg}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div
            className={cn('grid', catalogCols(catColumns || 4))}
            style={{ gap: catGap }}
          >
            {cats.slice(0, categoryLimit).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              const shapedTile = buildCatalogShapedTileTree(
                shapedTileSettings,
                {
                  image: (
                    <CategoryEditorialImage
                      src={c.image_url}
                      fallback={fallback}
                      alt={c.title}
                      className="absolute inset-0 z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      blockId={blockId}
                      arrayKey="categories"
                      index={i}
                      itemField="image_url"
                      blockProps={props}
                      readOnly={itemsReadOnly}
                    />
                  ),
                },
              )
              return wrapCategoryLink(
                `${c.title}-${i}`,
                c,
                <div
                  className={cn(
                    'builder-tile-card overflow-hidden bg-white border border-gray-100 flex flex-col h-full',
                    cardRadius,
                    isMinimalCard ? '' : 'hover:shadow-md transition-shadow',
                  )}
                >
                  <div
                    className={cn(
                      'relative w-full',
                      shapedTile.frame.clipToShape ? '' : 'overflow-hidden bg-gray-100',
                      !shapedTile.frame.clipToShape && categoryTileWrap,
                      catalogTileHostBackdropClass(categoryTileSettings.backdrop, shapedTile.frame.clipToShape, sectionBg),
                    )}
                    style={{
                      ...categoryImageAspectStyle(imageHeightPct, categoryImageShape, shapedTile.frame.clipToShape),
                      ...catalogTileHostBackdropStyle(categoryTileSettings.backdrop, shapedTile.frame.clipToShape, sectionBg),
                    }}
                  >
                    {shapedTile.node}
                  </div>
                  <div style={{ padding: cardPadding }}>
                    <CategoryCardTitle
                      index={i}
                      title={c.title}
                      blockId={blockId}
                      blockProps={props}
                      readOnly={itemsReadOnly}
                      as="h3"
                      className={categoryTitleClass(isMinimalCard, isCompactCard)}
                      style={{ fontFamily: style.font_heading, color: cardText }}
                    />
                  </div>
                </div>,
                'text-center',
              )
            })}
          </div>
        </SectionWithBg>
      )
    }
  }

  /** ── Editorial product grid + optional featured row (vendor / Atelier) ── */
  if (blockType === 'product_grid' && props.layout === 'editorial') {
    const editorialProductShape = imageShapeFromProps(props)
    const editorialProductWrap = catalogTileImageWrapperClass(editorialProductShape)
    const rawItems = catalogProducts
    if (rawItems.length === 0 && !wellnessSite) {
      return (
        <SectionWithBg bg={style.surface_color || style.bg_color || '#ffffff'}>
          <BuilderTextField
            fieldKey="title"
            blockId={blockId}
            blockProps={props}
            value={title}
            as="h2"
            className="text-3xl sm:text-4xl mb-4"
            style={{ fontFamily: style.font_heading, color: textColor }}
          />
          <p className="text-sm opacity-70" style={{ color: textColor }}>Your products will appear here once you add them to your catalog from the Products page.</p>
        </SectionWithBg>
      )
    }
    const useSpotlight = props.featured_spotlight !== false && rawItems.length >= 1
    const featuredOne = useSpotlight ? rawItems[0] : null
    const gridList = useSpotlight ? rawItems.slice(1) : rawItems
    const gridCls = (
      isEditorCanvas
        ? catalogGridColClassForBreakpoint(columns, previewBp)
        : catalogGridResponsiveColClass(columns)
    ).replace(/^grid-cols-1 /, '')

    return (
      <div style={{ backgroundColor: style.surface_color || style.bg_color }}>
        <section className={builderSectionContainerClass()}>
          <div className="flex items-end justify-between mb-10 gap-4">
            <BuilderTextField
              fieldKey="title"
              blockId={blockId}
              blockProps={props}
              value={title}
              as="h2"
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: style.font_heading, color: textColor }}
            />
            <span className="text-sm underline opacity-80" style={{ color: textColor }}>View all</span>
          </div>

          {featuredOne && (
            <div
              className={cn('border-y mb-16 sm:mb-20', builderSectionBleedClass())}
              style={{ borderColor: `${textColor}18`, backgroundColor: style.bg_color }}
            >
              <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                <div className="aspect-[4/5] relative overflow-hidden bg-gray-100">
                  {featuredOne.image_url ? (
                    <BuilderCanvasProductImage
                      blockId={blockId}
                      src={mediaUrl(featuredOne.image_url)}
                      alt={featuredOne.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      isCatalogPhoto={!String(featuredOne.id || '').startsWith('ph-')}
                      allowNavigation
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-gray-300" /></div>
                  )}
                </div>
                <div>
                  <span className="text-xs uppercase tracking-[0.3em] opacity-70" style={{ color: textColor }}>
                    {(featuredOne.meta as Record<string, unknown>)?.is_category_showcase
                      ? 'Category highlight'
                      : `Featured${(featuredOne.meta as any)?.brand != null && String((featuredOne.meta as any).brand).trim() !== '' ? ` · ${(featuredOne.meta as any).brand}` : ''}`}
                  </span>
                  <h3 className="text-3xl sm:text-4xl lg:text-5xl mt-3 mb-4 text-balance" style={{ fontFamily: style.font_heading, color: textColor }}>
                    {featuredOne.title}
                  </h3>
                  <p className="text-base opacity-80 mb-8 max-w-lg leading-relaxed" style={{ color: textColor }}>
                    {(featuredOne as any).description || featuredOne.subtitle || ' '}
                  </p>
                  {!(featuredOne.meta as Record<string, unknown>)?.is_category_showcase && (
                    <div className="text-2xl mb-8" style={{ fontFamily: style.font_heading, color: textColor }}>
                      {featuredOne.price_formatted ? featuredOne.price_formatted : null}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {(featuredOne.meta as Record<string, unknown>)?.is_category_showcase ? (
                      <Link
                        to={buildCategoryCatalogPath(
                          featuredOne.title || '',
                          String((featuredOne.meta as Record<string, unknown>)?.applies_to || 'both'),
                          storePath,
                        )}
                        style={{ backgroundColor: style.primary_color, color: '#fff' }}
                        className="h-12 px-8 text-xs font-bold uppercase tracking-[0.2em] rounded-none inline-flex items-center"
                      >
                        Shop category
                      </Link>
                    ) : (
                      <CatalogAddOrQtyControl
                        cartQty={cartQtyByProduct.get(String(featuredOne.id)) ?? 0}
                        onAdd={() => addLiveItemToCart(featuredOne)}
                        onQtyChange={qty => handleCatalogQtyChange(featuredOne, qty)}
                        pending={addToCart.isPending && (addToCart.variables as any)?.product_id === featuredOne.id}
                        primaryColor={style.primary_color}
                        addButtonStyle="filled"
                        fullWidth={false}
                        className="h-12 min-w-[10rem] rounded-none px-6 text-xs font-bold uppercase tracking-[0.2em]"
                      />
                    )}
                    <button
                      type="button"
                      style={{ border: `1px solid ${textColor}99`, color: textColor }}
                      className="h-12 w-12 rounded-none bg-transparent flex items-center justify-center"
                      aria-label="Wishlist"
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className={`grid ${gridCls}`}
            style={{ columnGap: itemGap, rowGap: Math.max(itemGap, 48) }}
          >
            {gridList.map(item => {
              const outOfStock = item.meta?.stock_status === 'out_of_stock'
              const cartQty = cartQtyByProduct.get(String(item.id)) ?? 0
              const isPh = String(item.id || '').startsWith('ph-') || String(item.id || '').startsWith('wl-showcase-')
              const isShowcase = !!(item.meta as Record<string, unknown>)?.is_category_showcase
              const views = productViewCount(item)
              return (
                <div key={item.id || item.title} className="group">
                  {isEditorCanvas ? (
                    <div
                      className="block cursor-pointer"
                      role="link"
                      tabIndex={0}
                      data-builder-catalog-nav="product"
                      onClick={e => {
                        e.stopPropagation()
                        openCatalogItemInBuilder(builderCanvas?.onNavigate, item)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openCatalogItemInBuilder(builderCanvas?.onNavigate, item)
                        }
                      }}
                    >
                      <div
                        className={cn(
                          'relative overflow-hidden mb-4 bg-gray-100',
                          editorialProductWrap,
                          editorialProductShape === 'circle'
                            ? 'aspect-square max-w-[min(100%,280px)] mx-auto w-full'
                            : 'aspect-[4/5] w-full',
                        )}
                      >
                        {item.image_url ? (
                          <BuilderCanvasProductImage
                            blockId={blockId}
                            src={mediaUrl(item.image_url)}
                            alt={item.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            isCatalogPhoto={!isPh}
                            allowNavigation={!isPh}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-300" /></div>
                        )}
                        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 items-start pointer-events-none">
                          {views != null && <ProductViewBadge count={views} />}
                          {showBadges && !!item.meta?.is_featured && (
                            <span style={{ backgroundColor: style.primary_color, color: '#fff' }} className="text-xs uppercase tracking-[0.2em] px-2 py-1">Featured</span>
                          )}
                        </div>
                        {!isPh && (
                          <div
                            className="absolute bottom-3 left-3 right-3 h-10 text-xs uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-semibold"
                            style={{ backgroundColor: textColor, color: style.bg_color }}
                          >
                            Quick add
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                  <Link
                    to={resolveLiveCatalogStorePath(item, storePath) ?? '#'}
                    className="block"
                    data-builder-catalog-nav="product"
                    onClick={e => handleProductCardClick(e, item)}
                  >
                    <div
                      className={cn(
                        'relative overflow-hidden mb-4 bg-gray-100',
                        editorialProductWrap,
                        editorialProductShape === 'circle'
                          ? 'aspect-square max-w-[min(100%,280px)] mx-auto w-full'
                          : 'aspect-[4/5] w-full',
                      )}
                    >
                      {item.image_url ? (
                        <BuilderCanvasProductImage
                          blockId={blockId}
                          src={mediaUrl(item.image_url)}
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          isCatalogPhoto={!isPh}
                          allowNavigation={!isPh}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-300" /></div>
                      )}
                      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 items-start pointer-events-none">
                        {views != null && <ProductViewBadge count={views} />}
                        {showBadges && !!item.meta?.is_featured && (
                          <span style={{ backgroundColor: style.primary_color, color: '#fff' }} className="text-xs uppercase tracking-[0.2em] px-2 py-1">Featured</span>
                        )}
                      </div>
                      {!isPh && (
                        <div
                          className="absolute bottom-3 left-3 right-3 h-10 text-xs uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-semibold"
                          style={{ backgroundColor: textColor, color: style.bg_color }}
                        >
                          Quick add
                        </div>
                      )}
                    </div>
                  </Link>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: textColor }}>{item.title}</div>
                      {item.subtitle && <div className="text-xs opacity-60 truncate">{item.subtitle}</div>}
                    </div>
                    <span className="text-sm shrink-0" style={{ color: textColor }}>{item.price_formatted || ''}</span>
                  </div>
                  {!isPh && (
                    <div className="mt-3">
                      <CatalogAddOrQtyControl
                        cartQty={cartQty}
                        onAdd={() => addLiveItemToCart(item)}
                        onQtyChange={qty => handleCatalogQtyChange(item, qty)}
                        disabled={outOfStock}
                        outOfStock={outOfStock}
                        pending={addToCart.isPending && (addToCart.variables as any)?.product_id === item.id}
                        primaryColor={style.primary_color}
                        addButtonStyle="filled"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  /** ── Default product / menu grid (original business front behavior) ── */
  const items = catalogProducts.length > 0
    ? catalogProducts
    : (props.items as LiveItem[] | undefined) || []

  const cardLayout = readCatalogCardLayout(props, blockType)
  const productImageShape = imageShapeFromProps(props)
  const productTileWrap = catalogTileImageWrapperClass(productImageShape)
  const isCircleProductTile = productImageShape === 'circle'
  const {
    imageHeightPct,
    imageWidthPct,
    cardPadding,
    cardRadius,
    cardBorderRadius,
    imageAspect,
    imageObjectFit,
    isMinimalCard,
    isCompactCard,
    titleClass,
    priceClass,
    showStock,
    showAddButton,
    addButtonStyle,
  } = {
    imageHeightPct: cardLayout.imageHeightPct,
    imageWidthPct: cardLayout.imageWidthPct,
    cardPadding: cardLayout.cardPadding,
    cardRadius: cardLayout.cardRadius,
    cardBorderRadius: cardLayout.cardBorderRadius,
    imageAspect: cardLayout.imageAspect,
    imageObjectFit: cardLayout.imageObjectFit,
    isMinimalCard: cardLayout.isMinimalCard,
    isCompactCard: cardLayout.isCompactCard,
    titleClass: cardLayout.isMinimalCard
      ? 'font-medium text-gray-900 text-xs line-clamp-1 mb-1'
      : cardLayout.isCompactCard
        ? 'font-semibold text-gray-900 text-sm line-clamp-2 mb-1'
        : 'font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-2',
    priceClass: cardLayout.isMinimalCard ? 'text-sm font-bold' : cardLayout.isCompactCard ? 'text-base font-bold' : 'text-lg font-bold',
    showStock: cardLayout.showStock,
    showAddButton: cardLayout.showAddButton,
    addButtonStyle: cardLayout.addButtonStyle,
  }

  return (
    <section className={builderSectionContainerClass()}>
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" />
      )}
      {items.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: style.primary_color }} />
          <p className="text-sm font-medium text-gray-600">Products will show here</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Add products in your dashboard under Products, then they will appear in this section automatically.
          </p>
          <a
            href={vendorDashboardUrl('/products/new')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: style.primary_color || '#274832' }}
          >
            Add a product
          </a>
        </div>
      ) : (
        <div
          className={`grid ${catalogCols(columns)}`}
          style={{ gap: itemGap }}
        >
          {items.map(item => {
            const cartQty = cartQtyByProduct.get(String(item.id)) ?? 0
            const isAdding = addToCart.isPending && addToCart.variables && (addToCart.variables as any).product_id === item.id
            const outOfStock = item.meta?.stock_status === 'out_of_stock'
            const views = productViewCount(item)
            const imageShell = buildCatalogImageShell({
              imageHeightPct,
              imageWidthPct,
              imageAspect,
              imageObjectFit,
              productTileWrap,
              isCircle: isCircleProductTile,
            })
            const cardRadiusPresentation = resolveCardRadiusPresentation(cardBorderRadius, cardRadius)
            return (
              <div
                key={item.id}
                className={cn(
                  'builder-tile-card group bg-white border border-gray-100 overflow-hidden transition-all duration-200 flex flex-col',
                  cardRadiusPresentation.className,
                  isMinimalCard ? '' : 'hover:shadow-lg hover:-translate-y-1',
                )}
                style={cardRadiusPresentation.style}
              >
                <Link
                  to={resolveLiveCatalogStorePath(item, storePath) ?? '#'}
                  className="block"
                  data-builder-catalog-nav="product"
                  onClick={e => handleProductCardClick(e, item)}
                >
                  <div
                    className={imageShell.wrapperClassName}
                    style={imageShell.wrapperStyle}
                  >
                    {item.image_url ? (
                      <BuilderCanvasProductImage
                        blockId={blockId}
                        src={item.image_url}
                        alt={item.title}
                        className={imageShell.imageClassName}
                        isCatalogPhoto={!String(item.id || '').startsWith('ph-')}
                        allowNavigation={!String(item.id || '').startsWith('ph-')}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <ShoppingBag className={isMinimalCard ? 'w-8 h-8' : 'w-12 h-12'} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none">
                      {views != null && <ProductViewBadge count={views} />}
                      {showBadges && !!item.meta?.is_on_sale && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>
                      )}
                    </div>
                    {showBadges && !!item.meta?.is_featured && (
                      <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />Featured</span>
                    )}
                  </div>
                  <div style={{ padding: cardPadding, paddingBottom: Math.max(4, cardPadding - 4) }}>
                    {item.subtitle && !isMinimalCard && <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{item.subtitle}</p>}
                    <h3 className={titleClass}>{item.title}</h3>
                    {item.price_formatted && (
                      <div className="flex items-center gap-2">
                        <span className={priceClass} style={{ color: style.primary_color }}>{item.price_formatted}</span>
                        {!isMinimalCard && item.meta?.compare_at_price != null && String(item.meta.compare_at_price) !== '' && (
                          <span className="text-sm text-gray-400 line-through">
                            {String(item.meta.currency ?? '')} {Number(item.meta.compare_at_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {showStock && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-2 inline-block ${outOfStock ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                        {outOfStock ? 'Out of Stock' : 'In Stock'}
                      </span>
                    )}
                  </div>
                </Link>

                {showAddButton && (
                <div
                  style={{ padding: cardPadding, paddingTop: 0 }}
                  className="mt-auto"
                >
                  <CatalogAddOrQtyControl
                    cartQty={cartQty}
                    onAdd={() => addLiveItemToCart(item)}
                    onQtyChange={qty => handleCatalogQtyChange(item, qty)}
                    outOfStock={outOfStock}
                    pending={!!isAdding}
                    primaryColor={style.primary_color}
                    addButtonStyle={addButtonStyle}
                    isMinimalCard={isMinimalCard}
                    isCompactCard={isCompactCard}
                  />
                </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
