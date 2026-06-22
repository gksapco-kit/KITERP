import { resolveStorefrontLinkMode } from '@/lib/storefrontTemplateAssignment'

/**
 * Controls where business-unit logos and banners come from.
 * - `shared`: every unit uses the vendor-level Business Profile branding.
 * - `per_unit`: each unit keeps its own logo / banners (vendor branding is the fallback).
 */
export type BrandingMode = 'shared' | 'per_unit'

export const BRANDING_MODE_KEY = 'branding_mode'

/** Read configured branding mode from vendor settings. */
export function resolveBrandingMode(
  settings?: Record<string, unknown> | null,
): BrandingMode {
  const explicit = settings?.[BRANDING_MODE_KEY]
  if (explicit === 'shared' || explicit === 'per_unit') return explicit
  return resolveStorefrontLinkMode(settings) === 'single' ? 'shared' : 'per_unit'
}
