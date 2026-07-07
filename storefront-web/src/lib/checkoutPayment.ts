import type { PaymentSelection } from '@/checkout/types'

/** Payment methods accepted by POST /store/orders/checkout and guest-checkout. */
export const CHECKOUT_PAYMENT_METHODS = new Set([
  'cod',
  'upi',
  'pay_later',
  'card',
  'netbanking',
  'wallet',
  'razorpay',
  'stripe',
  'square',
  'paypal',
  'payu',
])

const HOSTED_GATEWAYS = new Set(['razorpay', 'stripe', 'square', 'paypal', 'payu'])

export function checkoutSelectionToPaymentMethod(sel?: PaymentSelection): string {
  if (!sel) return 'upi'
  if (sel.kind === 'provider') {
    if (sel.provider === 'cod') return 'cod'
    return sel.provider
  }
  if (sel.tab === 'bank_transfer') return 'cod'
  if (sel.tab === 'upi') return 'upi'
  if (sel.tab === 'bnpl') return 'pay_later'
  return 'card'
}

export function isManualProofPayment(sel?: PaymentSelection): boolean {
  return sel?.kind === 'tab' && sel.tab === 'upi'
}

/** @deprecated use isManualProofPayment */
export function isManualUpiPayment(sel?: PaymentSelection): boolean {
  return isManualProofPayment(sel)
}

export function isHostedCheckoutGateway(method: string): boolean {
  return HOSTED_GATEWAYS.has(method)
}

export function isOnlineCheckoutPayment(method: string, sel?: PaymentSelection): boolean {
  if (isManualProofPayment(sel)) return false
  if (method === 'cod' || method === 'pay_later') return false
  return true
}

export function validateCheckoutPaymentMethod(method: string): string | null {
  if (CHECKOUT_PAYMENT_METHODS.has(method)) return null
  return `Payment method "${method}" is not supported yet. Choose Cash on Delivery or another option shown at checkout.`
}
