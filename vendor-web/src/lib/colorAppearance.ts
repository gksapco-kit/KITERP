/** Independent display parts for color choices on the customer business front. */
import { suggestColourName } from '@/lib/productVariantPresets'

export type ColorShowPart = 'color' | 'name' | 'hex'

export type ColorShowParts = {
  color: boolean
  name: boolean
  hex: boolean
}

export const COLOR_SHOW_PART_OPTIONS: { value: ColorShowPart; label: string }[] = [
  { value: 'color', label: 'Color' },
  { value: 'name', label: 'Name' },
  { value: 'hex', label: 'Hex' },
]

const RULE_KEY = 'color_show_as'
const DEFAULT_PARTS: ColorShowParts = { color: true, name: false, hex: false }

/** All non-empty mixes of Color / Name / Hex (7). */
export const COLOR_SHOW_MIXES: { parts: ColorShowParts; label: string }[] = [
  { parts: { color: true, name: false, hex: false }, label: 'Color' },
  { parts: { color: false, name: true, hex: false }, label: 'Name' },
  { parts: { color: false, name: false, hex: true }, label: 'Hex' },
  { parts: { color: true, name: true, hex: false }, label: 'Color + Name' },
  { parts: { color: true, name: false, hex: true }, label: 'Color + Hex' },
  { parts: { color: false, name: true, hex: true }, label: 'Name + Hex' },
  { parts: { color: true, name: true, hex: true }, label: 'Color + Name + Hex' },
]

function partsEqual(a: ColorShowParts, b: ColorShowParts): boolean {
  return a.color === b.color && a.name === b.name && a.hex === b.hex
}

function normalizeParts(parts: ColorShowParts): ColorShowParts {
  if (!parts.color && !parts.name && !parts.hex) return { ...DEFAULT_PARTS }
  return parts
}

function parseLegacy(value: unknown): ColorShowParts | null {
  if (typeof value !== 'string') return null
  switch (value) {
    case 'color':
      return { color: true, name: false, hex: false }
    case 'name':
      return { color: false, name: true, hex: false }
    case 'hex':
      return { color: false, name: false, hex: true }
    case 'name_hex':
      return { color: false, name: true, hex: true }
    case 'color_name':
      return { color: true, name: true, hex: false }
    case 'color_hex':
      return { color: true, name: false, hex: true }
    case 'color_name_hex':
      return { color: true, name: true, hex: true }
    default:
      return null
  }
}

function parsePartsObject(value: unknown): ColorShowParts | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  if (!('color' in o) && !('name' in o) && !('hex' in o)) return null
  return normalizeParts({
    color: Boolean(o.color),
    name: Boolean(o.name),
    hex: Boolean(o.hex),
  })
}

function parsePartsArray(value: unknown): ColorShowParts | null {
  if (!Array.isArray(value)) return null
  const set = new Set(value.filter((v): v is string => typeof v === 'string'))
  return normalizeParts({
    color: set.has('color'),
    name: set.has('name'),
    hex: set.has('hex'),
  })
}

export function encodeColorShowParts(parts: ColorShowParts): string {
  const n = normalizeParts(parts)
  const keys: ColorShowPart[] = []
  if (n.color) keys.push('color')
  if (n.name) keys.push('name')
  if (n.hex) keys.push('hex')
  return keys.join('_') || 'color'
}

export function getColorShowParts(attr: {
  validation_rule?: Record<string, unknown> | null
}): ColorShowParts {
  const v = attr.validation_rule?.[RULE_KEY]
  return (
    parsePartsObject(v)
    ?? parsePartsArray(v)
    ?? parseLegacy(v)
    ?? { ...DEFAULT_PARTS }
  )
}

export function withColorShowParts(
  existing: Record<string, unknown> | null | undefined,
  parts: ColorShowParts,
): Record<string, unknown> {
  return { ...(existing ?? {}), [RULE_KEY]: encodeColorShowParts(normalizeParts(parts)) }
}

/** Toggle one part; keeps at least one selected. */
export function toggleColorShowPart(current: ColorShowParts, part: ColorShowPart): ColorShowParts {
  const next = { ...current, [part]: !current[part] }
  return normalizeParts(next)
}

export function isColorShowMixActive(current: ColorShowParts, mix: ColorShowParts): boolean {
  return partsEqual(normalizeParts(current), normalizeParts(mix))
}

function extractHex(label: string): string | null {
  const m = label.trim().match(/#[0-9A-Fa-f]{6}/)
  return m ? m[0].toUpperCase() : null
}

function extractName(label: string, hex: string): string {
  const trimmed = label.trim()
  const isHex = (s: string) => /^#?[0-9A-Fa-f]{6}$/.test(s.trim())
  if (!trimmed) return ''
  if (isHex(trimmed)) return ''
  if (!hex) return trimmed
  const without = trimmed
    .replace(new RegExp(hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/#[0-9A-Fa-f]{6}/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!without || isHex(without)) return ''
  return without
}

export function resolveColorParts(
  opt: { display_name: string; color_code?: string | null },
): { hex: string; name: string } {
  const hex = (opt.color_code || extractHex(opt.display_name) || '').toUpperCase()
  const name = extractName(opt.display_name, hex)
  // If saved label was hex-only / duplicated hex, invent a readable name for the UI
  const fallback = name || (hex ? suggestColourName(hex) : opt.display_name)
  return { hex: hex || '#d1d5db', name: fallback || opt.display_name }
}

/** Text beside the swatch (empty when only Color is on). */
export function formatColorChoiceLabel(
  parts: ColorShowParts,
  opt: { display_name: string; color_code?: string | null },
): string {
  const { hex, name } = resolveColorParts(opt)
  const bits: string[] = []
  if (parts.name) bits.push(name)
  if (parts.hex) bits.push(hex)
  return bits.join(' ')
}
