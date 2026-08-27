import type { WebsiteBlock } from '@/types/websites'
import { matchBuilderFontFamily, builderFontFromComputedStyle } from '@storefront/lib/builderFontFamilies'
import {
  getLastInlineStyledSpan,
  getSavedInlineTextSelection,
  getSelectionFontSizePx,
  hasActiveInlineTextSelection,
} from '@storefront/lib/builderInlineTextSelection'
import { CONTENT_GROUP_FIELD_KEY, fieldStyleEntry, isInlinePositionField } from '@storefront/lib/fieldTextStyles'
import { extractFormatPaintStyleFromRange, extractFormatPaintStyleFromElement, resolveFormatPaintStyle } from './builderFormatPainter'
import type { FormatPaintStyle } from './builderFormatPainter'

const NON_EDITABLE_PROP_KEYS = new Set([
  'html', 'bg_image_url', 'image_url', 'bg_image', 'logo_url', 'brand_logo',
  'video_url', 'embed_url', 'map_embed', 'form_action', 'gradient_preset',
  'layout', 'bg_style', 'animation', 'data_source', 'overlays', 'nav_links',
  'social_links', 'form_fields', 'items', 'features', 'plans', 'faqs',
  'nav_style', 'footer_style', 'variant', 'columns', 'aspect_ratio', 'style',
  'spacing', 'height', 'show_close', 'show_annual_toggle', 'show_map', 'full_page',
  'filterable', 'eyebrow_plain', 'cta_square', 'image_position', 'gradient_from',
  'gradient_to', 'gradient_dir', 'show_legal', 'footer_columns', 'categories',
  'members', 'testimonials', 'stats', 'images', 'nav_links', 'form_fields',
  'category_cards', 'menu_items', 'services', 'products', 'blocks', 'links',
  // Footer / nav theme tokens (colors & layout — not copy)
  'footer_bg', 'footer_heading', 'footer_muted', 'footer_border',
  'nav_bg', 'nav_layout', 'nav_glass', 'nav_elevated', 'nav_compact',
  'nav_accent_border', 'nav_cta_prominent', 'tile_bg', 'tile_accent', 'tile_text', 'tile_border',
  'show_newsletter', 'show_search', 'show_cart', 'show_login', 'show_account', 'show_logo',
  'show_brand_name', 'show_nav_links', 'nav_links_source', 'card_style', 'image_shape',
  'use_icons', 'show_numbers', 'item_gap', 'compact', 'overlay',
  '_field_styles', 'section_flip_h', 'section_flip_v', 'section_rotate_deg',
  'content_offset_x', 'content_offset_y', 'content_flip_h', 'content_flip_v', 'content_rotate_deg',
  // Section layout / spacing (Props panel sliders — not copy)
  'padding_top', 'padding_bottom', 'align', 'max_width', 'min_height', 'block_shadow',
  'font_size_px', 'text_scale', 'text_transform', 'text_color_override', 'bg_color_override',
  'top_shape', 'bottom_shape', 'shape_color', 'media_clip', 'item_size', 'bg_color',
  'show_calendar', 'grayscale', 'show_caption', 'show_images', 'image_width', 'show_divider',
  'color', 'target_date', 'data_source', 'hidden_kpi_ids', 'messages', 'menu_categories',
  'posts', 'projects', 'logos', 'hidden_fields',
])

/** Text fields per block type — mirrors Props panel `commonFields` (content only, not URLs). */
const BLOCK_TEXT_FIELDS: Record<string, readonly string[]> = {
  hero: ['eyebrow', 'headline', 'headline_line2', 'subtitle', 'cta_primary', 'cta_secondary'],
  hero_split: ['eyebrow', 'headline', 'headline_line2', 'subtitle', 'cta_primary', 'cta_secondary'],
  hero_minimal: ['headline', 'subtitle', 'cta_primary', 'cta_secondary'],
  cta: ['headline', 'subtitle', 'cta_label', 'text'],
  announcement_bar: ['text'],
  marquee_strip: [],
  nav: ['brand', 'cta_label', 'announcement'],
  footer: ['copyright', 'brand', 'description'],
  newsletter: ['title', 'subtitle', 'cta_label'],
  about_split: ['title', 'subtitle', 'description'],
  features: ['title', 'subtitle'],
  features_alternating: ['title', 'subtitle'],
  stats: ['title'],
  counters: ['title'],
  impact_stats: ['title'],
  testimonials: ['title'],
  team_grid: ['title'],
  pricing: ['title', 'subtitle'],
  'service.pricing': ['title', 'subtitle'],
  faq: ['title'],
  'service.faq': ['title'],
  contact_form: ['title'],
  portfolio_grid: ['title'],
  gallery_masonry: ['title'],
  video_gallery: ['title'],
  blog_grid: ['title'],
  video_embed: ['title'],
  map_embed: ['title', 'address'],
  trust_logos: ['title'],
  timeline: ['title'],
  rich_text: ['content'],
  image_block: ['caption'],
  social_links: ['title'],
  countdown: ['title'],
  product_grid: ['title'],
  category_cards: ['title', 'eyebrow'],
  menu_grid: ['title'],
  services_cards: ['title', 'subtitle'],
  services_list: ['title', 'subtitle'],
  booking_widget: ['title', 'subtitle', 'cta_label', 'service_name'],
  booking_slot_picker: ['title', 'subtitle'],
  live_stock: ['title'],
  order_status: ['title', 'placeholder'],
  live_quote: ['title', 'cta_label'],
  related_products: ['title'],
  product_reviews: ['title'],
  coupon_banner: ['title', 'code'],
  cart_drawer: ['title'],
  cookie_consent: ['message', 'accept_label', 'decline_label'],
  search_bar: ['placeholder'],
  nav: ['brand', 'cta_label', 'announcement'],
  footer: ['brand', 'description', 'copyright'],
  rich_text: ['content'],
  gallery_masonry: ['title'],
  video_gallery: ['title'],
  social_links: ['title'],
  product_grid: ['title', 'subtitle'],
  menu_grid: ['title'],
  category_cards: ['title', 'eyebrow'],
  blog_grid: ['title'],
  booking_slot_picker: ['title', 'subtitle'],
  live_stock: ['title'],
  payment_methods_strip: ['title'],
  recently_viewed: ['title'],
  map_contact: ['title', 'address'],
  offer_banner: ['title', 'code'],
  promo_strip: ['title', 'code'],
  testimonials_grid: ['title'],
  team_list: ['title', 'description'],
  features_icons: ['title', 'subtitle'],
  gallery_grid: ['title'],
  image_gallery: ['title'],
  portfolio_grid: ['title'],
  blog_featured: ['title'],
  blog_list: ['title'],
}

/** Keys shown in Props panel when present on the block — include even if empty. */
const COMMON_PROP_KEYS = [
  'eyebrow', 'headline', 'headline_line2', 'title', 'subtitle', 'description',
  'text', 'content', 'caption', 'cta_primary', 'cta_secondary', 'cta_label',
  'brand', 'copyright', 'message', 'accept_label', 'decline_label', 'placeholder',
  'service_name', 'form_hint', 'submit_label', 'badge_text',
] as const

interface ItemTextFieldDef {
  key: string
  label: string
  multiline?: boolean
}

interface ItemTextSchema {
  arrayKey: string
  itemLabel: string
  fields: ItemTextFieldDef[]
}

const BLOCK_ITEM_TEXT_SCHEMAS: Record<string, ItemTextSchema> = {
  team_grid: {
    arrayKey: 'members', itemLabel: 'Member',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'bio', label: 'Bio', multiline: true },
    ],
  },
  features: {
    arrayKey: 'features', itemLabel: 'Feature',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'desc', label: 'Description', multiline: true },
    ],
  },
  services_cards: {
    arrayKey: 'features', itemLabel: 'Service',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'desc', label: 'Description', multiline: true },
    ],
  },
  services_list: {
    arrayKey: 'features', itemLabel: 'Service',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'desc', label: 'Description', multiline: true },
    ],
  },
  testimonials: {
    arrayKey: 'testimonials', itemLabel: 'Review',
    fields: [
      { key: 'quote', label: 'Quote', multiline: true },
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
    ],
  },
  pricing: {
    arrayKey: 'plans', itemLabel: 'Plan',
    fields: [
      { key: 'name', label: 'Plan name' },
      { key: 'price', label: 'Price' },
      { key: 'period', label: 'Period' },
      { key: 'cta', label: 'Button label' },
      { key: 'cta_url', label: 'Button link' },
    ],
  },
  faq: {
    arrayKey: 'faqs', itemLabel: 'Question',
    fields: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer', multiline: true },
    ],
  },
  gallery_masonry: {
    arrayKey: 'images', itemLabel: 'Image',
    fields: [
      { key: 'caption', label: 'Caption' },
      { key: 'alt', label: 'Alt text' },
    ],
  },
  video_gallery: {
    arrayKey: 'videos', itemLabel: 'Video',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'caption', label: 'Caption', multiline: true },
    ],
  },
  gallery: {
    arrayKey: 'images', itemLabel: 'Image',
    fields: [
      { key: 'caption', label: 'Caption' },
      { key: 'alt', label: 'Alt text' },
    ],
  },
  stats: {
    arrayKey: 'stats', itemLabel: 'Stat',
    fields: [
      { key: 'value', label: 'Value' },
      { key: 'label', label: 'Label' },
    ],
  },
  counters: {
    arrayKey: 'stats', itemLabel: 'Stat',
    fields: [
      { key: 'value', label: 'Value' },
      { key: 'label', label: 'Label' },
    ],
  },
  impact_stats: {
    arrayKey: 'stats', itemLabel: 'Stat',
    fields: [
      { key: 'value', label: 'Value' },
      { key: 'label', label: 'Label' },
    ],
  },
  trust_logos: {
    arrayKey: 'logos', itemLabel: 'Logo',
    fields: [{ key: 'name', label: 'Brand name' }],
  },
  marquee_strip: {
    arrayKey: 'items', itemLabel: 'Item',
    fields: [
      { key: 'label', label: 'Text' },
      { key: 'image_url', label: 'Image' },
    ],
  },
  timeline: {
    arrayKey: 'items', itemLabel: 'Step',
    fields: [
      { key: 'year', label: 'Year' },
      { key: 'title', label: 'Title' },
      { key: 'desc', label: 'Description', multiline: true },
    ],
  },
  nav: {
    arrayKey: 'nav_links', itemLabel: 'Link',
    fields: [
      { key: 'label', label: 'Label' },
      { key: 'url', label: 'URL' },
    ],
  },
  footer: {
    arrayKey: 'footer_columns', itemLabel: 'Column',
    fields: [{ key: 'title', label: 'Column title' }],
  },
  payment_methods_strip: {
    arrayKey: 'methods', itemLabel: 'Payment method',
    fields: [{ key: 'method', label: 'Provider' }],
  },
  category_cards: {
    arrayKey: 'categories', itemLabel: 'Category',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'subtitle', label: 'Subtitle' },
    ],
  },
}

const BLOCK_ITEM_SCHEMA_ALIASES: Record<string, string> = {
  features_alternating: 'features',
  features_icons: 'features',
  'service.faq': 'faq',
  'service.pricing': 'pricing',
  services_list: 'services_cards',
  testimonials_grid: 'testimonials',
  team_list: 'team_grid',
  map_contact: 'map_embed',
  offer_banner: 'coupon_banner',
  promo_strip: 'coupon_banner',
  gallery_grid: 'gallery_masonry',
  image_gallery: 'gallery_masonry',
  portfolio_grid: 'gallery_masonry',
  blog_featured: 'blog_grid',
  blog_list: 'blog_grid',
}

const FIELD_LABELS: Record<string, string> = {
  headline: 'Headline',
  headline_line2: 'Headline line 2',
  title: 'Title',
  subtitle: 'Subtitle',
  description: 'Description',
  eyebrow: 'Tagline',
  text: 'Text',
  content: 'Content',
  cta_primary: 'Primary button',
  cta_secondary: 'Secondary button',
  cta_label: 'Button label',
  brand: 'Brand name',
  copyright: 'Copyright',
  caption: 'Caption',
  message: 'Message',
  accept_label: 'Accept button',
  decline_label: 'Decline button',
  placeholder: 'Placeholder',
  service_name: 'Service name',
  question: 'Question',
  answer: 'Answer',
  quote: 'Quote',
  name: 'Name',
  role: 'Role',
  company: 'Company',
  bio: 'Bio',
  value: 'Value',
  label: 'Label',
  desc: 'Description',
  year: 'Year',
  period: 'Period',
  cta: 'Button label',
}

const FIELD_ANCHOR_SELECTORS: Record<string, string[]> = {
  headline: ['h1', 'h2'],
  headline_line2: ['h1 em', 'em'],
  title: ['h1', 'h2', 'h3'],
  subtitle: ['p'],
  description: ['p'],
  eyebrow: ['span'],
  text: ['p', 'span'],
  cta_primary: ['a'],
  cta_secondary: ['a'],
  cta_label: ['a', 'button'],
  brand: ['span', 'a', 'h1'],
  copyright: ['p', 'span', 'small'],
  question: ['button', 'h3', 'summary'],
  answer: ['p', 'div'],
  quote: ['p', 'blockquote'],
  value: ['span', 'div', 'p'],
  label: ['span', 'p'],
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function resolveItemTextSchema(blockType?: string): ItemTextSchema | undefined {
  if (!blockType) return undefined
  const key = BLOCK_ITEM_SCHEMA_ALIASES[blockType] ?? blockType
  return BLOCK_ITEM_TEXT_SCHEMAS[key]
}

export function fieldLabelForKey(fieldKey: string): string {
  const nested = parseNestedFieldKey(fieldKey)
  if (nested) {
    const itemSchema = Object.values(BLOCK_ITEM_TEXT_SCHEMAS).find(s => s.arrayKey === nested.arrayKey)
    const fieldDef = itemSchema?.fields.find(f => f.key === nested.itemKey)
    if (fieldDef && itemSchema) {
      return `${itemSchema.itemLabel} ${nested.index + 1} — ${fieldDef.label}`
    }
  }
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  return FIELD_LABELS[leaf] ?? leaf.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function isEditablePropKey(key: string): boolean {
  if (NON_EDITABLE_PROP_KEYS.has(key)) return false
  if (key.startsWith('_')) return false
  if (key.endsWith('_url') || key.endsWith('_id') || key.endsWith('_key')) return false
  if (/color|image|icon|shape|gradient_/i.test(key)) return false
  // Theme / layout suffixes — e.g. footer_bg, nav_border (not user-facing copy)
  if (/_bg$|_border$|_muted$|_overlay$|_preset$|_layout$|_style$|_glass$|_elevated$|_compact$|_accent$|_fill$|_stroke$/i.test(key)) {
    return false
  }
  // Spacing, sizing, alignment — edited via design bar / section handles
  if (/^(padding|margin|gap|min_|max_|font_|item_|block_|align|variant|grayscale|aspect_)/i.test(key)) {
    return false
  }
  if (/^footer_heading$/i.test(key)) return false
  if (/^show_|^hide_|^is_|^has_|^use_/.test(key)) return false
  return true
}

/** True when a string value is a CSS color token, not prose copy. */
export function looksLikeCssColor(value: string): boolean {
  const s = value.trim()
  if (!s) return false
  return /^#[\da-f]{3,8}$/i.test(s)
    || /^rgba?\([^)]+\)$/i.test(s)
    || /^hsla?\([^)]+\)$/i.test(s)
}

export function isMultilineTextField(fieldKey: string): boolean {
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey
  if (/^(subtitle|description|text|content|caption|body|bio|answer|quote|copyright|form_hint|eyebrow)/.test(leaf)) return true
  if (leaf.includes('desc') || leaf.includes('content')) return true
  if (leaf === 'headline' || leaf === 'headline_line2' || leaf === 'title') return true
  return false
}

const TAG_FIELD_HINTS: Record<string, string[]> = {
  h1: ['headline', 'title'],
  h2: ['title', 'headline', 'subtitle'],
  h3: ['title', 'subtitle', 'question'],
  h4: ['title'],
  p: ['subtitle', 'description', 'text', 'answer', 'quote', 'desc', 'bio'],
  em: ['headline_line2'],
  strong: ['headline', 'title'],
  a: ['cta_primary', 'cta_secondary', 'cta_label', 'cta'],
  span: ['eyebrow', 'text', 'title', 'headline', 'brand', 'value', 'label'],
  button: ['question', 'cta_label', 'cta'],
  blockquote: ['quote'],
}

export interface CanvasTextEditTarget {
  fieldKey: string
  label: string
  value: string
  multiline: boolean
}

export interface SectionTextField {
  fieldKey: string
  label: string
  value: string
  multiline: boolean
}

/** Canonical order for cycling text fields in the inline edit card (matches Props panel). */
const FIELD_ORDER = [
  'eyebrow', 'headline', 'headline_line2', 'title', 'subtitle', 'description',
  'text', 'content', 'caption', 'body', 'badge_text', 'message',
  'cta_primary', 'cta_secondary', 'cta_label', 'submit_label',
  'brand', 'copyright', 'form_hint', 'placeholder', 'service_name',
  'accept_label', 'decline_label', 'tagline', 'announcement',
] as const

function readPropText(props: Record<string, unknown>, key: string): string | null {
  const v = props[key]
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return null
}

/** Top-level props that hold user-written copy (excludes numbers, booleans, objects). */
function readContentPropText(props: Record<string, unknown>, key: string): string | null {
  const v = props[key]
  if (typeof v !== 'string') return null
  return v
}

interface NestedFieldKey {
  arrayKey: string
  index: number
  itemKey: string
  linkIndex?: number
}

function parseNestedFieldKey(fieldKey: string): NestedFieldKey | null {
  const parts = fieldKey.split('.')
  if (parts.length === 3) {
    const index = parseInt(parts[1], 10)
    if (Number.isNaN(index)) return null
    return { arrayKey: parts[0], index, itemKey: parts[2] }
  }
  if (parts.length === 4 && parts[2] === 'links') {
    const index = parseInt(parts[1], 10)
    const linkIndex = parseInt(parts[3], 10)
    if (Number.isNaN(index) || Number.isNaN(linkIndex)) return null
    return { arrayKey: parts[0], index, itemKey: 'links', linkIndex }
  }
  return null
}

function readNestedLinkLabel(link: unknown): string {
  if (typeof link === 'string') return link
  if (link && typeof link === 'object') {
    return readPropText(link as Record<string, unknown>, 'label') ?? ''
  }
  return ''
}

export function readFieldValue(props: Record<string, unknown>, fieldKey: string): string {
  const nested = parseNestedFieldKey(fieldKey)
  if (nested) {
    const arr = props[nested.arrayKey]
    if (!Array.isArray(arr)) return ''
    const item = arr[nested.index]
    if (!item || typeof item !== 'object') return ''
    if (nested.itemKey === 'links' && nested.linkIndex != null) {
      const links = (item as Record<string, unknown>).links
      if (!Array.isArray(links)) return ''
      return readNestedLinkLabel(links[nested.linkIndex])
    }
    return readPropText(item as Record<string, unknown>, nested.itemKey) ?? ''
  }
  return readPropText(props, fieldKey) ?? ''
}

/** Build a props patch for top-level or nested array text fields (e.g. `features.0.title`). */
export function buildPropPatchFromFieldKey(
  fieldKey: string,
  value: string,
  currentProps: Record<string, unknown>,
): Record<string, unknown> {
  const nested = parseNestedFieldKey(fieldKey)
  if (!nested) return { [fieldKey]: value }

  const arr = Array.isArray(currentProps[nested.arrayKey])
    ? [...(currentProps[nested.arrayKey] as unknown[])]
    : []
  while (arr.length <= nested.index) arr.push({})
  const prev = arr[nested.index]
  const base = prev && typeof prev === 'object' ? { ...(prev as object) } : {}
  if (nested.itemKey === 'links' && nested.linkIndex != null) {
    const links = Array.isArray((base as Record<string, unknown>).links)
      ? [...((base as Record<string, unknown>).links as unknown[])]
      : []
    while (links.length <= nested.linkIndex) links.push('')
    const prevLink = links[nested.linkIndex]
    links[nested.linkIndex] = prevLink && typeof prevLink === 'object'
      ? { ...(prevLink as object), label: value }
      : value
    arr[nested.index] = { ...base, links }
    return { [nested.arrayKey]: arr }
  }
  arr[nested.index] = { ...base, [nested.itemKey]: value }
  return { [nested.arrayKey]: arr }
}

/** All user-editable string props on a block, in sensible display order. */
export function listSectionTextFields(
  props: Record<string, unknown>,
  blockType?: string,
): SectionTextField[] {
  const topLevelKeys = new Set<string>()
  const schemaKeys = new Set<string>()

  const schema = blockType ? BLOCK_TEXT_FIELDS[blockType] : undefined
  if (schema) {
    schema.forEach(k => {
      topLevelKeys.add(k)
      schemaKeys.add(k)
    })
  }

  COMMON_PROP_KEYS.forEach(k => {
    if (!(k in props) || !isEditablePropKey(k)) return
    if (typeof props[k] === 'number' || typeof props[k] === 'boolean') return
    topLevelKeys.add(k)
  })

  // Only pick up extra string props that look like copy — never layout numbers/colors.
  Object.keys(props).forEach(k => {
    if (!isEditablePropKey(k) || schemaKeys.has(k)) return
    if ((COMMON_PROP_KEYS as readonly string[]).includes(k as typeof COMMON_PROP_KEYS[number])) return
    const text = readContentPropText(props, k)
    if (text === null || !text.trim()) return
    if (looksLikeCssColor(text)) return
    if (/^\d+(\.\d+)?$/.test(text.trim())) return
    topLevelKeys.add(k)
  })

  const candidateKeys = [...topLevelKeys]
  const ordered = FIELD_ORDER.filter(k => candidateKeys.includes(k))
  const rest = candidateKeys.filter(k => !(FIELD_ORDER as readonly string[]).includes(k)).sort()
  const keys = [...ordered, ...rest]

  const fields: SectionTextField[] = keys.map(fieldKey => ({
    fieldKey,
    label: fieldLabelForKey(fieldKey),
    value: readFieldValue(props, fieldKey),
    multiline: isMultilineTextField(fieldKey),
  }))

  const itemSchema = resolveItemTextSchema(blockType)
  if (itemSchema) {
    const arr = props[itemSchema.arrayKey]
    if (Array.isArray(arr)) {
      arr.forEach((item, index) => {
        if (!item || typeof item !== 'object') return
        const rec = item as Record<string, unknown>
        for (const f of itemSchema.fields) {
          const fieldKey = `${itemSchema.arrayKey}.${index}.${f.key}`
          fields.push({
            fieldKey,
            label: `${itemSchema.itemLabel} ${index + 1} — ${f.label}`,
            value: readPropText(rec, f.key) ?? (typeof rec[f.key] === 'number' ? String(rec[f.key]) : ''),
            multiline: f.multiline ?? isMultilineTextField(f.key),
          })
        }
      })
    }
  }

  if (blockType === 'footer') {
    const cols = props.footer_columns
    if (Array.isArray(cols)) {
      cols.forEach((col, colIdx) => {
        if (!col || typeof col !== 'object') return
        const links = (col as Record<string, unknown>).links
        if (!Array.isArray(links)) return
        links.forEach((_, linkIdx) => {
          const fieldKey = `footer_columns.${colIdx}.links.${linkIdx}`
          fields.push({
            fieldKey,
            label: `Column ${colIdx + 1} — Link ${linkIdx + 1}`,
            value: readFieldValue(props, fieldKey),
            multiline: false,
          })
        })
      })
    }
  }

  return fields
}

export function indexOfSectionTextField(fields: SectionTextField[], fieldKey: string): number {
  const idx = fields.findIndex(f => f.fieldKey === fieldKey)
  return idx >= 0 ? idx : 0
}

/** Re-find a stable anchor inside a block for positioning the edit card (after scroll). */
export function findBlockFieldAnchor(
  blockRoot: HTMLElement,
  fieldKey: string,
  value?: string,
): HTMLElement | null {
  const want = value ? normalizeText(value) : ''
  const leaf = fieldKey.includes('.') ? fieldKey.split('.').pop()! : fieldKey

  if (fieldKey.startsWith('cta_') && want) {
    for (const a of blockRoot.querySelectorAll('a')) {
      if (normalizeText(a.textContent || '') === want) return a as HTMLElement
    }
  }
  if (want) {
    for (const sel of ['h1', 'h2', 'h3', 'p', 'span', 'em', 'a', 'button', 'blockquote']) {
      for (const el of blockRoot.querySelectorAll(sel)) {
        if (normalizeText(el.textContent || '') === want) return el as HTMLElement
      }
    }
  }
  const selectors = FIELD_ANCHOR_SELECTORS[leaf] ?? ['h1', 'h2', 'h3', 'p', 'a', 'span']
  for (const sel of selectors) {
    const el = blockRoot.querySelector(sel) as HTMLElement | null
    if (el?.innerText?.trim()) return el
  }
  return blockRoot.querySelector('h1, h2, h3, p, a') as HTMLElement | null
}

function pickSemanticAnchor(chain: HTMLElement[]): HTMLElement | null {
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'em', 'span', 'blockquote']) {
    const hit = chain.find(n => n.tagName.toLowerCase() === tag)
    if (hit && normalizeText(hit.innerText || '').length > 0) return hit
  }
  return chain.find(n => normalizeText(n.innerText || '').length > 0) ?? null
}

function scoreFieldMatch(text: string, propValue: string): number {
  const t = normalizeText(text)
  const p = normalizeText(propValue)
  if (!t || !p) return 0
  if (t === p) return 200 + p.length
  if (p.length >= 3 && (t.includes(p) || p.includes(t))) return 80 + Math.min(p.length, t.length)
  return 0
}

/** Map a canvas double-click to a block prop field (hero headline, CTA label, etc.). */
export function resolveCanvasTextEditTarget(
  clickTarget: EventTarget | null,
  block: WebsiteBlock,
): CanvasTextEditTarget | null {
  if (!(clickTarget instanceof HTMLElement)) return null

  const blockRoot = clickTarget.closest('[data-block-id]')
  if (!blockRoot || blockRoot.getAttribute('data-block-id') !== block.id) return null
  if (clickTarget.closest('input, textarea, select, [data-kiterp-modal], [data-builder-inline-editor]')) return null

  const props = block.props as Record<string, unknown>
  const allFields = listSectionTextFields(props, block.block_type as string)
  const chain: HTMLElement[] = []
  let el: HTMLElement | null = clickTarget
  while (el && el !== blockRoot && chain.length < 12) {
    chain.push(el)
    el = el.parentElement
  }

  for (const node of chain) {
    const text = normalizeText(node.innerText || '')
    if (text.length < 1) continue

    const matches: { key: string; score: number }[] = []
    for (const field of allFields) {
      if (!field.value) continue
      const score = scoreFieldMatch(text, field.value)
      if (score > 0) matches.push({ key: field.fieldKey, score })
    }

    if (matches.length) {
      matches.sort((a, b) => b.score - a.score)
      const fieldKey = matches[0].key
      const hit = allFields.find(f => f.fieldKey === fieldKey)!
      return {
        fieldKey,
        label: hit.label,
        value: hit.value || text,
        multiline: hit.multiline,
      }
    }
  }

  const semantic = pickSemanticAnchor(chain)

  if (semantic) {
    const tag = semantic.tagName.toLowerCase()
    const hints = TAG_FIELD_HINTS[tag]
    if (hints) {
      for (const hint of hints) {
        const hit = allFields.find(f => {
          const leaf = f.fieldKey.includes('.') ? f.fieldKey.split('.').pop()! : f.fieldKey
          return leaf === hint || f.fieldKey === hint
        })
        if (hit) {
          return {
            fieldKey: hit.fieldKey,
            label: hit.label,
            value: hit.value || normalizeText(semantic.innerText || ''),
            multiline: hit.multiline,
          }
        }
      }
    }
  }

  const primary = allFields.find(f => ['headline', 'title', 'text'].includes(f.fieldKey))
  if (primary) {
    return {
      fieldKey: primary.fieldKey,
      label: primary.label,
      value: primary.value,
      multiline: primary.multiline,
    }
  }

  if (allFields.length > 0) {
    const first = allFields[0]
    return {
      fieldKey: first.fieldKey,
      label: first.label,
      value: first.value,
      multiline: first.multiline,
    }
  }

  return null
}

export function computeEditCardPosition(
  anchorRect: DOMRect | null,
  click: { x: number; y: number },
  cardWidth = 340,
  cardHeight = 160,
): { top: number; left: number } {
  const margin = 12
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = click.x - cardWidth / 2
  let top = (anchorRect?.bottom ?? click.y) + 10

  if (top + cardHeight > vh - margin) {
    top = (anchorRect?.top ?? click.y) - cardHeight - 10
  }
  if (top < margin) top = margin

  left = Math.max(margin, Math.min(left, vw - cardWidth - margin))
  top = Math.max(margin, Math.min(top, vh - cardHeight - margin))

  return { top, left }
}

/** Insert a line break in the active or selected on-canvas text field. */
export function insertActiveCanvasLineBreak(
  blockId?: string | null,
  fieldKey?: string | null,
): boolean {
  const editingEl = document.querySelector('[data-builder-inline-edit-target="true"]') as HTMLElement | null
  if (editingEl) {
    editingEl.dispatchEvent(new CustomEvent('builder-insert-line-break', { bubbles: false }))
    return true
  }

  if (blockId && fieldKey) {
    const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
    const fieldEl = blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
    if (fieldEl) {
      fieldEl.dispatchEvent(new CustomEvent('builder-insert-line-break', { bubbles: false }))
      return true
    }
  }

  const activeEl = document.querySelector('[data-builder-text-active="true"]') as HTMLElement | null
  if (activeEl) {
    activeEl.dispatchEvent(new CustomEvent('builder-insert-line-break', { bubbles: false }))
    return true
  }

  return false
}

/** Computed typography from the rendered canvas field (theme classes, tag defaults, etc.). */
export function getCanvasFieldComputedFormatPaintStyle(
  blockId: string,
  fieldKey: string,
): FormatPaintStyle {
  const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
  const fieldEl = blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
  if (!fieldEl) return {}
  return extractFormatPaintStyleFromElement(fieldEl)
}

/** Live computed font size for a canvas text field (respects theme classes when px override is Auto). */
export function getCanvasFieldComputedFontSizePx(
  blockId: string,
  fieldKey: string,
): number | null {
  const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
  const fieldEl = blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
  if (!fieldEl) return null
  const px = parseFloat(window.getComputedStyle(fieldEl).fontSize)
  if (!Number.isFinite(px) || px <= 0) return null
  return Math.round(px)
}

function cssColorToHex(color: string): string {
  const trimmed = color.trim()
  if (trimmed.startsWith('#')) {
    return trimmed.length >= 7 ? trimmed.slice(0, 7) : trimmed
  }
  const m = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!m) return trimmed
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`
}

/** Live CTA shell fill / border from the rendered button (theme defaults until overridden). */
export function getCanvasCtaShellComputedStyle(
  blockId: string,
  fieldKey: string,
): { field_bg_color?: string; field_border_color?: string } {
  const fieldEl = document.querySelector(
    `[data-block-id="${CSS.escape(blockId)}"] [data-text-key="${CSS.escape(fieldKey)}"]`,
  ) as HTMLElement | null
  const shell = fieldEl?.closest('[data-builder-cta-shell]') as HTMLElement | null
  if (!shell) return {}
  const cs = window.getComputedStyle(shell)
  const out: { field_bg_color?: string; field_border_color?: string } = {}
  const bg = cs.backgroundColor
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    out.field_bg_color = cssColorToHex(bg)
  }
  const bw = parseFloat(cs.borderTopWidth)
  const bc = cs.borderTopColor
  if (Number.isFinite(bw) && bw > 0 && bc && bc !== 'rgba(0, 0, 0, 0)') {
    out.field_border_color = cssColorToHex(bc)
  }
  return out
}

function resolveToolbarSelectionRange(blockId: string, fieldKey: string): Range | null {
  const fieldEl = document.querySelector(
    `[data-block-id="${CSS.escape(blockId)}"] [data-text-key="${CSS.escape(fieldKey)}"]`,
  ) as HTMLElement | null
  if (!fieldEl) return null

  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    if (fieldEl.contains(range.commonAncestorContainer) && !range.collapsed) {
      return range
    }
  }

  if (hasActiveInlineTextSelection(fieldKey)) {
    const saved = getSavedInlineTextSelection()?.range
    if (saved && !saved.collapsed) return saved
  }

  return null
}

function fontFamilyAtRangeStart(range: Range): string | null {
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  if (!(node instanceof HTMLElement)) return null
  const cs = window.getComputedStyle(node)
  return matchBuilderFontFamily(builderFontFromComputedStyle(cs.fontFamily, cs.fontStyle))
}

/** Live typography readout for the design bar (selection → stored styles → computed canvas). */
export function resolveToolbarTypographyDisplay(
  blockId: string,
  blockProps: Record<string, unknown>,
  fieldKey: string | null | undefined,
): {
  font_family: string | null
  font_size_px: number | null
  text_color_override: string | null
  field_bg_color: string | null
  field_border_color: string | null
  text_align: string | null
  vertical_align: string | null
  text_wrap: boolean | null
  line_height_ratio: number | null
  font_weight: string | null
  font_style: string | null
} {
  if (!fieldKey) {
    const resolved = resolveFormatPaintStyle({ blockProps, fieldKey: null })
    return {
      font_family: matchBuilderFontFamily(
        typeof resolved.font_family === 'string' ? resolved.font_family : null,
      ),
      font_size_px:
        typeof resolved.font_size_px === 'number' && resolved.font_size_px > 0
          ? Math.round(resolved.font_size_px)
          : null,
      text_color_override:
        typeof resolved.text_color_override === 'string' ? resolved.text_color_override : null,
      field_bg_color: null,
      field_border_color: null,
      text_align: typeof resolved.text_align === 'string' ? resolved.text_align : null,
      vertical_align: typeof resolved.vertical_align === 'string' ? resolved.vertical_align : null,
      text_wrap: typeof resolved.text_wrap === 'boolean' ? resolved.text_wrap : null,
      line_height_ratio:
        typeof resolved.line_height_ratio === 'number' ? resolved.line_height_ratio : null,
      font_weight: typeof resolved.font_weight === 'string' ? resolved.font_weight : null,
      font_style: typeof resolved.font_style === 'string' ? resolved.font_style : null,
    }
  }

  if (fieldKey === CONTENT_GROUP_FIELD_KEY) {
    return {
      font_family: null,
      font_size_px: null,
      text_color_override: null,
      field_bg_color: null,
      field_border_color: null,
      text_align: null,
      vertical_align: null,
      text_wrap: null,
      line_height_ratio: null,
      font_weight: null,
      font_style: null,
    }
  }

  const fieldEl = document.querySelector(
    `[data-block-id="${CSS.escape(blockId)}"] [data-text-key="${CSS.escape(fieldKey)}"]`,
  ) as HTMLElement | null
  const selectionRange = resolveToolbarSelectionRange(blockId, fieldKey)
  const computed = getCanvasFieldComputedFormatPaintStyle(blockId, fieldKey)

  const resolved = resolveFormatPaintStyle({
    blockProps,
    fieldKey,
    selectionRange,
    computed,
  })

  let font_size_px =
    typeof resolved.font_size_px === 'number' && resolved.font_size_px > 0
      ? Math.round(resolved.font_size_px)
      : null

  if (selectionRange) {
    font_size_px = getSelectionFontSizePx(selectionRange)
  } else if (fieldEl) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const caret = sel.getRangeAt(0)
      if (fieldEl.contains(caret.commonAncestorContainer)) {
        if (font_size_px == null) font_size_px = getSelectionFontSizePx(caret)
      }
    }
  }

  if (font_size_px == null) {
    font_size_px = getCanvasFieldComputedFontSizePx(blockId, fieldKey)
  }

  let font_family = matchBuilderFontFamily(
    typeof resolved.font_family === 'string' ? resolved.font_family : null,
  )

  if (!font_family && selectionRange) {
    font_family = fontFamilyAtRangeStart(selectionRange)
  }

  if (!font_family && fieldEl) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const caret = sel.getRangeAt(0)
      if (fieldEl.contains(caret.commonAncestorContainer) && caret.collapsed) {
        const fromCaret = extractFormatPaintStyleFromRange(caret)
        font_family = matchBuilderFontFamily(
          typeof fromCaret.font_family === 'string' ? fromCaret.font_family : null,
        )
        if (!font_family) font_family = fontFamilyAtRangeStart(caret)
      }
    }
  }

  if (!font_family) {
    font_family = matchBuilderFontFamily(
      typeof computed.font_family === 'string' ? computed.font_family : null,
    )
  }

  if (!font_family) {
    const lastSpan = getLastInlineStyledSpan()
    if (lastSpan?.key === fieldKey && lastSpan.span.isConnected) {
      const cs = window.getComputedStyle(lastSpan.span)
      font_family = matchBuilderFontFamily(builderFontFromComputedStyle(cs.fontFamily, cs.fontStyle))
    }
  }

  const text_color_override =
    typeof resolved.text_color_override === 'string'
      ? cssColorToHex(resolved.text_color_override)
      : null

  let field_bg_color: string | null = null
  let field_border_color: string | null = null
  if (isInlinePositionField(fieldKey)) {
    const fs = fieldStyleEntry(blockProps, fieldKey)
    field_bg_color = typeof fs.field_bg_color === 'string' ? fs.field_bg_color : null
    field_border_color = typeof fs.field_border_color === 'string' ? fs.field_border_color : null
    const shellComputed = getCanvasCtaShellComputedStyle(blockId, fieldKey)
    if (!field_bg_color && shellComputed.field_bg_color) field_bg_color = shellComputed.field_bg_color
    if (!field_border_color && shellComputed.field_border_color) {
      field_border_color = shellComputed.field_border_color
    }
  }

  const text_align = typeof resolved.text_align === 'string' ? resolved.text_align : null
  const vertical_align = typeof resolved.vertical_align === 'string' ? resolved.vertical_align : null
  const text_wrap = typeof resolved.text_wrap === 'boolean' ? resolved.text_wrap : null
  const line_height_ratio =
    typeof resolved.line_height_ratio === 'number' ? resolved.line_height_ratio : null
  const font_weight = typeof resolved.font_weight === 'string' ? resolved.font_weight : null
  const font_style = typeof resolved.font_style === 'string' ? resolved.font_style : null

  return {
    font_family,
    font_size_px,
    text_color_override,
    field_bg_color,
    field_border_color,
    text_align,
    vertical_align,
    text_wrap,
    line_height_ratio,
    font_weight,
    font_style,
  }
}

/** Font family shown in the design-bar picker (selection, caret, field styles, or computed). */
export function resolveToolbarFontFamily(
  blockId: string,
  blockProps: Record<string, unknown>,
  fieldKey: string | null | undefined,
): string | null {
  return resolveToolbarTypographyDisplay(blockId, blockProps, fieldKey).font_family
}

/** Font size shown in the design-bar picker (selection, caret, field styles, or computed). */
export function resolveToolbarFontSizePx(
  blockId: string,
  blockProps: Record<string, unknown>,
  fieldKey: string | null | undefined,
): number | null {
  return resolveToolbarTypographyDisplay(blockId, blockProps, fieldKey).font_size_px
}

/** Cut, copy, or paste in the active on-canvas text field. */
export function runCanvasTextClipboardAction(
  action: 'cut' | 'copy' | 'paste',
  blockId?: string | null,
  fieldKey?: string | null,
): boolean {
  const editingEl = document.querySelector('[data-builder-inline-edit-target="true"]') as HTMLElement | null
  if (editingEl?.getAttribute('data-text-key')) {
    editingEl.dispatchEvent(new CustomEvent('builder-canvas-clipboard', { bubbles: false, detail: { action } }))
    return true
  }

  if (blockId && fieldKey) {
    const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
    const fieldEl = blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
    if (fieldEl) {
      fieldEl.dispatchEvent(new CustomEvent('builder-canvas-clipboard', { bubbles: false, detail: { action } }))
      return true
    }
  }

  const activeEl = document.querySelector('[data-builder-text-active="true"]') as HTMLElement | null
  if (activeEl) {
    activeEl.dispatchEvent(new CustomEvent('builder-canvas-clipboard', { bubbles: false, detail: { action } }))
    return true
  }

  return false
}
