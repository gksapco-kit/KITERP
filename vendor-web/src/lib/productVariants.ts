import { formatUomDisplay } from '@/lib/uomOptions'
import { formatCurrency } from '@/lib/utils'

/** Default seed name for the auto-created first row on create. */
export function defaultVariantSeedName(isSubscription: boolean): string {
  return isSubscription ? 'Plan 1' : 'Variant 1'
}

/** Fields needed to build a ThemeSelect option for a product variant. */
export type VariantSelectSource = {
  id: string
  name?: string | null
  sku?: string | null
  barcode?: string | null
  uom?: string | null
  uom_quantity?: number | null
  price?: number | null
  cost_price?: number | null
  currency?: string | null
  attributes?: Record<string, unknown> | null
  color?: string | null
}

function variantAttributeSummary(attrs?: Record<string, unknown> | null, color?: string | null): string {
  const parts: string[] = []
  if (attrs && typeof attrs === 'object') {
    for (const value of Object.values(attrs)) {
      if (value == null) continue
      const text = String(value).trim()
      if (text) parts.push(text)
    }
  }
  const colorText = color?.trim()
  if (colorText && !parts.some((p) => p.toLowerCase() === colorText.toLowerCase())) {
    parts.unshift(colorText)
  }
  return parts.join(' · ')
}

/**
 * Build a ThemeSelect option so users can tell variants apart.
 * Label prefers attributes / UOM over generic names like "Variant 1";
 * hint carries price, cost, and barcode.
 */
export function variantSelectOption(v: VariantSelectSource): {
  value: string
  label: string
  hint?: string
} {
  const name = (v.name || '').trim()
  const sku = v.sku?.trim() || ''
  const barcode = v.barcode?.trim() || ''
  const attrLabel = variantAttributeSummary(v.attributes, v.color)
  const uomLabel = v.uom ? formatUomDisplay(v.uom_quantity, v.uom) : ''
  const generic = isDefaultManualVariantName(name, false)

  let title = attrLabel
  if (!title && name && !generic) title = name
  if (!title && uomLabel) title = uomLabel
  if (!title) title = name || 'Variant'

  const labelParts = [title]
  if (sku && !title.includes(sku)) labelParts.push(sku)
  // When title is still generic, surface UOM/barcode on the label itself.
  if (generic && uomLabel && uomLabel !== title && !title.includes(uomLabel)) {
    labelParts.push(uomLabel)
  }
  if (generic && barcode && !labelParts.some((p) => p.includes(barcode))) {
    labelParts.push(barcode)
  }

  const currency = v.currency || 'INR'
  const hintParts: string[] = []
  const price = v.price != null ? Number(v.price) : NaN
  if (!Number.isNaN(price) && price > 0) {
    hintParts.push(formatCurrency(price, currency))
  }
  const cost = v.cost_price != null ? Number(v.cost_price) : NaN
  if (!Number.isNaN(cost) && cost > 0 && cost !== price) {
    hintParts.push(`Cost ${formatCurrency(cost, currency)}`)
  }
  if (barcode && !labelParts.some((p) => p.includes(barcode))) {
    hintParts.push(barcode)
  }
  if (uomLabel && uomLabel !== title && !labelParts.includes(uomLabel)) {
    hintParts.push(uomLabel)
  }

  return {
    value: v.id,
    label: labelParts.join(' · '),
    hint: hintParts.length ? hintParts.join(' · ') : undefined,
  }
}

/** True when the name is still the auto-seeded default (or legacy "Default" / "Variant"). */
export function isDefaultManualVariantName(
  name: string | undefined | null,
  isSubscription: boolean,
): boolean {
  const n = (name || '').trim()
  if (!n) return false
  if (isSubscription) {
    return n === 'Plan 1' || n === 'Plan' || n === 'Default'
  }
  return n === 'Variant 1' || n === 'Variant' || n === 'Default'
}

function attrsAreEmpty(attrs: unknown): boolean {
  if (attrs == null || attrs === '') return true
  if (typeof attrs === 'string') {
    const t = attrs.trim()
    return !t || t === '{}'
  }
  if (typeof attrs === 'object') {
    return Object.keys(attrs as Record<string, unknown>).length === 0
  }
  return true
}

export type DefaultVariantInputCheck = {
  id?: string | null
  name?: string | null
  sku?: string | null
  barcode?: string | null
  quantity?: number | null
  price?: number | null
  compare_at_price?: number | null
  cost_price?: number | null
  discount_percentage?: number | null
  discount_amount?: number | null
  offer_label?: string | null
  is_on_sale?: boolean | null
  color?: string | null
  attributes_json?: string | null
  attributes?: Record<string, unknown> | null
  /** Config-engine generated variants are never treated as the default seed row. */
  variant_hash?: string | null
  config_selection?: Record<string, unknown> | null
  media?: unknown[] | null
}

/**
 * True when this row still looks like the untouched auto-seeded "Variant 1" / "Plan 1".
 * Used to omit placeholders on save and to auto-clean after Fast entry generation.
 * Persisted rows (with id) are included when `allowPersisted` is true.
 */
export function isPristineDefaultVariant(
  v: DefaultVariantInputCheck,
  isSubscription: boolean,
  opts?: { allowPersisted?: boolean },
): boolean {
  if (v.variant_hash) return false
  if (v.config_selection && Object.keys(v.config_selection).length > 0) return false
  if (v.id && !opts?.allowPersisted) return false
  if (!isDefaultManualVariantName(v.name, isSubscription)) return false
  if (v.sku?.trim() || v.barcode?.trim()) return false
  if ((v.quantity ?? 0) !== 0) return false
  if (Number(v.price ?? 0) > 0) return false
  if (v.compare_at_price != null && Number(v.compare_at_price) > 0) return false
  if (v.cost_price != null && Number(v.cost_price) > 0) return false
  if (v.discount_percentage != null && Number(v.discount_percentage) > 0) return false
  if (v.discount_amount != null && Number(v.discount_amount) > 0) return false
  if (v.offer_label?.trim()) return false
  if (v.is_on_sale) return false
  if (v.color?.trim()) return false
  if (v.media && v.media.length > 0) return false
  if (!attrsAreEmpty(v.attributes_json ?? v.attributes)) return false
  return true
}

/** Default seed row that the user has filled in (price, SKU, stock, etc.). */
export function defaultVariantHasUserInput(
  v: DefaultVariantInputCheck,
  isSubscription: boolean,
): boolean {
  if (!isDefaultManualVariantName(v.name, isSubscription)) return true
  return !isPristineDefaultVariant(v, isSubscription, { allowPersisted: true })
}

/** Serialize a variant for PATCH /products/:id (variant upsert/delete). */
export function variantToUpdatePayload(v: {
  id: string
  name: string
  sku?: string
  barcode?: string
  uom?: string
  uom_quantity?: number | null
  price_type?: string
  price: number
  compare_at_price?: number | null
  cost_price?: number | null
  currency?: string
  discount_percentage?: number | null
  discount_amount?: number | null
  offer_label?: string
  is_on_sale?: boolean
  is_taxable?: boolean
  tax_rate?: number | null
  hsn_code?: string
  gst_rate?: number | null
  quantity?: number
  low_stock_threshold?: number
  stock_status?: string
  reorder_point?: number | null
  reorder_quantity?: number | null
  allow_backorders?: boolean
  track_inventory?: boolean
  max_quantity_per_order?: number | null
  min_quantity_per_order?: number | null
  weight_kg?: number | null
  expiration_date?: string | null
  manufacture_date?: string | null
  best_before_date?: string | null
  warranty_period_days?: number | null
  warranty_type?: string | null
  is_returnable?: boolean
  return_days?: number | null
  refund_policy?: string | null
  return_policy?: string | null
  return_conditions?: string | null
  color?: string | null
  attributes?: Record<string, unknown>
  subscription_interval?: string | null
  subscription_trial_days?: number | null
  subscription_setup_fee?: number | null
  subscription_billing_cycles?: number | null
  subscription_schedule_modes?: string[]
  is_active?: boolean
}): Record<string, unknown> {
  return {
    id: v.id,
    name: v.name,
    sku: v.sku?.trim() || undefined,
    barcode: v.barcode?.trim() || undefined,
    uom: v.uom || 'piece',
    uom_quantity: v.uom_quantity ?? undefined,
    price_type: v.price_type || 'per_unit',
    price: v.price,
    compare_at_price: v.compare_at_price ?? undefined,
    cost_price: v.cost_price ?? undefined,
    currency: v.currency || 'INR',
    discount_percentage: v.discount_percentage ?? undefined,
    discount_amount: v.discount_amount ?? undefined,
    offer_label: v.offer_label?.trim() || undefined,
    is_on_sale: v.is_on_sale ?? false,
    is_taxable: v.is_taxable ?? true,
    tax_rate: v.tax_rate ?? undefined,
    hsn_code: v.hsn_code?.trim() || undefined,
    gst_rate: v.gst_rate ?? undefined,
    quantity: v.quantity ?? 0,
    low_stock_threshold: v.low_stock_threshold ?? 5,
    stock_status: v.stock_status || 'in_stock',
    reorder_point: v.reorder_point ?? undefined,
    reorder_quantity: v.reorder_quantity ?? undefined,
    allow_backorders: v.allow_backorders ?? false,
    track_inventory: v.track_inventory ?? true,
    max_quantity_per_order: v.max_quantity_per_order ?? undefined,
    min_quantity_per_order: v.min_quantity_per_order ?? undefined,
    weight_kg: v.weight_kg ?? undefined,
    expiration_date: v.expiration_date || undefined,
    manufacture_date: v.manufacture_date || undefined,
    best_before_date: v.best_before_date || undefined,
    warranty_period_days: v.warranty_period_days ?? undefined,
    warranty_type: v.warranty_type || undefined,
    is_returnable: v.is_returnable ?? true,
    return_days: v.return_days ?? undefined,
    refund_policy: v.refund_policy || undefined,
    return_policy: v.return_policy || undefined,
    return_conditions: v.return_conditions || undefined,
    color: v.color || undefined,
    attributes: v.attributes || {},
    subscription_interval: v.subscription_interval || undefined,
    subscription_trial_days: v.subscription_trial_days ?? undefined,
    subscription_setup_fee: v.subscription_setup_fee ?? undefined,
    subscription_billing_cycles: v.subscription_billing_cycles ?? undefined,
    subscription_schedule_modes: v.subscription_schedule_modes?.length ? v.subscription_schedule_modes : undefined,
    is_active: v.is_active ?? true,
  }
}
