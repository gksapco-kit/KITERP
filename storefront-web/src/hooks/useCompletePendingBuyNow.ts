import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { storeKeys, useAddToCart } from '@/hooks/useStore'
import { useCartStore } from '@/stores/cartStore'
import { cartHasMatchingLine, takePendingBuyNow } from '@/lib/pendingBuyNow'
import type { Cart } from '@/types'

/** After login, add the product saved by Buy Now — only if it is not already in the cart. */
export function useCompletePendingBuyNow() {
  const { isAuthenticated } = useAuthStore()
  const { vendorSlug } = useVendor()
  const qc = useQueryClient()
  const addToCart = useAddToCart()
  const mutateRef = useRef(addToCart.mutate)
  mutateRef.current = addToCart.mutate
  const running = useRef(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !vendorSlug || running.current) return

    const pending = takePendingBuyNow(vendorSlug)
    if (!pending) return

    const cart =
      qc.getQueryData<Cart>(storeKeys.cart)
      ?? useCartStore.getState().cart
      ?? undefined

    if (cartHasMatchingLine(cart?.items, pending.productId, pending.item.variant_id)) {
      return
    }

    running.current = true
    setCompleting(true)
    mutateRef.current(pending.item, {
      onError: () => {
        toast.error('Could not add your item to the cart. Please try Buy Now again.')
      },
      onSettled: () => {
        running.current = false
        setCompleting(false)
      },
    })
  }, [isAuthenticated, vendorSlug, qc])

  return { completing }
}
