import type { Block, BlockType } from '../types/builder'
import { allBlockDefinitions, blockRegistry, blockCategories } from './blockDefaults'

export { blockRegistry, blockCategories, allBlockDefinitions }

export function createBlockFromType(type: BlockType, id: string) {
  const def = blockRegistry[type]
  if (!def) throw new Error(`Unknown block type: ${type}`)
  const block: Block = {
    id,
    type,
    props: JSON.parse(JSON.stringify(def.defaultProps)),
    styles: { ...def.defaultStyles },
  }
  if (type === 'container') {
    block.children = []
  }
  return block
}
