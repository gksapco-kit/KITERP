export type DeliveryConditionsSettings = {
  enabled: boolean
  free_delivery_threshold: number | null
  minimum_delivery_charge: number | null
  calculate_gst: boolean | null
  /** When true, guests must sign in before checkout / Buy Now. */
  sign_in_mandatory: boolean
}

const DEFAULTS: DeliveryConditionsSettings = {
  enabled: true,
  free_delivery_threshold: null,
  minimum_delivery_charge: null,
  calculate_gst: null,
  sign_in_mandatory: false,
}

function parsePositiveNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function readDeliveryConditions(
  settings: Record<string, unknown> | null | undefined,
): DeliveryConditionsSettings {
  const raw = settings?.delivery_conditions
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }

  const obj = raw as Record<string, unknown>
  const thresholdRaw = obj.free_delivery_threshold ?? obj.min_order_amount
  const calculateGst =
    obj.calculate_gst === true
      ? true
      : obj.calculate_gst === false
        ? false
        : null

  return {
    enabled: obj.enabled !== false,
    free_delivery_threshold: parsePositiveNumber(thresholdRaw),
    minimum_delivery_charge: parsePositiveNumber(
      obj.minimum_delivery_charge ?? obj.min_delivery_charge,
    ),
    calculate_gst: calculateGst,
    sign_in_mandatory: obj.sign_in_mandatory === true,
  }
}

/** True when vendor requires customers to sign in before checkout / Buy Now. */
export function isSignInMandatory(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return readDeliveryConditions(settings).sign_in_mandatory
}

export function shouldCalculateGst(
  settings: Record<string, unknown> | null | undefined,
  isGstRegistered?: boolean,
): boolean {
  const conditions = readDeliveryConditions(settings)
  if (conditions.calculate_gst === false) return false
  if (conditions.calculate_gst === true) return true
  return Boolean(isGstRegistered)
}

export function resolveDeliveryCharge(
  settings: Record<string, unknown> | null | undefined,
  subtotal: number,
  fallbackCharge = 0,
): { shippingAmount: number; freeDeliveryApplied: boolean } {
  const conditions = readDeliveryConditions(settings)
  if (!conditions.enabled) {
    return { shippingAmount: fallbackCharge, freeDeliveryApplied: false }
  }

  const threshold = conditions.free_delivery_threshold
  if (threshold != null && threshold > 0 && subtotal >= threshold) {
    return { shippingAmount: 0, freeDeliveryApplied: true }
  }

  if (conditions.minimum_delivery_charge != null) {
    return { shippingAmount: conditions.minimum_delivery_charge, freeDeliveryApplied: false }
  }

  return { shippingAmount: fallbackCharge, freeDeliveryApplied: false }
}

type CartLine = { product_id?: string; price: number; qty: number; name?: string }
type ProductTaxInfo = { tax_rate?: number; gst_rate?: number }

export function computeCartTaxAmount(
  items: CartLine[],
  productMap: Record<string, ProductTaxInfo | undefined>,
  settings: Record<string, unknown> | null | undefined,
  isGstRegistered?: boolean,
  defaultTaxRate?: number,
): { taxAmount: number; taxLabel: string | null } {
  if (!shouldCalculateGst(settings, isGstRegistered)) {
    return { taxAmount: 0, taxLabel: null }
  }

  const defaultRate = Number(defaultTaxRate ?? 0)
  let taxTotal = 0
  let primaryRate: number | null = null

  for (const item of items) {
    const product = item.product_id ? productMap[item.product_id] : undefined
    const rate = Number(product?.tax_rate ?? product?.gst_rate ?? defaultRate)
    if (rate <= 0) continue
    primaryRate ??= rate
    taxTotal += (item.price * item.qty * rate) / 100
  }

  const taxAmount = Math.round(taxTotal * 100) / 100
  return {
    taxAmount,
    taxLabel: taxAmount > 0 ? `GST (${primaryRate ?? defaultRate}%)` : null,
  }
}
