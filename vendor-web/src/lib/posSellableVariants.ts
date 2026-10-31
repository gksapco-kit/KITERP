type PosVariant = { is_active?: boolean; is_pos_only?: boolean }

/**
 * Variants the POS counter can sell: every active variant.
 * The "POS only" flag only hides a variant from e-commerce; it must not gate the counter.
 */
export function posSellableVariants<T extends PosVariant>(
  variants: T[] | null | undefined,
): T[] {
  return (variants || []).filter((variant) => variant.is_active !== false)
}

/**
 * Product row for the billing list.
 * Every product is listed at the counter, with its active variants.
 */
export function posCatalogProduct<T extends { variants?: PosVariant[] | null }>(product: T): T | null {
  const variants = product.variants || []
  const sellable = posSellableVariants(variants)
  if (sellable.length === 0) return product
  return { ...product, variants: sellable }
}

/** Loose gram sales are priced per 1 g. Other units stay unlabeled. */
export function gramSaleUnit(variant: { uom?: string | null; uom_quantity?: number | null } | null | undefined): string | undefined {
  if (!variant) return undefined
  const uom = String(variant.uom || '').toLowerCase()
  const qty = Number(variant.uom_quantity ?? 0)
  if ((uom === 'g' || uom === 'gram') && qty === 1) return 'g'
  return undefined
}
