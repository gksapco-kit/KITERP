export type DeliveryConditionsSettings = {
  enabled: boolean
  free_delivery_threshold: number | null
  minimum_delivery_charge: number | null
  calculate_gst: boolean
  /** When true, guests must sign in before checkout / Buy Now. */
  sign_in_mandatory: boolean
}

const DEFAULTS: DeliveryConditionsSettings = {
  enabled: true,
  free_delivery_threshold: null,
  minimum_delivery_charge: null,
  calculate_gst: true,
  sign_in_mandatory: false,
}

function parseOptionalNumber(value: unknown, allowZero = false): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (allowZero) return parsed >= 0 ? parsed : null
  return parsed > 0 ? parsed : null
}

export function readDeliveryConditions(
  settings: Record<string, unknown> | null | undefined,
): DeliveryConditionsSettings {
  const raw = settings?.delivery_conditions
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }

  const obj = raw as Record<string, unknown>
  const thresholdRaw = obj.free_delivery_threshold ?? obj.min_order_amount

  return {
    enabled: obj.enabled !== false,
    free_delivery_threshold: parseOptionalNumber(thresholdRaw),
    minimum_delivery_charge: parseOptionalNumber(
      obj.minimum_delivery_charge ?? obj.min_delivery_charge,
      true,
    ),
    calculate_gst: obj.calculate_gst !== false,
    sign_in_mandatory: obj.sign_in_mandatory === true,
  }
}

export function writeDeliveryConditions(
  existingSettings: Record<string, unknown>,
  next: DeliveryConditionsSettings,
): Record<string, unknown> {
  return {
    ...existingSettings,
    delivery_conditions: {
      enabled: next.enabled,
      free_delivery_threshold: next.free_delivery_threshold,
      minimum_delivery_charge: next.minimum_delivery_charge,
      calculate_gst: next.calculate_gst,
      sign_in_mandatory: next.sign_in_mandatory,
    },
  }
}
