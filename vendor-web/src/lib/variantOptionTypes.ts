import type { ConfigInputType } from '@/api/vendor'
import type { ThemeSelectOption } from '@/components/common/ThemeSelect'
import { COLOUR_PALETTE, SIZE_PALETTE } from '@/lib/productVariantPresets'

export type VariantOptionType = {
  /** Machine name slug — stored as config attribute `name`. */
  value: string
  label: string
  group: string
  inputType?: ConfigInputType
  suggestedValues?: string[]
}

export const CUSTOM_OPTION_TYPE_VALUE = '__custom__'

export const VARIANT_OPTION_TYPES: VariantOptionType[] = [
  // Appearance
  {
    value: 'color',
    label: 'Color',
    group: 'Appearance',
    inputType: 'color',
    suggestedValues: COLOUR_PALETTE.map(c => c.name),
  },
  { value: 'pattern', label: 'Pattern', group: 'Appearance', suggestedValues: ['Solid', 'Striped', 'Checkered', 'Printed', 'Floral'] },
  { value: 'finish', label: 'Finish', group: 'Appearance', suggestedValues: ['Matte', 'Glossy', 'Satin', 'Brushed'] },
  { value: 'style', label: 'Style', group: 'Appearance', suggestedValues: ['Classic', 'Modern', 'Casual', 'Formal'] },
  { value: 'fit', label: 'Fit', group: 'Appearance', suggestedValues: ['Slim', 'Regular', 'Relaxed', 'Oversized'] },

  // Size & shape
  {
    value: 'size',
    label: 'Size',
    group: 'Size & shape',
    suggestedValues: SIZE_PALETTE.map(s => s.value),
  },
  { value: 'length', label: 'Length', group: 'Size & shape', suggestedValues: ['Short', 'Regular', 'Long'] },
  { value: 'width', label: 'Width', group: 'Size & shape', suggestedValues: ['Narrow', 'Standard', 'Wide'] },
  { value: 'height', label: 'Height', group: 'Size & shape', suggestedValues: ['Low', 'Standard', 'High'] },
  { value: 'thickness', label: 'Thickness', group: 'Size & shape', suggestedValues: ['Thin', 'Medium', 'Thick'] },
  { value: 'diameter', label: 'Diameter', group: 'Size & shape', suggestedValues: ['10 mm', '12 mm', '15 mm', '20 mm'] },

  // Physical — weight
  {
    value: 'weight',
    label: 'Weight',
    group: 'Physical — weight',
    inputType: 'dropdown',
    suggestedValues: ['250 g', '500 g', '1 kg', '2 kg', '5 kg', '10 kg'],
  },

  // Physical — volume
  {
    value: 'volume',
    label: 'Volume',
    group: 'Physical — volume',
    suggestedValues: ['100 ml', '250 ml', '500 ml', '750 ml', '1 L', '2 L', '5 L'],
  },
  {
    value: 'capacity',
    label: 'Capacity',
    group: 'Physical — volume',
    suggestedValues: ['1 L', '2 L', '5 L', '10 L', '20 L', '50 L'],
  },

  // Physical — dimensions
  {
    value: 'dimensions',
    label: 'Dimensions',
    group: 'Physical — dimensions',
    suggestedValues: ['Small', 'Medium', 'Large', 'Extra Large'],
  },
  {
    value: 'area',
    label: 'Area',
    group: 'Physical — dimensions',
    suggestedValues: ['1 sq m', '5 sq m', '10 sq m', '1 acre', '1 hectare'],
  },

  // Digital & electronics
  {
    value: 'storage',
    label: 'Storage',
    group: 'Digital & electronics',
    suggestedValues: ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB'],
  },
  {
    value: 'memory',
    label: 'Memory (RAM)',
    group: 'Digital & electronics',
    suggestedValues: ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB'],
  },
  {
    value: 'screen_size',
    label: 'Screen Size',
    group: 'Digital & electronics',
    suggestedValues: ['5.5"', '6.1"', '6.7"', '13"', '14"', '15.6"', '27"'],
  },
  {
    value: 'processor',
    label: 'Processor',
    group: 'Digital & electronics',
    suggestedValues: ['Intel i5', 'Intel i7', 'Intel i9', 'Ryzen 5', 'Ryzen 7', 'M2', 'M3'],
  },
  { value: 'model', label: 'Model', group: 'Digital & electronics', suggestedValues: ['2024', '2025', 'Pro', 'Standard', 'Lite'] },
  { value: 'version', label: 'Version', group: 'Digital & electronics', suggestedValues: ['V1', 'V2', 'V3'] },

  // Power & energy
  {
    value: 'voltage',
    label: 'Voltage',
    group: 'Power & energy',
    suggestedValues: ['110V', '220V', '240V', '415V'],
  },
  { value: 'phase', label: 'Phase', group: 'Power & energy', suggestedValues: ['Single Phase', 'Three Phase'] },
  {
    value: 'wattage',
    label: 'Wattage',
    group: 'Power & energy',
    suggestedValues: ['60W', '100W', '200W', '500W', '1000W', '2000W'],
  },
  {
    value: 'power_rating',
    label: 'Power Rating',
    group: 'Power & energy',
    suggestedValues: ['1 kW', '2 kW', '5 kW', '10 kW'],
  },

  // Product specifics
  { value: 'material', label: 'Material', group: 'Product specifics', suggestedValues: ['Cotton', 'Polyester', 'Leather', 'Wood', 'Metal', 'Plastic', 'Glass'] },
  { value: 'flavor', label: 'Flavor', group: 'Product specifics', suggestedValues: ['Vanilla', 'Chocolate', 'Strawberry', 'Mango'] },
  { value: 'scent', label: 'Scent', group: 'Product specifics', suggestedValues: ['Lavender', 'Rose', 'Citrus', 'Unscented'] },
  { value: 'grade', label: 'Grade', group: 'Product specifics', suggestedValues: ['Standard', 'Premium', 'Export'] },
  { value: 'pack_size', label: 'Pack Size', group: 'Product specifics', suggestedValues: ['Single', 'Pack of 2', 'Pack of 6', 'Pack of 12'] },
  { value: 'quantity', label: 'Quantity per Pack', group: 'Product specifics', suggestedValues: ['1', '2', '6', '12', '24'] },
]

export const VARIANT_OPTION_TYPE_GROUPS = [...new Set(VARIANT_OPTION_TYPES.map(t => t.group))]

export function getVariantOptionType(value: string): VariantOptionType | undefined {
  if (value === CUSTOM_OPTION_TYPE_VALUE) return undefined
  return VARIANT_OPTION_TYPES.find(t => t.value === value)
}

/** Match a config attribute's display name or slug to a catalog entry. */
export function getVariantOptionTypeForAttribute(displayName: string, slugName?: string): VariantOptionType | undefined {
  const labelKey = displayName.trim().toLowerCase()
  const slugKey = (slugName ?? '').trim().toLowerCase()
  return VARIANT_OPTION_TYPES.find(
    t => t.label.toLowerCase() === labelKey || t.value === slugKey,
  )
}

export function variantOptionTypeSelectOptions(excludeLabels: string[]): ThemeSelectOption[] {
  const exclude = new Set(excludeLabels.map(l => l.trim().toLowerCase()))
  const catalog = VARIANT_OPTION_TYPES
    .filter(t => !exclude.has(t.label.toLowerCase()))
    .map(t => ({
      value: t.value,
      label: t.label,
      group: t.group,
      hint: t.suggestedValues?.slice(0, 4).join(', '),
    }))

  return [
    {
      value: CUSTOM_OPTION_TYPE_VALUE,
      label: 'Custom…',
      hint: 'Enter your own option type name',
    },
    ...catalog,
  ]
}

export function filterVariantOptionTypes(query: string, excludeLabels: string[]): ThemeSelectOption[] {
  const options = variantOptionTypeSelectOptions(excludeLabels)
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter(opt =>
    opt.value === CUSTOM_OPTION_TYPE_VALUE
    || opt.label.toLowerCase().includes(q)
    || (opt.group?.toLowerCase().includes(q) ?? false)
    || (opt.hint?.toLowerCase().includes(q) ?? false),
  )
}

export function findCatalogMatchByLabel(query: string, excludeLabels: string[]): VariantOptionType | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const exclude = new Set(excludeLabels.map(l => l.trim().toLowerCase()))
  return VARIANT_OPTION_TYPES.find(
    t => !exclude.has(t.label.toLowerCase()) && t.label.toLowerCase() === q,
  )
}

/** Every required root attribute must have at least one active value. */
export function allOptionsHaveValues(roots: { is_active: boolean; is_required: boolean; options: { is_active: boolean }[] }[]): boolean {
  if (roots.length === 0) return false
  return roots.every(a => {
    if (!a.is_active) return true
    if (!a.is_required) return true
    return a.options.some(o => o.is_active)
  })
}

export function estimateVariantCombinations(roots: { is_active: boolean; is_required: boolean; options: { is_active: boolean }[] }[]): number {
  const active = roots.filter(a => a.is_active && a.is_required)
  if (active.length === 0) return 0
  const counts = active.map(a => a.options.filter(o => o.is_active).length)
  if (counts.some(n => n === 0)) return 0
  return counts.reduce((a, b) => a * b, 1)
}

/** Max variant combinations allowed per product (matches backend DEFAULT_MAX_COMBINATIONS). */
export const MAX_VARIANT_COMBINATIONS = 9999

/** Estimate combos if one more active value is added to the given attribute. */
export function estimateCombinationsWithExtraOption(
  roots: { id: string; is_active: boolean; is_required: boolean; options: { is_active: boolean }[] }[],
  attributeId: string,
): number {
  const active = roots.filter(a => a.is_active && a.is_required)
  if (active.length === 0) return 0
  let product = 1
  for (const a of active) {
    let n = a.options.filter(o => o.is_active).length
    if (a.id === attributeId) n += 1
    if (n === 0) return 0
    product *= n
  }
  return product
}

export function isOverComboLimit(count: number, limit = MAX_VARIANT_COMBINATIONS): boolean {
  return count > limit
}

export function optionsMissingValues(roots: { display_name: string; is_active: boolean; is_required: boolean; options: { is_active: boolean }[] }[]): string[] {
  return roots
    .filter(a => a.is_active && a.is_required && !a.options.some(o => o.is_active))
    .map(a => a.display_name)
}
