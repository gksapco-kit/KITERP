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
