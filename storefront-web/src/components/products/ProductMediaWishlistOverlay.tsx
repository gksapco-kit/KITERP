import { CatalogShareButton } from '@/components/catalog/CatalogShareButton'
import { ProductWishlistButton } from '@/components/products/ProductWishlistButton'
import { useVendor } from '@/contexts/VendorContext'
import { isDisplayFieldEnabled } from '@/lib/storefrontDisplayFields'
import { formatCurrency } from '@/lib/utils'
import type { Product, ProductVariant } from '@/types'

type MediaItem = { url: string }

type Props = {
  product: Product
  selectedVariant?: ProductVariant | null
  displayPrice: number
  displayMedia: MediaItem[]
  selectedImage: number
}

/** Wishlist control for the top-right corner of the product hero image. */
export function ProductMediaWishlistOverlay({
  product,
  selectedVariant,
  displayPrice,
  displayMedia,
  selectedImage,
}: Props) {
  const { displayFields } = useVendor()
  const showWishlist = isDisplayFieldEnabled(displayFields.product, 'wishlist')
  const showShare = isDisplayFieldEnabled(displayFields.product, 'share')
  if (!showWishlist && !showShare) return null

  const imageUrl = displayMedia[selectedImage]?.url || product.images?.[0]?.url
  const priceLabel = displayPrice > 0 ? formatCurrency(displayPrice, product.currency) : undefined

  return (
    <div className="flex flex-col gap-2">
      {showWishlist && (
        <ProductWishlistButton
          productId={product.id}
          productName={product.name}
          slug={product.slug}
          price={displayPrice}
          imageUrl={imageUrl}
          variantId={selectedVariant?.id}
          overlay
          className="h-10 w-10 rounded-lg"
        />
      )}
      {showShare && (
        <CatalogShareButton
          title={product.name}
          priceLabel={priceLabel}
          overlay
          className="h-10 w-10 rounded-lg"
        />
      )}
    </div>
  )
}
