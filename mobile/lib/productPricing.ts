import type { Product, ProductVariant } from '../types'

export type ProductPricing = {
  price: number
  compareAt?: number | null
  /** true when price comes from multiple variants (show “from”) */
  showFrom: boolean
  variant?: ProductVariant | null
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function activeVariants(product?: Product | null): ProductVariant[] {
  const list = product?.variants
  if (!Array.isArray(list)) return []
  return list.filter((v) => v && v.is_active !== false)
}

/** Same rule as storefront: prefer priced variants when product.price is 0. */
export function getProductPricing(product?: Product | null): ProductPricing {
  if (!product) return { price: 0, showFrom: false, variant: null }

  const variants = activeVariants(product)
  const priced = variants
    .map((v) => ({ v, price: toNumber(v.price) }))
    .filter((row) => row.v.price_type !== 'not_applicable' && row.price > 0)

  if (priced.length > 0) {
    priced.sort((a, b) => a.price - b.price)
    const cheapest = priced[0]
    const max = priced[priced.length - 1].price
    const compare =
      toNumber(cheapest.v.compare_at_price) ||
      toNumber(product.compare_at_price) ||
      null
    return {
      price: cheapest.price,
      compareAt: compare && compare > 0 ? compare : null,
      showFrom: priced.length > 1 && max > cheapest.price,
      variant: cheapest.v,
    }
  }

  const base = toNumber(product.price)
  const compare = toNumber(product.compare_at_price)
  return {
    price: base,
    compareAt: compare > 0 ? compare : null,
    showFrom: false,
    variant: variants[0] || null,
  }
}

export function formatProductPriceLabel(
  pricing: ProductPricing,
  formatCurrency: (n: number) => string,
): string {
  if (!(pricing.price > 0)) return 'Price on request'
  return pricing.showFrom
    ? `From ${formatCurrency(pricing.price)}`
    : formatCurrency(pricing.price)
}
