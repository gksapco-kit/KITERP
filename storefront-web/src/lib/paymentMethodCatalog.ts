/** Known payment provider keys for the payment methods strip block. */
export const PAYMENT_METHOD_KEYS = [
  'visa',
  'mastercard',
  'amex',
  'paypal',
  'stripe',
  'razorpay',
  'apple_pay',
  'google_pay',
  'upi',
  'cod',
  'bank_transfer',
] as const

export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number]

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  paypal: 'PayPal',
  stripe: 'Stripe',
  razorpay: 'Razorpay',
  apple_pay: 'Apple Pay',
  applepay: 'Apple Pay',
  google_pay: 'Google Pay',
  gpay: 'Google Pay',
  upi: 'UPI',
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
}

export const DEFAULT_PAYMENT_METHOD_KEYS: PaymentMethodKey[] = [
  'visa',
  'mastercard',
  'upi',
  'google_pay',
  'cod',
]

export function paymentMethodLabel(key: string): string {
  const normalized = key.toLowerCase().replace(/\s+/g, '_')
  return PAYMENT_METHOD_LABELS[normalized] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function normalizePaymentMethodKey(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    return String(rec.method ?? rec.id ?? rec.key ?? '').trim()
  }
  return ''
}

/** Read `props.methods` whether stored as string[] or { method }[]. */
export function readPaymentMethodKeys(props: Record<string, unknown>): string[] {
  const raw = props.methods
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_PAYMENT_METHOD_KEYS]
  const keys = raw.map(normalizePaymentMethodKey).filter(Boolean)
  return keys.length > 0 ? keys : [...DEFAULT_PAYMENT_METHOD_KEYS]
}

/** Shape used by the builder sidebar item editor. */
export function paymentMethodsForEditor(props: Record<string, unknown>): { method: string }[] {
  return readPaymentMethodKeys(props).map(method => ({ method }))
}

export function paymentMethodsFromEditor(items: unknown[]): { method: string }[] {
  return items
    .map(entry => ({ method: normalizePaymentMethodKey(entry) }))
    .filter(entry => entry.method.length > 0)
}
