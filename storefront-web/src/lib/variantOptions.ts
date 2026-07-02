import type { ProductVariant } from '@/types'

const GENERIC_VARIANT_NAMES = /^(variant|default|plan \d+)$/i

export function getVariantAttributes(variant: ProductVariant): Record<string, string> {
  const raw = variant.attributes ?? {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && String(value).trim()) out[key] = String(value).trim()
  }
  return out
}

export function getVariantOptionDimensions(variants: ProductVariant[]): string[] {
  const keys = new Set<string>()
  for (const variant of variants) {
    for (const key of Object.keys(getVariantAttributes(variant))) keys.add(key)
  }
  return [...keys].sort((a, b) => {
    const rank = (name: string) => {
      const lower = name.toLowerCase()
      if (lower.includes('size')) return 0
      if (lower.includes('color') || lower.includes('colour')) return 1
      return 2
    }
    const diff = rank(a) - rank(b)
    return diff !== 0 ? diff : a.localeCompare(b)
  })
}

export function getValuesForDimension(variants: ProductVariant[], dimension: string): string[] {
  const dimLower = dimension.toLowerCase()
  const values = new Set<string>()
  for (const variant of variants) {
    const attrs = getVariantAttributes(variant)
    const key = Object.keys(attrs).find((k) => k.toLowerCase() === dimLower)
    if (key) values.add(attrs[key])
  }
  return [...values]
}

export function findVariantBySelections(
  variants: ProductVariant[],
  selections: Record<string, string>,
): ProductVariant | undefined {
  const entries = Object.entries(selections).filter(([, value]) => value)
  if (entries.length === 0) return undefined
  return variants.find((variant) => {
    const attrs = getVariantAttributes(variant)
    return entries.every(([dim, val]) => {
      const key = Object.keys(attrs).find((k) => k.toLowerCase() === dim.toLowerCase())
      return key != null && attrs[key] === val
    })
  })
}

export function findVariantForDimensionValue(
  variants: ProductVariant[],
  dimension: string,
  value: string,
): ProductVariant | undefined {
  const dimLower = dimension.toLowerCase()
  return variants.find((variant) => {
    const attrs = getVariantAttributes(variant)
    const key = Object.keys(attrs).find((k) => k.toLowerCase() === dimLower)
    return key != null && attrs[key] === value
  })
}

export function variantDisplayLabel(variant: ProductVariant): string {
  const attrs = getVariantAttributes(variant)
  const values = Object.values(attrs).filter(Boolean)
  if (values.length > 0) return values.join(' · ')
  const name = variant.name?.trim() ?? ''
  if (name && !GENERIC_VARIANT_NAMES.test(name)) return name
  return ''
}

export function isColorDimension(name: string): boolean {
  return /color|colour/i.test(name)
}

export function isSizeDimension(name: string): boolean {
  return /size/i.test(name)
}

const COLOR_NAME_MAP: Record<string, string> = {
  black: '#111827',
  white: '#f9fafb',
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#eab308',
  gray: '#6b7280',
  grey: '#6b7280',
  navy: '#1e3a5f',
  pink: '#ec4899',
  orange: '#f97316',
  purple: '#9333ea',
  brown: '#78350f',
  beige: '#d4b896',
  cream: '#fef3c7',
  maroon: '#7f1d1d',
  teal: '#0d9488',
  gold: '#ca8a04',
  silver: '#9ca3af',
}

export function colorValueToCss(value: string, variant?: ProductVariant): string | undefined {
  if (variant?.color) return variant.color
  return COLOR_NAME_MAP[value.toLowerCase().trim()]
}

export function selectionsFromVariant(variant?: ProductVariant): Record<string, string> {
  if (!variant) return {}
  return getVariantAttributes(variant)
}

export function hasStructuredVariantOptions(variants: ProductVariant[]): boolean {
  return getVariantOptionDimensions(variants).length > 0
}

export function resolveSelectedVariant(
  variants: ProductVariant[],
  variantId?: string,
  variantLabel?: string,
): ProductVariant | undefined {
  if (variantId) {
    const byId = variants.find((v) => v.id === variantId)
    if (byId) return byId
  }
  if (variantLabel) {
    const byLabel = variants.find((v) => {
      const label = variantDisplayLabel(v)
      return label === variantLabel || v.name === variantLabel
    })
    if (byLabel) return byLabel
  }
  return undefined
}
