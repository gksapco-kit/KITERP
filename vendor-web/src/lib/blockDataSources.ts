import type { LiveResource } from '@/types/websites'

export type DataSourceId = LiveResource | 'external_api'

export type DataSourceDefinition = {
  id: DataSourceId
  label: string
  desc: string
  /** Block types this feed is recommended for. */
  blockTypes: string[]
  selectable: boolean
}

/** All live data feeds a section can bind to. */
export const DATA_SOURCES: DataSourceDefinition[] = [
  { id: 'products', label: 'Products', desc: 'Your product catalog', blockTypes: ['product_grid', 'menu_grid', 'live_stock', 'live_quote', 'gallery_masonry', 'product_detail', 'related_products', 'cart_drawer', 'recently_viewed', 'product_filters', 'checkout_form'], selectable: true },
  { id: 'services', label: 'Services', desc: 'Your service offerings', blockTypes: ['services_cards', 'services_list', 'booking_widget', 'booking_slot_picker', 'menu_grid'], selectable: true },
  { id: 'testimonials', label: 'Testimonials', desc: 'Verified customer reviews (4★+)', blockTypes: ['testimonials', 'testimonials_grid', 'product_reviews'], selectable: false },
  { id: 'team', label: 'Team', desc: 'Active employees & roles', blockTypes: ['team_grid', 'team_list'], selectable: false },
  { id: 'kpis', label: 'Business KPIs', desc: 'Live stats: orders, revenue, rating', blockTypes: ['stats', 'counters', 'impact_stats'], selectable: false },
  { id: 'profile', label: 'Vendor Profile', desc: 'Brand, address, contact, socials', blockTypes: ['contact_form', 'map_embed', 'map_contact', 'footer', 'nav', 'about_split', 'social_links'], selectable: false },
  { id: 'pages', label: 'Site Pages', desc: 'Published pages for nav & footer links', blockTypes: ['nav', 'footer'], selectable: false },
  { id: 'categories', label: 'Categories', desc: 'Product & service categories', blockTypes: ['menu_grid', 'category_cards', 'product_filters'], selectable: false },
  { id: 'customers', label: 'Customers', desc: 'Top customers for social proof', blockTypes: ['trust_logos'], selectable: false },
  { id: 'orders', label: 'Orders', desc: 'Recent orders (for admin widgets)', blockTypes: ['stats', 'order_status'], selectable: false },
  { id: 'bookings', label: 'Bookings', desc: 'Upcoming / recent bookings', blockTypes: ['booking_widget', 'booking_slot_picker'], selectable: false },
  { id: 'media', label: 'Site Media', desc: 'Images & videos uploaded to this site', blockTypes: ['gallery_masonry', 'gallery_grid', 'image_gallery', 'portfolio_grid', 'image_block'], selectable: false },
  { id: 'external_api', label: 'External API', desc: 'Custom REST endpoint', blockTypes: [], selectable: false },
]

/** Default auto-bind when adding a section (unless user opts out). */
export const BLOCK_AUTO_SOURCE: Record<string, LiveResource> = {
  product_grid: 'products',
  product_detail: 'products',
  related_products: 'products',
  cart_drawer: 'products',
  live_stock: 'products',
  live_quote: 'products',
  recently_viewed: 'products',
  product_filters: 'categories',
  services_cards: 'services',
  services_list: 'services',
  booking_slot_picker: 'services',
  menu_grid: 'products',
  testimonials: 'testimonials',
  product_reviews: 'testimonials',
  testimonials_grid: 'testimonials',
  team_grid: 'team',
  team_list: 'team',
  stats: 'kpis',
  counters: 'kpis',
  impact_stats: 'kpis',
  contact_form: 'profile',
  map_embed: 'profile',
  map_contact: 'profile',
  footer: 'pages',
  nav: 'pages',
  about_split: 'profile',
  social_links: 'profile',
  category_cards: 'categories',
  gallery_masonry: 'media',
  gallery_grid: 'media',
  image_gallery: 'media',
  portfolio_grid: 'media',
  booking_widget: 'services',
  trust_logos: 'customers',
  order_status: 'orders',
}

/** Sections that only work with live data — user cannot turn off connection in layout picker. */
export const BLOCK_REQUIRED_DATA_SOURCE = new Set<string>([
  'live_stock',
  'live_quote',
  'order_status',
  'product_detail',
  'related_products',
  'product_filters',
  'booking_widget',
  'booking_slot_picker',
  'cart_drawer',
  'category_cards',
])

export function inferCommerceAutoSource(blockType: string): LiveResource | undefined {
  if (blockType.startsWith('product.')) {
    return blockType.includes('categories') || blockType.includes('filters') ? 'categories' : 'products'
  }
  if (blockType.startsWith('service.')) {
    if (blockType.includes('testimonial')) return 'testimonials'
    if (blockType.includes('team')) return 'team'
    return 'services'
  }
  if (blockType.startsWith('menu.')) return 'products'
  if (blockType.startsWith('booking.')) return 'bookings'
  if (blockType.startsWith('commerce.')) return 'products'
  return undefined
}

/**
 * Sentinel stored on a block whose data source was explicitly turned off
 * (disconnected / "static content"). Distinct from an absent data_source,
 * which still auto-binds to the block's default live resource.
 */
export const STATIC_DATA_SOURCE_TYPE = 'static'

export function normalizeSourceType(t: unknown): DataSourceId | null {
  if (typeof t !== 'string') return null
  // Treat the explicit "off" sentinels as not-a-live-source.
  if (t === STATIC_DATA_SOURCE_TYPE || t === 'none') return null
  if (t.startsWith('internal_')) return t.slice(9) as LiveResource
  return t as DataSourceId
}

export function getRecommendedDataSources(blockType: string): DataSourceDefinition[] {
  return DATA_SOURCES.filter(
    s => s.id !== 'external_api' && s.blockTypes.some(t => t === blockType),
  )
}

export function getOtherDataSources(blockType: string): DataSourceDefinition[] {
  const recommended = getRecommendedDataSources(blockType)
  return DATA_SOURCES.filter(
    s => s.id !== 'external_api' && !recommended.some(r => r.id === s.id),
  )
}

export function getPrimaryDataSource(blockType: string): LiveResource | null {
  return BLOCK_AUTO_SOURCE[blockType] || inferCommerceAutoSource(blockType) || null
}

export type BlockDataConnectionMeta = {
  canConnect: boolean
  connectionRequired: boolean
  defaultConnect: boolean
  primarySource: LiveResource | null
  recommended: DataSourceDefinition[]
  optional: DataSourceDefinition[]
}

export function getBlockDataConnectionMeta(blockType: string): BlockDataConnectionMeta {
  const recommended = getRecommendedDataSources(blockType)
  const primarySource = getPrimaryDataSource(blockType)
  const canConnect = recommended.length > 0 || !!primarySource
  const connectionRequired = BLOCK_REQUIRED_DATA_SOURCE.has(blockType)
  return {
    canConnect,
    connectionRequired,
    defaultConnect: canConnect,
    primarySource,
    recommended,
    optional: getOtherDataSources(blockType),
  }
}

export type LayoutPickerDataSourceChoice = {
  connect: boolean
  sourceType: LiveResource | null
}

export function resolveLayoutPickerDataSource(
  blockType: string,
  choice: LayoutPickerDataSourceChoice | undefined,
): { data_source?: { type: LiveResource | typeof STATIC_DATA_SOURCE_TYPE; auto: boolean } | null } {
  const meta = getBlockDataConnectionMeta(blockType)
  if (!meta.canConnect) return {}

  const connect = meta.connectionRequired || (choice?.connect ?? meta.defaultConnect)
  // Opting out writes the explicit static sentinel so the storefront stops
  // pulling live data (an absent data_source would still auto-bind).
  if (!connect) return { data_source: { type: STATIC_DATA_SOURCE_TYPE, auto: false } }

  const sourceType = (choice?.sourceType || meta.primarySource) as LiveResource | null
  if (!sourceType || sourceType === 'external_api') return {}
  return { data_source: { type: sourceType, auto: true } }
}

export function applyDataSourceToBlockProps(
  blockType: string,
  props: Record<string, unknown>,
  choice?: LayoutPickerDataSourceChoice,
): Record<string, unknown> {
  const resolved = resolveLayoutPickerDataSource(
    blockType,
    choice ?? initialLayoutPickerDataSourceChoice(blockType),
  )
  if (resolved.data_source === null) {
    const next = { ...props }
    delete next.data_source
    return next
  }
  if (resolved.data_source) return { ...props, ...resolved }
  return props
}

export function initialLayoutPickerDataSourceChoice(
  blockType: string,
  currentProps?: Record<string, unknown>,
): LayoutPickerDataSourceChoice {
  const meta = getBlockDataConnectionMeta(blockType)
  const existing = (currentProps?.data_source as { type?: string } | undefined)?.type
  const normalized = normalizeSourceType(existing)
  const connected = !!normalized && normalized !== 'external_api'
  return {
    connect: meta.connectionRequired || connected || meta.defaultConnect,
    sourceType: (normalized && normalized !== 'external_api' ? normalized : meta.primarySource) as LiveResource | null,
  }
}
