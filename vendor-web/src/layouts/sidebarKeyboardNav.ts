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

export type NavItemLike = { to: string; groupLabel?: string }

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
  | { type: 'navigate'; to: string; focusKey?: string }
  | { type: 'expandSection'; title: string; sectionId: string; focusKey?: string; navigateTo?: string }
  | { type: 'collapseSection'; title: string; sectionId: string }
  | { type: 'expandGroup'; grpKey: string; focusKey?: string; navigateTo?: string }
  | { type: 'collapseGroup'; grpKey: string }
  | { type: 'openRailFlyout'; sectionId: string; focusKey?: string; navigateTo?: string }
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

function isDescendantOf(
  nodes: SidebarNavNode[],
  nodeKey: string,
  ancestorKey: string,
): boolean {
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  let current = byKey.get(nodeKey)
  while (current?.parentKey) {
    if (current.parentKey === ancestorKey) return true
    current = byKey.get(current.parentKey)
  }
  return false
}

/** Active route item under a section/group header, if any. */
export function activeDescendantKey(
  nodes: SidebarNavNode[],
  ancestorKey: string,
  activeNavTo: string | null | undefined,
): string | null {
  if (!activeNavTo) return null
  for (const node of nodes) {
    if (
      (node.kind === 'item' || node.kind === 'flyout') &&
      node.to === activeNavTo &&
      isDescendantOf(nodes, node.key, ancestorKey)
    ) {
      return node.key
    }
  }
  return null
}

function childFocusKey(
  nodes: SidebarNavNode[],
  parentKey: string,
  activeNavTo: string | null | undefined,
): string | null {
  return activeDescendantKey(nodes, parentKey, activeNavTo) ?? firstChildKey(nodes, parentKey)
}

/** Next/previous main module row (section header or rail icon), skipping submenu items. */
export function adjacentMainMenuKey(
  mainNodes: SidebarNavNode[],
  treeNodes: SidebarNavNode[],
  currentKey: string | null,
  direction: 'next' | 'prev',
): string | null {
  if (!mainNodes.length) return null

  let mainIdx = -1
  if (currentKey) {
    const current = treeNodes.find((n) => n.key === currentKey)
    if (current) {
      if (current.kind === 'section' || current.kind === 'rail') {
        mainIdx = mainNodes.findIndex((n) => n.key === current.key)
      } else {
        mainIdx = mainNodes.findIndex((n) => n.sectionId === current.sectionId)
      }
    }
  }

  if (mainIdx < 0) {
    return direction === 'next' ? (mainNodes[0]?.key ?? null) : null
  }

  const nextIdx = direction === 'next' ? mainIdx + 1 : mainIdx - 1
  if (nextIdx < 0 || nextIdx >= mainNodes.length) return null
  return mainNodes[nextIdx].key
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
    railFlyoutActiveKey?: string | null
    activeNavTo?: string | null
    ctrlKey?: boolean
    mainMenuNodes?: SidebarNavNode[]
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

  if (ctx.ctrlKey && (key === 'ArrowRight' || key === 'ArrowLeft')) {
    const mainNodes =
      ctx.mainMenuNodes ?? nodes.filter((n) => n.kind === 'section' || n.kind === 'rail')
    const adjacentKey = adjacentMainMenuKey(
      mainNodes,
      nodes,
      currentKey,
      key === 'ArrowRight' ? 'next' : 'prev',
    )
    if (!adjacentKey) return null
    if (ctx.railFlyoutSectionId) {
      return { type: 'closeRailFlyout', focusKey: adjacentKey }
    }
    return { type: 'focus', key: adjacentKey }
  }

  if (!current) return null

  if (key === 'ArrowRight') {
    if (current.kind === 'section') {
      const collapsed = ctx.collapsedSections[current.sectionTitle ?? ''] ?? true
      const activeChild = activeDescendantKey(nodes, current.key, ctx.activeNavTo)
      if (collapsed) {
        return {
          type: 'expandSection',
          title: current.sectionTitle ?? '',
          sectionId: current.sectionId,
          focusKey: activeChild ?? undefined,
          navigateTo: activeChild ? ctx.activeNavTo ?? undefined : undefined,
        }
      }
      const child = childFocusKey(nodes, current.key, ctx.activeNavTo)
      if (!child) return null
      const childNode = nodes.find((n) => n.key === child)
      if (childNode?.to && childNode.to === ctx.activeNavTo) {
        return { type: 'navigate', to: childNode.to, focusKey: child }
      }
      return { type: 'focus', key: child }
    }
    if (current.kind === 'group') {
      const collapsed = ctx.collapsedGroups[current.grpKey ?? ''] ?? false
      const activeChild = activeDescendantKey(nodes, current.key, ctx.activeNavTo)
      if (collapsed) {
        return {
          type: 'expandGroup',
          grpKey: current.grpKey ?? '',
          focusKey: activeChild ?? undefined,
          navigateTo: activeChild ? ctx.activeNavTo ?? undefined : undefined,
        }
      }
      const child = childFocusKey(nodes, current.key, ctx.activeNavTo)
      if (!child) return null
      const childNode = nodes.find((n) => n.key === child)
      if (childNode?.to && childNode.to === ctx.activeNavTo) {
        return { type: 'navigate', to: childNode.to, focusKey: child }
      }
      return { type: 'focus', key: child }
    }
    if (current.kind === 'rail') {
      return {
        type: 'openRailFlyout',
        sectionId: current.sectionId,
        focusKey: ctx.railFlyoutActiveKey ?? ctx.railFlyoutFirstKey ?? undefined,
        navigateTo: ctx.railFlyoutActiveKey ? ctx.activeNavTo ?? undefined : undefined,
      }
    }
    if ((current.kind === 'item' || current.kind === 'flyout') && current.to) {
      return { type: 'navigate', to: current.to, focusKey: current.key }
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

  if (key === 'Enter' || key === ' ') {
    if ((current.kind === 'item' || current.kind === 'flyout') && current.to) {
      return { type: 'navigate', to: current.to, focusKey: current.key }
    }
    return null
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
