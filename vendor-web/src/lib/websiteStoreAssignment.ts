/** Resolve which business unit a website is assigned to (scope + store id). */
export function resolveWebsiteStoreLink(
  site: {
    website_store_scope?: string | null
    website_store_id?: string | null
    style_config?: Record<string, unknown> | null
  } | null | undefined,
  styleConfig?: Record<string, unknown> | null,
): { scope: string; storeId: string | null } {
  const sc = { ...(site?.style_config ?? {}), ...(styleConfig ?? {}) }
  const scope = String(site?.website_store_scope ?? sc.website_store_scope ?? 'all')
    .trim()
    .toLowerCase()
  const storeId = String(site?.website_store_id ?? sc.website_store_id ?? '').trim() || null
  return { scope, storeId }
}
