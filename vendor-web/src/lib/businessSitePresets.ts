import type { StyleConfig } from '@/types/websites'

/** Maps guided-setup business type → gallery image pack used for starter layouts. */
export const BUSINESS_TYPE_IMAGE_CATEGORY: Record<string, string> = {
  retail: 'wellness',
  services: 'shop',
  restaurant: 'catering-service',
  fashion: 'shop',
  electronics: 'electronics',
  salon: 'beauty',
  clinic: 'medical-equipment-store',
  consulting: 'book-store',
  none: 'shop',
}

export function imageCategoryForBusinessType(businessTypeId: string): string {
  return BUSINESS_TYPE_IMAGE_CATEGORY[businessTypeId] ?? 'shop'
}

type StoreSettingsLike = { settings?: Record<string, unknown> | null }

function storeCompanyType(store: StoreSettingsLike | undefined | null): string {
  const raw = store?.settings && typeof store.settings === 'object'
    ? (store.settings as Record<string, unknown>).company_type
    : undefined
  return typeof raw === 'string' ? raw.trim() : ''
}

/** Map business-unit company type (or vendor industry) → website wizard preset id. */
export function companyTypeToWebsitePreset(
  companyType: string | undefined | null,
  vendorBusinessType?: string | null,
): string {
  const key = (companyType || vendorBusinessType || '').trim().toLowerCase()
  if (!key || key === 'individual') return 'services'

  if (/restaurant|cafe|café|bakery|fast food|cloud kitchen|hotel|guest house|food/.test(key)) return 'restaurant'
  if (/electronics/.test(key)) return 'electronics'
  if (/clothing|fashion|apparel|boutique|jewelry|shop|store|supermarket|beauty.*cosmetic|retail|wellness store/.test(key)) return 'retail'
  if (/salon|spa|beauty parlor|wellness center|gym|fitness/.test(key)) return 'salon'
  if (/clinic|hospital|dental|veterinary|pharmacy|diagnostic|healthcare|medical/.test(key)) return 'clinic'
  if (/consult|agency|software|it |law firm|accounting|real estate|travel/.test(key)) return 'consulting'

  return 'services'
}

export function resolveWebsiteSetupFromBusinessSettings(
  vendor: { business_type?: string | null; offering_type?: string | null } | null | undefined,
  store: StoreSettingsLike | undefined | null,
): { businessTypeId: string; sellingMode: string } {
  const companyType = storeCompanyType(store) || vendor?.business_type || ''
  const businessTypeId = companyTypeToWebsitePreset(companyType, vendor?.business_type)
  const offering = vendor?.offering_type || 'both'
  const sellingMode = offering === 'products' || offering === 'services' || offering === 'both' || offering === 'none'
    ? offering
    : 'both'
  return { businessTypeId, sellingMode }
}

/** Checkbox options shown in the create-website wizard. */
export type SetupFeatureId =
  | 'homepage_copy'
  | 'mobile_layout'
  | 'products_sections'
  | 'services_sections'
  | 'reviews_trust'
  | 'contact_form'
  | 'commerce_blocks'
  | 'seo_content'
  | 'publish_checklist'
  | 'about_page'
  | 'services_page'
  | 'pricing_page'
  | 'blog_page'
  | 'booking_blocks'
  | 'menu_gallery'

export interface SetupFeatureOption {
  id: SetupFeatureId
  label: string
  description: string
  /** Shown in wizard; some options are always on and non-toggleable. */
  locked?: boolean
}

const ALL_SETUP_FEATURES: SetupFeatureOption[] = [
  { id: 'homepage_copy', label: 'Homepage copy', description: 'Hero, headlines, and call-to-action text', locked: true },
  { id: 'mobile_layout', label: 'Mobile-friendly layout', description: 'Responsive sections on phone and tablet', locked: true },
  { id: 'products_sections', label: 'Products sections', description: 'Category cards and product showcase blocks' },
  { id: 'services_sections', label: 'Services sections', description: 'Service cards with descriptions and icons' },
  { id: 'reviews_trust', label: 'Reviews / trust blocks', description: 'Testimonials and social proof on the homepage' },
  { id: 'contact_form', label: 'Contact or lead form', description: 'Contact page with inquiry form and CTA' },
  { id: 'commerce_blocks', label: 'Cart or booking blocks', description: 'Shopping cart, checkout, or booking widgets' },
  { id: 'seo_content', label: 'SEO starter content', description: 'Page titles and meta descriptions', locked: true },
  { id: 'publish_checklist', label: 'Publish checklist', description: 'Go-live steps inside the builder', locked: true },
  { id: 'about_page', label: 'About page', description: 'Company story, team, and brand message' },
  { id: 'services_page', label: 'Services page', description: 'Dedicated page listing all services' },
  { id: 'pricing_page', label: 'Pricing page', description: 'Plans, packages, and pricing tables' },
  { id: 'blog_page', label: 'Blog / insights page', description: 'Articles and news grid layout' },
  { id: 'booking_blocks', label: 'Online booking widget', description: 'Appointment scheduling on the homepage' },
  { id: 'menu_gallery', label: 'Menu or photo gallery', description: 'Food menu or lifestyle photo masonry' },
]

export function getSetupFeatureById(id: SetupFeatureId): SetupFeatureOption | undefined {
  return ALL_SETUP_FEATURES.find(f => f.id === id)
}

/** Always-on design quality shown in the create-website wizard. */
export interface DesignQualityOption {
  id: string
  label: string
  description: string
}

export const DESIGN_QUALITY_FEATURES: DesignQualityOption[] = [
  { id: 'professional_layouts', label: 'Professional layouts', description: 'Split heroes, editorial grids, and balanced sections' },
  { id: 'clean_ui', label: 'Clean UI', description: 'Generous spacing, rounded cards, and readable typography' },
  { id: 'smooth_animations', label: 'Smooth animations', description: 'Fade and slide-in effects as visitors scroll' },
  { id: 'modern_gradients', label: 'Modern gradients', description: 'Brand-colored gradient heroes and CTA sections' },
  { id: 'wave_dividers', label: 'Wave dividers', description: 'Soft waves at the top and bottom of key sections' },
]

const BASE_STYLE_DEFAULTS: Partial<StyleConfig> = {
  font_heading: 'Inter',
  font_body: 'Inter',
  border_radius: 'rounded',
  spacing: 'comfortable',
  animation: 'subtle',
  shadow_style: 'soft',
  button_style: 'filled',
}

/** Modern theme per business type — used when AI/local generator runs. */
export const BUSINESS_STYLE_PRESETS: Record<string, Partial<StyleConfig>> = {
  retail: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#274832',
    secondary_color: '#4A7A58',
    accent_color: '#E07A5F',
    bg_color: '#F9F9F5',
    surface_color: '#FFFFFF',
    text_color: '#182E20',
    font_heading: 'DM Serif Display',
  },
  services: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#6366f1',
    secondary_color: '#4338ca',
    accent_color: '#818cf8',
    bg_color: '#ffffff',
    surface_color: '#f5f3ff',
    text_color: '#1e1b4b',
  },
  restaurant: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#c2410c',
    secondary_color: '#7c2d12',
    accent_color: '#ea580c',
    bg_color: '#fffbf7',
    surface_color: '#fff7ed',
    text_color: '#292524',
    font_heading: 'Playfair Display',
  },
  fashion: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#18181b',
    secondary_color: '#3f3f46',
    accent_color: '#a78bfa',
    bg_color: '#ffffff',
    surface_color: '#fafafa',
    text_color: '#18181b',
    font_heading: 'Playfair Display',
    border_radius: 'sharp',
  },
  electronics: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#2563eb',
    secondary_color: '#1e40af',
    accent_color: '#38bdf8',
    bg_color: '#ffffff',
    surface_color: '#f8fafc',
    text_color: '#0f172a',
  },
  salon: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#be185d',
    secondary_color: '#831843',
    accent_color: '#f472b6',
    bg_color: '#fffbfb',
    surface_color: '#fdf2f8',
    text_color: '#500724',
    font_heading: 'Playfair Display',
  },
  clinic: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#0d9488',
    secondary_color: '#115e59',
    accent_color: '#2dd4bf',
    bg_color: '#ffffff',
    surface_color: '#f0fdfa',
    text_color: '#134e4a',
  },
  consulting: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#1e3a5f',
    secondary_color: '#0f172a',
    accent_color: '#3b82f6',
    bg_color: '#ffffff',
    surface_color: '#f1f5f9',
    text_color: '#0f172a',
  },
  none: {
    ...BASE_STYLE_DEFAULTS,
    primary_color: '#374151',
    secondary_color: '#1f2937',
    accent_color: '#6b7280',
    bg_color: '#ffffff',
    surface_color: '#f9fafb',
    text_color: '#111827',
  },
}

export function stylePresetForBusinessType(businessTypeId: string): Partial<StyleConfig> {
  return BUSINESS_STYLE_PRESETS[businessTypeId] ?? BUSINESS_STYLE_PRESETS.none ?? BUSINESS_STYLE_PRESETS.retail
}

function featureVisible(
  id: SetupFeatureId,
  businessType: string,
  sellingMode: string,
): boolean {
  if (businessType === 'none') {
    switch (id) {
      case 'homepage_copy':
      case 'mobile_layout':
      case 'seo_content':
      case 'publish_checklist':
      case 'about_page':
      case 'contact_form':
        return true
      default:
        return false
    }
  }
  switch (id) {
    case 'homepage_copy':
    case 'mobile_layout':
    case 'seo_content':
    case 'publish_checklist':
    case 'reviews_trust':
    case 'contact_form':
      return true
    case 'products_sections':
      return sellingMode === 'products' || sellingMode === 'both'
    case 'services_sections':
    case 'services_page':
      return sellingMode === 'services' || sellingMode === 'both'
    case 'commerce_blocks':
      return sellingMode === 'products' || sellingMode === 'both' || businessType === 'restaurant'
    case 'booking_blocks':
      return ['salon', 'clinic', 'restaurant', 'services'].includes(businessType)
    case 'menu_gallery':
      return businessType === 'restaurant' || businessType === 'fashion'
    case 'pricing_page':
      return ['consulting', 'salon', 'clinic', 'services'].includes(businessType)
    case 'blog_page':
      return ['consulting', 'clinic', 'fashion'].includes(businessType)
    case 'about_page':
      return true
    default:
      return false
  }
}

/** Options shown in the wizard for the current business + selling mode. */
export function getAvailableSetupFeatures(
  businessType: string,
  sellingMode: string,
): SetupFeatureOption[] {
  return ALL_SETUP_FEATURES.filter(f => featureVisible(f.id, businessType, sellingMode))
}

/** Always-on (locked) setup features for the current business context. */
export function getCoreSetupFeatures(
  businessType: string,
  sellingMode: string,
): SetupFeatureId[] {
  return getAvailableSetupFeatures(businessType, sellingMode)
    .filter(f => f.locked)
    .map(f => f.id)
}

/** Default checked features when business type or selling mode changes. */
export function getDefaultSetupFeatures(
  businessType: string,
  sellingMode: string,
): SetupFeatureId[] {
  return getAvailableSetupFeatures(businessType, sellingMode)
    .filter(f => {
      if (f.locked) return true
      if (f.id === 'about_page') return true
      if (f.id === 'services_page') return sellingMode === 'services' || sellingMode === 'both'
      if (f.id === 'products_sections') return sellingMode === 'products' || sellingMode === 'both'
      if (f.id === 'services_sections') return sellingMode === 'services' || sellingMode === 'both'
      if (f.id === 'commerce_blocks') return sellingMode === 'products' || sellingMode === 'both' || businessType === 'restaurant'
      if (f.id === 'booking_blocks') return ['salon', 'clinic', 'restaurant'].includes(businessType)
      if (f.id === 'menu_gallery') return businessType === 'restaurant'
      if (f.id === 'pricing_page') return businessType === 'consulting'
      if (f.id === 'blog_page') return businessType === 'consulting'
      return true
    })
    .map(f => f.id)
}

/** Restore wizard selections from style_config — keeps locked + stored picks valid for the current business context. */
export function normalizeSetupFeatures(
  stored: string[] | undefined | null,
  businessType: string,
  sellingMode: string,
): SetupFeatureId[] {
  const available = getAvailableSetupFeatures(businessType, sellingMode)
  const lockedIds = available.filter(f => f.locked).map(f => f.id)
  const availableIds = new Set(available.map(f => f.id))

  if (!stored?.length) {
    return getDefaultSetupFeatures(businessType, sellingMode)
  }

  const fromStored = stored.filter((id): id is SetupFeatureId => availableIds.has(id as SetupFeatureId))
  return [...new Set([...lockedIds, ...fromStored])]
}

/** Map wizard checkboxes → page slugs sent to the generator. */
export function buildPagesFromSetupFeatures(
  features: SetupFeatureId[],
  sellingMode = 'both',
): string[] {
  const pages = new Set<string>(['home'])
  if (features.includes('about_page')) pages.add('about')
  if (features.includes('products_sections') && (sellingMode === 'products' || sellingMode === 'both')) {
    pages.add('products')
  }
  if ((features.includes('services_page') || features.includes('services_sections'))
    && (sellingMode === 'services' || sellingMode === 'both')) {
    pages.add('services')
  }
  if (features.includes('contact_form')) pages.add('contact')
  if (features.includes('pricing_page')) pages.add('pricing')
  if (features.includes('blog_page')) pages.add('blog')
  return [...pages]
}

export function buildGenerateSitePrompt(
  businessType: string,
  businessLabel: string,
  siteName: string,
  sellingMode: string,
  sellingDesc: string,
  basePrompt: string,
  features: SetupFeatureId[],
  extraDesc?: string,
): string {
  const featureLabels = features
    .map(id => ALL_SETUP_FEATURES.find(f => f.id === id)?.label)
    .filter(Boolean)
  return [
    basePrompt,
    `Business name: ${siteName}.`,
    `Business category: ${businessLabel}.`,
    `Selling mode: ${sellingMode} — ${sellingDesc}.`,
    `Include these sections: ${featureLabels.join(', ')}.`,
    'Design quality: professional layouts, clean UI, smooth fade/slide animations, and modern brand gradients on hero and CTA.',
    'Use hero_split with bg_style gradient, category cards with photos, features with show_images, alternating layouts, testimonials with avatars, and gradient CTA sections. Do not add wave or shape dividers between sections.',
    'Write polished, specific copy using the business name — no lorem ipsum.',
    extraDesc?.trim() ? `Additional context: ${extraDesc.trim()}` : '',
  ].filter(Boolean).join(' ')
}
