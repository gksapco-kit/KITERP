import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'

const POSTERS = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  'https://images.unsplash.com/photo-1572635196233-8b19213bccc1?w=600&q=80',
]

const EMBEDS = [
  'https://www.youtube.com/embed/9xwazD5SyVg',
  'https://www.youtube.com/embed/M7lc1UVf-VE',
  'https://www.youtube.com/embed/ScMzIvxBSi4',
  'https://www.youtube.com/embed/aqz-KE-bpKQ',
]

export function createDefaultProductVideoItem(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: '',
    description: '',
    imageUrl: POSTERS[0],
    videoUrl: EMBEDS[0],
    ...overrides,
  }
}

export function defaultProductVideoItems(): CardItem[] {
  const titles = ['Product overview', 'Features demo', 'How to use', 'Customer review']
  const descriptions = [
    'See the product in action — materials, fit, and finish up close.',
    'Walk through key features in under two minutes.',
    'Step-by-step setup and care instructions.',
    'Real customers share their experience.',
  ]
  return EMBEDS.map((videoUrl, i) =>
    createDefaultProductVideoItem({
      videoUrl,
      imageUrl: POSTERS[i],
      title: titles[i],
      description: descriptions[i],
    }),
  )
}

export const PRODUCT_VIDEO_GALLERY_DEFAULTS = {
  showProductVideoTitle: true,
  showProductVideoCaption: true,
}

export function defaultProductVideoGalleryProps() {
  return {
    text: 'Product Videos',
    subtitle: 'Watch demos, reviews, and how-to guides',
    cards: defaultProductVideoItems(),
    ...PRODUCT_VIDEO_GALLERY_DEFAULTS,
  }
}
