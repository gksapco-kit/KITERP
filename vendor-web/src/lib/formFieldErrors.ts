/** Friendly labels for API / form field paths (leaf keys). */
export const FORM_FIELD_LABELS: Record<string, string> = {
  name: 'Product name',
  slug: 'URL slug',
  material_code: 'Material code',
  short_description: 'Short description',
  price: 'Price',
  compare_at_price: 'Compare at price',
  cost_price: 'Cost',
  quantity: 'Qty on hand',
  low_stock_threshold: 'Low stock at',
  reorder_point: 'Reorder at',
  reorder_quantity: 'Reorder quantity',
  max_quantity_per_order: 'Max per order',
  min_quantity_per_order: 'Min per order',
  sku: 'SKU',
  barcode: 'Barcode',
  uom_quantity: 'Qty (UOM)',
  discount_percentage: 'Discount %',
  discount_amount: 'Discount amount',
  offer_label: 'Offer label',
  tax_rate: 'Tax rate',
  gst_rate: 'GST rate',
  hsn_code: 'HSN code',
  weight_kg: 'Weight (kg)',
  return_days: 'Return window (days)',
  warranty_period_days: 'Warranty (days)',
  subscription_trial_days: 'Trial days',
  subscription_setup_fee: 'Setup fee',
  subscription_billing_cycles: 'Billing cycles',
}

/** Resolve a dotted API field path to a readable label, e.g. variants.0.max_quantity_per_order. */
export function resolveFormFieldLabel(fieldPath: string): string {
  const parts = fieldPath.split(/[.>]/).filter(Boolean)
  const leaf = (parts[parts.length - 1] ?? fieldPath).toLowerCase()
  const base = FORM_FIELD_LABELS[leaf]
    ?? leaf.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const variantIdx = parts.findIndex(p => p === 'variants')
  if (variantIdx >= 0) {
    const rawIndex = parts[variantIdx + 1]
    if (rawIndex != null && /^\d+$/.test(String(rawIndex))) {
      const n = parseInt(String(rawIndex), 10) + 1
      return `${base} (Variant ${n})`
    }
    return `${base} (variant)`
  }

  return base
}

/**
 * Turn Zod / Pydantic / react-hook-form default messages into short, field-specific copy.
 */
export function formatFormFieldError(message: string, fieldLabel?: string): string {
  const label = fieldLabel?.replace(/\s*\*+\s*$/, '').trim() || 'This field'
  const m = message.trim()
  const lower = m.toLowerCase()

  let match = m.match(/^String must contain at most (\d+) character/i)
  if (match) return `${label} cannot exceed ${match[1]} characters`

  match = m.match(/^String must contain at least (\d+) character/i)
  if (match) return `${label} must be at least ${match[1]} characters`

  match = m.match(/^(?:Number|Input) must be (less than or equal to|greater than or equal to|less than|greater than) (\d+)/i)
  if (match) {
    const op = match[1].toLowerCase()
    const n = match[2]
    if (op.includes('less than or equal')) return `${label} must be ${n} or less`
    if (op.includes('greater than or equal')) {
      if (leafIsOrderLimit(label)) return orderLimitHint(label, n)
      return `${label} must be ${n} or more`
    }
    if (op === 'less than') return `${label} must be less than ${n}`
    return `${label} must be greater than ${n}`
  }

  match = lower.match(/(?:input )?should be (less than or equal to|greater than or equal to|less than|greater than) (\d+)/)
  if (match) {
    const op = match[1]
    const n = match[2]
    if (op.includes('less than or equal')) return `${label} must be ${n} or less`
    if (op.includes('greater than or equal')) {
      if (leafIsOrderLimit(label)) return orderLimitHint(label, n)
      return `${label} must be ${n} or more`
    }
    if (op === 'less than') return `${label} must be less than ${n}`
    return `${label} must be greater than ${n}`
  }

  match = m.match(/^Expected (string|number|boolean)/i)
  if (match) return `Enter a valid ${match[1]} for ${label.toLowerCase()}`

  if (lower.includes('field required') || lower === 'required') return `${label} is required`
  if (/^Invalid/i.test(m)) return m
  if (/^Required/i.test(m)) return `${label} is required`

  return m
}

function leafIsOrderLimit(label: string): boolean {
  const lower = label.toLowerCase()
  return lower.includes('max per order') || lower.includes('min per order')
}

function orderLimitHint(label: string, min: string): string {
  if (label.toLowerCase().includes('max per order')) {
    return `${label}: enter ${min} or more, or leave blank for no limit`
  }
  if (label.toLowerCase().includes('min per order')) {
    return `${label}: enter ${min} or more, or leave blank for no minimum`
  }
  return `${label} must be ${min} or more`
}

/** Humanize a FastAPI/Pydantic validation item for toast / alert copy. */
export function humanizeApiValidationError(fieldPath: string, message: string): string {
  return formatFormFieldError(message, resolveFormFieldLabel(fieldPath))
}
