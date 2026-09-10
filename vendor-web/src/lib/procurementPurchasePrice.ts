/**
 * Resolve the purchase / estimated unit cost to seed on a procurement line
 * when a product, variant, or service is selected from master data.
 *
 * Preference order:
 *   product/variant → cost_price, then sell price
 *   service         → purchase_price, purchase_price_fixed, then sell price
 */

export function masterPriceNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Prefer a positive master price; fall back to zero only when that is the only value. */
export function preferPositivePrice(
  ...candidates: Array<number | null | undefined>
): number | null {
  for (const c of candidates) {
    if (c != null && c > 0) return c
  }
  for (const c of candidates) {
    if (c != null) return c
  }
  return null
}

export function resolveProductPurchasePrice(src: {
  cost_price?: number | null
  price?: number | null
} | null | undefined): number | null {
  if (!src) return null
  return preferPositivePrice(masterPriceNum(src.cost_price), masterPriceNum(src.price))
}

export function resolveServicePurchasePrice(src: {
  purchase_price?: number | null
  purchase_price_fixed?: number | null
  price?: number | null
  cost_price?: number | null
} | null | undefined): number | null {
  if (!src) return null
  return preferPositivePrice(
    masterPriceNum(src.purchase_price),
    masterPriceNum(src.purchase_price_fixed),
    masterPriceNum(src.cost_price),
    masterPriceNum(src.price),
  )
}

type VariantLike = {
  id: string
  cost_price?: number | null
  price?: number | null
}

/**
 * Product-level price, or the selected variant's price.
 * When no variant is chosen but variants exist and product-level cost is empty,
 * seed from the lowest positive variant cost (same pattern as Goods Receipt).
 */
export function resolveCatalogPurchasePrice(
  product: {
    cost_price?: number | null
    price?: number | null
    variants?: VariantLike[] | null
  } | null | undefined,
  variantId?: string | null,
): number | null {
  if (!product) return null
  const variants = product.variants ?? []

  if (variantId) {
    const variant = variants.find(v => v.id === variantId)
    return (
      resolveProductPurchasePrice(variant) ??
      resolveProductPurchasePrice(product)
    )
  }

  const productLevel = resolveProductPurchasePrice(product)
  if (productLevel != null && productLevel > 0) return productLevel

  if (variants.length) {
    const ranked = variants
      .map(v => resolveProductPurchasePrice(v))
      .filter((n): n is number => n != null && n > 0)
      .sort((a, b) => a - b)
    if (ranked.length) return ranked[0]
  }

  return productLevel
}

export function priceToInput(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}
