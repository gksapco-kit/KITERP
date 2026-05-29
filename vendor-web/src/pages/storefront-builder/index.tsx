import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVendorStore } from '@/stores/vendorStore'
import { vendorApi } from '@/api/vendor'
import { websiteApi } from '@/api/websites'
import { useSiteList } from '@/hooks/useWebsites'
import { MediaStudioPanel } from '@/components/websites/MediaStudioPanel'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { cn, mediaUrl } from '@/lib/utils'
import { HeroSection, RestaurantMenuSection, fieldTypographyStyle, editorialKitFromTemplate } from '@kiterp/home-sections'
import type { HomeSectionTheme, SectionProps as HomeSectionProps } from '@kiterp/home-sections'
import { hexToHslChannels, primaryForegroundHslForHex } from '@kiterp/storefront-theme-colors'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Vendor, Product, Service } from '@/types'
import {
  Layout, Palette, Bot, Settings2, Monitor, Tablet, Smartphone, Save,
  GripVertical, Plus, Trash2, ToggleLeft, ToggleRight, Check, Loader2,
  Send, ShoppingBag, Truck, Wrench, Quote, MapPin, Mail, Briefcase,
  UserCheck, Globe, Zap, ArrowRight, ArrowLeft, Wand2, RefreshCw, ExternalLink,
  Sparkles, Eye, EyeOff, LayoutTemplate, Megaphone, Tag, Star,
  ChevronUp, ChevronDown, MousePointer, Layers, Image as ImageIcon,
  Info, ChevronRight, Package, Home, User, Users, X, Phone, Calendar, Clock, Heart,
  Link2, CreditCard, LayoutDashboard, LogIn, GripHorizontal, Pencil,
  Camera, BarChart3, FileText, PlayCircle,
  Undo2, Redo2, Copy, Sliders,
  Type, Columns, List, Shield,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type DeviceMode = 'desktop' | 'tablet' | 'mobile'
type BuilderTab = 'templates' | 'sections' | 'media' | 'style' | 'ai' | 'modules' | 'seo'
type BorderRadiusMode = 'sharp' | 'rounded' | 'pill'
type SpacingMode = 'compact' | 'comfortable' | 'spacious'
type AnimationMode = 'none' | 'subtle' | 'expressive'
type ESSAccess = 'hidden' | 'footer_link' | 'dedicated_page'

interface SectionProps {
  headline?: string
  subtitle?: string
  cta_primary?: string
  cta_secondary?: string
  bg_image_url?: string
  /** Hero: editorial kits; trust_strip: light | dark | accent */
  bg_style?: 'gradient' | 'image' | 'minimal' | 'dark' | 'atelier' | 'verde' | 'solace' | 'light' | 'accent'
  layout?: string
  title?: string
  badge_1?: string
  badge_2?: string
  badge_3?: string
  announcement_text?: string
  announcement_color?: string
  [key: string]: unknown
}

interface BuilderSection {
  id: string
  visible: boolean
  props: SectionProps
}

interface StyleConfig {
  primary_color: string
  secondary_color: string
  accent_color: string
  bg_color: string
  font_heading: string
  font_body: string
  border_radius: BorderRadiusMode
  spacing: SpacingMode
  animation: AnimationMode
  dark_mode: boolean
  checkout_layout?: 'two-column' | 'wizard' | 'accordion'
}

interface ModulesConfig {
  ess_portal: boolean
  ess_access: ESSAccess
  crm_widget: boolean
  job_board: boolean
  customer_reviews: boolean
  newsletter: boolean
  b2b_portal: boolean
  online_booking: boolean
  store_locator: boolean
  store_locator_limit: number       // 0 = show all
  store_locator_geo: boolean        // detect user location, sort by nearest
  store_locator_layout: 'grid' | 'list'
  store_locator_filter: 'none' | 'city'  // show city filter tabs
}

interface SeoConfig {
  page_title: string
  meta_description: string
  og_image_url: string
}

interface BuilderConfig {
  template_id: string
  product_detail_template: string
  sections: BuilderSection[]
  style: StyleConfig
  modules: ModulesConfig
  seo: SeoConfig
}

interface AiMessage {
  role: 'user' | 'ai'
  content: string
  patch?: Partial<BuilderConfig>
}

// ─── Section Definitions ──────────────────────────────────────────────────────
interface SectionDef {
  id: string
  label: string
  description: string
  icon: React.ElementType
  defaultProps: SectionProps
}

const SECTION_DEFS: SectionDef[] = [
  { id: 'announcement_bar', label: 'Announcement Bar', description: 'Scrolling banner at the very top', icon: Megaphone, defaultProps: { announcement_text: 'Free delivery on orders above ₹500! 🎉', announcement_color: '#64C3A0' } },
  { id: 'hero', label: 'Hero Banner', description: 'Full-width hero with headline & CTAs', icon: Zap, defaultProps: { headline: '', subtitle: '', cta_primary: 'Shop Now', cta_secondary: 'Learn More', bg_style: 'gradient' } },
  { id: 'trust_badges', label: 'Trust Badges', description: 'Shipping, payment & guarantee icons', icon: Check, defaultProps: { badge_1: 'Free Shipping', badge_2: 'Secure Payment', badge_3: 'Easy Returns' } },
  { id: 'featured_products', label: 'Featured Products', description: 'Grid of highlighted products', icon: ShoppingBag, defaultProps: { title: 'Featured Products', layout: 'grid-3' } },
  { id: 'featured_services', label: 'Featured Services', description: 'Showcase of your key services', icon: Wrench, defaultProps: { title: 'Our Services' } },
  { id: 'category_showcase', label: 'Category Showcase', description: 'Browse by category cards', icon: LayoutTemplate, defaultProps: { title: 'Shop by Category' } },
  { id: 'offers_banner', label: 'Offers Banner', description: 'Promotional strip with discounts', icon: Tag, defaultProps: { headline: 'Special Offers', subtitle: 'Up to 50% off selected items' } },
  { id: 'testimonials', label: 'Testimonials', description: 'Customer reviews & social proof', icon: Quote, defaultProps: { title: 'What Our Customers Say' } },
  { id: 'about_us', label: 'About Us', description: 'Story, mission and values', icon: Wand2, defaultProps: { headline: 'About Us', subtitle: 'Our story and mission' } },
  { id: 'contact_map', label: 'Contact & Map', description: 'Address, phone and location map', icon: MapPin, defaultProps: { title: 'Find Us' } },
  { id: 'newsletter', label: 'Newsletter Signup', description: 'Email opt-in for deals and updates', icon: Mail, defaultProps: { headline: 'Stay in the loop', subtitle: 'Get exclusive deals first' } },
  { id: 'job_board', label: 'Job Board', description: 'Open positions from HR recruitment', icon: Briefcase, defaultProps: { title: 'Join Our Team' } },
  { id: 'ess_login_card', label: 'Employee Portal', description: 'ESS login card for staff', icon: UserCheck, defaultProps: { headline: 'Employee Portal', subtitle: 'Access your self-service dashboard' } },
  { id: 'cta_banner', label: 'CTA Banner', description: 'Bold call-to-action section', icon: ArrowRight, defaultProps: { headline: 'Ready to get started?', subtitle: 'Join thousands of satisfied customers', cta_primary: 'Get Started' } },
  { id: 'store_locator', label: 'Store Locator', description: 'Branch cards with city filter & geo sort', icon: MapPin, defaultProps: { title: 'Find a Store Near You' } },
  { id: 'stats', label: 'Stats / Numbers', description: 'Key metrics: customers, orders, ratings, years in business', icon: BarChart3, defaultProps: { stat_1_value: '10K+', stat_1_label: 'Happy Customers', stat_2_value: '5★', stat_2_label: 'Average Rating', stat_3_value: '24/7', stat_3_label: 'Support', stat_4_value: '99%', stat_4_label: 'Satisfaction' } },
  { id: 'faq', label: 'FAQ', description: 'Accordion of frequently asked questions and answers', icon: Quote, defaultProps: { title: 'Frequently Asked Questions', faq_1_q: 'How do I place an order?', faq_1_a: 'Browse our catalogue, add items to your cart, and follow the checkout steps.', faq_2_q: 'What payment methods do you accept?', faq_2_a: 'We accept cards, UPI, net banking, and cash on delivery.', faq_3_q: 'How long does delivery take?', faq_3_a: 'Typically 3–5 business days depending on your location.' } },
  { id: 'pricing', label: 'Pricing / Plans', description: 'Compare plans or service packages side by side', icon: CreditCard, defaultProps: { title: 'Our Plans', plan_1_name: 'Basic', plan_1_price: '₹999', plan_1_desc: 'Essential features to get started', plan_1_cta: 'Get Started', plan_2_name: 'Standard', plan_2_price: '₹1,999', plan_2_desc: 'Best for growing businesses', plan_2_cta: 'Choose Plan', plan_3_name: 'Premium', plan_3_price: '₹3,999', plan_3_desc: 'Full access + priority support', plan_3_cta: 'Contact Sales' } },
  { id: 'gallery', label: 'Photo Gallery', description: 'Grid of photos showcasing your products, venue, or work', icon: Camera, defaultProps: { title: 'Our Gallery', columns: '3' } },
  { id: 'blog_grid', label: 'Blog / News', description: 'Latest articles, tips or announcements from your store', icon: FileText, defaultProps: { title: 'Latest News & Updates' } },
  { id: 'video_embed', label: 'Video', description: 'Embed a YouTube or Vimeo video to showcase your brand', icon: PlayCircle, defaultProps: { title: 'Watch Our Story', video_url: '', video_height: '160' } },
  { id: 'social_links', label: 'Social Media Links', description: 'Instagram, Facebook, YouTube and WhatsApp follow links', icon: Globe, defaultProps: { title: 'Follow Us' } },
  { id: 'booking_widget', label: 'Booking Widget', description: 'Inline appointment booking prompt with a CTA button', icon: Calendar, defaultProps: { title: 'Book an Appointment', subtitle: 'Choose a time that works for you', cta_label: 'Book Now' } },
  // ── New editorial/vertical sections ──────────────────────────────────────
  { id: 'marquee_strip', label: 'Marquee Ticker', description: 'Scrolling animated text ribbon — shipping notes, brand values, hours', icon: Type, defaultProps: { items: 'Free returns within 30 days,Made in small batches,New drops every Friday,Handcrafted with care' } },
  { id: 'editorial_split', label: 'Editorial Split', description: 'Large-type magazine-style image + story block (Atelier style)', icon: Columns, defaultProps: { headline: 'Made slowly,\non purpose.', accent_phrase: 'on purpose.', subtitle: 'A note from the studio', description: 'Every piece passes through fewer than ten hands. We think that shows.', cta_primary: 'Read the journal', cta_primary_link: 'internal:/products', image_side: 'left' } },
  {
    id: 'restaurant_menu',
    label: 'Menu / Food Items',
    description: 'Elegant menu sections — pulls your products as dishes',
    icon: List,
    defaultProps: {
      title: 'À la carte',
      subtitle: "Tonight's Menu · Updated daily",
      description: 'A six-course tasting menu that changes with the markets. Eat what we found this morning.',
      show_price: 'yes',
      show_description: 'yes',
      menu_spotlight_kicker: '',
      menu_spotlight_line1: 'Charred leek,',
      menu_spotlight_line2: 'brown butter,',
      menu_spotlight_accent: 'brown butter',
      menu_spotlight_line3: 'toasted hazelnut.',
      view_all_label: 'See the full menu →',
      menu_cta_link_size: 'sm',
      room_1_title: 'Dining Room',
      room_1_body: 'An eight-table room. Candlelight, low music, no rush.',
      room_2_title: 'The Counter',
      room_2_body: 'Six seats facing the open fire. Watch dinner happen.',
      room_3_title: 'Private',
      room_3_body: 'A back room for ten. Bring your people.',
    },
  },
  { id: 'specialties_grid', label: 'Specialties / Departments', description: 'Icon grid of services/departments (Healthcare, Clinic style)', icon: Briefcase, defaultProps: { title: 'Care, by department.', view_all_label: 'All services →' } },
  { id: 'trust_strip', label: 'Info Strip', description: 'Compact 3-column info bar — emergency contact, hours, pharmacy', icon: Shield, defaultProps: { bg_style: 'light', col_1: '● Emergency open 24/7 · call us', col_2: 'Walk-in lab · Mon–Sat 7:00–19:00', col_3: 'Free consultation available' } },
]

// ─── Templates ────────────────────────────────────────────────────────────────
interface TemplateDef {
  id: string; name: string; description: string; category: string
  gradient: string; tag?: string
  /** Hero screenshot under `vendor-web/public` for template picker tiles. */
  previewSrc?: string
  style: Partial<StyleConfig>; sectionOrder: string[]
}

const TEMPLATES: TemplateDef[] = [
  // ── Editorial vertical templates from Business Front UI Kit ──────────────────
  {
    id: 'atelier',
    name: 'Atelier · Retail',
    description: 'Editorial fashion/lifestyle — slow goods, serif typography, Fraunces display',
    category: 'retail',
    gradient: 'from-amber-100 to-orange-300',
    tag: 'Editorial',
    previewSrc: '/storefront-ui/retail-hero.jpg',
    style: {
      primary_color: '#2e1f14',
      secondary_color: '#5c3d27',
      accent_color: '#e55a23',
      bg_color: '#f5ede0',
      font_heading: 'Fraunces',
      font_body: 'Inter',
      border_radius: 'pill',
    },
    sectionOrder: ['announcement_bar', 'hero', 'marquee_strip', 'featured_products', 'category_showcase', 'editorial_split', 'testimonials', 'blog_grid', 'newsletter'],
  },
  {
    id: 'verde',
    name: 'Verde · Restaurant',
    description: 'Dark editorial restaurant — seasonal menus, reservation-first, dramatic typography',
    category: 'food',
    gradient: 'from-stone-700 to-stone-950',
    tag: 'Dark',
    previewSrc: '/storefront-ui/restaurant-hero.jpg',
    style: {
      primary_color: '#e8a33c',
      secondary_color: '#c2892e',
      accent_color: '#e8a33c',
      bg_color: '#0e1714',
      font_heading: 'Fraunces',
      font_body: 'Inter',
      border_radius: 'pill',
      dark_mode: true,
    },
    sectionOrder: ['hero', 'marquee_strip', 'restaurant_menu', 'about_us', 'testimonials', 'booking_widget', 'contact_map'],
  },
  {
    id: 'solace',
    name: 'Solace · Healthcare',
    description: 'Calm & trustworthy clinic/hospital — appointment booking, specialties grid',
    category: 'services',
    gradient: 'from-teal-200 to-emerald-400',
    tag: 'New',
    style: {
      primary_color: '#2e8a6e',
      secondary_color: '#236b56',
      accent_color: '#2e8a6e',
      bg_color: '#eff8f4',
      font_heading: 'Fraunces',
      font_body: 'Inter',
      border_radius: 'rounded',
    },
    sectionOrder: ['hero', 'trust_strip', 'specialties_grid', 'stats', 'testimonials', 'booking_widget', 'contact_map'],
    previewSrc: '/storefront-ui/hospital-hero.jpg',
  },
]

/** Default when no template is stored or an unknown id is loaded from the API. */
const DEFAULT_TEMPLATE_ID = 'atelier'

/** Defaults when applying storefront-ui.zip editorial templates (Atelier / Verde / Solace) */
const EDITORIAL_TEMPLATE_IDS = new Set(['atelier', 'verde', 'solace'])
function editorialHeroProps(tplId: string): SectionProps {
  if (tplId === 'atelier') return {
    bg_style: 'atelier',
    editorial_kicker: 'Spring Edit · Vol 04',
    headline: 'Quiet objects for loud seasons.',
    subtitle: 'A small collection of garments and homewares, made by hand in studios we know by name.',
    cta_primary: 'Shop the edit',
    cta_secondary: 'Lookbook',
    accent_phrase: 'loud',
  }
  if (tplId === 'verde') return {
    bg_style: 'verde',
    editorial_kicker: 'Est. 2024 · Brooklyn',
    headline: 'Seasonal,\nquietly seasonal.',
    accent_phrase: 'seasonal',
    subtitle: '',
    cta_primary: 'Reserve a table',
    cta_secondary: "View tonight's menu",
  }
  if (tplId === 'solace') return {
    bg_style: 'solace',
    editorial_kicker: 'Independent care · since 1998',
    headline: 'Quiet rooms.\nPatient hands.\nModern medicine.',
    accent_phrase: 'Patient',
    subtitle: 'A 90-bed independent hospital built around the unhurried appointment. Same-day bookings across 14 specialties.',
    cta_primary: 'Book an appointment',
    cta_secondary: 'Browse services',
  }
  return {}
}
function mergeTemplateSectionDefaults(tplId: string, list: BuilderSection[]): BuilderSection[] {
  return list.map(sec => {
    const def = SECTION_DEFS.find(d => d.id === sec.id)
    const base = { ...(def?.defaultProps || {}) }
    if (tplId === 'verde' && sec.id === 'marquee_strip') {
      return { ...sec, props: { ...base, ...sec.props, items: 'Open Tue–Sun · 17:00–23:00,Counter seating from 17:00,Wine list updated weekly,Walk-ins welcome at the bar' } }
    }
    if (tplId === 'atelier' && sec.id === 'marquee_strip') {
      return { ...sec, props: { ...base, ...sec.props, items: 'Free returns within 30 days,Made in small batches,Carbon-aware shipping,New drops every Friday' } }
    }
    if (tplId === 'solace' && sec.id === 'trust_strip') {
      return {
        ...sec,
        props: {
          ...base,
          ...sec.props,
          bg_style: ((sec.props as { bg_style?: SectionProps['bg_style'] }).bg_style || 'light') as SectionProps['bg_style'],
          col_1: 'Emergency open 24/7 · +1 (212) 555 0142',
          col_2: 'Walk-in lab · Mon–Sat 7:00–19:00',
          col_3: 'Pharmacy on site',
        },
      }
    }
    if (tplId === 'solace' && sec.id === 'stats') {
      return { ...sec, props: { ...base, ...sec.props, stat_1_value: '120+', stat_1_label: 'specialists in residence', stat_2_value: '14', stat_2_label: 'departments under one roof', stat_3_value: '98%', stat_3_label: 'of patients seen on time', stat_4_value: '', stat_4_label: '' } }
    }
    return sec
  })
}

const FONTS = [
  { id: 'Inter', name: 'Inter', specimen: 'Modern & readable' },
  { id: 'Poppins', name: 'Poppins', specimen: 'Friendly & bold' },
  { id: 'DM Sans', name: 'DM Sans', specimen: 'Clean & geometric' },
  { id: 'Space Grotesk', name: 'Space Grotesk', specimen: 'Technical & sharp' },
  { id: 'Playfair Display', name: 'Playfair Display', specimen: 'Elegant & editorial' },
  { id: 'Fraunces', name: 'Fraunces', specimen: 'Display & serif' },
  { id: 'Roboto', name: 'Roboto', specimen: 'Universal & clear' },
]

const COLOR_PALETTES = [
  { name: 'Mint', primary: '#64C3A0', secondary: '#13624A', accent: '#f59e0b' },
  { name: 'Blue', primary: '#2563eb', secondary: '#1d4ed8', accent: '#f97316' },
  { name: 'Rose', primary: '#be185d', secondary: '#831843', accent: '#fbbf24' },
  { name: 'Emerald', primary: '#059669', secondary: '#047857', accent: '#6366f1' },
  { name: 'Orange', primary: '#ea580c', secondary: '#c2410c', accent: '#16a34a' },
  { name: 'Sky', primary: '#0ea5e9', secondary: '#0284c7', accent: '#64C3A0' },
  { name: 'Slate', primary: '#334155', secondary: '#1e293b', accent: '#6366f1' },
  { name: 'Teal', primary: '#0d9488', secondary: '#0f766e', accent: '#f59e0b' },
]

// ─── Section label map for the info panel ────────────────────────────────────
const SECTION_LABEL_MAP: Record<string, string> = {
  announcement_bar: 'Announcement Bar', hero: 'Hero Banner', trust_badges: 'Trust Badges',
  featured_products: 'Featured Products', featured_services: 'Featured Services',
  category_showcase: 'Category Showcase', offers_banner: 'Offers Banner',
  testimonials: 'Testimonials', about_us: 'About Us', contact_map: 'Contact & Map',
  newsletter: 'Newsletter', job_board: 'Job Board', ess_login_card: 'Employee Portal',
  cta_banner: 'CTA Banner', store_locator: 'Store Locator',
  stats: 'Stats / Numbers', faq: 'FAQ', pricing: 'Pricing / Plans',
  gallery: 'Photo Gallery', blog_grid: 'Blog / News', video_embed: 'Video',
  social_links: 'Social Media Links', booking_widget: 'Booking Widget',
  marquee_strip: 'Marquee Ticker', editorial_split: 'Editorial Split',
  restaurant_menu: 'Menu / Food Items', specialties_grid: 'Specialties Grid',
  trust_strip: 'Info Strip',
}

/** Light templates must not keep dark_mode from a previous template (merge used to leave stale true). */
function coerceDarkModeForTemplate(bc: BuilderConfig): BuilderConfig {
  const tpl = TEMPLATES.find(t => t.id === bc.template_id)
  if (!tpl || tpl.style.dark_mode === true) return bc
  if (!bc.style.dark_mode) return bc
  return { ...bc, style: { ...bc.style, dark_mode: false } }
}

// ─── Link field helpers ───────────────────────────────────────────────────────
const LINK_TYPE_OPTIONS = [
  { value: 'none',     label: 'No link',       placeholder: '' },
  { value: 'internal', label: 'Store page →',  placeholder: '' },
  { value: 'external', label: 'External URL',  placeholder: 'https://example.com' },
  { value: 'phone',    label: 'Phone call',    placeholder: '+91 9000 000 000' },
  { value: 'email',    label: 'Email address', placeholder: 'hello@yourstore.com' },
  { value: 'booking',  label: 'Book a service', placeholder: '' },
]
const INTERNAL_ROUTES = [
  { value: '/products',          label: 'All Products' },
  { value: '/services',          label: 'All Services' },
  { value: '/cart',              label: 'Shopping Cart' },
  { value: '/checkout',          label: 'Checkout' },
  { value: '/account',           label: 'My Account' },
  { value: '/account/bookings',  label: 'My Bookings' },
  { value: '/employee',          label: 'Employee Portal' },
  { value: '/#hero',             label: '↕ Scroll to: Hero' },
  { value: '/#featured-products','label': '↕ Scroll to: Products' },
  { value: '/#featured-services','label': '↕ Scroll to: Services' },
  { value: '/#testimonials',     label: '↕ Scroll to: Reviews' },
  { value: '/#contact',          label: '↕ Scroll to: Contact' },
  { value: '/#newsletter',       label: '↕ Scroll to: Newsletter' },
]
function parseLinkValue(raw: string): { type: string; value: string } {
  if (!raw) return { type: 'none', value: '' }
  const colonIdx = raw.indexOf(':')
  if (colonIdx === -1) return { type: 'internal', value: raw }
  const prefix = raw.slice(0, colonIdx)
  const val = raw.slice(colonIdx + 1)
  return ['internal','external','phone','email','booking'].includes(prefix) ? { type: prefix, value: val } : { type: 'external', value: raw }
}
function formatLinkValue(type: string, value: string): string {
  if (!type || type === 'none') return ''
  if (type === 'booking') return 'booking:'
  return `${type}:${value}`
}

// ─── Section field definitions ────────────────────────────────────────────────
type FieldType = 'text' | 'textarea' | 'link' | 'date' | 'select' | 'color' | 'image' | 'toggle' | 'number'
interface FieldDef {
  key: string; label: string; type: FieldType
  placeholder?: string; hideable?: boolean; description?: string
  options?: { value: string; label: string }[]
  subFields?: Record<string, FieldDef[]>
  // number field extras
  min?: number; max?: number; unit?: string; defaultValue?: number; step?: number
}
const SECTION_FIELD_DEFS: Record<string, FieldDef[]> = {
  hero: [
    { key: 'headline',          label: 'Headline',             type: 'text',     placeholder: 'Welcome to your store',        hideable: true },
    { key: 'subtitle',          label: 'Subtitle',             type: 'textarea', placeholder: 'Quality products & services',   hideable: true },
    { key: 'cta_primary',       label: 'Primary Button Label', type: 'text',     placeholder: 'Shop Now',                     hideable: true },
    { key: 'cta_primary_link',  label: 'Primary Button Link',  type: 'link' },
    { key: 'cta_secondary',     label: 'Secondary Button',     type: 'text',     placeholder: 'Learn More',                   hideable: true },
    { key: 'cta_secondary_link',label: 'Secondary Button Link',type: 'link' },
    { key: 'section_height',    label: 'Section Height',       type: 'number',   min: 80, max: 400, defaultValue: 160, unit: 'px', description: 'Drag ← → to adjust the hero height' },
    {
      key: 'bg_style', label: 'Background Style', type: 'select',
      options: [
        { value: 'gradient', label: 'Gradient' },
        { value: 'image',    label: 'Image' },
        { value: 'minimal',  label: 'Minimal (White)' },
        { value: 'dark',     label: 'Dark' },
        { value: 'atelier',  label: 'Atelier (Retail UI kit)' },
        { value: 'verde',    label: 'Verde (Restaurant UI kit)' },
        { value: 'solace',   label: 'Solace (Healthcare UI kit)' },
      ],
      subFields: {
        image: [
          { key: 'bg_image_url', label: 'Background Image', type: 'image', description: 'Upload the image to use as the hero background' },
          { key: 'bg_overlay',   label: 'Overlay Darkness', type: 'select', description: 'Darkens the image so text stays readable', options: [{ value:'0',label:'None' },{ value:'30',label:'Light (30%)' },{ value:'50',label:'Medium (50%)' },{ value:'70',label:'Dark (70%)' }] },
        ],
        gradient: [
          { key: 'gradient_from', label: 'Gradient Start Colour', type: 'color' },
          { key: 'gradient_to',   label: 'Gradient End Colour',   type: 'color' },
        ],
        atelier: [
          { key: 'editorial_kicker', label: 'Eyebrow / Kicker', type: 'text', placeholder: 'Spring Edit · Vol 04', hideable: true, description: 'Small uppercase line above the headline' },
          { key: 'accent_phrase', label: 'Accent Word in Headline', type: 'text', placeholder: 'loud', description: 'One word or phrase in the headline styled in accent serif' },
        ],
        verde: [
          { key: 'editorial_kicker', label: 'Eyebrow / Kicker', type: 'text', placeholder: 'Est. 2024 · Brooklyn', hideable: true },
          { key: 'accent_phrase', label: 'Accent Word in Headline', type: 'text', placeholder: 'seasonal', description: 'Matched within the second line of the headline (after line break)' },
        ],
        solace: [
          { key: 'editorial_kicker', label: 'Eyebrow / Kicker', type: 'text', placeholder: 'Independent care · since 1998', hideable: true },
          { key: 'accent_phrase', label: 'Accent Word in Headline', type: 'text', placeholder: 'Patient', description: 'Styled in accent on the second line of the headline' },
        ],
      },
    },
  ],
  announcement_bar: [
    { key: 'announcement_text',  label: 'Message Text',            type: 'text',  placeholder: 'Free delivery on orders above ₹500!', hideable: true },
    { key: 'announcement_link',  label: 'Click-through Link',      type: 'link',  description: 'Where tapping the bar takes the customer' },
    { key: 'announcement_color', label: 'Bar Colour',              type: 'color' },
    { key: 'show_dismiss',       label: 'Allow customers to dismiss', type: 'toggle' },
  ],
  trust_badges: [
    { key: 'badge_1',      label: 'Badge 1 Text', type: 'text', placeholder: 'Free Shipping',   hideable: true },
    { key: 'badge_2',      label: 'Badge 2 Text', type: 'text', placeholder: 'Secure Payment',  hideable: true },
    { key: 'badge_3',      label: 'Badge 3 Text', type: 'text', placeholder: 'Easy Returns',    hideable: true },
    { key: 'badge_1_link', label: 'Badge 1 Link', type: 'link' },
    { key: 'badge_2_link', label: 'Badge 2 Link', type: 'link' },
    { key: 'badge_3_link', label: 'Badge 3 Link', type: 'link' },
  ],
  featured_products: [
    { key: 'title',         label: 'Section Title',   type: 'text',   placeholder: 'Featured Products', hideable: true },
    { key: 'layout',        label: 'Grid Columns',    type: 'select', options: [{ value:'grid-3',label:'3 Columns' },{ value:'grid-4',label:'4 Columns' }] },
    { key: 'card_height',   label: 'Card Height',     type: 'number', min: 80, max: 280, defaultValue: 140, unit: 'px', description: 'Drag ← → to resize product card images' },
    { key: 'view_all_link', label: '"See All" Link',  type: 'link',   description: 'Where "See all" takes the customer' },
  ],
  featured_services: [
    { key: 'title',            label: 'Section Title',        type: 'text',   placeholder: 'Our Services',                          hideable: true },
    { key: 'subtitle',         label: 'Section Subtitle',     type: 'text',   placeholder: 'Professional services tailored for you', hideable: true },
    { key: 'card_height',      label: 'Card Image Size',      type: 'number', min: 40, max: 120, defaultValue: 64, unit: 'px', description: 'Drag ← → to resize service card images' },
    { key: 'view_all_link',    label: '"See All" Link',       type: 'link' },
    { key: 'card_image',       label: 'Service Image / Icon', type: 'toggle', hideable: true, description: 'Show the thumbnail image or fallback icon on each card' },
    { key: 'card_description', label: 'Description',          type: 'toggle', hideable: true, description: 'Show short description text on each card' },
    { key: 'card_price',       label: 'Price',                type: 'toggle', hideable: true, description: 'Show price or "Get Quote" badge on each card' },
    { key: 'card_rating',      label: 'Star Rating',          type: 'toggle', hideable: true, description: 'Show average star rating on each card' },
    { key: 'card_duration',    label: 'Duration',             type: 'toggle', hideable: true, description: 'Show service duration (e.g. 30 min) on each card' },
  ],
  category_showcase: [
    { key: 'title',         label: 'Section Title', type: 'text', placeholder: 'Shop by Category', hideable: true },
    { key: 'view_all_link', label: '"View All" Link', type: 'link' },
  ],
  offers_banner: [
    { key: 'headline',       label: 'Offer Headline',    type: 'text',     placeholder: 'Special Offers',              hideable: true },
    { key: 'subtitle',       label: 'Offer Description', type: 'textarea', placeholder: 'Up to 50% off selected items', hideable: true },
    { key: 'offer_expiry',   label: 'Offer Expiry Date', type: 'date',     description: 'Shows a live countdown if set', hideable: true },
    { key: 'cta_primary',    label: 'CTA Button Label',  type: 'text',     placeholder: 'Shop Offers',                 hideable: true },
    { key: 'cta_primary_link',label: 'CTA Button Link',  type: 'link' },
  ],
  testimonials: [
    { key: 'title',  label: 'Section Title', type: 'text', placeholder: 'What Our Customers Say', hideable: true },
    {
      key: 'source', label: 'Review Source', type: 'select',
      options: [
        { value: 'store',  label: 'Your store reviews' },
        { value: 'google', label: 'Google Reviews link' },
        { value: 'manual', label: 'Manual entries' },
      ],
      subFields: {
        google: [
          { key: 'google_review_url', label: 'Google Business Review URL', type: 'text', placeholder: 'https://g.page/your-business/review', description: 'Paste your Google Maps / Business review link — customers will be redirected to leave a review' },
        ],
        manual: [
          { key: 'review_1_name', label: 'Review 1 — Customer Name', type: 'text',     placeholder: 'John D.' },
          { key: 'review_1_text', label: 'Review 1 — Review Text',   type: 'textarea', placeholder: '"Excellent service! Highly recommended."' },
          { key: 'review_2_name', label: 'Review 2 — Customer Name', type: 'text',     placeholder: 'Sarah M.' },
          { key: 'review_2_text', label: 'Review 2 — Review Text',   type: 'textarea', placeholder: '"Wonderful experience, will come back."' },
          { key: 'review_3_name', label: 'Review 3 — Customer Name', type: 'text',     placeholder: 'Raj K.' },
          { key: 'review_3_text', label: 'Review 3 — Review Text',   type: 'textarea', placeholder: '"Amazing quality, fast delivery."' },
        ],
      },
    },
  ],
  about_us: [
    { key: 'headline',        label: 'Headline',     type: 'text',     placeholder: 'About Us',                 hideable: true },
    { key: 'subtitle',        label: 'Tagline',      type: 'text',     placeholder: 'Our story and mission',    hideable: true },
    { key: 'description',     label: 'Description',  type: 'textarea', placeholder: 'Tell your brand story…',   hideable: true },
    { key: 'image_url',       label: 'Section Image', type: 'image',   hideable: true, description: 'Shown beside your story text. Defaults to your store logo.' },
    { key: 'image_size',      label: 'Image Size',   type: 'number',   min: 48, max: 160, defaultValue: 80, unit: 'px', description: 'Drag ← → to resize the about image' },
    { key: 'cta_primary',     label: 'CTA Button',   type: 'text',     placeholder: 'Learn More',               hideable: true },
    { key: 'cta_primary_link',label: 'CTA Link',     type: 'link' },
  ],
  contact_map: [
    { key: 'title',        label: 'Section Title',       type: 'text',   placeholder: 'Find Us',         hideable: true },
    { key: 'map_height',   label: 'Map Box Height',      type: 'number', min: 48, max: 200, defaultValue: 80, unit: 'px', description: 'Drag ← → to adjust the map placeholder height' },
    { key: 'show_map',     label: 'Show Map',            type: 'toggle' },
    { key: 'show_phone',   label: 'Show Phone Number',   type: 'toggle' },
    { key: 'show_email',   label: 'Show Email Address',  type: 'toggle' },
    { key: 'custom_phone', label: 'Override Phone',      type: 'text',   placeholder: '+91 9000 000 000', description: 'Leave blank to use your store phone', hideable: true },
    { key: 'custom_email', label: 'Override Email',      type: 'text',   placeholder: 'hello@yourstore.com', description: 'Leave blank to use your store email', hideable: true },
    { key: 'booking_link', label: 'Book Appointment Link', type: 'link', hideable: true },
  ],
  newsletter: [
    { key: 'headline',     label: 'Headline',             type: 'text', placeholder: 'Stay in the loop',      hideable: true },
    { key: 'subtitle',     label: 'Subtitle',             type: 'text', placeholder: 'Get exclusive deals first', hideable: true },
    { key: 'button_text',  label: 'Subscribe Button',     type: 'text', placeholder: 'Subscribe' },
    { key: 'privacy_note', label: 'Privacy Note',         type: 'text', placeholder: 'No spam, unsubscribe any time', hideable: true },
  ],
  job_board: [
    { key: 'title',      label: 'Section Title', type: 'text', placeholder: 'Join Our Team',    hideable: true },
    { key: 'subtitle',   label: 'Subtitle',      type: 'text', placeholder: 'We\'re hiring…',   hideable: true },
    { key: 'apply_link', label: 'Apply Link',    type: 'link', description: 'Where "Apply" buttons link to' },
  ],
  ess_login_card: [
    { key: 'headline',    label: 'Card Headline', type: 'text', placeholder: 'Employee Portal',                   hideable: true },
    { key: 'subtitle',    label: 'Subtitle',      type: 'text', placeholder: 'Access your self-service dashboard', hideable: true },
    { key: 'button_text', label: 'Button Label',  type: 'text', placeholder: 'Login →' },
  ],
  cta_banner: [
    { key: 'headline',          label: 'Headline',             type: 'text',     placeholder: 'Ready to get started?',           hideable: true },
    { key: 'subtitle',          label: 'Subtitle',             type: 'textarea', placeholder: 'Join thousands of satisfied customers', hideable: true },
    { key: 'section_height',    label: 'Banner Height',        type: 'number',   min: 80, max: 320, defaultValue: 140, unit: 'px', description: 'Drag ← → to adjust the CTA banner height' },
    { key: 'cta_primary',       label: 'Primary Button',       type: 'text',     placeholder: 'Get Started',                     hideable: true },
    { key: 'cta_primary_link',  label: 'Primary Button Link',  type: 'link' },
    { key: 'cta_secondary',     label: 'Secondary Button',     type: 'text',     placeholder: 'Learn More',                      hideable: true },
    { key: 'cta_secondary_link','label': 'Secondary Button Link', type: 'link' },
  ],
  store_locator: [
    { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Find a Store Near You', hideable: true },
  ],
  stats: [
    { key: 'stat_1_value', label: 'Stat 1 — Value', type: 'text', placeholder: '10K+', hideable: true },
    { key: 'stat_1_label', label: 'Stat 1 — Label', type: 'text', placeholder: 'Happy Customers', hideable: true },
    { key: 'stat_2_value', label: 'Stat 2 — Value', type: 'text', placeholder: '5★', hideable: true },
    { key: 'stat_2_label', label: 'Stat 2 — Label', type: 'text', placeholder: 'Average Rating', hideable: true },
    { key: 'stat_3_value', label: 'Stat 3 — Value', type: 'text', placeholder: '24/7', hideable: true },
    { key: 'stat_3_label', label: 'Stat 3 — Label', type: 'text', placeholder: 'Support', hideable: true },
    { key: 'stat_4_value', label: 'Stat 4 — Value', type: 'text', placeholder: '99%', hideable: true },
    { key: 'stat_4_label', label: 'Stat 4 — Label', type: 'text', placeholder: 'Satisfaction', hideable: true },
  ],
  faq: [
    { key: 'title',   label: 'Section Title', type: 'text', placeholder: 'Frequently Asked Questions', hideable: true },
    { key: 'faq_1_q', label: 'Question 1',    type: 'text',     placeholder: 'How do I place an order?',       hideable: true },
    { key: 'faq_1_a', label: 'Answer 1',      type: 'textarea', placeholder: 'Browse our catalogue…',          hideable: true },
    { key: 'faq_2_q', label: 'Question 2',    type: 'text',     placeholder: 'What payment methods?',          hideable: true },
    { key: 'faq_2_a', label: 'Answer 2',      type: 'textarea', placeholder: 'Cards, UPI, COD…',               hideable: true },
    { key: 'faq_3_q', label: 'Question 3',    type: 'text',     placeholder: 'How long does delivery take?',   hideable: true },
    { key: 'faq_3_a', label: 'Answer 3',      type: 'textarea', placeholder: '3–5 business days…',            hideable: true },
    { key: 'faq_4_q', label: 'Question 4',    type: 'text',     placeholder: 'Can I return an item?',          hideable: true },
    { key: 'faq_4_a', label: 'Answer 4',      type: 'textarea', placeholder: 'Yes, within 30 days…',           hideable: true },
  ],
  pricing: [
    { key: 'title',       label: 'Section Title', type: 'text', placeholder: 'Our Plans', hideable: true },
    { key: 'plan_1_name', label: 'Plan 1 — Name',        type: 'text',     placeholder: 'Basic',    hideable: true },
    { key: 'plan_1_price',label: 'Plan 1 — Price',       type: 'text',     placeholder: '₹999',     hideable: true },
    { key: 'plan_1_desc', label: 'Plan 1 — Description', type: 'textarea', placeholder: 'Essential features',    hideable: true },
    { key: 'plan_1_cta',  label: 'Plan 1 — Button',      type: 'text',     placeholder: 'Get Started',           hideable: true },
    { key: 'plan_1_cta_link', label: 'Plan 1 — Button Link', type: 'link' },
    { key: 'plan_2_name', label: 'Plan 2 — Name',        type: 'text',     placeholder: 'Standard', hideable: true },
    { key: 'plan_2_price',label: 'Plan 2 — Price',       type: 'text',     placeholder: '₹1,999',   hideable: true },
    { key: 'plan_2_desc', label: 'Plan 2 — Description', type: 'textarea', placeholder: 'Best for growing',      hideable: true },
    { key: 'plan_2_cta',  label: 'Plan 2 — Button',      type: 'text',     placeholder: 'Choose Plan',           hideable: true },
    { key: 'plan_2_cta_link', label: 'Plan 2 — Button Link', type: 'link' },
    { key: 'plan_3_name', label: 'Plan 3 — Name',        type: 'text',     placeholder: 'Premium',  hideable: true },
    { key: 'plan_3_price',label: 'Plan 3 — Price',       type: 'text',     placeholder: '₹3,999',   hideable: true },
    { key: 'plan_3_desc', label: 'Plan 3 — Description', type: 'textarea', placeholder: 'Full access + support', hideable: true },
    { key: 'plan_3_cta',  label: 'Plan 3 — Button',      type: 'text',     placeholder: 'Contact Sales',         hideable: true },
    { key: 'plan_3_cta_link', label: 'Plan 3 — Button Link', type: 'link' },
  ],
  gallery: [
    { key: 'title',   label: 'Section Title', type: 'text', placeholder: 'Our Gallery', hideable: true },
    { key: 'columns', label: 'Grid Columns',  type: 'select', options: [{ value: '2', label: '2 Columns' }, { value: '3', label: '3 Columns' }] },
    { key: 'image_1', label: 'Photo 1', type: 'image', hideable: true },
    { key: 'image_2', label: 'Photo 2', type: 'image', hideable: true },
    { key: 'image_3', label: 'Photo 3', type: 'image', hideable: true },
    { key: 'image_4', label: 'Photo 4', type: 'image', hideable: true },
    { key: 'image_5', label: 'Photo 5', type: 'image', hideable: true },
    { key: 'image_6', label: 'Photo 6', type: 'image', hideable: true },
  ],
  blog_grid: [
    { key: 'title',        label: 'Section Title',   type: 'text', placeholder: 'Latest News & Updates', hideable: true },
    { key: 'view_all_link',label: '"View All" Link', type: 'link', description: 'Where "View all" takes the customer' },
  ],
  video_embed: [
    { key: 'title',       label: 'Section Title',          type: 'text',   placeholder: 'Watch Our Story', hideable: true },
    { key: 'video_url',   label: 'YouTube / Vimeo URL',    type: 'text',   placeholder: 'https://youtube.com/watch?v=...' },
    { key: 'video_height',label: 'Player Height',          type: 'number', min: 80, max: 300, defaultValue: 160, unit: 'px', description: 'Drag ← → to adjust video height' },
  ],
  social_links: [
    { key: 'title',           label: 'Section Title',   type: 'text', placeholder: 'Follow Us',                     hideable: true },
    { key: 'instagram_url',   label: 'Instagram URL',   type: 'text', placeholder: 'https://instagram.com/yourhandle', hideable: true },
    { key: 'facebook_url',    label: 'Facebook URL',    type: 'text', placeholder: 'https://facebook.com/yourpage',   hideable: true },
    { key: 'youtube_url',     label: 'YouTube URL',     type: 'text', placeholder: 'https://youtube.com/@yourchannel',hideable: true },
    { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'text', placeholder: '+91 9000 000 000',               hideable: true },
    { key: 'twitter_url',     label: 'Twitter / X URL', type: 'text', placeholder: 'https://twitter.com/yourhandle', hideable: true },
    { key: 'linkedin_url',    label: 'LinkedIn URL',    type: 'text', placeholder: 'https://linkedin.com/company/…', hideable: true },
  ],
  booking_widget: [
    { key: 'title',        label: 'Section Title', type: 'text', placeholder: 'Book an Appointment',         hideable: true },
    { key: 'subtitle',     label: 'Subtitle',      type: 'text', placeholder: 'Choose a time that works for you', hideable: true },
    { key: 'cta_label',    label: 'Button Label',  type: 'text', placeholder: 'Book Now' },
    { key: 'booking_link', label: 'Booking Link',  type: 'link', description: 'Where the Book Now button links to' },
  ],
  marquee_strip: [
    { key: 'items', label: 'Ticker Items', type: 'textarea', placeholder: 'Free shipping,New drop every Friday,Handcrafted', description: 'Comma-separated list of ticker phrases' },
    { key: 'speed', label: 'Speed', type: 'select', options: [{ value: 'slow', label: 'Slow (40s)' }, { value: 'normal', label: 'Normal (25s)' }, { value: 'fast', label: 'Fast (15s)' }] },
  ],
  editorial_split: [
    { key: 'subtitle',        label: 'Eyebrow / Label',  type: 'text',     placeholder: 'A note from the studio',     hideable: true },
    { key: 'headline',        label: 'Headline',         type: 'text',     placeholder: 'Made slowly, on purpose.',   hideable: true },
    { key: 'accent_phrase',   label: 'Italic Accent Word', type: 'text',   placeholder: 'on purpose.', description: 'One word or phrase in the headline to style in accent serif (Atelier / Verde)' },
    { key: 'description',     label: 'Body Text',        type: 'textarea', placeholder: 'Every piece passes through…', hideable: true },
    { key: 'cta_primary',     label: 'CTA Button',       type: 'text',     placeholder: 'Read the journal',           hideable: true },
    { key: 'cta_primary_link',label: 'CTA Link',         type: 'link' },
    { key: 'image_url',       label: 'Section Image',    type: 'image',    description: 'Side image for the split layout' },
    { key: 'image_side',      label: 'Image Position',   type: 'select',   options: [{ value: 'left', label: 'Image Left' }, { value: 'right', label: 'Image Right' }] },
  ],
  restaurant_menu: [
    { key: 'title',         label: 'Page Title',       type: 'text', placeholder: 'À la carte',          hideable: true },
    { key: 'subtitle',      label: 'Subtitle',         type: 'text', placeholder: "Tonight's Menu · Updated daily", hideable: true, description: 'Non-Verde: small line above the title. Verde: spotlight eyebrow if “Spotlight kicker” is empty.' },
    { key: 'description',   label: 'Intro paragraph',   type: 'textarea', placeholder: 'A six-course tasting menu that changes with the markets…', hideable: true, description: 'Verde: paragraph under the large spotlight headline' },
    { key: 'menu_spotlight_kicker', label: 'Spotlight kicker (Verde)', type: 'text', placeholder: 'Tonight', hideable: true, description: 'Optional. Overrides subtitle for the small line above the spotlight headline only.' },
    { key: 'menu_spotlight_line1', label: 'Spotlight — line 1', type: 'text', placeholder: 'Charred leek,', hideable: true },
    { key: 'menu_spotlight_line2', label: 'Spotlight — line 2', type: 'text', placeholder: 'brown butter,', hideable: true, description: 'Include the accent phrase text; the next field picks which substring is styled.' },
    { key: 'menu_spotlight_accent', label: 'Spotlight — accent phrase', type: 'text', placeholder: 'brown butter', hideable: true },
    { key: 'menu_spotlight_line3', label: 'Spotlight — line 3', type: 'text', placeholder: 'toasted hazelnut.', hideable: true },
    { key: 'view_all_label', label: '"See full menu" label', type: 'text', placeholder: 'See the full menu →', hideable: true },
    { key: 'view_all_link', label: '"See full menu" link', type: 'link' },
    {
      key: 'menu_cta_link_size',
      label: 'Menu link size (Verde)',
      type: 'select',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'base', label: 'Base' },
        { value: 'lg', label: 'Large' },
        { value: 'xl', label: 'Extra large' },
      ],
    },
    {
      key: 'menu_spotlight_kicker_size',
      label: 'Spotlight kicker — size',
      type: 'select',
      description: 'Verde template only. Leave “Theme default” for original sizing.',
      options: [
        { value: '', label: 'Theme default' },
        { value: 'xs', label: 'Extra small' },
        { value: 'sm', label: 'Small' },
        { value: 'base', label: 'Medium' },
        { value: 'lg', label: 'Large' },
      ],
    },
    { key: 'menu_spotlight_kicker_color', label: 'Spotlight kicker — colour', type: 'color', description: 'Clear hex field for theme default', hideable: true },
    {
      key: 'menu_spotlight_headline_size',
      label: 'Spotlight headline — size',
      type: 'select',
      options: [
        { value: '', label: 'Theme default' },
        { value: 'compact', label: 'Compact' },
        { value: 'large', label: 'Large' },
        { value: 'display', label: 'Display (largest)' },
      ],
    },
    { key: 'menu_spotlight_headline_color', label: 'Spotlight headline — colour (lines 1 & 3)', type: 'color', description: 'Clear for default ink', hideable: true },
    { key: 'menu_spotlight_accent_color', label: 'Spotlight — accent phrase colour', type: 'color', description: 'Clear for theme accent', hideable: true },
    {
      key: 'menu_spotlight_intro_size',
      label: 'Intro paragraph — size',
      type: 'select',
      options: [
        { value: '', label: 'Theme default' },
        { value: 'sm', label: 'Small' },
        { value: 'base', label: 'Base' },
        { value: 'lg', label: 'Large' },
        { value: 'xl', label: 'Extra large' },
        { value: '2xl', label: '2× large' },
      ],
    },
    { key: 'menu_spotlight_intro_color', label: 'Intro paragraph — colour', type: 'color', description: 'Clear for default', hideable: true },
    { key: 'menu_cta_link_color', label: '“See full menu” link — colour', type: 'color', description: 'Clear for default', hideable: true },
    {
      key: 'menu_list_heading_size',
      label: 'Menu block title (“À la carte”) — size',
      type: 'select',
      options: [
        { value: '', label: 'Theme default' },
        { value: 'sm', label: 'Small' },
        { value: 'base', label: 'Base' },
        { value: 'lg', label: 'Large' },
        { value: 'xl', label: 'Extra large' },
      ],
    },
    { key: 'menu_list_heading_color', label: 'Menu block title — colour', type: 'color', description: 'Clear for default', hideable: true },
    {
      key: 'room_card_title_size',
      label: 'Room cards — title size',
      type: 'select',
      options: [
        { value: '', label: 'Theme default' },
        { value: 'sm', label: 'Small' },
        { value: 'base', label: 'Base' },
        { value: 'lg', label: 'Large' },
        { value: 'xl', label: 'Extra large' },
      ],
    },
    { key: 'room_card_title_color', label: 'Room cards — title colour', type: 'color', description: 'Clear for default', hideable: true },
    {
      key: 'room_card_body_size',
      label: 'Room cards — body size',
      type: 'select',
      options: [
        { value: '', label: 'Theme default' },
        { value: 'xs', label: 'Extra small' },
        { value: 'sm', label: 'Small' },
        { value: 'base', label: 'Base' },
      ],
    },
    { key: 'room_card_body_color', label: 'Room cards — body colour', type: 'color', description: 'Clear for default', hideable: true },
    { key: 'room_1_title', label: 'Room card 1 — title', type: 'text', placeholder: 'Dining Room', hideable: true },
    { key: 'room_1_body', label: 'Room card 1 — text', type: 'textarea', placeholder: 'An eight-table room…', hideable: true },
    { key: 'room_2_title', label: 'Room card 2 — title', type: 'text', placeholder: 'The Counter', hideable: true },
    { key: 'room_2_body', label: 'Room card 2 — text', type: 'textarea', placeholder: 'Six seats facing…', hideable: true },
    { key: 'room_3_title', label: 'Room card 3 — title', type: 'text', placeholder: 'Private', hideable: true },
    { key: 'room_3_body', label: 'Room card 3 — text', type: 'textarea', placeholder: 'A back room for ten…', hideable: true },
    { key: 'show_price',    label: 'Show Prices',      type: 'toggle', hideable: true },
    { key: 'show_description', label: 'Show Descriptions', type: 'toggle', hideable: true },
    { key: 'note',          label: 'Allergy / Footer Note', type: 'textarea', placeholder: 'Please inform your server of any allergies.', hideable: true },
  ],
  specialties_grid: [
    { key: 'title',          label: 'Section Title',   type: 'text', placeholder: 'Care, by department.', hideable: true },
    { key: 'view_all_label', label: '"All services" Label', type: 'text', placeholder: 'All services →', hideable: true },
    { key: 'view_all_link',  label: '"All services" Link', type: 'link' },
    { key: 'cta_label',      label: 'Card CTA Label',  type: 'text', placeholder: 'Book →', hideable: true },
  ],
  trust_strip: [
    { key: 'col_1', label: 'Column 1 Text', type: 'text', placeholder: '● Emergency open 24/7 · call us',    hideable: true },
    { key: 'col_2', label: 'Column 2 Text', type: 'text', placeholder: 'Walk-in lab · Mon–Sat 7:00–19:00',   hideable: true },
    { key: 'col_3', label: 'Column 3 Text', type: 'text', placeholder: 'Free consultation available',         hideable: true },
    { key: 'bg_style', label: 'Strip Style', type: 'select', options: [{ value: 'light', label: 'Light (page tint)' }, { value: 'dark', label: 'Dark (ink)' }, { value: 'accent', label: 'Accent colour' }] },
  ],
}

// ─── Business Front pages directory ───────────────────────────────────────────────
interface StorefrontPageDef {
  route: string; label: string; icon: React.ElementType
  description: string; features: string[]
  requiresModule?: keyof ModulesConfig; editableInBuilder: boolean; editorHint?: string
}
const STOREFRONT_PAGES: StorefrontPageDef[] = [
  { route: '/', label: 'Home Page', icon: Home, description: 'Your main business front — all sections you configure in this builder appear here in the order you set.', features: ['Hero banner', 'Announcement bar', 'Product & service grids', 'Category showcase', 'Testimonials & reviews', 'Newsletter opt-in', 'Contact map', 'Any custom sections you add'], editableInBuilder: true, editorHint: 'Edit sections using the Sections tab in the left panel' },
  { route: '/products', label: 'Products Catalogue', icon: ShoppingBag, description: 'Auto-generated product listing page with search, filters and sorting. Populated from your product catalogue.', features: ['Full-text search bar', 'Category & price filters', 'Sort by: price / rating / newest', 'Grid / list view toggle', 'Pagination'], editableInBuilder: false },
  { route: '/products/:slug', label: 'Product Detail Page', icon: Package, description: 'Individual product page with gallery, variants, buy actions, and related products.', features: ['Product image gallery', 'Variant & size selector', 'Add to cart / buy now', 'Star ratings & reviews', 'Related / upsell products', 'Delivery & return info'], editableInBuilder: true, editorHint: 'Uses the classic product layout by default.' },
  { route: '/services', label: 'Services Catalogue', icon: Wrench, description: 'All your services with booking and enquiry CTAs. Auto-populated from your services list.', features: ['Service cards with duration & price', 'Book now button', 'Filter by category', 'Enquiry form'], editableInBuilder: false },
  { route: '/services/:slug', label: 'Service Detail Page', icon: Tag, description: 'Individual service page with full description, gallery, pricing tiers and booking calendar.', features: ['Service gallery', 'Booking calendar widget', 'Pricing tiers & packages', 'Customer reviews', 'FAQ section'], editableInBuilder: false },
  { route: '/cart', label: 'Shopping Cart', icon: ShoppingBag, description: 'Customer cart — shows selected items, quantities, totals and a checkout button.', features: ['Item list with quantity controls', 'Remove item option', 'Coupon code input', 'Order value summary', 'Proceed to checkout CTA'], editableInBuilder: false },
  { route: '/checkout', label: 'Checkout', icon: CreditCard, description: 'Secure checkout flow with shipping address, payment selection and order confirmation.', features: ['Shipping address entry', 'Delivery method picker', 'Payment options (card / UPI / COD)', 'Order summary review', 'Order confirmation & email'], editableInBuilder: false },
  { route: '/account', label: 'Customer Account', icon: User, description: 'Self-service portal for customers — manage orders, bookings, profile and addresses.', features: ['Order history & tracking', 'Booking history & reschedule', 'Profile & address book', 'Password change', 'Loyalty points / wallet (if enabled)'], editableInBuilder: false },
  { route: '/account/bookings', label: 'My Bookings', icon: Calendar, description: "Customer's service booking history with reschedule and cancel options.", features: ['Upcoming & past bookings', 'Reschedule button', 'Cancel with policy check', 'Add to calendar'], editableInBuilder: false },
  { route: '/employee', label: 'Employee Portal Login', icon: UserCheck, description: 'Separate login page for employees — uses different credentials from customer accounts.', features: ['Employee-only login form', 'Matches your store branding', 'No access to customer data', 'Links to ESS dashboard after login'], requiresModule: 'ess_portal', editableInBuilder: true, editorHint: 'Enable in the Modules tab → Employee Portal' },
  { route: '/employee/dashboard', label: 'ESS Dashboard', icon: LayoutDashboard, description: 'Employee self-service hub accessible after login. All HR modules the employee has access to appear here.', features: ['Attendance check-in / check-out', 'Leave requests & balances', 'Payslip download', 'HR announcements', 'Expense claim submission', 'Training & policy documents'], requiresModule: 'ess_portal', editableInBuilder: false },
  { route: '/auth/login', label: 'Customer Login / Register', icon: LogIn, description: 'Authentication page — phone OTP, email or social login. Brand colours and logo auto-applied.', features: ['Phone OTP login', 'Email & password login', 'New account registration', 'Password reset flow'], editableInBuilder: false },
]

// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULT_STYLE: StyleConfig = { primary_color: '#64C3A0', secondary_color: '#13624A', accent_color: '#f59e0b', bg_color: '#ffffff', font_heading: 'Inter', font_body: 'Inter', border_radius: 'rounded', spacing: 'comfortable', animation: 'subtle', dark_mode: false }
const DEFAULT_MODULES: ModulesConfig = { ess_portal: false, ess_access: 'footer_link', crm_widget: false, job_board: false, customer_reviews: true, newsletter: true, b2b_portal: false, online_booking: false, store_locator: false, store_locator_limit: 6, store_locator_geo: false, store_locator_layout: 'grid', store_locator_filter: 'none' }
const DEFAULT_SECTIONS: BuilderSection[] = [
  { id: 'hero', visible: true, props: { headline: '', subtitle: '', cta_primary: 'Shop Now', cta_secondary: 'Learn More', bg_style: 'gradient' } },
  { id: 'trust_badges', visible: true, props: { badge_1: 'Free Shipping', badge_2: 'Secure Payment', badge_3: 'Easy Returns' } },
  { id: 'featured_products', visible: true, props: { title: 'Featured Products', layout: 'grid-3' } },
  { id: 'featured_services', visible: false, props: { title: 'Our Services' } },
  { id: 'offers_banner', visible: true, props: { headline: 'Special Offers', subtitle: 'Up to 50% off selected items' } },
  { id: 'testimonials', visible: true, props: { title: 'What Our Customers Say' } },
  { id: 'cta_banner', visible: true, props: { headline: 'Ready to get started?', cta_primary: 'Get Started' } },
]
const BLANK_CONFIG: BuilderConfig = { template_id: DEFAULT_TEMPLATE_ID, product_detail_template: 'classic', sections: DEFAULT_SECTIONS, style: DEFAULT_STYLE, modules: DEFAULT_MODULES, seo: { page_title: '', meta_description: '', og_image_url: '' } }

/** Apply a homepage template’s section order + styles (same merge rules as “Apply template” in the UI). */
function buildConfigPatchForTemplate(tplId: string, current: BuilderConfig): Partial<BuilderConfig> {
  const tpl = TEMPLATES.find(t => t.id === tplId) ?? TEMPLATES.find(t => t.id === DEFAULT_TEMPLATE_ID)
  if (!tpl) return {}
  const heroKit = EDITORIAL_TEMPLATE_IDS.has(tpl.id) ? editorialHeroProps(tpl.id) : {}
  const sectionList: BuilderSection[] = tpl.sectionOrder.map(id => {
    const def = SECTION_DEFS.find(d => d.id === id)
    const existing = current.sections.find(s => s.id === id)
    const defaults = { ...(def?.defaultProps || {}), ...(id === 'hero' ? heroKit : {}) }
    return existing
      ? { ...existing, visible: true, props: { ...defaults, ...(existing.props || {}), ...(id === 'hero' ? heroKit : {}) } }
      : { id, visible: true, props: defaults }
  })
  const merged = mergeTemplateSectionDefaults(tpl.id, sectionList)
  const remaining = current.sections.filter(s => !tpl.sectionOrder.includes(s.id)).map(s => ({ ...s, visible: false }))
  return {
    template_id: tpl.id,
    sections: [...merged, ...remaining],
    style: { ...current.style, ...tpl.style, dark_mode: tpl.style.dark_mode === true },
  }
}

/** Maps legacy removed template ids (e.g. saved API configs) onto a supported preset. */
function normalizeRemovedTemplateIds(bc: BuilderConfig): BuilderConfig {
  if (bc.template_id === 'wellness') {
    return { ...bc, ...buildConfigPatchForTemplate('solace', bc) } as BuilderConfig
  }
  if (TEMPLATES.some(t => t.id === bc.template_id)) return bc
  return { ...bc, ...buildConfigPatchForTemplate(DEFAULT_TEMPLATE_ID, bc) } as BuilderConfig
}

// ─── AI Engine ────────────────────────────────────────────────────────────────
function runAI(prompt: string, vendor: Vendor | null, current: BuilderConfig): { reply: string; patch: Partial<BuilderConfig> } {
  const p = prompt.toLowerCase()
  if (p.includes('dark') || p.includes('night') || p.includes('bold')) return { reply: "Switched to a bold dark theme — great for premium or creative brands.", patch: { style: { ...current.style, primary_color: '#64C3A0', secondary_color: '#13624A', bg_color: '#0f0a1e', dark_mode: true } } }
  if (p.includes('warm') || p.includes('cozy') || p.includes('food') || p.includes('restaurant') || p.includes('cafe')) return { reply: "Applied the **Verde** restaurant layout — dark editorial dining with menu and booking sections.", patch: buildConfigPatchForTemplate('verde', current) }
  if (p.includes('minimal') || p.includes('clean') || p.includes('simple') || p.includes('white')) return { reply: "Switched to the **Atelier** editorial retail layout — clean whitespace and Fraunces typography.", patch: buildConfigPatchForTemplate('atelier', current) }
  if (p.includes('professional') || p.includes('corporate') || p.includes('business') || p.includes('formal')) return { reply: "Applied a professional blue palette — great for B2B or corporate brands.", patch: { style: { ...current.style, primary_color: '#1e40af', secondary_color: '#1e3a8a', accent_color: '#0ea5e9', bg_color: '#f8faff', font_heading: 'DM Sans' } } }
  if (p.includes('green') || p.includes('eco') || p.includes('nature') || p.includes('organic') || p.includes('wellness') || p.includes('health')) {
    const w = buildConfigPatchForTemplate('solace', current)
    return { reply: "Green palette applied — earthy and trustworthy, aligned with the **Solace** healthcare preset.", patch: { ...w, style: { ...w.style!, primary_color: '#059669', secondary_color: '#047857', accent_color: '#84cc16', bg_color: '#f0fdf4', font_heading: 'Poppins' } } }
  }
  if (p.includes('pink') || p.includes('fashion') || p.includes('boutique') || p.includes('luxury') || p.includes('elegant')) return { reply: "Applied the **Atelier** editorial layout — premium retail typography and storytelling blocks.", patch: buildConfigPatchForTemplate('atelier', current) }
  if (p.includes('tech') || p.includes('startup') || p.includes('saas') || p.includes('software')) return { reply: "Applied the **Atelier** editorial layout — strong display type and product storytelling.", patch: buildConfigPatchForTemplate('atelier', current) }
  if (p.includes('employee') || p.includes('ess') || p.includes('staff') || p.includes('portal')) {
    const already = current.sections.find(s => s.id === 'ess_login_card')
    const sections = already ? current.sections : [...current.sections, { id: 'ess_login_card', visible: true, props: { headline: 'Employee Portal', subtitle: 'Access your self-service dashboard' } }]
    return { reply: "Enabled the Employee Portal module and added an ESS login card section.", patch: { modules: { ...current.modules, ess_portal: true }, sections } }
  }
  if (p.includes('chat') || p.includes('support') || p.includes('widget') || p.includes('crm')) return { reply: "Live chat widget enabled — customers can reach you directly from the business front.", patch: { modules: { ...current.modules, crm_widget: true } } }
  if (p.includes('job') || p.includes('hiring') || p.includes('career') || p.includes('recruitment')) return { reply: "Job Board section enabled — your open HR positions will appear on the business front.", patch: { modules: { ...current.modules, job_board: true } } }
  if (p.includes('newsletter') || p.includes('email') || p.includes('subscribe')) return { reply: "Newsletter signup enabled — great for building your email list.", patch: { modules: { ...current.modules, newsletter: true } } }
  if (p.includes('compact') || p.includes('dense') || p.includes('tight')) return { reply: "Compact spacing applied — more content visible above the fold.", patch: { style: { ...current.style, spacing: 'compact' } } }
  if (p.includes('spacious') || p.includes('airy') || p.includes('breathe')) return { reply: "Spacious layout applied — elegant and breathable.", patch: { style: { ...current.style, spacing: 'spacious' } } }
  if (p.includes('round') || p.includes('soft') || p.includes('pill') || p.includes('curved')) return { reply: "Pill-shaped borders applied — soft and friendly aesthetic.", patch: { style: { ...current.style, border_radius: 'pill' } } }
  if (p.includes('sharp') || p.includes('square') || p.includes('angular')) return { reply: "Sharp corners applied — clean and structured.", patch: { style: { ...current.style, border_radius: 'sharp' } } }
  if (p.includes('more') || p.includes('option') || p.includes('alternative') || p.includes('different') || p.includes('another')) {
    const current_idx = TEMPLATES.findIndex(t => t.id === current.template_id)
    const next = TEMPLATES[(current_idx + 1) % TEMPLATES.length]
    return { reply: `Here's the **${next.name}** template — ${next.description}. Applied to your preview!`, patch: { template_id: next.id, style: { ...current.style, ...next.style, dark_mode: next.style.dark_mode === true } } }
  }
  if (vendor?.business_type) {
    const bt = vendor.business_type.toLowerCase()
    if (bt.includes('restaurant') || bt.includes('food') || bt.includes('cafe')) return { reply: `Since you're a ${vendor.business_type}, I've applied the **Verde** restaurant layout.`, patch: buildConfigPatchForTemplate('verde', current) }
  }
  return { reply: "I've refreshed your business front with a balanced look. Try prompts like 'make it dark', 'warm tones for a restaurant', 'minimal and clean', or 'add employee portal'!", patch: { style: { ...current.style, primary_color: '#6366f1', secondary_color: '#4f46e5', accent_color: '#f59e0b' } } }
}

function buildAIDefaults(vendor: Vendor | null): BuilderConfig {
  if (!vendor) return BLANK_CONFIG
  const bt = (vendor.business_type || '').toLowerCase()
  const ot = vendor.offering_type || 'both'
  let templateId = DEFAULT_TEMPLATE_ID
  if (bt.includes('restaurant') || bt.includes('food') || bt.includes('cafe') || bt.includes('bakery')) templateId = 'verde'
  else if (bt.includes('clinic') || bt.includes('health') || bt.includes('fitness') || bt.includes('hospital') || bt.includes('dental') || bt.includes('medical')) templateId = 'solace'
  else if (bt.includes('spa') || bt.includes('salon') || bt.includes('wellness')) templateId = 'solace'
  else if (bt.includes('fashion') || bt.includes('boutique') || bt.includes('jewel') || bt.includes('apparel') || bt.includes('cloth')) templateId = 'atelier'
  else if (bt.includes('tech') || bt.includes('software') || bt.includes('startup') || bt.includes('saas')) templateId = 'atelier'
  else if (bt.includes('consult') || bt.includes('agency') || bt.includes('legal') || bt.includes('account')) templateId = 'solace'
  else if (ot === 'services') templateId = 'solace'
  else if (ot === 'products') templateId = 'atelier'

  const seed: BuilderConfig = { ...BLANK_CONFIG, seo: { page_title: `${vendor.display_name || vendor.business_name}`, meta_description: `Welcome to ${vendor.display_name || vendor.business_name}.`, og_image_url: '' } }
  const patch = buildConfigPatchForTemplate(templateId, seed)
  return coerceDarkModeForTemplate({
    ...seed,
    template_id: patch.template_id ?? templateId,
    sections: patch.sections ?? seed.sections,
    style: patch.style ?? seed.style,
  })
}

/** Hero / about images: support blob previews and persisted API-relative paths. */
function resolveStorefrontPreviewImageSrc(raw?: string | null): string {
  if (!raw) return ''
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw
  return mediaUrl(raw)
}

function homeThemeFromDraft(style: StyleConfig): HomeSectionTheme {
  return {
    colors: {
      primary: style.primary_color,
      secondary: style.secondary_color,
      accent: style.accent_color,
      background: style.bg_color,
    },
    font: style.font_heading,
    font_body: style.font_body,
    hero_style: 'gradient',
    hero_title: '',
    hero_subtitle: '',
    hero_height: 'medium',
    hero_image_url: '',
    button_radius: style.border_radius,
  }
}

/** Map builder hero `section_height` (px) to ThemeConfig-style hero_height used by shared HeroSection. */
function heroHeightFromSectionProps(props: HomeSectionProps): HomeSectionTheme['hero_height'] {
  const raw = props.section_height
  const n = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
  if (!Number.isFinite(n) || n <= 0) return 'medium'
  if (n < 260) return 'compact'
  if (n < 480) return 'medium'
  return 'tall'
}

function homeThemeForHero(style: StyleConfig, props: HomeSectionProps): HomeSectionTheme {
  return { ...homeThemeFromDraft(style), hero_height: heroHeightFromSectionProps(props) }
}

function previewSectionPropsWithResolvedImages(props: HomeSectionProps): HomeSectionProps {
  const raw = props.bg_image_url
  if (typeof raw === 'string' && raw.trim()) {
    return { ...props, bg_image_url: resolveStorefrontPreviewImageSrc(raw) }
  }
  return props
}

// ─── Media URL helper (uses @/lib/utils mediaUrl for proxy-aware resolution) ──

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StorefrontBuilderPage() {
  const qc = useQueryClient()
  const vendor = useVendorStore(s => s.vendor)

  const [draft, setDraft] = useState<BuilderConfig>(BLANK_CONFIG)
  const [activeTab, setActiveTab] = useState<BuilderTab>('style')
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([{ role: 'ai', content: `Hi! I'm your AI business front assistant. Describe your brand or what you'd like to change — e.g. "make it dark and bold", "warm tones for a restaurant", or "add an employee portal".` }])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showMoreTemplates, setShowMoreTemplates] = useState(false)
  const [isGeneratingDefaults, setIsGeneratingDefaults] = useState(false)
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [draggedSectionIdx, setDraggedSectionIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  /** Style tab: theme controls below checkout; "Fewer" hides them, "Expanded" shows all. */
  const [styleDetailsExpanded, setStyleDetailsExpanded] = useState(true)
  const [panelMode, setPanelMode] = useState<'properties' | 'pages'>('properties')
  const [scrollTrigger, setScrollTrigger] = useState(0)
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null)
  const activeFieldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [blinkSectionId, setBlinkSectionId] = useState<string | null>(null)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const historyStack = useRef<BuilderConfig[]>([])
  const historyIdx   = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const pushHistory = useCallback((config: BuilderConfig) => {
    historyStack.current = historyStack.current.slice(0, historyIdx.current + 1)
    historyStack.current.push(JSON.parse(JSON.stringify(config)))
    historyIdx.current = historyStack.current.length - 1
    setCanUndo(historyIdx.current > 0)
    setCanRedo(false)
  }, [])

  /** Use instead of setDraft whenever the change should be undoable */
  const commitDraft = useCallback((patch: Partial<BuilderConfig> | ((prev: BuilderConfig) => BuilderConfig)) => {
    setDraft(prev => {
      pushHistory(prev)
      return typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    })
  }, [pushHistory])

  const handleUndo = useCallback(() => {
    if (historyIdx.current <= 0) return
    historyIdx.current -= 1
    const snap = historyStack.current[historyIdx.current]
    if (snap) { setDraft(snap); setCanUndo(historyIdx.current > 0); setCanRedo(true) }
  }, [])

  const handleRedo = useCallback(() => {
    if (historyIdx.current >= historyStack.current.length - 1) return
    historyIdx.current += 1
    const snap = historyStack.current[historyIdx.current]
    if (snap) { setDraft(snap); setCanUndo(true); setCanRedo(historyIdx.current < historyStack.current.length - 1) }
  }, [])

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, handleRedo])

  // Single entry-point for selecting a section — always triggers scroll + blink
  const selectSection = useCallback((id: string | null) => {
    setSelectedSectionId(id)
    if (activeFieldTimer.current) clearTimeout(activeFieldTimer.current)
    setActiveFieldKey(null)
    if (id) {
      setPanelMode('properties')
      setScrollTrigger(t => t + 1)
      setBlinkSectionId(id)
      if (blinkTimer.current) clearTimeout(blinkTimer.current)
      blinkTimer.current = setTimeout(() => setBlinkSectionId(null), 2400)
    }
  }, [])
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [previewWidth, setPreviewWidth] = useState<number | null>(null)
  const [isDraggingPreview, setIsDraggingPreview] = useState(false)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  const startPreviewResize = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault()
    const currentWidth = previewContainerRef.current?.offsetWidth ?? 896
    const startX = e.clientX
    setIsDraggingPreview(true)
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      const adjustment = side === 'right' ? delta : -delta
      setPreviewWidth(Math.max(320, Math.min(1400, currentWidth + adjustment)))
    }
    const onUp = () => {
      setIsDraggingPreview(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // Build a sandboxed draft when the user clicks "Preview" on a template
  const previewDraft = useMemo((): BuilderConfig | null => {
    if (!previewTemplateId) return null
    const tpl = TEMPLATES.find(t => t.id === previewTemplateId)
    if (!tpl) return null
    const heroKit = EDITORIAL_TEMPLATE_IDS.has(tpl.id) ? editorialHeroProps(tpl.id) : {}
    const sections: BuilderSection[] = mergeTemplateSectionDefaults(
      tpl.id,
      tpl.sectionOrder.map(id => {
        const def = SECTION_DEFS.find(d => d.id === id)
        const defaults = { ...(def?.defaultProps || {}), ...(id === 'hero' ? heroKit : {}) }
        return { id, visible: true, props: defaults }
      }),
    )
    return {
      ...draft,
      template_id: tpl.id,
      sections,
      style: { ...draft.style, ...tpl.style, dark_mode: tpl.style.dark_mode === true },
    }
  }, [previewTemplateId, draft])

  const applyPreviewedTemplate = () => {
    if (!previewTemplateId) return
    const tpl = TEMPLATES.find(t => t.id === previewTemplateId)
    if (tpl) applyTemplate(tpl)
    setPreviewTemplateId(null)
  }
  const aiEndRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const pendingUploadFieldKey = useRef<string>('bg_image_url')

  // Called by the right panel when a field is focused/toggled —
  // scrolls the section into view and blinks the field indicator.
  const handleFieldAction = useCallback((fieldKey: string) => {
    setScrollTrigger(t => t + 1)
    setActiveFieldKey(fieldKey)
    if (activeFieldTimer.current) clearTimeout(activeFieldTimer.current)
    activeFieldTimer.current = setTimeout(() => setActiveFieldKey(null), 1800)
  }, [])

  const { data: productsData } = useQuery({
    queryKey: ['builder-preview-products'],
    queryFn: () => vendorApi.listProducts({ size: 12 }),
  })
  const { data: servicesData } = useQuery({
    queryKey: ['builder-preview-services'],
    queryFn: () => vendorApi.listServices({ size: 8 }),
  })
  const previewProducts: Product[] = productsData?.items ?? []
  const previewServices: Service[] = servicesData?.items ?? []

  const { data: websiteList } = useSiteList()
  const mediaSiteId = useMemo(() => {
    const list = websiteList ?? []
    if (!list.length) return null
    const pub = list.find(s => s.is_published || s.status === 'published')
    return (pub ?? list[0]).id
  }, [websiteList])

  const [mediaApplyTarget, setMediaApplyTarget] = useState<{
    sectionId: string
    fieldKey: string
    fieldLabel: string
  } | null>(null)

  const mediaStudioTargetDescription = useMemo(() => {
    if (!mediaApplyTarget) return null
    const sec = SECTION_LABEL_MAP[mediaApplyTarget.sectionId] || mediaApplyTarget.sectionId
    return `${sec} — ${mediaApplyTarget.fieldLabel}`
  }, [mediaApplyTarget])

  const { data: savedConfig, isLoading: configLoading } = useQuery({
    queryKey: ['storefront-builder-config'],
    queryFn: () => vendorApi.getStorefrontBuilderConfig(),
  })

  useEffect(() => {
    if (!savedConfig || defaultsApplied) return
    setDefaultsApplied(true)
    const loaded = savedConfig as unknown as BuilderConfig | null
    if (loaded?.template_id) {
      setDraft(coerceDarkModeForTemplate(normalizeRemovedTemplateIds(loaded)))
    } else {
      setIsGeneratingDefaults(true)
      setTimeout(() => {
        const defaults = buildAIDefaults(vendor)
        setDraft(defaults)
        setIsGeneratingDefaults(false)
        toast.success('AI set up your business front!', { description: 'Based on your business profile. Customize it below.' })
      }, 1600)
    }
  }, [savedConfig, vendor, defaultsApplied])

  const [recentlySaved, setRecentlySaved] = useState(false)
  const recentlySavedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** `publish` = header Publish flow (suppresses duplicate save toast; never auto-opens browse from onSuccess). */
  const postSaveBehaviorRef = useRef<'save' | 'publish'>('save')
  const [isPublishing, setIsPublishing] = useState(false)
  // 'edit' = normal editing mode, 'browse' = saved/published - preview is a live navigable store
  const [previewMode, setPreviewMode] = useState<'edit' | 'browse'>('edit')
  // Drives preview navigation from PagesPanel
  const [previewTargetRoute, setPreviewTargetRoute] = useState<string>('/')

  const saveMutation = useMutation({
    mutationFn: (config: BuilderConfig) => vendorApi.updateStorefrontBuilderConfig(config as unknown as Record<string, unknown>),
    onSuccess: () => {
      const mode = postSaveBehaviorRef.current
      postSaveBehaviorRef.current = 'save'
      qc.invalidateQueries({ queryKey: ['storefront-builder-config'] })
      if (mode !== 'publish') {
        toast.success('Business Front saved!')
      }
      setSelectedSectionId(null)
      setPreviewTemplateId(null)
      setRecentlySaved(true)
      if (recentlySavedClearTimer.current) clearTimeout(recentlySavedClearTimer.current)
      recentlySavedClearTimer.current = setTimeout(() => setRecentlySaved(false), 1800)
    },
    onError: (error) => { toast.error(extractApiError(error, 'Could not save — please try again')) },
  })

  const handlePublish = useCallback(async () => {
    if (saveMutation.isPending || isPublishing) return
    postSaveBehaviorRef.current = 'publish'
    setIsPublishing(true)
    try {
      await saveMutation.mutateAsync(draft)
    } catch {
      postSaveBehaviorRef.current = 'save'
      setIsPublishing(false)
      return
    }
    try {
      let siteIdToPublish = mediaSiteId
      if (!siteIdToPublish) {
        const created = await websiteApi.createSite({
          name: vendor?.display_name || vendor?.business_name || 'My Store',
          description: 'Business front website',
          style_config: {},
        })
        siteIdToPublish = created.id
        await qc.invalidateQueries({ queryKey: ['websites'], exact: true })
      }
      if (siteIdToPublish) {
        await websiteApi.publishSite(siteIdToPublish)
        await qc.invalidateQueries({ queryKey: ['websites'], exact: true })
      }
      setPreviewMode('browse')
      setRecentlySaved(false)
      toast.success('Business Front published!')
    } catch (error) {
      toast.error(extractApiError(error, 'Saved, but publishing failed. Try again from Websites.'))
    } finally {
      postSaveBehaviorRef.current = 'save'
      setIsPublishing(false)
    }
  }, [draft, mediaSiteId, isPublishing, qc, saveMutation, vendor])

  const updateDraft   = (patch: Partial<BuilderConfig>) => commitDraft(patch)
  const updateStyle   = (patch: Partial<StyleConfig>)   => commitDraft(prev => ({ ...prev, style:   { ...prev.style,   ...patch } }))
  const updateModules = (patch: Partial<ModulesConfig>) => commitDraft(prev => ({ ...prev, modules: { ...prev.modules, ...patch } }))
  const updateSeo     = (patch: Partial<SeoConfig>)     => setDraft(prev => ({ ...prev, seo: { ...prev.seo, ...patch } }))  // seo changes don't need undo
  const updateSectionProps = (id: string, props: Partial<SectionProps>) => setDraft(prev => ({ ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, props: { ...s.props, ...props } } : s) }))
  const applyUrlFromMediaStudio = useCallback(
    (url: string) => {
      if (mediaApplyTarget) {
        updateSectionProps(mediaApplyTarget.sectionId, { [mediaApplyTarget.fieldKey]: url })
        toast.success(`Image updated (${mediaApplyTarget.fieldLabel})`)
      } else {
        toast.message('Choose where to apply the image', {
          description: 'Open Sections, select a section, then use Media studio on an image field.',
        })
      }
    },
    [mediaApplyTarget],
  )
  const toggleSection  = (id: string) => commitDraft(prev => ({ ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s) }))
  const removeSection  = (id: string) => commitDraft(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== id) }))
  const duplicateSection = (id: string) => {
    const sec = draft.sections.find(s => s.id === id)
    if (!sec) return
    const defLabel = SECTION_LABEL_MAP[id] || id
    // Give the copy a unique id (suffixed) so it doesn't collide with the original.
    // The preview renders duplicate ids by catching the first matching renderer,
    // so we mark the copy with _copy so callers can still find it.
    const copyId = `${id}_copy`
    if (draft.sections.find(s => s.id === copyId)) { toast.info(`Only one copy of ${defLabel} allowed`); return }
    commitDraft(prev => {
      const idx = prev.sections.findIndex(s => s.id === id)
      const newSecs = [...prev.sections]
      newSecs.splice(idx + 1, 0, { ...sec, id: copyId })
      return { ...prev, sections: newSecs }
    })
    toast.success(`${defLabel} duplicated`)
  }
  const addSection = (def: SectionDef) => {
    if (draft.sections.find(s => s.id === def.id)) { toast.info(`${def.label} is already in your layout`); return }
    commitDraft(prev => ({ ...prev, sections: [...prev.sections, { id: def.id, visible: true, props: { ...def.defaultProps } }] }))
    toast.success(`${def.label} added`)
  }

  const applyTemplate = (tpl: TemplateDef) => {
    const heroKit = EDITORIAL_TEMPLATE_IDS.has(tpl.id) ? editorialHeroProps(tpl.id) : {}
    const sectionList: BuilderSection[] = tpl.sectionOrder.map(id => {
      const def = SECTION_DEFS.find(d => d.id === id)
      const existing = draft.sections.find(s => s.id === id)
      const defaults = { ...(def?.defaultProps || {}), ...(id === 'hero' ? heroKit : {}) }
      return existing
        ? { ...existing, visible: true, props: { ...defaults, ...(existing.props || {}), ...(id === 'hero' ? heroKit : {}) } }
        : { id, visible: true, props: defaults }
    })
    const merged = mergeTemplateSectionDefaults(tpl.id, sectionList)
    const remaining = draft.sections.filter(s => !tpl.sectionOrder.includes(s.id)).map(s => ({ ...s, visible: false }))
    updateDraft({
      template_id: tpl.id,
      sections: [...merged, ...remaining],
      style: { ...draft.style, ...tpl.style, dark_mode: tpl.style.dark_mode === true },
    })
    toast.success(`"${tpl.name}" template applied`)
  }

  /** Header Reset: keep the same homepage template; restore its default colours, fonts, and section content (not AI/vendor-based template switch). */
  const resetCurrentTemplateToDefaults = useCallback(() => {
    let tplName = ''
    commitDraft(prev => {
      const tpl = TEMPLATES.find(t => t.id === prev.template_id) ?? TEMPLATES.find(t => t.id === DEFAULT_TEMPLATE_ID)
      if (!tpl) return prev
      tplName = tpl.name
      const heroKit = EDITORIAL_TEMPLATE_IDS.has(tpl.id) ? editorialHeroProps(tpl.id) : {}
      const sectionList: BuilderSection[] = tpl.sectionOrder.map(id => {
        const def = SECTION_DEFS.find(d => d.id === id)
        const defaults = { ...(def?.defaultProps || {}), ...(id === 'hero' ? heroKit : {}) }
        return { id, visible: true, props: { ...defaults } }
      })
      const merged = mergeTemplateSectionDefaults(tpl.id, sectionList)
      const remaining = prev.sections.filter(s => !tpl.sectionOrder.includes(s.id)).map(s => ({ ...s, visible: false }))
      const style: StyleConfig = {
        ...DEFAULT_STYLE,
        ...tpl.style,
        dark_mode: tpl.style.dark_mode === true,
        ...(prev.style.checkout_layout ? { checkout_layout: prev.style.checkout_layout } : {}),
      }
      return coerceDarkModeForTemplate({
        ...prev,
        template_id: tpl.id,
        sections: [...merged, ...remaining],
        style,
      })
    })
    toast.success(tplName ? `Reset to "${tplName}" defaults` : 'Reset to template defaults')
  }, [commitDraft])

  // AI submit
  const handleAiSubmit = () => {
    if (!aiInput.trim()) return
    const userMsg: AiMessage = { role: 'user', content: aiInput }
    setAiMessages(prev => [...prev, userMsg])
    setAiInput('')
    setAiLoading(true)
    setTimeout(() => {
      const result = runAI(userMsg.content, vendor, draft)
      const aiMsg: AiMessage = { role: 'ai', content: result.reply, patch: result.patch }
      setAiMessages(prev => [...prev, aiMsg])
      setAiLoading(false)
      setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }, 900)
  }

  const applyAIPatch = (patch: Partial<BuilderConfig>) => {
    setDraft(prev => ({ ...prev, ...patch, style: { ...prev.style, ...(patch.style || {}) }, modules: { ...prev.modules, ...(patch.modules || {}) }, sections: patch.sections || prev.sections }))
    toast.success('Applied to preview!')
  }

  // Drag-to-reorder
  const onDragStart = (idx: number) => setDraggedSectionIdx(idx)
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx) }
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedSectionIdx === null || draggedSectionIdx === idx) { setDraggedSectionIdx(null); setDragOverIdx(null); return }
    const arr = [...draft.sections]
    const [moved] = arr.splice(draggedSectionIdx, 1)
    arr.splice(idx, 0, moved)
    updateDraft({ sections: arr })
    setDraggedSectionIdx(null); setDragOverIdx(null)
  }
  const onDragEnd = () => { setDraggedSectionIdx(null); setDragOverIdx(null) }

  const moveSectionUp = (idx: number) => {
    if (idx === 0) return
    const arr = [...draft.sections]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; updateDraft({ sections: arr })
  }
  const moveSectionDown = (idx: number) => {
    if (idx === draft.sections.length - 1) return
    const arr = [...draft.sections]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; updateDraft({ sections: arr })
  }
  const moveSectionById = (id: string, dir: 'up' | 'down') => {
    const idx = draft.sections.findIndex(s => s.id === id)
    if (idx === -1) return
    if (dir === 'up') moveSectionUp(idx); else moveSectionDown(idx)
  }

  const selectedSection = selectedSectionId ? draft.sections.find(s => s.id === selectedSectionId) : null
  const selectedDef = selectedSectionId ? SECTION_DEFS.find(d => d.id === selectedSectionId) : null

  const businessFrontBase = vendor?.slug
    ? getCustomerStorefrontBaseUrl(vendor.slug)
    : 'https://your-store.kiterp.com'
  const storeUrl = businessFrontBase

  const tabConfig: { id: BuilderTab; label: string; icon: React.ElementType }[] = [
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'sections', label: 'Sections', icon: Layers },
    { id: 'media', label: 'Media', icon: Camera },
    { id: 'style', label: 'Style', icon: Palette },
    { id: 'ai', label: 'AI', icon: Bot },
    { id: 'modules', label: 'Modules', icon: Settings2 },
    { id: 'seo', label: 'SEO', icon: Globe },
  ]

  if (configLoading || isGeneratingDefaults) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shadow-lg">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{isGeneratingDefaults ? 'AI is setting up your business front…' : 'Loading builder…'}</p>
          <p className="text-sm text-gray-500 mt-1">{isGeneratingDefaults ? 'Analysing your business profile and generating the best layout' : 'Fetching your business front configuration'}</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Business Front Builder</h1>
            <p className="text-xs text-gray-400">{vendor?.display_name || vendor?.business_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-accent">
            <ExternalLink className="w-3.5 h-3.5" />
            View Live
          </a>
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={handleUndo} disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={handleRedo} disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            title="Restore this homepage template’s default colours, fonts, and section text. Does not switch to a different template."
            onClick={resetCurrentTemplateToDefaults}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </Button>
          {previewMode === 'browse' ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-accent transition-all duration-200"
              onClick={() => setPreviewMode('edit')}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          ) : (
            <>
              {previewTemplateId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                  title="Apply this template to your layout and continue editing (Cancel in the preview bar keeps your saved layout)"
                  onClick={applyPreviewedTemplate}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'gap-1.5 text-xs transition-all duration-300 border-primary/30 text-primary hover:bg-accent',
                  recentlySaved && 'border-green-500 text-green-700 bg-green-50 hover:bg-green-50',
                )}
                onClick={() => {
                  postSaveBehaviorRef.current = 'save'
                  saveMutation.mutate(draft)
                }}
                disabled={saveMutation.isPending || isPublishing || recentlySaved}
              >
                {saveMutation.isPending && !isPublishing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : recentlySaved
                    ? <Check className="w-3.5 h-3.5" />
                    : <Save className="w-3.5 h-3.5" />}
                {saveMutation.isPending && !isPublishing ? 'Saving…' : recentlySaved ? 'Saved' : 'Save'}
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
                onClick={handlePublish}
                disabled={saveMutation.isPending || isPublishing}
              >
                {isPublishing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Megaphone className="w-3.5 h-3.5" />}
                {isPublishing ? 'Publishing…' : 'Publish'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── 3-pane layout ── */}
      <div className="flex flex-1 min-h-0">

        {/* ─ LEFT PANEL ─────────────────────────────────────────────────────── */}
        <div className="w-72 border-r bg-white flex flex-col shrink-0">
          {/* Tab icons */}
          <div className="flex border-b bg-gray-50">
            {tabConfig.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors', activeTab === tab.id ? 'text-primary bg-white border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600')}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* ── TEMPLATES TAB — homepage presets (screenshots + apply) ── */}
            {activeTab === 'templates' && (
              <div className="p-3 space-y-3">
                <div className="flex gap-2 p-2.5 bg-accent rounded-xl border border-primary/20">
                  <LayoutTemplate className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-primary leading-snug">
                    <strong>Click a template</strong> to preview it in the builder. Use <strong>Edit</strong> in the header (or <strong>Apply &amp; Save</strong> in the preview bar) to apply that template and edit it. <strong>Cancel</strong> in the bar discards the preview. Open <strong>Style</strong> for colours, fonts, spacing, and checkout layout.
                  </p>
                </div>

                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">Homepage templates</p>

                {(TEMPLATES.length > 5 && !showMoreTemplates ? TEMPLATES.slice(0, 5) : TEMPLATES).map(tpl => {
                  const isActive = draft.template_id === tpl.id
                  const isPreviewing = previewTemplateId === tpl.id
                  return (
                    <div key={tpl.id} className={cn(
                      'rounded-xl border-2 overflow-hidden transition-all shadow-sm',
                      isActive     ? 'border-primary ring-1 ring-primary/25' :
                      isPreviewing ? 'border-amber-400' :
                      'border-gray-100 hover:border-primary/30',
                    )}>
                      <button
                        type="button"
                        onClick={() => setPreviewTemplateId(tpl.id)}
                        title={isPreviewing ? 'Previewing this layout — use Cancel in the preview bar to exit' : 'Preview this homepage layout'}
                        className={cn(
                          'w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          isPreviewing ? 'ring-2 ring-inset ring-amber-300/60' : '',
                        )}
                      >
                        <div className="relative h-28 w-full overflow-hidden bg-gray-200">
                          {tpl.previewSrc ? (
                            <img
                              src={tpl.previewSrc}
                              alt=""
                              className={cn('h-full w-full object-cover', tpl.id === 'atelier' && 'object-[center_78%]')}
                              loading="lazy"
                            />
                          ) : (
                            <div className={cn('h-full w-full bg-gradient-to-br opacity-90', tpl.gradient)} />
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1">
                            {isActive && <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-primary text-white font-bold shadow"><Check className="w-2.5 h-2.5" /> Applied</span>}
                            {isPreviewing && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-bold shadow">Preview</span>}
                            {tpl.tag && !isActive && !isPreviewing && <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/90 text-amber-800 font-bold shadow">{tpl.tag}</span>}
                          </div>
                          <p className="absolute bottom-2 left-2.5 right-14 text-xs font-bold text-white drop-shadow-md leading-snug line-clamp-2">{tpl.name}</p>
                        </div>

                        <div className="p-3 bg-white space-y-2">
                          <p className="text-xs text-gray-500 leading-snug">{tpl.description}</p>
                          <p className="text-xs text-gray-400">{tpl.sectionOrder.length} homepage sections.</p>
                          <p className="text-xs font-medium text-primary pt-0.5">
                            {isPreviewing ? 'Previewing — use Cancel in the bar above' : 'Click to preview in the builder'}
                          </p>
                        </div>
                      </button>
                    </div>
                  )
                })}

                {TEMPLATES.length > 5 && (
                  <button type="button" onClick={() => setShowMoreTemplates(!showMoreTemplates)}
                    className="w-full text-center text-xs text-primary hover:text-primary py-1.5 font-medium">
                    {showMoreTemplates ? 'Show fewer options' : `Show ${TEMPLATES.length - 5} more options ↓`}
                  </button>
                )}
              </div>
            )}

            {/* ── SECTIONS TAB ── */}
            {activeTab === 'sections' && (
              <div className="p-3 space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">Page Sections (drag to reorder)</p>
                <div className="space-y-1">
                  {draft.sections.map((sec, idx) => {
                    const def = SECTION_DEFS.find(d => d.id === sec.id)
                    if (!def) return null
                    return (
                      <div key={sec.id} draggable onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)} onDrop={e => onDrop(e, idx)} onDragEnd={onDragEnd}
                        className={cn('flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-default group',
                          selectedSectionId === sec.id
                            ? 'border-primary bg-accent ring-1 ring-primary/25 shadow-sm'
                            : dragOverIdx === idx && draggedSectionIdx !== idx
                              ? 'border-primary/60 bg-accent scale-[1.02]'
                              : 'border-gray-100 bg-white hover:border-primary/30 hover:bg-accent/70',
                          draggedSectionIdx === idx ? 'opacity-40' : 'opacity-100',
                        )}>
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          onClick={() => selectSection(sec.id)}
                          title="Click to edit this section"
                        >
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                            selectedSectionId === sec.id ? 'bg-primary' : sec.visible ? 'bg-primary/10' : 'bg-gray-100')}>
                            <def.icon className={cn('w-3.5 h-3.5', selectedSectionId === sec.id ? 'text-white' : sec.visible ? 'text-primary' : 'text-gray-400')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-xs font-medium truncate', sec.visible ? 'text-gray-900' : 'text-gray-400')}>{def.label}</p>
                            {!sec.visible && <p className="text-xs text-amber-500 font-medium">hidden</p>}
                          </div>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveSectionUp(idx)} className="p-0.5 hover:bg-gray-100 rounded" title="Move up"><ChevronUp className="w-3 h-3 text-gray-400" /></button>
                          <button onClick={() => moveSectionDown(idx)} className="p-0.5 hover:bg-gray-100 rounded" title="Move down"><ChevronDown className="w-3 h-3 text-gray-400" /></button>
                          <button onClick={() => removeSection(sec.id)} className="p-0.5 hover:bg-red-50 rounded" title="Remove"><Trash2 className="w-3 h-3 text-red-400" /></button>
                        </div>
                        <button onClick={() => toggleSection(sec.id)} className="shrink-0 ml-1" title={sec.visible ? 'Hide section' : 'Show section'}>
                          {sec.visible
                            ? <Eye className="w-4 h-4 text-primary/70 hover:text-primary" />
                            : <EyeOff className="w-4 h-4 text-amber-400 hover:text-amber-600" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="pt-1">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Add Section</p>
                  <div className="space-y-1">
                    {SECTION_DEFS.filter(def => !draft.sections.find(s => s.id === def.id)).map(def => (
                      <button key={def.id} onClick={() => addSection(def)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-gray-200 hover:border-primary/40 hover:bg-accent text-left transition-colors">
                        <Plus className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <def.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-600">{def.label}</span>
                      </button>
                    ))}
                    {SECTION_DEFS.filter(def => !draft.sections.find(s => s.id === def.id)).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">All sections added</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── STYLE TAB ── */}
            {activeTab === 'style' && (
              <div className="p-3 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Checkout Layout</p>
                  <div className="space-y-1.5">
                    {([
                      { id: 'two-column' as const, label: 'Two-column', desc: 'Form left, order summary right' },
                      { id: 'wizard'     as const, label: 'Wizard',     desc: 'Step-by-step guided flow' },
                      { id: 'accordion'  as const, label: 'Accordion',  desc: 'Collapsible sections on one page' },
                    ] as const).map(o => {
                      const active = (draft.style.checkout_layout ?? 'two-column') === o.id
                      return (
                        <button
                          key={o.id}
                          onClick={() => updateStyle({ checkout_layout: o.id })}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all',
                            active ? 'border-primary bg-accent' : 'border-gray-100 hover:border-primary/40 bg-white',
                          )}
                        >
                          <div>
                            <p className={cn('text-xs font-medium', active ? 'text-primary' : 'text-gray-700')}>{o.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{o.desc}</p>
                          </div>
                          {active && (
                            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-1 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Theme and appearance</p>
                  <div className="flex gap-1.5 p-0.5 rounded-xl bg-gray-100">
                    <button
                      type="button"
                      onClick={() => setStyleDetailsExpanded(false)}
                      className={cn(
                        'flex-1 py-2 text-xs font-medium rounded-lg transition-all',
                        !styleDetailsExpanded ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700',
                      )}
                    >
                      Fewer
                    </button>
                    <button
                      type="button"
                      onClick={() => setStyleDetailsExpanded(true)}
                      className={cn(
                        'flex-1 py-2 text-xs font-medium rounded-lg transition-all',
                        styleDetailsExpanded ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700',
                      )}
                    >
                      Expanded
                    </button>
                  </div>
                  {!styleDetailsExpanded && (
                    <p className="text-xs text-gray-400 px-1 mt-2 leading-snug">Palettes, colors, fonts, radius, spacing, motion, and dark mode are hidden. Choose Expanded to edit them.</p>
                  )}
                </div>

                {styleDetailsExpanded && (
                  <div className="space-y-4 pt-1">
                    {/* Quick palettes */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Quick Palettes</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {COLOR_PALETTES.map(pal => (
                          <button key={pal.name} onClick={() => updateStyle({ primary_color: pal.primary, secondary_color: pal.secondary, accent_color: pal.accent })}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                            <div className="flex gap-0.5">
                              <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: pal.primary }} />
                              <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: pal.accent }} />
                            </div>
                            <span className="text-xs text-gray-400">{pal.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom colors */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Custom Colors</p>
                      {[
                        { key: 'primary_color' as const, label: 'Primary', desc: 'Buttons & headings' },
                        { key: 'secondary_color' as const, label: 'Secondary', desc: 'Hover & accents' },
                        { key: 'accent_color' as const, label: 'Accent', desc: 'Highlights & CTAs' },
                        { key: 'bg_color' as const, label: 'Background', desc: 'Page background' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center gap-2 mb-2">
                          <label className="relative w-8 h-8 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer shrink-0 shadow-sm">
                            <input type="color" value={draft.style[item.key]} onChange={e => updateStyle({ [item.key]: e.target.value })}
                              className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                            <div className="w-full h-full" style={{ backgroundColor: draft.style[item.key] }} />
                          </label>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-700">{item.label}</p>
                            <p className="text-xs text-gray-400">{item.desc}</p>
                          </div>
                          <Input value={draft.style[item.key]} onChange={e => updateStyle({ [item.key]: e.target.value })} className="w-20 h-7 text-xs font-mono px-2" />
                        </div>
                      ))}
                    </div>

                    {/* Fonts */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Heading Font</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {FONTS.map(f => (
                          <button key={f.id} onClick={() => updateStyle({ font_heading: f.id })}
                            className={cn('text-left rounded-lg border-2 p-2 transition-colors', draft.style.font_heading === f.id ? 'border-primary bg-accent' : 'border-gray-100 hover:border-gray-300')}>
                            <p className="text-xs font-medium text-gray-900">{f.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: f.id }}>{f.specimen}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Borders */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Border Radius</p>
                      <div className="flex gap-1.5">
                        {(['sharp', 'rounded', 'pill'] as const).map(val => (
                          <button key={val} onClick={() => updateStyle({ border_radius: val })}
                            className={cn('flex-1 py-2 text-xs font-medium capitalize transition-colors', val === 'sharp' ? 'rounded' : val === 'rounded' ? 'rounded-lg' : 'rounded-full', draft.style.border_radius === val ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Spacing */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Spacing</p>
                      <div className="flex gap-1.5">
                        {(['compact', 'comfortable', 'spacious'] as const).map(val => (
                          <button key={val} onClick={() => updateStyle({ spacing: val })}
                            className={cn('flex-1 py-2 text-xs font-medium capitalize rounded-lg transition-colors', draft.style.spacing === val ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation */}
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Animations</p>
                      <div className="flex gap-1.5">
                        {(['none', 'subtle', 'expressive'] as const).map(val => (
                          <button key={val} onClick={() => updateStyle({ animation: val })}
                            className={cn('flex-1 py-2 text-xs font-medium capitalize rounded-lg transition-colors', draft.style.animation === val ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dark mode */}
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <p className="text-xs font-medium text-gray-700">Dark Mode</p>
                        <p className="text-xs text-gray-400">Dark background, light text</p>
                      </div>
                      <button onClick={() => updateStyle({ dark_mode: !draft.style.dark_mode })}>
                        {draft.style.dark_mode ? <ToggleRight className="w-8 h-8 text-primary/80" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── AI TAB ── */}
            {activeTab === 'ai' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-accent rounded-xl border border-primary/20">
                    <Sparkles className="w-4 h-4 text-primary/80 shrink-0" />
                    <p className="text-xs text-primary">Describe your brand or what to change in plain language</p>
                  </div>
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {msg.role === 'ai' && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <div className={cn('max-w-[85%]', msg.role === 'user' ? '' : '')}>
                        <div className={cn('rounded-2xl px-3 py-2 text-xs leading-relaxed', msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm')}>
                          {msg.content}
                        </div>
                        {msg.role === 'ai' && msg.patch && (
                          <button onClick={() => applyAIPatch(msg.patch!)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:text-primary font-medium bg-accent hover:bg-primary/15 px-2 py-1 rounded-lg transition-colors">
                            <Check className="w-3 h-3" />
                            Apply to preview
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shrink-0">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
                        {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={aiEndRef} />
                </div>
                <div className="p-3 border-t bg-white">
                  <div className="flex gap-2">
                    <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiSubmit()}
                      placeholder="E.g. make it dark and bold…"
                      className="flex-1 text-xs border rounded-xl px-3 py-2 outline-none focus:border-primary/60 focus:ring-1 focus:ring-ring" />
                    <button onClick={handleAiSubmit} disabled={aiLoading || !aiInput.trim()}
                      className="w-8 h-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center transition-colors">
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {['Dark & bold', 'Warm tones', 'Minimal clean', 'Add employee portal', 'Show me more'].map(s => (
                      <button key={s} onClick={() => { setAiInput(s); setTimeout(handleAiSubmit, 50) }}
                        className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-primary/15 hover:text-primary rounded-full text-gray-500 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── MODULES TAB ── */}
            {activeTab === 'modules' && (
              <div className="p-3 space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-3">Business Front Modules</p>
                {[
                  { key: 'ess_portal' as const, label: 'Employee Portal (ESS)', desc: 'Staff can access HR self-service from the business front', icon: UserCheck, warning: 'Requires HR module' },
                  { key: 'crm_widget' as const, label: 'Live Chat Widget', desc: 'Floating chat support via your CRM inbox', icon: Sparkles, warning: 'Requires CRM module' },
                  { key: 'online_booking' as const, label: 'Online Booking', desc: 'Let customers book services directly', icon: Wand2 },
                  { key: 'customer_reviews' as const, label: 'Customer Reviews', desc: 'Display product and service reviews', icon: Star },
                  { key: 'job_board' as const, label: 'Job Board', desc: 'Show open positions from HR recruitment', icon: Briefcase },
                  { key: 'newsletter' as const, label: 'Newsletter Signup', desc: 'Email opt-in for marketing', icon: Mail },
                  { key: 'b2b_portal' as const, label: 'B2B Client Portal', desc: 'Dedicated portal for business clients', icon: Globe },
                ].map(item => (
                  <div key={item.key} className={cn('rounded-xl border p-3 transition-colors', draft.modules[item.key] ? 'border-primary/30 bg-accent/80' : 'border-gray-100 bg-white')}>
                    <div className="flex items-start gap-2.5">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', draft.modules[item.key] ? 'bg-primary/10' : 'bg-gray-100')}>
                        <item.icon className={cn('w-4 h-4', draft.modules[item.key] ? 'text-primary' : 'text-gray-400')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900">{item.label}</p>
                        <p className="text-xs text-gray-400 leading-tight mt-0.5">{item.desc}</p>
                        {item.warning && draft.modules[item.key] && <p className="text-xs text-amber-500 mt-0.5">⚠ {item.warning}</p>}
                      </div>
                      <button onClick={() => updateModules({ [item.key]: !draft.modules[item.key] })}>
                        {draft.modules[item.key] ? <ToggleRight className="w-7 h-7 text-primary/80" /> : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                      </button>
                    </div>
                    {item.key === 'ess_portal' && draft.modules.ess_portal && (
                      <div className="mt-2.5 pt-2.5 border-t border-primary/20">
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Employee portal access</p>
                        {(['hidden', 'footer_link', 'dedicated_page'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 py-1 cursor-pointer">
                            <input type="radio" name="ess_access" value={opt} checked={draft.modules.ess_access === opt} onChange={() => updateModules({ ess_access: opt })} className="accent-primary" />
                            <span className="text-xs text-gray-600 capitalize">{opt.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* ── Store Locator ── */}
                <div className={cn('rounded-xl border p-3 transition-colors', draft.modules.store_locator ? 'border-primary/30 bg-accent/80' : 'border-gray-100 bg-white')}>
                  <div className="flex items-start gap-2.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', draft.modules.store_locator ? 'bg-primary/10' : 'bg-gray-100')}>
                      <MapPin className={cn('w-4 h-4', draft.modules.store_locator ? 'text-primary' : 'text-gray-400')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">Store Locator</p>
                      <p className="text-xs text-gray-400 leading-tight mt-0.5">Show your branch / location cards on the business front</p>
                    </div>
                    <button onClick={() => updateModules({ store_locator: !draft.modules.store_locator })}>
                      {draft.modules.store_locator ? <ToggleRight className="w-7 h-7 text-primary/80" /> : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                    </button>
                  </div>

                  {draft.modules.store_locator && (
                    <div className="mt-3 pt-3 border-t border-primary/20 space-y-3">

                      {/* Stores to display */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Stores to display</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[3, 6, 10, 0].map(n => (
                            <button
                              key={n}
                              onClick={() => updateModules({ store_locator_limit: n })}
                              className={cn(
                                'text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors',
                                draft.modules.store_locator_limit === n
                                  ? 'bg-primary text-white border-primary'
                                  : 'border-gray-200 text-gray-600 hover:border-primary/40'
                              )}
                            >
                              {n === 0 ? 'All' : `Show ${n}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Layout */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Display layout</p>
                        <div className="flex gap-1.5">
                          {(['grid', 'list'] as const).map(l => (
                            <button
                              key={l}
                              onClick={() => updateModules({ store_locator_layout: l })}
                              className={cn(
                                'flex-1 text-xs py-1 rounded-lg border font-medium capitalize transition-colors',
                                draft.modules.store_locator_layout === l
                                  ? 'bg-primary text-white border-primary'
                                  : 'border-gray-200 text-gray-600 hover:border-primary/40'
                              )}
                            >
                              {l === 'grid' ? '⊞ Grid' : '☰ List'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* City filter */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Location filter</p>
                        <div className="flex gap-1.5">
                          {([['none', 'None'], ['city', 'By City']] as const).map(([v, l]) => (
                            <button
                              key={v}
                              onClick={() => updateModules({ store_locator_filter: v })}
                              className={cn(
                                'flex-1 text-xs py-1 rounded-lg border font-medium transition-colors',
                                draft.modules.store_locator_filter === v
                                  ? 'bg-primary text-white border-primary'
                                  : 'border-gray-200 text-gray-600 hover:border-primary/40'
                              )}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Show city tabs so customers can browse by location</p>
                      </div>

                      {/* Geo sort */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.modules.store_locator_geo}
                          onChange={e => updateModules({ store_locator_geo: e.target.checked })}
                          className="w-3.5 h-3.5 accent-primary"
                        />
                        <div>
                          <span className="text-xs font-medium text-gray-700">Detect user location</span>
                          <p className="text-xs text-gray-400 leading-tight">Sort stores by proximity to visitor's location</p>
                        </div>
                      </label>

                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SEO TAB ── */}
            {activeTab === 'seo' && (
              <div className="p-3 space-y-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">Search Engine Optimisation</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-600">Page Title</Label>
                    <Input className="mt-1 h-8 text-xs" value={draft.seo.page_title} onChange={e => updateSeo({ page_title: e.target.value })} placeholder={`${vendor?.display_name || 'Your Store'} — Official Store`} />
                    <p className="text-xs text-gray-400 mt-0.5">{draft.seo.page_title.length}/60 chars</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Meta Description</Label>
                    <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-xs resize-none outline-none focus:border-primary/60 focus:ring-1 focus:ring-ring" rows={3} value={draft.seo.meta_description} onChange={e => updateSeo({ meta_description: e.target.value })} placeholder="Welcome to our store…" />
                    <p className="text-xs text-gray-400">{draft.seo.meta_description.length}/160 chars</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">OG Image URL</Label>
                    <Input className="mt-1 h-8 text-xs" value={draft.seo.og_image_url} onChange={e => updateSeo({ og_image_url: e.target.value })} placeholder="https://..." />
                    <p className="text-xs text-gray-400 mt-0.5">1200×630px recommended</p>
                  </div>
                  <div className="rounded-xl border p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-2">Google Preview</p>
                    <p className="text-xs text-blue-600 font-medium leading-tight truncate">{draft.seo.page_title || `${vendor?.display_name || 'Your Store'}`}</p>
                    <p className="text-xs text-green-700 mt-0.5">{storeUrl}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{draft.seo.meta_description || 'Welcome to our store. Browse our products and services.'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── MEDIA TAB — library, upload, AI adjust (same as Website Builder) ── */}
            {activeTab === 'media' && (
              <div className="flex flex-col min-h-0 flex-1">
                {!mediaSiteId ? (
                  <div className="p-4 space-y-3 text-center">
                    <Camera className="w-10 h-10 text-primary/50 mx-auto" />
                    <p className="text-xs font-medium text-gray-700">Create a website first</p>
                    <p className="text-xs text-gray-500 leading-snug">
                      Media uploads and AI adjustments are stored on your builder site. Create or open a site, then return here.
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full text-xs">
                      <Link to="/websites">Go to Websites</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 border-b bg-accent/80 shrink-0">
                      <p className="text-xs text-primary leading-snug">
                        Upload, pick from your library, tune with sliders, then <span className="font-semibold">Apply AI</span> for server-side adjustments. Use{' '}
                        <span className="font-semibold">Media studio</span> on any section image to set where the result goes.
                      </p>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <MediaStudioPanel
                        siteId={mediaSiteId}
                        selectedBlock={null}
                        applyTargetDescription={mediaStudioTargetDescription}
                        onApplyUrl={applyUrlFromMediaStudio}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─ CENTER PREVIEW PANE ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-gray-100 min-w-0">
          {/* Device toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as [DeviceMode, React.ElementType][]).map(([d, Icon]) => (
                <button key={d} onClick={() => { setDevice(d); setPreviewWidth(null) }}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize', device === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  <Icon className="w-3.5 h-3.5" />{d}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {previewWidth && (
                <div className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 text-white px-2 py-1 rounded-md">
                  <span>{previewWidth}px</span>
                  <button onClick={() => setPreviewWidth(null)} className="text-gray-400 hover:text-white transition-colors ml-0.5">×</button>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <MousePointer className="w-3 h-3" />
                Click a section to edit
              </div>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-y-auto flex justify-center p-4 pt-8" style={{ cursor: isDraggingPreview ? 'ew-resize' : undefined }}>
            <div
              ref={previewContainerRef}
              className="relative"
              style={previewWidth
                ? { width: `${previewWidth}px` }
                : { width: '100%', maxWidth: device === 'tablet' ? '42rem' : device === 'mobile' ? '24rem' : '56rem', transition: 'max-width 0.3s' }
              }
            >
              {/* Left drag handle */}
              <div
                onMouseDown={e => startPreviewResize(e, 'left')}
                className="absolute -left-4 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize group z-20 select-none"
                title="Drag to resize"
              >
                <div className={cn(
                  'w-1.5 h-14 rounded-full transition-all duration-150',
                  isDraggingPreview ? 'bg-accent scale-y-110' : 'bg-gray-300 group-hover:bg-primary/50 group-hover:scale-y-110'
                )}>
                  <div className="flex flex-col items-center justify-center h-full gap-0.5 pt-5">
                    <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                    <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                    <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                  </div>
                </div>
              </div>

              {/* Right drag handle */}
              <div
                onMouseDown={e => startPreviewResize(e, 'right')}
                className="absolute -right-4 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize group z-20 select-none"
                title="Drag to resize"
              >
                <div className={cn(
                  'w-1.5 h-14 rounded-full transition-all duration-150',
                  isDraggingPreview ? 'bg-accent scale-y-110' : 'bg-gray-300 group-hover:bg-primary/50 group-hover:scale-y-110'
                )}>
                  <div className="flex flex-col items-center justify-center h-full gap-0.5 pt-5">
                    <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                    <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                    <div className="w-0.5 h-0.5 rounded-full bg-white/70" />
                  </div>
                </div>
              </div>

              {/* Browser chrome */}
              <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-300">
                {/* Browser bar */}
                <div className="bg-gray-200 px-3 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-500 font-mono truncate">{storeUrl}</div>
                </div>

                {/* Template preview banner */}
                {previewDraft && (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-500 text-white">
                    <Eye className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-xs font-medium truncate">
                      Previewing: <strong>{TEMPLATES.find(t => t.id === previewTemplateId)?.name}</strong> — not applied yet
                    </span>
                    <button onClick={applyPreviewedTemplate}
                      className="px-3 py-1 bg-white text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors shrink-0">
                      Apply & Save
                    </button>
                    <button onClick={() => setPreviewTemplateId(null)}
                      className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors shrink-0">
                      Cancel
                    </button>
                  </div>
                )}
                {/* Storefront preview */}
                <StorefrontPreview
                  draft={previewDraft ?? draft}
                  vendor={vendor}
                  selectedSectionId={previewDraft || previewMode === 'browse' ? null : selectedSectionId}
                  onSelectSection={previewMode === 'browse' ? () => {} : selectSection}
                  products={previewProducts}
                  services={previewServices}
                  scrollTrigger={scrollTrigger}
                  activeFieldKey={previewMode === 'browse' ? null : activeFieldKey}
                  blinkSectionId={previewMode === 'browse' ? null : blinkSectionId}
                  onToggleSection={previewDraft || previewMode === 'browse' ? undefined : toggleSection}
                  onMoveSection={previewDraft || previewMode === 'browse' ? undefined : moveSectionById}
                  onDuplicateSection={previewDraft || previewMode === 'browse' ? undefined : duplicateSection}
                  onUpdateSectionProp={previewDraft || previewMode === 'browse' ? undefined : (id, key, val) => updateSectionProps(id, { [key]: val })}
                  previewMode={previewMode}
                  initialRoute={previewTargetRoute}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─ RIGHT PROPERTY PANEL ───────────────────────────────────────────── */}
        <div className="w-80 border-l bg-white flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="border-b">
            <div className="flex">
              <button onClick={() => setPanelMode('properties')}
                className={cn('flex-1 py-2.5 text-xs font-medium transition-colors border-b-2', panelMode === 'properties' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 bg-gray-50')}>
                Structure
              </button>
              <button onClick={() => setPanelMode('pages')}
                className={cn('flex-1 py-2.5 text-xs font-medium transition-colors border-b-2', panelMode === 'pages' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 bg-gray-50')}>
                Pages & Routes
              </button>
            </div>
            {panelMode === 'properties' && selectedSection && selectedDef && (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent border-t border-primary/20">
                <selectedDef.icon className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                <p className="text-xs text-primary font-semibold flex-1">{selectedDef.label}</p>
                <span className="text-xs text-primary/70 font-medium">editing</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {panelMode === 'pages' ? (
              <PagesPanel
                modules={draft.modules}
                businessFrontBase={businessFrontBase}
                onNavigatePreview={(route) => {
                  setPreviewTargetRoute(route)
                  setPanelMode('properties')
                }}
              />
            ) : !selectedSection ? (
              <div className="p-3 space-y-3">
                {/* How it works callout */}
                <div className="flex items-start gap-2 p-3 bg-accent rounded-xl border border-primary/20">
                  <Pencil className="w-3.5 h-3.5 text-primary/80 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-primary">Click a section to edit</p>
                    <p className="text-xs text-primary mt-0.5 leading-snug">Text fields appear <strong>inline in the preview</strong>. This panel shows layout, size &amp; visibility controls.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/80">
                  <Layers className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Add or reorder sections</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">Use the <strong>Sections</strong> tab in the left panel — drag to reorder, or use <strong>Add Section</strong> for new blocks.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sections')}
                      className="mt-2 text-xs font-medium text-primary hover:text-primary"
                    >
                      Open Sections tab →
                    </button>
                  </div>
                </div>
                <button onClick={() => setPanelMode('pages')}
                  className="w-full text-xs text-primary/80 hover:text-primary flex items-center justify-center gap-1.5 font-medium py-2">
                  <Globe className="w-3.5 h-3.5" /> View all pages & routes
                </button>
              </div>
            ) : (
              <>
                {/* Hidden-section warning */}
                {!selectedSection.visible && (
                  <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <EyeOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-800">Section is hidden</p>
                        <p className="text-xs text-amber-600 mt-0.5 leading-snug">This section won't appear on your business front. You can still edit its settings below.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSection(selectedSection.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Make Visible
                    </button>
                  </div>
                )}
                <RichPropertyEditor
                  section={selectedSection}
                  onUpdate={(props) => updateSectionProps(selectedSection.id, props)}
                  vendor={vendor}
                  onMediaUpload={uploadRef}
                  onImageUpload={(key) => { pendingUploadFieldKey.current = key; uploadRef.current?.click() }}
                  onOpenMediaStudio={(fieldKey, fieldLabel) => {
                    setMediaApplyTarget({ sectionId: selectedSection.id, fieldKey, fieldLabel })
                    setActiveTab('media')
                  }}
                  onFieldAction={handleFieldAction}
                />
              </>
            )}
          </div>

          {panelMode === 'properties' && selectedSection && (
            <div className="p-3 border-t bg-gray-50 space-y-2">
              <button onClick={() => toggleSection(selectedSection.id)}
                className={cn('w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors', selectedSection.visible ? 'border-gray-200 text-gray-600 hover:bg-gray-100' : 'border-primary/30 text-primary bg-accent hover:bg-primary/15')}>
                {selectedSection.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {selectedSection.visible ? 'Hide Section from Website' : 'Show Section on Website'}
              </button>
              <button onClick={() => { removeSection(selectedSection.id); setSelectedSectionId(null) }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-red-100 text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Remove Section
              </button>
            </div>
          )}
        </div>
      </div>

      {/* hidden file input */}
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={e => {
        const file = e.target.files?.[0]
        if (!file || !selectedSectionId) return
        const url = URL.createObjectURL(file)
        updateSectionProps(selectedSectionId, { [pendingUploadFieldKey.current]: url })
        toast.success('Image uploaded to section preview')
        e.target.value = ''
        pendingUploadFieldKey.current = 'bg_image_url'
      }} />
    </div>
  )
}

// ─── Shared input class ───────────────────────────────────────────────────────
const FIELD_CLASS = "w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-primary/60 focus:ring-1 focus:ring-ring bg-white"

// ─── Link field editor ────────────────────────────────────────────────────────
interface LinkEditorProps { value: string; onChange: (v: string) => void }
function LinkEditor({ value, onChange }: LinkEditorProps) {
  const { type, value: val } = parseLinkValue(value)
  const setType = (t: string) => {
    if (t === 'none') onChange('')
    else if (t === 'booking') onChange('booking:')
    else if (t === 'internal') onChange('internal:/products')
    else onChange(formatLinkValue(t, val))
  }
  const setValue = (v: string) => onChange(formatLinkValue(type, v))
  return (
    <div className="space-y-1.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center gap-1.5 mb-1">
        <Link2 className="w-3 h-3 text-gray-400" />
        <span className="text-xs text-gray-400 font-medium">Link type</span>
      </div>
      <select value={type} onChange={e => setType(e.target.value)} className={FIELD_CLASS}>
        {LINK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {type === 'internal' && (
        <select value={val} onChange={e => setValue(e.target.value)} className={FIELD_CLASS}>
          {INTERNAL_ROUTES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      )}
      {(type === 'external' || type === 'phone' || type === 'email') && (
        <input value={val} onChange={e => setValue(e.target.value)}
          placeholder={LINK_TYPE_OPTIONS.find(o => o.value === type)?.placeholder}
          className={FIELD_CLASS} />
      )}
      {type === 'booking' && (
        <p className="text-xs text-primary bg-accent rounded-lg px-2 py-1">Links to your live booking calendar</p>
      )}
    </div>
  )
}

// ─── Per-field typography (stored as `_fc_<key>` / `_fs_<key>` on section props) ─
function FieldTypographyRow({
  fieldKey,
  p,
  onUpdate,
  onFieldAction,
}: {
  fieldKey: string
  p: SectionProps
  onUpdate: (patch: Partial<SectionProps>) => void
  onFieldAction?: (key: string) => void
}) {
  const fcKey = `_fc_${fieldKey}`
  const fsKey = `_fs_${fieldKey}`
  const colorVal = String(p[fcKey] ?? '')
  const sizeVal = String(p[fsKey] ?? '')
  const setPatch = (o: Record<string, string>) => { onUpdate(o as Partial<SectionProps>); onFieldAction?.(fieldKey) }
  const sizeNum = parseInt(sizeVal, 10)
  const rangeDisplay = !sizeVal || Number.isNaN(sizeNum) ? 18 : Math.min(72, Math.max(8, sizeNum))

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2 border-t border-primary/20/70">
      <span className="text-xs font-medium text-gray-500 shrink-0">Colour</span>
      <label className="relative w-6 h-6 rounded-md border border-gray-200 overflow-hidden cursor-pointer shrink-0 shadow-sm">
        <input
          type="color"
          value={colorVal || '#374151'}
          onChange={e => setPatch({ [fcKey]: e.target.value })}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-full h-full" style={{ backgroundColor: colorVal || '#e5e7eb' }} />
      </label>
      <input
        value={colorVal}
        onChange={e => setPatch({ [fcKey]: e.target.value })}
        onFocus={() => onFieldAction?.(fieldKey)}
        placeholder="default"
        className={cn(FIELD_CLASS, 'w-[92px] font-mono text-xs py-1 px-1.5')}
      />
      <span className="text-xs font-medium text-gray-500 shrink-0">Size (px)</span>
      <input
        type="range"
        min={8}
        max={72}
        step={1}
        value={rangeDisplay}
        onChange={e => setPatch({ [fsKey]: e.target.value })}
        className="flex-1 min-w-[72px] max-w-[120px] h-1 accent-primary"
      />
      <input
        type="number"
        min={8}
        max={120}
        placeholder="auto"
        value={sizeVal}
        onChange={e => setPatch({ [fsKey]: e.target.value })}
        onFocus={() => onFieldAction?.(fieldKey)}
        className={cn(FIELD_CLASS, 'w-14 text-center text-xs py-1 px-1')}
      />
      {(colorVal || sizeVal) && (
        <button
          type="button"
          onClick={() => { onUpdate({ [fcKey]: '', [fsKey]: '' } as Partial<SectionProps>); onFieldAction?.(fieldKey) }}
          className="text-xs font-medium text-gray-400 hover:text-red-500 ml-auto"
        >
          Reset
        </button>
      )}
    </div>
  )
}

// ─── Rich Property Editor ─────────────────────────────────────────────────────
interface RichPropEditorProps {
  section: BuilderSection
  onUpdate: (props: Partial<SectionProps>) => void
  vendor: Vendor | null
  onMediaUpload: React.RefObject<HTMLInputElement>
  onImageUpload: (fieldKey: string) => void
  /** Opens the shared Media tab with this field as the apply target. */
  onOpenMediaStudio?: (fieldKey: string, fieldLabel: string) => void
  onFieldAction?: (fieldKey: string) => void
}
function RichPropertyEditor({ section, onUpdate, vendor: _vendor, onMediaUpload, onImageUpload, onOpenMediaStudio, onFieldAction }: RichPropEditorProps) {
  const id = section.id
  const p = section.props
  const fields = SECTION_FIELD_DEFS[id] ?? []
  const hiddenFields: string[] = (p.hidden_fields as string[]) || []
  const isHidden = (key: string) => hiddenFields.includes(key)
  const toggleHidden = (key: string) => {
    const cur = (p.hidden_fields as string[]) || []
    onUpdate({ hidden_fields: cur.includes(key) ? cur.filter(f => f !== key) : [...cur, key] })
    onFieldAction?.(key)
  }
  const val = (key: string) => (p[key] as string) || ''
  const set = (key: string) => (v: string) => onUpdate({ [key]: v })

  // Drag-to-change for number fields
  const numDragRef = useRef<{ startX: number; startVal: number; key: string; min: number; max: number; step: number } | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const startNumDrag = useCallback((e: React.MouseEvent, field: FieldDef) => {
    e.preventDefault()
    const min = field.min ?? 0
    const max = field.max ?? 200
    const step = field.step ?? 1
    const currentVal = parseInt(val(field.key)) || field.defaultValue || min
    numDragRef.current = { startX: e.clientX, startVal: currentVal, key: field.key, min, max, step }
    setDraggingKey(field.key)
    const onMove = (ev: MouseEvent) => {
      if (!numDragRef.current) return
      const delta = ev.clientX - numDragRef.current.startX
      const range = numDragRef.current.max - numDragRef.current.min
      const rawNew = numDragRef.current.startVal + (delta / 120) * range
      const snapped = Math.round(rawNew / numDragRef.current.step) * numDragRef.current.step
      const clamped = Math.max(numDragRef.current.min, Math.min(numDragRef.current.max, snapped))
      set(numDragRef.current.key)(String(clamped))
      onFieldAction?.(numDragRef.current.key)
    }
    const onUp = () => {
      setDraggingKey(null)
      numDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [val, set, onFieldAction])

  // Split fields into content (text/textarea) and structural (everything else)
  const contentFields = fields.filter(f => f.type === 'text' || f.type === 'textarea')
  const structureFields = fields.filter(f => f.type !== 'text' && f.type !== 'textarea')

  return (
    <div className="p-3">
      {fields.length === 0 && (
        <div className="py-6 text-center text-xs text-gray-400">No settings for this section.</div>
      )}

      {/* ── Content / text fields ── */}
      {contentFields.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <Pencil className="w-3 h-3 text-primary/80" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Edit Text Content</span>
          </div>
          <div className="divide-y divide-gray-100 rounded-xl border border-primary/20 bg-accent/70 overflow-hidden">
            {contentFields.map(field => (
              <div key={field.key} className={cn('px-3 py-2.5 transition-opacity', isHidden(field.key) ? 'opacity-40' : '')}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">{field.label}</label>
                  {field.hideable && (
                    <button onClick={() => toggleHidden(field.key)} title={isHidden(field.key) ? 'Show on website' : 'Hide from website'}
                      className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors', isHidden(field.key) ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-gray-100 text-gray-400 hover:bg-accent hover:text-primary/80')}>
                      {isHidden(field.key) ? <><EyeOff className="w-2.5 h-2.5" /> hidden</> : <><Eye className="w-2.5 h-2.5" /> visible</>}
                    </button>
                  )}
                </div>
                {field.type === 'text' && (
                  <input value={val(field.key)} onChange={e => set(field.key)(e.target.value)} onFocus={() => onFieldAction?.(field.key)} placeholder={field.placeholder} className={cn(FIELD_CLASS, 'bg-white')} />
                )}
                {field.type === 'textarea' && (
                  <textarea value={val(field.key)} onChange={e => set(field.key)(e.target.value)} onFocus={() => onFieldAction?.(field.key)} placeholder={field.placeholder} rows={2} className={cn(FIELD_CLASS, 'resize-none bg-white')} />
                )}
                <FieldTypographyRow fieldKey={field.key} p={p} onUpdate={onUpdate} onFieldAction={onFieldAction} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Structure / layout fields ── */}
      {structureFields.length > 0 && (
        <div className="divide-y divide-gray-50">
          {contentFields.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2 px-0.5 pt-1">
              <Settings2 className="w-3 h-3 text-gray-400" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Layout & Settings</span>
            </div>
          )}
      {structureFields.map(field => (
        <div key={field.key} className={cn('py-3 first:pt-1 transition-opacity', isHidden(field.key) ? 'opacity-40' : '')}>
          {/* Field header row */}
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs text-gray-600 font-semibold">{field.label}</Label>
            {field.hideable && (
              <button onClick={() => toggleHidden(field.key)} title={isHidden(field.key) ? 'Show on website' : 'Hide from website'}
                className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors', isHidden(field.key) ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-gray-100 text-gray-400 hover:bg-accent hover:text-primary/80')}>
                {isHidden(field.key) ? <><EyeOff className="w-2.5 h-2.5" /> hidden</> : <><Eye className="w-2.5 h-2.5" /> visible</>}
              </button>
            )}
          </div>
          {field.description && <p className="text-xs text-gray-400 mb-1.5 leading-snug">{field.description}</p>}

          {/* Link */}
          {field.type === 'link' && (
            <LinkEditor value={val(field.key)} onChange={v => { set(field.key)(v); onFieldAction?.(field.key) }} />
          )}
          {/* Date */}
          {field.type === 'date' && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input type="date" value={val(field.key)} onChange={e => set(field.key)(e.target.value)} onFocus={() => onFieldAction?.(field.key)} className={cn(FIELD_CLASS, 'flex-1')} />
              {val(field.key) && <button onClick={() => set(field.key)('')}><X className="w-3 h-3 text-gray-400 hover:text-red-500" /></button>}
            </div>
          )}
          {/* Select */}
          {field.type === 'select' && field.options && (
            <select value={val(field.key)} onChange={e => { set(field.key)(e.target.value); onFieldAction?.(field.key) }} className={FIELD_CLASS}>
              {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {/* Sub-fields — appear when a specific option is chosen */}
          {field.type === 'select' && field.subFields && val(field.key) && field.subFields[val(field.key)] && (
            <div className="mt-2.5 pl-3 border-l-2 border-primary/30 space-y-3">
              {field.subFields[val(field.key)].map(sf => (
                <div key={sf.key}>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-gray-500 font-medium">{sf.label}</Label>
                    {sf.hideable && (
                      <button onClick={() => toggleHidden(sf.key)} title={isHidden(sf.key) ? 'Show on website' : 'Hide from website'}
                        className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors', isHidden(sf.key) ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-gray-100 text-gray-400 hover:bg-accent hover:text-primary/80')}>
                        {isHidden(sf.key) ? <><EyeOff className="w-2.5 h-2.5" /> hidden</> : <><Eye className="w-2.5 h-2.5" /> visible</>}
                      </button>
                    )}
                  </div>
                  {sf.description && <p className="text-xs text-gray-400 mb-1.5 leading-snug">{sf.description}</p>}
                  {sf.type === 'text' && (
                    <input value={val(sf.key)} onChange={e => set(sf.key)(e.target.value)} onFocus={() => onFieldAction?.(sf.key)} placeholder={sf.placeholder} className={FIELD_CLASS} />
                  )}
                  {sf.type === 'textarea' && (
                    <textarea value={val(sf.key)} onChange={e => set(sf.key)(e.target.value)} onFocus={() => onFieldAction?.(sf.key)} placeholder={sf.placeholder} rows={2} className={cn(FIELD_CLASS, 'resize-none')} />
                  )}
                  {(sf.type === 'text' || sf.type === 'textarea') && (
                    <FieldTypographyRow fieldKey={sf.key} p={p} onUpdate={onUpdate} onFieldAction={onFieldAction} />
                  )}
                  {sf.type === 'link' && (
                    <LinkEditor value={val(sf.key)} onChange={v => { set(sf.key)(v); onFieldAction?.(sf.key) }} />
                  )}
                  {sf.type === 'select' && sf.options && (
                    <select value={val(sf.key)} onChange={e => { set(sf.key)(e.target.value); onFieldAction?.(sf.key) }} className={FIELD_CLASS}>
                      {sf.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  {sf.type === 'image' && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => onMediaUpload.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary/60 hover:text-primary transition-colors">
                          <ImageIcon className="w-3.5 h-3.5" />
                          {val(sf.key) ? 'Change' : 'Upload'}
                        </button>
                        {onOpenMediaStudio && (
                          <button
                            type="button"
                            onClick={() => { onOpenMediaStudio(sf.key, sf.label); onFieldAction?.(sf.key) }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            Media studio
                          </button>
                        )}
                      </div>
                      {val(sf.key) && (
                        <div className="mt-1.5 rounded-lg overflow-hidden h-16 relative group">
                          <img src={resolveStorefrontPreviewImageSrc(val(sf.key))} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => set(sf.key)('')} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {sf.type === 'color' && (
                    <div className="flex items-center gap-2">
                      <label className="relative w-7 h-7 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer shrink-0">
                        <input type="color" value={val(sf.key) || '#64C3A0'} onChange={e => { set(sf.key)(e.target.value); onFieldAction?.(sf.key) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="w-full h-full" style={{ backgroundColor: val(sf.key) || '#64C3A0' }} />
                      </label>
                      <input value={val(sf.key)} onChange={e => set(sf.key)(e.target.value)} onFocus={() => onFieldAction?.(sf.key)} placeholder="#64C3A0" className={cn(FIELD_CLASS, 'flex-1 font-mono')} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Toggle */}
          {field.type === 'toggle' && (
            <button onClick={() => { onUpdate({ [field.key]: !(p[field.key] as boolean) }); onFieldAction?.(field.key) }} className="flex items-center gap-2">
              {p[field.key] ? <ToggleRight className="w-7 h-7 text-primary/80" /> : <ToggleLeft className="w-7 h-7 text-gray-300" />}
              <span className="text-xs text-gray-500">{p[field.key] ? 'On' : 'Off'}</span>
            </button>
          )}
          {/* Number — draggable slider */}
          {field.type === 'number' && (() => {
            const min = field.min ?? 0
            const max = field.max ?? 200
            const current = parseInt(val(field.key)) || field.defaultValue || min
            const pct = Math.round(((current - min) / (max - min)) * 100)
            const isDragging = draggingKey === field.key
            return (
              <div className="space-y-1.5">
                <div
                  onMouseDown={e => startNumDrag(e, field)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border select-none cursor-ew-resize transition-colors',
                    isDragging ? 'border-primary/60 bg-accent ring-1 ring-primary/25' : 'border-gray-200 bg-gray-50 hover:border-primary/40 hover:bg-accent/80'
                  )}
                  title="Drag left or right to resize"
                >
                  <GripHorizontal className={cn('w-3.5 h-3.5 shrink-0 transition-colors', isDragging ? 'text-primary/80' : 'text-gray-400')} />
                  <div className="flex-1 relative h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isDragging ? '#64C3A0' : '#8fd4bc' }} />
                  </div>
                  <span className={cn('text-xs font-mono font-semibold min-w-[44px] text-right transition-colors', isDragging ? 'text-primary' : 'text-gray-600')}>
                    {current}{field.unit || ''}
                  </span>
                  <GripHorizontal className={cn('w-3.5 h-3.5 shrink-0 transition-colors', isDragging ? 'text-primary/80' : 'text-gray-400')} />
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-gray-400">{min}{field.unit || ''}</span>
                  <span className="text-xs text-gray-400">{max}{field.unit || ''}</span>
                </div>
              </div>
            )
          })()}
          {/* Color */}
          {field.type === 'color' && (
            <div className="flex items-center gap-2">
              <label className="relative w-8 h-8 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer shrink-0">
                <input type="color" value={val(field.key) || '#64C3A0'} onChange={e => { set(field.key)(e.target.value); onFieldAction?.(field.key) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-full h-full" style={{ backgroundColor: val(field.key) || '#64C3A0' }} />
              </label>
              <input value={val(field.key)} onChange={e => set(field.key)(e.target.value)} onFocus={() => onFieldAction?.(field.key)} placeholder="#64C3A0" className={cn(FIELD_CLASS, 'flex-1 font-mono')} />
            </div>
          )}
          {/* Image */}
          {field.type === 'image' && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <button type="button" onClick={() => onImageUpload(field.key)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary/60 hover:text-primary transition-colors">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Upload
                </button>
                {onOpenMediaStudio && (
                  <button
                    type="button"
                    onClick={() => { onOpenMediaStudio(field.key, field.label); onFieldAction?.(field.key) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Media studio
                  </button>
                )}
              </div>
              {val(field.key) && (
                <div className="mt-1.5 rounded-lg overflow-hidden h-20 relative group">
                  <img src={resolveStorefrontPreviewImageSrc(val(field.key))} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => set(field.key)('')}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
        </div>
      )}

      {/* ── Section Style Overrides (same as website Builder per-block styles) ── */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 mb-3 px-0.5">
          <Sliders className="w-3 h-3 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section Style</span>
        </div>
        <div className="space-y-3">
          {/* Background color */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Background Color</label>
            <div className="flex items-center gap-2">
              <label className="relative w-7 h-7 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer shrink-0 shadow-sm">
                <input type="color" value={(section.props._bg_color as string) || '#ffffff'}
                  onChange={e => onUpdate({ _bg_color: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-full h-full" style={{ backgroundColor: (section.props._bg_color as string) || '#ffffff' }} />
              </label>
              <input value={(section.props._bg_color as string) || ''}
                onChange={e => onUpdate({ _bg_color: e.target.value })}
                placeholder="default" className={cn(FIELD_CLASS, 'flex-1 font-mono')} />
              {!!section.props._bg_color && (
                <button type="button" onClick={() => onUpdate({ _bg_color: '' })} className="text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* Text color */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Text Color Override</label>
            <div className="flex items-center gap-2">
              <label className="relative w-7 h-7 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer shrink-0 shadow-sm">
                <input type="color" value={(section.props._text_color as string) || '#111827'}
                  onChange={e => onUpdate({ _text_color: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-full h-full" style={{ backgroundColor: (section.props._text_color as string) || '#111827' }} />
              </label>
              <input value={(section.props._text_color as string) || ''}
                onChange={e => onUpdate({ _text_color: e.target.value })}
                placeholder="default" className={cn(FIELD_CLASS, 'flex-1 font-mono')} />
              {!!section.props._text_color && (
                <button type="button" onClick={() => onUpdate({ _text_color: '' })} className="text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* Padding top */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Padding Top</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={80} step={4}
                value={parseInt((section.props._padding_top as string) || '0')}
                onChange={e => onUpdate({ _padding_top: e.target.value })}
                className="flex-1 h-1.5 accent-primary" />
              <span className="text-xs font-mono text-gray-500 w-8 text-right">{String(section.props._padding_top ?? '0')}px</span>
            </div>
          </div>
          {/* Padding bottom */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Padding Bottom</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={80} step={4}
                value={parseInt((section.props._padding_bottom as string) || '0')}
                onChange={e => onUpdate({ _padding_bottom: e.target.value })}
                className="flex-1 h-1.5 accent-primary" />
              <span className="text-xs font-mono text-gray-500 w-8 text-right">{String(section.props._padding_bottom ?? '0')}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pages Panel ──────────────────────────────────────────────────────────────
// Maps a business front route to the nearest route the in-builder preview supports
function toPreviewRoute(route: string): string | null {
  if (route === '/') return '/'
  if (route.startsWith('/products')) return '/products'
  if (route.startsWith('/services')) return '/services'
  if (route === '/about') return '/about'
  // cart, checkout, account, employee, auth — not rendered in the preview
  return null
}

function PagesPanel({ modules, businessFrontBase, onNavigatePreview }: { modules: ModulesConfig; businessFrontBase: string; onNavigatePreview: (route: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const pages = STOREFRONT_PAGES.filter(pg => !pg.requiresModule || modules[pg.requiresModule])
  const hiddenPages = STOREFRONT_PAGES.filter(pg => pg.requiresModule && !modules[pg.requiresModule])

  function routeUrl(route: string) {
    const clean = route.replace(/:slug/g, 'preview-item')
    return `${businessFrontBase}${clean}`
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-100 mb-1">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-snug">Every page on your business front website. Pages marked <span className="font-bold">EDITABLE</span> can be customised from this builder.</p>
      </div>

      {pages.map(pg => (
        <div key={pg.route} className={cn('rounded-xl border overflow-hidden', pg.editableInBuilder ? 'border-primary/30' : 'border-gray-100')}>
          <button onClick={() => setExpanded(expanded === pg.route ? null : pg.route)}
            className="w-full flex items-center gap-2.5 p-3 text-left bg-white hover:bg-gray-50/80 transition-colors">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', pg.editableInBuilder ? 'bg-primary/10' : 'bg-gray-100')}>
              <pg.icon className={cn('w-4 h-4', pg.editableInBuilder ? 'text-primary' : 'text-gray-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-medium text-gray-900 truncate">{pg.label}</p>
                {pg.editableInBuilder && <span className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary font-bold shrink-0">EDITABLE</span>}
              </div>
              <p className="text-xs text-gray-400 font-mono truncate">{pg.route}</p>
            </div>
            <ChevronRight className={cn('w-3.5 h-3.5 text-gray-300 shrink-0 transition-transform', expanded === pg.route && 'rotate-90')} />
          </button>

          {expanded === pg.route && (
            <div className="px-3 pb-3 pt-2 border-t border-gray-50 bg-white space-y-2.5">
              <p className="text-xs text-gray-600 leading-snug">{pg.description}</p>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">What customers see on this page</p>
                <ul className="space-y-1">
                  {pg.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Check className="w-2.5 h-2.5 text-primary/70 shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
              </div>
              {pg.editorHint && (
                <div className="flex items-start gap-1.5 p-2 bg-accent rounded-lg border border-primary/20">
                  <Wand2 className="w-3 h-3 text-primary/80 shrink-0 mt-0.5" />
                  <p className="text-xs text-primary">{pg.editorHint}</p>
                </div>
              )}
              <div className="flex gap-1.5">
                {(() => {
                  const previewRoute = toPreviewRoute(pg.route)
                  return previewRoute ? (
                    <button
                      onClick={() => onNavigatePreview(previewRoute)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-primary/30 text-xs font-medium text-primary hover:border-primary/60 hover:bg-accent transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Open in preview
                    </button>
                  ) : (
                    <div
                      title="This page cannot be previewed inside the builder"
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-200 text-xs font-medium text-gray-300 cursor-not-allowed"
                    >
                      <Eye className="w-3 h-3" />
                      Preview N/A
                    </div>
                  )
                })()}
                <a
                  href={routeUrl(pg.route)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-primary/60 hover:text-primary hover:bg-accent transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in business front
                </a>
              </div>
            </div>
          )}
        </div>
      ))}

      {hiddenPages.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Locked — enable in Modules tab</p>
          {hiddenPages.map(pg => (
            <div key={pg.route} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-gray-200 mb-1.5 opacity-50">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <pg.icon className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">{pg.label}</p>
                <p className="text-xs text-gray-400 font-mono">{pg.route}</p>
              </div>
              <EyeOff className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Preview scroll: map sidebar field → data-builder-field anchor (restaurant_menu) ─
function resolveRestaurantMenuScrollAnchor(fieldKey: string, verdeKit: boolean): string {
  if (/^room_[123]_(title|body)$/.test(fieldKey) || fieldKey.startsWith('room_card_')) return 'room_cards'
  if (fieldKey === 'show_price' || fieldKey === 'show_description' || fieldKey === 'note') return 'menu_list_area'
  if (fieldKey === 'title' || fieldKey.startsWith('menu_list_heading_')) return 'title'
  if (fieldKey === 'description' || fieldKey.startsWith('menu_spotlight_intro_')) return 'description'
  if (fieldKey === 'view_all_label' || fieldKey === 'view_all_link' || fieldKey.startsWith('menu_cta_link_')) return 'view_all_label'
  if (verdeKit) {
    if (fieldKey === 'subtitle' || fieldKey.startsWith('menu_spotlight_kicker')) return 'menu_spotlight_kicker'
    if (
      fieldKey.startsWith('menu_spotlight_headline')
      || fieldKey === 'menu_spotlight_accent'
      || /^menu_spotlight_line[123]$/.test(fieldKey)
    ) return 'menu_spotlight_headline'
    return fieldKey
  }
  if (fieldKey.startsWith('menu_spotlight')) return 'title'
  if (fieldKey === 'subtitle') return 'subtitle'
  return fieldKey
}

function resolveBuilderScrollAnchor(sectionId: string, fieldKey: string | null, templateId: string | undefined): string | null {
  if (!fieldKey) return null
  const baseId = sectionId.replace(/_copy$/, '')
  if (baseId === 'restaurant_menu') {
    const verdeKit = editorialKitFromTemplate(templateId) === 'verde'
    return resolveRestaurantMenuScrollAnchor(fieldKey, verdeKit)
  }
  return fieldKey
}

// ─── Business Front Preview ───────────────────────────────────────────────────────
interface PreviewProps {
  draft: BuilderConfig
  vendor: Vendor | null
  selectedSectionId: string | null
  onSelectSection: (id: string | null) => void
  products: Product[]
  services: Service[]
  scrollTrigger: number
  activeFieldKey: string | null
  blinkSectionId: string | null
  onToggleSection?: (id: string) => void
  onMoveSection?: (id: string, dir: 'up' | 'down') => void
  onDuplicateSection?: (id: string) => void
  onUpdateSectionProp?: (id: string, key: string, value: unknown) => void
  previewMode?: 'edit' | 'browse'
  initialRoute?: string
}

// ─── Inline Section Editor (text fields editable directly inside the preview) ──
function InlineSectionEditor({
  sectionId,
  sectionProps,
  onUpdateProp,
}: {
  sectionId: string
  sectionProps: SectionProps
  onUpdateProp: (key: string, value: string) => void
}) {
  const fields = SECTION_FIELD_DEFS[sectionId] ?? []
  const textFields = fields.filter(f => f.type === 'text' || f.type === 'textarea')
  if (textFields.length === 0) return null

  return (
    <div
      className="border-t-2 border-primary/60 bg-white/98 backdrop-blur-sm"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-2.5 py-1 flex items-center gap-1.5 bg-accent border-b border-primary/20">
        <Pencil className="w-2.5 h-2.5 text-primary/80" />
        <span className="text-xs font-bold text-primary uppercase tracking-wider">Edit Content</span>
      </div>
      <div className="p-2 space-y-1.5">
        {textFields.map(field => (
          <div key={field.key} className="flex items-start gap-2">
            <span className="text-[8px] text-gray-400 font-semibold pt-1.5 w-[52px] shrink-0 leading-none truncate">{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea
                value={(sectionProps[field.key] as string) || ''}
                onChange={e => onUpdateProp(field.key, e.target.value)}
                rows={2}
                className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 resize-none outline-none focus:border-primary/60 bg-white"
                placeholder={field.placeholder}
              />
            ) : (
              <input
                value={(sectionProps[field.key] as string) || ''}
                onChange={e => onUpdateProp(field.key, e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-primary/60 bg-white"
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StorefrontPreview(props: PreviewProps) {
  return <StorefrontPreviewInner {...props} />
}

function StorefrontPreviewInner({ draft, vendor, selectedSectionId, onSelectSection, products, services, scrollTrigger, activeFieldKey, blinkSectionId, onToggleSection, onMoveSection, onDuplicateSection, onUpdateSectionProp, previewMode = 'edit', initialRoute: initialRouteProp = '/' }: PreviewProps) {
  const isBrowse = previewMode === 'browse'
  const s = draft.style
  const p = (id: string) => draft.sections.find(sec => sec.id === id)?.props || {}
  const visible = (id: string) => draft.sections.find(sec => sec.id === id)?.visible ?? false
  const orderedVisible = draft.sections.filter(sec => sec.visible)
  const logo = mediaUrl(vendor?.logo_url) || null

  const brStyle = s.border_radius === 'sharp' ? '2px' : s.border_radius === 'pill' ? '9999px' : '8px'
  const spacing = s.spacing === 'compact' ? '12px' : s.spacing === 'spacious' ? '28px' : '20px'
  /** Match live business front `ThemeConfig.colors.background` (builder style), not a separate dark canvas. */
  const bg = s.bg_color
  const textColor = s.dark_mode ? '#f3f4f6' : '#111827'
  const subTextColor = s.dark_mode ? '#9ca3af' : '#6b7280'
  const cardBg = s.dark_mode ? '#1e1b4b' : '#ffffff'
  const borderColor = s.dark_mode ? '#2d2960' : '#e5e7eb'

  /** Scoped vars mirroring storefront-web `ThemeProvider` so shared sections + shadcn tokens match the live store. */
  const previewStorefrontCssVars = useMemo((): React.CSSProperties => {
    const primaryHsl = hexToHslChannels(s.primary_color)
    const pf = primaryForegroundHslForHex(s.primary_color)
    const vars: Record<string, string> = {
      '--color-primary': s.primary_color,
      '--color-secondary': s.secondary_color,
      '--color-accent': s.accent_color,
      '--color-background': s.bg_color,
      '--font-store': s.font_heading,
      '--font-body': s.font_body || s.font_heading,
    }
    if (primaryHsl) {
      vars['--primary'] = primaryHsl
      vars['--primary-foreground'] = pf
      vars['--ring'] = primaryHsl
      vars['--sidebar-primary'] = primaryHsl
      vars['--sidebar-primary-foreground'] = pf
      vars['--sidebar-ring'] = primaryHsl
    }
    return vars as CSSProperties
  }, [s.primary_color, s.secondary_color, s.accent_color, s.bg_color, s.font_heading, s.font_body])

  // Inject blink + marquee keyframe CSS into <head> once
  useEffect(() => {
    const id = 'sb-blink-keyframes'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes sbBlink {
        0%   { box-shadow: inset 0 0 0 4px rgba(124,58,237,1), 0 0 0 8px rgba(124,58,237,0.45), 0 0 24px rgba(124,58,237,0.25); }
        45%  { box-shadow: inset 0 0 0 2px rgba(124,58,237,0.2), 0 0 0 2px rgba(124,58,237,0.1); }
        70%  { box-shadow: inset 0 0 0 4px rgba(124,58,237,1), 0 0 0 8px rgba(124,58,237,0.45), 0 0 24px rgba(124,58,237,0.25); }
        100% { box-shadow: inset 0 0 0 3px rgba(124,58,237,0.7), 0 0 0 4px rgba(124,58,237,0.15); }
      }
      .sb-blink { animation: sbBlink 0.52s ease-in-out 3 both; animation-delay: 380ms; }
      @keyframes sbTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .sb-ticker-slow   { animation: sbTicker 40s linear infinite; }
      .sb-ticker-normal { animation: sbTicker 25s linear infinite; }
      .sb-ticker-fast   { animation: sbTicker 15s linear infinite; }
      .sb-marquee-mask  { -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&display=swap');
    `
    document.head.appendChild(style)
    return () => { document.getElementById(id)?.remove() }
  }, [])

  // Ref map for auto-scroll to selected section / focused field
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (!selectedSectionId) return
    const root = sectionRefs.current[selectedSectionId]
    if (!root) return

    const anchorKey = resolveBuilderScrollAnchor(selectedSectionId, activeFieldKey, draft.template_id)
    let target: Element | null = null
    if (activeFieldKey && anchorKey) {
      target = root.querySelector(`[data-builder-field="${anchorKey}"]`)
      if (!target && anchorKey !== activeFieldKey) {
        target = root.querySelector(`[data-builder-field="${activeFieldKey}"]`)
      }
    }
    const scrollEl = target instanceof HTMLElement ? target : root
    scrollEl.scrollIntoView({
      behavior: 'instant' as ScrollBehavior,
      block: target ? 'nearest' : 'start',
      inline: 'nearest',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId, scrollTrigger, activeFieldKey, draft.template_id])

  const sectionClick = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectSection(id)
  }

  const [previewRoute, setPreviewRoute] = useState(() => initialRouteProp || '/')
  useEffect(() => { setPreviewRoute(initialRouteProp || '/') }, [initialRouteProp])
  const [previewDetail, setPreviewDetail] = useState<{ type: 'product' | 'service'; id: string | number } | null>(null)
  const navigateTo = (route: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewRoute(route)
    setPreviewDetail(null)
  }
  const viewDetail = (type: 'product' | 'service', id: string | number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewDetail({ type, id })
    setPreviewRoute(type === 'product' ? '/products' : '/services')
  }
  const onPreviewNavigate = useCallback((to: string) => {
    setPreviewRoute(to || '/')
    setPreviewDetail(null)
  }, [])

  const [paddingDragId, setPaddingDragId] = useState<string | null>(null)
  const paddingDragRef = useRef<{ startY: number; startPad: number } | null>(null)
  const startPaddingDrag = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const cur = parseInt((draft.sections.find(s => s.id === id)?.props.section_extra_padding as string) || '0')
    paddingDragRef.current = { startY: e.clientY, startPad: cur }
    setPaddingDragId(id)
    const onMove = (ev: MouseEvent) => {
      if (!paddingDragRef.current) return
      const delta = ev.clientY - paddingDragRef.current.startY
      const next = Math.max(0, Math.min(80, paddingDragRef.current.startPad + Math.round(delta / 2)))
      onUpdateSectionProp?.(id, 'section_extra_padding', String(next))
    }
    const onUp = () => {
      setPaddingDragId(null)
      paddingDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [draft, onUpdateSectionProp])

  const SectionWrapper = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const isSelected = selectedSectionId === id
    const isDimmed = !!selectedSectionId && !isSelected
    const isBlinking = blinkSectionId === id
    const isFieldActive = isSelected && !!activeFieldKey
    const def = SECTION_DEFS.find(d => d.id === id)
    const activeFieldDef = isFieldActive ? SECTION_FIELD_DEFS[id]?.find(f => f.key === activeFieldKey) : null
    const sectionData = draft.sections.find(s => s.id === id)
    const extraPad = parseInt((sectionData?.props.section_extra_padding as string) || '0')
    const bgOverride   = (sectionData?.props._bg_color   as string) || undefined
    const textOverride = (sectionData?.props._text_color  as string) || undefined
    const padTop       = parseInt((sectionData?.props._padding_top    as string) || '0')
    const padBottom    = parseInt((sectionData?.props._padding_bottom  as string) || '0')
    const isVisible = sectionData?.visible ?? true
    const isPaddingDragging = paddingDragId === id
    const allSectionIds = draft.sections.map(s => s.id)
    const sectionIdx = allSectionIds.indexOf(id)
    const canMoveUp = sectionIdx > 0
    const canMoveDown = sectionIdx < allSectionIds.length - 1
    const hasActions = !!(onToggleSection || onMoveSection)

    const styleOverrides: React.CSSProperties = {
      ...(bgOverride   ? { backgroundColor: bgOverride }   : {}),
      ...(textOverride ? { color: textOverride }            : {}),
      ...(padTop    > 0 ? { paddingTop:    `${padTop}px` }    : {}),
      ...(padBottom > 0 ? { paddingBottom: `${padBottom + extraPad}px` } : extraPad > 0 ? { paddingBottom: `${extraPad}px` } : {}),
    }

    // In browse mode: render a completely passive wrapper — no editing chrome
    if (isBrowse) {
      return (
        <div
          ref={el => { sectionRefs.current[id] = el }}
          style={styleOverrides}
        >
          {children}
        </div>
      )
    }

    return (
      <div
        ref={el => { sectionRefs.current[id] = el }}
        onClick={sectionClick(id)}
        className={cn(
          'relative cursor-pointer group transition-all duration-200',
          isSelected && !isFieldActive && 'ring-2 ring-inset ring-ring shadow-[0_0_0_4px_rgba(100,195,160,0.15)]',
          isSelected && isFieldActive  && 'ring-2 ring-inset ring-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.25)]',
          !isSelected && 'hover:ring-1 hover:ring-inset hover:ring-ring',
          isBlinking && 'sb-blink',
        )}
        style={styleOverrides}
      >
        {children}

        {/* Dim overlay for all OTHER sections while one is selected */}
        {isDimmed && (
          <div className="absolute inset-0 z-10 bg-gray-900/50 backdrop-blur-[1px] pointer-events-none transition-opacity duration-200" />
        )}

        {/* ── Floating action toolbar — top-left, shown on hover ── */}
        {hasActions && !isDimmed && (
          <div
            className="absolute top-1.5 left-1.5 z-30 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            {/* Move up */}
            {onMoveSection && (
              <button
                onClick={() => onMoveSection(id, 'up')}
                disabled={!canMoveUp}
                title="Move section up"
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-900/75 text-white hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors backdrop-blur-sm">
                <ChevronUp className="w-3 h-3" />
              </button>
            )}
            {/* Move down */}
            {onMoveSection && (
              <button
                onClick={() => onMoveSection(id, 'down')}
                disabled={!canMoveDown}
                title="Move section down"
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-900/75 text-white hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors backdrop-blur-sm">
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
            {/* Hide / Show */}
            {onToggleSection && (
              <button
                onClick={() => onToggleSection(id)}
                title={isVisible ? 'Hide section' : 'Show section'}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded backdrop-blur-sm transition-colors',
                  isVisible ? 'bg-gray-900/75 text-white hover:bg-red-500' : 'bg-red-500 text-white hover:bg-red-600'
                )}>
                {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            )}
            {/* Duplicate */}
            {onDuplicateSection && (
              <button
                onClick={() => onDuplicateSection(id)}
                title="Duplicate section"
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-900/75 text-white hover:bg-primary/90 transition-colors backdrop-blur-sm">
                <Copy className="w-3 h-3" />
              </button>
            )}
            {/* Section style shortcut — scrolls to Style panel in right column */}
            <button
              onClick={() => onSelectSection(id)}
              title="Edit section style (background, padding)"
              className="w-5 h-5 flex items-center justify-center rounded bg-gray-900/75 text-white hover:bg-indigo-500 transition-colors backdrop-blur-sm">
              <Palette className="w-3 h-3" />
            </button>
            {/* Padding indicator */}
            {(extraPad > 0 || padTop > 0 || padBottom > 0) && (
              <span className="ml-0.5 text-[8px] font-mono bg-gray-900/75 text-white px-1 py-0.5 rounded backdrop-blur-sm">
                {padTop > 0 ? `↑${padTop}` : ''}{padBottom > 0 ? `↓${padBottom}` : ''}{extraPad > 0 ? `+${extraPad}` : ''}px
              </span>
            )}
          </div>
        )}

        {/* Hover hint — only when nothing is selected and no actions toolbar */}
        {!selectedSectionId && !hasActions && (
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-sm text-xs text-gray-600 font-semibold px-1.5 py-0.5 rounded-full shadow-sm border border-gray-200 pointer-events-none z-20">
            <MousePointer className="w-2.5 h-2.5" /> click to edit
          </div>
        )}

        {/* ── Bottom resize drag handle ── */}
        {hasActions && !isDimmed && (
          <div
            onMouseDown={e => startPaddingDrag(e, id)}
            title="Drag to adjust section spacing"
            className={cn(
              'absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize z-30',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              isPaddingDragging && 'opacity-100'
            )}
          >
            <div className={cn(
              'h-1 w-10 rounded-full transition-all',
              isPaddingDragging ? 'bg-accent w-16' : 'bg-gray-400/60 group-hover:bg-primary/50'
            )} />
          </div>
        )}

        {/* Info bar — rendered in normal flow BELOW section content, never overlaps */}
        {isSelected && def && (
          <div
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 transition-colors duration-300',
              isFieldActive ? 'bg-amber-500' : 'bg-primary',
            )}
            style={{ borderTop: `2px solid ${isFieldActive ? '#f59e0b' : '#64C3A0'}` }}
          >
            <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', isFieldActive ? 'bg-white/25' : 'bg-white/20')}>
              {isFieldActive
                ? <Sparkles className="w-3.5 h-3.5 text-white" style={{ animation: 'pulse 0.6s ease-in-out infinite' }} />
                : <def.icon className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold leading-tight">{def.label}</p>
              {isFieldActive && activeFieldDef ? (
                <p className="text-amber-100 text-xs leading-snug truncate font-medium">
                  ✏ Editing: <span className="text-white font-bold">{activeFieldDef.label}</span>
                </p>
              ) : (
                <p className="text-primary-foreground/85 text-xs leading-snug truncate">{def.description}</p>
              )}
            </div>
            {!isFieldActive && (
              <div className="shrink-0 flex items-center gap-1 text-xs text-primary/50 font-medium whitespace-nowrap">
                <Pencil className="w-2.5 h-2.5" /> Edit above · Structure →
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Detail item lookups
  const detailProduct = previewDetail?.type === 'product' ? products.find(p => p.id === previewDetail.id) : null
  const detailService = previewDetail?.type === 'service' ? services.find(sv => sv.id === previewDetail.id) : null

  return (
    <div
      className="antialiased sb-storefront-preview-scope"
      style={{
        ...previewStorefrontCssVars,
        backgroundColor: bg,
        fontFamily: s.font_heading,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
      onClick={isBrowse ? undefined : () => onSelectSection(null)}
    >
      {/* Nav — match live business front UnifiedNav: light chrome, not dashboard dark card */}
      <div
        style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
        className="px-4 py-3 flex items-center justify-between sticky top-0 z-10"
      >
        <button className="flex items-center gap-2" onClick={navigateTo('/')}>
          {logo ? <img src={logo} alt="" className="w-7 h-7 rounded-lg object-cover" /> : <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.primary_color + '20' }}><ShoppingBag className="w-4 h-4" style={{ color: s.primary_color }} /></div>}
          <span className="font-bold text-sm" style={{ fontFamily: s.font_heading, color: s.primary_color }}>{vendor?.display_name || 'Your Store'}</span>
        </button>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {visible('featured_products') && (
            <button type="button" onClick={navigateTo('/products')} className={cn('hover:underline transition-colors', previewRoute === '/products' && 'font-bold')} style={{ color: previewRoute === '/products' ? s.primary_color : undefined }}>Products</button>
          )}
          {visible('featured_services') && (
            <button type="button" onClick={navigateTo('/services')} className={cn('hover:underline transition-colors', previewRoute === '/services' && 'font-bold')} style={{ color: previewRoute === '/services' ? s.primary_color : undefined }}>Services</button>
          )}
          {visible('about_us') && (
            <button type="button" onClick={navigateTo('/about')} className={cn('hover:underline transition-colors', previewRoute === '/about' && 'font-bold')} style={{ color: previewRoute === '/about' ? s.primary_color : undefined }}>About</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50">
            <ShoppingBag className="w-3.5 h-3.5 m-auto mt-1" style={{ color: s.primary_color }} />
          </div>
        </div>
      </div>

      {/* Browse-mode status bar */}
      {isBrowse && (
        <div className="px-3 py-1.5 flex items-center gap-2 text-xs font-medium sticky top-[52px] z-10" style={{ backgroundColor: s.primary_color, color: '#fff' }}>
          <span className="flex items-center gap-1 opacity-90"><Check className="w-3 h-3" /> Live Preview — click anything to navigate</span>
          <div className="ml-auto flex items-center gap-0.5 opacity-70">
            <Pencil className="w-2.5 h-2.5" /> Click Edit to resume editing
          </div>
        </div>
      )}

      {/* Breadcrumb when on an inner page */}
      {previewRoute !== '/' && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs border-b border-gray-200 bg-gray-50 text-gray-500">
          <button type="button" onClick={navigateTo('/')} className="flex items-center gap-0.5 font-medium hover:underline" style={{ color: s.primary_color }}>
            <ArrowLeft className="w-3 h-3" /> Home
          </button>
          <span>/</span>
          <button type="button" onClick={navigateTo(previewDetail?.type === 'product' ? '/products' : previewDetail?.type === 'service' ? '/services' : previewRoute)} className="hover:underline" style={{ color: previewDetail ? s.primary_color : '#111827' }}>
            {previewRoute.replace('/', '').charAt(0).toUpperCase() + previewRoute.slice(2)}
          </button>
          {previewDetail && (
            <>
              <span>/</span>
              <span className="font-semibold truncate max-w-[80px] text-gray-900">
                {detailProduct?.name || detailService?.name || 'Detail'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Products page */}
      {previewRoute === '/products' && !previewDetail && (
        <div style={{ padding: spacing }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ fontFamily: s.font_heading }}>All Products</h2>
            <div className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: s.primary_color + '15', color: s.primary_color }}>
              {products.length > 0 ? `${products.length} items` : 'No products yet'}
            </div>
          </div>
          {/* Filter row */}
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex-1 h-7 rounded-lg border flex items-center px-2 gap-1" style={{ borderColor, backgroundColor: cardBg }}>
              <span className="text-xs" style={{ color: subTextColor }}>Search products…</span>
            </div>
            <div className="h-7 px-2 rounded-lg border text-xs flex items-center" style={{ borderColor, backgroundColor: cardBg, color: subTextColor }}>Filter</div>
            <div className="h-7 px-2 rounded-lg border text-xs flex items-center" style={{ borderColor, backgroundColor: cardBg, color: subTextColor }}>Sort</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {products.length > 0
              ? products.slice(0, 8).map((product) => {
                  const img = product.images?.find(i => i.is_primary) ?? product.images?.[0]
                  const imgUrl = mediaUrl(img?.url)
                  return (
                    <div key={product.id} onClick={viewDetail('product', product.id)} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}`, cursor: 'pointer' }} className="overflow-hidden hover:shadow-md transition-shadow">
                      {imgUrl
                        ? <img src={imgUrl} alt={product.name} className="w-full object-cover" style={{ height: '80px' }} />
                        : <div className="flex items-center justify-center" style={{ height: '80px', backgroundColor: s.primary_color + '10' }}><Package className="w-6 h-6" style={{ color: s.primary_color + '50' }} /></div>}
                      <div className="p-2">
                        <p className="text-xs font-medium truncate" style={{ color: textColor }}>{product.name}</p>
                        <p className="text-xs font-bold mt-0.5" style={{ color: s.primary_color }}>{product.currency} {product.price?.toLocaleString()}</p>
                      </div>
                    </div>
                  )
                })
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="overflow-hidden">
                    <div className="flex items-center justify-center" style={{ height: '80px', backgroundColor: s.primary_color + '08' }}><Package className="w-6 h-6" style={{ color: s.primary_color + '30' }} /></div>
                    <div className="p-2"><div className="h-2 w-3/4 rounded mb-1.5" style={{ backgroundColor: borderColor }} /><div className="h-2 w-1/2 rounded" style={{ backgroundColor: s.primary_color + '25' }} /></div>
                  </div>
                ))}
          </div>
          <div className="mt-3 p-2.5 rounded-xl text-center text-xs border" style={{ backgroundColor: s.primary_color + '08', borderColor: s.primary_color + '25', color: s.primary_color }}>
            <span className="font-semibold">This page auto-renders your products</span> — manage them in the <strong>Products</strong> tab.
          </div>
        </div>
      )}

      {/* Services page */}
      {previewRoute === '/services' && !previewDetail && (
        <div style={{ padding: spacing }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ fontFamily: s.font_heading }}>All Services</h2>
            <div className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: s.primary_color + '15', color: s.primary_color }}>
              {services.length > 0 ? `${services.length} services` : 'No services yet'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex-1 h-7 rounded-lg border flex items-center px-2" style={{ borderColor, backgroundColor: cardBg }}>
              <span className="text-xs" style={{ color: subTextColor }}>Search services…</span>
            </div>
            <div className="h-7 px-2 rounded-lg border text-xs flex items-center" style={{ borderColor, backgroundColor: cardBg, color: subTextColor }}>Category</div>
          </div>
          <div className="space-y-2">
            {services.length > 0
              ? services.slice(0, 6).map((svc) => {
                  const imgUrl = mediaUrl(svc.image_url)
                  const priceLabel = svc.price ? `${svc.currency} ${svc.price.toLocaleString()}` : 'On request'
                  return (
                    <div key={svc.id} onClick={viewDetail('service', svc.id)} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}`, cursor: 'pointer' }} className="flex gap-2 p-2.5 hover:shadow-md transition-shadow">
                      {imgUrl
                        ? <img src={imgUrl} alt={svc.name} className="rounded-lg object-cover shrink-0" style={{ width: '48px', height: '48px' }} />
                        : <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: '48px', height: '48px', backgroundColor: s.primary_color + '15' }}><Wrench className="w-5 h-5" style={{ color: s.primary_color }} /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: textColor }}>{svc.name}</p>
                        {svc.short_description && <p className="text-xs truncate mt-0.5" style={{ color: subTextColor }}>{svc.short_description}</p>}
                        <p className="text-xs font-bold mt-1" style={{ color: s.primary_color }}>{priceLabel}</p>
                      </div>
                      <div className="self-center text-xs px-2 py-1 rounded-lg font-semibold text-white shrink-0" style={{ backgroundColor: s.primary_color, borderRadius: brStyle }}>Book</div>
                    </div>
                  )
                })
              : [1, 2, 3].map(i => (
                  <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="flex gap-2 p-2.5">
                    <div className="rounded-lg shrink-0" style={{ width: '48px', height: '48px', backgroundColor: s.primary_color + '10' }} />
                    <div className="flex-1"><div className="h-2 w-1/2 rounded mb-1.5" style={{ backgroundColor: borderColor }} /><div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: borderColor }} /></div>
                  </div>
                ))}
          </div>
          <div className="mt-3 p-2.5 rounded-xl text-center text-xs border" style={{ backgroundColor: s.primary_color + '08', borderColor: s.primary_color + '25', color: s.primary_color }}>
            <span className="font-semibold">This page auto-renders your services</span> — manage them in the <strong>Services</strong> tab.
          </div>
        </div>
      )}

      {/* About page */}
      {previewRoute === '/about' && !previewDetail && (() => {
        const sec = draft.sections.find(s => s.id === 'about_us')
        const p2 = sec?.props || {}
        const aboutDesc = (p2.description as string) || vendor?.description || ''
        const aboutImg = (p2.image_url as string) ? resolveStorefrontPreviewImageSrc(p2.image_url as string) : logo
        return (
          <div style={{ padding: spacing }}>
            <h2 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading }}>{(p2.headline as string) || 'About Us'}</h2>
            {aboutImg && <img src={aboutImg} alt="about" className="w-full object-cover rounded-xl mb-3" style={{ height: '100px', border: `1px solid ${borderColor}` }} />}
            {(p2.subtitle as string) && <p className="text-xs font-medium mb-2" style={{ color: s.primary_color }}>{p2.subtitle as string}</p>}
            {aboutDesc
              ? <p className="text-xs leading-relaxed" style={{ color: subTextColor }}>{aboutDesc}</p>
              : [1,2,3,4].map(i => <div key={i} className="h-1.5 rounded mb-1.5" style={{ backgroundColor: borderColor, width: i === 4 ? '60%' : '100%' }} />)}
            {(p2.cta_primary as string) && (
              <div className="mt-3 inline-block text-xs px-3 py-1.5 font-semibold text-white" style={{ backgroundColor: s.primary_color, borderRadius: brStyle }}>
                {p2.cta_primary as string}
              </div>
            )}
            <div className="mt-4 p-2.5 rounded-xl text-center text-xs border" style={{ backgroundColor: s.primary_color + '08', borderColor: s.primary_color + '25', color: s.primary_color }}>
              Edit this content in the <strong>About Us</strong> section on the home preview.
            </div>
          </div>
        )
      })()}

      {/* Product detail page */}
      {previewDetail?.type === 'product' && (() => {
        const prod = detailProduct
        if (!prod) return <div style={{ padding: spacing }} className="text-center text-xs text-gray-400">Product not found</div>
        const img = prod.images?.find(i => i.is_primary) ?? prod.images?.[0]
        const imgUrl = mediaUrl(img?.url)
        return (
          <div style={{ padding: spacing }}>
            {imgUrl
              ? <img src={imgUrl} alt={prod.name} className="w-full object-cover rounded-xl mb-3" style={{ height: '130px', border: `1px solid ${borderColor}` }} />
              : <div className="flex items-center justify-center rounded-xl mb-3" style={{ height: '130px', backgroundColor: s.primary_color + '10', border: `1px solid ${borderColor}` }}><Package className="w-10 h-10" style={{ color: s.primary_color + '50' }} /></div>}
            <h2 className="text-sm font-bold" style={{ fontFamily: s.font_heading, color: textColor }}>{prod.name}</h2>
            <p className="text-base font-bold mt-1" style={{ color: s.primary_color }}>{prod.currency} {prod.price?.toLocaleString()}</p>
            {prod.description && <p className="text-xs mt-2 leading-relaxed line-clamp-4" style={{ color: subTextColor }}>{prod.description}</p>}
            <div className="mt-3 flex gap-2">
              <div className="flex-1 py-2 text-center text-xs font-bold text-white rounded-lg" style={{ backgroundColor: s.primary_color, borderRadius: brStyle }}>Add to Cart</div>
              <div className="flex-1 py-2 text-center text-xs font-medium rounded-lg border" style={{ borderColor, color: textColor, borderRadius: brStyle }}>Wishlist</div>
            </div>
            <div className="mt-3 p-2.5 rounded-xl text-center text-xs border" style={{ backgroundColor: s.primary_color + '08', borderColor: s.primary_color + '25', color: s.primary_color }}>
              Manage product details in the <strong>Products</strong> tab.
            </div>
          </div>
        )
      })()}

      {/* Service detail page */}
      {previewDetail?.type === 'service' && (() => {
        const svc = detailService
        if (!svc) return <div style={{ padding: spacing }} className="text-center text-xs text-gray-400">Service not found</div>
        const imgUrl = mediaUrl(svc.image_url)
        const priceLabel = svc.price ? `${svc.currency} ${svc.price.toLocaleString()}` : svc.price_min ? `From ${svc.currency} ${svc.price_min.toLocaleString()}` : 'On request'
        return (
          <div style={{ padding: spacing }}>
            {imgUrl
              ? <img src={imgUrl} alt={svc.name} className="w-full object-cover rounded-xl mb-3" style={{ height: '130px', border: `1px solid ${borderColor}` }} />
              : <div className="flex items-center justify-center rounded-xl mb-3" style={{ height: '130px', backgroundColor: s.primary_color + '10', border: `1px solid ${borderColor}` }}><Wrench className="w-10 h-10" style={{ color: s.primary_color + '50' }} /></div>}
            <h2 className="text-sm font-bold" style={{ fontFamily: s.font_heading, color: textColor }}>{svc.name}</h2>
            <p className="text-base font-bold mt-1" style={{ color: s.primary_color }}>{priceLabel}</p>
            {svc.duration_minutes && <p className="text-xs mt-0.5" style={{ color: subTextColor }}>Duration: {svc.duration_minutes} min</p>}
            {(svc.short_description || svc.description) && <p className="text-xs mt-2 leading-relaxed line-clamp-4" style={{ color: subTextColor }}>{svc.short_description || svc.description}</p>}
            <div className="mt-3 flex gap-2">
              <div className="flex-1 py-2 text-center text-xs font-bold text-white rounded-lg" style={{ backgroundColor: s.primary_color, borderRadius: brStyle }}>Book Now</div>
              <div className="flex-1 py-2 text-center text-xs font-medium rounded-lg border" style={{ borderColor, color: textColor, borderRadius: brStyle }}>Enquire</div>
            </div>
            <div className="mt-3 p-2.5 rounded-xl text-center text-xs border" style={{ backgroundColor: s.primary_color + '08', borderColor: s.primary_color + '25', color: s.primary_color }}>
              Manage service details in the <strong>Services</strong> tab.
            </div>
          </div>
        )
      })()}

      {/* Home sections */}
      {previewRoute === '/' && !previewDetail && orderedVisible.map(sec => {
        const props = sec.props
        // Duplicated sections have an id like "hero_copy" — strip suffix so the renderer matches
        const renderId = sec.id.replace(/_copy$/, '')

        if (renderId === 'announcement_bar') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div
              className="text-center py-2 text-xs font-medium text-white"
              style={{
                backgroundColor: (props.announcement_color as string) || s.primary_color,
                ...fieldTypographyStyle(props as HomeSectionProps, 'announcement_text'),
              }}
            >
              {(props.announcement_text as string) || 'Free delivery on orders above ₹500! 🎉'}
            </div>
          </SectionWrapper>
        )

        if (renderId === 'hero') {
          const heroProps = previewSectionPropsWithResolvedImages(sec.props as HomeSectionProps)
          const homeTheme = homeThemeForHero(s, heroProps)
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <HeroSection
                props={heroProps}
                theme={homeTheme}
                vendor={vendor}
                storePath={(p) => p}
                builderTemplateId={draft.template_id}
                onPreviewNavigate={onPreviewNavigate}
                previewNavigateEnabled={isBrowse}
              />
            </SectionWrapper>
          )
        }

        if (renderId === 'trust_badges') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ backgroundColor: cardBg, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, padding: `8px ${spacing}` }} className="flex justify-around">
              {(['badge_1', 'badge_2', 'badge_3'] as const).map((bk) => {
                const b = props[bk] as string
                if (!b) return null
                return (
                  <span key={bk} className="text-xs font-medium flex items-center gap-1" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, bk) }}>
                    <Truck className="w-3 h-3" style={{ color: s.primary_color }} />{b}
                  </span>
                )
              })}
            </div>
          </SectionWrapper>
        )

        if (renderId === 'featured_products') {
          const cols = props.layout === 'grid-4' ? 4 : 3
          const hasReal = products.length > 0
          const displayProducts = hasReal ? products.slice(0, cols) : []
          const isThisSelected = selectedSectionId === sec.id
          const cardH = parseInt((props.card_height as string) || '140')
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing, paddingBottom: isThisSelected ? '60px' : spacing }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Featured Products'}</h3>
                  <button onClick={navigateTo('/products')} className="text-xs flex items-center gap-0.5 hover:underline" style={{ color: s.primary_color }}>See all <ChevronRight className="w-3 h-3" /></button>
                </div>
                {hasReal && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: s.primary_color + '15', color: s.primary_color }}>● Live data from your store</span>
                  </div>
                )}
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {hasReal ? displayProducts.map((product) => {
                    const img = product.images?.find(i => i.is_primary) ?? product.images?.[0]
                    const imgUrl = mediaUrl(img?.url)
                    const price = product.price
                    return (
                      <div key={product.id} onClick={isBrowse ? viewDetail('product', product.id) : undefined} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}`, cursor: isBrowse ? 'pointer' : 'default' }} className={cn('overflow-hidden', isBrowse && 'hover:shadow-md transition-shadow')}>
                        {imgUrl ? (
                          <img src={imgUrl} alt={product.name} className="w-full object-cover" style={{ height: `${cardH}px` }} />
                        ) : (
                          <div className="flex items-center justify-center" style={{ height: `${cardH}px`, backgroundColor: s.primary_color + '12' }}>
                            <Package className="w-6 h-6" style={{ color: s.primary_color + '60' }} />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-xs font-medium leading-tight truncate" style={{ color: textColor }}>{product.name}</p>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[1,2,3,4,5].map(n => <Star key={n} className="w-2 h-2" fill={n <= 4 ? s.accent_color : 'none'} style={{ color: n <= 4 ? s.accent_color : '#d1d5db' }} />)}
                          </div>
                          <p className="text-xs font-bold mt-1" style={{ color: s.primary_color }}>{product.currency} {price?.toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  }) : Array.from({ length: cols }).map((_, i) => (
                    <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="overflow-hidden">
                      <div className="flex flex-col items-center justify-center gap-1" style={{ height: `${cardH}px`, backgroundColor: s.primary_color + '08' }}>
                        <Package className="w-6 h-6" style={{ color: s.primary_color + '40' }} />
                        <p className="text-xs" style={{ color: subTextColor }}>Your product</p>
                      </div>
                      <div className="p-2">
                        <div className="h-2 w-2/3 rounded mb-1.5" style={{ backgroundColor: borderColor }} />
                        <div className="h-2.5 w-1/2 rounded" style={{ backgroundColor: s.primary_color + '30' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {!hasReal && (
                  <p className="text-xs text-center mt-2" style={{ color: subTextColor }}>Add products to your store to see them here</p>
                )}
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'featured_services') {
          const hasReal = services.length > 0
          const displayServices = hasReal ? services.slice(0, 3) : []
          const isThisSelected = selectedSectionId === sec.id
          const svcCardH = parseInt((props.card_height as string) || '40')
          const svcHidden = (key: string) => ((props.hidden_fields as string[]) || []).includes(key)
          const showSvcImage    = !svcHidden('card_image')
          const showSvcDesc     = !svcHidden('card_description')
          const showSvcPrice    = !svcHidden('card_price')
          const showSvcRating   = !svcHidden('card_rating')
          const showSvcDuration = !svcHidden('card_duration')
          const showSvcSubtitle = !svcHidden('subtitle')
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing, paddingBottom: isThisSelected ? '60px' : spacing }}>
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-sm font-bold" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Our Services'}</h3>
                  <button onClick={navigateTo('/services')} className="text-xs flex items-center gap-0.5 hover:underline" style={{ color: s.primary_color }}>See all <ChevronRight className="w-3 h-3" /></button>
                </div>
                {showSvcSubtitle && <p className="text-xs mb-2 mt-0.5" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{(props.subtitle as string) || 'Professional services tailored for you'}</p>}
                {!showSvcSubtitle && <div className="mb-3" />}
                {hasReal && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: s.primary_color + '15', color: s.primary_color }}>● Live data from your store</span>
                  </div>
                )}
                <div className="space-y-2">
                  {hasReal ? displayServices.map((svc) => {
                    const imgUrl = mediaUrl(svc.image_url)
                    const priceLabel = svc.price ? `${svc.currency} ${svc.price.toLocaleString()}` : svc.price_min ? `From ${svc.currency} ${svc.price_min.toLocaleString()}` : 'On request'
                    return (
                      <div key={svc.id} onClick={isBrowse ? viewDetail('service', svc.id) : undefined} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}`, cursor: isBrowse ? 'pointer' : 'default' }} className={cn('flex gap-2 p-2', isBrowse && 'hover:shadow-md transition-shadow')}>
                        {showSvcImage && (imgUrl ? (
                          <img src={imgUrl} alt={svc.name} className="rounded-lg object-cover shrink-0" style={{ width: `${svcCardH}px`, height: `${svcCardH}px` }} />
                        ) : (
                          <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: `${svcCardH}px`, height: `${svcCardH}px`, backgroundColor: s.primary_color + '15' }}><Wrench className="w-4 h-4" style={{ color: s.primary_color }} /></div>
                        ))}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: textColor }}>{svc.name}</p>
                          {showSvcRating && (svc.avg_rating ?? 0) > 0 && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {[1,2,3,4,5].map(n => (
                                <span key={n} className="text-[8px]" style={{ color: n <= Math.round(svc.avg_rating ?? 0) ? '#f59e0b' : borderColor }}>★</span>
                              ))}
                            </div>
                          )}
                          {showSvcDesc && svc.short_description && <p className="text-xs truncate mt-0.5" style={{ color: subTextColor }}>{svc.short_description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {showSvcPrice && <p className="text-xs font-bold" style={{ color: s.primary_color }}>{priceLabel}</p>}
                            {showSvcDuration && svc.duration_minutes && <p className="text-xs" style={{ color: subTextColor }}>{svc.duration_minutes} min</p>}
                          </div>
                        </div>
                      </div>
                    )
                  }) : [1, 2].map(i => (
                    <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="flex gap-2 p-2">
                      {showSvcImage && <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.primary_color + '15' }}><Wrench className="w-5 h-5" style={{ color: s.primary_color }} /></div>}
                      <div className="flex-1">
                        <div className="h-2 w-1/2 rounded mb-1" style={{ backgroundColor: borderColor }} />
                        {showSvcDesc && <div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: borderColor }} />}
                        {showSvcPrice && <div className="h-2 w-1/4 rounded mt-1" style={{ backgroundColor: s.primary_color + '30' }} />}
                      </div>
                    </div>
                  ))}
                  {!hasReal && (
                    <p className="text-xs text-center mt-1" style={{ color: subTextColor }}>Add services to your store to see them here</p>
                  )}
                </div>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'category_showcase') {
          const sampleCategories = [
            { name: 'Electronics', emoji: '📱' }, { name: 'Fashion', emoji: '👗' },
            { name: 'Home & Living', emoji: '🏠' }, { name: 'Sports', emoji: '⚽' },
            { name: 'Beauty', emoji: '💄' }, { name: 'Books', emoji: '📚' },
          ]
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing, paddingBottom: selectedSectionId === sec.id ? '52px' : spacing }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Shop by Category'}</h3>
                  <span className="text-xs" style={{ color: s.primary_color }}>View all</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {sampleCategories.map((cat, i) => (
                    <div key={i} style={{ backgroundColor: s.primary_color + '18', borderRadius: brStyle, border: `1px solid ${s.primary_color}25` }}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 text-center">
                      <span className="text-xl leading-none">{cat.emoji}</span>
                      <p className="text-xs font-medium leading-tight" style={{ color: textColor }}>{cat.name}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center mt-2 italic" style={{ color: subTextColor }}>Categories from your store will appear here</p>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'offers_banner') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ margin: `0 ${spacing}`, marginBottom: spacing, borderRadius: brStyle, padding: spacing, textAlign: 'center', background: `linear-gradient(135deg, ${s.accent_color}22, ${s.primary_color}22)`, border: `1px dashed ${s.accent_color}` }}>
              <p className="text-xs font-bold" style={{ color: s.accent_color, ...fieldTypographyStyle(props as HomeSectionProps, 'headline') }}>{(props.headline as string) || 'Special Offers'}</p>
              {props.subtitle && <p className="text-xs mt-0.5" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{props.subtitle as string}</p>}
            </div>
          </SectionWrapper>
        )

        if (renderId === 'testimonials') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing, backgroundColor: s.dark_mode ? '#1a1740' : '#f9fafb' }}>
              <h3 className="text-sm font-bold mb-3 text-center" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'What Our Customers Say'}</h3>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map(i => (
                  <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="p-2.5">
                    <div className="flex gap-0.5 mb-1.5">{[1,2,3,4,5].map(n => <Star key={n} className="w-2.5 h-2.5" fill={s.accent_color} style={{ color: s.accent_color }} />)}</div>
                    <div className="h-1.5 w-full rounded mb-1" style={{ backgroundColor: borderColor }} />
                    <div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: borderColor }} />
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: s.primary_color + '30' }} />
                      <div className="h-1.5 w-12 rounded" style={{ backgroundColor: borderColor }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'about_us') {
          const aboutDesc    = (props.description as string) || vendor?.description || ''
          const aboutTagline = (props.subtitle as string) || ''
          const aboutCta     = (props.cta_primary as string) || ''
          const aboutImg     = (props.image_url as string) ? resolveStorefrontPreviewImageSrc(props.image_url as string) : logo
          const aboutImgSize = parseInt((props.image_size as string) || '80')
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }} className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold mb-1" style={{ fontFamily: s.font_heading, color: textColor, ...fieldTypographyStyle(props as HomeSectionProps, 'headline') }}>{(props.headline as string) || 'About Us'}</h3>
                  {aboutTagline && <p className="text-xs font-medium mb-1.5" style={{ color: s.primary_color, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{aboutTagline}</p>}
                  {aboutDesc
                    ? <p className="text-xs leading-relaxed line-clamp-4" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'description') }}>{aboutDesc}</p>
                    : [1,2,3].map(i => <div key={i} className="h-1.5 rounded mb-1.5" style={{ backgroundColor: borderColor, width: i === 3 ? '60%' : '100%' }} />)
                  }
                  {aboutCta && (
                    <div className="mt-2 inline-block text-xs px-2.5 py-1 font-semibold text-white" style={{ backgroundColor: s.primary_color, borderRadius: brStyle, ...fieldTypographyStyle(props as HomeSectionProps, 'cta_primary') }}>
                      {aboutCta}
                    </div>
                  )}
                </div>
                {aboutImg
                  ? <img src={aboutImg} alt="about" className="rounded-xl object-cover shrink-0" style={{ width: `${aboutImgSize}px`, height: `${aboutImgSize}px`, border: `1px solid ${borderColor}` }} />
                  : <div className="rounded-xl shrink-0 flex flex-col items-center justify-center gap-1" style={{ width: `${aboutImgSize}px`, height: `${aboutImgSize}px`, backgroundColor: s.primary_color + '15', border: `1px dashed ${s.primary_color}40` }}>
                      <ImageIcon className="w-5 h-5" style={{ color: s.primary_color + '80' }} />
                      <span className="text-[7px] font-medium" style={{ color: s.primary_color + '80' }}>Add image</span>
                    </div>
                }
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'contact_map') {
          const phone    = (props.custom_phone as string) || vendor?.primary_phone || ''
          const email    = (props.custom_email as string) || vendor?.primary_email || ''
          const address  = [vendor?.street_address, vendor?.city, vendor?.state].filter(Boolean).join(', ')
          const mapBoxH  = parseInt((props.map_height as string) || '80')
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }}>
                <h3 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading, color: textColor, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Find Us'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ backgroundColor: s.primary_color + '10', borderRadius: brStyle, border: `1px solid ${borderColor}`, height: `${mapBoxH}px` }} className="flex items-center justify-center">
                    <MapPin className="w-8 h-8" style={{ color: s.primary_color + '60' }} />
                  </div>
                  <div className="space-y-2">
                    {address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" style={{ color: s.primary_color }} />
                        <p className="text-xs leading-snug" style={{ color: subTextColor }}>{address}</p>
                      </div>
                    )}
                    {phone && (
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 shrink-0" style={{ color: s.primary_color }} />
                        <p className="text-xs" style={{ color: subTextColor }}>{phone}</p>
                      </div>
                    )}
                    {email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 shrink-0" style={{ color: s.primary_color }} />
                        <p className="text-xs truncate" style={{ color: subTextColor }}>{email}</p>
                      </div>
                    )}
                    {!address && !phone && !email && [MapPin, Wrench, Mail].map((Icon, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 shrink-0" style={{ color: s.primary_color }} />
                        <div className="h-1.5 flex-1 rounded" style={{ backgroundColor: borderColor }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'newsletter') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ backgroundColor: s.primary_color + '10', padding: spacing, textAlign: 'center' }}>
              <Mail className="w-6 h-6 mx-auto mb-2" style={{ color: s.primary_color }} />
              <h3 className="text-sm font-bold mb-1" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'headline') }}>{(props.headline as string) || 'Stay in the loop'}</h3>
              {props.subtitle && <p className="text-xs mb-3" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{props.subtitle as string}</p>}
              <div className="flex gap-1.5 max-w-xs mx-auto">
                <div className="flex-1 h-8 rounded-lg border" style={{ borderColor, backgroundColor: cardBg }} />
                <div className="h-8 px-3 rounded-lg text-xs font-medium text-white flex items-center" style={{ backgroundColor: s.primary_color, borderRadius: brStyle }}>Subscribe</div>
              </div>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'job_board') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing }}>
              <h3 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Join Our Team'}</h3>
              {[1,2].map(i => (
                <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="flex items-center gap-2 p-2 mb-1.5">
                  <Briefcase className="w-4 h-4 shrink-0" style={{ color: s.primary_color }} />
                  <div className="flex-1"><div className="h-1.5 w-1/2 rounded" style={{ backgroundColor: borderColor }} /></div>
                  <div className="h-5 px-2 rounded-full text-xs font-medium text-white flex items-center" style={{ backgroundColor: s.primary_color, borderRadius: '999px' }}>Apply</div>
                </div>
              ))}
            </div>
          </SectionWrapper>
        )

        if (renderId === 'ess_login_card') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing }}>
              <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: brStyle, borderLeft: `3px solid ${s.primary_color}` }} className="flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.primary_color + '15' }}><UserCheck className="w-5 h-5" style={{ color: s.primary_color }} /></div>
                <div className="flex-1">
                  <p className="text-xs font-medium" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'headline') }}>{(props.headline as string) || 'Employee Portal'}</p>
                  <p className="text-xs mt-0.5" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{(props.subtitle as string) || 'Access your self-service dashboard'}</p>
                </div>
                <div className="h-7 px-3 rounded-lg text-xs font-medium text-white flex items-center" style={{ backgroundColor: s.primary_color, borderRadius: brStyle }}>Login</div>
              </div>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'cta_banner') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ margin: `0 ${spacing}`, marginBottom: spacing, borderRadius: brStyle, padding: spacing, textAlign: 'center', background: `linear-gradient(135deg, ${s.primary_color}, ${s.secondary_color})` }}>
              <p className="text-sm font-bold text-white" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'headline') }}>{(props.headline as string) || 'Ready to get started?'}</p>
              {props.subtitle && <p className="text-xs text-white/80 mt-0.5" style={fieldTypographyStyle(props as HomeSectionProps, 'subtitle')}>{props.subtitle as string}</p>}
              <div className="mt-3 inline-block px-4 py-1.5 text-xs font-bold rounded-lg" style={{ backgroundColor: s.accent_color, color: '#1e293b', borderRadius: brStyle, ...fieldTypographyStyle(props as HomeSectionProps, 'cta_primary') }}>
                {(props.cta_primary as string) || 'Get Started'}
              </div>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'store_locator') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing }}>
              <h3 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Find a Store Near You'}</h3>
              <div className="grid grid-cols-2 gap-2">
                {[{ city: 'Mumbai', tag: 'HQ' }, { city: 'Delhi', tag: null }, { city: 'Bangalore', tag: null }, { city: 'Chennai', tag: null }].map((loc, i) => (
                  <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="p-2.5 flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: s.primary_color }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: textColor }}>{loc.city} Store {loc.tag && <span className="ml-1 text-[8px] px-1 py-0.5 rounded font-bold" style={{ backgroundColor: s.primary_color + '20', color: s.primary_color }}>{loc.tag}</span>}</p>
                      <div className="h-1.5 w-16 rounded mt-1" style={{ backgroundColor: borderColor }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-center mt-2 italic" style={{ color: subTextColor }}>Your branch locations will appear here</p>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'stats') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing, backgroundColor: s.dark_mode ? '#1a1740' : s.primary_color + '08', borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}>
              <div className="grid grid-cols-4 gap-2 text-center">
                {(['1','2','3','4'] as const).map(n => {
                  const val = (props[`stat_${n}_value`] as string)
                  const lbl = (props[`stat_${n}_label`] as string)
                  if (!val && !lbl) return null
                  return (
                    <div key={n} className="py-2">
                      <p className="text-base font-bold leading-none" style={{ color: s.primary_color, ...fieldTypographyStyle(props as HomeSectionProps, `stat_${n}_value`) }}>{val || '—'}</p>
                      <p className="text-xs mt-1 leading-snug" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, `stat_${n}_label`) }}>{lbl || ''}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'faq') {
          const faqSlots = (['1', '2', '3', '4'] as const)
            .map(n => ({ n, q: (props[`faq_${n}_q`] as string) || '', a: (props[`faq_${n}_a`] as string) || '' }))
            .filter(f => f.q)
          const faqDisplay = faqSlots.length
            ? faqSlots
            : [
                { n: '1' as const, q: 'How do I place an order?', a: 'Browse our catalogue and follow the checkout steps.' },
                { n: '2' as const, q: 'What payment methods?', a: 'Cards, UPI, and cash on delivery.' },
              ]
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }}>
                <h3 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Frequently Asked Questions'}</h3>
                <div className="space-y-1.5">
                  {faqDisplay.map((f, i) => (
                    <div key={`${f.n}-${i}`} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2">
                        <p className="text-xs font-medium" style={{ color: textColor, ...fieldTypographyStyle(props as HomeSectionProps, `faq_${f.n}_q`) }}>{f.q}</p>
                        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: subTextColor }} />
                      </div>
                      {i === 0 && f.a && (
                        <div className="px-3 pb-2 border-t" style={{ borderColor }}>
                          <p className="text-xs leading-relaxed mt-1.5" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, `faq_${f.n}_a`) }}>{f.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'pricing') {
          const plans = ['1','2','3'].map(n => ({
            name:  (props[`plan_${n}_name`]  as string) || ['Basic','Standard','Premium'][+n-1],
            price: (props[`plan_${n}_price`] as string) || ['₹999','₹1,999','₹3,999'][+n-1],
            desc:  (props[`plan_${n}_desc`]  as string) || '',
            cta:   (props[`plan_${n}_cta`]   as string) || 'Choose',
          }))
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }}>
                <h3 className="text-sm font-bold mb-3 text-center" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Our Plans'}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {plans.map((pl, i) => {
                    const ni = String(i + 1)
                    return (
                    <div key={i} style={{ backgroundColor: i === 1 ? s.primary_color : cardBg, borderRadius: brStyle, border: `2px solid ${i === 1 ? s.primary_color : borderColor}` }} className="p-2.5 flex flex-col gap-1.5">
                      <p className="text-xs font-bold" style={{ color: i === 1 ? '#fff' : textColor, ...fieldTypographyStyle(props as HomeSectionProps, `plan_${ni}_name`) }}>{pl.name}</p>
                      <p className="text-sm font-extrabold leading-none" style={{ color: i === 1 ? '#fff' : s.primary_color, ...fieldTypographyStyle(props as HomeSectionProps, `plan_${ni}_price`) }}>{pl.price}</p>
                      {pl.desc && <p className="text-[8px] leading-snug flex-1" style={{ color: i === 1 ? 'rgba(255,255,255,0.75)' : subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, `plan_${ni}_desc`) }}>{pl.desc}</p>}
                      <div className="mt-1 text-center text-xs font-bold py-1 rounded" style={{ backgroundColor: i === 1 ? s.accent_color : s.primary_color + '18', color: i === 1 ? '#1e293b' : s.primary_color, borderRadius: brStyle, ...fieldTypographyStyle(props as HomeSectionProps, `plan_${ni}_cta`) }}>
                        {pl.cta}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'gallery') {
          const cols = parseInt((props.columns as string) || '3')
          const imgs = (['1','2','3','4','5','6'] as const).map(n => (props[`image_${n}`] as string) || '')
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }}>
                {(props.title as string) && <h3 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{props.title as string}</h3>}
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {imgs.map((src, i) => (
                    <div key={i} style={{ borderRadius: brStyle, overflow: 'hidden', aspectRatio: '1', backgroundColor: s.primary_color + '12', border: `1px solid ${borderColor}` }} className="flex items-center justify-center">
                      {src
                        ? <img src={resolveStorefrontPreviewImageSrc(src)} alt="" className="w-full h-full object-cover" />
                        : <Camera className="w-5 h-5" style={{ color: s.primary_color + '40' }} />}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center mt-2 italic" style={{ color: subTextColor }}>Upload photos above to populate your gallery</p>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'blog_grid') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Latest News & Updates'}</h3>
                <span className="text-xs" style={{ color: s.primary_color }}>View all</span>
              </div>
              <div className="space-y-2">
                {['New product launch', 'Store update', 'Customer story'].map((title, i) => (
                  <div key={i} style={{ backgroundColor: cardBg, borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="flex gap-2.5 p-2.5">
                    <div className="shrink-0 rounded-lg" style={{ width: '44px', height: '44px', backgroundColor: s.primary_color + '15' }}>
                      <FileText className="w-4 h-4 m-auto mt-3" style={{ color: s.primary_color + '60' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: textColor }}>{title}</p>
                      <div className="h-1.5 w-3/4 rounded mt-1.5" style={{ backgroundColor: borderColor }} />
                      <p className="text-[8px] mt-1.5" style={{ color: subTextColor }}>Apr 2026</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-center mt-2 italic" style={{ color: subTextColor }}>Publish blog posts in the Blog section to populate</p>
            </div>
          </SectionWrapper>
        )

        if (renderId === 'video_embed') {
          const vidH = parseInt((props.video_height as string) || '160')
          const vidUrl = (props.video_url as string) || ''
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }}>
                {(props.title as string) && <h3 className="text-sm font-bold mb-2" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{props.title as string}</h3>}
                <div style={{ height: `${vidH}px`, backgroundColor: s.dark_mode ? '#0f0a1e' : s.primary_color + '0c', borderRadius: brStyle, border: `1px solid ${borderColor}` }} className="flex flex-col items-center justify-center gap-2 overflow-hidden relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: s.primary_color }}>
                    <PlayCircle className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-xs" style={{ color: s.dark_mode ? 'rgba(255,255,255,0.55)' : subTextColor }}>{vidUrl ? 'Video configured' : 'Paste a YouTube or Vimeo URL above'}</p>
                </div>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'social_links') {
          const networks: { key: string; label: string; color: string }[] = [
            { key: 'instagram_url',   label: 'Instagram', color: '#e1306c' },
            { key: 'facebook_url',    label: 'Facebook',  color: '#1877f2' },
            { key: 'youtube_url',     label: 'YouTube',   color: '#ff0000' },
            { key: 'whatsapp_number', label: 'WhatsApp',  color: '#25d366' },
            { key: 'twitter_url',     label: 'X / Twitter', color: '#000000' },
            { key: 'linkedin_url',    label: 'LinkedIn',  color: '#0a66c2' },
          ]
          const active = networks.filter(n => props[n.key])
          const display = active.length ? active : networks.slice(0, 4)
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing, textAlign: 'center' }}>
                {(props.title as string) && <h3 className="text-sm font-bold mb-3" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{props.title as string}</h3>}
                <div className="flex justify-center gap-2 flex-wrap">
                  {display.map(n => (
                    <div key={n.key} style={{ backgroundColor: n.color + '18', border: `1px solid ${n.color}40`, borderRadius: brStyle }} className="flex items-center gap-1.5 px-3 py-1.5">
                      <Globe className="w-3 h-3" style={{ color: n.color }} />
                      <span className="text-xs font-medium" style={{ color: n.color }}>{n.label}</span>
                    </div>
                  ))}
                </div>
                {!active.length && <p className="text-xs mt-2 italic" style={{ color: subTextColor }}>Add your social links in the panel</p>}
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'booking_widget') return (
          <SectionWrapper key={sec.id} id={sec.id}>
            <div style={{ padding: spacing }}>
              <div style={{ backgroundColor: s.primary_color + '08', border: `1px solid ${s.primary_color}30`, borderRadius: brStyle }} className="p-4 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: s.primary_color }} />
                <h3 className="text-sm font-bold" style={{ fontFamily: s.font_heading, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Book an Appointment'}</h3>
                {props.subtitle && <p className="text-xs mt-1" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{props.subtitle as string}</p>}
                <div className="mt-3 inline-block px-5 py-2 text-xs font-bold text-white" style={{ backgroundColor: s.primary_color, borderRadius: brStyle, ...fieldTypographyStyle(props as HomeSectionProps, 'cta_label') }}>
                  {(props.cta_label as string) || 'Book Now'}
                </div>
                <p className="text-xs mt-2 italic" style={{ color: subTextColor }}>Links to your live booking calendar</p>
              </div>
            </div>
          </SectionWrapper>
        )

        // ── Editorial & vertical-specific sections ───────────────────────────

        if (renderId === 'marquee_strip') {
          const itemsRaw = (props.items as string) || 'Free returns within 30 days,Made in small batches,New drops every Friday'
          const items = itemsRaw.split(',').map(t => t.trim()).filter(Boolean)
          const speed = (props.speed as string) || 'normal'
          const cls = `sb-ticker-${speed}`
          const display = [...items, ...items]
          const borderC = s.dark_mode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ borderTop: `1px solid ${borderC}`, borderBottom: `1px solid ${borderC}`, padding: '10px 0', overflow: 'hidden' }} className="sb-marquee-mask">
                <div className={`flex gap-10 whitespace-nowrap w-max ${cls}`}>
                  {display.map((t, i) => (
                    <span key={i} className="text-sm font-medium" style={{ color: textColor, opacity: 0.85, ...fieldTypographyStyle(props as HomeSectionProps, 'items') }}>
                      {t} <span style={{ opacity: 0.35, marginLeft: '16px' }}>✦</span>
                    </span>
                  ))}
                </div>
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'editorial_split') {
          const imageSide = (props.image_side as string) || 'left'
          const headline = (props.headline as string) || 'Made slowly, on purpose.'
          const subtitle = (props.subtitle as string) || 'A note from the studio'
          const desc     = (props.description as string) || 'Every piece passes through fewer than ten hands. We think that shows.'
          const cta      = (props.cta_primary as string) || ''
          const imgSrc   = (props.image_url as string) ? resolveStorefrontPreviewImageSrc(props.image_url as string) : null
          const imgEl = imgSrc ? (
            <img src={imgSrc} alt="" className="w-full h-full object-cover" style={{ borderRadius: brStyle }} />
          ) : (
            <div style={{ background: `linear-gradient(135deg, ${s.primary_color}25, ${s.accent_color}18)`, borderRadius: brStyle, width: '100%', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon className="w-8 h-8" style={{ color: s.primary_color + '40' }} />
            </div>
          )
          const textEl = (
            <div style={{ flex: 1, padding: '0 12px' }}>
              {subtitle && <p className="text-xs uppercase tracking-widest mb-2" style={{ color: s.primary_color, opacity: 0.8, ...fieldTypographyStyle(props as HomeSectionProps, 'subtitle') }}>{subtitle}</p>}
              <p className="text-sm font-bold leading-tight mb-2" style={{ fontFamily: s.font_heading, color: textColor, ...fieldTypographyStyle(props as HomeSectionProps, 'headline') }}>{headline}</p>
              <p className="text-xs leading-relaxed" style={{ color: subTextColor, ...fieldTypographyStyle(props as HomeSectionProps, 'description') }}>{desc}</p>
              {cta && <div className="mt-2 text-xs font-medium" style={{ color: s.primary_color, borderBottom: `1px solid ${s.primary_color}40`, display: 'inline-block', paddingBottom: '1px', ...fieldTypographyStyle(props as HomeSectionProps, 'cta_primary') }}>{cta} →</div>}
            </div>
          )
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing, display: 'flex', gap: '12px', alignItems: 'center', flexDirection: imageSide === 'left' ? 'row' : 'row-reverse' }}>
                <div style={{ width: '45%', flexShrink: 0 }}>{imgEl}</div>
                {textEl}
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'restaurant_menu') {
          const homeTheme = homeThemeFromDraft(s)
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <RestaurantMenuSection
                props={sec.props as HomeSectionProps}
                colors={homeTheme.colors}
                theme={homeTheme}
                products={{ items: products }}
                isLoading={false}
                templateId={draft.template_id}
                storePath={(p) => p}
                onPreviewNavigate={onPreviewNavigate}
                previewNavigateEnabled={isBrowse}
              />
            </SectionWrapper>
          )
        }

        if (renderId === 'specialties_grid') {
          const icons = [Heart, Wrench, Star, Users, Clock, MapPin]
          const hasServices = services.length > 0
          const displayServices = hasServices ? services.slice(0, 6) : null
          const viewAllLabel = (props.view_all_label as string) || 'All services →'
          const ctaLabel = (props.cta_label as string) || 'Book →'
          const sampleSpecialties = ['Cardiology', 'Paediatrics', 'Neurology', 'Family Medicine', 'Ophthalmology', 'Diagnostics']
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ padding: spacing }}>
                <div className="flex items-end justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ fontFamily: s.font_heading, color: textColor, ...fieldTypographyStyle(props as HomeSectionProps, 'title') }}>{(props.title as string) || 'Care, by department.'}</h3>
                  <span className="text-xs" style={{ color: s.primary_color, borderBottom: `1px solid ${s.primary_color}40` }}>{viewAllLabel}</span>
                </div>
                {hasServices && <div className="flex items-center gap-1 mb-2"><span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: s.primary_color + '15', color: s.primary_color }}>● Live services from your store</span></div>}
                <div className="grid grid-cols-2 gap-1.5">
                  {(displayServices ?? sampleSpecialties.map(name => ({ id: name, name }))).slice(0, 6).map((item: any, i) => {
                    const Icon = icons[i % icons.length]
                    return (
                      <div key={item.id || i} style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: brStyle }} className="p-2.5">
                        <Icon className="w-4 h-4 mb-1.5" style={{ color: s.primary_color }} />
                        <p className="text-xs font-medium" style={{ color: textColor }}>{item.name}</p>
                        <p className="text-[8px] mt-0.5" style={{ color: s.primary_color, borderBottom: `1px solid ${s.primary_color}30`, display: 'inline-block' }}>{ctaLabel}</p>
                      </div>
                    )
                  })}
                </div>
                {!hasServices && <p className="text-xs text-center mt-2 italic" style={{ color: subTextColor }}>Add services to populate specialties</p>}
              </div>
            </SectionWrapper>
          )
        }

        if (renderId === 'trust_strip') {
          const bgStyle = (props.bg_style as string) || (s.dark_mode ? 'dark' : 'light')
          const stripBg = bgStyle === 'accent'
            ? s.primary_color
            : bgStyle === 'dark'
              ? (s.dark_mode ? '#111' : '#111827')
              : s.bg_color
          const stripText = bgStyle === 'accent' ? '#fff' : bgStyle === 'dark' ? '#d1d5db' : textColor
          const col1Color = bgStyle === 'accent' ? '#fff' : bgStyle === 'dark' ? s.accent_color : s.primary_color
          return (
            <SectionWrapper key={sec.id} id={sec.id}>
              <div style={{ backgroundColor: stripBg, padding: '8px 16px', borderTop: bgStyle === 'light' ? `1px solid ${borderColor}` : undefined, borderBottom: bgStyle === 'light' ? `1px solid ${borderColor}` : undefined }}>
                <div className="grid grid-cols-3 gap-3 text-xs" style={{ color: stripText }}>
                  <div style={{ color: col1Color, fontWeight: 600, ...fieldTypographyStyle(props as HomeSectionProps, 'col_1') }}>{(props.col_1 as string) || '● Emergency open 24/7'}</div>
                  <div style={{ opacity: 0.88, ...fieldTypographyStyle(props as HomeSectionProps, 'col_2') }}>{(props.col_2 as string) || 'Walk-in lab · Mon–Sat 7:00–19:00'}</div>
                  <div style={{ opacity: 0.88, ...fieldTypographyStyle(props as HomeSectionProps, 'col_3') }}>{(props.col_3 as string) || 'Free consultation available'}</div>
                </div>
              </div>
            </SectionWrapper>
          )
        }

        return null
      })}

      {/* Footer */}
      <div
        style={{
          backgroundColor: s.dark_mode ? '#07050f' : cardBg,
          color: s.dark_mode ? '#9ca3af' : subTextColor,
          padding: spacing,
          borderTop: `1px solid ${borderColor}`,
        }}
        className="text-xs flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs" style={{ color: s.dark_mode ? '#fff' : textColor }}>{vendor?.display_name || 'Your Store'}</span>
          {draft.modules.ess_portal && draft.modules.ess_access === 'footer_link' && (
            <span className="px-2 py-0.5 rounded-full text-xs border" style={{ borderColor, color: subTextColor }}>Employee Login</span>
          )}
        </div>
        <div className="flex gap-3" style={{ color: subTextColor }}>
          <span>Privacy</span><span>Terms</span><span>Contact</span>
        </div>
        <div style={{ color: subTextColor }}>© {new Date().getFullYear()} {vendor?.display_name || 'Your Store'}</div>
        {draft.modules.crm_widget && (
          <div className="fixed bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: s.primary_color }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}
