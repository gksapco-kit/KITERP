import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'

const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop&q=80`

export function createImageTitleSlide(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: 'Category',
    imageUrl: IMG('1523275335684-37898b6baf30'),
    ...overrides,
  }
}

export function defaultImageTitleSlides(): CardItem[] {
  return [
    createImageTitleSlide({ title: 'Smart Phones', imageUrl: IMG('1511707171634-5f897ff02aa9') }),
    createImageTitleSlide({ title: 'Headphones', imageUrl: IMG('1505740420928-5e560c06d30e') }),
    createImageTitleSlide({ title: 'Laptops', imageUrl: IMG('1496181133206-80ce9b88a853'), badge: 'NEW' }),
    createImageTitleSlide({ title: 'Smart Watches', imageUrl: IMG('1523275335684-37898b6baf30') }),
    createImageTitleSlide({ title: 'Gaming', imageUrl: IMG('1542759562-62bcad2c3bcf') }),
    createImageTitleSlide({ title: 'Earbuds', imageUrl: IMG('1598339744341-b5a223ed2891') }),
    createImageTitleSlide({ title: 'Tablets', imageUrl: IMG('1544244015-0df4b3ffc704') }),
    createImageTitleSlide({ title: 'Speakers', imageUrl: IMG('1608043159329-42342c6c9b0a') }),
  ]
}

export const IMAGE_TITLE_SLIDER_DEFAULTS = {
  showImageTitleSliderArrows: true,
  showImageTitleSliderBadges: true,
  imageTitleSliderItemSize: 'md' as const,
  columns: 5,
}

export function defaultImageTitleSliderProps() {
  return {
    text: 'Shop by category',
    subtitle: 'Browse our top collections',
    cards: defaultImageTitleSlides(),
    ...IMAGE_TITLE_SLIDER_DEFAULTS,
  }
}

export const IMAGE_TITLE_SLIDER_ITEM_WIDTH = {
  sm: 100,
  md: 132,
  lg: 160,
} as const
