export const DISPLAY_FIELDS_BY_TEMPLATE_KEY = 'display_fields_by_template'

export const PRODUCT_DISPLAY_FIELD_DEFS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'warranty', label: 'Warranty Info' },
  { key: 'return_policy', label: 'Return Policy' },
  { key: 'shipping_info', label: 'Shipping Info' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'sku', label: 'SKU / Barcode' },
  { key: 'stock_status', label: 'Stock Status' },
  { key: 'tags', label: 'Tags' },
] as const

export const SERVICE_DISPLAY_FIELD_DEFS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'whats_included', label: "What's Included" },
  { key: 'whats_not_included', label: "What's Not Included" },
  { key: 'prerequisites', label: 'Prerequisites' },
  { key: 'service_areas', label: 'Service Areas' },
  { key: 'cancellation_policy', label: 'Cancellation Policy' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'service_mode', label: 'Service Mode' },
  { key: 'tags', label: 'Tags' },
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
