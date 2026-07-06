/** Build a storefront catalog URL filtered to one maintained category. */
export function buildCategoryCatalogPath(
  categoryName: string,
  appliesTo: string | undefined,
  storePath: (path: string) => string,
): string {
  const name = encodeURIComponent(categoryName.trim())
  if (!name) return storePath('/products')

  const scope = (appliesTo || 'both').toLowerCase()
  if (scope === 'service') return storePath(`/services?category=${name}`)
  return storePath(`/products?category=${name}`)
}

export function readAppliesTo(meta?: Record<string, unknown>): string {
  const raw = meta?.applies_to
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'both'
}
