import type { ProductVariant } from '@/types'

const GENERIC_VARIANT_NAMES = /^(variant|default|plan \d+)$/i

const SIZE_VALUE_PATTERN =
  /^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|one\s*size|os|small|medium|large|x[- ]?large|xx[- ]?large)$/i

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl']

const SIZE_NAME_TO_CODE: Record<string, string> = {
  'extra small': 'XS',
  'x-small': 'XS',
  xsmall: 'XS',
  small: 'S',
  medium: 'M',
  large: 'L',
  'extra large': 'XL',
  'x-large': 'XL',
  xlarge: 'XL',
  'xx-large': 'XXL',
  xxlarge: 'XXL',
  '2xl': '2XL',
  '3xl': '3XL',
  '4xl': '4XL',
  'one size': 'OS',
  os: 'OS',
}

/** Prefer short size codes (S, M, L) over display names (Small, Medium, Large). */
function toCompactSizeCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const mapped = SIZE_NAME_TO_CODE[trimmed.toLowerCase()]
  if (mapped) return mapped
  if (isSizeLikeToken(trimmed) && trimmed.length <= 4) return trimmed.toUpperCase()
  return trimmed
}

export function isSizeLikeToken(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return SIZE_VALUE_PATTERN.test(trimmed) || isSizeDimension(trimmed)
}

export function sortSizeValues(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.trim().toLowerCase())
    const bi = SIZE_ORDER.indexOf(b.trim().toLowerCase())
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })
}

export function getVariantAttributes(variant: ProductVariant): Record<string, string> {
  const raw = variant.attributes ?? {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && String(value).trim()) out[key] = String(value).trim()
  }
  return out
}

export function normalizeVariantAttributes(variant: ProductVariant): Record<string, string> {
  const attrs = getVariantAttributes(variant)
  const keys = Object.keys(attrs)

  if (keys.length === 0) {
    const name = variant.name?.trim() ?? ''
    if (name && !GENERIC_VARIANT_NAMES.test(name)) {
      if (isColorLikeToken(name)) return { Color: name }
      if (isSizeLikeToken(name)) return { Size: toCompactSizeCode(name) }
    }
    return {}
  }

  const valueKey = keys.find((k) => k.toLowerCase() === 'value')
  const sizeKey = keys.find((k) => isSizeDimension(k))
  const colorKey = keys.find(isColorDimension)
  const valueCode = valueKey ? attrs[valueKey]?.trim() : ''
  const sizeLabel = sizeKey ? attrs[sizeKey]?.trim() : ''
  // ERP uses Value as a size code alongside Color (e.g. Gold + S). Do not treat Value as
  // size when it is the only attribute and holds a color-like label (e.g. Gold).
  const valueIsSizeCode = Boolean(valueKey && valueCode && (colorKey || isSizeLikeToken(valueCode)))
  const canonicalSize = valueIsSizeCode
    ? toCompactSizeCode(valueCode)
    : sizeLabel
      ? toCompactSizeCode(sizeLabel)
      : ''

  if (valueKey && valueCode && !valueIsSizeCode && !colorKey && isColorLikeToken(valueCode)) {
    return { Color: valueCode }
  }

  if (canonicalSize || sizeKey || valueIsSizeCode) {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(attrs)) {
      if (isSizeDimension(k) || k.toLowerCase() === 'value') continue
      out[k] = v
    }
    if (canonicalSize) out.Size = canonicalSize
    return out
  }

  if (keys.length === 1) {
    const key = keys[0]
    const val = attrs[key]
    if (isColorDimension(key)) return attrs
    if (isSizeLikeToken(key) && !isColorDimension(key)) {
      return { Size: toCompactSizeCode(val || key) }
    }
    if (val && key.toLowerCase() === val.toLowerCase() && isSizeLikeToken(val)) {
      return { Size: toCompactSizeCode(val) }
    }
  }

  return attrs
}

export function normalizeVariantsForOptions(variants: ProductVariant[]): ProductVariant[] {
  return variants.map((v) => ({
    ...v,
    attributes: normalizeVariantAttributes(v),
  }))
}

export type ProductCardOptionRow =
  | { type: 'size'; label: string; values: string[] }
  | {
      type: 'color'
      label: string
      swatches: {
        value: string
        css: string
        variantId?: string
        imageUrl?: string
        imageIndex?: number
      }[]
    }

export type VariantValidationResult = {
  valid: boolean
  variant?: ProductVariant
  message?: string
}

function getSizeSelection(selections: Record<string, string>): string | undefined {
  if (selections.Size) return selections.Size
  const entry = Object.entries(selections).find(([k]) => isSizeDimension(k))
  return entry?.[1]
}

function collectSizeValuesFromVariants(variants: ProductVariant[]): string[] {
  const values = new Set<string>()
  for (const v of variants) {
    const attrs = getVariantAttributes(v)
    for (const [key, val] of Object.entries(attrs)) {
      if (!val || isColorDimension(key)) continue
      if (isSizeDimension(key) || isSizeLikeToken(val)) values.add(toCompactSizeCode(val))
    }
    const name = v.name?.trim() ?? ''
    if (!name || GENERIC_VARIANT_NAMES.test(name)) continue
    if (isSizeLikeToken(name)) {
      values.add(toCompactSizeCode(name))
      continue
    }
    for (const part of name.split(/[/·\-–|,]+/).map((p) => p.trim()).filter(Boolean)) {
      if (isSizeLikeToken(part)) values.add(toCompactSizeCode(part))
    }
  }
  return sortSizeValues([...values])
}

function getColorFromVariant(v: ProductVariant): string | undefined {
  const attrs = getVariantAttributes(normalizeVariantAttributes(v))
  const colorKey = Object.keys(attrs).find(isColorDimension)
  if (colorKey) return attrs[colorKey]
  const name = v.name?.trim()
  if (name && isColorLikeToken(name)) return name
  return undefined
}

function parseGalleryColorIndex(name: string): number | undefined {
  const match = name.trim().match(/^color\s+(\d+)$/i)
  if (!match) return undefined
  return Number(match[1]) - 1
}

function stripSpuriousSizeSelections(
  normalized: ProductVariant[],
  selections: Record<string, string>,
): Record<string, string> {
  const hasStructuredSize = normalized.some((v) => {
    const attrs = getVariantAttributes(v)
    return Object.keys(attrs).some(isSizeDimension) || Boolean(attrs.Size)
  })
  if (hasStructuredSize) return selections

  const out = { ...selections }
  for (const key of Object.keys(out)) {
    if (isSizeDimension(key) || key === 'Size') delete out[key]
  }
  return out
}

function variantsHaveStructuredSize(variants: ProductVariant[]): boolean {
  const normalized = normalizeVariantsForOptions(variants)
  return normalized.some((v) => {
    const attrs = getVariantAttributes(v)
    return Object.keys(attrs).some(isSizeDimension) || Boolean(attrs.Size)
  })
}

function applySizeDefaultsIfStructured(
  variants: ProductVariant[],
  rows: ProductCardOptionRow[],
  target: Record<string, string>,
) {
  if (!variantsHaveStructuredSize(variants)) return
  for (const row of rows) {
    if (row.type === 'size' && !target[row.label] && row.values[0]) {
      target[row.label] = row.values[0]
    }
  }
}

function variantHasSize(variant: ProductVariant, size?: string): boolean {
  if (!size) return true
  const attrs = getVariantAttributes(variant)
  const sizeKey = Object.keys(attrs).find(isSizeDimension) || (attrs.Size ? 'Size' : undefined)
  const variantSize = sizeKey ? attrs[sizeKey] : undefined
  return !variantSize || variantSize === size
}

function resolveVariantByColorName(
  normalized: ProductVariant[],
  colorName: string,
  selections: Record<string, string>,
): ProductVariant | undefined {
  const sizeSel = getSizeSelection(selections)

  // Gallery-only or single-SKU products: every swatch maps to the same purchasable variant.
  if (normalized.length === 1) {
    const only = normalized[0]
    if (variantHasSize(only, sizeSel)) return only
  }

  const galleryIdx = parseGalleryColorIndex(colorName)
  if (galleryIdx != null && galleryIdx >= 0) {
    const candidate = normalized[galleryIdx] ?? normalized[0]
    if (candidate && variantHasSize(candidate, sizeSel)) return candidate
  }

  return normalized.find((v) => {
    if (!variantHasSize(v, sizeSel)) return false
    const colorLabel = getColorFromVariant(v)
    const css = variantColorCss(v)
    const needle = colorName.toLowerCase()
    if (colorLabel?.toLowerCase() === needle) return true
    if (css?.toLowerCase() === needle) return true
    if (colorValueToCss(colorName, v)?.toLowerCase() === css?.toLowerCase()) return true
    const label = variantDisplayLabel(v) || v.name
    return label?.toLowerCase() === needle
  })
}

export function isCombinationAvailable(
  variants: ProductVariant[],
  selections: Record<string, string>,
  colorName?: string,
): boolean {
  return validateVariantCombination(variants, selections, colorName).valid
}

export function validateVariantCombination(
  variants: ProductVariant[],
  selections: Record<string, string>,
  colorName?: string,
): VariantValidationResult {
  const normalized = normalizeVariantsForOptions(variants)
  if (!normalized.length) return { valid: true }

  const cleanedSelections = stripSpuriousSizeSelections(normalized, selections)
  const colorDim = getVariantOptionDimensions(normalized).find(isColorDimension)
  const merged: Record<string, string> = { ...cleanedSelections }
  if (colorName && colorDim) merged[colorDim] = colorName

  const exact = findVariantBySelections(normalized, merged)
  const colorSelectionComplete =
    !colorName || !colorDim || merged[colorDim] === colorName
  if (exact && colorSelectionComplete) return { valid: true, variant: exact }

  if (colorName) {
    const match = resolveVariantByColorName(normalized, colorName, merged)
    if (match) return { valid: true, variant: match }

    // Legacy inline matcher kept for edge cases with partial selections
    const sizeSel = getSizeSelection(merged)
    const legacyMatch = normalized.find((v) => {
      const attrs = getVariantAttributes(v)
      if (sizeSel) {
        const sizeKey = Object.keys(attrs).find(isSizeDimension) || (attrs.Size ? 'Size' : undefined)
        const variantSize = sizeKey ? attrs[sizeKey] : undefined
        if (variantSize && variantSize !== sizeSel) return false
      } else if (Object.keys(cleanedSelections).length > 0 && !partialSelectionMatch(v, cleanedSelections)) {
        return false
      }

      const colorLabel = getColorFromVariant(v)
      const css = variantColorCss(v)
      const needle = colorName.toLowerCase()
      if (colorLabel?.toLowerCase() === needle) return true
      if (css?.toLowerCase() === needle) return true
      if (colorValueToCss(colorName, v)?.toLowerCase() === css?.toLowerCase()) return true
      return false
    })
    if (legacyMatch) return { valid: true, variant: legacyMatch }
  }

  if (!colorName && Object.keys(merged).length > 0) {
    const partial = findVariantBySelections(normalized, merged)
    if (partial) return { valid: true, variant: partial }
  }

  if (colorName) {
    const byColor = resolveVariantByColorName(normalized, colorName, merged)
    if (byColor) return { valid: true, variant: byColor }
  }

  if (Object.keys(merged).length === 0 && !colorName && normalized.length === 1) {
    return { valid: true, variant: normalized[0] }
  }

  // Fallback: variants whose names serve as option labels (e.g. "Variant 1" / "Variant 2"
  // rendered as size chips with no structured attributes). stripSpuriousSizeSelections will
  // have removed the Size key from merged, so consult the original selections directly.
  const nameBasedSizeSel = getSizeSelection(selections)
  if (nameBasedSizeSel && !colorName) {
    const byName = normalized.find((v) => v.name?.trim() === nameBasedSizeSel)
    if (byName) return { valid: true, variant: byName }
  }

  const size = getSizeSelection(merged)
  const color = colorName || (colorDim ? merged[colorDim] : undefined)

  if (size && color) {
    const galleryResolved = resolveVariantByColorName(normalized, color, merged)
    if (galleryResolved) return { valid: true, variant: galleryResolved }
    const availableColors = [
      ...new Set(
        normalized
          .filter((v) => {
            const attrs = getVariantAttributes(v)
            const sk = Object.keys(attrs).find(isSizeDimension) || (attrs.Size ? 'Size' : undefined)
            const variantSize = sk ? attrs[sk] : undefined
            return variantSize === size
          })
          .map((v) => getColorFromVariant(v))
          .filter((c): c is string => !!c),
      ),
    ]
    if (availableColors.length) {
      return {
        valid: false,
        message: `Size ${size} in ${color} is not available. Choose: ${availableColors.join(', ')}.`,
      }
    }
    return { valid: false, message: `Size ${size} in ${color} is not available.` }
  }

  return { valid: false, message: 'This combination is not available.' }
}

function partialSelectionMatch(variant: ProductVariant, selections: Record<string, string>): boolean {
  const attrs = getVariantAttributes(variant)
  return Object.entries(selections).every(([dim, val]) => {
    if (!val) return true
    const key = Object.keys(attrs).find((k) => k.toLowerCase() === dim.toLowerCase())
    return key != null && attrs[key] === val
  })
}

export function buildProductCardOptionRows(
  variants: ProductVariant[],
  productImages?: { url: string; alt_text?: string }[],
): ProductCardOptionRow[] {
  if (!variants.length) return []

  const normalized = normalizeVariantsForOptions(variants)
  const rows: ProductCardOptionRow[] = []
  const dimensions = getVariantOptionDimensions(normalized)
  const colorOpts = getProductPageColorOptions(normalized, productImages)
  const colorDim = dimensions.find(isColorDimension)
  const galleryOnlyColors = colorOpts.length > 0 && !colorDim
  let hasSizeRow = false

  for (const dim of dimensions) {
    if (isColorDimension(dim)) continue
    if (dim.toLowerCase() === 'value') continue
    const values = getValuesForDimension(normalized, dim)
    if (!values.length) continue

    const compactValues = sortSizeValues(values.map(toCompactSizeCode))
    const uniqueValues = [...new Set(compactValues)]

    if (isSizeDimension(dim) || uniqueValues.every(isSizeLikeToken)) {
      rows.push({ type: 'size', label: 'Size', values: uniqueValues })
      hasSizeRow = true
      continue
    }

    rows.push({ type: 'size', label: dim, values: uniqueValues })
    hasSizeRow = true
  }

  if (!hasSizeRow && !galleryOnlyColors) {
    const inferredSizes = collectSizeValuesFromVariants(normalized)
    if (inferredSizes.length > 0) {
      rows.push({ type: 'size', label: 'Size', values: inferredSizes })
      hasSizeRow = true
    }
  }

  if (colorOpts.length > 0) {
    rows.push({
      type: 'color',
      label: 'Color',
      swatches: colorOpts.map((o) => ({
        value: o.name,
        css: o.color,
        variantId: o.variantId,
        imageUrl: o.imageUrl,
        imageIndex: o.imageIndex,
      })),
    })
  }

  if (!hasSizeRow && variants.length > 1 && !galleryOnlyColors) {
    const names = variants
      .map((v) => v.name?.trim())
      .filter((n): n is string => !!n && !GENERIC_VARIANT_NAMES.test(n))
    const uniqueNames = [...new Set(names)]
    if (uniqueNames.length > 1) {
      rows.unshift({
        type: 'size',
        label: 'Size',
        values: uniqueNames.every(isSizeLikeToken) ? sortSizeValues(uniqueNames.map(toCompactSizeCode)) : uniqueNames,
      })
    }
  }

  return rows
}

/** Hero image for listing cards — follows the selected color swatch or gallery index. */
export function resolveCardDisplayImage(
  rows: ProductCardOptionRow[],
  galleryImages: { url: string; alt_text?: string }[],
  selectedColorName?: string,
  fallbackImage?: string,
): string | undefined {
  const colorRow = rows.find((r) => r.type === 'color')
  if (colorRow?.type === 'color' && selectedColorName) {
    const swatch = colorRow.swatches.find(
      (s) => s.value.toLowerCase() === selectedColorName.toLowerCase(),
    )
    if (swatch?.imageUrl) return swatch.imageUrl
    if (swatch?.imageIndex != null && galleryImages[swatch.imageIndex]?.url) {
      return galleryImages[swatch.imageIndex].url
    }
  }
  return fallbackImage
}

/** Best-matching variant for price display on cards (exact match, then size + color, then size-only). */
export function resolveVariantForCardPricing(
  variants: ProductVariant[],
  rows: ProductCardOptionRow[],
  selections: Record<string, string>,
  colorName?: string,
): ProductVariant | undefined {
  const normalized = normalizeVariantsForOptions(variants)
  if (!normalized.length) return undefined

  const exact = validateVariantCombination(normalized, selections, colorName)
  if (exact.valid && exact.variant) return exact.variant

  const merged: Record<string, string> = { ...selections }
  const colorDim = getVariantOptionDimensions(normalized).find(isColorDimension)
  if (colorName && colorDim) merged[colorDim] = colorName

  if (colorName) {
    const sizeSel = getSizeSelection(merged)
    const match = normalized.find((v) => {
      const attrs = getVariantAttributes(v)
      if (sizeSel) {
        const sizeKey = Object.keys(attrs).find(isSizeDimension) || (attrs.Size ? 'Size' : undefined)
        const variantSize = sizeKey ? attrs[sizeKey] : undefined
        if (variantSize && variantSize !== sizeSel) return false
      } else if (Object.keys(selections).length > 0 && !partialSelectionMatch(v, selections)) {
        return false
      }

      const colorLabel = getColorFromVariant(v)
      const css = variantColorCss(v)
      const needle = colorName.toLowerCase()
      if (colorLabel?.toLowerCase() === needle) return true
      if (css?.toLowerCase() === needle) return true
      if (colorValueToCss(colorName, v)?.toLowerCase() === css?.toLowerCase()) return true
      return false
    })
    if (match) return match
  }

  const sizeOnly = findVariantBySelections(normalized, selections)
  if (sizeOnly) return sizeOnly

  const colorRow = rows.find((r) => r.type === 'color')
  if (colorName && colorRow?.type === 'color') {
    const swatch = colorRow.swatches.find((s) => s.value.toLowerCase() === colorName.toLowerCase())
    if (swatch?.variantId && !String(swatch.variantId).startsWith('gallery-')) {
      const sizeSel = getSizeSelection(selections)
      if (sizeSel) {
        const sized = normalized.find((v) => {
          const attrs = getVariantAttributes(v)
          const sizeKey = Object.keys(attrs).find(isSizeDimension) || (attrs.Size ? 'Size' : undefined)
          const variantSize = sizeKey ? attrs[sizeKey] : undefined
          if (variantSize !== sizeSel) return false
          const colorLabel = getColorFromVariant(v)
          return colorLabel?.toLowerCase() === colorName.toLowerCase()
        })
        if (sized) return sized
      }
      const byId = normalized.find((v) => v.id === swatch.variantId)
      if (byId) return byId
    }
  }

  if (Object.keys(selections).length > 0) {
    return findVariantBySelections(normalized, selections)
  }

  return normalized.find((v) => v.is_active !== false) ?? normalized[0]
}

export function resolveColorNameForVariant(
  variant: ProductVariant | undefined,
  rows: ProductCardOptionRow[],
  variants: ProductVariant[] = [],
): string | undefined {
  if (!variant || !rows.length) return undefined

  const attrs = getVariantAttributes(variant)
  const colorKey = Object.keys(attrs).find(isColorDimension)
  if (colorKey) return attrs[colorKey]

  const colorRow = rows.find((r) => r.type === 'color')
  if (colorRow?.type !== 'color') return undefined

  const byId = colorRow.swatches.find(
    (s) => s.variantId === variant.id && !String(s.variantId).startsWith('gallery-'),
  )
  if (byId) return byId.value

  const normalized = normalizeVariantsForOptions(variants.length ? variants : [variant])
  const idx = normalized.findIndex((v) => v.id === variant.id)
  if (idx >= 0) {
    const byGalleryIndex = colorRow.swatches.find(
      (s) => parseGalleryColorIndex(s.value) === idx,
    )
    if (byGalleryIndex) return byGalleryIndex.value
    if (colorRow.swatches[idx]) return colorRow.swatches[idx].value
  }

  return undefined
}

export function resolveCardDefaultSelections(
  variants: ProductVariant[],
  rows: ProductCardOptionRow[],
  preferredVariant?: ProductVariant,
): { selections: Record<string, string>; colorName?: string } {
  const selections = stripSpuriousSizeSelections(
    normalizeVariantsForOptions(variants),
    { ...selectionsFromVariant(preferredVariant) },
  )
  applySizeDefaultsIfStructured(variants, rows, selections)

  const colorRow = rows.find((r) => r.type === 'color')
  let colorName = resolveColorNameForVariant(preferredVariant, rows, variants)

  if (!colorName && colorRow?.type === 'color') {
    for (const swatch of colorRow.swatches) {
      const tryValidation = validateVariantCombination(variants, selections, swatch.value)
      if (tryValidation.valid) {
        colorName = swatch.value
        break
      }
    }
    if (!colorName) colorName = colorRow.swatches[0]?.value
  }

  let validation = validateVariantCombination(variants, selections, colorName)
  if (validation.valid) return { selections, colorName }

  const first = variants.find((v) => v.is_active !== false) ?? variants[0]
  if (first) {
    const retrySelections = stripSpuriousSizeSelections(
      normalizeVariantsForOptions(variants),
      { ...selectionsFromVariant(first) },
    )
    applySizeDefaultsIfStructured(variants, rows, retrySelections)
    const retryColor = resolveColorNameForVariant(first, rows, variants) ?? colorRow?.swatches[0]?.value
    validation = validateVariantCombination(variants, retrySelections, retryColor)
    if (validation.valid) {
      return { selections: retrySelections, colorName: retryColor }
    }
  }

  return { selections, colorName }
}

export function findVariantForCardSelection(
  variants: ProductVariant[],
  selections: Record<string, string>,
  colorName?: string,
): ProductVariant | undefined {
  return validateVariantCombination(variants, selections, colorName).variant
}

export function getVariantOptionDimensions(variants: ProductVariant[]): string[] {
  const normalized = normalizeVariantsForOptions(variants)
  const keys = new Set<string>()
  for (const variant of normalized) {
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
  const normalized = normalizeVariantsForOptions(variants)
  const dimLower = dimension.toLowerCase()
  const values = new Set<string>()
  for (const variant of normalized) {
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
  const normalized = normalizeVariantsForOptions(variants)
  const entries = Object.entries(selections).filter(([, value]) => value)
  if (entries.length === 0) return undefined
  return normalized.find((variant) => {
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
  const normalized = normalizeVariantsForOptions(variants)
  const dimLower = dimension.toLowerCase()
  return normalized.find((variant) => {
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

export function isColorLikeToken(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return false
  return trimmed in COLOR_NAME_MAP || isColorDimension(trimmed)
}

export function colorValueToCss(value: string, variant?: ProductVariant): string | undefined {
  if (variant?.color) return variant.color
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed
  return COLOR_NAME_MAP[trimmed.toLowerCase()]
}

/** Resolve a CSS color for a variant (hex field or color option attribute). */
export function variantColorCss(variant: ProductVariant): string | undefined {
  if (variant.color) return variant.color
  for (const [key, value] of Object.entries(getVariantAttributes(variant))) {
    if (isColorDimension(key)) {
      const css = colorValueToCss(value, variant)
      if (css) return css
    }
  }
  return undefined
}

export function selectionsFromVariant(variant?: ProductVariant): Record<string, string> {
  if (!variant) return {}
  return normalizeVariantAttributes(variant)
}

export function hasStructuredVariantOptions(variants: ProductVariant[]): boolean {
  return buildProductCardOptionRows(variants).length > 0
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

export type ProductColorOption = {
  id: string
  variantId: string
  name: string
  color: string
  imageUrl?: string
  imageIndex?: number
}

function matchImageToColorName(
  images: { url: string; alt_text?: string }[],
  colorName: string,
): { url: string; index: number } | undefined {
  const needle = colorName.trim().toLowerCase()
  if (!needle) return undefined
  const idx = images.findIndex((img) => {
    const alt = (img.alt_text || '').toLowerCase()
    return alt.includes(needle)
  })
  if (idx < 0) return undefined
  return { url: images[idx].url, index: idx }
}

function normalizeImageUrl(url: string): string {
  return url.trim().split('?')[0].toLowerCase()
}

function dedupeProductImages(imgs: { url: string; alt_text?: string }[]): { url: string; alt_text?: string }[] {
  const seen = new Set<string>()
  return imgs.filter((img) => {
    const key = normalizeImageUrl(img.url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function variantImageUrl(variant?: ProductVariant): string | undefined {
  const item = variant?.media?.find(
    (m) => (m.media_type || 'image') === 'image' && m.url,
  )
  return item?.url
}

function findSampleVariantForDimensionValue(
  variants: ProductVariant[],
  dimension: string,
  value: string,
): ProductVariant | undefined {
  const normalized = normalizeVariantsForOptions(variants)
  const dimLower = dimension.toLowerCase()
  const matches = normalized.filter((variant) => {
    const attrs = getVariantAttributes(variant)
    const key = Object.keys(attrs).find((k) => k.toLowerCase() === dimLower)
    return key != null && attrs[key] === value
  })
  if (!matches.length) return undefined
  return matches.find((v) => variantImageUrl(v)) ?? matches[0]
}

function dedupeColorOptions(options: ProductColorOption[]): ProductColorOption[] {
  const seen = new Set<string>()
  const out: ProductColorOption[] = []
  for (const opt of options) {
    const nameKey = opt.name.trim().toLowerCase()
    const genericName = /^color \d+$/.test(nameKey)
    const cssKey = opt.color.trim().toLowerCase()
    const key = !genericName && nameKey
      ? `name:${nameKey}`
      : cssKey
        ? `css:${cssKey}`
        : opt.imageUrl
          ? `url:${normalizeImageUrl(opt.imageUrl)}`
          : `id:${opt.id}`

    if (seen.has(key)) continue
    seen.add(key)
    out.push(opt)
  }
  return out
}

function colorNameFromImageMeta(alt: string | undefined, index: number): string {
  const trimmed = alt?.trim()
  if (trimmed && isColorLikeToken(trimmed)) return trimmed
  if (trimmed) {
    const lower = trimmed.toLowerCase()
    for (const color of Object.keys(COLOR_NAME_MAP)) {
      if (lower.includes(color)) {
        return color.charAt(0).toUpperCase() + color.slice(1)
      }
    }
  }
  return `Color ${index + 1}`
}

function buildGalleryColorOptions(
  variants: ProductVariant[],
  imgs: { url: string; alt_text?: string }[],
): ProductColorOption[] {
  return dedupeColorOptions(
    imgs.map((img, index) => {
      const v = variants[index] ?? variants[0]
      const nameFromAlt = colorNameFromImageMeta(img.alt_text, index)
      const css = isColorLikeToken(nameFromAlt) ? (colorValueToCss(nameFromAlt) || '#e5e7eb') : '#e5e7eb'
      return {
        id: `gallery-${index}`,
        variantId: v?.id ?? `gallery-${index}`,
        name: nameFromAlt,
        color: css,
        imageUrl: img.url,
        imageIndex: index,
      }
    }),
  )
}

/** Color swatches for product detail — only when Color is a real option (or gallery-only products). */
export function getProductPageColorOptions(
  variants: ProductVariant[],
  productImages?: { url: string; alt_text?: string }[],
): ProductColorOption[] {
  if (!variants.length && !(productImages?.length)) return []

  const normalized = normalizeVariantsForOptions(variants)
  const options: ProductColorOption[] = []
  const seen = new Set<string>()

  const dimensions = getVariantOptionDimensions(normalized)
  const colorDim = dimensions.find(isColorDimension)
  // Structured non-color options (Weight, Spice Level, Size, …) mean Color was not selected —
  // do not invent a Color row from leftover variant.color or gallery images.
  const hasOtherOptionDims = dimensions.some(
    (d) => !isColorDimension(d) && d.toLowerCase() !== 'value',
  )
  if (!colorDim && hasOtherOptionDims) {
    return []
  }

  if (colorDim) {
    for (const value of getValuesForDimension(normalized, colorDim)) {
      const sample = findSampleVariantForDimensionValue(normalized, colorDim, value)
      if (!sample) continue
      const css = colorValueToCss(value, sample) || '#9ca3af'
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const imgMatch = productImages?.length ? matchImageToColorName(productImages, value) : undefined
      options.push({
        id: `${sample.id}-${key}`,
        variantId: sample.id,
        name: value,
        color: css,
        imageUrl: variantImageUrl(sample) || imgMatch?.url,
        imageIndex: imgMatch?.index,
      })
    }
  }

  if (!options.length && !hasOtherOptionDims) {
    for (const v of normalized) {
      const css = variantColorCss(v)
      if (!css) continue
      const colorLabel = getColorFromVariant(v)
      const key = (colorLabel || css).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const label = colorLabel || variantDisplayLabel(v) || v.name
      const imgMatch = label && productImages?.length ? matchImageToColorName(productImages, label) : undefined
      options.push({
        id: v.id,
        variantId: v.id,
        name: label,
        color: css,
        imageUrl: variantImageUrl(v) || imgMatch?.url,
        imageIndex: imgMatch?.index,
      })
    }
  }

  if (!options.length && !hasOtherOptionDims) {
    for (const v of normalized) {
      const name = v.name?.trim()
      if (!name || GENERIC_VARIANT_NAMES.test(name) || !isColorLikeToken(name)) continue
      const css = colorValueToCss(name, v) || '#9ca3af'
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const imgMatch = productImages?.length ? matchImageToColorName(productImages, name) : undefined
      options.push({
        id: v.id,
        variantId: v.id,
        name,
        color: css,
        imageUrl: variantImageUrl(v) || imgMatch?.url,
        imageIndex: imgMatch?.index,
      })
    }
  }

  const imgs = dedupeProductImages((productImages || []).filter((i) => i.url))

  if (colorDim && options.length > 0) {
    return dedupeColorOptions(
      options.map((opt) => {
        const imgMatch = matchImageToColorName(imgs, opt.name)
        return {
          ...opt,
          imageUrl: opt.imageUrl || imgMatch?.url,
          imageIndex: opt.imageIndex ?? imgMatch?.index,
        }
      }),
    )
  }

  // Gallery-as-Color only for products with no structured option dimensions.
  const shouldPreferGallery = imgs.length >= 2 && !colorDim && !hasOtherOptionDims && options.length < imgs.length

  if (shouldPreferGallery) {
    return buildGalleryColorOptions(normalized, imgs)
  }

  if (options.length >= 1) {
    return dedupeColorOptions(
      options.map((opt) => {
        const imgMatch = matchImageToColorName(imgs, opt.name)
        return {
          ...opt,
          imageUrl: opt.imageUrl || imgMatch?.url,
          imageIndex: opt.imageIndex ?? imgMatch?.index,
        }
      }),
    )
  }

  if (imgs.length >= 1 && !colorDim && !hasOtherOptionDims) {
    return buildGalleryColorOptions(normalized, imgs)
  }

  return options
}
