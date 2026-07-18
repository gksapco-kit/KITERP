import type { GuestCartItem } from '@/stores/guestCartStore'

/** Pending subscription / booking fulfilled after the normal checkout order is placed. */

export type PendingSubscriptionIntent = {
  kind: 'subscription'
  vendorSlug: string
  cartItem: GuestCartItem
  payload: {
    item_type: 'product' | 'service'
    product_id?: string
    variant_id?: string
    service_id?: string
    item_name: string
    interval: string
    price_per_cycle: number
    qty?: number
    schedule_config?: Record<string, unknown>
  }
}

export type PendingBookingIntent = {
  kind: 'booking'
  vendorSlug: string
  cartItem: GuestCartItem
  payload: {
    service_id: string
    plan_id?: string
    booking_date: string
    start_time?: string
    notes?: string
  }
}

export type PendingCheckoutIntent = PendingSubscriptionIntent | PendingBookingIntent

const STORAGE_KEY = 'kiterp-pending-checkout-intent'

export function setPendingCheckoutIntent(intent: PendingCheckoutIntent) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent))
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingCheckoutIntent(vendorSlug: string): PendingCheckoutIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const intent = JSON.parse(raw) as PendingCheckoutIntent
    if (intent.vendorSlug !== vendorSlug) return null
    return intent
  } catch {
    return null
  }
}

export function clearPendingCheckoutIntent() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function takePendingCheckoutIntent(vendorSlug: string): PendingCheckoutIntent | null {
  const intent = peekPendingCheckoutIntent(vendorSlug)
  if (intent) clearPendingCheckoutIntent()
  return intent
}

export function cartHasIntentLine(
  items: Array<{ product_id?: string; service_id?: string; variant_id?: string | null }> | undefined,
  cartItem: GuestCartItem,
): boolean {
  if (!items?.length) return false
  if (cartItem.service_id && !cartItem.product_id) {
    return items.some((line) => String(line.service_id ?? '') === cartItem.service_id)
  }
  const variantKey = cartItem.variant_id ?? ''
  return items.some(
    (line) =>
      String(line.product_id ?? '') === String(cartItem.product_id ?? '')
      && String(line.variant_id ?? '') === variantKey,
  )
}

function formatShortDate(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

/** One-line schedule summary for cart / order notes. */
export function formatSubscriptionCheckoutSummary(intent: PendingSubscriptionIntent): string {
  const cfg = intent.payload.schedule_config || {}
  const cycles = Number(cfg.cycles ?? 1)
  const interval = String(intent.payload.interval || 'monthly')
  const start = formatShortDate(String(cfg.startDate || cfg.start_date || ''))
  const end = formatShortDate(String(cfg.endDate || cfg.end_date || ''))
  const period = start && end ? `${start} → ${end}` : start ? `from ${start}` : null
  const parts = [
    `${cycles} ${interval} cycle${cycles !== 1 ? 's' : ''}`,
    period,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function formatBookingCheckoutSummary(intent: PendingBookingIntent): string {
  const date = intent.payload.booking_date
  const time = intent.payload.start_time
  return time ? `${date} at ${time}` : date
}

export function buildCheckoutNotesFromIntent(intent: PendingCheckoutIntent): string {
  if (intent.kind === 'subscription') {
    const summary = formatSubscriptionCheckoutSummary(intent)
    return `Subscription: ${intent.payload.item_name}. Schedule: ${summary}.`
  }
  const summary = formatBookingCheckoutSummary(intent)
  return `Service booking: ${summary}.${intent.payload.notes ? ` Notes: ${intent.payload.notes}` : ''}`
}
