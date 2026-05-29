import { v4 as uuid } from 'uuid'
import { arrayMove } from '@dnd-kit/sortable'
import type { Block, BlockType } from '../types/builder'

export const CONTAINER_DROP_PREFIX = 'container-drop-'

export function containerDropId(containerBlockId: string): string {
  return `${CONTAINER_DROP_PREFIX}${containerBlockId}`
}

export function isContainerDropId(id: string): boolean {
  return id.startsWith(CONTAINER_DROP_PREFIX)
}

export function containerIdFromDropId(dropId: string): string {
  return dropId.slice(CONTAINER_DROP_PREFIX.length)
}

/** Block types that cannot be placed inside a container */
export const NEST_DISALLOWED_TYPES: BlockType[] = [
  'navbar',
  'footer',
  'footerMinimal',
  'container',
  'spacer',
]

export function canNestBlockType(type: BlockType): boolean {
  return !NEST_DISALLOWED_TYPES.includes(type)
}

export interface BlockLocation {
  block: Block
  parent: Block | null
  list: Block[]
  index: number
}

export function findBlockInTree(blocks: Block[], id: string): BlockLocation | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.id === id) {
      return { block: b, parent: null, list: blocks, index: i }
    }
    if (b.type === 'container' && b.children?.length) {
      const hit = findInChildren(b, b.children, id)
      if (hit) return hit
    }
  }
  return null
}

function findInChildren(parent: Block, children: Block[], id: string): BlockLocation | null {
  for (let i = 0; i < children.length; i++) {
    const b = children[i]
    if (b.id === id) {
      return { block: b, parent, list: children, index: i }
    }
    if (b.type === 'container' && b.children?.length) {
      const hit = findInChildren(b, b.children, id)
      if (hit) return hit
    }
  }
  return null
}

export function mapBlockTree(blocks: Block[], fn: (block: Block) => Block): Block[] {
  return blocks.map((b) => {
    const next = fn(b)
    if (next.type === 'container' && next.children) {
      return { ...next, children: mapBlockTree(next.children, fn) }
    }
    return next
  })
}

function updateContainerChildren(blocks: Block[], containerId: string, children: Block[]): Block[] {
  return mapBlockTree(blocks, (b) => (b.id === containerId && b.type === 'container' ? { ...b, children } : b))
}

export function removeBlockFromTree(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.type === 'container' && b.children
        ? { ...b, children: removeBlockFromTree(b.children, id) }
        : b,
    )
}

export function insertBlockInTree(
  blocks: Block[],
  block: Block,
  parentId: string | null,
  index: number,
): Block[] {
  if (!parentId) {
    const next = [...blocks]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block)
    return next
  }
  const parent = findBlockInTree(blocks, parentId)
  if (!parent || parent.block.type !== 'container') return blocks
  const children = [...(parent.block.children ?? [])]
  children.splice(Math.max(0, Math.min(index, children.length)), 0, block)
  return updateContainerChildren(blocks, parentId, children)
}

export function extractBlockFromTree(
  blocks: Block[],
  id: string,
): { block: Block; blocks: Block[] } | null {
  const loc = findBlockInTree(blocks, id)
  if (!loc) return null
  const block = loc.block
  if (!loc.parent) {
    const next = [...blocks]
    next.splice(loc.index, 1)
    return { block, blocks: next }
  }
  const children = [...(loc.parent.children ?? [])]
  children.splice(loc.index, 1)
  const next = updateContainerChildren(blocks, loc.parent.id, children)
  return { block, blocks: next }
}

export function reorderContainerChild(
  blocks: Block[],
  containerId: string,
  childId: string,
  direction: 'up' | 'down',
): Block[] | null {
  const loc = findBlockInTree(blocks, containerId)
  if (!loc || loc.block.type !== 'container') return null
  const children = [...(loc.block.children ?? [])]
  const idx = children.findIndex((c) => c.id === childId)
  if (idx < 0) return null
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= children.length) return null
  ;[children[idx], children[swapIdx]] = [children[swapIdx], children[idx]]
  return updateContainerChildren(blocks, containerId, children)
}

export function moveBlockInTree(blocks: Block[], activeId: string, overId: string): Block[] | null {
  if (activeId === overId) return blocks

  if (isContainerDropId(overId)) {
    const extracted = extractBlockFromTree(blocks, activeId)
    if (!extracted) return null
    const { block, blocks: tree } = extracted
    if (block.type === 'container' && containerIdFromDropId(overId) === block.id) return null
    const parentId = containerIdFromDropId(overId)
    const parent = findBlockInTree(tree, parentId)
    const idx = parent?.block.children?.length ?? 0
    return insertBlockInTree(tree, block, parentId, idx)
  }

  const activeLoc = findBlockInTree(blocks, activeId)
  if (!activeLoc) return null

  const overLoc = findBlockInTree(blocks, overId)

  if (overLoc && (activeLoc.parent?.id ?? null) === (overLoc.parent?.id ?? null)) {
    if (!activeLoc.parent) {
      return arrayMove([...blocks], activeLoc.index, overLoc.index)
    }
    const parentId = activeLoc.parent.id
    const children = activeLoc.parent.children ?? []
    return updateContainerChildren(blocks, parentId, arrayMove([...children], activeLoc.index, overLoc.index))
  }

  const extracted = extractBlockFromTree(blocks, activeId)
  if (!extracted) return null
  const { block, blocks: tree } = extracted

  if (block.type === 'container' && isContainerDropId(overId) && containerIdFromDropId(overId) === block.id) {
    return insertBlockInTree(tree, block, null, tree.length)
  }

  if (!overLoc) {
    return insertBlockInTree(tree, block, null, tree.length)
  }

  const parentId = overLoc.parent?.id ?? null
  if (block.type === 'container' && parentId === block.id) return null

  return insertBlockInTree(tree, block, parentId, overLoc.index)
}

export function cloneBlockDeep(block: Block): Block {
  return {
    ...block,
    id: uuid(),
    props: JSON.parse(JSON.stringify(block.props)),
    styles: { ...block.styles },
    children: block.children?.map(cloneBlockDeep),
  }
}

export function updateBlockInTree(
  blocks: Block[],
  id: string,
  updater: (block: Block) => Block,
): Block[] {
  return mapBlockTree(blocks, (b) => (b.id === id ? updater(b) : b))
}
