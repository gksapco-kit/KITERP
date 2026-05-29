import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'

const SAMPLES = [
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77bcea?w=800&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
]

export function createDefaultGalleryItem(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: '',
    description: '',
    imageUrl: SAMPLES[0],
    ...overrides,
  }
}

export function defaultGalleryItems(): CardItem[] {
  return SAMPLES.slice(0, 6).map((url, i) =>
    createDefaultGalleryItem({
      imageUrl: url,
      title: `Photo ${i + 1}`,
      description: i % 2 === 0 ? 'Optional caption for this image' : '',
    }),
  )
}

export const GALLERY_DISPLAY_DEFAULTS = {
  showGalleryTitle: true,
  showGalleryCaption: true,
  showGalleryLightbox: true,
  galleryLayout: 'overlay' as const,
}

export function defaultGalleryBlockProps() {
  return {
    text: 'Photo Gallery',
    subtitle: 'Browse our latest work',
    columns: 3,
    cards: defaultGalleryItems(),
    ...GALLERY_DISPLAY_DEFAULTS,
  }
}
