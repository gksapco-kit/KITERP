function isPosOnlyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1'
}

type PosVariant = { is_active?: boolean; is_pos_only?: boolean }

/** Variants the POS counter should sell: only sizes with POS only turned on. */
export function posSellableVariants<T extends PosVariant>(
  variants: T[] | null | undefined,
): T[] {
  return (variants || []).filter((variant) => variant.is_active !== false && isPosOnlyFlag(variant.is_pos_only))
}

/**
 * Product row for the billing list.
 * A product with sizes stays off the counter until at least one size has POS only on.
 * A product with no sizes is unchanged.
 */
export function posCatalogProduct<T extends { variants?: PosVariant[] | null }>(product: T): T | null {
  const variants = product.variants || []
  const active = variants.filter((variant) => variant.is_active !== false)
  if (active.length === 0) return product
  const sellable = posSellableVariants(variants)
  if (sellable.length === 0) return null
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
