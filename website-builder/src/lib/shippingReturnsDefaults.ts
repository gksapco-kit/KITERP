import { v4 as uuid } from 'uuid'
import type { PolicyInfoSection } from '../types/builder'

export function createPolicySection(overrides: Partial<PolicyInfoSection> = {}): PolicyInfoSection {
  return {
    id: uuid(),
    title: 'Section',
    description: '',
    icon: 'truck',
    items: [],
    ...overrides,
  }
}

export function defaultShippingReturnsSections(): PolicyInfoSection[] {
  return [
    createPolicySection({
      title: 'Shipping & delivery',
      description: 'Fast, tracked delivery to your door.',
      icon: 'truck',
      items: [
        'Free standard shipping on orders over $50',
        'Express shipping available at checkout',
        'Orders ship within 1–2 business days',
        'Tracking sent by email once your order ships',
      ],
    }),
    createPolicySection({
      title: 'Returns & exchanges',
      description: 'Shop with confidence — we make returns simple.',
      icon: 'refresh',
      items: [
        '30-day hassle-free returns on unused items',
        'Free return shipping on defective products',
        'Refunds processed within 5–7 business days',
        'Exchanges available for size and color',
      ],
    }),
  ]
}

export function defaultShippingReturnsInfoProps() {
  return {
    text: 'Shipping & Returns',
    subtitle: 'Everything you need to know before and after your purchase.',
    policySections: defaultShippingReturnsSections(),
  }
}
