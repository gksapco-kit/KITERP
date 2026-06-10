import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Star, ShoppingCart, Check, Loader2, Heart } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useAuthStore } from '@/stores/authStore'
import { useAddToCart } from '@/hooks/useStore'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import CategoryCardsWellness from '@/components/builder/blocks/CategoryCardsWellness'
import {
  WELLNESS_CATEGORY_FALLBACK_IMAGES,
  WELLNESS_DEFAULT_CATEGORY_TITLES,
  normalizeCategoryCardItems,
  resolveCategoryCardImage,
} from '@/lib/wellnessCategoryStyle'
import { sanitizeWellnessCategoryTitle } from '@/lib/wellnessTemplateCopy'
import { normalizeLiveProducts } from '@/lib/liveProductUtils'
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
import {
  CATALOG_GRID_COL_CLASS,
  catalogGridResponsiveColClass,
  clampCatalogColumns,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'
import {
  catalogTileImageWrapperClass,
  imageShapeFromProps,
} from '@/lib/sectionItemLayout'
import type { BlockColorProps } from '@/lib/blockColorOverrides'

function categorySectionBackground(style: StyleConfig, props: Record<string, unknown>): string {
  const p = props as BlockColorProps
  if (props.bg_style === 'dark') return p.bg_color_override || '#111827'
  return p.bg_color_override || style.bg_color || '#F9F9F5'
}

function resolveCategoryCardPropData(
  props: Record<string, unknown>,
  liveItems: LiveItem[],
): {
  cats: ReturnType<typeof normalizeCategoryCardItems>
  propImageByTitle: Map<string, string | undefined>
} {
  const propCats = (() => {
    const raw = props.categories as { title?: string; image_url?: string }[] | undefined
    const list = Array.isArray(raw) ? raw.filter(c => c && typeof c === 'object') : []
    const defaults = WELLNESS_DEFAULT_CATEGORY_TITLES.map((title, i) => ({
      title,
      image_url: WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
    }))
    return (list.length > 0 ? list : defaults).map((c, i) => ({
      title: sanitizeWellnessCategoryTitle(c.title || `Category ${i + 1}`),
      image_url: c.image_url || WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
    }))
  })()
  const propImageByTitle = new Map(
    propCats.map(c => [String(c.title || '').toLowerCase(), c.image_url]),
  )
  const cats = normalizeCategoryCardItems(
    liveItems.length > 0 ? liveItems : propCats,
    propImageByTitle,
  )
  return { cats, propImageByTitle }
}

function CategorySectionHeader({
  title,
  textColor,
  style,
  blockId,
  blockProps,
}: {
  title: string
  textColor: string
  style: StyleConfig
  blockId?: string
  blockProps: Record<string, unknown>
}) {
  return (
    <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
      <BuilderTextField
        fieldKey="title"
        blockId={blockId}
        blockProps={blockProps}
        value={title}
        as="h2"
        className="text-3xl sm:text-4xl md:text-5xl"
        style={{ fontFamily: style.font_heading, color: textColor }}
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
  const siteStyle = { ...(site.style_config || {}), ...style } as Record<string, unknown>
  const { storePath } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const addToCart = useAddToCart()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const handleAddToCart = async (e: React.MouseEvent, item: LiveItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (!item.id || String(item.id).startsWith('ph-')) return
    try {
      await addToCart.mutateAsync({
        product_id: item.id,
        name: item.title ?? 'Product',
        qty: 1,
        price: Number(item.price ?? 0),
        image_url: item.image_url ?? item.image,
      } as any)
      setAddedIds(prev => { const next = new Set(prev); next.add(item.id!); return next })
      setTimeout(() => setAddedIds(prev => { const next = new Set(prev); next.delete(item.id!); return next }), 2000)
    } catch { /* mutation handles */ }
  }

  const title = (props.title as string) || 'Products'
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
    && (props.layout === 'wellness'
      || (props._image_category_id === 'wellness' && props.layout !== 'banner' && props.layout !== 'strip'))
  ) {
    const eyebrow = (props.eyebrow as string) || ''
    const propCats = (() => {
      const raw = props.categories as { title?: string; image_url?: string }[] | undefined
      const list = Array.isArray(raw) ? raw.filter(c => c && typeof c === 'object') : []
      const defaults = WELLNESS_DEFAULT_CATEGORY_TITLES.map((title, i) => ({
        title,
        image_url: WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
      }))
      return (list.length > 0 ? list : defaults).map((c, i) => ({
        title: sanitizeWellnessCategoryTitle(c.title || `Category ${i + 1}`),
        image_url: c.image_url || WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
      }))
    })()
    const propImageByTitle = new Map(
      propCats.map(c => [String(c.title || '').toLowerCase(), c.image_url]),
    )
    const cats = normalizeCategoryCardItems(
      liveItems.length > 0 ? liveItems : propCats,
      propImageByTitle,
    )

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
      />
    )
  }

  /** ── Editorial category cards (matches vendor builder / Fashion browser) ── */
  if (blockType === 'category_cards' && props.layout === 'editorial') {
    const editorialImageShape = imageShapeFromProps(props)
    const editorialTileWrap = catalogTileImageWrapperClass(editorialImageShape)
    const eyebrow = (props.eyebrow as string) || ''
    const propCats = (() => {
      const raw = props.categories as { title?: string; image_url?: string }[] | undefined
      const list = Array.isArray(raw) ? raw.filter(c => c && typeof c === 'object') : []
      const defaults = [
        { title: 'Women' },
        { title: 'Men' },
        { title: 'Accessories' },
      ]
      return (list.length > 0 ? list : defaults).map(c => ({
        title: c.title || 'Category',
        image_url: c.image_url,
      }))
    })()
    const propImageByTitle = new Map(
      propCats.map(c => [String(c.title || '').toLowerCase(), c.image_url]),
    )
    const cats = normalizeCategoryCardItems(
      liveItems.length > 0 ? liveItems : propCats,
      propImageByTitle,
    )

    return (
      <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: categorySectionBackground(style, props) }}>
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
                placeholder="Eyebrow"
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
        <div className="grid md:grid-cols-3 gap-1">
          {cats.slice(0, 9).map((c, i) => {
            const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
            const cardInner = (
              <>
                <div className={cn('absolute inset-0', editorialTileWrap)}>
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
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 p-6 text-white">
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    as="h3"
                    className="text-2xl"
                    style={{ fontFamily: style.font_heading, color: '#fff' }}
                  />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/80 pointer-events-none">Shop now →</span>
                </div>
              </>
            )
            if (isEditorCanvas) {
              return (
                <div
                  key={`${c.title}-${i}`}
                  className="group relative aspect-[4/5] overflow-hidden block"
                >
                  {cardInner}
                </div>
              )
            }
            return (
              <Link key={`${c.title}-${i}`} to={storePath('/products')} className="group relative aspect-[4/5] overflow-hidden block">
                {cardInner}
              </Link>
            )
          })}
        </div>
      </section>
    )
  }

  /** ── Category cards — list, strip, banner, overlay, masonry, grid ── */
  if (blockType === 'category_cards') {
    const catLayout = String(props.layout ?? 'grid')
    const catColumns = clampCatalogColumns(props.columns, 4, blockType)
    const catGap = Math.max(0, Number(props.item_gap ?? 24) || 24)
    const { cats, propImageByTitle } = resolveCategoryCardPropData(props, liveItems)
    const sectionBg = categorySectionBackground(style, props)
    const darkSection = props.bg_style === 'dark'
    const sectionText = darkSection ? '#f9fafb' : textColor

    const wrapCategoryLink = (key: string, cardInner: ReactNode, className?: string) => {
      if (isEditorCanvas) {
        return (
          <div key={key} className={cn('group block', className)}>
            {cardInner}
          </div>
        )
      }
      return (
        <Link key={key} to={storePath('/products')} className={cn('group block no-underline', className)}>
          {cardInner}
        </Link>
      )
    }

    if (catLayout === 'list') {
      return (
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-3xl mx-auto" style={{ backgroundColor: sectionBg }}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div className="divide-y" style={{ borderColor: `${sectionText}22` }}>
            {cats.slice(0, 12).map((c, i) => wrapCategoryLink(
              `${c.title}-${i}`,
              <>
                <div className="flex items-center justify-between py-4 gap-4">
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    as="span"
                    className="text-base font-medium"
                    style={{ fontFamily: style.font_heading, color: sectionText }}
                  />
                  <span className="text-sm opacity-60 shrink-0" style={{ color: sectionText }}>→</span>
                </div>
              </>,
            ))}
          </div>
        </section>
      )
    }

    if (catLayout === 'strip') {
      return (
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: sectionBg }}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ gap: catGap }}>
            {cats.slice(0, catColumns).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              return wrapCategoryLink(
                `${c.title}-${i}`,
                <>
                  <div className="relative aspect-square w-[120px] sm:w-[140px] shrink-0 snap-start rounded-lg overflow-hidden bg-gray-100 mb-2">
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
                    />
                  </div>
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    as="span"
                    className="text-xs font-medium text-center block truncate"
                    style={{ color: sectionText }}
                  />
                </>,
                'shrink-0 w-[120px] sm:w-[140px] text-center',
              )
            })}
          </div>
        </section>
      )
    }

    if (catLayout === 'banner') {
      const bannerCols = catColumns <= 2 ? 2 : catColumns
      return (
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: sectionBg }}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div
            className={cn('grid', CATALOG_GRID_COL_CLASS[bannerCols] || CATALOG_GRID_COL_CLASS[2])}
            style={{ gap: catGap }}
          >
            {cats.slice(0, bannerCols * 2).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              return wrapCategoryLink(
                `${c.title}-${i}`,
                <div className="relative aspect-[21/9] rounded-xl overflow-hidden bg-gray-100">
                  <CategoryEditorialImage
                    src={c.image_url}
                    fallback={fallback}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    blockId={blockId}
                    arrayKey="categories"
                    index={i}
                    itemField="image_url"
                    blockProps={props}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <CategoryCardTitle
                      index={i}
                      title={c.title}
                      blockId={blockId}
                      blockProps={props}
                      as="h3"
                      className="text-lg sm:text-xl font-semibold text-white"
                      style={{ fontFamily: style.font_heading }}
                    />
                  </div>
                </div>,
              )
            })}
          </div>
        </section>
      )
    }

    if (catLayout === 'overlay') {
      return (
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: sectionBg }}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div
            className={cn('grid', CATALOG_GRID_COL_CLASS[catColumns] || CATALOG_GRID_COL_CLASS[3])}
            style={{ gap: catGap }}
          >
            {cats.slice(0, catColumns * 2).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              return wrapCategoryLink(
                `${c.title}-${i}`,
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gray-100">
                  <CategoryEditorialImage
                    src={c.image_url}
                    fallback={fallback}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    blockId={blockId}
                    arrayKey="categories"
                    index={i}
                    itemField="image_url"
                    blockProps={props}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <CategoryCardTitle
                      index={i}
                      title={c.title}
                      blockId={blockId}
                      blockProps={props}
                      as="h3"
                      className="text-base font-semibold text-white"
                      style={{ fontFamily: style.font_heading }}
                    />
                  </div>
                </div>,
              )
            })}
          </div>
        </section>
      )
    }

    if (catLayout === 'masonry') {
      return (
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: sectionBg }}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div style={{ columnCount: catColumns, columnGap: catGap }}>
            {cats.slice(0, catColumns * 3).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              const tall = i % 3 === 0
              return wrapCategoryLink(
                `${c.title}-${i}`,
                <>
                  <div
                    className={cn(
                      'relative mb-4 break-inside-avoid rounded-lg overflow-hidden bg-gray-100',
                      tall ? 'aspect-[4/5]' : 'aspect-square',
                    )}
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
                    />
                  </div>
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    as="span"
                    className="text-sm font-medium block mb-4"
                    style={{ color: sectionText }}
                  />
                </>,
              )
            })}
          </div>
        </section>
      )
    }

    if (catLayout === 'grid' || catLayout === '') {
      const imageShape = imageShapeFromProps(props)
      const isCircle = imageShape === 'circle'
      const tileWrap = catalogTileImageWrapperClass(imageShape)
      const maxItems = Math.min(cats.length, catColumns * 3)

      return (
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: sectionBg }}>
          <CategorySectionHeader title={title} textColor={sectionText} style={style} blockId={blockId} blockProps={props} />
          <div
            className={cn('grid', CATALOG_GRID_COL_CLASS[catColumns] || CATALOG_GRID_COL_CLASS[4])}
            style={{ gap: catGap }}
          >
            {cats.slice(0, maxItems).map((c, i) => {
              const fallback = resolveCategoryCardImage({ title: c.title, image_url: null }, i, propImageByTitle)
              return wrapCategoryLink(
                `${c.title}-${i}`,
                <>
                  <div
                    className={cn(
                      'builder-tile-card relative mb-3 bg-gray-100',
                      tileWrap,
                      isCircle ? 'aspect-square max-w-[200px] mx-auto w-full' : 'aspect-[4/5] w-full',
                    )}
                  >
                    <CategoryEditorialImage
                      src={c.image_url}
                      fallback={fallback}
                      alt={c.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      blockId={blockId}
                      arrayKey="categories"
                      index={i}
                      itemField="image_url"
                      blockProps={props}
                    />
                  </div>
                  <CategoryCardTitle
                    index={i}
                    title={c.title}
                    blockId={blockId}
                    blockProps={props}
                    as="h3"
                    className="text-base font-medium text-center"
                    style={{ fontFamily: style.font_heading, color: sectionText }}
                  />
                </>,
                'text-center',
              )
            })}
          </div>
        </section>
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
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: style.surface_color || style.bg_color }}>
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
        </section>
      )
    }
    const useSpotlight = props.featured_spotlight !== false && rawItems.length >= 1
    const featuredOne = useSpotlight ? rawItems[0] : null
    const gridList = useSpotlight ? rawItems.slice(1) : rawItems
    const gridCls = catalogGridResponsiveColClass(columns).replace(/^grid-cols-1 /, '')

    return (
      <div style={{ backgroundColor: style.surface_color || style.bg_color }}>
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto">
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
              className="border-y mb-16 sm:mb-20 -mx-6 sm:-mx-12 px-6 sm:px-12"
              style={{ borderColor: `${textColor}18`, backgroundColor: style.bg_color }}
            >
              <div className="max-w-7xl mx-auto py-16 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                <div className="aspect-[4/5] relative overflow-hidden bg-gray-100">
                  {featuredOne.image_url ? (
                    <BuilderCanvasProductImage
                      blockId={blockId}
                      src={mediaUrl(featuredOne.image_url)}
                      alt={featuredOne.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      isCatalogPhoto={!String(featuredOne.id || '').startsWith('ph-')}
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
                      {featuredOne.price_formatted || '—'}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {(featuredOne.meta as Record<string, unknown>)?.is_category_showcase ? (
                      <Link
                        to={storePath('/products')}
                        style={{ backgroundColor: style.primary_color, color: '#fff' }}
                        className="h-12 px-8 text-xs font-bold uppercase tracking-[0.2em] rounded-none inline-flex items-center"
                      >
                        Shop category
                      </Link>
                    ) : (
                      <button
                        type="button"
                        style={{ backgroundColor: style.primary_color, color: '#fff' }}
                        className="h-12 px-8 text-xs font-bold uppercase tracking-[0.2em] rounded-none"
                        onClick={e => handleAddToCart(e, featuredOne)}
                      >
                        Add to cart
                      </button>
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
              const isPh = String(item.id || '').startsWith('ph-') || String(item.id || '').startsWith('wl-showcase-')
              const isShowcase = !!(item.meta as Record<string, unknown>)?.is_category_showcase
              return (
                <div key={item.id || item.title} className="group">
                  <Link to={item.url ? storePath(item.url) : storePath('/products')} className="block">
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
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-300" /></div>
                      )}
                      {showBadges && !!item.meta?.is_featured && (
                        <span style={{ backgroundColor: style.primary_color, color: '#fff' }} className="absolute top-3 left-3 text-xs uppercase tracking-[0.2em] px-2 py-1">Featured</span>
                      )}
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
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: textColor }}>{item.title}</div>
                      {item.subtitle && <div className="text-xs opacity-60 truncate">{item.subtitle}</div>}
                    </div>
                    <span className="text-sm shrink-0" style={{ color: textColor }}>{item.price_formatted || '—'}</span>
                  </div>
                  {!isPh && (
                    <button
                      type="button"
                      onClick={e => handleAddToCart(e, item)}
                      disabled={outOfStock}
                      className="mt-3 w-full py-2 text-xs font-medium rounded-lg text-white disabled:opacity-50"
                      style={{ backgroundColor: style.primary_color }}
                    >
                      {outOfStock ? 'Out of stock' : 'Add to cart'}
                    </button>
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
    cardPadding,
    cardRadius,
    isMinimalCard,
    isCompactCard,
    titleClass,
    priceClass,
    buttonClass,
    showStock,
    showAddButton,
  } = {
    imageHeightPct: cardLayout.imageHeightPct,
    cardPadding: cardLayout.cardPadding,
    cardRadius: cardLayout.cardRadius,
    isMinimalCard: cardLayout.isMinimalCard,
    isCompactCard: cardLayout.isCompactCard,
    titleClass: cardLayout.isMinimalCard
      ? 'font-medium text-gray-900 text-xs line-clamp-1 mb-1'
      : cardLayout.isCompactCard
        ? 'font-semibold text-gray-900 text-sm line-clamp-2 mb-1'
        : 'font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-2',
    priceClass: cardLayout.isMinimalCard ? 'text-sm font-bold' : cardLayout.isCompactCard ? 'text-base font-bold' : 'text-lg font-bold',
    buttonClass: cardLayout.isMinimalCard
      ? 'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-white text-[11px] font-semibold transition-all disabled:opacity-60 hover:opacity-90'
      : cardLayout.isCompactCard
        ? 'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-xs font-semibold transition-all disabled:opacity-60 hover:opacity-90'
        : 'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90',
    showStock: cardLayout.showStock,
    showAddButton: cardLayout.showAddButton,
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" />
      )}
      {items.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: style.primary_color }} />
          <p className="text-sm font-medium text-gray-600">Products will show here</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Add products in your dashboard under Products, then they will appear in this section automatically.</p>
        </div>
      ) : (
        <div
          className={`grid ${CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[4]}`}
          style={{ gap: itemGap }}
        >
          {items.map(item => {
            const isAdded = addedIds.has(item.id!)
            const isAdding = addToCart.isPending && addToCart.variables && (addToCart.variables as any).product_id === item.id
            const outOfStock = item.meta?.stock_status === 'out_of_stock'
            return (
              <div
                key={item.id}
                className={`builder-tile-card group bg-white border border-gray-100 overflow-hidden transition-all duration-200 flex flex-col ${cardRadius} ${isMinimalCard ? '' : 'hover:shadow-lg hover:-translate-y-1'}`}
              >
                <Link
                  to={item.url ? storePath(item.url) : storePath('/products')}
                  className="block"
                >
                  <div
                    className={cn(
                      'relative w-full overflow-hidden bg-gray-50',
                      productTileWrap,
                      isCircleProductTile && 'aspect-square max-w-[min(100%,240px)] mx-auto',
                    )}
                    style={isCircleProductTile ? undefined : { paddingBottom: `${imageHeightPct}%` }}
                  >
                    {item.image_url ? (
                      <BuilderCanvasProductImage
                        blockId={blockId}
                        src={item.image_url}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        isCatalogPhoto={!String(item.id || '').startsWith('ph-')}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <ShoppingBag className={isMinimalCard ? 'w-8 h-8' : 'w-12 h-12'} />
                      </div>
                    )}
                    {showBadges && !!item.meta?.is_on_sale && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>
                    )}
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
                <div style={{ padding: cardPadding, paddingTop: 0 }} className="mt-auto">
                  <button
                    onClick={e => handleAddToCart(e, item)}
                    disabled={outOfStock || isAdded || !!isAdding}
                    className={buttonClass}
                    style={{ backgroundColor: isAdded ? '#10b981' : style.primary_color }}
                  >
                    {isAdding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isAdded ? (
                      <><Check className="w-4 h-4" /> Added!</>
                    ) : outOfStock ? (
                      'Out of Stock'
                    ) : (
                      <><ShoppingCart className={isMinimalCard ? 'w-3 h-3' : 'w-4 h-4'} /> {isMinimalCard ? 'Add' : 'Add to Cart'}</>
                    )}
                  </button>
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
