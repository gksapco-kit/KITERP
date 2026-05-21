import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { readHrModuleSettings } from '@/lib/hrModuleSettings'

export type HrEssLinkRow = {
  storeId: string
  code: string
  name: string
  url: string
}

/** Business front employee login URL; optional `branch` = store code for outlet-pinned ESS. */
export function buildHrEssLoginUrl(vendorSlug: string, branchCode?: string | null): string {
  const slug = vendorSlug.trim()
  const origin = getStorefrontAppOrigin()
  const base = `${origin}/store/${encodeURIComponent(slug)}/hr/login`
  const branch = (branchCode ?? '').trim()
  return branch ? `${base}?branch=${encodeURIComponent(branch)}` : base
}

type StoreLike = { id: string; code?: string | null; name: string }

/** Stores that should expose an ESS login link (central = every unit; per-BU = selected only). */
export function storesEligibleForHrEss(
  stores: StoreLike[],
  settings: Record<string, unknown> | undefined | null,
): StoreLike[] {
  const hr = readHrModuleSettings(settings)
  if (!hr.hr_enabled) return []
  if (hr.hr_scope === 'central') return stores
  const ids = new Set(hr.hr_business_unit_ids)
  return stores.filter((s) => ids.has(s.id))
}

export function buildHrEssLinksForStores(
  vendorSlug: string,
  stores: StoreLike[],
  settings: Record<string, unknown> | undefined | null,
): HrEssLinkRow[] {
  const slug = vendorSlug.trim()
  if (!slug) return []
  return storesEligibleForHrEss(stores, settings).map((s) => {
    const code = (s.code ?? s.id).trim()
    return {
      storeId: s.id,
      code,
      name: s.name,
      url: buildHrEssLoginUrl(slug, code),
    }
  })
}

/** Whether a single business unit should show its ESS link in detail panels. */
export function isHrEssLinkVisibleForStore(
  storeId: string,
  settings: Record<string, unknown> | undefined | null,
): boolean {
  const hr = readHrModuleSettings(settings)
  if (!hr.hr_enabled) return false
  if (hr.hr_scope === 'central') return true
  return hr.hr_business_unit_ids.includes(storeId)
}
