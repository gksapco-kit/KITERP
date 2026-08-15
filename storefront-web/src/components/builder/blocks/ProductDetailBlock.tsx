import { useEffect, useState } from 'react'
import { ShoppingCart, Star, Heart, Share2, Loader2, Check } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'
import { useAddToCart } from '@/hooks/useStore'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { CatalogVariantChips } from '@/components/catalog/CatalogVariantChips'
import { formatLiveProductPrice } from '@/lib/liveProductUtils'
import { resolveVariantThumbnailUrl } from '@/lib/productImageUtils'
import { variantFlatOptionTitle } from '@/lib/variantOptions'
import {
  assertCanAddToCart,
  getEffectiveStockStatus,
  getMaxAddQuantity,
  type StockEntity,
} from '@/lib/stockValidation'
import { useVendor } from '@/contexts/VendorContext'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import type { ProductVariant } from '@/types'

function liveItemVariants(item?: LiveItem): ProductVariant[] {
  const raw = (item?.meta as Record<string, unknown> | undefined)?.variants
  if (!Array.isArray(raw)) return []
  return (raw as ProductVariant[]).filter((v) => v && v.id && v.is_active !== false)
}

function productStockFromItem(item?: LiveItem): StockEntity {
  const meta = (item?.meta || {}) as Record<string, unknown>
  return {
    stock_status: String(meta.stock_status || 'in_stock'),
    quantity: meta.quantity != null ? Number(meta.quantity) : undefined,
    track_inventory: meta.track_inventory as boolean | undefined,
    allow_backorders: meta.allow_backorders as boolean | undefined,
    max_quantity_per_order: meta.max_quantity_per_order != null ? Number(meta.max_quantity_per_order) : undefined,
  }
}

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function ProductDetailBlock({ style, props, liveItems, blockId }: Props) {
  const [qty, setQty] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const addToCart = useAddToCart()
  const { vendorSlug } = useVendor()
  const { isAuthenticated } = useAuthStore()

  const product = liveItems[0]
  const variants = liveItemVariants(product)
  const variantKey = variants.map((v) => v.id).join(',')
  const [variantId, setVariantId] = useState(variants[0]?.id)
  useEffect(() => {
    const list = liveItemVariants(product)
    setVariantId((current) => {
      if (current && list.some((v) => v.id === current)) return current
      return list[0]?.id
    })
  }, [product?.id, variantKey])

  const selected = variants.find((v) => v.id === variantId) ?? variants[0]
  const productStock = productStockFromItem(product)
  const title = product?.title || (props.title as string) || 'Product'
  const description = product?.description || (props.description as string) || ''
  const variantImage = resolveVariantThumbnailUrl(selected)
  const imageUrl = variantImage || product?.image_url || null
  const currency = String((product?.meta as Record<string, unknown> | undefined)?.currency || 'INR')
  const priceNum = Number(selected?.price ?? product?.price ?? 0)
  const price =
    priceNum > 0
      ? formatLiveProductPrice(priceNum, selected?.currency || currency)
      : product?.price_formatted || null
  const displayStock = product
    ? getEffectiveStockStatus(productStock, selected)
    : undefined
  const outOfStock = displayStock === 'out_of_stock'
  const maxAddQty = product
    ? getMaxAddQuantity({
        vendorSlug,
        isAuthenticated,
        productId: String(product.id),
        product: productStock,
        variant: selected,
      })
    : null
  const qtyMax = maxAddQty != null ? maxAddQty : 99

  useEffect(() => {
    if (maxAddQty == null) return
    if (maxAddQty < 1) {
      setQty(1)
      return
    }
    setQty((current) => (current > maxAddQty ? maxAddQty : Math.max(1, current)))
  }, [maxAddQty, selected?.id])

  const showReviews = props.show_reviews !== false

  // ── Layout style (picked from "Choose section style") ──────────────────────
  const layout = String(props.layout ?? 'split')
  const imagePosition = String(props.image_position ?? 'left')
  const dark = String(props.bg_style ?? '') === 'dark'
  const minimal = layout === 'minimal'
  const isHero = layout === 'hero'
  const isStacked = layout === 'stacked'
  const isCard = layout === 'card'
  const imageFirst = imagePosition !== 'right'
  // Hero overlays details on a dark photo, so it shares the dark-text treatment.
  const onDark = dark || isHero

  // Theme tokens so every layout (light / dark / hero-overlay) stays legible.
  const titleColor = onDark ? 'text-white' : 'text-gray-900'
  const descColor = onDark ? 'text-gray-200' : 'text-gray-600'
  const labelColor = onDark ? 'text-gray-200' : 'text-gray-700'
  const eyebrowColor = onDark ? 'text-white/60' : 'text-gray-400'
  const qtyBorder = onDark ? 'border-white/25' : 'border-gray-200'
  const qtyBtn = onDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-50 text-gray-700'
  const iconBtn = onDark ? 'border-white/25 hover:bg-white/10 text-white/80' : 'border-gray-200 hover:bg-gray-50 text-gray-400'

  const handleAddToCart = async () => {
    if (!product) return
    if (outOfStock) {
      toast.error('This variant is out of stock.')
      return
    }
    const stockCheck = assertCanAddToCart({
      vendorSlug,
      isAuthenticated,
      productId: String(product.id),
      productName: product.title ?? 'Product',
      product: productStock,
      variant: selected,
      variantLabel: selected ? variantFlatOptionTitle(selected) : undefined,
      requestQty: qty,
    })
    if (!stockCheck.ok) {
      toast.error(stockCheck.message)
      return
    }
    try {
      await addToCart.mutateAsync({
        product_id: product.id,
        variant_id: selected?.id,
        variant_label: selected ? variantFlatOptionTitle(selected) : undefined,
        name: product.title ?? 'Product',
        qty,
        price: priceNum,
        image_url: imageUrl ? imgUrl(imageUrl) : product.image_url ?? undefined,
        slug: String((product.meta as Record<string, unknown>)?.slug ?? ''),
      } as never)
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 2000)
    } catch {
      // error handled by mutation
    }
  }

  const renderImage = (aspectClass: string) => {
    const imgClass = cn('w-full object-contain rounded-2xl', aspectClass, !minimal && 'shadow-lg')
    if (!imageUrl) {
      return (
        <div className={cn('w-full flex items-center justify-center rounded-2xl', aspectClass, dark ? 'bg-white/5 text-white/20' : 'bg-gray-100 text-gray-300')}>
          <ShoppingCart className="w-16 h-16" />
        </div>
      )
    }
    return blockId ? (
      <BuilderSectionImage blockId={blockId} field="image_url" blockProps={props} src={imageUrl} alt={title} className={imgClass} />
    ) : (
      <img src={imageUrl} alt={title} className={imgClass} loading="lazy" />
    )
  }

  const renderDetails = () => {
    const centered = isStacked
    return (
      <div className={cn(centered && 'max-w-2xl mx-auto text-center', isHero && 'max-w-xl')}>
        {product?.subtitle && (
          <p className={cn('text-sm uppercase tracking-wide mb-1', eyebrowColor)}>{product.subtitle}</p>
        )}
        <h1 className={cn('text-3xl font-bold mb-3', titleColor)}>{title}</h1>

        {showReviews && product?.rating != null && (
          <div className={cn('flex items-center gap-2 mb-4', centered && 'justify-center')}>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < (product.rating || 0) ? 'fill-amber-400 text-amber-400' : onDark ? 'text-white/20' : 'text-gray-200'}`} />
              ))}
            </div>
            <span className={cn('text-sm', onDark ? 'text-white/60' : 'text-gray-500')}>({product.rating}/5)</span>
          </div>
        )}

        {price && (
          <div className="text-3xl font-bold mb-6" style={{ color: onDark ? '#ffffff' : style.primary_color }}>{price}</div>
        )}

        {displayStock && (
          <div className={cn('mb-4', centered && 'flex justify-center')}>
            <span className={`inline-flex items-center text-sm font-medium px-2.5 py-0.5 rounded-full ${
              outOfStock ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'
            }`}>
              {outOfStock ? 'Out of Stock' : '✓ In Stock'}
            </span>
          </div>
        )}

        {variants.length > 1 && (
          <div className={cn('mb-5', centered && 'flex justify-center')}>
            <CatalogVariantChips
              variants={variants}
              selectedId={selected?.id}
              onSelect={setVariantId}
              productStock={productStock}
              primaryColor={style.primary_color}
            />
          </div>
        )}

        {description && <p className={cn('leading-relaxed mb-6', descColor)}>{description}</p>}

        {/* Quantity */}
        <div className={cn('flex items-center gap-4 mb-6', centered && 'justify-center')}>
          <label className={cn('text-sm font-medium', labelColor)}>Quantity:</label>
          <div className={cn('flex items-center border rounded-xl overflow-hidden', qtyBorder)}>
            <button
              type="button"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className={cn('px-4 py-2 font-bold', qtyBtn)}
            >−</button>
            <span className={cn('px-4 py-2 border-x min-w-[48px] text-center', qtyBorder, onDark && 'text-white')}>{qty}</span>
            <button
              type="button"
              onClick={() => {
                if (outOfStock || (maxAddQty != null && qty >= qtyMax)) {
                  toast.error(
                    outOfStock || maxAddQty === 0
                      ? 'This variant is out of stock.'
                      : `Maximum stock reached — only ${qtyMax} available for this variant.`,
                  )
                  return
                }
                setQty(q => q + 1)
              }}
              className={cn('px-4 py-2 font-bold', qtyBtn, (outOfStock || (maxAddQty != null && qty >= qtyMax)) && 'opacity-40')}
            >+</button>
          </div>
        </div>

        {/* CTA buttons */}
        <div className={cn('flex gap-3 mb-6', centered && 'justify-center')}>
          <button
            onClick={handleAddToCart}
            disabled={addToCart.isPending || outOfStock}
            className={cn(
              'flex items-center justify-center gap-2 py-4 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all',
              centered ? 'px-10' : 'flex-1',
            )}
            style={{ backgroundColor: addedToCart ? '#10b981' : outOfStock ? '#dc2626' : style.primary_color }}
          >
            {addToCart.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : addedToCart ? (
              <><Check className="w-5 h-5" /> Added to Cart!</>
            ) : outOfStock ? (
              <>Out of Stock</>
            ) : (
              <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
            )}
          </button>
          <button className={cn('p-4 rounded-xl border transition-colors', iconBtn)}>
            <Heart className="w-5 h-5" />
          </button>
          <button className={cn('p-4 rounded-xl border transition-colors', iconBtn)}>
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Meta badges (hidden in the minimal layout) */}
        {!minimal && (
          <div className={cn('flex flex-wrap gap-2', centered && 'justify-center')}>
            {!!product?.meta?.is_featured && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-600">⭐ Featured</span>
            )}
            {!!(selected?.sku || product?.meta?.sku) && (
              <span className={cn('text-xs px-3 py-1 rounded-full', onDark ? 'bg-white/10 text-white/60' : 'bg-gray-50 text-gray-400')}>
                SKU: {String(selected?.sku || product?.meta?.sku || '')}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const sectionPad = builderSectionContainerClass()

  // ── Spotlight hero: full-bleed photo with the details overlaid ─────────────
  if (isHero) {
    return (
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {imageUrl ? (
            blockId ? (
              <BuilderSectionImage blockId={blockId} field="image_url" blockProps={props} src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
            )
          ) : (
            <div className="w-full h-full bg-gray-800" />
          )}
          <div className="absolute inset-0 bg-black/55" />
        </div>
        <div className={cn('relative z-10 max-w-6xl mx-auto flex', sectionPad, 'py-20 lg:py-28')}>
          {renderDetails()}
        </div>
      </section>
    )
  }

  // ── Gallery stacked: large photo above centered details ────────────────────
  if (isStacked) {
    return (
      <section className={cn(sectionPad, dark && 'bg-slate-900')}>
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto mb-10">{renderImage('aspect-[4/3]')}</div>
          {renderDetails()}
        </div>
      </section>
    )
  }

  // ── Bordered card: image + details inside an elevated surface ──────────────
  if (isCard) {
    return (
      <section className={cn(sectionPad, dark && 'bg-slate-900')}>
        <div className={cn(
          'max-w-6xl mx-auto rounded-3xl border p-6 sm:p-10',
          dark ? 'border-white/10 bg-slate-800/50' : 'border-gray-200 bg-white shadow-xl',
        )}>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {imageFirst ? (
              <>{renderImage('aspect-square')}{renderDetails()}</>
            ) : (
              <>{renderDetails()}{renderImage('aspect-square')}</>
            )}
          </div>
        </div>
      </section>
    )
  }

  // ── Classic / minimal / dark split: two columns ────────────────────────────
  return (
    <section className={cn(sectionPad, dark && 'bg-slate-900')}>
      <div className="max-w-6xl mx-auto">
        <div className={cn('grid lg:grid-cols-2 items-start', minimal ? 'gap-16' : 'gap-12')}>
          {imageFirst ? (
            <>{renderImage('aspect-square')}{renderDetails()}</>
          ) : (
            <>{renderDetails()}{renderImage('aspect-square')}</>
          )}
        </div>
      </div>
    </section>
  )
}
