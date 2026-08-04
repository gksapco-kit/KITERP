/** Product/service UOM labels for storefront price suffixes. */

const UOM_SHORT: Record<string, string> = {
  piece: 'Piece',
  unit: 'Unit',
  pair: 'Pair',
  dozen: 'Dozen',
  set: 'Set',
  pack: 'Pack',
  bundle: 'Bundle',
  box: 'Box',
  case: 'Case',
  carton: 'Carton',
  bag: 'Bag',
  bottle: 'Bottle',
  can: 'Can',
  jar: 'Jar',
  tube: 'Tube',
  sachet: 'Sachet',
  pouch: 'Pouch',
  roll: 'Roll',
  sheet: 'Sheet',
  mg: 'mg',
  g: 'g',
  kg: 'kg',
  tonne: 't',
  oz: 'oz',
  lb: 'lb',
  ml: 'ml',
  l: 'L',
  litre: 'L',
  liter: 'L',
  cm: 'cm',
  m: 'm',
  meter: 'm',
  mm: 'mm',
  sqft: 'sq.ft',
  sqmt: 'sq.m',
  pack_size: 'Pack',
}

function shortUomLabel(uom: string): string {
  const key = uom.replace(/^per_/, '')
  if (UOM_SHORT[key]) return UOM_SHORT[key]
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** e.g. "Bag", "2 kg" — for "/ Bag" style price suffixes. */
export function formatUomDisplay(
  uomQuantity: number | string | null | undefined,
  uom?: string | null,
): string | null {
  if (!uom) return null
  const short = shortUomLabel(uom)
  const qty = uomQuantity === '' || uomQuantity == null ? null : Number(uomQuantity)
  if (qty != null && !Number.isNaN(qty) && qty > 0 && qty !== 1) {
    return `${qty} ${short}`
  }
  return short
}
