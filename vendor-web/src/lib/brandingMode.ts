import { resolveStorefrontLinkMode } from '@/lib/liveStorefrontUrl'

/**
 * Controls where business-unit logos and banners come from.
 * - `shared`: every unit uses the vendor-level Business Profile branding.
 * - `per_unit`: each unit keeps its own logo / banners (vendor branding is the fallback).
 *
 * This is independent of the storefront link mode — a vendor can share one website
 * but still want per-unit branding, or vice-versa.
 */
export type BrandingMode = 'shared' | 'per_unit'

export const BRANDING_MODE_KEY = 'branding_mode'

/**
 * Read the configured branding mode from vendor settings.
 * When unset, it mirrors the storefront link mode for backward compatibility
 * (single website → shared branding, unique per BU → per-unit branding).
 */
export function resolveBrandingMode(
  settings?: Record<string, unknown> | null,
): BrandingMode {
  const explicit = settings?.[BRANDING_MODE_KEY]
  if (explicit === 'shared' || explicit === 'per_unit') return explicit
  return resolveStorefrontLinkMode(settings) === 'single' ? 'shared' : 'per_unit'
}
