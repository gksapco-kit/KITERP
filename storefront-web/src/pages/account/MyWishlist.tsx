import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { WishlistPage } from '@/kit/account/AccountBlocks'
import { useAddToCart, useWishlist, useRemoveWishlistItem } from '@/hooks/useStore'
import { ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import { useAuthStore } from '@/stores/authStore'
import { assertCanAddToCart, getMinAddQuantity } from '@/lib/stockValidation'
import { variantDisplayLabel } from '@/lib/variantOptions'
import type { ProductVariant } from '@/types'

function resolveWishlistVariant(
  variants: ProductVariant[],
  variantId?: string,
): ProductVariant | undefined {
  if (variantId) {
    return variants.find((v) => v.id === variantId)
  }
  return variants.length === 1 ? variants[0] : undefined
}

export default function MyWishlist() {
  const { storePath, vendorSlug } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const addToCart = useAddToCart()
  const { data: items = [], isLoading } = useWishlist()
  const removeItem = useRemoveWishlistItem()
  const [movingId, setMovingId] = useState<string | null>(null)

  const handleMoveToCart = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item || movingId) return

    setMovingId(id)
    try {
      const product = await storeApi.getProduct(item.slug || item.id)
      const variants = (product.variants ?? []).filter((v) => v.is_active !== false)
      const variant = resolveWishlistVariant(variants, item.variantId)

      if (variants.length > 1 && !variant) {
        toast.error('Open the product page to choose size or color before adding to cart.')
        return
      }

      const requestQty = getMinAddQuantity({ product, variant })
      const stockCheck = assertCanAddToCart({
        vendorSlug,
        isAuthenticated,
        productId: product.id,
        productName: product.name,
        product,
        variant,
        variantLabel: variant ? variantDisplayLabel(variant) || variant.name : undefined,
        requestQty,
      })

      if (!stockCheck.ok) {
        toast.error(stockCheck.message)
        return
      }

      await addToCart.mutateAsync({
        product_id: product.id,
        variant_id: variant?.id,
        variant_label: variant ? variantDisplayLabel(variant) || variant.name : undefined,
        slug: product.slug,
        name: product.name,
        qty: requestQty,
        price: variant?.price ?? product.price,
        image_url: item.image,
      })
      await removeItem.mutateAsync(id)
      toast.success(`${product.name} moved to cart`)
    } catch {
      toast.error('Could not add to cart')
    } finally {
      setMovingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Wishlist</span>
      </nav>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : (
        <WishlistPage items={items} onMoveToCart={handleMoveToCart} movingId={movingId} />
      )}
    </div>
  )
}
