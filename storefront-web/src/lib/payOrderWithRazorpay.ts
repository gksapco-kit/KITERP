import { storeApi } from '@/api/store'
import { ensureCustomerSessionActive } from '@/lib/subscribeCheckout'
import { openRazorpayCheckout } from '@/lib/razorpay'
import { extractApiError } from '@/lib/errorMessages'

export type RazorpayPaymentResult = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

/**
 * Create a Razorpay order server-side and open the hosted checkout modal.
 * Resolves after the shopper completes payment in the Razorpay UI.
 */
export async function payOrderWithRazorpay(opts: {
  orderId: string
  storeName: string
  onStage?: (message: string | null) => void
}): Promise<RazorpayPaymentResult> {
  const { orderId, storeName, onStage } = opts

  ensureCustomerSessionActive()
  onStage?.('Preparing secure checkout…')

  let rzp: Awaited<ReturnType<typeof storeApi.createRazorpayOrder>>
  try {
    rzp = await storeApi.createRazorpayOrder(orderId)
  } catch (err) {
    throw new Error(
      extractApiError(
        err,
        'Could not start Razorpay checkout. Check that Key ID and Key Secret are saved in CRM → Integrations → Razorpay.',
      ),
    )
  }

  if (rzp.dev_mode) {
    throw new Error(
      'Razorpay checkout is not fully configured. Add your Razorpay Key ID and Key Secret in CRM → Integrations → Razorpay, activate checkout, then try again.',
    )
  }

  if (!rzp.key_id || !rzp.razorpay_order_id) {
    throw new Error('Invalid Razorpay checkout session. Please try again.')
  }

  // Hide blocking loaders so the Razorpay modal is fully interactive.
  onStage?.(null)

  let captured: RazorpayPaymentResult | null = null
  await openRazorpayCheckout({
    key: rzp.key_id,
    amount: rzp.amount,
    currency: rzp.currency,
    name: storeName,
    description: 'Order payment',
    order_id: rzp.razorpay_order_id,
    prefill: rzp.prefill,
    ...(rzp.checkout_config_id ? { checkout_config_id: rzp.checkout_config_id } : {}),
    handler: async (response) => {
      captured = response
    },
  })

  if (!captured) {
    throw new Error('Payment was not completed. Please try again.')
  }
  return captured
}

export async function verifyRazorpayOrderPayment(
  orderId: string,
  payment: RazorpayPaymentResult,
): Promise<void> {
  ensureCustomerSessionActive()
  await storeApi.verifyRazorpayPayment({
    order_id: orderId,
    ...payment,
  })
}
