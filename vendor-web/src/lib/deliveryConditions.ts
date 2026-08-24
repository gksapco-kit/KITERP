export type DeliveryConditionsSettings = {
  enabled: boolean
  free_delivery_threshold: number | null
  minimum_delivery_charge: number | null
  calculate_gst: boolean
}

const DEFAULTS: DeliveryConditionsSettings = {
  enabled: true,
  free_delivery_threshold: null,
  minimum_delivery_charge: null,
  calculate_gst: true,
}

/**
 * Vendor-wide checkout gate (Business Front Display).
 * Top-level settings.sign_in_mandatory wins; falls back to delivery_conditions.
 */
export function readSignInMandatory(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  if (typeof settings?.sign_in_mandatory === 'boolean') {
    return settings.sign_in_mandatory
  }
  const raw = settings?.delivery_conditions
  if (!raw || typeof raw !== 'object') return true
  return (raw as { sign_in_mandatory?: unknown }).sign_in_mandatory !== false
}

export function writeSignInMandatory(
  existingSettings: Record<string, unknown>,
  value: boolean,
): Record<string, unknown> {
  const prev =
    existingSettings.delivery_conditions &&
    typeof existingSettings.delivery_conditions === 'object'
      ? (existingSettings.delivery_conditions as Record<string, unknown>)
      : {}
  return {
    ...existingSettings,
    sign_in_mandatory: value,
    delivery_conditions: {
      ...prev,
      sign_in_mandatory: value,
    },
  }
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
  }
}

export function writeDeliveryConditions(
  existingSettings: Record<string, unknown>,
  next: DeliveryConditionsSettings,
): Record<string, unknown> {
  const prev =
    existingSettings.delivery_conditions &&
    typeof existingSettings.delivery_conditions === 'object'
      ? (existingSettings.delivery_conditions as Record<string, unknown>)
      : {}
  return {
    ...existingSettings,
    delivery_conditions: {
      ...prev,
      enabled: next.enabled,
      free_delivery_threshold: next.free_delivery_threshold,
      minimum_delivery_charge: next.minimum_delivery_charge,
      calculate_gst: next.calculate_gst,
      // Owned by Business Front Display — keep in sync so checkout APIs still read it.
      sign_in_mandatory: readSignInMandatory(existingSettings),
    },
  }
}
