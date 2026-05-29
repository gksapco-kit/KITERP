import { v4 as uuid } from 'uuid'
import type { TestimonialItem } from '../types/builder'

const AVATAR = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80'
const AVATAR2 = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80'
const AVATAR3 = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80'

export function createDefaultTestimonial(overrides: Partial<TestimonialItem> = {}): TestimonialItem {
  return {
    id: uuid(),
    quote: 'Amazing experience from start to finish. Highly recommend!',
    author: 'Sarah Johnson',
    role: 'Verified Customer',
    rating: 5,
    imageUrl: AVATAR,
    ...overrides,
  }
}

export function defaultTestimonialItems(): TestimonialItem[] {
  return [
    createDefaultTestimonial({
      quote: 'The quality and style exceeded my expectations. My go-to boutique for every season.',
      author: 'Emma Richardson',
      role: 'Fashion Enthusiast',
      imageUrl: AVATAR,
      rating: 5,
    }),
    createDefaultTestimonial({
      quote: 'Fast shipping, beautiful packaging, and products that last. Could not be happier.',
      author: 'Michael Chen',
      role: 'Loyal Customer',
      imageUrl: AVATAR2,
      rating: 5,
    }),
    createDefaultTestimonial({
      quote: 'Customer support went above and beyond. They made everything easy.',
      author: 'Lisa Park',
      role: 'First-time Buyer',
      imageUrl: AVATAR3,
      rating: 4,
    }),
  ]
}

export const TESTIMONIAL_DISPLAY_DEFAULTS = {
  showTestimonialRating: true,
  showTestimonialAvatar: true,
  testimonialLayout: 'manualSlider' as const,
  testimonialAutoSlide: false,
  columns: 3,
}

export function defaultTestimonialBlockProps() {
  return {
    text: 'What Our Customers Say',
    subtitle: 'Real stories from people who love what we do',
    ...TESTIMONIAL_DISPLAY_DEFAULTS,
    testimonialItems: defaultTestimonialItems(),
  }
}

/** Support legacy single-quote blocks */
export function resolveTestimonialItems(props: {
  testimonialItems?: TestimonialItem[]
  quote?: string
  author?: string
  role?: string
  rating?: number
  imageUrl?: string
}): TestimonialItem[] {
  if (props.testimonialItems && props.testimonialItems.length > 0) {
    return props.testimonialItems
  }
  if (props.quote || props.author) {
    return [
      {
        id: 'legacy',
        quote: props.quote ?? '',
        author: props.author ?? 'Customer',
        role: props.role,
        rating: props.rating ?? 5,
        imageUrl: props.imageUrl,
      },
    ]
  }
  return []
}
