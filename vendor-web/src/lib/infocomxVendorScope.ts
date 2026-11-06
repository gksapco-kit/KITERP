/**
 * InfocomX offer letter + payslip stationery are limited to designated vendors.
 * Defaults match backend: platform HR tenant + `infocomx`.
 * Override with VITE_INFOCOMX_VENDOR_SLUGS (comma-separated), aligned with INFOCOMX_VENDOR_SLUGS on the API.
 */

import { useAuthStore } from '@/stores/authStore'
import { useVendorStore } from '@/stores/vendorStore'

const DEFAULT_SLUGS = 'kiterp-platform,infocomx'

function parseSlugs(raw: string | undefined): Set<string> {
  const s = (raw ?? DEFAULT_SLUGS).trim()
  return new Set(
    s
      .split(',')
      .map(x => x.trim().toLowerCase())
      .filter(Boolean),
  )
}

const ALLOWED = parseSlugs(import.meta.env.VITE_INFOCOMX_VENDOR_SLUGS as string | undefined)

export function mayUseInfocomxHrAssetsForSlug(slug: string | null | undefined): boolean {
  const s = (slug || '').trim().toLowerCase()
  return Boolean(s) && ALLOWED.has(s)
}

/** True when current session vendor slug may use InfocomX layouts / logo paths. */
export function useMayUseInfocomxHrAssets(): boolean {
  const slug = useVendorStore(s => s.vendor?.slug)
  return mayUseInfocomxHrAssetsForSlug(slug)
}

/** Platform staff handoff into vendor-web (embed) — InfocomX tools stay visible there. */
export function isPlatformStaffSession(): boolean {
  return useAuthStore.getState().user?.vendor_role?.role === 'platform_staff'
}
