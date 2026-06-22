export type SidebarNavNodeKind = 'section' | 'group' | 'item' | 'rail' | 'flyout'

export interface SidebarNavNode {
  key: string
  kind: SidebarNavNodeKind
  sectionId: string
  sectionTitle?: string
  grpKey?: string
  to?: string
  parentKey?: string
}

export function secFocusKey(sectionId: string) {
  return `sec:${sectionId}`
}

export function grpFocusKey(grpKey: string) {
  return `grp:${grpKey}`
}

export function itemFocusKey(sectionId: string, to: string) {
  return `itm:${sectionId}:${encodeURIComponent(to)}`
}

export function railFocusKey(sectionId: string) {
  return `rail:${sectionId}`
}

export function flyoutFocusKey(sectionId: string, to: string) {
  return `fly:${sectionId}:${encodeURIComponent(to)}`
}

type NavItemLike = { to: string }

type NavItemBlockLike =
  | { kind: 'items'; entries: { item: NavItemLike }[] }
  | { kind: 'group'; grpKey: string; entries: { item: NavItemLike }[] }

type SectionLike = { id: string; title: string; items: NavItemLike[] }

export function buildSidebarNavTree(
  sections: SectionLike[],
  orderedItemsBySectionId: Map<string, NavItemLike[]>,
  collapsedSections: Record<string, boolean>,
  collapsedGroups: Record<string, boolean>,
  buildBlocks: (
    items: NavItemLike[],
    groups: (string | null)[],
    sectionTitle: string,
  ) => NavItemBlockLike[],
  effectiveGroups: (items: NavItemLike[]) => (string | null)[],
): SidebarNavNode[] {
  const nodes: SidebarNavNode[] = []
  for (const section of sections) {
    const parentKey = secFocusKey(section.id)
    nodes.push({
      key: parentKey,
      kind: 'section',
      sectionId: section.id,
      sectionTitle: section.title,
    })
    if (collapsedSections[section.title] ?? true) continue

    const items = orderedItemsBySectionId.get(section.id) ?? section.items
    const groups = effectiveGroups(items)
    const blocks = buildBlocks(items, groups, section.title)

    for (const block of blocks) {
      if (block.kind === 'items') {
        for (const { item } of block.entries) {
          nodes.push({
            key: itemFocusKey(section.id, item.to),
            kind: 'item',
            sectionId: section.id,
            to: item.to,
            parentKey,
          })
        }
        continue
      }

      const groupKey = grpFocusKey(block.grpKey)
      nodes.push({
        key: groupKey,
        kind: 'group',
        sectionId: section.id,
        grpKey: block.grpKey,
        parentKey,
      })
      if (collapsedGroups[block.grpKey] ?? false) continue
      for (const { item } of block.entries) {
        nodes.push({
          key: itemFocusKey(section.id, item.to),
          kind: 'item',
          sectionId: section.id,
          to: item.to,
          parentKey: groupKey,
        })
      }
    }
  }
  return nodes
}

export function buildRailNavTree(sections: { id: string }[]): SidebarNavNode[] {
  return sections.map((section) => ({
    key: railFocusKey(section.id),
    kind: 'rail' as const,
    sectionId: section.id,
  }))
}

export function buildRailFlyoutTree(sectionId: string, items: NavItemLike[]): SidebarNavNode[] {
  return items.map((item) => ({
    key: flyoutFocusKey(sectionId, item.to),
    kind: 'flyout' as const,
    sectionId,
    to: item.to,
    parentKey: railFocusKey(sectionId),
  }))
}

export type SidebarNavAction =
  | { type: 'focus'; key: string }
  | { type: 'expandSection'; title: string; sectionId: string }
  | { type: 'collapseSection'; title: string; sectionId: string }
  | { type: 'expandGroup'; grpKey: string }
  | { type: 'collapseGroup'; grpKey: string }
  | { type: 'openRailFlyout'; sectionId: string }
  | { type: 'closeRailFlyout'; focusKey?: string }

function nodeIndex(nodes: SidebarNavNode[], key: string | null): number {
  if (!key) return -1
  return nodes.findIndex((n) => n.key === key)
}

function firstChildKey(nodes: SidebarNavNode[], parentKey: string): string | null {
  const idx = nodes.findIndex((n) => n.key === parentKey)
  if (idx < 0 || idx + 1 >= nodes.length) return null
  const child = nodes[idx + 1]
  return child.parentKey === parentKey ? child.key : null
}

export function resolveSidebarNavKeyAction(
  key: string,
  nodes: SidebarNavNode[],
  currentKey: string | null,
  ctx: {
    collapsedSections: Record<string, boolean>
    collapsedGroups: Record<string, boolean>
    railFlyoutSectionId: string | null
    railFlyoutFirstKey?: string | null
  },
): SidebarNavAction | null {
  const idx = nodeIndex(nodes, currentKey)
  const current = idx >= 0 ? nodes[idx] : null

  if (key === 'ArrowDown') {
    if (
      current?.kind === 'rail' &&
      ctx.railFlyoutSectionId === current.sectionId &&
      ctx.railFlyoutFirstKey
    ) {
      return { type: 'focus', key: ctx.railFlyoutFirstKey }
    }
    const next = idx >= 0 ? nodes[idx + 1] : nodes[0]
    return next ? { type: 'focus', key: next.key } : null
  }

  if (key === 'ArrowUp') {
    const prev = idx > 0 ? nodes[idx - 1] : idx === 0 ? null : nodes[nodes.length - 1]
    return prev ? { type: 'focus', key: prev.key } : null
  }

  if (!current) return null

  if (key === 'ArrowRight') {
    if (current.kind === 'section') {
      const collapsed = ctx.collapsedSections[current.sectionTitle ?? ''] ?? true
      if (collapsed) {
        return {
          type: 'expandSection',
          title: current.sectionTitle ?? '',
          sectionId: current.sectionId,
        }
      }
      const child = firstChildKey(nodes, current.key)
      return child ? { type: 'focus', key: child } : null
    }
    if (current.kind === 'group') {
      const collapsed = ctx.collapsedGroups[current.grpKey ?? ''] ?? false
      if (collapsed) return { type: 'expandGroup', grpKey: current.grpKey ?? '' }
      const child = firstChildKey(nodes, current.key)
      return child ? { type: 'focus', key: child } : null
    }
    if (current.kind === 'rail') {
      return { type: 'openRailFlyout', sectionId: current.sectionId }
    }
    return null
  }

  if (key === 'ArrowLeft') {
    if (current.kind === 'section') {
      const collapsed = ctx.collapsedSections[current.sectionTitle ?? ''] ?? true
      if (!collapsed) {
        return {
          type: 'collapseSection',
          title: current.sectionTitle ?? '',
          sectionId: current.sectionId,
        }
      }
      // Collapsed — move to previous main module row only (not into another module's sub-items).
      for (let i = idx - 1; i >= 0; i--) {
        if (nodes[i].kind === 'section') {
          return { type: 'focus', key: nodes[i].key }
        }
      }
      return null
    }
    if (current.kind === 'group') {
      const collapsed = ctx.collapsedGroups[current.grpKey ?? ''] ?? false
      if (!collapsed) return { type: 'collapseGroup', grpKey: current.grpKey ?? '' }
      if (current.parentKey) return { type: 'focus', key: current.parentKey }
      return null
    }
    if (current.kind === 'flyout') {
      return {
        type: 'closeRailFlyout',
        focusKey: current.parentKey ?? railFocusKey(current.sectionId),
      }
    }
    if (current.parentKey) return { type: 'focus', key: current.parentKey }
    return null
  }

  if (key === 'Home') {
    return nodes[0] ? { type: 'focus', key: nodes[0].key } : null
  }

  if (key === 'End') {
    const last = nodes[nodes.length - 1]
    return last ? { type: 'focus', key: last.key } : null
  }

  if (ctx.railFlyoutSectionId && key === 'Escape') {
    return {
      type: 'closeRailFlyout',
      focusKey: railFocusKey(ctx.railFlyoutSectionId),
    }
  }

  return null
}

export function isSidebarTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}
