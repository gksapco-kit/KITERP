import type { WebsiteBlock } from '@/types/websites'
import { matchBuilderFontFamily } from '@storefront/lib/builderFontFamilies'
import {
  getLastInlineStyledSpan,
  getSavedInlineTextSelection,
  hasActiveInlineTextSelection,
} from '@storefront/lib/builderInlineTextSelection'
import { CONTENT_GROUP_FIELD_KEY } from '@storefront/lib/fieldTextStyles'
import { extractFormatPaintStyleFromRange, resolveFormatPaintStyle } from './builderFormatPainter'

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
])

/** Text fields per block type — mirrors Props panel `commonFields` (content only, not URLs). */
const BLOCK_TEXT_FIELDS: Record<string, readonly string[]> = {
  hero: ['eyebrow', 'headline', 'headline_line2', 'subtitle', 'cta_primary', 'cta_secondary'],
  hero_split: ['eyebrow', 'headline', 'headline_line2', 'subtitle', 'cta_primary', 'cta_secondary'],
  hero_minimal: ['headline', 'subtitle', 'cta_primary', 'cta_secondary'],
  cta: ['headline', 'subtitle', 'cta_label', 'text'],
  announcement_bar: ['text'],
  marquee_strip: ['text'],
  nav: ['brand', 'cta_label'],
  footer: ['copyright', 'brand'],
  newsletter: ['title', 'subtitle', 'cta_label'],
  about_split: ['title', 'subtitle', 'description'],
  features: ['title', 'subtitle'],
  features_alternating: ['title', 'subtitle'],
  stats: ['title'],
  counters: ['title'],
  impact_stats: ['title'],
  testimonials: ['title'],
  team_grid: ['title'],
  pricing: ['title'],
  faq: ['title'],
  contact_form: ['title'],
  portfolio_grid: ['title'],
  gallery_masonry: ['title'],
  blog_grid: ['title'],
  video_embed: ['title'],
  map_embed: ['title'],
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
  coupon_banner: ['title'],
  cart_drawer: ['title'],
  cookie_consent: ['message', 'accept_label', 'decline_label'],
  search_bar: ['placeholder'],
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
    ],
  },
  faq: {
    arrayKey: 'faqs', itemLabel: 'FAQ',
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
  timeline: {
    arrayKey: 'items', itemLabel: 'Step',
    fields: [
      { key: 'year', label: 'Year' },
      { key: 'title', label: 'Title' },
      { key: 'desc', label: 'Description', multiline: true },
    ],
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
}

const FIELD_LABELS: Record<string, string> = {
  headline: 'Headline',
  headline_line2: 'Headline line 2',
  title: 'Title',
  subtitle: 'Subtitle',
  description: 'Description',
  eyebrow: 'Eyebrow / tagline',
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
  if (key.endsWith('_url') || key.endsWith('_id') || key.endsWith('_key')) return false
  if (/color|image|icon|shape|gradient_/i.test(key)) return false
  return true
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
  'accept_label', 'decline_label',
] as const

function readPropText(props: Record<string, unknown>, key: string): string | null {
  const v = props[key]
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return null
}

interface NestedFieldKey {
  arrayKey: string
  index: number
  itemKey: string
}

function parseNestedFieldKey(fieldKey: string): NestedFieldKey | null {
  const parts = fieldKey.split('.')
  if (parts.length !== 3) return null
  const index = parseInt(parts[1], 10)
  if (Number.isNaN(index)) return null
  return { arrayKey: parts[0], index, itemKey: parts[2] }
}

export function readFieldValue(props: Record<string, unknown>, fieldKey: string): string {
  const nested = parseNestedFieldKey(fieldKey)
  if (nested) {
    const arr = props[nested.arrayKey]
    if (!Array.isArray(arr)) return ''
    const item = arr[nested.index]
    if (!item || typeof item !== 'object') return ''
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
  arr[nested.index] = { ...base, [nested.itemKey]: value }
  return { [nested.arrayKey]: arr }
}

/** All user-editable string props on a block, in sensible display order. */
export function listSectionTextFields(
  props: Record<string, unknown>,
  blockType?: string,
): SectionTextField[] {
  const topLevelKeys = new Set<string>()

  const schema = blockType ? BLOCK_TEXT_FIELDS[blockType] : undefined
  if (schema) {
    schema.forEach(k => topLevelKeys.add(k))
  }

  COMMON_PROP_KEYS.forEach(k => {
    if (k in props) topLevelKeys.add(k)
  })

  Object.keys(props).forEach(k => {
    if (isEditablePropKey(k) && readPropText(props, k) !== null) {
      topLevelKeys.add(k)
    }
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

import type { FormatPaintStyle } from './builderFormatPainter'

/** Computed typography from the rendered canvas field (theme classes, tag defaults, etc.). */
export function getCanvasFieldComputedFormatPaintStyle(
  blockId: string,
  fieldKey: string,
): FormatPaintStyle {
  const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
  const fieldEl = blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
  if (!fieldEl) return {}
  const cs = window.getComputedStyle(fieldEl)
  const out: Record<string, unknown> = {}
  const px = parseFloat(cs.fontSize)
  if (Number.isFinite(px) && px > 0) out.font_size_px = Math.round(px)
  const color = cs.color
  if (color && color !== 'rgba(0, 0, 0, 0)') out.text_color_override = color
  const tt = cs.textTransform
  if (tt && tt !== 'none') out.text_transform = tt
  const ff = cs.fontFamily
  if (ff) {
    const primary = ff.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')
    if (primary) out.font_family = primary
  }
  const ta = cs.textAlign
  if (ta === 'left' || ta === 'center' || ta === 'right' || ta === 'start' || ta === 'end') {
    out.text_align = ta === 'start' ? 'left' : ta === 'end' ? 'right' : ta
  }
  const lh = parseFloat(cs.lineHeight)
  const fs = parseFloat(cs.fontSize)
  if (Number.isFinite(lh) && Number.isFinite(fs) && fs > 0 && lh > 0) {
    const ratio = Math.round((lh / fs) * 100) / 100
    if (ratio > 0 && Math.abs(ratio - 1) > 0.05) out.line_height_ratio = ratio
  }
  if (cs.whiteSpace === 'nowrap') out.text_wrap = false
  else if (cs.whiteSpace === 'pre-wrap') out.text_wrap = true
  return out
}

/** Font family shown in the design-bar picker (selection, caret, field styles, or computed). */
export function resolveToolbarFontFamily(
  blockId: string,
  blockProps: Record<string, unknown>,
  fieldKey: string | null | undefined,
): string | null {
  if (!fieldKey || fieldKey === CONTENT_GROUP_FIELD_KEY) {
    const stored = resolveFormatPaintStyle({ blockProps, fieldKey: null }).font_family
    return matchBuilderFontFamily(typeof stored === 'string' ? stored : null)
  }

  const fieldEl = document.querySelector(
    `[data-block-id="${CSS.escape(blockId)}"] [data-text-key="${CSS.escape(fieldKey)}"]`,
  ) as HTMLElement | null

  let selectionRange: Range | null = null
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && fieldEl) {
    const range = sel.getRangeAt(0)
    if (fieldEl.contains(range.commonAncestorContainer)) {
      if (!range.collapsed) {
        selectionRange = range
      } else {
        const fromCaret = extractFormatPaintStyleFromRange(range)
        const caretFont = matchBuilderFontFamily(
          typeof fromCaret.font_family === 'string' ? fromCaret.font_family : null,
        )
        if (caretFont) return caretFont
      }
    }
  }

  if (!selectionRange && hasActiveInlineTextSelection(fieldKey)) {
    selectionRange = getSavedInlineTextSelection()?.range ?? null
  }

  const resolved = resolveFormatPaintStyle({
    blockProps,
    fieldKey,
    selectionRange,
    computed: getCanvasFieldComputedFormatPaintStyle(blockId, fieldKey),
  })

  const resolvedFont = matchBuilderFontFamily(
    typeof resolved.font_family === 'string' ? resolved.font_family : null,
  )
  if (resolvedFont) return resolvedFont

  const lastSpan = getLastInlineStyledSpan()
  if (lastSpan?.key === fieldKey && lastSpan.span.isConnected) {
    return matchBuilderFontFamily(window.getComputedStyle(lastSpan.span).fontFamily)
  }

  return null
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
