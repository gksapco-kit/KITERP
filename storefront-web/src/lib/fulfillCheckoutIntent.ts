import { toast } from 'sonner'
import { storeApi } from '@/api/store'
import {
  clearPendingCheckoutIntent,
  peekPendingCheckoutIntent,
} from '@/lib/pendingCheckoutIntent'

/**
 * Create the CRM subscription/booking after the order (and payment when online) succeeds.
 * Peeks intent first and only clears it on success so cancelled payments can retry.
 */
export async function fulfillPendingCheckoutIntent(
  vendorSlug: string | undefined,
  orderId: string,
  paymentMethod: string,
): Promise<boolean> {
  if (!vendorSlug) return false
  const intent = peekPendingCheckoutIntent(vendorSlug)
  if (!intent) return false

  try {
    if (intent.kind === 'subscription') {
      await storeApi.createSubscription({
        ...intent.payload,
        payment_method: paymentMethod,
        schedule_config: {
          ...(intent.payload.schedule_config || {}),
          order_id: orderId,
        },
      })
    } else if (intent.kind === 'booking') {
      await storeApi.createBooking({
        ...intent.payload,
        payment_method: paymentMethod,
        order_id: orderId,
      })
    }
    clearPendingCheckoutIntent()
    return true
  } catch (err) {
    console.error('[fulfillCheckoutIntent] failed', err)
    toast.error(
      intent.kind === 'subscription'
        ? 'Payment recorded, but we could not activate your subscription. Contact the store with your order number.'
        : 'Payment recorded, but we could not confirm your booking. Contact the store with your order number.',
    )
    return false
  }
}
