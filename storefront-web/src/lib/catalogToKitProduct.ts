import type { Product, ProductVariant } from '@/types'
import type { Product as KitProduct } from '@/kit/types'
import { bridgeProduct } from '@/kit/bridge'
import { imgUrl } from '@/lib/utils'
import { variantColorCss } from '@/lib/variantOptions'
import { canPurchaseProduct } from '@/lib/stockValidation'

function variantHasStock(v: ProductVariant, product: Product): boolean {
  return canPurchaseProduct(product, v)
}

function productHasStock(product: Product): boolean {
  const variants = (product.variants || []).filter((v) => v.is_active !== false)
  if (variants.length > 0) {
    return variants.some((v) => variantHasStock(v, product))
  }
  return canPurchaseProduct(product)
}

/** Map a catalog product (list/detail API or live feed) onto the kit ProductCard shape. */
export function catalogToKitProduct(item: Product): KitProduct {
  const variants = (item.variants || []).filter((v) => v.is_active !== false)
  const currency = item.currency || 'INR'
  const kitProduct = bridgeProduct({
    id: item.id,
    slug: item.slug,
    title: item.name,
    description: item.description || item.short_description || '',
    categoryIds: [],
    images: (item.images || []).map((img) => ({
      url: img.url || imgUrl(img.url),
      alt: img.alt_text || '',
    })),
    variants: variants.length > 0
      ? variants.map((v: ProductVariant) => ({
          id: v.id,
          name: v.name,
          options: v.attributes || {},
          color: variantColorCss(v),
          media: v.media,
          uom: v.uom,
          uom_quantity: v.uom_quantity,
          price: { amount: Math.round((v.price ?? 0) * 100), currency: v.currency || currency },
          compareAtPrice: v.compare_at_price
            ? { amount: Math.round(v.compare_at_price * 100), currency: v.currency || currency }
            : undefined,
          inStock: variantHasStock(v, item),
          quantity: v.quantity,
          track_inventory: v.track_inventory,
          allow_backorders: v.allow_backorders,
          stock_status: v.stock_status,
          max_quantity_per_order: v.max_quantity_per_order,
          min_quantity_per_order: v.min_quantity_per_order,
        }))
      : [{
          id: `${item.id}-default`,
          name: 'Default',
          options: {},
          price: { amount: Math.round((item.price ?? 0) * 100), currency },
          inStock: productHasStock(item),
          quantity: item.quantity,
          track_inventory: item.track_inventory,
          allow_backorders: item.allow_backorders,
          stock_status: item.stock_status,
        }],
    rating: (item.avg_rating ?? 0) > 0 ? { value: item.avg_rating, count: item.review_count ?? 0 } : undefined,
    tags: item.tags || [],
    track_inventory: item.track_inventory,
    allow_backorders: item.allow_backorders,
    quantity: item.quantity,
    stock_status: item.stock_status,
  } as any)
  kitProduct.viewCount = item.view_count ?? 0
  return kitProduct
}
