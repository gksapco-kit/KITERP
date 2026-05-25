const LS_SECTION = 'kiterp.vendor.sidebar.section-ids'
const LS_ITEMS = 'kiterp.vendor.sidebar.item-orders'
/** Ordered `to` paths per section id (links may appear under any visible module). */
const LS_PLACEMENTS_V2 = 'kiterp.vendor.sidebar.nav-placements-v2'

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
  return out
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
