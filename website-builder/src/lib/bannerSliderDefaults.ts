import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'
import { CAROUSEL_DISPLAY_DEFAULTS } from './carouselDefaults'

const HERO_IMG = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&q=80'
const IMG = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'

export function createDefaultBannerSlide(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: 'Your Headline',
    description: 'Add a short subtitle for this slide.',
    imageUrl: HERO_IMG,
    buttonText: 'Learn More',
    link: '#products',
    ...overrides,
  }
}

export function defaultBannerSlides(): CardItem[] {
  return [
    createDefaultBannerSlide({
      title: 'Build Something Amazing',
      description: 'Create beautiful websites without writing a single line of code.',
      imageUrl: HERO_IMG,
      buttonText: 'Get Started',
      link: '#products',
    }),
    createDefaultBannerSlide({
      title: 'Launch Faster',
      description: 'Drag, drop, and publish your site in minutes.',
      imageUrl: IMG,
      buttonText: 'View Demo',
      link: '#contact',
    }),
  ]
}

export function defaultHeroBannerSliderProps() {
  return {
    cards: defaultBannerSlides(),
    overlayOpacity: 0.45,
    ...CAROUSEL_DISPLAY_DEFAULTS,
    showSlideCounter: true,
  }
}
