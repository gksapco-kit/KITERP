const LS_SECTION = 'kiterp.vendor.sidebar.section-ids'
const LS_ITEMS = 'kiterp.vendor.sidebar.item-orders'

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

/** Clear persisted sidebar order so the next load uses built-in defaults. */
export function clearSavedNavOrder() {
  try {
    localStorage.removeItem(LS_SECTION)
    localStorage.removeItem(LS_ITEMS)
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
