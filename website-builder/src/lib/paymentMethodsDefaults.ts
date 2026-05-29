import { v4 as uuid } from 'uuid'
import type { PaymentMethodItem } from '../types/builder'

const PRESET_METHODS: PaymentMethodItem[] = [
  { id: 'visa', name: 'Visa', brandColor: '#1a1f71', textColor: '#ffffff' },
  { id: 'mastercard', name: 'Mastercard', brandColor: '#eb001b', textColor: '#ffffff' },
  { id: 'amex', name: 'Amex', brandColor: '#006fcf', textColor: '#ffffff' },
  { id: 'paypal', name: 'PayPal', brandColor: '#003087', textColor: '#ffffff' },
  { id: 'applepay', name: 'Apple Pay', brandColor: '#000000', textColor: '#ffffff' },
  { id: 'googlepay', name: 'Google Pay', brandColor: '#ffffff', textColor: '#3c4043' },
  { id: 'upi', name: 'UPI', brandColor: '#097939', textColor: '#ffffff' },
  { id: 'cod', name: 'Cash on delivery', brandColor: '#f3f4f6', textColor: '#374151' },
]

export function createPaymentMethod(overrides: Partial<PaymentMethodItem> = {}): PaymentMethodItem {
  return {
    id: uuid(),
    name: 'Payment',
    brandColor: '#4f46e5',
    textColor: '#ffffff',
    enabled: true,
    ...overrides,
  }
}

export function defaultPaymentMethods(): PaymentMethodItem[] {
  return PRESET_METHODS.filter((m) =>
    ['visa', 'mastercard', 'amex', 'paypal', 'applepay', 'googlepay'].includes(m.id ?? ''),
  ).map((m) => ({ ...m, enabled: true }))
}

export const PAYMENT_METHODS_DEFAULTS = {
  showSecureBadge: true,
  secureText: '256-bit SSL secure checkout',
  paymentMethodsLayout: 'card' as const,
}

export function defaultPaymentMethodsProps() {
  return {
    text: 'We accept',
    subtitle: 'Pay safely with your preferred method',
    paymentMethods: defaultPaymentMethods(),
    ...PAYMENT_METHODS_DEFAULTS,
  }
}
