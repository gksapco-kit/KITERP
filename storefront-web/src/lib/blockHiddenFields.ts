/** Section types with per-element delete (hidden_fields). */
export const ELEMENT_DELETE_BLOCK_TYPES = new Set([
  'hero',
  'hero_split',
  'hero_minimal',
  'cta',
  'about_split',
  'newsletter',
  'image_block',
  'features',
  'features_alternating',
  'faq',
  'testimonials',
  'pricing',
  'team_grid',
  'stats',
  'contact_form',
  'video_embed',
  'video_gallery',
  'map_embed',
  'countdown',
  'service.pricing',
  'services_cards',
  'services_list',
  'timeline',
  'announcement_bar',
  'coupon_banner',
  'trust_logos',
  'booking_widget',
  'nav',
  'footer',
  'marquee_strip',
  'rich_text',
  'gallery_masonry',
  'social_links',
  'product_grid',
  'menu_grid',
  'category_cards',
  'related_products',
  'blog_grid',
  'booking_slot_picker',
  'live_stock',
  'order_status',
  'payment_methods_strip',
  'search_bar',
  'cookie_consent',
  'recently_viewed',
  'cart_drawer',
  'live_quote',
  'product_reviews',
  'offer_banner',
  'promo_strip',
  'map_contact',
  'testimonials_grid',
  'team_list',
  'features_icons',
  'gallery_grid',
  'image_gallery',
  'portfolio_grid',
  'blog_featured',
  'blog_list',
  'vertical.ticketPicker',
  'vertical.eventListing',
  'vertical.courseDetail',
  'vertical.courseCatalog',
  'vertical.vehicleDetail',
  'vertical.autoInventory',
  'vertical.propertyListing',
  'state.error',
  'state.empty',
])

/** Block types that inherit delete config from another canonical type. */
const BLOCK_DELETE_ALIASES: Record<string, string> = {
  features_icons: 'features',
  testimonials_grid: 'testimonials',
  team_list: 'team_grid',
  map_contact: 'map_embed',
  offer_banner: 'coupon_banner',
  promo_strip: 'coupon_banner',
  gallery_grid: 'gallery_masonry',
  image_gallery: 'gallery_masonry',
  blog_featured: 'blog_grid',
  blog_list: 'blog_grid',
  services_list: 'services_cards',
  'service.faq': 'faq',
}

function resolveDeleteBlockType(blockType: string): string {
  return BLOCK_DELETE_ALIASES[blockType] ?? blockType
}

/** @deprecated use ELEMENT_DELETE_BLOCK_TYPES */
export const HERO_BLOCK_TYPES = new Set(['hero', 'hero_split', 'hero_minimal'])

export const FEATURES_BLOCK_TYPES = new Set(['features', 'features_alternating'])

export const HERO_DELETABLE_FIELDS = [
  'eyebrow',
  'headline',
  'headline_line2',
  'subtitle',
  'cta_primary',
  'cta_secondary',
  'image_url',
  'bg_image_url',
] as const

export type HeroDeletableField = (typeof HERO_DELETABLE_FIELDS)[number]

const TOP_LEVEL_DELETABLE: Record<string, readonly string[]> = {
  hero: HERO_DELETABLE_FIELDS as unknown as string[],
  hero_split: HERO_DELETABLE_FIELDS as unknown as string[],
  hero_minimal: ['headline', 'subtitle', 'cta_primary', 'cta_secondary', 'image_url', 'bg_image_url'],
  cta: ['headline', 'subtitle', 'cta_label', 'cta_secondary', 'bg_image_url'],
  about_split: ['title', 'subtitle', 'description', 'quote', 'signature', 'image_url'],
  newsletter: ['title', 'subtitle', 'cta_label'],
  image_block: ['image_url', 'caption', 'title'],
  features: ['title', 'subtitle'],
  features_alternating: ['title', 'subtitle'],
  faq: ['title'],
  testimonials: ['title'],
  pricing: ['title', 'subtitle'],
  team_grid: ['title', 'description'],
  stats: ['title'],
  contact_form: ['title', 'email', 'phone', 'address'],
  video_embed: ['title'],
  map_embed: ['title', 'address'],
  countdown: ['title'],
  'service.pricing': ['title', 'subtitle'],
  services_cards: ['title'],
  services_list: ['title'],
  timeline: ['title'],
  announcement_bar: ['text'],
  coupon_banner: ['title', 'code'],
  trust_logos: ['title'],
  booking_widget: ['title', 'subtitle', 'cta_label'],
  nav: ['brand', 'cta_label', 'announcement', 'brand_logo'],
  footer: ['brand', 'description', 'copyright'],
  marquee_strip: ['text'],
  rich_text: ['content'],
  gallery_masonry: ['title'],
  portfolio_grid: ['title'],
  video_gallery: ['title'],
  social_links: ['title'],
  product_grid: ['title', 'subtitle'],
  menu_grid: ['title'],
  category_cards: ['title', 'eyebrow'],
  related_products: ['title'],
  blog_grid: ['title'],
  booking_slot_picker: ['title', 'subtitle'],
  live_stock: ['title'],
  order_status: ['title', 'placeholder'],
  payment_methods_strip: ['title'],
  search_bar: ['placeholder'],
  cookie_consent: ['message', 'accept_label', 'decline_label'],
  recently_viewed: ['title'],
  cart_drawer: ['title'],
  live_quote: ['title', 'cta_label'],
  product_reviews: ['title'],
  offer_banner: ['title', 'code'],
  promo_strip: ['title', 'code'],
  'vertical.ticketPicker': ['title', 'tagline', 'image_url', 'date', 'doors', 'start', 'venue', 'address', 'order_title', 'age_note', 'seating_title', 'cta'],
  'vertical.eventListing': ['header_title', 'header_subtitle', 'all_events_label', 'cta'],
  'vertical.courseDetail': ['title', 'instructor', 'category', 'description', 'image_url', 'duration', 'enrolled_label', 'cta', 'preview_cta'],
  'vertical.courseCatalog': ['header_title', 'header_subtitle', 'all_courses_label', 'cta'],
  'vertical.vehicleDetail': ['trim', 'exteriorColor', 'bodyStyle', 'fuel', 'transmission', 'image_url', 'stock_number', 'location_note', 'cta'],
  'vertical.autoInventory': ['header_title', 'header_subtitle', 'cta'],
  'vertical.propertyListing': ['header_title', 'header_subtitle', 'refine_label', 'cta'],
  'state.error': ['error_code', 'title', 'description', 'cta', 'secondary_cta'],
  'state.empty': ['title', 'description', 'cta', 'secondary_cta'],
}

/** Nested array item fields deletable per block type. */
const ARRAY_ITEM_FIELDS: Record<string, readonly { arrayKey: string; fields: readonly string[] }[]> = {
  features: [{ arrayKey: 'features', fields: ['title', 'desc', 'description', 'image_url'] }],
  features_alternating: [{ arrayKey: 'features', fields: ['title', 'desc', 'description', 'image_url'] }],
  faq: [{ arrayKey: 'faqs', fields: ['question', 'answer', 'image_url'] }],
  testimonials: [{ arrayKey: 'testimonials', fields: ['name', 'role', 'company', 'quote', 'image_url', 'avatar_url'] }],
  pricing: [{ arrayKey: 'plans', fields: ['name', 'price', 'period', 'cta', 'cta_url', 'description'] }],
  'service.pricing': [{ arrayKey: 'plans', fields: ['name', 'price', 'period', 'cta', 'cta_url', 'description'] }],
  team_grid: [{ arrayKey: 'members', fields: ['name', 'role', 'bio', 'image_url', 'avatar_url'] }],
  stats: [{ arrayKey: 'stats', fields: ['value', 'label'] }],
  services_cards: [{ arrayKey: 'features', fields: ['title', 'desc', 'description', 'image_url'] }],
  services_list: [{ arrayKey: 'features', fields: ['title', 'desc', 'description', 'image_url'] }],
  timeline: [{ arrayKey: 'items', fields: ['year', 'title', 'desc', 'image_url'] }],
  trust_logos: [{ arrayKey: 'logos', fields: ['name', 'image_url', 'url'] }],
  nav: [{ arrayKey: 'nav_links', fields: ['label', 'url'] }],
  footer: [{ arrayKey: 'footer_columns', fields: ['title', 'links'] }],
  marquee_strip: [{ arrayKey: 'items', fields: ['label', 'image_url', 'url'] }],
  gallery_masonry: [{ arrayKey: 'images', fields: ['src', 'caption', 'alt'] }],
  portfolio_grid: [{ arrayKey: 'projects', fields: ['title', 'category', 'image_url', 'url'] }],
  video_gallery: [{ arrayKey: 'videos', fields: ['video_url', 'title', 'caption'] }],
  category_cards: [{ arrayKey: 'categories', fields: ['title', 'subtitle', 'image_url'] }],
  payment_methods_strip: [{ arrayKey: 'methods', fields: ['method'] }],
}

const IMAGE_DELETABLE: Record<string, readonly string[]> = {
  hero: ['image_url', 'bg_image_url'],
  hero_split: ['image_url', 'bg_image_url'],
  hero_minimal: ['image_url', 'bg_image_url'],
  cta: ['bg_image_url'],
  about_split: ['image_url'],
  image_block: ['image_url'],
  nav: ['brand_logo'],
  'vertical.ticketPicker': ['image_url'],
  'vertical.courseDetail': ['image_url'],
  'vertical.vehicleDetail': ['image_url'],
}

const ARRAY_IMAGE_FIELDS: Record<string, readonly { arrayKey: string; fields: readonly string[] }[]> = {
  features: [{ arrayKey: 'features', fields: ['image_url'] }],
  features_alternating: [{ arrayKey: 'features', fields: ['image_url'] }],
  testimonials: [{ arrayKey: 'testimonials', fields: ['image_url', 'avatar_url'] }],
  team_grid: [{ arrayKey: 'members', fields: ['avatar_url', 'image_url'] }],
  trust_logos: [{ arrayKey: 'logos', fields: ['image_url'] }],
  services_cards: [{ arrayKey: 'features', fields: ['image_url'] }],
  services_list: [{ arrayKey: 'features', fields: ['image_url'] }],
  gallery_masonry: [{ arrayKey: 'images', fields: ['src'] }],
  portfolio_grid: [{ arrayKey: 'projects', fields: ['image_url'] }],
  video_gallery: [{ arrayKey: 'videos', fields: ['video_url'] }],
  category_cards: [{ arrayKey: 'categories', fields: ['image_url'] }],
  marquee_strip: [{ arrayKey: 'items', fields: ['image_url'] }],
  faq: [{ arrayKey: 'faqs', fields: ['image_url'] }],
}

const CTA_URL_BY_LABEL: Record<string, string> = {
  cta_primary: 'cta_primary_url',
  cta_secondary: 'cta_secondary_url',
  cta_label: 'cta_url',
}

export const HERO_FIELD_LABELS: Record<HeroDeletableField, string> = {
  eyebrow: 'Eyebrow',
  headline: 'Headline',
  headline_line2: 'Headline line 2',
  subtitle: 'Subtitle',
  cta_primary: 'Primary button',
  cta_secondary: 'Secondary button',
  image_url: 'Side image',
  bg_image_url: 'Background image',
}

const COMMON_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  description: 'Description',
  headline: 'Headline',
  cta_label: 'Button',
  caption: 'Caption',
  image_url: 'Image',
  bg_image_url: 'Background image',
  code: 'Promo code',
  text: 'Message',
  address: 'Address',
  email: 'Email',
  phone: 'Phone',
  question: 'Question',
  answer: 'Answer',
  quote: 'Quote',
  name: 'Name',
  role: 'Role',
  company: 'Company',
  value: 'Value',
  label: 'Label',
  price: 'Price',
  period: 'Period',
  cta: 'Button',
  cta_url: 'Button link',
  bio: 'Bio',
  avatar_url: 'Photo',
  message: 'Message',
  accept_label: 'Accept button',
  decline_label: 'Decline button',
  placeholder: 'Placeholder',
  eyebrow: 'Eyebrow',
  content: 'Content',
  announcement: 'Announcement',
  copyright: 'Copyright',
  brand: 'Brand name',
  src: 'Image',
  alt: 'Alt text',
  url: 'Link',
  tagline: 'Tagline',
  doors: 'Doors time',
  start: 'Start time',
  venue: 'Venue',
  header_title: 'Section title',
  header_subtitle: 'Section subtitle',
  all_events_label: 'All events button',
  all_courses_label: 'All courses button',
  refine_label: 'Refine search button',
  order_title: 'Order summary title',
  age_note: 'Age restriction note',
  seating_title: 'Seating chart title',
  instructor: 'Instructor',
  level: 'Level',
  category: 'Category',
  duration: 'Duration',
  enrolled_label: 'Enrolled note',
  preview_cta: 'Preview button',
  trim: 'Trim',
  exteriorColor: 'Exterior color',
  bodyStyle: 'Body style',
  fuel: 'Fuel type',
  transmission: 'Transmission',
  stock_number: 'Stock number',
  location_note: 'Location note',
  error_code: 'Error code',
  secondary_cta: 'Secondary button',
  ...HERO_FIELD_LABELS,
}

const ARRAY_ITEM_LABELS: Record<string, string> = {
  features: 'Feature card',
  faqs: 'FAQ item',
  testimonials: 'Testimonial',
  plans: 'Pricing plan',
  members: 'Team member',
  stats: 'Stat',
  items: 'Timeline step',
  logos: 'Logo',
  nav_links: 'Nav link',
  footer_columns: 'Footer column',
  images: 'Gallery image',
  methods: 'Payment method',
  projects: 'Project',
}

function parseNestedFieldKey(fieldKey: string): { arrayKey: string; index: number; itemField: string } | null {
  const linkNested = fieldKey.match(/^(\w+)\.(\d+)\.links\.(\d+)$/)
  if (linkNested) {
    return { arrayKey: linkNested[1], index: Number(linkNested[2]), itemField: 'links' }
  }
  const whole = fieldKey.match(/^(\w+)\.(\d+)$/)
  if (whole) {
    return { arrayKey: whole[1], index: Number(whole[2]), itemField: '' }
  }
  const nested = fieldKey.match(/^(\w+)\.(\d+)\.(\w+)$/)
  if (nested) {
    return { arrayKey: nested[1], index: Number(nested[2]), itemField: nested[3] }
  }
  return null
}

function matchesArrayItemField(blockType: string, fieldKey: string): boolean {
  const key = resolveDeleteBlockType(blockType)
  const parsed = parseNestedFieldKey(fieldKey)
  if (!parsed) return false
  const schemas = ARRAY_ITEM_FIELDS[key]
  if (!schemas) return false
  const schema = schemas.find(s => s.arrayKey === parsed.arrayKey)
  if (!schema) return false
  if (!parsed.itemField) return true
  return schema.fields.includes(parsed.itemField)
}

export function supportsBlockElementDelete(blockType: string): boolean {
  return ELEMENT_DELETE_BLOCK_TYPES.has(resolveDeleteBlockType(blockType))
}

export function readHiddenFields(props: Record<string, unknown>): string[] {
  if (!Array.isArray(props.hidden_fields)) return []
  return props.hidden_fields.filter((entry): entry is string => typeof entry === 'string')
}

export function isBlockFieldHidden(props: Record<string, unknown>, fieldKey: string): boolean {
  return readHiddenFields(props).includes(fieldKey)
}

/** Whole array row hidden (e.g. `features.2`, `faqs.1`). */
export function isArrayItemHidden(
  props: Record<string, unknown>,
  arrayKey: string,
  index: number,
): boolean {
  return isBlockFieldHidden(props, `${arrayKey}.${index}`)
}

/** @deprecated use isArrayItemHidden(props, 'features', index) */
export function isFeatureCardHidden(props: Record<string, unknown>, index: number): boolean {
  return isArrayItemHidden(props, 'features', index)
}

/** Nested or whole-card field hidden. */
export function isNestedBlockFieldHidden(props: Record<string, unknown>, fieldKey: string): boolean {
  if (isBlockFieldHidden(props, fieldKey)) return true
  const parsed = parseNestedFieldKey(fieldKey)
  if (parsed?.itemField) {
    return isBlockFieldHidden(props, `${parsed.arrayKey}.${parsed.index}`)
  }
  return false
}

export function fieldLabelForKey(fieldKey: string): string {
  if (COMMON_FIELD_LABELS[fieldKey]) return COMMON_FIELD_LABELS[fieldKey]
  const parsed = parseNestedFieldKey(fieldKey)
  if (parsed) {
    const group = ARRAY_ITEM_LABELS[parsed.arrayKey] ?? parsed.arrayKey
    if (!parsed.itemField) return `${group} ${parsed.index + 1}`
    const leaf = COMMON_FIELD_LABELS[parsed.itemField] ?? parsed.itemField
    return `${group} ${parsed.index + 1} ${leaf}`
  }
  return fieldKey
}

export function showBlockFieldPatch(
  props: Record<string, unknown>,
  fieldKey: string,
): Record<string, unknown> {
  return {
    hidden_fields: readHiddenFields(props).filter(key => key !== fieldKey),
  }
}

export function hideBlockFieldPatch(
  props: Record<string, unknown>,
  fieldKey: string,
  extraClears: Record<string, unknown> = {},
): Record<string, unknown> {
  const hidden = new Set(readHiddenFields(props))
  hidden.add(fieldKey)
  const patch: Record<string, unknown> = {
    hidden_fields: [...hidden],
    ...extraClears,
  }
  if (!fieldKey.includes('.')) {
    patch[fieldKey] = ''
    const urlKey = CTA_URL_BY_LABEL[fieldKey]
    if (urlKey && urlKey in props) {
      patch[urlKey] = ''
    }
  }
  return patch
}

export function canDeleteBlockField(blockType: string, fieldKey: string): boolean {
  if (!supportsBlockElementDelete(blockType)) return false
  const key = resolveDeleteBlockType(blockType)
  const allowed = TOP_LEVEL_DELETABLE[key]
  if (allowed?.includes(fieldKey)) return true
  return matchesArrayItemField(blockType, fieldKey)
}

export function canDeleteBlockImageField(
  blockType: string,
  field: string,
  arrayCtx?: { arrayKey: string; itemField: string },
): boolean {
  if (!supportsBlockElementDelete(blockType)) return false
  const key = resolveDeleteBlockType(blockType)
  if (arrayCtx) {
    const schemas = ARRAY_IMAGE_FIELDS[key]
    const match = schemas?.find(s => s.arrayKey === arrayCtx.arrayKey)
    return match?.fields.includes(arrayCtx.itemField) ?? false
  }
  const allowed = IMAGE_DELETABLE[key]
  return allowed?.includes(field) ?? false
}

export function arrayImageDeleteFieldKey(
  arrayKey: string,
  index: number,
  itemField: string,
): string {
  return `${arrayKey}.${index}.${itemField}`
}

export function visibleArrayEntries<T>(
  items: readonly T[],
  props: Record<string, unknown>,
  arrayKey: string,
): { item: T; index: number }[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => !isArrayItemHidden(props, arrayKey, index))
}

/**
 * Text for a block field: hidden → null; empty string → null (no template fallback);
 * undefined → optional fallback (legacy blocks missing the key).
 */
export function resolveBlockTextField(
  props: Record<string, unknown>,
  fieldKey: string,
  options?: {
    sanitize?: (value: string) => string
    fallback?: () => string | null | undefined
  },
): string | null {
  if (isBlockFieldHidden(props, fieldKey)) return null
  const raw = props[fieldKey]
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    return options?.sanitize ? options.sanitize(trimmed) : trimmed
  }
  if (raw === null || raw === false) return null
  const fb = options?.fallback?.()
  if (typeof fb === 'string' && fb.trim()) {
    const trimmed = fb.trim()
    return options?.sanitize ? options.sanitize(trimmed) : trimmed
  }
  return null
}

export function listDeletableHiddenFields(blockType: string, props: Record<string, unknown>): string[] {
  return readHiddenFields(props).filter(key => canDeleteBlockField(blockType, key))
}
