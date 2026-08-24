export const DISPLAY_FIELDS_BY_TEMPLATE_KEY = 'display_fields_by_template'

export const PRODUCT_DISPLAY_FIELD_DEFS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'description', label: 'Full Description' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'tags', label: 'Tags' },
  { key: 'compare_at_price', label: 'Compare-at Price / M.R.P.' },
  { key: 'uom', label: 'Unit of Measure' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'new_arrival_badge', label: 'New Arrival Badge' },
  { key: 'best_seller_badge', label: 'Best Seller Badge' },
  { key: 'wishlist', label: 'Wishlist (heart icon)' },
  { key: 'view_count', label: 'View count (eye icon)' },
  { key: 'share', label: 'Share (WhatsApp / Email / Message)' },
  { key: 'variants', label: 'Variants / Options' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'stock_status', label: 'Stock Status' },
  { key: 'quote_request', label: 'Request a Quote' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'reviews', label: 'Reviews & Rating' },
  { key: 'cross_sell', label: 'Frequently Bought Together' },
  { key: 'upsell', label: 'You May Also Like' },
  { key: 'warranty', label: 'Warranty Info' },
  { key: 'return_policy', label: 'Return Policy' },
  { key: 'return_conditions', label: 'Return Conditions' },
  { key: 'refund_policy', label: 'Refund Policy' },
  { key: 'shipping_info', label: 'Shipping Info' },
  { key: 'weight', label: 'Weight' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'sign_in_mandatory', label: 'Sign in mandatory' },
] as const

export const SERVICE_DISPLAY_FIELD_DEFS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'description', label: 'Full Description' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'tags', label: 'Tags' },
  { key: 'reviews', label: 'Reviews & Rating' },
  { key: 'features', label: 'Features / Highlights' },
  { key: 'duration', label: 'Duration' },
  { key: 'uom', label: 'Unit of Measure' },
  { key: 'price_range', label: 'Price Range' },
  { key: 'service_plans', label: 'Service Plans' },
  { key: 'availability', label: 'Weekly Availability' },
  { key: 'subscription_details', label: 'Subscription Details' },
  { key: 'quote_request', label: 'Request a Quote' },
  { key: 'whats_included', label: "What's Included" },
  { key: 'whats_not_included', label: "What's Not Included" },
  { key: 'prerequisites', label: 'Prerequisites' },
  { key: 'service_areas', label: 'Service Areas' },
  { key: 'cancellation_policy', label: 'Cancellation Policy' },
  { key: 'rescheduling_policy', label: 'Rescheduling Policy' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'service_mode', label: 'Service Mode' },
  { key: 'share', label: 'Share (WhatsApp / Email / Message)' },
  { key: 'sign_in_mandatory', label: 'Sign in mandatory' },
] as const

export const SIGN_IN_MANDATORY_FIELD = 'sign_in_mandatory'

export type DisplayFieldMap = Record<string, boolean>

export type TemplateDisplayFields = {
  product: DisplayFieldMap
  service: DisplayFieldMap
}

export function createAllEnabledProductDisplayFields(): DisplayFieldMap {
  return Object.fromEntries(PRODUCT_DISPLAY_FIELD_DEFS.map(f => [f.key, true]))
}

export function createAllEnabledServiceDisplayFields(): DisplayFieldMap {
  return Object.fromEntries(SERVICE_DISPLAY_FIELD_DEFS.map(f => [f.key, true]))
}

export function createDefaultTemplateDisplayFields(): TemplateDisplayFields {
  return {
    product: createAllEnabledProductDisplayFields(),
    service: createAllEnabledServiceDisplayFields(),
  }
}

export function mergeDisplayFieldMap(
  defs: ReadonlyArray<{ key: string }>,
  overrides?: DisplayFieldMap | null,
  fallback?: DisplayFieldMap | null,
): DisplayFieldMap {
  const out: DisplayFieldMap = {}
  for (const def of defs) {
    if (overrides && def.key in overrides) {
      out[def.key] = Boolean(overrides[def.key])
    } else if (fallback && def.key in fallback) {
      out[def.key] = Boolean(fallback[def.key])
    } else {
      out[def.key] = true
    }
  }
  return out
}

export function readDisplayFieldsByTemplate(
  settings?: Record<string, unknown> | null,
): Record<string, TemplateDisplayFields> {
  const raw = settings?.[DISPLAY_FIELDS_BY_TEMPLATE_KEY]
  if (!raw || typeof raw !== 'object') return {}
  return raw as Record<string, TemplateDisplayFields>
}

function readLegacySignInMandatory(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  if (typeof settings?.sign_in_mandatory === 'boolean') return settings.sign_in_mandatory
  const raw = settings?.delivery_conditions
  if (!raw || typeof raw !== 'object') return true
  return (raw as { sign_in_mandatory?: unknown }).sign_in_mandatory !== false
}

function hasSignInKey(map?: DisplayFieldMap | null): boolean {
  return !!map && SIGN_IN_MANDATORY_FIELD in map
}

function applyLegacySignIn(
  map: DisplayFieldMap,
  settings: Record<string, unknown> | null | undefined,
  ...saved: Array<DisplayFieldMap | null | undefined>
): DisplayFieldMap {
  if (saved.some(hasSignInKey)) return map
  return { ...map, [SIGN_IN_MANDATORY_FIELD]: readLegacySignInMandatory(settings) }
}

export function resolveTemplateDisplayFieldsFromSettings(
  settings: Record<string, unknown> | null | undefined,
  templateId: string | null | undefined,
): TemplateDisplayFields {
  const defaults = createDefaultTemplateDisplayFields()
  const global = settings?.display_fields as Partial<TemplateDisplayFields> | undefined
  if (!templateId?.trim()) {
    return {
      product: applyLegacySignIn(
        mergeDisplayFieldMap(PRODUCT_DISPLAY_FIELD_DEFS, global?.product, defaults.product),
        settings,
        global?.product,
      ),
      service: applyLegacySignIn(
        mergeDisplayFieldMap(SERVICE_DISPLAY_FIELD_DEFS, global?.service, defaults.service),
        settings,
        global?.service,
      ),
    }
  }
  const byTemplate = readDisplayFieldsByTemplate(settings)
  const templateEntry = byTemplate[templateId.trim()]
  return {
    product: applyLegacySignIn(
      mergeDisplayFieldMap(
        PRODUCT_DISPLAY_FIELD_DEFS,
        templateEntry?.product,
        mergeDisplayFieldMap(PRODUCT_DISPLAY_FIELD_DEFS, global?.product, defaults.product),
      ),
      settings,
      templateEntry?.product,
      global?.product,
    ),
    service: applyLegacySignIn(
      mergeDisplayFieldMap(
        SERVICE_DISPLAY_FIELD_DEFS,
        templateEntry?.service,
        mergeDisplayFieldMap(SERVICE_DISPLAY_FIELD_DEFS, global?.service, defaults.service),
      ),
      settings,
      templateEntry?.service,
      global?.service,
    ),
  }
}

export function isSignInMandatoryForCatalog(
  map: DisplayFieldMap | undefined,
  settings?: Record<string, unknown> | null,
): boolean {
  if (map && SIGN_IN_MANDATORY_FIELD in map) {
    return map[SIGN_IN_MANDATORY_FIELD] !== false
  }
  return readLegacySignInMandatory(settings)
}

export function isSignInMandatoryForCart(
  displayFields: TemplateDisplayFields | undefined,
  settings: Record<string, unknown> | null | undefined,
  items: Array<{ product_id?: string | null; service_id?: string | null; item_type?: string | null }>,
): boolean {
  const hasService = items.some(i => !!i.service_id || i.item_type === 'service')
  const hasProduct = items.some(
    i => (!!i.product_id && !i.service_id) || i.item_type === 'product',
  )
  if (!hasProduct && !hasService) {
    return (
      isSignInMandatoryForCatalog(displayFields?.product, settings)
      || isSignInMandatoryForCatalog(displayFields?.service, settings)
    )
  }
  return (
    (hasProduct && isSignInMandatoryForCatalog(displayFields?.product, settings))
    || (hasService && isSignInMandatoryForCatalog(displayFields?.service, settings))
  )
}

/** Returns true when a display-field toggle is enabled (missing keys default to on). */
export function isDisplayFieldEnabled(map: DisplayFieldMap, key: string): boolean {
  return map[key] !== false
}
