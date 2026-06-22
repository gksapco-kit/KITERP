import {
  Globe, Globe2, Store, type LucideIcon,
} from 'lucide-react'

export const WEBSITE_CREATE_BUSINESS_PRESETS = [
  {
    id: 'retail',
    label: 'Healthy Retail',
    icon: '🥗',
    desc: 'Snacks, groceries, beverages, wellness',
    niche: 'healthy food and wellness retail',
    defaultName: 'My Wellness Store',
    sells: 'products',
    prompt: 'Create a healthy retail website with announcement bar, plant-based marquee highlights, split hero, shop-by-category cards, bestsellers grid, product highlights, why-choose-us features, our story timeline, testimonials, gifting CTA, FAQ, and newsletter.',
  },
  {
    id: 'services',
    label: 'Service Business',
    icon: '🧰',
    desc: 'Services, quotes, bookings, leads',
    niche: 'local service business',
    defaultName: 'My Service Business',
    sells: 'services',
    prompt: 'Create a service business website with a strong hero, service cards, instant quote request, booking section, testimonials, process steps, FAQ, contact form and location information.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant / Cafe',
    icon: '🍽️',
    desc: 'Menu, location, booking, offers',
    niche: 'restaurant cafe food business',
    defaultName: 'My Restaurant',
    sells: 'both',
    prompt: 'Create a restaurant or cafe website with menu sections, gallery, offers, booking widget, opening hours, reviews, location map, newsletter and contact details.',
  },
  {
    id: 'fashion',
    label: 'Fashion / Boutique',
    icon: '👗',
    desc: 'Collections, lookbook, offers',
    niche: 'fashion boutique ecommerce',
    defaultName: 'My Boutique',
    sells: 'products',
    prompt: 'Create a premium fashion boutique website with hero collection, featured products, lookbook gallery, trust badges, reviews, recently viewed products, payment methods and newsletter signup.',
  },
  {
    id: 'electronics',
    label: 'Electronics Store',
    icon: '💻',
    desc: 'Catalog, warranty, stock, filters',
    niche: 'electronics ecommerce',
    defaultName: 'Electronics Store',
    sells: 'products',
    prompt: 'Create an electronics store website with product grid, live stock, filters, warranty highlights, offers, reviews, payment methods, FAQ, cart and checkout sections.',
  },
  {
    id: 'salon',
    label: 'Salon / Spa',
    icon: '💇',
    desc: 'Treatments, staff, booking',
    niche: 'salon spa beauty services',
    defaultName: 'My Salon',
    sells: 'services',
    prompt: 'Create a beauty salon or spa website with premium hero, services, pricing, staff/team, booking widget, testimonials, gallery, FAQ, location and contact form.',
  },
  {
    id: 'clinic',
    label: 'Clinic / Healthcare',
    icon: '🩺',
    desc: 'Trust, appointments, services',
    niche: 'clinic healthcare appointments',
    defaultName: 'My Clinic',
    sells: 'services',
    prompt: 'Create a trustworthy clinic website with services, doctor/team section, appointment booking, patient testimonials, FAQs, location map, contact form and clear call-to-action.',
  },
  {
    id: 'consulting',
    label: 'Consultant / Agency',
    icon: '📈',
    desc: 'Leads, portfolio, case studies',
    niche: 'consulting agency professional services',
    defaultName: 'My Agency',
    sells: 'services',
    prompt: 'Create a professional consultant or agency website with hero, service packages, portfolio/case study style sections, testimonials, stats, lead form, FAQ and newsletter.',
  },
] as const

export type WebsiteCreateBusinessPreset = (typeof WEBSITE_CREATE_BUSINESS_PRESETS)[number]

export const WEBSITE_SELLING_MODES = [
  { id: 'products', label: 'Products', desc: 'Catalog, cart, checkout, product filters' },
  { id: 'services', label: 'Services', desc: 'Service cards, bookings, quote requests' },
  { id: 'both', label: 'Both', desc: 'Products and services on the same website' },
] as const

export type WebsiteStoreScope = 'all' | 'store' | 'external'

export const WEBSITE_STORE_SCOPE_OPTIONS: {
  id: WebsiteStoreScope
  label: string
  desc: string
  icon: LucideIcon
}[] = [
  {
    id: 'all',
    label: 'All stores',
    desc: 'One website for every business unit — shared catalog and branding',
    icon: Globe,
  },
  {
    id: 'store',
    label: 'Specific store',
    desc: 'Website scoped to a single business unit / outlet',
    icon: Store,
  },
  {
    id: 'external',
    label: 'External use',
    desc: 'Marketing or portfolio site on your own domain — not tied to a store',
    icon: Globe2,
  },
]

export type SiteStyleMetadata = {
  image_category_id?: string
  business_type?: string
  selling_mode?: string
  setup_features?: string[]
  website_store_scope?: string
  website_store_id?: string | null
  website_store_name?: string | null
  color_palette_id?: string
  storefront_assigned?: boolean
}

export function readSiteStyleMetadata(styleConfig: Record<string, unknown> | null | undefined): SiteStyleMetadata {
  const sc = styleConfig ?? {}
  return {
    image_category_id: typeof sc.image_category_id === 'string' ? sc.image_category_id : undefined,
    business_type: typeof sc.business_type === 'string' ? sc.business_type : undefined,
    selling_mode: typeof sc.selling_mode === 'string' ? sc.selling_mode : undefined,
    setup_features: Array.isArray(sc.setup_features)
      ? sc.setup_features.filter((f): f is string => typeof f === 'string')
      : undefined,
    website_store_scope: typeof sc.website_store_scope === 'string' ? sc.website_store_scope : undefined,
    website_store_id: typeof sc.website_store_id === 'string' ? sc.website_store_id : sc.website_store_id === null ? null : undefined,
    website_store_name: typeof sc.website_store_name === 'string' ? sc.website_store_name : sc.website_store_name === null ? null : undefined,
    color_palette_id: typeof sc.color_palette_id === 'string' ? sc.color_palette_id : undefined,
    storefront_assigned: sc.storefront_assigned === true,
  }
}
