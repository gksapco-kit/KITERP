import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import { readScopedCustomerTokens } from '@/lib/customerAuthStorage'
import { hasActiveCustomerSession } from '@/hooks/useAuthHydrated'
import { isSignInMandatory } from '@/lib/deliveryConditions'
import {
  isSignInMandatoryForCatalog,
  type TemplateDisplayFields,
} from '@/lib/storefrontDisplayFields'
import {
  setPendingCheckoutIntent,
  type PendingCheckoutIntent,
} from '@/lib/pendingCheckoutIntent'
import { useAuthStore } from '@/stores/authStore'
import { pruneServerServiceLines } from '@/lib/serviceCart'
import { useGuestCartStore, type GuestCartItem } from '@/stores/guestCartStore'
import { buildGuestCart, storeKeys } from '@/hooks/useStore'
import { useCartStore } from '@/stores/cartStore'
import type { Cart } from '@/types'

/** True when the shopper has a usable bearer session (not a stale profile blob). */
export function isCustomerLoggedIn(): boolean {
  return hasActiveCustomerSession()
}

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
  /** Vendor settings — used when displayFields is not passed. */
  vendorSettings?: Record<string, unknown> | null
  /** Business Front Display fields for the active website template. */
  displayFields?: TemplateDisplayFields | null
  /** Catalog kind for product vs service checkout gates. */
  catalogKind?: 'product' | 'service'
  /** Override; defaults from displayFields + catalogKind, else legacy vendor settings. */
  requireSignIn?: boolean
}): Promise<void> {
  const { intent, cartItem, vendorSlug, navigate, storePath, qc, onBeforeNavigate } = opts
  const requireSignIn =
    opts.requireSignIn
    ?? (opts.displayFields && opts.catalogKind
      ? isSignInMandatoryForCatalog(
          opts.catalogKind === 'service' ? opts.displayFields.service : opts.displayFields.product,
          opts.vendorSettings,
        )
      : opts.vendorSettings != null
        ? isSignInMandatory(opts.vendorSettings)
        : false)

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
  const needsSignIn = requireSignIn && !isCustomerLoggedIn()

  if (!loggedIn) {
    useGuestCartStore.getState().addItem(vendorSlug, cartItem)
    applyLocalCart(qc, buildGuestCart(useGuestCartStore.getState().getItems(vendorSlug)))
    if (needsSignIn) {
      toast.info('Please sign in to continue to checkout')
      go(storePath('/login'), { from: storePath('/checkout') })
      return
    }
    go(storePath('/checkout'))
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
    await pruneServerServiceLines(intent)
    const cart = await storeApi.addToCart(payload)
    applyLocalCart(qc, cart)
  } catch (firstErr) {
    // Authenticated checkout reads the server cart — local seed alone causes "Cart is empty".
    try {
      await qc.cancelQueries({ queryKey: storeKeys.cart })
      await pruneServerServiceLines(intent)
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
