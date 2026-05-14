const LS_SECTION = 'kiterp.vendor.sidebar.section-ids'
const LS_ITEMS = 'kiterp.vendor.sidebar.item-orders'
/** Ordered `to` paths per section id (links may appear under any visible module). */
const LS_PLACEMENTS_V2 = 'kiterp.vendor.sidebar.nav-placements-v2'

export function loadSectionIds(defaultIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(LS_SECTION)
    if (!raw) return [...defaultIds]
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return [...defaultIds]
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

export function saveSectionIds(ids: string[]) {
  try {
    localStorage.setItem(LS_SECTION, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function loadItemOrders(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LS_ITEMS)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, string[]>
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

export function saveItemOrders(orders: Record<string, string[]>) {
  try {
    localStorage.setItem(LS_ITEMS, JSON.stringify(orders))
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
export function loadNavPlacementsState(sections: { id: string; items: { to: string }[] }[]): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LS_PLACEMENTS_V2)
    if (raw) {
      const o = JSON.parse(raw) as Record<string, string[]>
      if (o && typeof o === 'object') return reconcileNavPlacements(o, sections)
    }
  } catch {
    /* fall through */
  }
  const legacy = loadItemOrders()
  const migrated = migrateLegacyItemOrdersToPlacements(sections, legacy)
  return reconcileNavPlacements(migrated, sections)
}

export function saveNavPlacementsState(p: Record<string, string[]>) {
  try {
    localStorage.setItem(LS_PLACEMENTS_V2, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** Clear persisted sidebar order so the next load uses built-in defaults. */
export function clearSavedNavOrder() {
  try {
    localStorage.removeItem(LS_SECTION)
    localStorage.removeItem(LS_ITEMS)
    localStorage.removeItem(LS_PLACEMENTS_V2)
  } catch {
    /* ignore */
  }
}
