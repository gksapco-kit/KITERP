import { UOM_OPTIONS } from '@/lib/uomOptions'

/** Map legacy procurement abbreviations to product-master UOM values. */
const LEGACY_TO_MASTER: Record<string, string> = {
  pcs: 'piece',
  piece: 'piece',
  pieces: 'piece',
  ea: 'unit',
  each: 'unit',
  unit: 'unit',
  units: 'unit',
  box: 'box',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ltr: 'l',
  litre: 'l',
  liter: 'l',
  litres: 'l',
  l: 'l',
  mtr: 'm',
  metre: 'm',
  meter: 'm',
  metres: 'm',
  m: 'm',
  hr: 'hour',
  hour: 'hour',
  hours: 'hour',
  day: 'day',
  days: 'day',
  mon: 'month',
  month: 'month',
  job: 'job',
}

const MASTER_VALUES = new Set(UOM_OPTIONS.map(o => o.value))

/**
 * Normalize a UOM to the product-master catalog value so procurement
 * lines match Product Form / variant UOM exactly.
 */
export function normalizeUom(uom?: string | null): string {
  if (!uom) return 'piece'
  const key = uom.toLowerCase().trim().replace(/\s+/g, '_')
  if (LEGACY_TO_MASTER[key]) return LEGACY_TO_MASTER[key]
  if (MASTER_VALUES.has(key)) return key
  return key.slice(0, 20)
}

export interface ProcurementProductContext {
  product_id: string
  variant_id?: string | null
  name: string
  material_code?: string | null
  sku?: string | null
  uom: string
  cost_price: number
  hsn_code?: string | null
  gst_rate?: number | null
  is_taxable: boolean
  store_scope: string
  entities: { id: string; name: string; code?: string | null }[]
  available_stock: number
  reserved_qty: number
  open_requisition_qty: number
  open_po_qty: number
  reorder_point?: number | null
  on_demand_mrp: number
  default_store_id?: string | null
  default_plant_id?: string | null
  default_storage_location_id?: string | null
  stock_by_location: {
    store_id: string
    store_name: string
    plant_id?: string | null
    plant_name?: string | null
    storage_location_id?: string | null
    storage_location_name?: string | null
    quantity: number
  }[]
}
