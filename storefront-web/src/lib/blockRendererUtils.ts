import type { PublicBlock, StyleConfig } from '@/blocks/registry'
import { DEFAULT_STYLE } from '@/blocks/registry'

export function mergeStyle(site: Partial<StyleConfig>, overrides: Record<string, unknown> = {}): StyleConfig {
  return { ...DEFAULT_STYLE, ...site, ...(overrides as Partial<StyleConfig>) }
}

export function mergePageStyle(site: Partial<StyleConfig>, pageId?: string | null): StyleConfig {
  const pageStyles = (site as { page_styles?: Record<string, Record<string, unknown>> }).page_styles
  const pageOverrides = pageId && pageStyles ? pageStyles[pageId] : undefined
  return mergeStyle(site, pageOverrides || {})
}

const SHELL_BLOCK_TYPES = new Set(['nav', 'announcement_bar'])

/** Leading announcement/nav blocks stay outside overflow-x-clip so sticky headers work. */
export function splitLeadingShellBlocks(blocks: PublicBlock[]) {
  const shellBlocks: PublicBlock[] = []
  let index = 0
  while (index < blocks.length) {
    const blockType = blocks[index]?.block_type
    if (!blockType || !SHELL_BLOCK_TYPES.has(blockType)) break
    shellBlocks.push(blocks[index])
    index += 1
  }
  return { shellBlocks, contentBlocks: blocks.slice(index) }
}

const TRAILING_SHELL_BLOCK_TYPES = new Set(['footer'])

/** Trailing footer blocks stay outside overflow-x-clip so mobile padding is not clipped. */
export function splitTrailingShellBlocks(blocks: PublicBlock[]) {
  const trailingShellBlocks: PublicBlock[] = []
  let end = blocks.length
  while (end > 0) {
    const blockType = blocks[end - 1]?.block_type
    if (!blockType || !TRAILING_SHELL_BLOCK_TYPES.has(blockType)) break
    trailingShellBlocks.unshift(blocks[end - 1])
    end -= 1
  }
  return { middleBlocks: blocks.slice(0, end), trailingShellBlocks }
}
