import { type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, ShoppingBag, Star } from 'lucide-react'
import type { StyleConfig } from '@/blocks/registry'
import { useAddToCart, useCart, useCartProductQtyMap, useSetCatalogCartQty } from '@/hooks/useStore'
import { useProducts, useServices } from '@/hooks/useStore'
import { useStorePath } from '@/hooks/useStorePath'
import { catalogProductToLiveItem, catalogServiceToLiveItem } from '@/lib/catalogToLiveItem'
import { normalizeLiveProducts, resolveLiveCatalogStorePath, resolveLiveProductUrl } from '@/lib/liveProductUtils'
import { BuilderCanvasProductImage } from '@/components/builder/BuilderCanvasProductImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn } from '@/lib/utils'
import {
  CATALOG_GRID_COL_CLASS,
  buildCatalogImageShell,
  clampCatalogColumns,
  readCatalogCardLayout,
  resolveCardRadiusPresentation,
} from '@/lib/catalogCardLayout'
import { CatalogAddOrQtyControl } from '@/components/catalog/CatalogAddOrQtyControl'
import { LiveCatalogProductCard, canRenderLiveCatalogProductCard } from '@/components/catalog/LiveCatalogProductCard'
import { catalogTileImageWrapperClass, imageShapeFromProps } from '@/lib/sectionItemLayout'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'
import type { LiveItem } from '@/blocks/registry'

function openCatalogItemInBuilder(
  onNavigate: ((url: string) => void) | undefined,
  item: LiveItem,
): void {
  const path = resolveLiveProductUrl(item)
  if (!path || !onNavigate) return
  onNavigate(path)
}

interface Props {
  categoryName: string
  appliesTo?: string
  onBack: () => void
  style: StyleConfig
  props: Record<string, unknown>
  blockId?: string
  limit: number
  columns: number
  itemGap: number
  showBadges?: boolean
}

export default function CategoryExpandedProducts({
  categoryName,
  appliesTo,
  onBack,
  style,
  props,
  blockId,
  limit,
  columns,
  itemGap,
  showBadges = true,
}: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const storePath = useStorePath()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  useCart()
  const cartQtyByProduct = useCartProductQtyMap()
  const { setQty: setCatalogQty } = useSetCatalogCartQty()

  const isServiceCategory = appliesTo === 'service'
  const { data: productsData, isLoading: productsLoading } = useProducts(
    isServiceCategory ? null : { category: categoryName, page: 1, size: limit },
  )
  const { data: servicesData, isLoading: servicesLoading } = useServices(
    isServiceCategory ? { category: categoryName, page: 1, size: limit } : null,
  )

  const isLoading = isServiceCategory ? servicesLoading : productsLoading
  const rawItems = isServiceCategory
    ? (servicesData?.items || []).map(catalogServiceToLiveItem)
    : (productsData?.items || []).map(catalogProductToLiveItem)
  const items = normalizeLiveProducts(rawItems)

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

  const cardLayout = readCatalogCardLayout(props, 'product_grid')
  const productImageShape = imageShapeFromProps(props)
  const productTileWrap = catalogTileImageWrapperClass(productImageShape)
  const isCircleProductTile = productImageShape === 'circle'
  const gridColumns = clampCatalogColumns(columns, 4, 'product_grid')
  const textColor = style.text_color || '#111827'
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
    showStock: cardLayout.showStock,
    showAddButton: cardLayout.showAddButton,
    addButtonStyle: cardLayout.addButtonStyle,
  }
  const titleClass = isMinimalCard
    ? 'font-medium text-gray-900 text-xs line-clamp-1 mb-1'
    : isCompactCard
      ? 'font-semibold text-gray-900 text-sm line-clamp-2 mb-1'
      : 'font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-2'
  const priceClass = isMinimalCard ? 'text-sm font-bold' : isCompactCard ? 'text-base font-bold' : 'text-lg font-bold'

  return (
    <section className={builderSectionContainerClass()}>
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to categories
        </button>
      </div>

      <h2
        className="text-3xl font-bold mb-10 text-center"
        style={{ fontFamily: style.font_heading, color: textColor }}
      >
        {categoryName}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin opacity-50" style={{ color: style.primary_color }} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: style.primary_color }} />
          <p className="text-sm font-medium text-gray-600">
            No {isServiceCategory ? 'services' : 'products'} in this category yet.
          </p>
        </div>
      ) : (
        <div
          className={`grid ${CATALOG_GRID_COL_CLASS[gridColumns] || CATALOG_GRID_COL_CLASS[4]}`}
          style={{ gap: itemGap }}
        >
          {items.map(item => {
            if (!isServiceCategory && canRenderLiveCatalogProductCard(item)) {
              return (
                <LiveCatalogProductCard
                  key={item.id}
                  item={item}
                  linkTo={resolveLiveCatalogStorePath(item, storePath) ?? undefined}
                  onNavigateClick={e => handleProductCardClick(e, item)}
                  imageObjectFit={imageObjectFit}
                />
              )
            }
            const cartQty = cartQtyByProduct.get(String(item.id)) ?? 0
            const isAdding = addToCart.isPending && addToCart.variables && (addToCart.variables as any).product_id === item.id
            const outOfStock = item.meta?.stock_status === 'out_of_stock'
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
                  <div className={imageShell.wrapperClassName} style={imageShell.wrapperStyle}>
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
                    {showBadges && !!item.meta?.is_on_sale && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>
                    )}
                    {showBadges && !!item.meta?.is_featured && (
                      <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />Featured
                      </span>
                    )}
                  </div>
                  <div style={{ padding: cardPadding, paddingBottom: Math.max(4, cardPadding - 4) }}>
                    {item.subtitle && !isMinimalCard && (
                      <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{item.subtitle}</p>
                    )}
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

                {showAddButton && !isServiceCategory && (
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
