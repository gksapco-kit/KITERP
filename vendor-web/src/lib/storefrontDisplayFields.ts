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
] as const

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

/** Default for any website / builder template — all catalog detail fields enabled. */
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

export function resolveTemplateDisplayFieldsFromSettings(
  settings: Record<string, unknown> | null | undefined,
  templateId: string | null | undefined,
): TemplateDisplayFields {
  const defaults = createDefaultTemplateDisplayFields()
  const global = settings?.display_fields as Partial<TemplateDisplayFields> | undefined
  if (!templateId?.trim()) {
    return {
      product: mergeDisplayFieldMap(PRODUCT_DISPLAY_FIELD_DEFS, global?.product, defaults.product),
      service: mergeDisplayFieldMap(SERVICE_DISPLAY_FIELD_DEFS, global?.service, defaults.service),
    }
  }
  const byTemplate = readDisplayFieldsByTemplate(settings)
  const templateEntry = byTemplate[templateId.trim()]
  return {
    product: mergeDisplayFieldMap(
      PRODUCT_DISPLAY_FIELD_DEFS,
      templateEntry?.product,
      mergeDisplayFieldMap(PRODUCT_DISPLAY_FIELD_DEFS, global?.product, defaults.product),
    ),
    service: mergeDisplayFieldMap(
      SERVICE_DISPLAY_FIELD_DEFS,
      templateEntry?.service,
      mergeDisplayFieldMap(SERVICE_DISPLAY_FIELD_DEFS, global?.service, defaults.service),
    ),
  }
}

/** Builder / draft preview — honor Business Front Display, not “all fields on”. */
export function resolveBuilderCanvasDisplayFields(input: {
  settings?: Record<string, unknown> | null
  siteId?: string | null
  storeSettings?: Record<string, unknown> | null
}): TemplateDisplayFields {
  const settings = input.settings ?? null
  const byTemplate = readDisplayFieldsByTemplate(settings)
  const siteKey = input.siteId?.trim() || null
  const storeTemplate = typeof input.storeSettings?.front_template_id === 'string'
    ? input.storeSettings.front_template_id.trim() || null
    : null
  const singleTemplate = typeof settings?.single_front_template_id === 'string'
    ? settings.single_front_template_id.trim() || null
    : null
  const templateId =
    (siteKey && byTemplate[siteKey] ? siteKey : null)
    || storeTemplate
    || singleTemplate
    || siteKey
  return resolveTemplateDisplayFieldsFromSettings(settings, templateId)
}

export function ensureTemplateDisplayFieldsEntry(
  settings: Record<string, unknown> | null | undefined,
  templateId: string,
): Record<string, unknown> {
  const base = { ...(settings ?? {}) }
  const byTemplate = { ...readDisplayFieldsByTemplate(base) }
  if (!byTemplate[templateId]) {
    byTemplate[templateId] = createDefaultTemplateDisplayFields()
  }
  return { ...base, [DISPLAY_FIELDS_BY_TEMPLATE_KEY]: byTemplate }
}

/** Returns true when a display-field toggle is enabled (missing keys default to on). */
export function isDisplayFieldEnabled(map: DisplayFieldMap, key: string): boolean {
  return map[key] !== false
}
