import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Eye, ShoppingBag, Star } from 'lucide-react'
import type { LiveItem } from '@/blocks/registry'
import type { ProductVariant } from '@/types'
import { BuilderCanvasProductImage } from '@/components/builder/BuilderCanvasProductImage'
import { CatalogAddOrQtyControl } from '@/components/catalog/CatalogAddOrQtyControl'
import { CatalogVariantChips } from '@/components/catalog/CatalogVariantChips'
import {
  buildCatalogImageShell,
  resolveCardRadiusPresentation,
  type CatalogCardLayout,
} from '@/lib/catalogCardLayout'
import { formatLiveProductPrice } from '@/lib/liveProductUtils'
import { resolveVariantThumbnailUrl } from '@/lib/productImageUtils'
import { prefetchImageUrls, usePrefetchImages } from '@/hooks/usePrefetchImages'
import { cn, imgUrl } from '@/lib/utils'
import { variantFlatOptionTitle } from '@/lib/variantOptions'
import { useAddToCart, useCart, useCartVariantQty, useSetCatalogCartQty } from '@/hooks/useStore'
import { getEffectiveStockStatus, getMaxLineQuantity, type StockEntity } from '@/lib/stockValidation'
import { useVendor } from '@/contexts/VendorContext'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { ProductWishlistButton } from '@/components/products/ProductWishlistButton'
import { isDisplayFieldEnabled } from '@/lib/storefrontDisplayFields'

function liveItemVariants(item: LiveItem): ProductVariant[] {
  const raw = (item.meta as Record<string, unknown> | undefined)?.variants
  if (!Array.isArray(raw)) return []
  return (raw as ProductVariant[]).filter((v) => v && v.id && v.is_active !== false)
}

function productStockFromItem(item: LiveItem): StockEntity {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    stock_status: String(meta.stock_status || 'in_stock'),
    quantity: meta.quantity != null ? Number(meta.quantity) : undefined,
    track_inventory: meta.track_inventory as boolean | undefined,
    allow_backorders: meta.allow_backorders as boolean | undefined,
    max_quantity_per_order: meta.max_quantity_per_order != null ? Number(meta.max_quantity_per_order) : undefined,
  }
}

function variantOutOfStock(item: LiveItem, variant?: ProductVariant): boolean {
  return getEffectiveStockStatus(productStockFromItem(item), variant) === 'out_of_stock'
}

function productUomFromItem(item: LiveItem) {
  const meta = (item.meta || {}) as Record<string, unknown>
  return {
    uom: typeof meta.uom === 'string' ? meta.uom : undefined,
    uom_quantity: meta.uom_quantity != null ? Number(meta.uom_quantity) : undefined,
  }
}

type Props = {
  item: LiveItem
  linkTo?: string
  onNavigateClick?: (e: MouseEvent) => void
  cardLayout: CatalogCardLayout
  productTileWrap: string
  isCircleProductTile: boolean
  titleClass: string
  priceClass: string
  primaryColor?: string
  blockId?: string
}

export function CatalogLiveProductTile({
  item,
  linkTo,
  onNavigateClick,
  cardLayout,
  productTileWrap,
  isCircleProductTile,
  titleClass,
  priceClass,
  primaryColor,
  blockId,
}: Props) {
  const {
    imageHeightPct,
    imageWidthPct,
    imageAspect,
    imageObjectFit,
    imageObjectPosition,
    imageZoom,
    cardPadding,
    cardRadius,
    cardBorderRadius,
    isMinimalCard,
    isCompactCard,
    showBadges,
    showStock,
    showAddButton,
  } = cardLayout

  const variants = liveItemVariants(item)
  const variantKey = variants.map((v) => v.id).join(',')
  const defaultVariantId = variants.find((v) => !variantOutOfStock(item, v))?.id ?? variants[0]?.id
  const [variantId, setVariantId] = useState(defaultVariantId)
  useEffect(() => {
    const list = liveItemVariants(item)
    const nextDefault = list.find((v) => !variantOutOfStock(item, v))?.id ?? list[0]?.id
    setVariantId((current) => {
      if (current && list.some((v) => v.id === current)) return current
      return nextDefault
    })
  }, [item.id, variantKey])

  const selected = variants.find((v) => v.id === variantId) ?? variants[0]
  usePrefetchImages([
    item.image_url,
    ...variants.map((v) => resolveVariantThumbnailUrl(v)),
  ])
  const productStock = productStockFromItem(item)
  const productUom = productUomFromItem(item)
  const rawImage = resolveVariantThumbnailUrl(selected) || item.image_url
  const imageUrl = rawImage ? imgUrl(rawImage) : null
  const currency = String((item.meta as Record<string, unknown> | undefined)?.currency || 'INR')
  const price = Number(selected?.price ?? item.price ?? 0)
  const priceFormatted =
    price > 0
      ? formatLiveProductPrice(price, selected?.currency || currency)
      : item.price_formatted
  const compareAt =
    selected?.compare_at_price != null
      ? Number(selected.compare_at_price)
      : Number((item.meta as Record<string, unknown> | undefined)?.compare_at_price ?? 0) || null
  const outOfStock = variantOutOfStock(item, selected)

  useCart()
  const cartQty = useCartVariantQty(String(item.id), selected?.id)
  const addToCart = useAddToCart()
  const { setQty: setCatalogQty } = useSetCatalogCartQty()
  const { vendorSlug, displayFields } = useVendor()
  const showViewCount = isDisplayFieldEnabled(displayFields.product, 'view_count')
  const showWishlist = isDisplayFieldEnabled(displayFields.product, 'wishlist')
  const { isAuthenticated } = useAuthStore()
  const maxLineQty = getMaxLineQuantity({
    vendorSlug,
    isAuthenticated,
    productId: String(item.id),
    product: productStock,
    variant: selected,
    currentLineQty: cartQty,
  })
  const isAdding =
    addToCart.isPending &&
    addToCart.variables &&
    (addToCart.variables as { product_id?: string }).product_id === item.id

  const imageShell = buildCatalogImageShell({
    imageHeightPct,
    imageWidthPct,
    imageAspect,
    imageObjectFit,
    imageObjectPosition,
    imageZoom,
    productTileWrap,
    isCircle: isCircleProductTile,
  })
  const cardRadiusPresentation = resolveCardRadiusPresentation(cardBorderRadius, cardRadius)
  const views = (() => {
    const raw = item.meta?.view_count
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
  })()

  const cartPayload = {
    product_id: String(item.id),
    variant_id: selected?.id,
    variant_label: selected ? variantFlatOptionTitle(selected, productUom) : undefined,
    name: item.title ?? 'Product',
    qty: 1,
    price,
    image_url: imageUrl ?? undefined,
    slug: String((item.meta as Record<string, unknown> | undefined)?.slug || ''),
  }

  const addLiveItemToCart = async () => {
    if (!item.id || String(item.id).startsWith('ph-')) return
    try {
      await addToCart.mutateAsync(cartPayload as never)
    } catch { /* mutation handles */ }
  }

  const handleCatalogQtyChange = async (qty: number) => {
    if (!item.id || String(item.id).startsWith('ph-')) return
    try {
      await setCatalogQty({
        productId: String(item.id),
        variantId: selected?.id,
        qty,
        addItem: cartPayload as never,
      })
    } catch { /* mutation handles */ }
  }

  return (
    <div
      className={cn(
        'builder-tile-card group bg-white border border-gray-100 overflow-hidden transition-all duration-200 flex flex-col',
        cardRadiusPresentation.className,
        isMinimalCard ? '' : 'hover:shadow-lg hover:-translate-y-1',
      )}
      style={cardRadiusPresentation.style}
    >
      <Link
        to={linkTo ?? '#'}
        className="block"
        data-builder-catalog-nav="product"
        onClick={onNavigateClick}
      >
        <div className={cn(imageShell.wrapperClassName, 'bg-white')} style={imageShell.wrapperStyle}>
          {imageUrl ? (
            <BuilderCanvasProductImage
              blockId={blockId}
              src={imageUrl}
              alt={selected ? `${item.title} — ${variantFlatOptionTitle(selected, productUom)}` : item.title}
              className={imageShell.imageClassName}
              style={imageShell.imageStyle}
              isCatalogPhoto={!String(item.id || '').startsWith('ph-')}
              allowNavigation={!String(item.id || '').startsWith('ph-')}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <ShoppingBag className={isMinimalCard ? 'w-8 h-8' : 'w-12 h-12'} />
            </div>
          )}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none">
            {showViewCount && views != null && views > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 shadow-sm"
                title={`${views.toLocaleString()} views`}
              >
                <Eye className="w-3 h-3 shrink-0" aria-hidden />
                {views.toLocaleString()}
              </span>
            )}
            {showBadges && !!item.meta?.is_on_sale && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>
            )}
          </div>
          <div
            className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          >
            {showWishlist && item.id && !String(item.id).startsWith('ph-') && (
              <ProductWishlistButton
                productId={String(item.id)}
                productName={item.title ?? 'Product'}
                slug={String((item.meta as Record<string, unknown> | undefined)?.slug || '')}
                price={price}
                imageUrl={imageUrl ?? undefined}
                variantId={selected?.id}
                overlay
                className="h-7 w-7 rounded-md"
              />
            )}
            {showBadges && !!item.meta?.is_featured && (
              <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3" />Featured
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: cardPadding, paddingBottom: Math.max(4, cardPadding - 4) }}>
          {item.subtitle && !isMinimalCard && (
            <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">{item.subtitle}</p>
          )}
          <h3 className={titleClass}>{item.title}</h3>
          <CatalogVariantChips
            variants={variants}
            selectedId={selected?.id}
            onSelect={setVariantId}
            onPreview={(id) => {
              const variant = variants.find((v) => v.id === id)
              prefetchImageUrls([resolveVariantThumbnailUrl(variant)])
            }}
            product={productUom}
            productStock={productStock}
            primaryColor={primaryColor}
            className="mb-1 mt-0.5"
          />
          {priceFormatted && (
            <div className="flex items-center gap-2">
              <span className={priceClass} style={{ color: primaryColor } as CSSProperties}>
                {priceFormatted}
              </span>
              {!isMinimalCard && compareAt != null && compareAt > price && (
                <span className="text-sm text-gray-400 line-through">
                  {currency} {compareAt.toLocaleString()}
                </span>
              )}
            </div>
          )}
          {(showStock || outOfStock) && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-px rounded-full mt-1 inline-block ${
                outOfStock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}
            >
              {outOfStock ? 'Out of Stock' : 'In Stock'}
            </span>
          )}
        </div>
      </Link>

      {showAddButton && (
        <div style={{ padding: cardPadding, paddingTop: 4 }} className="mt-auto">
          <CatalogAddOrQtyControl
            cartQty={cartQty}
            onAdd={addLiveItemToCart}
            onQtyChange={handleCatalogQtyChange}
            outOfStock={outOfStock}
            pending={!!isAdding}
            maxQty={maxLineQty}
            onAtMax={() =>
              toast.error(
                maxLineQty === 0
                  ? 'This variant is out of stock.'
                  : `Maximum stock reached — only ${maxLineQty} available for this variant.`,
              )
            }
            primaryColor={primaryColor}
            addButtonStyle="filled"
            isMinimalCard={isMinimalCard}
            isCompactCard={isCompactCard}
          />
        </div>
      )}
    </div>
  )
}
