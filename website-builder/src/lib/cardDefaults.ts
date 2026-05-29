import { v4 as uuid } from 'uuid'
import type { CardItem } from '../types/builder'

const IMG = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'

export function createDefaultCard(overrides: Partial<CardItem> = {}): CardItem {
  return {
    id: uuid(),
    title: 'Card title',
    description: 'Short description for this card.',
    imageUrl: IMG,
    badge: 'Featured',
    price: '',
    buttonText: 'Learn more',
    link: '#products',
    ...overrides,
  }
}

export function defaultCardGridCards(): CardItem[] {
  return [
    createDefaultCard({
      title: 'Quality First',
      description: 'Built with care and attention to every detail.',
      badge: 'Popular',
      buttonText: 'View details',
      link: '#products',
    }),
    createDefaultCard({
      title: 'Fast & Reliable',
      description: 'Get what you need quickly with dependable service.',
      badge: 'New',
      buttonText: 'Get started',
      link: '#contact',
    }),
    createDefaultCard({
      title: 'Great Value',
      description: 'Premium experience without the premium price tag.',
      price: '$49',
      buttonText: 'Shop now',
      link: '#products',
    }),
  ]
}

/** Convert old single-card block props into one CardItem */
export function legacyPropsToCard(props: {
  text?: string
  excerpt?: string
  subtitle?: string
  imageUrl?: string
  badge?: string
  badges?: string[]
  buttonText?: string
  buttonLink?: string
  quote?: string
  author?: string
  role?: string
  rating?: number
}): CardItem {
  return {
    id: uuid(),
    title: props.text ?? 'Card',
    description: props.excerpt ?? props.subtitle ?? props.role ?? props.quote ?? '',
    imageUrl: props.imageUrl,
    badge: props.badge ?? props.badges?.[0],
    price: props.subtitle?.includes('$') ? props.subtitle : undefined,
    buttonText: props.buttonText,
    link: props.buttonLink,
    author: props.author,
    quote: props.quote,
    rating: props.rating,
  }
}

export const LEGACY_CARD_TYPES = new Set([
  'blogCard',
  'productCard',
  'teamCard',
  'featureCard',
  'pricingCard',
  'testimonialCard',
])
