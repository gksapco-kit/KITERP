import type { BusinessCategory, BusinessType } from '../types/builder'

export interface CategoryOption {
  id: BusinessCategory
  label: string
  emoji: string
  description: string
}

export const businessCategories: CategoryOption[] = [
  { id: 'fashion', label: 'Fashion & Apparel', emoji: '👗', description: 'Clothing, accessories, and style' },
  { id: 'electronics', label: 'Electronics', emoji: '📱', description: 'Gadgets, tech, and devices' },
  { id: 'food', label: 'Food & Restaurant', emoji: '🍽️', description: 'Restaurants, cafes, and catering' },
  { id: 'beauty', label: 'Beauty & Salon', emoji: '💄', description: 'Salons, spas, and cosmetics' },
  { id: 'health', label: 'Health & Wellness', emoji: '🏥', description: 'Clinics, therapy, and wellness' },
  { id: 'education', label: 'Education', emoji: '📚', description: 'Courses, tutoring, and coaching' },
  { id: 'consulting', label: 'Consulting', emoji: '💼', description: 'Professional and business services' },
  { id: 'real-estate', label: 'Real Estate', emoji: '🏠', description: 'Properties and rentals' },
  { id: 'fitness', label: 'Fitness & Gym', emoji: '💪', description: 'Gyms, trainers, and sports' },
  { id: 'other', label: 'Other', emoji: '✨', description: 'Any other business type' },
]

export const businessTypeOptions: { id: BusinessType; label: string; description: string; icon: string }[] = [
  { id: 'products', label: 'Products', description: 'Sell physical or digital products', icon: '📦' },
  { id: 'services', label: 'Services', description: 'Offer services and bookings', icon: '🛠️' },
  { id: 'both', label: 'Both', description: 'Sell products and offer services', icon: '🏪' },
]

export function getCategoryLabel(id: BusinessCategory): string {
  return businessCategories.find((c) => c.id === id)?.label ?? id
}
