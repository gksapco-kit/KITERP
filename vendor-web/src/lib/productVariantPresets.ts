export type ColourPreset = {
  id: string
  name: string
  hex: string
}

export type SizePreset = {
  id: string
  size: string
  value: string
}

export type ProductVariantPresets = {
  colours: ColourPreset[]
  sizes: SizePreset[]
}

const STORAGE_KEY = 'kiterp:product-variant-presets'

function storageKey(vendorId?: string) {
  return vendorId ? `${STORAGE_KEY}:${vendorId}` : STORAGE_KEY
}

function emptyPresets(): ProductVariantPresets {
  return { colours: [], sizes: [] }
}

function safeStr(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function safeId(value: unknown): string {
  const id = safeStr(value)
  return id || crypto.randomUUID()
}

/** Migrate legacy preset shape (colours had size+value, sizes had value+hex). */
function normalizePresets(raw: Partial<ProductVariantPresets> & Record<string, unknown>): ProductVariantPresets {
  const colours: ColourPreset[] = (Array.isArray(raw.colours) ? raw.colours : [])
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null
      const c = entry as Record<string, unknown>
      const name = safeStr(c.name) || safeStr(c.value)
      if (!name) return null
      return {
        id: safeId(c.id),
        name,
        hex: normalizeHexColor(safeStr(c.hex) || '#6366F1'),
      }
    })
    .filter((c): c is ColourPreset => c != null)

  const sizes: SizePreset[] = (Array.isArray(raw.sizes) ? raw.sizes : [])
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null
      const s = entry as Record<string, unknown>
      const size = safeStr(s.size) || safeStr(s.value)
      if (!size) return null
      const value = safeStr(s.value) || size
      return {
        id: safeId(s.id),
        size,
        value,
      }
    })
    .filter((s): s is SizePreset => s != null)

  return { colours, sizes }
}

export function loadProductVariantPresets(vendorId?: string): ProductVariantPresets {
  try {
    const raw = localStorage.getItem(storageKey(vendorId))
    if (!raw) return emptyPresets()
    return normalizePresets(JSON.parse(raw) as Partial<ProductVariantPresets>)
  } catch {
    return emptyPresets()
  }
}

export function saveProductVariantPresets(presets: ProductVariantPresets, vendorId?: string) {
  try {
    localStorage.setItem(storageKey(vendorId), JSON.stringify(presets))
    window.dispatchEvent(new CustomEvent('kiterp:variant-presets-changed'))
  } catch {
    /* ignore quota / private mode */
  }
}

export function addColourPreset(
  input: { name: string; hex: string },
  vendorId?: string,
): ColourPreset {
  const presets = loadProductVariantPresets(vendorId)
  const entry: ColourPreset = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    hex: normalizeHexColor(input.hex),
  }
  presets.colours = [...presets.colours, entry]
  saveProductVariantPresets(presets, vendorId)
  return entry
}

export function addSizePreset(
  input: { size: string; value: string },
  vendorId?: string,
): SizePreset {
  const presets = loadProductVariantPresets(vendorId)
  const entry: SizePreset = {
    id: crypto.randomUUID(),
    size: input.size.trim(),
    value: input.value.trim(),
  }
  presets.sizes = [...presets.sizes, entry]
  saveProductVariantPresets(presets, vendorId)
  return entry
}

export function removeColourPreset(id: string, vendorId?: string) {
  const presets = loadProductVariantPresets(vendorId)
  presets.colours = presets.colours.filter(c => c.id !== id)
  saveProductVariantPresets(presets, vendorId)
}

export function removeSizePreset(id: string, vendorId?: string) {
  const presets = loadProductVariantPresets(vendorId)
  presets.sizes = presets.sizes.filter(s => s.id !== id)
  saveProductVariantPresets(presets, vendorId)
}

export const COLOUR_PALETTE = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Purple', hex: '#8B5CF6' },
] as const

/** @deprecated use COLOUR_PALETTE */
export const SIZE_COLOUR_PALETTE = COLOUR_PALETTE

export function normalizeHexColor(raw: string | null | undefined, fallback = '#6366F1'): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return fallback
  let hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback
  return `#${hex.toUpperCase()}`
}

/** Returns preset label when hex matches a palette swatch exactly. */
export function colourNameForHex(hex: string): string | null {
  const normalized = normalizeHexColor(hex, '')
  if (!normalized || normalized === '#') return null
  return COLOUR_PALETTE.find(c => c.hex.toUpperCase() === normalized)?.name ?? null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex, '')
  if (!normalized || normalized.length < 7) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

/** Exact palette name, else nearest swatch name for custom hex codes. */
export function suggestColourName(hex: string): string {
  const normalized = normalizeHexColor(hex)
  const exact = colourNameForHex(normalized)
  if (exact) return exact

  const rgb = hexToRgb(normalized)
  if (!rgb) return normalized

  let closest = COLOUR_PALETTE[0]
  let bestDist = Infinity
  for (const c of COLOUR_PALETTE) {
    const sample = hexToRgb(c.hex)
    if (!sample) continue
    const dist = (rgb.r - sample.r) ** 2 + (rgb.g - sample.g) ** 2 + (rgb.b - sample.b) ** 2
    if (dist < bestDist) {
      bestDist = dist
      closest = c
    }
  }
  return closest.name
}

export function applyColourSelection(hex: string): { hex: string; name: string } {
  const normalized = normalizeHexColor(hex)
  return { hex: normalized, name: suggestColourName(normalized) }
}

/** Products list / variant row label — e.g. Red(S) from attrs or legacy "Red / S". */
export function formatVariantDisplayLabel(
  name: string,
  attributes?: Record<string, unknown> | null,
): string {
  const { color, sizeCode } = parseVariantGroupParts(name, attributes)
  if (color && sizeCode) return `${color}(${sizeCode})`
  if (color) return color
  if (sizeCode) return sizeCode
  return safeStr(name) || 'Variant'
}

export function parseVariantGroupParts(
  name: string,
  attributes?: Record<string, unknown> | null,
): { color: string; sizeCode: string } {
  const attrs = attributes && typeof attributes === 'object' ? attributes : {}
  let color = safeStr(attrs.Color)
  let sizeCode = safeStr(attrs.Value) || safeStr(attrs.Size)

  if (!color || !sizeCode) {
    const raw = safeStr(name)
    const paren = raw.match(/^(.+?)\(([^)]+)\)$/)
    if (paren) {
      if (!color) color = paren[1].trim()
      if (!sizeCode) sizeCode = paren[2].trim().split(',')[0]?.trim() || ''
    }
    const parts = raw.split('/').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      if (!color) color = parts[0]
      if (!sizeCode) sizeCode = parts[parts.length - 1]
    } else if (parts.length === 1 && !sizeCode && !color) {
      sizeCode = parts[0]
    }
  }

  return { color, sizeCode }
}

export type VariantListGroup = {
  color: string
  sizeCodes: string[]
  count: number
}

/** Group variants by colour for list display — e.g. Red(S,L,M). */
export function groupProductVariants(
  variants: Array<{ name?: string; attributes?: Record<string, unknown> }>,
): VariantListGroup[] {
  const groups = new Map<string, { sizeCodes: Set<string>; count: number }>()

  for (const v of variants) {
    const { color, sizeCode } = parseVariantGroupParts(v.name || '', v.attributes)
    const key = color || '__size_only__'
    const entry = groups.get(key) || { sizeCodes: new Set<string>(), count: 0 }
    if (sizeCode) entry.sizeCodes.add(sizeCode)
    entry.count += 1
    groups.set(key, entry)
  }

  return [...groups.entries()].map(([key, entry]) => ({
    color: key === '__size_only__' ? '' : key,
    sizeCodes: [...entry.sizeCodes].sort((a, b) => a.localeCompare(b)),
    count: entry.count,
  }))
}

export function formatGroupedVariantLabel(color: string, sizeCodes: string[]): string {
  const codes = sizeCodes.filter(Boolean)
  if (color && codes.length > 0) return `${color}(${codes.join(',')})`
  if (color) return color
  if (codes.length === 1) return codes[0]
  if (codes.length > 1) return `(${codes.join(',')})`
  return 'Variant'
}

export function variantMatchesGroup(
  name: string,
  attributes: Record<string, unknown> | undefined | null,
  group: VariantListGroup,
): boolean {
  const { color } = parseVariantGroupParts(name, attributes)
  const key = color || '__size_only__'
  const groupKey = group.color || '__size_only__'
  return key === groupKey
}

/** Serialize a variant for PATCH /products/:id (variant upsert/delete). */
export function variantToUpdatePayload(v: {
  id: string
  name: string
  sku?: string
  barcode?: string
  uom?: string
  uom_quantity?: number | null
  price_type?: string
  price: number
  compare_at_price?: number | null
  cost_price?: number | null
  currency?: string
  discount_percentage?: number | null
  discount_amount?: number | null
  offer_label?: string
  is_on_sale?: boolean
  is_taxable?: boolean
  tax_rate?: number | null
  hsn_code?: string
  gst_rate?: number | null
  quantity?: number
  low_stock_threshold?: number
  stock_status?: string
  reorder_point?: number | null
  reorder_quantity?: number | null
  allow_backorders?: boolean
  track_inventory?: boolean
  max_quantity_per_order?: number | null
  min_quantity_per_order?: number | null
  weight_kg?: number | null
  expiration_date?: string | null
  manufacture_date?: string | null
  best_before_date?: string | null
  warranty_period_days?: number | null
  warranty_type?: string | null
  is_returnable?: boolean
  return_days?: number | null
  refund_policy?: string | null
  return_policy?: string | null
  return_conditions?: string | null
  color?: string | null
  attributes?: Record<string, unknown>
  subscription_interval?: string | null
  subscription_trial_days?: number | null
  subscription_setup_fee?: number | null
  subscription_billing_cycles?: number | null
  subscription_schedule_modes?: string[]
  is_active?: boolean
}): Record<string, unknown> {
  return {
    id: v.id,
    name: v.name,
    sku: v.sku?.trim() || undefined,
    barcode: v.barcode?.trim() || undefined,
    uom: v.uom || 'piece',
    uom_quantity: v.uom_quantity ?? undefined,
    price_type: v.price_type || 'per_unit',
    price: v.price,
    compare_at_price: v.compare_at_price ?? undefined,
    cost_price: v.cost_price ?? undefined,
    currency: v.currency || 'INR',
    discount_percentage: v.discount_percentage ?? undefined,
    discount_amount: v.discount_amount ?? undefined,
    offer_label: v.offer_label?.trim() || undefined,
    is_on_sale: v.is_on_sale ?? false,
    is_taxable: v.is_taxable ?? true,
    tax_rate: v.tax_rate ?? undefined,
    hsn_code: v.hsn_code?.trim() || undefined,
    gst_rate: v.gst_rate ?? undefined,
    quantity: v.quantity ?? 0,
    low_stock_threshold: v.low_stock_threshold ?? 5,
    stock_status: v.stock_status || 'in_stock',
    reorder_point: v.reorder_point ?? undefined,
    reorder_quantity: v.reorder_quantity ?? undefined,
    allow_backorders: v.allow_backorders ?? false,
    track_inventory: v.track_inventory ?? true,
    max_quantity_per_order: v.max_quantity_per_order ?? undefined,
    min_quantity_per_order: v.min_quantity_per_order ?? undefined,
    weight_kg: v.weight_kg ?? undefined,
    expiration_date: v.expiration_date || undefined,
    manufacture_date: v.manufacture_date || undefined,
    best_before_date: v.best_before_date || undefined,
    warranty_period_days: v.warranty_period_days ?? undefined,
    warranty_type: v.warranty_type || undefined,
    is_returnable: v.is_returnable ?? true,
    return_days: v.return_days ?? undefined,
    refund_policy: v.refund_policy || undefined,
    return_policy: v.return_policy || undefined,
    return_conditions: v.return_conditions || undefined,
    color: v.color || undefined,
    attributes: v.attributes || {},
    subscription_interval: v.subscription_interval || undefined,
    subscription_trial_days: v.subscription_trial_days ?? undefined,
    subscription_setup_fee: v.subscription_setup_fee ?? undefined,
    subscription_billing_cycles: v.subscription_billing_cycles ?? undefined,
    subscription_schedule_modes: v.subscription_schedule_modes?.length ? v.subscription_schedule_modes : undefined,
    is_active: v.is_active ?? true,
  }
}
