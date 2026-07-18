import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import { readScopedCustomerTokens } from '@/lib/customerAuthStorage'
import {
  setPendingCheckoutIntent,
  type PendingCheckoutIntent,
} from '@/lib/pendingCheckoutIntent'
import { useAuthStore } from '@/stores/authStore'
import { useGuestCartStore, type GuestCartItem } from '@/stores/guestCartStore'
import { buildGuestCart, storeKeys } from '@/hooks/useStore'
import { useCartStore } from '@/stores/cartStore'
import type { Cart } from '@/types'

/** Sync zustand auth flag with scoped tokens so cart API calls use the session. */
export function ensureCustomerSessionActive(): boolean {
  const state = useAuthStore.getState()
  const { access } = readScopedCustomerTokens()
  if (access) {
    useAuthStore.setState({
      accessToken: access,
      isAuthenticated: true,
      customer: state.customer,
    })
    return true
  }
  return !!(state.isAuthenticated && state.accessToken)
}

function applyLocalCart(qc: QueryClient, cart: Cart) {
  qc.setQueryData(storeKeys.cart, cart)
  useCartStore.getState().setCart(cart)
}

/**
 * Save subscription/booking intent, put the line in cart, then go to checkout.
 * Authenticated users must succeed on the server cart (checkout reads server cart).
 */
export async function proceedSubscribeToCheckout(opts: {
  intent: PendingCheckoutIntent
  cartItem: GuestCartItem
  vendorSlug: string
  navigate: NavigateFunction
  storePath: (path: string) => string
  qc: QueryClient
  onBeforeNavigate?: () => void
}): Promise<void> {
  const { intent, cartItem, vendorSlug, navigate, storePath, qc, onBeforeNavigate } = opts

  setPendingCheckoutIntent(intent)

  const go = (path: string, state?: Record<string, unknown>) => {
    // Close modal only when leaving — avoids flashing the service page mid-request.
    onBeforeNavigate?.()
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
    navigate(path, { state: { smoothCheckoutEntry: true, ...state } })
  }

  const loggedIn = ensureCustomerSessionActive()

  if (!loggedIn) {
    useGuestCartStore.getState().addItem(vendorSlug, cartItem)
    applyLocalCart(qc, buildGuestCart(useGuestCartStore.getState().getItems(vendorSlug)))
    go(storePath('/login'), { from: storePath('/checkout') })
    return
  }

  const payload = {
    product_id: cartItem.product_id,
    service_id: cartItem.service_id,
    item_type: cartItem.item_type,
    variant_id: cartItem.variant_id,
    name: cartItem.name,
    qty: cartItem.qty,
    price: cartItem.price,
    image_url: cartItem.image_url,
  }

  try {
    await qc.cancelQueries({ queryKey: storeKeys.cart })
    const cart = await storeApi.addToCart(payload)
    applyLocalCart(qc, cart)
  } catch (firstErr) {
    // Authenticated checkout reads the server cart — local seed alone causes "Cart is empty".
    try {
      await qc.cancelQueries({ queryKey: storeKeys.cart })
      const cart = await storeApi.addToCart(payload)
      applyLocalCart(qc, cart)
    } catch (err) {
      console.error('[subscribeCheckout] server cart failed', firstErr, err)
      toast.error(
        intent.kind === 'subscription'
          ? 'Could not add your subscription to the cart. Please try again.'
          : 'Could not add your booking to the cart. Please try again.',
      )
      return
    }
  }

  go(storePath('/checkout'))
}
