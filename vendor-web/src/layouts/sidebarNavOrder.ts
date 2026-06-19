const LS_SECTION = 'kiterp.vendor.sidebar.section-ids'
const LS_ITEMS = 'kiterp.vendor.sidebar.item-orders'
/** Ordered `to` paths per section id (links may appear under any visible module). */
const LS_PLACEMENTS_V2 = 'kiterp.vendor.sidebar.nav-placements-v2'

/**
 * Routes that must always appear under a given sidebar section.
 * (Users who customized nav before a link was added often only had it under System Configuration.)
 */
export const NAV_PINNED_SECTION_HOME: Record<string, string> = {
  '/business-front': 'website-management',
  '/websites': 'website-management',
  '/websites/seo': 'website-management',
  '/websites/templates': 'website-management',
  '/blog': 'website-management',
}

/** When pinning, insert after this sibling route when it exists in that section. */
const NAV_PINNED_INSERT_AFTER: Record<string, string> = {
  '/websites': '/business-front',
  '/websites/seo': '/websites',
  '/websites/templates': '/websites/seo',
  '/blog': '/websites/templates',
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

export function loadSectionIds(defaultIds: string[], scope?: NavOrderScope | null): string[] {
  try {
    const key = scopedKey(LS_SECTION, scope)
    const legacyKey = LS_SECTION
    const parsed = readWithLegacyFallback<string[]>(key, legacyKey, (v) => {
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    })
    if (!parsed || !Array.isArray(parsed)) return [...defaultIds]
    const set = new Set(defaultIds)
    const ordered = parsed.filter((id) => set.has(id))
    for (const id of defaultIds) {
      if (!ordered.includes(id)) ordered.push(id)
    }
    return ordered
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
    '/business-front',
    '/websites',
    '/websites/seo',
    '/websites/templates',
    '/blog',
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
        ]
      : [LS_SECTION, LS_ITEMS, LS_PLACEMENTS_V2]
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
