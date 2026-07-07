import type { GuestCartItem } from '@/stores/guestCartStore'

export type PendingBuyNow = {
  vendorSlug: string
  productId: string
  item: GuestCartItem
}

const STORAGE_KEY = 'kiterp-pending-buy-now'

export function setPendingBuyNow(pending: PendingBuyNow) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingBuyNow(vendorSlug: string): PendingBuyNow | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as PendingBuyNow
    if (pending.vendorSlug !== vendorSlug) return null
    return pending
  } catch {
    return null
  }
}

export function clearPendingBuyNow() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function takePendingBuyNow(vendorSlug: string): PendingBuyNow | null {
  const pending = peekPendingBuyNow(vendorSlug)
  if (pending) clearPendingBuyNow()
  return pending
}

export function cartHasMatchingLine(
  items: Array<{ product_id?: string; variant_id?: string | null }> | undefined,
  productId: string,
  variantId?: string | null,
): boolean {
  if (!items?.length) return false
  const variantKey = variantId ?? ''
  return items.some(
    (line) =>
      String(line.product_id ?? '') === productId
      && String(line.variant_id ?? '') === variantKey,
  )
}
