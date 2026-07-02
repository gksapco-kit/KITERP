/**
 * Shared block registry — defines every block type understood by both the
 * vendor-web builder and the storefront BlockRenderer.
 *
 * Intentionally free of React / icon imports so it can be consumed by both
 * sides without pulling in the full builder dependency tree.
 */

export type LiveResource =
  | 'products' | 'services' | 'testimonials' | 'team' | 'kpis'
  | 'profile' | 'pages' | 'categories' | 'customers' | 'orders'
  | 'bookings' | 'media' | 'stores' | 'blog' | 'plans'

export interface BlockDef {
  type: string
  label: string
  desc: string
  category: string
  defaultProps: Record<string, unknown>
  liveResource?: LiveResource
}

export interface LiveItem {
  id: string | null
  title: string
  subtitle?: string | null
  description?: string | null
  image_url?: string | null
  price?: number | null
  price_formatted?: string | null
  rating?: number | null
  url?: string | null
  meta: Record<string, unknown>
}

// ── Block catalog ──────────────────────────────────────────────────────────

export const BLOCK_CATALOG: BlockDef[] = [
  // Structure
  { type: 'nav', label: 'Navigation', desc: 'Top navigation with logo and links', category: 'structure', defaultProps: { brand: 'Your Brand', brand_logo: '', show_logo: true, show_brand_name: true, show_nav_links: true, nav_links_source: 'site_pages', nav_links: [{ label: 'About', url: '/about' }, { label: 'Contact', url: '/contact' }], show_search: true, show_cart: true, show_login: true, cta_label: 'Get Started' }, liveResource: 'pages' },
  { type: 'footer', label: 'Footer', desc: 'Site footer with links and copyright', category: 'structure', defaultProps: { copyright: '© 2026 Your Company. All rights reserved.', columns: 4, show_social: true, social_links: { twitter: '', facebook: '', instagram: '', youtube: '' } }, liveResource: 'pages' },
  { type: 'announcement_bar', label: 'Announcement Bar', desc: 'Top banner for promotions', category: 'structure', defaultProps: { text: 'Wholesome snacks and groceries — natural ingredients you can trust.', color: '#274832', show_close: true } },

  // Hero
  { type: 'hero', label: 'Hero — Centered', desc: 'Full-width hero with CTA buttons', category: 'hero', defaultProps: { headline: 'Build Something Amazing', subtitle: 'The all-in-one platform that helps you create, launch, and grow.', bg_style: 'gradient', cta_primary: 'Get Started Free', cta_secondary: 'Learn More', layout: 'centered' } },
  { type: 'hero_split', label: 'Hero — Split', desc: 'Left text, right image hero', category: 'hero', defaultProps: { headline: 'Transform Your Business', subtitle: 'Powerful tools designed to help you succeed.', bg_style: 'minimal', cta_primary: 'Start Today', layout: 'split' } },
  { type: 'hero_minimal', label: 'Hero — Minimal', desc: 'Clean, text-focused hero', category: 'hero', defaultProps: { headline: 'Simple. Powerful. Yours.', subtitle: 'Less complexity, more results.', bg_style: 'minimal', cta_primary: 'Get Started', layout: 'minimal' } },

  // Content
  { type: 'features', label: 'Features Grid', desc: 'Feature cards in a grid', category: 'content', defaultProps: { title: 'Everything You Need', layout: 'grid-3', features: [{ icon: 'Zap', title: 'Lightning Fast', desc: 'Optimized for performance' }, { icon: 'Shield', title: 'Secure by Default', desc: 'Enterprise-grade security' }, { icon: 'Star', title: 'Award Winning', desc: 'Loved by thousands of users' }] } },
  { type: 'features_alternating', label: 'Features — Alternating', desc: 'Alternating image/text sections', category: 'content', defaultProps: { title: 'Why Choose Us', features: [{ title: 'Feature One', desc: 'Detailed description of this feature and how it benefits users.', image_url: '' }, { title: 'Feature Two', desc: 'Another great feature that sets you apart from the competition.', image_url: '' }] } },
  { type: 'stats', label: 'Stats / Numbers', desc: 'Key metrics and achievements', category: 'content', defaultProps: { title: 'By the Numbers', stats: [{ value: '50K+', label: 'Happy Customers' }, { value: '99.9%', label: 'Uptime' }, { value: '4.9★', label: 'Average Rating' }, { value: '24/7', label: 'Support' }] }, liveResource: 'kpis' },
  { type: 'testimonials', label: 'Testimonials', desc: 'Customer reviews and quotes', category: 'social', defaultProps: { title: 'What Our Customers Say', testimonials: [], padding_top: 64, padding_bottom: 64 }, liveResource: 'testimonials' },
  { type: 'team_grid', label: 'Team Grid', desc: 'Meet the team cards', category: 'about', defaultProps: { title: 'Meet Our Team', columns: 4, members: [] }, liveResource: 'team' },
  { type: 'pricing', label: 'Pricing Table', desc: 'Pricing plans comparison', category: 'conversion', defaultProps: { title: 'Simple, Transparent Pricing', show_annual_toggle: true, plans: [] }, liveResource: 'plans' },
  { type: 'faq', label: 'FAQ / Accordion', desc: 'Frequently asked questions', category: 'content', defaultProps: { title: 'Frequently Asked Questions', faqs: [{ question: 'How do I get started?', answer: 'Simply sign up and follow our quick onboarding guide.' }] } },
  { type: 'cta', label: 'Call to Action', desc: 'Bold CTA section to convert visitors', category: 'conversion', defaultProps: { headline: 'Ready to Get Started?', subtitle: 'Join 50,000+ businesses already using our platform.', cta_label: 'Start Free Trial', cta_url: '/signup' } },
  { type: 'contact_form', label: 'Contact Form', desc: 'Contact form with fields', category: 'contact', defaultProps: { title: 'Get In Touch', email: 'hello@yoursite.com', phone: '', address: '', show_map: false, form_fields: [{ name: 'name', type: 'text', required: true, placeholder: 'Your Name' }, { name: 'email', type: 'email', required: true, placeholder: 'Your Email' }, { name: 'message', type: 'textarea', required: true, placeholder: 'Your Message' }] }, liveResource: 'profile' },
  { type: 'portfolio_grid', label: 'Portfolio Grid', desc: 'Filterable work portfolio grid', category: 'portfolio', defaultProps: { title: 'Our Work', columns: 3, filterable: true }, liveResource: 'media' },
  { type: 'gallery_masonry', label: 'Gallery Masonry', desc: 'Masonry image gallery', category: 'media', defaultProps: { title: 'Gallery' }, liveResource: 'media' },
  { type: 'video_gallery', label: 'Video multiple', desc: 'YouTube / Vimeo video grid', category: 'media', defaultProps: { title: 'Video Gallery', layout: 'grid', columns: 3, videos: [] } },
  { type: 'blog_grid', label: 'Blog Grid', desc: 'Latest posts in a grid', category: 'blog', defaultProps: { title: 'Latest Posts', columns: 3, show_count: 12, image_height_pct: 56 }, liveResource: 'blog' },
  { type: 'newsletter', label: 'Newsletter', desc: 'Email capture / subscribe form', category: 'conversion', defaultProps: { title: 'Stay in the Loop', subtitle: 'Get the latest news and updates delivered to your inbox.', cta_label: 'Subscribe' } },
  { type: 'video_embed', label: 'Video single', desc: 'YouTube / Vimeo video player', category: 'media', defaultProps: { title: 'Watch Our Demo', video_url: '', aspect_ratio: '16:9' } },
  { type: 'map_embed', label: 'Map', desc: 'Embedded map with location', category: 'contact', defaultProps: { title: 'Find Us', address: '' }, liveResource: 'profile' },
  { type: 'trust_logos', label: 'Trust Logos', desc: 'Partner/client logo strip', category: 'social', defaultProps: { title: 'Trusted by Industry Leaders' }, liveResource: 'customers' },
  { type: 'timeline', label: 'Timeline', desc: 'Company history or process steps', category: 'about', defaultProps: { title: 'Our Journey', items: [] } },
  { type: 'rich_text', label: 'Rich Text', desc: 'Formatted text content block', category: 'content', defaultProps: { content: '<h2>Your Heading</h2><p>Add your content here.</p>' } },
  { type: 'image_block', label: 'Image', desc: 'Single image with optional caption', category: 'media', defaultProps: { image_url: '', caption: '' } },
  { type: 'divider', label: 'Divider', desc: 'Visual separator between sections', category: 'layout', defaultProps: { style: 'line', color: '#e5e7eb', spacing: 40 } },
  { type: 'spacer', label: 'Spacer', desc: 'Blank vertical spacer', category: 'layout', defaultProps: { height: 80 } },
  { type: 'social_links', label: 'Social Links', desc: 'Social media icon links', category: 'social', defaultProps: { title: 'Follow Us', social_links: { twitter: '', instagram: '', linkedin: '', facebook: '', youtube: '' } }, liveResource: 'profile' },
  { type: 'countdown', label: 'Countdown Timer', desc: 'Countdown to a date/event', category: 'conversion', defaultProps: { title: 'Launch In', target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } },
  { type: 'product_grid', label: 'Product Grid', desc: 'Display products from your catalog', category: 'ecommerce', defaultProps: { title: 'Featured Products', columns: 4, show_badges: true, padding_top: 64, padding_bottom: 64 }, liveResource: 'products' },
  { type: 'menu_grid', label: 'Menu / Catalog', desc: 'Restaurant-style menu grid', category: 'food', defaultProps: { title: 'Our Menu', categories: ['Starters', 'Mains', 'Desserts', 'Drinks'] }, liveResource: 'products' },
  { type: 'about_split', label: 'About Split', desc: 'About section with image and text', category: 'about', defaultProps: { title: 'About Us', subtitle: 'Our Story', description: 'We are a passionate team dedicated to creating exceptional experiences.' }, liveResource: 'profile' },
  { type: 'services_cards', label: 'Services Cards', desc: 'Service offering cards', category: 'content', defaultProps: { title: 'Our Services', columns: 3, features: [] }, liveResource: 'services' },
  { type: 'html_embed', label: 'HTML Embed', desc: 'Custom HTML/widget embed', category: 'advanced', defaultProps: { html: '<p>Add your custom HTML here</p>' } },

  // ERP / live data
  { type: 'live_stock', label: 'Live Stock Ticker', desc: 'Real-time product stock levels from ERP', category: 'erp', defaultProps: { title: 'Live Inventory', show_count: 6 }, liveResource: 'products' },
  { type: 'order_status', label: 'Order Status Lookup', desc: 'Customer-facing order tracking widget', category: 'erp', defaultProps: { title: 'Track Your Order', placeholder: 'Enter order number...' } },
  { type: 'live_quote', label: 'Live Quote Widget', desc: 'Auto-generated price quote from catalog', category: 'erp', defaultProps: { title: 'Get an Instant Quote', cta_label: 'Calculate Price' }, liveResource: 'products' },

  // Widgets
  { type: 'booking_widget', label: 'Booking Widget', desc: 'Calendar-based appointment booking', category: 'widgets', defaultProps: { title: 'Book a Session', subtitle: 'Choose a time that works for you', cta_label: 'Book Now', show_calendar: true, service_name: 'Consultation' }, liveResource: 'services' },
  { type: 'booking_slot_picker', label: 'Booking Slot Picker', desc: 'Step-by-step slot-picker: service → date → time → confirm', category: 'widgets', defaultProps: { title: 'Book an Appointment', subtitle: 'Select a service and choose your preferred time' }, liveResource: 'services' },
  { type: 'ab_test_block', label: 'A/B Test Block', desc: 'Show variant A or B to split-test content', category: 'advanced', defaultProps: { variant_a: { headline: 'Version A', cta: 'Click Here A' }, variant_b: { headline: 'Version B', cta: 'Click Here B' }, split: 50 } },
  { type: 'personalization_block', label: 'Personalization Block', desc: 'Show different content by device / location / referral', category: 'advanced', defaultProps: { default_content: 'Default message for all visitors', mobile_content: 'Tap to get started on mobile!', rule: 'device' } },

  // P1 Commerce blocks
  { type: 'product_detail', label: 'Product Detail', desc: 'Gallery, variants, add-to-cart for a single product', category: 'ecommerce', defaultProps: { show_variants: true, show_reviews: true, layout: 'split', image_position: 'left' }, liveResource: 'products' },
  { type: 'cart_drawer', label: 'Cart Drawer', desc: 'Slide-out cart panel with upsells', category: 'erp', defaultProps: { title: 'Your Cart', show_upsells: true } },
  { type: 'checkout_form', label: 'Checkout Form', desc: 'Address, shipping, payment fields', category: 'erp', defaultProps: { allow_cod: true, show_tip: false } },
  { type: 'search_bar', label: 'Search Bar', desc: 'Autosuggest product/service search', category: 'ecommerce', defaultProps: { placeholder: 'Search products & services...', show_filters: true } },
  { type: 'product_filters', label: 'Product Filters', desc: 'Faceted filter sidebar', category: 'ecommerce', defaultProps: { show_price: true, show_category: true, show_brand: true }, liveResource: 'categories' },
  { type: 'related_products', label: 'Related Products', desc: 'Cross-sell / upsell grid', category: 'ecommerce', defaultProps: { title: 'You May Also Like', count: 4, padding_top: 64, padding_bottom: 64 }, liveResource: 'products' },
  { type: 'recently_viewed', label: 'Recently Viewed', desc: 'Client-side recently viewed items', category: 'ecommerce', defaultProps: { title: 'Recently Viewed', max: 6 } },
  { type: 'coupon_banner', label: 'Coupon Banner', desc: 'Promotional coupon code display', category: 'erp', defaultProps: { title: 'Use code SAVE10 for 10% off!', show_copy_button: true } },
  { type: 'payment_methods_strip', label: 'Payment Methods', desc: 'Payment provider logo strip', category: 'erp', defaultProps: { title: 'Secure Payments', methods: ['visa', 'mastercard', 'upi', 'gpay', 'cod'] } },
  { type: 'product_reviews', label: 'Product Reviews', desc: 'Star ratings and review grid', category: 'social', defaultProps: { title: 'Customer Reviews', show_summary: true }, liveResource: 'testimonials' },
  { type: 'cookie_consent', label: 'Cookie Consent', desc: 'GDPR/CCPA cookie consent banner', category: 'advanced', defaultProps: { message: 'We use cookies to improve your experience.', accept_label: 'Accept', decline_label: 'Decline' } },
]

// ── Auto-source map ────────────────────────────────────────────────────────

export const BLOCK_AUTO_SOURCE: Record<string, LiveResource> = Object.fromEntries(
  BLOCK_CATALOG.filter(b => b.liveResource).map(b => [b.type, b.liveResource as LiveResource])
)

// ── Style config defaults ──────────────────────────────────────────────────

export interface StyleConfig {
  primary_color: string
  secondary_color: string
  accent_color: string
  bg_color: string
  surface_color: string
  text_color: string
  font_heading: string
  font_body: string
  border_radius: string
  spacing: string
  animation: string
  shadow_style: string
  button_style: string
  nav_style: string
  footer_style: string
  container_width: string
  font_size_base?: number
  font_size_heading?: number
  /** Preferred checkout layout for /checkout. Saved via vendor Style panel. */
  checkout_layout?: 'two-column' | 'wizard' | 'accordion'
  /** Per-token overrides for .checkout-root CSS variables (HSL triplet values). */
  checkout_token_overrides?: Record<string, string>
}

export const DEFAULT_STYLE: StyleConfig = {
  primary_color: '#274832',
  secondary_color: '#4A7A58',
  accent_color: '#E07A5F',
  bg_color: '#F9F9F5',
  surface_color: '#FFFFFF',
  text_color: '#182E20',
  font_heading: 'DM Serif Display',
  font_body: 'Inter',
  border_radius: 'rounded',
  spacing: 'comfortable',
  animation: 'subtle',
  shadow_style: 'soft',
  button_style: 'filled',
  nav_style: 'default',
  footer_style: 'default',
  container_width: '1280px',
}

// ── Public site API types ──────────────────────────────────────────────────

export interface PublicBlock {
  id: string
  page_id: string
  block_type: string
  label?: string | null
  props: Record<string, unknown>
  style_overrides: Record<string, unknown>
  visible: boolean
  visible_on_mobile: boolean
  visible_on_tablet: boolean
  visible_on_desktop: boolean
  animation?: string | null
  animation_delay: number
  sort_order: number
  visible_branches?: string[]
}

export interface PublicPage {
  id: string
  site_id: string
  title: string
  slug: string
  page_type: string
  seo_title?: string | null
  seo_description?: string | null
  og_image_url?: string | null
  layout: string
  sort_order: number
  is_published: boolean
  is_homepage: boolean
  show_in_nav: boolean
  blocks: PublicBlock[]
}

export interface PublicSite {
  id: string
  vendor_id: string
  /** Catalog slug for /store/:slug (Vendor.slug). */
  vendor_slug?: string | null
  name: string
  subdomain?: string | null
  custom_domain?: string | null
  description?: string | null
  favicon_url?: string | null
  logo_url?: string | null
  style_config: Partial<StyleConfig>
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  og_image_url?: string | null
  is_published: boolean
  status: string
  google_analytics_id?: string | null
  meta_pixel_id?: string | null
  custom_head_code?: string | null
  custom_body_code?: string | null
  language: string
  languages_enabled: string[]
  currency: string
  currencies_enabled: string[]
  currency_symbol: string
  currency_position: string
  location?: string | null
  timezone: string
  pages: PublicPage[]
  updated_at?: string | null
}
