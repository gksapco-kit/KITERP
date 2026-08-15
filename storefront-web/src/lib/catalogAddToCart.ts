import { toast } from 'sonner'
import type { Product, ProductVariant, Cart } from '@/types'
import type { GuestCartItem } from '@/stores/guestCartStore'
import { assertCanAddToCart } from '@/lib/stockValidation'
import { variantDisplayLabel } from '@/lib/variantOptions'

export function resolveListCartVariant(
  variants: ProductVariant[],
  kitVariant?: { id: string },
): ProductVariant | undefined {
  if (!kitVariant || kitVariant.id.endsWith('-default')) {
    return variants.length === 1 ? variants[0] : undefined
  }
  return variants.find((v) => v.id === kitVariant.id)
}

export async function addCatalogProductToCart(input: {
  vendorSlug: string
  isAuthenticated: boolean
  product: Product
  variants: ProductVariant[]
  kitVariant?: { id: string }
  name: string
  slug: string
  price: number
  image?: string
  addToCart: { mutateAsync: (item: GuestCartItem) => Promise<Cart> }
}): Promise<boolean> {
  const srcVariant = resolveListCartVariant(input.variants, input.kitVariant)
  const stockCheck = assertCanAddToCart({
    vendorSlug: input.vendorSlug,
    isAuthenticated: input.isAuthenticated,
    productId: input.product.id,
    productName: input.name,
    product: input.product,
    variant: srcVariant,
    variantLabel: srcVariant ? variantDisplayLabel(srcVariant) || srcVariant.name : undefined,
    requestQty: 1,
  })
  if (!stockCheck.ok) {
    toast.error(stockCheck.message)
    return false
  }
  try {
    await input.addToCart.mutateAsync({
      product_id: input.product.id,
      variant_id: srcVariant?.id,
      variant_label: srcVariant ? variantDisplayLabel(srcVariant) || srcVariant.name : undefined,
      slug: input.slug,
      name: input.name,
      qty: 1,
      price: input.price,
      image_url: input.image,
    })
    toast.success('Added to cart')
    return true
  } catch {
    toast.error('Could not add to cart')
    return false
  }
}
