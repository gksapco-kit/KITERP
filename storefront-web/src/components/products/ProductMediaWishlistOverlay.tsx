import { ProductWishlistButton } from '@/components/products/ProductWishlistButton'
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
  const imageUrl = displayMedia[selectedImage]?.url || product.images?.[0]?.url

  return (
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
  )
}
