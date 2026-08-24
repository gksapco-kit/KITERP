/** Match storefront: catalog display-field checkboxes, then legacy vendor flags. */

const SIGN_IN_FIELD = 'sign_in_mandatory'

function readLegacySignInMandatory(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  if (typeof settings?.sign_in_mandatory === 'boolean') {
    return settings.sign_in_mandatory
  }
  const raw = settings?.delivery_conditions
  if (!raw || typeof raw !== 'object') return true
  return (raw as { sign_in_mandatory?: unknown }).sign_in_mandatory !== false
}

function readCatalogSignIn(
  settings: Record<string, unknown> | null | undefined,
  kind: 'product' | 'service',
): boolean {
  const global = settings?.display_fields
  const kindMap =
    global && typeof global === 'object'
      ? (global as Record<string, Record<string, unknown>>)[kind]
      : undefined
  if (kindMap && typeof kindMap === 'object' && SIGN_IN_FIELD in kindMap) {
    return kindMap[SIGN_IN_FIELD] !== false
  }
  const byTemplate = settings?.display_fields_by_template
  if (byTemplate && typeof byTemplate === 'object') {
    const found: boolean[] = []
    for (const entry of Object.values(byTemplate as Record<string, { product?: Record<string, unknown>; service?: Record<string, unknown> }>)) {
      const map = entry?.[kind]
      if (map && typeof map === 'object' && SIGN_IN_FIELD in map) {
        found.push(map[SIGN_IN_FIELD] !== false)
      }
    }
    if (found.length) return found.some(Boolean)
  }
  return readLegacySignInMandatory(settings)
}

export function isSignInMandatory(
  settings: Record<string, unknown> | null | undefined,
  items?: Array<{ product_id?: string | null; service_id?: string | null; item_type?: string | null }>,
): boolean {
  const product = readCatalogSignIn(settings, 'product')
  const service = readCatalogSignIn(settings, 'service')
  if (!items?.length) return product || service
  const hasService = items.some(i => !!i.service_id || i.item_type === 'service')
  const hasProduct = items.some(
    i => (!!i.product_id && !i.service_id) || i.item_type === 'product',
  )
  if (!hasProduct && !hasService) return product || service
  return (hasProduct && product) || (hasService && service)
}
