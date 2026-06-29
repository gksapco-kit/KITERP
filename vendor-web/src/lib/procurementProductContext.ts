/** Normalize catalog UOM values to procurement line-item codes. */
export function normalizeUom(uom?: string | null): string {
  if (!uom) return 'PCS'
  const key = uom.toLowerCase().trim().replace(/\s+/g, '_')
  const map: Record<string, string> = {
    piece: 'PCS',
    pieces: 'PCS',
    pcs: 'PCS',
    unit: 'PCS',
    units: 'PCS',
    box: 'BOX',
    kg: 'KG',
    kilogram: 'KG',
    kilograms: 'KG',
    ltr: 'LTR',
    litre: 'LTR',
    liter: 'LTR',
    litres: 'LTR',
    mtr: 'MTR',
    metre: 'MTR',
    meter: 'MTR',
    metres: 'MTR',
    hr: 'HR',
    hour: 'HR',
    hours: 'HR',
    day: 'DAY',
    days: 'DAY',
    ea: 'EA',
    each: 'EA',
    job: 'JOB',
    mon: 'MON',
    month: 'MON',
  }
  return map[key] ?? uom.toUpperCase().slice(0, 20)
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
