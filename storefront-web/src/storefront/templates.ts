export type TemplateId = 'fashion' | 'electronics' | 'grocery' | 'restaurant' | 'services'
export type PresetId = 'minimal' | 'bold' | 'classic'

export interface ThemePreset {
  id: PresetId
  name: string
  description: string
}

export interface TemplateMeta {
  id: TemplateId
  name: string
  tagline: string
  description: string
  vertical: string
  features: string[]
  thumbnail: string
  defaultBrand: {
    primary: string // hsl triplet e.g. "20 14% 12%"
    accent: string
    bg: string
    fg: string
    display: string
    body: string
  }
  presets: ThemePreset[]
}

const presetsCommon: ThemePreset[] = [
  { id: 'minimal', name: 'Minimal', description: 'Clean, airy, low-contrast.' },
  { id: 'bold', name: 'Bold', description: 'High-contrast, sharp corners, statement type.' },
  { id: 'classic', name: 'Classic', description: 'Soft shadows, rounded corners, timeless.' },
]

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'fashion',
    name: 'Atelier',
    tagline: 'Editorial fashion & apparel',
    description: 'Lookbook-led layout with seasonal stories, size/color variants and a refined product page.',
    vertical: 'Fashion · Apparel · Accessories',
    features: ['Lookbook hero', 'Variant picker', 'Size guide', 'Wishlist', 'Cart drawer'],
    thumbnail: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800',
    defaultBrand: {
      primary: '20 14% 12%',
      accent: '18 78% 52%',
      bg: '38 30% 97%',
      fg: '20 14% 12%',
      display: 'Fraunces',
      body: 'Inter',
    },
    presets: presetsCommon,
  },
  {
    id: 'electronics',
    name: 'Voltage',
    tagline: 'Spec-driven electronics',
    description: 'Dense product cards, comparison tables, brand filters and deal banners for tech-savvy shoppers.',
    vertical: 'Electronics · Phones · Laptops · Audio',
    features: ['Spec table', 'Brand filters', 'Deals strip', 'Compare', 'Reviews'],
    thumbnail: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800',
    defaultBrand: {
      primary: '220 16% 10%',
      accent: '210 90% 56%',
      bg: '220 16% 6%',
      fg: '220 14% 96%',
      display: 'Space Grotesk',
      body: 'Manrope',
    },
    presets: presetsCommon,
  },
  {
    id: 'grocery',
    name: 'Pantry',
    tagline: 'Daily essentials & grocery',
    description: 'Search-first layout with dense category tiles, quick-add buttons and delivery slot banner.',
    vertical: 'Grocery · Daily Needs · Convenience',
    features: ['Quick add', 'Delivery slots', 'Categories grid', 'Search bar', 'Promo strip'],
    thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    defaultBrand: {
      primary: '140 30% 22%',
      accent: '12 78% 52%',
      bg: '60 30% 97%',
      fg: '140 30% 14%',
      display: 'DM Serif Display',
      body: 'Inter',
    },
    presets: presetsCommon,
  },
  {
    id: 'restaurant',
    name: 'Larder',
    tagline: 'Restaurant & food ordering',
    description: 'Menu-first layout with sections, item modals with add-ons and a sticky cart.',
    vertical: 'Restaurants · Cafés · Cloud kitchens',
    features: ['Menu sections', 'Add-ons modal', 'Sticky cart', 'Hours strip', 'Reservations'],
    thumbnail: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    defaultBrand: {
      primary: '20 30% 8%',
      accent: '38 80% 56%',
      bg: '30 20% 10%',
      fg: '38 30% 95%',
      display: 'Playfair Display',
      body: 'Inter',
    },
    presets: presetsCommon,
  },
  {
    id: 'services',
    name: 'Studio',
    tagline: 'Services & booking',
    description: 'Service catalog with provider profiles, availability calendar and booking flow.',
    vertical: 'Salon · Wellness · Consulting · Studio',
    features: ['Service cards', 'Provider profiles', 'Time slot picker', 'Booking CTA', 'Hours'],
    thumbnail: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
    defaultBrand: {
      primary: '12 30% 22%',
      accent: '12 78% 52%',
      bg: '30 30% 95%',
      fg: '12 30% 14%',
      display: 'Fraunces',
      body: 'Manrope',
    },
    presets: presetsCommon,
  },
]

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id)
