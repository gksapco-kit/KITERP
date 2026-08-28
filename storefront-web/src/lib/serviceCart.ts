import { storeApi } from '@/api/store'
import type { PendingCheckoutIntent } from '@/lib/pendingCheckoutIntent'
import type { Cart } from '@/types'

export function isServiceCartItem(item: {
  service_id?: unknown
  product_id?: unknown
  item_type?: unknown
}): boolean {
  if (item.item_type === 'service') return true
  return Boolean(item.service_id && !item.product_id)
}

function matchesIntent(
  item: { service_id?: unknown; product_id?: unknown },
  intent: PendingCheckoutIntent,
): boolean {
  if (intent.kind === 'booking') {
    return String(item.service_id ?? '') === String(intent.payload.service_id ?? '')
  }
  if (intent.payload.service_id) {
    return String(item.service_id ?? '') === String(intent.payload.service_id)
  }
  if (intent.payload.product_id) {
    return String(item.product_id ?? '') === String(intent.payload.product_id)
  }
  return false
}

/** Keep product lines plus a single service (the intent match, or the latest service). */
export function keepSingleServiceLines<T extends {
  service_id?: unknown
  product_id?: unknown
  item_type?: unknown
}>(items: T[], intent?: PendingCheckoutIntent | null): T[] {
  const products = items.filter((item) => !isServiceCartItem(item))
  const services = items.filter((item) => isServiceCartItem(item))
  if (!services.length) return products
  const matched = intent ? services.filter((item) => matchesIntent(item, intent)) : []
  const chosen = matched.length ? matched[matched.length - 1] : services[services.length - 1]
  return [...products, chosen]
}

export function keepSingleServiceIndexed<T extends {
  service_id?: unknown
  product_id?: unknown
  item_type?: unknown
}>(
  items: T[],
  intent?: PendingCheckoutIntent | null,
): Array<{ item: T; index: number }> {
  const indexed = items.map((item, index) => ({ item, index }))
  const products = indexed.filter(({ item }) => !isServiceCartItem(item))
  const services = indexed.filter(({ item }) => isServiceCartItem(item))
  if (!services.length) return products
  const matched = intent ? services.filter(({ item }) => matchesIntent(item, intent)) : []
  const chosen = matched.length ? matched[matched.length - 1] : services[services.length - 1]
  return [...products, chosen]
}

/** Drop leftover booking/subscription lines on the server cart, keep one service. */
export async function pruneServerServiceLines(
  intent?: PendingCheckoutIntent | null,
): Promise<Cart> {
  let cart = await storeApi.getCart()
  const items = (cart.items ?? []) as Array<{
    service_id?: string | null
    product_id?: string | null
    item_type?: string | null
  }>
  const keep = new Set(keepSingleServiceIndexed(items, intent).map(({ index }) => index))
  if (keep.size === items.length) return cart
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (!keep.has(i)) {
      cart = await storeApi.removeCartItem(i)
    }
  }
  return cart
}
