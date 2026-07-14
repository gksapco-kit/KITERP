import { resolveStorefrontLinkMode } from '@/lib/liveStorefrontUrl'

/**
 * Controls where manual UPI checkout settings come from.
 * - `shared`: every unit uses vendor-level UPI Checkout settings.
 * - `per_unit`: each business unit keeps its own UPI (vendor UPI is the fallback).
 */
export type UpiCheckoutMode = 'shared' | 'per_unit'

export const UPI_CHECKOUT_MODE_KEY = 'upi_checkout_mode'

export type ManualUpiSettings = {
  enabled: boolean
  upi_id: string
  qr_code_url: string
  label: string
}

export const EMPTY_MANUAL_UPI: ManualUpiSettings = {
  enabled: false,
  upi_id: '',
  qr_code_url: '',
  label: 'UPI',
}

export function resolveUpiCheckoutMode(
  settings?: Record<string, unknown> | null,
): UpiCheckoutMode {
  const explicit = settings?.[UPI_CHECKOUT_MODE_KEY]
  if (explicit === 'shared' || explicit === 'per_unit') return explicit
  // Default: follow storefront link scope (single → shared, multi → per_unit)
  return resolveStorefrontLinkMode(settings) === 'single' ? 'shared' : 'per_unit'
}

function readManualUpiRaw(raw: unknown): ManualUpiSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  return {
    enabled: Boolean(obj.enabled),
    upi_id: String(obj.upi_id ?? ''),
    qr_code_url: String(obj.qr_code_url ?? ''),
    label: String(obj.label ?? 'UPI') || 'UPI',
  }
}

/** Vendor-level shared UPI from theme_config.checkout.manual_upi */
export function vendorManualUpi(
  themeConfig?: Record<string, unknown> | null,
): ManualUpiSettings {
  const checkout = (themeConfig?.checkout ?? {}) as Record<string, unknown>
  return readManualUpiRaw(checkout.manual_upi) ?? { ...EMPTY_MANUAL_UPI }
}

/** Per-BU UPI from store.settings.manual_upi (null when unset). */
export function storeManualUpi(
  settings?: Record<string, unknown> | null,
): ManualUpiSettings | null {
  return readManualUpiRaw(settings?.manual_upi)
}

/** Whether the store has its own UPI override (even if disabled). */
export function storeHasManualUpiOverride(
  settings?: Record<string, unknown> | null,
): boolean {
  const raw = settings?.manual_upi
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw))
}

export function resolveManualUpi(input: {
  mode: UpiCheckoutMode
  themeConfig?: Record<string, unknown> | null
  storeSettings?: Record<string, unknown> | null
}): ManualUpiSettings {
  const shared = vendorManualUpi(input.themeConfig)
  if (input.mode !== 'per_unit') return shared
  const override = storeManualUpi(input.storeSettings)
  return override ?? shared
}

export function toManualUpiPayload(form: ManualUpiSettings) {
  return {
    enabled: form.enabled,
    upi_id: form.upi_id.trim() || null,
    qr_code_url: form.qr_code_url.trim() || null,
    label: form.label.trim() || 'UPI',
  }
}
