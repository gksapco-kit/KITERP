import { getCustomerStorefrontBaseUrl, getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { readHrModuleSettings } from '@/lib/hrModuleSettings'
import { resolveStorefrontLinkMode } from '@/lib/liveStorefrontUrl'

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

/** Stores that should expose an ESS login link (per-BU scope only; central uses one vendor-wide URL). */
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
  const hr = readHrModuleSettings(settings)
  if (!hr.hr_enabled) return []

  /** Central HR — one shared ESS login for the whole vendor (no branch in URL). */
  if (hr.hr_scope === 'central') {
    return [
      {
        storeId: '__central__',
        code: '',
        name: 'All business units',
        url: buildHrEssLoginUrl(slug),
      },
    ]
  }

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

/** ESS login URL for a unit detail panel — respects central vs per-BU HR scope. */
export function buildHrEssLoginUrlForUnit(
  vendorSlug: string,
  settings: Record<string, unknown> | undefined | null,
  branchCode?: string | null,
): string | null {
  const hr = readHrModuleSettings(settings)
  if (!hr.hr_enabled) return null
  const slug = vendorSlug.trim()
  if (!slug) return null
  if (hr.hr_scope === 'central') return buildHrEssLoginUrl(slug)
  const branch = (branchCode ?? '').trim()
  return branch ? buildHrEssLoginUrl(slug, branch) : null
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

/** Customer store + HR ESS links for clipboard (all-units settings / stores list). */
export function formatAllBusinessFrontLinksForClipboard(
  vendorSlug: string,
  stores: StoreLike[],
  settings?: Record<string, unknown> | undefined | null,
): { text: string; storeCount: number; hrCount: number } {
  const slug = vendorSlug.trim()
  const base = slug ? getCustomerStorefrontBaseUrl(slug) : ''
  const linkMode = resolveStorefrontLinkMode(settings)
  const storeLines = linkMode === 'single'
    ? (base ? ['All business units: ' + base] : [])
    : stores.map((s) => {
        const key = (s.code || s.id).trim()
        const url = base ? `${base}?branch=${encodeURIComponent(key)}` : key
        return `${s.name}: ${url}`
      })
  const hrLinks = buildHrEssLinksForStores(slug, stores, settings)
  const hrLines = hrLinks.map((r) => `${r.name}: ${r.url}`)

  const blocks: string[] = []
  if (storeLines.length) {
    blocks.push('Customer store links', ...storeLines)
  }
  if (hrLines.length) {
    if (blocks.length) blocks.push('')
    blocks.push('HR & employee login', ...hrLines)
  }

  return {
    text: blocks.join('\n'),
    storeCount: storeLines.length,
    hrCount: hrLines.length,
  }
}

export type BusinessFrontLinkRow = {
  id: string
  label: string
  sublabel: string
  url: string
  group: 'store' | 'hr'
}

export function buildBusinessFrontLinkRows(
  vendorSlug: string,
  stores: StoreLike[],
  settings?: Record<string, unknown> | undefined | null,
): { storeRows: BusinessFrontLinkRow[]; hrRows: BusinessFrontLinkRow[] } {
  const slug = vendorSlug.trim()
  const base = slug ? getCustomerStorefrontBaseUrl(slug) : ''
  const linkMode = resolveStorefrontLinkMode(settings)
  const storeRows: BusinessFrontLinkRow[] = linkMode === 'single'
    ? (base
        ? [{
            id: 'store-shared',
            label: 'All business units',
            sublabel: 'Customer store',
            url: base,
            group: 'store' as const,
          }]
        : [])
    : stores.map((s) => {
        const key = (s.code || s.id).trim()
        return {
          id: `store-${s.id}`,
          label: s.name,
          sublabel: 'Customer store',
          url: base ? `${base}?branch=${encodeURIComponent(key)}` : key,
          group: 'store' as const,
        }
      })
  const hrRows: BusinessFrontLinkRow[] = buildHrEssLinksForStores(slug, stores, settings ?? null).map((r) => ({
    id: `hr-${r.storeId}`,
    label: r.code ? `${r.code} — ${r.name}` : r.name,
    sublabel: 'HR & employee login',
    url: r.url,
    group: 'hr' as const,
  }))
  return { storeRows, hrRows }
}
