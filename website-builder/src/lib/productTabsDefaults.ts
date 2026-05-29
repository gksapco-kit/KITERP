import { v4 as uuid } from 'uuid'
import type { ProductTabItem } from '../types/builder'

export const PRODUCT_TABS_DEFAULTS = {
  productTabsLayout: 'underline' as const,
}

export function createProductTab(overrides: Partial<ProductTabItem> = {}): ProductTabItem {
  return {
    id: uuid(),
    label: 'Tab',
    content: 'Tab content goes here.',
    enabled: true,
    ...overrides,
  }
}

export function defaultProductTabs(): ProductTabItem[] {
  return [
    {
      id: 'description',
      label: 'Description',
      enabled: true,
      content:
        'Crafted for everyday use with premium materials and thoughtful details. Designed to look great and perform reliably — whether at home or on the go.',
    },
    {
      id: 'specs',
      label: 'Specifications',
      enabled: true,
      content:
        '• Dimensions: 24 × 16 × 8 cm\n• Weight: 450 g\n• Material: Recycled aluminum + organic cotton\n• Care: Wipe clean with a damp cloth\n• Warranty: 2 years',
    },
    {
      id: 'reviews',
      label: 'Reviews',
      enabled: true,
      content:
        'Customers love the quality and fast shipping. Average rating 4.9/5 based on 128 verified reviews. Most mention excellent value and responsive support.',
    },
    {
      id: 'shipping',
      label: 'Shipping',
      enabled: true,
      content:
        'Free standard shipping on orders over $50. Express delivery available at checkout. Most orders ship within 24 hours and arrive in 3–5 business days.',
    },
  ]
}

export function defaultProductTabsProps() {
  return {
    text: 'Product details',
    subtitle: 'Everything you need to know before you buy',
    productTabs: defaultProductTabs(),
    ...PRODUCT_TABS_DEFAULTS,
  }
}
