import type { MouseEvent } from 'react'
import { ProductCard } from '@/kit/products/ProductCard'
import type { CatalogCardLayout, CatalogImageObjectFit } from '@/lib/catalogCardLayout'
import type { ImageShape } from '@/lib/sectionItemLayout'
import type { LiveItem } from '@/blocks/registry'
import { useAddToCart } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { useAuthStore } from '@/stores/authStore'
import { liveItemToCatalogProduct } from '@/lib/catalogToLiveItem'
import { catalogToKitProduct } from '@/lib/catalogToKitProduct'
import { addCatalogProductToCart } from '@/lib/catalogAddToCart'
import { resolveVariantThumbnailUrl } from '@/lib/productImageUtils'

type Props = {
  item: LiveItem
  linkTo?: string
  onNavigateClick?: (e: MouseEvent) => void
  imageObjectFit?: CatalogImageObjectFit
  cardLayout?: CatalogCardLayout
  imageShape?: ImageShape
}

export function canRenderLiveCatalogProductCard(item: LiveItem): boolean {
  return liveItemToCatalogProduct(item) != null
}

/** Homepage / builder product tile — same card as the Products catalog page. */
export function LiveCatalogProductCard({ item, linkTo, onNavigateClick, imageObjectFit = 'contain', cardLayout, imageShape }: Props) {
  const product = liveItemToCatalogProduct(item)
  const addToCart = useAddToCart()
  const { vendorSlug } = useVendor()
  const { isAuthenticated } = useAuthStore()

  if (!product) return null

  const kitProduct = catalogToKitProduct(product)
  const variants = (product.variants || []).filter((v) => v.is_active !== false)

  return (
    <ProductCard
      product={kitProduct}
      linkTo={linkTo}
      onNavigateClick={onNavigateClick}
      imageObjectFit={cardLayout?.imageObjectFit ?? imageObjectFit}
      cardLayout={cardLayout}
      imageShape={imageShape}
      showRating
      showTags
      addToCartPending={addToCart.isPending}
      onAddToCart={async (p, variant) => {
        await addCatalogProductToCart({
          vendorSlug,
          isAuthenticated,
          product,
          variants,
          kitVariant: variant,
          name: p.name,
          slug: product.slug,
          price: variant?.price ?? p.price,
          image: resolveVariantThumbnailUrl(variant) || p.image,
          addToCart,
        })
      }}
    />
  )
}
