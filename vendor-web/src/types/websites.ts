// Website Builder types

export type BlockType =
  | 'nav' | 'footer' | 'announcement_bar'
  | 'hero' | 'hero_split' | 'hero_minimal'
  | 'features' | 'features_alternating' | 'features_icons'
  | 'services_cards' | 'services_list'
  | 'portfolio_grid' | 'gallery_masonry' | 'gallery_grid'
  | 'product_grid' | 'category_cards'
  | 'testimonials' | 'testimonials_grid'
  | 'team_grid' | 'team_list'
  | 'pricing' | 'pricing_comparison'
  | 'faq' | 'accordion'
  | 'blog_grid' | 'blog_featured' | 'blog_list'
  | 'stats' | 'impact_stats' | 'counters'
  | 'cta' | 'cta_split' | 'donate_cta'
  | 'contact_form' | 'map_contact'
  | 'about_split' | 'about_timeline'
  | 'timeline' | 'process_steps'
  | 'trust_logos' | 'partner_logos'
  | 'newsletter' | 'email_capture'
  | 'video_embed' | 'demo_video' | 'video_gallery'
  | 'menu_grid' | 'menu_list'
  | 'offer_banner' | 'promo_strip'
  | 'rich_text' | 'content_block'
  | 'image_block' | 'image_gallery'
  | 'divider' | 'spacer'
  | 'html_embed' | 'map_embed'
  | 'social_feed' | 'social_links'
  | 'countdown' | 'booking_widget'
  | 'stories' | 'stories_grid'
  | string

export interface BlockProps {
  // Hero
  headline?: string
  subtitle?: string
  eyebrow?: string
  bg_style?: 'gradient' | 'image' | 'minimal' | 'dark' | 'split'
  bg_image_url?: string
  bg_color?: string
  /** When true (default), multiple hero/store banners rotate in a carousel. */
  banner_carousel?: boolean
  overlay?: boolean
  overlay_opacity?: number
  cta_primary?: string
  cta_primary_url?: string
  cta_secondary?: string
  cta_secondary_url?: string
  layout?: string

  // Nav
  brand?: string
  brand_logo?: string
  logo_url?: string
  show_logo?: boolean
  show_brand_name?: boolean
  brand_layout?: 'horizontal' | 'vertical'
  /** Logo mark height in px (legacy: 'sm'|'md'|'lg'|'xl'). Independent of header_bar_size. */
  logo_size?: number | 'sm' | 'md' | 'lg' | 'xl'
  logo_shape?: 'original' | 'rounded' | 'square' | 'circle' | 'squircle' | 'sharp'
  logo_fit?: 'contain' | 'cover'
  brand_gap?: number
  brand_name_size?: 'sm' | 'md' | 'lg' | 'xl'
  show_nav_links?: boolean
  nav_links_source?: 'site_pages' | 'manual'
  links?: string[]
  nav_links?: { label: string; url: string; children?: { label: string; url: string }[] }[]
  /** Explicit min-height of the nav header bar in px (independent of Section size) */
  header_bar_size?: number
  transparent?: boolean
  show_cart?: boolean
  show_search?: boolean
  show_login?: boolean
  cta_label?: string
  sticky?: boolean

  // Features / Services
  title?: string
  description?: string
  features?: { icon?: string; title: string; desc?: string; image_url?: string }[]
  columns?: number
  icon_style?: 'outline' | 'filled' | 'emoji' | 'image'

  // Testimonials
  testimonials?: { name: string; role?: string; company?: string; avatar_url?: string; quote: string; rating?: number }[]
  show_rating?: boolean
  carousel?: boolean

  // Pricing
  plans?: { name: string; price: number | string; currency?: string; period?: string; features?: string[]; highlighted?: boolean; cta?: string }[]
  show_annual_toggle?: boolean

  // Stats
  stats?: { value: string; label: string; icon?: string }[]

  // FAQ
  faqs?: { question: string; answer: string }[]

  // Team (team_grid + service.team picker extras)
  members?: {
    name: string
    role: string
    bio?: string
    avatar_url?: string
    avatar?: string
    social?: Record<string, string>
    rating?: number
    reviews?: number
    available?: boolean
    nextAvailable?: string
  }[]

  // Blog
  posts?: { title: string; excerpt?: string; image_url?: string; date?: string; author?: string; slug?: string; url?: string; category?: string }[]

  // Contact
  email?: string
  phone?: string
  address?: string
  lat?: number | null
  lng?: number | null
  show_map?: boolean
  map_lat?: number
  map_lng?: number
  form_fields?: { name: string; type: string; required?: boolean; placeholder?: string }[]

  // Media
  image_url?: string
  video_url?: string
  aspect_ratio?: string

  // CTA
  cta_url?: string
  show_credit_card_note?: boolean
  show_dashboard_preview?: boolean

  // Footer
  copyright?: string
  show_legal?: boolean
  show_powered_by?: boolean
  /** When true, platform admin (admin@kiterp.com) hid Powered By. Vendors cannot set this. */
  powered_by_admin_disabled?: boolean
  powered_by_text?: string
  powered_by_text_url?: string
  powered_by_text_link_new_tab?: boolean
  minimal?: boolean
  social_links?: Record<string, string>

  // Announcement
  text?: string
  color?: string
  show_close?: boolean

  // Generic
  /** Exact body/heading font size in px (builder + business front); wins over `text_scale` when set. */
  font_size_px?: number | null
  /** Section-relative font scale (builder canvas / preview). */
  text_scale?: number | null
  /** CSS text-transform for the block preview (uppercase | lowercase | capitalize). */
  text_transform?: 'uppercase' | 'lowercase' | 'capitalize' | null
  text_color_override?: string | null
  bg_color_override?: string | null
  tile_bg?: string | null
  tile_accent?: string | null
  tile_text?: string | null
  tile_border?: string | null
  badge?: string
  badge_color?: string
  alignment?: 'left' | 'center' | 'right'
  full_page?: boolean
  filterable?: boolean
  show_badges?: boolean
  categories?: string[]
  [key: string]: unknown
}

export interface StyleOverrides {
  bg_color?: string
  text_color?: string
  padding_top?: number
  padding_bottom?: number
  max_width?: string
  border_radius?: string
  custom_css?: string
  [key: string]: unknown
}

export interface WebsiteBlock {
  id: string
  page_id: string
  block_type: BlockType
  label: string | null
  props: BlockProps
  style_overrides: StyleOverrides
  visible: boolean
  visible_on_mobile: boolean
  visible_on_tablet: boolean
  visible_on_desktop: boolean
  animation: string | null
  animation_delay: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface WebsitePage {
  id: string
  site_id: string
  title: string
  slug: string
  page_type: 'home' | 'about' | 'services' | 'contact' | 'blog' | 'portfolio' | 'pricing' | 'rentals' | 'custom' | 'landing' | 'product'
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  focus_keyword?: string | null
  seo_keywords?: string | null
  noindex?: boolean
  og_title?: string | null
  og_description?: string | null
  canonical_url?: string | null
  schema_type?: string
  layout: 'full' | 'boxed' | 'sidebar-left' | 'sidebar-right'
  sort_order: number
  is_published: boolean
  is_homepage: boolean
  show_in_nav: boolean
  deleted_at?: string | null
  blocks: WebsiteBlock[]
  created_at: string
  updated_at: string
}

export interface PageTrashItem {
  id: string
  title: string
  slug: string
  deleted_at: string
  purge_at: string
  days_remaining: number
  block_count: number
}

export interface SiteTrashItem {
  id: string
  name: string
  description?: string | null
  deleted_at: string
  purge_at: string
  days_remaining: number
  page_count: number
  is_published: boolean
  applied_template_name?: string | null
}

export interface StyleConfig {
  primary_color: string
  secondary_color: string
  accent_color: string
  bg_color: string
  surface_color: string
  text_color: string
  nav_bg?: string
  font_heading: string
  font_body: string
  border_radius: 'sharp' | 'rounded' | 'pill'
  spacing: 'compact' | 'comfortable' | 'spacious'
  animation: 'none' | 'subtle' | 'expressive'
  shadow_style: 'none' | 'soft' | 'elevated'
  button_style: 'filled' | 'outline' | 'ghost'
  nav_style: 'default' | 'transparent' | 'sticky'
  footer_style: string
  container_width: string
  /** Preferred checkout layout for /checkout. Saved via vendor Style panel. */
  checkout_layout?: 'two-column' | 'wizard' | 'accordion'
  /** Per-token overrides for .checkout-root CSS variables (HSL triplet values). */
  checkout_token_overrides?: Record<string, string>
  /** Per-page style overrides keyed by page id (saved in style_config JSON). */
  page_styles?: Record<string, PageStyleOverrides>
  /** Selected website color palette preset id (Create Website wizard). */
  color_palette_id?: string
  font_size_base?: number
  font_size_heading?: number
}

export interface PageStyleOverrides {
  bg_color?: string
  surface_color?: string
  text_color?: string
  font_heading?: string
  font_body?: string
  font_size_base?: number
  font_size_heading?: number
  /** Raw CSS for this page; applied live in builder and on the storefront. */
  custom_css?: string
}

export interface WebsiteSite {
  id: string
  vendor_id: string
  name: string
  subdomain: string | null
  custom_domain: string | null
  description: string | null
  favicon_url: string | null
  logo_url: string | null
  style_config: Partial<StyleConfig>
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  og_image_url: string | null
  schema_org_type?: string
  is_published: boolean
  published_at: string | null
  status: 'draft' | 'published' | 'archived'
  google_analytics_id: string | null
  meta_pixel_id: string | null
  custom_head_code: string | null
  custom_body_code: string | null
  // i18n & currency
  language: string
  languages_enabled: string[]
  currency: string
  currencies_enabled: string[]
  currency_symbol: string
  currency_position: 'before' | 'after'
  // location
  location: string | null
  timezone: string
  // Business-unit assignment (also mirrored in style_config metadata)
  website_store_scope?: string | null
  website_store_id?: string | null
  website_home_store_id?: string | null
  // headless
  headless_enabled: boolean
  headless_token: string | null
  pages: WebsitePage[]
  created_at: string
  updated_at: string
}

export interface SiteRedirect {
  id: string
  site_id: string
  from_path: string
  to_path: string
  status_code: 301 | 302
  is_active: boolean
  hit_count: number
  created_at: string
}

export interface AIGenerateSiteRequest {
  business_description: string
  niche?: string
  tone?: string
  pages?: string[]
  include_blog?: boolean
  include_pricing?: boolean
  image_category?: string
  selling_mode?: string
  site_name?: string
  business_type?: string
  setup_features?: string[]
}

export interface AIGenerateSiteResponse {
  site_name: string
  tagline: string
  pages: {
    title: string
    slug: string
    page_type: string
    is_homepage: boolean
    seo_title?: string
    seo_description?: string
    blocks: { block_type: string; label?: string; props: BlockProps }[]
  }[]
  style_config: Partial<StyleConfig>
  seo_title: string
  seo_description: string
  summary: string
}

export interface SiteListItem {
  id: string
  name: string
  subdomain: string | null
  custom_domain: string | null
  description: string | null
  favicon_url: string | null
  logo_url: string | null
  is_published: boolean
  status: 'draft' | 'published' | 'archived'
  page_count: number
  applied_template_id?: string | null
  applied_template_name?: string | null
  website_store_scope?: string | null
  website_store_id?: string | null
  website_store_name?: string | null
  /** Immutable home business unit when the site was built for one store. */
  website_home_store_id?: string | null
  /** Set when assigned in Template Gallery — publish alone does not go live. */
  storefront_assigned?: boolean
  business_type?: string | null
  selling_mode?: string | null
  created_at: string
  updated_at: string
}

export interface WebsiteMedia {
  id: string
  site_id: string
  filename: string
  original_url: string
  adjusted_url: string | null
  thumbnail_url: string | null
  file_type: 'image' | 'video' | null
  width: number | null
  height: number | null
  file_size: number | null
  adjustments: Record<string, unknown>
  ai_tags: string[]
  ai_description: string | null
  created_at: string
}

// ── Live data feeds (unified read-only binding for builder blocks) ───────────

export type LiveResource =
  | 'products'
  | 'services'
  | 'rentals'
  | 'testimonials'
  | 'team'
  | 'customers'
  | 'orders'
  | 'bookings'
  | 'categories'
  | 'media'
  | 'pages'
  | 'profile'
  | 'kpis'
  | 'stores'
  | 'blog'
  | 'plans'
  | 'properties'
  | 'courses'
  | 'fitness_classes'
  | 'vehicles'
  | 'events'
  | 'recurring_plans'
  | 'booking_wizard_steps'
  | 'booking_resources'

export interface LiveItem {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  image_url: string | null
  price: number | null
  price_formatted: string | null
  rating: number | null
  url: string | null
  meta: Record<string, unknown>
}

export interface DataSource {
  type: LiveResource | 'external_api' | (string & {})
  auto?: boolean
  selected_ids?: string[]
  limit?: number
  // external_api
  url?: string
  method?: 'GET' | 'POST'
  headers?: { key: string; value: string }[]
  data_field?: string
}

// AI types
export interface AITextRequest {
  prompt: string
  context?: string
  tone?: 'professional' | 'friendly' | 'bold' | 'minimalist' | 'luxury'
  block_type?: string
  field?: string
}

export interface AITextResponse {
  result: string
  alternatives: string[]
}

export interface AIScreenshotResponse {
  detected_sections: string[]
  suggested_blocks: { block_type: string; props: BlockProps }[]
  detected_colors: string[]
  detected_fonts: string[]
  website_type: string
  confidence: number
}

export interface AIUrlCloneResponse {
  style_config: Partial<StyleConfig>
  detected_blocks: { block_type: string; props: BlockProps }[]
  color_palette: string[]
  typography: Record<string, string>
  layout_notes: string
}

export interface AIUxReviewResponse {
  score: number
  issues: { type: string; severity: 'high' | 'medium' | 'low'; message: string }[]
  suggestions: { type: string; priority: string; message: string }[]
  strengths: string[]
  priority_fixes: string[]
}

export interface AIThemeResponse {
  style_config: Partial<StyleConfig>
  color_palette: string[]
  font_pairing: Record<string, string>
  mood_description: string
  suggested_templates: string[]
  /** Present when the API returns flat colors at the top level. */
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  bg_color?: string
  text_color?: string
}

export interface MediaAdjustments {
  brightness?: number
  contrast?: number
  saturation?: number
  sharpness?: number
  remove_background?: boolean
  color_grade?: 'cinematic' | 'vivid' | 'matte' | 'vintage' | 'cool' | 'warm' | null
  ai_enhance?: boolean
  blur?: number
  opacity?: number
  flip_h?: boolean
  flip_v?: boolean
  grayscale?: boolean
}

// Builder UI types
export type DeviceMode = 'desktop' | 'tablet' | 'mobile'
export type BuilderPanel = 'blocks' | 'pages' | 'layers' | 'style' | 'ai' | 'media' | 'settings'
export type RightPanel = 'props' | 'style' | 'ai' | 'media-studio'

export interface BlockCategory {
  id: string
  label: string
  icon: string
  blocks: BlockDefinition[]
}

export interface BlockDefinition {
  type: BlockType
  label: string
  icon: string
  description: string
  thumbnail?: string
  defaultProps: BlockProps
}

export interface FormSubmission {
  id: string
  site_id: string
  page_id: string | null
  block_id: string | null
  form_type: string
  payload: Record<string, unknown>
  crm_lead_id: string | null
  gdpr_consent: boolean
  created_at: string
}

export interface WebsiteTemplate {
  id: string
  name: string
  description: string
  thumbnail: string
  category: string
  /** Optional server-provided or UI-derived metadata (backward compatible). */
  tags?: string[]
  tier?: 'lite' | 'full'
  page_count?: number
  nav_page_count?: number
  /** Palette preview (e.g. 3–5 hex colors) for template picker UI. */
  preview_palette?: string[]
  /** Full brand style returned by the backend for storefront_ templates. */
  default_style?: {
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    bg_color?: string
    surface_color?: string
    text_color?: string
    font_heading?: string
    font_body?: string
    border_radius?: string
    spacing?: string
    animation?: string
    shadow_style?: string
    button_style?: string
    [key: string]: string | undefined
  }
  pages: {
    title: string
    slug: string
    page_type: string
    is_homepage?: boolean
    show_in_nav?: boolean
    blocks: { block_type: string; props: BlockProps }[]
  }[]
}
