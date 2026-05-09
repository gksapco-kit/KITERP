/**
 * Website builder "storefront_*" catalog templates — full React previews in
 * /template-browser/:id. When applied to a site, wb_catalog_template_id is set
 * on style_config so the live /store/:slug home can match that preview.
 */
export const STOREFRONT_CATALOG_TEMPLATE_IDS = [
  'storefront_fashion',
  'storefront_electronics',
  'storefront_grocery',
  'storefront_restaurant',
  'storefront_services',
] as const

export type StorefrontCatalogTemplateId = (typeof STOREFRONT_CATALOG_TEMPLATE_IDS)[number]

export function getWbCatalogTemplateId(styleConfig: Record<string, unknown> | undefined | null): string | null {
  const raw = styleConfig?.wb_catalog_template_id
  if (typeof raw !== 'string' || !raw.startsWith('storefront_')) return null
  return STOREFRONT_CATALOG_TEMPLATE_IDS.includes(raw as StorefrontCatalogTemplateId) ? raw : null
}
