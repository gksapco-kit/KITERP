import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'

const FASHION = [
  'https://images.unsplash.com/photo-1483985988350-763728e3685b?w=900&q=80',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80',
  'https://images.unsplash.com/photo-1469334031218-eefe5c8f8c57?w=900&q=80',
  'https://images.unsplash.com/photo-1496747611170-843222e39719?w=900&q=80',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=80',
  'https://images.unsplash.com/photo-1529139579336-2b690457373f?w=900&q=80',
]

export function createLookbookItem(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: '',
    description: '',
    imageUrl: FASHION[0],
    ...overrides,
  }
}

export function defaultLookbookItems(): CardItem[] {
  const copy = [
    { title: 'Urban layers', description: 'Tailored coats & structured knits', badge: 'Look 01' },
    { title: 'Evening minimal', description: 'Silk slip dress, chrome accessories', badge: 'Look 02' },
    { title: 'Weekend ease', description: 'Relaxed denim, oversized blazer', badge: 'Look 03' },
    { title: 'Soft neutrals', description: 'Cashmere set in stone & cream', badge: 'Look 04' },
    { title: 'Statement outerwear', description: 'Wool trench, leather boots', badge: 'Look 05' },
  ]
  return FASHION.slice(0, 5).map((url, i) =>
    createLookbookItem({
      imageUrl: url,
      ...copy[i],
      link: '#products',
    }),
  )
}

export const LOOKBOOK_DISPLAY_DEFAULTS = {
  showLookbookTitle: true,
  showLookbookCaption: true,
  showLookbookBadge: true,
  lookbookLayout: 'editorial' as const,
}

export function defaultLookbookProps() {
  return {
    text: 'The Lookbook',
    subtitle: 'Seasonal styles curated for every moment — shop the full collection.',
    cards: defaultLookbookItems(),
    ...LOOKBOOK_DISPLAY_DEFAULTS,
  }
}
