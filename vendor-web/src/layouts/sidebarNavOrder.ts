const LS_SECTION = 'kiterp.vendor.sidebar.section-ids'
const LS_ITEMS = 'kiterp.vendor.sidebar.item-orders'
/** Ordered `to` paths per section id (links may appear under any visible module). */
const LS_PLACEMENTS_V2 = 'kiterp.vendor.sidebar.nav-placements-v2'
const LS_SECTION_VERSION = 'kiterp.vendor.sidebar.section-order-version'

/**
 * Bump when the built-in top-level module order changes.
 * Users below this version get the canonical order on next load (fixes stale prod localStorage).
 */
export const SIDEBAR_SECTION_ORDER_VERSION = 4

/** Canonical module order — must match `allSections` in DashboardLayout.tsx. */
export const CANONICAL_SIDEBAR_SECTION_IDS = [
  'my-kit',
  'website-management',
  'sales',
  'inventory',
  'master-data',
  'crm',
  'rental',
  'production',
  'pharma',
  'restaurant',
  'commission',
  'procurement',
  'finance',
  'controlling',
  'hr',
  'system',
] as const

/**
 * Routes that must always appear under a given sidebar section.
 * (Users who customized nav before a link was added often only had it under System Configuration.)
 */
export const NAV_PINNED_SECTION_HOME: Record<string, string> = {
  '/websites': 'website-management',
  '/websites/seo': 'website-management',
  '/websites/analytics': 'website-management',
  '/websites/templates': 'website-management',
  '/system/storefront-display': 'website-management',
  '/system/social-links': 'website-management',
  '/blog': 'website-management',
  '/queries': 'my-kit',
  '/purchase-orders': 'procurement',
  '/procurement/goods': 'inventory',
  '/rental/dashboard': 'rental',
  '/rental/assets': 'rental',
  '/rental/bookings': 'rental',
  '/rental/calendar': 'rental',
  '/rental/returns': 'rental',
  '/rental/reports': 'rental',
  '/rental/registration-forms': 'rental',
  '/rental/settings': 'rental',
  '/system/messages': 'system',
  '/crm/integrations': 'system',
  '/team': 'system',
  '/roles': 'system',
  '/system/upi-checkout': 'system',
  '/crm/sales-area-dues': 'sales',
}

/** When pinning, insert after this sibling route when it exists in that section. */
const NAV_PINNED_INSERT_AFTER: Record<string, string> = {
  '/websites/templates': '/websites',
  '/system/storefront-display': '/websites/templates',
  '/system/social-links': '/system/storefront-display',
  '/blog': '/system/social-links',
  '/websites/seo': '/blog',
  '/websites/analytics': '/websites/seo',
  '/system/messages': '/crm/integrations',
  '/crm/integrations': '/system/modules',
  '/team': '/system/browse-table',
  '/roles': '/team',
  '/system/upi-checkout': '/roles',
  '/system/assets/images': '/system/upi-checkout',
  '/procurement/goods': '/storage-locations',
  '/crm/sales-area-dues': '/sales/sales-area',
}

/** When pinning, insert before this sibling route (wins over INSERT_AFTER when both resolve). */
const NAV_PINNED_INSERT_BEFORE: Record<string, string> = {
  '/queries': '/relationship-manager',
  '/purchase-orders': '/procurement/requisitions',
}

export type NavOrderScope = {
  userId: string
  roleKey: string
}

function scopedKey(base: string, scope: NavOrderScope | null | undefined): string {
  if (!scope?.userId) return base
  const role = scope.roleKey || 'member'
  return `${base}.${scope.userId}.${role}`
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Prefer scoped storage; fall back to legacy unscoped keys once per scope. */
function readWithLegacyFallback<T>(
  scoped: string,
  legacy: string,
  migrate: (value: T) => void,
): T | null {
  const hit = readJson<T>(scoped)
  if (hit != null) return hit
  const old = readJson<T>(legacy)
  if (old != null) {
    migrate(old)
    return old
  }
  return null
}

function readSectionOrderVersion(scope?: NavOrderScope | null): number {
  try {
    const raw = localStorage.getItem(scopedKey(LS_SECTION_VERSION, scope))
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeSectionOrderVersion(scope?: NavOrderScope | null) {
  try {
    localStorage.setItem(
      scopedKey(LS_SECTION_VERSION, scope),
      String(SIDEBAR_SECTION_ORDER_VERSION),
    )
  } catch {
    /* ignore */
  }
}

/** Insert modules missing from saved order at their canonical index (not at the end). */
function mergeMissingSectionsAtCanonicalPositions(saved: string[], defaultIds: string[]): string[] {
  const defaultSet = new Set(defaultIds)
  let order = saved.filter((id) => defaultSet.has(id))
  const missing = defaultIds.filter((id) => !order.includes(id))
  for (const id of missing) {
    const canonicalIdx = defaultIds.indexOf(id)
    let insertAt = order.length
    for (let i = canonicalIdx - 1; i >= 0; i--) {
      const prevIdx = order.indexOf(defaultIds[i])
      if (prevIdx >= 0) {
        insertAt = prevIdx + 1
        break
      }
    }
    order = [...order.slice(0, insertAt), id, ...order.slice(insertAt)]
  }
  return order
}

export function loadSectionIds(defaultIds: string[], scope?: NavOrderScope | null): string[] {
  try {
    const storedVersion = readSectionOrderVersion(scope)
    const needsCanonicalReset = storedVersion < SIDEBAR_SECTION_ORDER_VERSION

    if (needsCanonicalReset) {
      const order = [...defaultIds]
      saveSectionIds(order, scope)
      writeSectionOrderVersion(scope)
      return order
    }

    const key = scopedKey(LS_SECTION, scope)
    const legacyKey = LS_SECTION
    const parsed = readWithLegacyFallback<string[]>(key, legacyKey, (v) => {
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    })
    if (!parsed || !Array.isArray(parsed)) {
      writeSectionOrderVersion(scope)
      return [...defaultIds]
    }

    const merged = mergeMissingSectionsAtCanonicalPositions(parsed, defaultIds)
    if (merged.length !== parsed.length || merged.some((id, i) => id !== parsed[i])) {
      saveSectionIds(merged, scope)
    }
    writeSectionOrderVersion(scope)
    return merged
  } catch {
    return [...defaultIds]
  }
}

export function saveSectionIds(ids: string[], scope?: NavOrderScope | null) {
  try {
    localStorage.setItem(scopedKey(LS_SECTION, scope), JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function loadItemOrders(scope?: NavOrderScope | null): Record<string, string[]> {
  try {
    const key = scopedKey(LS_ITEMS, scope)
    const o = readWithLegacyFallback<Record<string, string[]>>(key, LS_ITEMS, (v) => {
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    })
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

export function saveItemOrders(orders: Record<string, string[]>, scope?: NavOrderScope | null) {
  try {
    localStorage.setItem(scopedKey(LS_ITEMS, scope), JSON.stringify(orders))
  } catch {
    /* ignore */
  }
}

/** Apply saved `to` order; unknown keys keep file order at end. */
export function orderNavItemsByTo<T extends { to: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order?.length) return items
  const m = new Map(items.map((i) => [i.to, i]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const k of order) {
    const it = m.get(k)
    if (it) {
      out.push(it)
      seen.add(k)
    }
  }
  for (const it of items) {
    if (!seen.has(it.to)) out.push(it)
  }
  return out
}

export function orderSectionsById<T extends { id: string }>(sections: T[], order: string[]): T[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const s = byId.get(id)
    if (s) {
      out.push(s)
      seen.add(id)
    }
  }
  for (const s of sections) {
    if (!seen.has(s.id)) out.push(s)
  }
  return out
}

/** Canonical file order: each section lists its own `to` keys in definition order. */
export function buildDefaultPlacementsFromSections(
  sections: { id: string; items: { to: string }[] }[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of sections) {
    out[s.id] = s.items.map((i) => i.to)
  }
  return out
}

function migrateLegacyItemOrdersToPlacements(
  sections: { id: string; items: { to: string }[] }[],
  legacy: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of sections) {
    const ordered = orderNavItemsByTo(s.items, legacy[s.id])
    out[s.id] = ordered.map((i) => i.to)
  }
  return out
}

/**
 * Keep placements consistent with visible nav: drop invalid `to`, assign each visible route exactly once
 * (preserve non-canonical grouping from `prev` when still valid).
 */
export function reconcileNavPlacements(
  prev: Record<string, string[]>,
  sections: { id: string; items: { to: string }[] }[],
): Record<string, string[]> {
  const validTos = new Set<string>()
  const home = new Map<string, string>()
  for (const s of sections) {
    for (const it of s.items) {
      validTos.add(it.to)
      home.set(it.to, s.id)
    }
  }
  const out: Record<string, string[]> = {}
  for (const s of sections) out[s.id] = []
  const assigned = new Set<string>()

  for (const s of sections) {
    for (const to of prev[s.id] ?? []) {
      if (!validTos.has(to) || assigned.has(to)) continue
      out[s.id].push(to)
      assigned.add(to)
    }
  }
  for (const to of validTos) {
    if (assigned.has(to)) continue
    const sid = home.get(to)
    if (sid) out[sid].push(to)
  }

  for (const [to, homeId] of Object.entries(NAV_PINNED_SECTION_HOME)) {
    if (!validTos.has(to)) continue
    for (const sid of Object.keys(out)) {
      out[sid] = out[sid].filter((t) => t !== to)
    }
    if (!out[homeId]) out[homeId] = []
    if (out[homeId].includes(to)) continue
    const before = NAV_PINNED_INSERT_BEFORE[to]
    const beforeIdx = before ? out[homeId].indexOf(before) : -1
    if (beforeIdx >= 0) {
      out[homeId].splice(beforeIdx, 0, to)
      continue
    }
    const after = NAV_PINNED_INSERT_AFTER[to]
    const afterIdx = after ? out[homeId].indexOf(after) : -1
    if (afterIdx >= 0) {
      out[homeId].splice(afterIdx + 1, 0, to)
    } else {
      out[homeId].push(to)
    }
  }

  // Website routes always live under Website Management (avoids losing items after drag-and-drop).
  const websiteManagementOrder = [
    '/websites',
    '/websites/templates',
    '/system/storefront-display',
    '/system/social-links',
    '/blog',
    '/websites/seo',
    '/websites/analytics',
  ]
  const websiteManagementRoutes = websiteManagementOrder.filter((to) => validTos.has(to))
  if (websiteManagementRoutes.length && out['website-management']) {
    for (const sid of Object.keys(out)) {
      if (sid === 'website-management') continue
      out[sid] = out[sid].filter((to) => !websiteManagementOrder.includes(to))
    }
    out['website-management'] = websiteManagementRoutes
  }

  // Restaurant ops routes always live under the Restaurant section (avoids losing items after drag-and-drop).
  const restaurantOrder = [
    '/restaurant/floor',
    '/restaurant/kitchen',
    '/restaurant/menu',
    '/restaurant/reservations',
    '/restaurant/reports',
    '/restaurant/setup',
    '/restaurant/outlets',
    '/restaurant/pos',
  ]
  const restaurantRoutes = [...validTos].filter((to) => to.startsWith('/restaurant/'))
  if (restaurantRoutes.length && out.restaurant) {
    for (const sid of Object.keys(out)) {
      if (sid === 'restaurant') continue
      out[sid] = out[sid].filter((to) => !to.startsWith('/restaurant/'))
    }
    const ordered = restaurantOrder.filter((to) => restaurantRoutes.includes(to))
    const rest = restaurantRoutes.filter((to) => !ordered.includes(to))
    out.restaurant = [...ordered, ...rest]
  }

  // Asset Accounting routes stay together under Finance (new links were landing at section end).
  const assetAccountingOrder = [
    '/finance/assets',
    '/finance/assets/reports',
    '/finance/assets/depreciation-schedule',
    '/finance/assets/gl-reconciliation',
  ]
  const assetAccountingRoutes = assetAccountingOrder.filter((to) => validTos.has(to))
  if (assetAccountingRoutes.length && out.finance) {
    for (const sid of Object.keys(out)) {
      out[sid] = out[sid].filter((to) => !assetAccountingOrder.includes(to))
    }
    const list = out.finance
    const budgetsIdx = list.indexOf('/finance/budgets')
    const bankIdx = list.indexOf('/finance/bank')
    const insertAt =
      budgetsIdx >= 0 ? budgetsIdx : bankIdx >= 0 ? bankIdx + 1 : list.length
    out.finance = [
      ...list.slice(0, insertAt),
      ...assetAccountingRoutes,
      ...list.slice(insertAt),
    ]
  }

  // Sales Management routes keep canonical grouped order.
  const salesManagementOrder = [
    '/sales/manager',
    '/orders',
    '/quotations',
    '/bookings',
    '/sales/delivery-conditions',
    '/projects',
    '/pos',
    '/subscriptions',
    '/sales/plans',
    '/sales/recurring-bookings',
    '/invoices',
    '/memos',
    '/coupons',
    '/rental',
    '/sales/properties',
    '/sales/courses',
    '/sales/fitness-classes',
    '/sales/vehicles',
    '/sales/events',
    '/sales/coverage',
    '/sales/sales-area',
    '/crm/sales-area-dues',
    '/marketplace',
    '/sales/testimonials',
  ]
  const salesRoutes = [...validTos].filter((to) => home.get(to) === 'sales')
  if (salesRoutes.length && out.sales) {
    const ordered = salesManagementOrder.filter((to) => salesRoutes.includes(to))
    const rest = salesRoutes.filter((to) => !ordered.includes(to))
    out.sales = [...ordered, ...rest]
  }

  // Production routes always live under Production Management (avoids losing items after drag-and-drop).
  const productionOrder = [
    '/production',
    '/production/schedule',
    '/production/work-centers',
    '/production/mrp',
    '/production/analytics',
  ]
  const productionRoutes = productionOrder.filter((to) => validTos.has(to))
  if (productionRoutes.length && out.production) {
    for (const sid of Object.keys(out)) {
      if (sid === 'production') continue
      out[sid] = out[sid].filter((to) => !productionOrder.includes(to))
    }
    out.production = productionRoutes
  }

  // Pharmaceutical Manufacturing routes stay under Pharma.
  const pharmaOrder = [
    '/pharma',
    '/pharma/settings',
    '/pharma/batches',
    '/pharma/movements',
    '/pharma/fefo',
    '/pharma/quarantine',
    '/pharma/mbr',
    '/pharma/bpr',
    '/pharma/qc-specs',
    '/pharma/inspections',
    '/pharma/release',
    '/pharma/genealogy',
    '/pharma/recalls',
    '/pharma/deviations',
    '/pharma/capas',
    '/pharma/change-control',
    '/pharma/complaints',
    '/pharma/audit',
    '/pharma/serialization',
    '/pharma/gdp',
    '/pharma/wholesale-license',
    '/pharma/track-trace',
  ]
  const pharmaRoutes = [...validTos].filter((to) => to === '/pharma' || to.startsWith('/pharma/'))
  if (pharmaRoutes.length && out.pharma) {
    for (const sid of Object.keys(out)) {
      if (sid === 'pharma') continue
      out[sid] = out[sid].filter((to) => to !== '/pharma' && !to.startsWith('/pharma/'))
    }
    const ordered = pharmaOrder.filter((to) => pharmaRoutes.includes(to))
    const rest = pharmaRoutes.filter((to) => !ordered.includes(to))
    out.pharma = [...ordered, ...rest]
  }

  // Controlling (CO) routes keep canonical order (Integration before Cost Centres, etc.).
  const controllingOrder = [
    '/controlling',
    '/controlling/controlling-areas',
    '/controlling/finance-integration',
    '/controlling/cost-centers',
    '/controlling/activity-types',
    '/controlling/product-costs',
    '/controlling/routing',
    '/controlling/setup',
    '/controlling/orders',
    '/controlling/orders?kind=assembly',
    '/controlling/orders?kind=process',
    '/controlling/internal-orders',
    '/controlling/production-process',
    '/controlling/goods-movements',
    '/controlling/activity-confirmations',
    '/controlling/cost-bookings',
    '/controlling/wip',
    '/controlling/variance-analysis',
    '/controlling/internal-cost',
    '/controlling/cost-allocations',
    '/controlling/period-end',
  ]
  const controllingRoutes = [...validTos].filter((to) => home.get(to) === 'controlling')
  if (controllingRoutes.length && out.controlling) {
    const ordered = controllingOrder.filter((to) => controllingRoutes.includes(to))
    const rest = controllingRoutes.filter((to) => !ordered.includes(to))
    out.controlling = [...ordered, ...rest]
  }

  // System Configuration routes keep canonical order (Create Messages before Database group).
  const systemConfigurationOrder = [
    '/document-templates',
    '/system/modules',
    '/crm/integrations',
    '/system/messages',
    '/system/models',
    '/system/table-data',
    '/system/browse-table',
    '/team',
    '/roles',
    '/system/upi-checkout',
    '/system/assets/images',
  ]
  const systemRoutes = [...validTos].filter((to) => home.get(to) === 'system')
  if (systemRoutes.length && out.system) {
    const ordered = systemConfigurationOrder.filter((to) => systemRoutes.includes(to))
    const rest = systemRoutes.filter((to) => !ordered.includes(to))
    out.system = [...ordered, ...rest]
  }

  return out
}

/** Render-time safety: inject pinned routes if placements still omit them. */
export function ensurePinnedNavItemsInSection<T extends { to: string }>(
  sectionId: string,
  items: T[],
  catalog: Map<string, T>,
): T[] {
  let next = items
  for (const [to, homeId] of Object.entries(NAV_PINNED_SECTION_HOME)) {
    if (sectionId !== homeId) continue
    const item = catalog.get(to)
    if (!item || next.some((i) => i.to === to)) continue
    const after = NAV_PINNED_INSERT_AFTER[to]
    const afterIdx = after ? next.findIndex((i) => i.to === after) : -1
    if (afterIdx >= 0) {
      next = [...next.slice(0, afterIdx + 1), item, ...next.slice(afterIdx + 1)]
    } else {
      next = [...next, item]
    }
  }
  return next
}

/** Load v2 placements, or migrate from legacy per-section order (same-module only). */
export function loadNavPlacementsState(
  sections: { id: string; items: { to: string }[] }[],
  scope?: NavOrderScope | null,
): Record<string, string[]> {
  try {
    const key = scopedKey(LS_PLACEMENTS_V2, scope)
    const raw = readWithLegacyFallback<Record<string, string[]>>(key, LS_PLACEMENTS_V2, (v) => {
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    })
    if (raw && typeof raw === 'object') return reconcileNavPlacements(raw, sections)
  } catch {
    /* fall through */
  }
  const legacy = loadItemOrders(scope)
  const migrated = migrateLegacyItemOrdersToPlacements(sections, legacy)
  return reconcileNavPlacements(migrated, sections)
}

export function saveNavPlacementsState(p: Record<string, string[]>, scope?: NavOrderScope | null) {
  try {
    localStorage.setItem(scopedKey(LS_PLACEMENTS_V2, scope), JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** Clear persisted sidebar order so the next load uses built-in defaults. */
export function clearSavedNavOrder(scope?: NavOrderScope | null) {
  try {
    const keys = scope
      ? [
          scopedKey(LS_SECTION, scope),
          scopedKey(LS_ITEMS, scope),
          scopedKey(LS_PLACEMENTS_V2, scope),
          scopedKey(LS_SECTION_VERSION, scope),
        ]
      : [LS_SECTION, LS_ITEMS, LS_PLACEMENTS_V2, LS_SECTION_VERSION]
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

/** Nav subgroups that start collapsed until the user expands them (or navigates to a child route). */
export const DEFAULT_COLLAPSED_NAV_GROUPS: Record<string, boolean> = {
  'Sales Management:Industry Catalogs': true,
}

export function resolveNavGroupCollapsed(
  grpKey: string,
  collapsedGroups: Record<string, boolean>,
): boolean {
  if (grpKey in collapsedGroups) return collapsedGroups[grpKey]
  return DEFAULT_COLLAPSED_NAV_GROUPS[grpKey] ?? false
}

export { RESET_USER_NAV_ORDER_EVENT } from '@/lib/userNavOrder'
