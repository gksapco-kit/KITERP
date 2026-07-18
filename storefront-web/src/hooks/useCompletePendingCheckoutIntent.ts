import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { storeApi } from '@/api/store'
import { storeKeys } from '@/hooks/useStore'
import { useCartStore } from '@/stores/cartStore'
import { cartHasIntentLine, peekPendingCheckoutIntent } from '@/lib/pendingCheckoutIntent'
import type { Cart } from '@/types'

/** After login, restore subscription/booking cart line saved before redirect. */
export function useCompletePendingCheckoutIntent() {
  const { isAuthenticated } = useAuthStore()
  const { vendorSlug } = useVendor()
  const qc = useQueryClient()
  const running = useRef(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !vendorSlug || running.current) return

    const intent = peekPendingCheckoutIntent(vendorSlug)
    if (!intent?.cartItem) return

    const cart =
      qc.getQueryData<Cart>(storeKeys.cart)
      ?? useCartStore.getState().cart
      ?? undefined

    if (cartHasIntentLine(cart?.items, intent.cartItem)) {
      return
    }

    running.current = true
    setCompleting(true)

    const item = intent.cartItem
    void (async () => {
      try {
        await qc.cancelQueries({ queryKey: storeKeys.cart })
        const next = await storeApi.addToCart({
          product_id: item.product_id,
          service_id: item.service_id,
          item_type: item.item_type,
          variant_id: item.variant_id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          image_url: item.image_url,
        })
        qc.setQueryData(storeKeys.cart, next)
        useCartStore.getState().setCart(next)
      } catch {
        toast.error('Could not restore your item. Please try again from the product or service page.')
      } finally {
        running.current = false
        setCompleting(false)
      }
    })()
  }, [isAuthenticated, vendorSlug, qc])

  return { completing }
}
