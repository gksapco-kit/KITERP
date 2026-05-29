import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'

const IMG = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'
const HERO_IMG = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80'

export function createDefaultSlide(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: 'Slide title',
    description: 'Optional caption text',
    imageUrl: IMG,
    ...overrides,
  }
}

export function defaultCarouselSlides(): CardItem[] {
  return [
    createDefaultSlide({ title: 'Slide 1', description: 'Caption for slide 1', imageUrl: IMG }),
    createDefaultSlide({ title: 'Slide 2', description: 'Caption for slide 2', imageUrl: HERO_IMG }),
  ]
}

export const CAROUSEL_DISPLAY_DEFAULTS = {
  showSlideTitle: true,
  showSlideCaption: true,
  showSlideArrows: true,
  showSlideDots: true,
  showSlideCounter: false,
} as const

export function defaultCarouselBlockProps() {
  return {
    cards: defaultCarouselSlides(),
    ...CAROUSEL_DISPLAY_DEFAULTS,
  }
}
