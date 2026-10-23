import apiClient from './client'

export interface YieldProfileLine {
  id?: string
  cut_name: string
  /** Unit of input_per_output (kg, g, …). */
  input_uom?: string | null
  /** Raw input needed for 1 unit of output, in input_uom (1.30 kg or 500 g → 1 kg). */
  input_per_output: number
  /** How much of this cut comes out of 1 kg of raw chicken. */
  part_per_raw?: number | null
  /** Unit of part_per_raw (kg, g, piece). */
  part_uom?: string | null
  yield_pct?: number | null
  /** Weigh-out step in the input unit (0.05 = round to 50 g). */
  rounding_step?: number | null
  byproduct?: string | null
  sort_order?: number
}

export interface YieldProfile {
  id: string
  name: string
  category: string | null
  input_uom: string
  description: string | null
  is_active: boolean
  lines: YieldProfileLine[]
  created_at?: string | null
  updated_at?: string | null
}

export interface YieldProfileInput {
  name: string
  category?: string | null
  input_uom?: string
  description?: string | null
  is_active?: boolean
  lines: YieldProfileLine[]
}

export interface YieldProfileTemplate {
  name: string
  category: string
  input_uom: string
  lines: YieldProfileLine[]
}

export interface YieldCut {
  variant_id: string
  name: string
  cut: string | null
  price: number
  uom: string | null
  uom_quantity: number | null
  /** Finished output one sale hands over, in the product's stock unit. */
  output_per_sale: number
  yield_factor: number | null
}

export interface YieldProduct {
  id: string
  name: string
  category: string | null
  pool_uom: string
  shared_stock: boolean
  stock_on_hand: number | null
  yield_profile_id: string | null
  cuts: YieldCut[]
}

export interface YieldDayCut {
  variant_id: string | null
  name: string
  cut: string | null
  units_sold: number
  units_returned: number
  output_qty: number
  raw_qty: number
  set_factor: number | null
  effective_factor: number | null
  sales_amount: number
}

export interface YieldDayRow {
  id?: string
  product_id: string
  product_name: string | null
  category: string | null
  business_date: string
  pool_uom: string
  shared_stock: boolean
  yield_enabled: boolean
  opening_qty: number
  purchased_qty: number
  raw_cut_qty: number
  returned_qty: number
  wastage_qty: number
  other_qty: number
  closing_system_qty: number
  closing_physical_qty: number | null
  variance_qty: number | null
  output_sold_qty: number
  cutting_loss_qty: number
  sales_amount: number
  raw_cost_per_unit: number | null
  cogs_amount: number
  gross_margin: number
  cuts: YieldDayCut[]
  notes?: string | null
  closed: boolean
  closed_at?: string | null
}

export interface YieldDayCloseInput {
  product_id: string
  business_date: string
  closing_physical_qty: number
  raw_cost_per_unit?: number | null
  tz_offset: number
  adjust_stock: boolean
  notes?: string
}

/** Minutes east of UTC for the browser's timezone (IST = 330). */
export const browserTzOffset = () => -new Date().getTimezoneOffset()

export const yieldApi = {
  templates: async (): Promise<YieldProfileTemplate[]> => {
    const res = await apiClient.get('/vendors/me/yield/templates')
    return res.data
  },
  listProfiles: async (): Promise<YieldProfile[]> => {
    const res = await apiClient.get('/vendors/me/yield/profiles')
    return res.data
  },
  createProfile: async (data: YieldProfileInput): Promise<YieldProfile> => {
    const res = await apiClient.post('/vendors/me/yield/profiles', data)
    return res.data
  },
  updateProfile: async (id: string, data: YieldProfileInput): Promise<YieldProfile> => {
    const res = await apiClient.put(`/vendors/me/yield/profiles/${id}`, data)
    return res.data
  },
  deleteProfile: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/yield/profiles/${id}`)
  },
  products: async (): Promise<YieldProduct[]> => {
    const res = await apiClient.get('/vendors/me/yield/products')
    return res.data
  },
  day: async (date: string): Promise<{ business_date: string; products: YieldDayRow[] }> => {
    const res = await apiClient.get('/vendors/me/yield/day', {
      params: { date, tz_offset: browserTzOffset() },
    })
    return res.data
  },
  closeDay: async (data: YieldDayCloseInput): Promise<YieldDayRow> => {
    const res = await apiClient.post('/vendors/me/yield/day/close', data)
    return res.data
  },
  reopenDay: async (closeId: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/yield/day/close/${closeId}`)
  },
}
