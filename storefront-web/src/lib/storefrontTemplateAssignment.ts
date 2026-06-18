import type { StoreLocation } from '@/api/store'

export const STOREFRONT_LINK_MODE_KEY = 'storefront_link_mode'
export const STOREFRONT_TEMPLATE_MODE_KEY = 'storefront_template_mode'
export const SINGLE_FRONT_TEMPLATE_KEY = 'single_front_template_id'
export const STORE_FRONT_TEMPLATE_KEY = 'front_template_id'

export type StorefrontLinkMode = 'single' | 'per_unit'
export type StorefrontTemplateMode = 'single' | 'per_unit'

/** Default business-front layouts rendered by legacy Home.tsx. */
export const DEFAULT_LAYOUT_TEMPLATE_IDS = ['light', 'dark'] as const

/** Legacy theme ids still applied inside Home.tsx section styling. */
export const LEGACY_HOME_TEMPLATE_IDS = ['light', 'dark', 'atelier', 'verde', 'solace'] as const

/**
 * storefront_* templates backed by WEBSITE_TEMPLATES blocks (BlockRenderer),
 * not the legacy React shells in CatalogStorefrontLiveHome.
 */
export const BLOCK_BASED_STOREFRONT_TEMPLATE_IDS = ['storefront_grocery', 'storefront_supermarket'] as const

function branchKey(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

export function matchBranchStore(
  stores: StoreLocation[],
  code: string | null | undefined,
): StoreLocation | null {
  const key = branchKey(code)
  if (!key) return null
  return stores.find(s => branchKey(s.code) === key || branchKey(s.id) === key) ?? null
}

export function resolveStorefrontLinkMode(
  settings?: Record<string, unknown> | null,
): StorefrontLinkMode {
  return settings?.[STOREFRONT_LINK_MODE_KEY] === 'single' ? 'single' : 'per_unit'
}

export function resolveStorefrontTemplateMode(
  settings?: Record<string, unknown> | null,
): StorefrontTemplateMode {
  const explicit = settings?.[STOREFRONT_TEMPLATE_MODE_KEY]
  if (explicit === 'per_unit' || explicit === 'single') return explicit
  return resolveStorefrontLinkMode(settings) === 'single' ? 'single' : 'per_unit'
}

export function resolveSingleFrontTemplateId(
  settings?: Record<string, unknown> | null,
): string | null {
  const raw = settings?.[SINGLE_FRONT_TEMPLATE_KEY]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

export function resolveStoreFrontTemplateId(
  storeSettings?: Record<string, unknown> | null,
): string | null {
  const raw = storeSettings?.[STORE_FRONT_TEMPLATE_KEY]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

export function resolveEffectiveStorefrontTemplateId(
  vendorSettings: Record<string, unknown> | null | undefined,
  storeSettings: Record<string, unknown> | null | undefined,
  templateMode: StorefrontTemplateMode,
): string | null {
  if (templateMode === 'single') {
    return resolveSingleFrontTemplateId(vendorSettings)
  }
  return resolveStoreFrontTemplateId(storeSettings) ?? resolveSingleFrontTemplateId(vendorSettings)
}

export function resolveAssignedStorefrontTemplateId(
  vendorSettings: Record<string, unknown> | null | undefined,
  stores: StoreLocation[],
  branchCode: string | null | undefined,
  options?: { branchesLoading?: boolean },
): string | null {
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)

  if (templateMode === 'single') {
    return resolveSingleFrontTemplateId(vendorSettings)
  }

  const branchKeyValue = branchKey(branchCode)
  if (branchKeyValue) {
    if (options?.branchesLoading) {
      return null
    }
    const branchStore = matchBranchStore(stores, branchCode)
    if (!branchStore) {
      return null
    }
    const storeTemplate = resolveStoreFrontTemplateId(
      branchStore.settings as Record<string, unknown>,
    )
    if (storeTemplate) {
      return storeTemplate
    }
    // Branch has no override — use vendor-wide assignment instead of legacy Home.
    return resolveSingleFrontTemplateId(vendorSettings)
  }

  return resolveSingleFrontTemplateId(vendorSettings)
}

/**
 * Catalog/legacy template explicitly assigned to a branch (or shared in single mode).
 * Does NOT include the vendor-wide `single_front_template_id` fallback in per_unit mode —
 * mirrors backend `_store_specific_template_id` so a linked builder site can win.
 */
export function resolveStoreSpecificAssignedTemplateId(
  vendorSettings: Record<string, unknown> | null | undefined,
  stores: StoreLocation[],
  branchCode: string | null | undefined,
  options?: { branchesLoading?: boolean },
): string | null {
  const templateMode = resolveStorefrontTemplateMode(vendorSettings)

  if (templateMode === 'single') {
    return resolveSingleFrontTemplateId(vendorSettings)
  }

  const branchKeyValue = branchKey(branchCode)
  if (!branchKeyValue) return null
  if (options?.branchesLoading) return null

  const branchStore = matchBranchStore(stores, branchCode)
  if (!branchStore) return null

  return resolveStoreFrontTemplateId(branchStore.settings as Record<string, unknown>)
}

/** True while the per-BU assigned template cannot be resolved yet (avoid wrong fallback UI). */
export function isAssignedStorefrontTemplatePending(
  vendorSettings: Record<string, unknown> | null | undefined,
  branchCode: string | null | undefined,
  branchesLoading: boolean,
): boolean {
  if (!branchCode?.trim()) return false
  return resolveStorefrontTemplateMode(vendorSettings) === 'per_unit' && branchesLoading
}

export function isBlockBasedStorefrontTemplateId(id: string | null | undefined): boolean {
  return typeof id === 'string'
    && (BLOCK_BASED_STOREFRONT_TEMPLATE_IDS as readonly string[]).includes(id)
}

/** Legacy React storefront shells (Fashion, Electronics, …) — not block-based Wellness Store. */
export function isStorefrontCatalogTemplateId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('storefront_') && !isBlockBasedStorefrontTemplateId(id)
}

export function isLegacyHomeTemplateId(id: string | null | undefined): boolean {
  return typeof id === 'string' && (LEGACY_HOME_TEMPLATE_IDS as readonly string[]).includes(id)
}

export function isDefaultLayoutTemplateId(id: string | null | undefined): boolean {
  return typeof id === 'string' && (DEFAULT_LAYOUT_TEMPLATE_IDS as readonly string[]).includes(id)
}

/** Website builder catalog templates (portfolio, verde, storefront_grocery, …) — block-based, not legacy Home. */
export function isWebsiteBuilderBlockTemplateId(id: string | null | undefined): boolean {
  if (!id?.trim()) return false
  if (isBlockBasedStorefrontTemplateId(id)) return true
  if (isDefaultLayoutTemplateId(id)) return false
  if (isStorefrontCatalogTemplateId(id)) return false
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false
  return true
}

export function resolveLiveCatalogTemplateId(
  assignedId: string | null | undefined,
  wbCatalogId: string | null | undefined,
): string {
  if (assignedId && isStorefrontCatalogTemplateId(assignedId)) return assignedId
  if (wbCatalogId) return wbCatalogId
  return 'storefront_services'
}
