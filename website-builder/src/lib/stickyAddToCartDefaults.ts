const PRODUCT_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80'

export const STICKY_ADD_TO_CART_DEFAULTS = {
  buttonText: 'Add to cart',
  productPrice: '$79.00',
  compareAtPrice: '$99.00',
  showStickyAtcImage: true,
  showStickyAtcQuantity: true,
  stickyAtcRevealOnScroll: true,
  stickyAtcScrollThreshold: 120,
  linkedItemType: 'product' as const,
}

export function defaultStickyAddToCartProps() {
  return {
    text: 'Wireless Earbuds Pro',
    subtitle: 'Free shipping · 30-day returns',
    imageUrl: PRODUCT_IMG,
    ...STICKY_ADD_TO_CART_DEFAULTS,
  }
}

export function parsePriceValue(price?: string): number {
  if (!price) return 0
  const n = parseFloat(price.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatPriceDisplay(value: number, template?: string): string {
  if (template?.includes('$')) return `$${value.toFixed(2)}`
  return value.toFixed(2)
}
