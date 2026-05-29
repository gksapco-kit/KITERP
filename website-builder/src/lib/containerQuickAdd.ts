import type { BlockType } from '../types/builder'
import { canNestBlockType } from './blockTree'

export interface ContainerQuickAddItem {
  type: BlockType
  label: string
}

const QUICK_ADD_RAW: ContainerQuickAddItem[] = [
  { type: 'mapEmbed', label: 'Map' },
  { type: 'contactForm', label: 'Form' },
  { type: 'heading', label: 'Heading' },
  { type: 'paragraph', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Button' },
  { type: 'divider', label: 'Divider' },
  { type: 'faqAccordion', label: 'FAQ' },
]

/** Common blocks for one-click add inside a container */
export const CONTAINER_QUICK_ADD = QUICK_ADD_RAW.filter((item) => canNestBlockType(item.type))
