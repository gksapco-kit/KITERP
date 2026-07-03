import type { ProductVariant } from '@/types'

const GENERIC_VARIANT_NAMES = /^(variant|default|plan \d+)$/i

const SIZE_VALUE_PATTERN =
  /^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|one\s*size|os|small|medium|large|x[- ]?large|xx[- ]?large)$/i

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl']

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
      if (isSizeLikeToken(name)) return { Size: name }
    }
    return {}
  }

  const sizeKey = keys.find((k) => isSizeDimension(k))
  if (sizeKey) {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(attrs)) {
      if (isSizeDimension(k)) out.Size = v
      else out[k] = v
    }
    return out
  }

  if (keys.length === 1) {
    const key = keys[0]
    const val = attrs[key]
    if (isColorDimension(key)) return attrs
    if (isSizeLikeToken(key) && !isColorDimension(key)) {
      return { Size: val || key }
    }
    if (val && key.toLowerCase() === val.toLowerCase() && isSizeLikeToken(val)) {
      return { Size: val }
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
      if (isSizeDimension(key) || isSizeLikeToken(val)) values.add(val)
    }
    const name = v.name?.trim() ?? ''
    if (!name || GENERIC_VARIANT_NAMES.test(name)) continue
    if (isSizeLikeToken(name)) {
      values.add(name)
      continue
    }
    for (const part of name.split(/[/·\-–|,]+/).map((p) => p.trim()).filter(Boolean)) {
      if (isSizeLikeToken(part)) values.add(part)
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

  const colorDim = getVariantOptionDimensions(normalized).find(isColorDimension)
  const merged: Record<string, string> = { ...selections }
  if (colorName && colorDim) merged[colorDim] = colorName

  const exact = findVariantBySelections(normalized, merged)
  const colorSelectionComplete =
    !colorName || (colorDim ? merged[colorDim] === colorName : false)
  if (exact && colorSelectionComplete) return { valid: true, variant: exact }

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
    if (match) return { valid: true, variant: match }
  }

  if (!colorName && Object.keys(merged).length > 0) {
    const partial = findVariantBySelections(normalized, merged)
    if (partial) return { valid: true, variant: partial }
  }

  const size = getSizeSelection(merged)
  const color = colorName || (colorDim ? merged[colorDim] : undefined)

  if (size && color) {
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
  let hasSizeRow = false

  for (const dim of dimensions) {
    if (isColorDimension(dim)) continue
    const values = getValuesForDimension(normalized, dim)
    if (!values.length) continue

    if (isSizeDimension(dim) || values.every(isSizeLikeToken)) {
      rows.push({ type: 'size', label: 'Size', values: sortSizeValues(values) })
      hasSizeRow = true
      continue
    }

    rows.push({ type: 'size', label: dim, values })
    hasSizeRow = true
  }

  if (!hasSizeRow) {
    const inferredSizes = collectSizeValuesFromVariants(normalized)
    if (inferredSizes.length > 0) {
      rows.push({ type: 'size', label: 'Size', values: inferredSizes })
      hasSizeRow = true
    }
  }

  const colorOpts = getProductPageColorOptions(normalized, productImages)
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

  if (!hasSizeRow && variants.length > 1) {
    const names = variants
      .map((v) => v.name?.trim())
      .filter((n): n is string => !!n && !GENERIC_VARIANT_NAMES.test(n))
    const uniqueNames = [...new Set(names)]
    if (uniqueNames.length > 1) {
      rows.unshift({
        type: 'size',
        label: 'Size',
        values: uniqueNames.every(isSizeLikeToken) ? sortSizeValues(uniqueNames) : uniqueNames,
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

export function resolveCardDefaultSelections(
  variants: ProductVariant[],
  rows: ProductCardOptionRow[],
  preferredVariant?: ProductVariant,
): { selections: Record<string, string>; colorName?: string } {
  const selections = { ...selectionsFromVariant(preferredVariant) }
  for (const row of rows) {
    if (row.type === 'size' && !selections[row.label] && row.values[0]) {
      selections[row.label] = row.values[0]
    }
  }

  const colorRow = rows.find((r) => r.type === 'color')
  let colorName: string | undefined
  if (preferredVariant && colorRow?.type === 'color') {
    const attrs = getVariantAttributes(preferredVariant)
    const colorKey = Object.keys(attrs).find(isColorDimension)
    if (colorKey) colorName = attrs[colorKey]
    if (!colorName) {
      colorName = colorRow.swatches.find((s) => s.variantId === preferredVariant.id)?.value
    }
  }
  if (!colorName && colorRow?.type === 'color') {
    colorName = colorRow.swatches[0]?.value
  }

  let validation = validateVariantCombination(variants, selections, colorName)
  if (validation.valid) return { selections, colorName }

  const first = variants.find((v) => v.is_active !== false) ?? variants[0]
  if (first) {
    const retrySelections = { ...selectionsFromVariant(first) }
    for (const row of rows) {
      if (row.type === 'size' && !retrySelections[row.label] && row.values[0]) {
        retrySelections[row.label] = row.values[0]
      }
    }
    const retryColor =
      getColorFromVariant(first) ??
      (colorRow?.type === 'color' ? colorRow.swatches[0]?.value : undefined)
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

function dedupeColorOptions(options: ProductColorOption[]): ProductColorOption[] {
  const seenUrl = new Set<string>()
  const seenName = new Set<string>()
  const out: ProductColorOption[] = []
  for (const opt of options) {
    const urlKey = opt.imageUrl ? normalizeImageUrl(opt.imageUrl) : ''
    const nameKey = opt.name.trim().toLowerCase()
    const genericName = /^color \d+$/.test(nameKey)

    if (urlKey) {
      if (seenUrl.has(urlKey)) continue
      seenUrl.add(urlKey)
    } else if (nameKey && !genericName) {
      if (seenName.has(nameKey)) continue
      seenName.add(nameKey)
    }

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

/** Color swatches for product detail — variants, attributes, names, or product gallery images. */
export function getProductPageColorOptions(
  variants: ProductVariant[],
  productImages?: { url: string; alt_text?: string }[],
): ProductColorOption[] {
  if (!variants.length && !(productImages?.length)) return []

  const normalized = normalizeVariantsForOptions(variants)
  const options: ProductColorOption[] = []
  const seen = new Set<string>()

  const colorDim = getVariantOptionDimensions(normalized).find(isColorDimension)
  if (colorDim) {
    for (const value of getValuesForDimension(normalized, colorDim)) {
      const sample = findVariantForDimensionValue(normalized, colorDim, value)
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
        imageUrl: sample.media?.[0]?.url || imgMatch?.url,
        imageIndex: imgMatch?.index,
      })
    }
  }

  if (!options.length) {
    for (const v of normalized) {
      const css = variantColorCss(v)
      if (!css) continue
      const key = css.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const label = variantDisplayLabel(v) || v.name
      const imgMatch = label && productImages?.length ? matchImageToColorName(productImages, label) : undefined
      options.push({
        id: v.id,
        variantId: v.id,
        name: label,
        color: css,
        imageUrl: v.media?.[0]?.url || imgMatch?.url,
        imageIndex: imgMatch?.index,
      })
    }
  }

  if (!options.length) {
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
        imageUrl: v.media?.[0]?.url || imgMatch?.url,
        imageIndex: imgMatch?.index,
      })
    }
  }

  const imgs = dedupeProductImages((productImages || []).filter((i) => i.url))

  if (colorDim && options.length > 0) {
    return dedupeColorOptions(
      options.map((opt, i) => {
        const imgMatch = matchImageToColorName(imgs, opt.name)
        return {
          ...opt,
          imageUrl: opt.imageUrl || imgMatch?.url || imgs[i]?.url,
          imageIndex: opt.imageIndex ?? imgMatch?.index ?? (imgs[i] ? i : undefined),
        }
      }),
    )
  }

  const shouldPreferGallery = imgs.length >= 2 && !colorDim && options.length < imgs.length

  if (shouldPreferGallery) {
    return buildGalleryColorOptions(normalized, imgs)
  }

  if (options.length >= 1) {
    return dedupeColorOptions(
      options.map((opt, i) => ({
        ...opt,
        imageUrl: opt.imageUrl || imgs[i]?.url,
        imageIndex: opt.imageIndex ?? (imgs[i] ? i : undefined),
      })),
    )
  }

  if (imgs.length >= 1) {
    return buildGalleryColorOptions(normalized, imgs)
  }

  return options
}
