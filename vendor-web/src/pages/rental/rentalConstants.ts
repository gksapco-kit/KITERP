/** Asset Kind options — drive the adaptive form fields (capacity, location labels, etc.).
 *  Separate from vendor-managed categories (category_id FK). */
export const RENTAL_ASSET_KINDS = [
  { value: 'milk_dairy', label: 'Milk Dairy' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'storage', label: 'Storage' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'other', label: 'Other' },
]

/** @deprecated Use RENTAL_ASSET_KINDS */
export const RENTAL_CATEGORIES = RENTAL_ASSET_KINDS

/** Default Master ID prefix for rental assets (generic — not rack-specific). */
export const DEFAULT_ASSET_CODE_PREFIX = 'AST'

/** Build a preview master ID like AST-005. */
export function previewAssetCode(index: number, prefix = DEFAULT_ASSET_CODE_PREFIX) {
  const clean = (prefix || DEFAULT_ASSET_CODE_PREFIX).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || DEFAULT_ASSET_CODE_PREFIX
  return `${clean}-${String(Math.max(1, index)).padStart(3, '0')}`
}

export const ASSET_TYPES = [
  { value: 'storage_rack', label: 'Storage Rack' },
  { value: 'chair', label: 'Chair' },
  { value: 'table', label: 'Table' },
  { value: 'bed', label: 'Bed' },
  { value: 'refrigerator', label: 'Refrigerator' },
  { value: 'machine', label: 'Machine' },
  { value: 'unit', label: 'Unit' },
  { value: 'other', label: 'Other' },
]

/** Flat label suggestions for the free-text Asset Kind input. */
export const ASSET_KIND_SUGGESTIONS = [
  'Milk Dairy', 'Furniture', 'Equipment', 'Storage', 'Vehicles',
  'Electronics', 'Appliances', 'Crockery', 'Linen & Bedding', 'Tents & Canopy',
  'Audio / Visual', 'Lighting', 'Scaffolding', 'Tools', 'Bikes', 'Two-wheelers',
  'Four-wheelers', 'Heavy Machinery', 'Party Supplies', 'Event Décor', 'Sports Gear', 'Other',
]

/** Flat label suggestions for the free-text Asset Type input. */
export const ASSET_TYPE_SUGGESTIONS = [
  'Storage Rack', 'Chair', 'Table', 'Bed', 'Refrigerator', 'Machine', 'Unit',
  'Sofa', 'Cupboard', 'Wardrobe', 'Desk', 'Shelf', 'Ladder', 'Generator',
  'AC', 'Fan', 'Water Cooler', 'Projector', 'Speaker', 'Microphone',
  'Bicycle', 'Scooter', 'Bike', 'Car', 'Van', 'Truck', 'Tractor', 'Other',
]

export const CAPACITY_UNITS = [
  { value: 'packets', label: 'Packets' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'litres', label: 'Litres' },
  { value: 'kg', label: 'Kg' },
  { value: 'units', label: 'Units' },
  { value: 'custom', label: 'Custom' },
]

/** Broad list of common UOMs offered as autocomplete suggestions.
 *  The capacity_unit field is a free-text input — this is the datalist. */
export const UOM_SUGGESTIONS = [
  // Count / generic
  'Units', 'Pieces', 'Nos', 'Sets', 'Pairs', 'Items',
  // Packaging
  'Packets', 'Boxes', 'Cases', 'Cartons', 'Bags', 'Bundles', 'Rolls', 'Pallets', 'Crates',
  // Weight
  'Kg', 'g', 'Tonnes', 'MT', 'Lbs', 'Quintal',
  // Volume / liquid
  'Litres', 'mL', 'kL', 'Gallons',
  // Area / length
  'Sq ft', 'Sq m', 'Sq yard', 'm', 'ft', 'Inches', 'Feet',
  // Time-based (for capacity-per-period)
  'Hours', 'Days', 'Slots',
  // Industry specific
  'Cylinders', 'Racks', 'Tanks', 'Trays', 'Drums', 'Cans', 'Vans', 'Seats', 'Tables', 'Chairs',
]

export type CategoryFieldConfig = {
  assetTypes: { value: string; label: string }[]
  capacityUnits: { value: string; label: string }[]
  showCapacity: boolean
  showWeight: boolean
  showExtraQtyCharge: boolean
  showExtraWeightCharge: boolean
  /** Section / Row / Rack number — dairy & storage warehouses */
  showRackLocation: boolean
  capacitySectionTitle: string
  labels: {
    namePlaceholder: string
    descriptionPlaceholder: string
    capacity: string
    unit: string
    location: string
    locationPlaceholder: string
  }
  defaults: {
    asset_type: string
    capacity_max: string
    capacity_unit: string
    max_weight: string
  }
}

export const CATEGORY_FIELD_CONFIG: Record<string, CategoryFieldConfig> = {
  milk_dairy: {
    assetTypes: [
      { value: 'storage_rack', label: 'Storage Rack' },
      { value: 'cold_storage', label: 'Cold Storage Bay' },
      { value: 'other', label: 'Other' },
    ],
    capacityUnits: [
      { value: 'packets', label: 'Packets' },
      { value: 'boxes', label: 'Boxes' },
      { value: 'litres', label: 'Litres' },
    ],
    showCapacity: true,
    showWeight: true,
    showExtraQtyCharge: true,
    showExtraWeightCharge: true,
    showRackLocation: true,
    capacitySectionTitle: 'Rack Capacity & Weight',
    labels: {
      namePlaceholder: 'Dairy Rack A-001',
      descriptionPlaceholder: 'Heavy-duty dairy storage rack suitable for milk packets…',
      capacity: 'Max Quantity',
      unit: 'UOM',
      location: 'Warehouse Location',
      locationPlaceholder: 'Dairy Warehouse – Hyderabad',
    },
    defaults: { asset_type: 'Storage Rack', capacity_max: '100', capacity_unit: 'Packets', max_weight: '500' },
  },
  furniture: {
    assetTypes: [
      { value: 'chair', label: 'Chair' },
      { value: 'table', label: 'Table' },
      { value: 'bed', label: 'Bed' },
      { value: 'sofa', label: 'Sofa' },
      { value: 'other', label: 'Other' },
    ],
    capacityUnits: [
      { value: 'units', label: 'Units' },
      { value: 'sets', label: 'Sets' },
    ],
    showCapacity: true,
    showWeight: false,
    showExtraQtyCharge: true,
    showExtraWeightCharge: false,
    showRackLocation: false,
    capacitySectionTitle: 'Quantity Available',
    labels: {
      namePlaceholder: 'Office Chair – Ergonomic',
      descriptionPlaceholder: 'Comfortable office chair for events or offices…',
      capacity: 'Quantity',
      unit: 'UOM',
      location: 'Pickup / Storage Location',
      locationPlaceholder: 'Warehouse – Furniture Bay',
    },
    defaults: { asset_type: 'Chair', capacity_max: '50', capacity_unit: 'Units', max_weight: '' },
  },
  equipment: {
    assetTypes: [
      { value: 'refrigerator', label: 'Refrigerator' },
      { value: 'machine', label: 'Machine' },
      { value: 'generator', label: 'Generator' },
      { value: 'tool', label: 'Tool' },
      { value: 'other', label: 'Other' },
    ],
    capacityUnits: [
      { value: 'units', label: 'Units' },
      { value: 'machines', label: 'Machines' },
    ],
    showCapacity: true,
    showWeight: true,
    showExtraQtyCharge: false,
    showExtraWeightCharge: false,
    showRackLocation: false,
    capacitySectionTitle: 'Equipment Count & Weight',
    labels: {
      namePlaceholder: 'Commercial Refrigerator',
      descriptionPlaceholder: 'Industrial refrigerator for short-term rental…',
      capacity: 'Available Units',
      unit: 'UOM',
      location: 'Equipment Yard / Location',
      locationPlaceholder: 'Equipment Yard – Block B',
    },
    defaults: { asset_type: 'Refrigerator', capacity_max: '5', capacity_unit: 'Units', max_weight: '200' },
  },
  storage: {
    assetTypes: [
      { value: 'storage_rack', label: 'Storage Rack' },
      { value: 'storage_unit', label: 'Storage Unit' },
      { value: 'locker', label: 'Locker' },
      { value: 'other', label: 'Other' },
    ],
    capacityUnits: [
      { value: 'units', label: 'Units' },
      { value: 'boxes', label: 'Boxes' },
      { value: 'sqft', label: 'Sq Ft' },
      { value: 'custom', label: 'Custom' },
    ],
    showCapacity: true,
    showWeight: true,
    showExtraQtyCharge: true,
    showExtraWeightCharge: true,
    showRackLocation: true,
    capacitySectionTitle: 'Storage Capacity & Weight',
    labels: {
      namePlaceholder: 'Storage Unit S-12',
      descriptionPlaceholder: 'Secure storage unit for short or long term…',
      capacity: 'Max Quantity',
      unit: 'UOM',
      location: 'Facility Location',
      locationPlaceholder: 'Storage Facility – Hyderabad',
    },
    defaults: { asset_type: 'Storage Unit', capacity_max: '50', capacity_unit: 'Boxes', max_weight: '1000' },
  },
  vehicles: {
    assetTypes: [
      { value: 'cab', label: 'Cab / Car' },
      { value: 'van', label: 'Van' },
      { value: 'truck', label: 'Truck' },
      { value: 'bike', label: 'Bike' },
      { value: 'other', label: 'Other' },
    ],
    capacityUnits: [
      { value: 'units', label: 'Vehicles' },
      { value: 'seats', label: 'Seats' },
    ],
    showCapacity: true,
    showWeight: false,
    showExtraQtyCharge: false,
    showExtraWeightCharge: false,
    showRackLocation: false,
    capacitySectionTitle: 'Fleet Quantity',
    labels: {
      namePlaceholder: 'Cab – Sedan',
      descriptionPlaceholder: 'AC sedan available for daily / monthly rental…',
      capacity: 'Vehicles Available',
      unit: 'UOM',
      location: 'Garage / Stand Location',
      locationPlaceholder: 'Madhapur Stand',
    },
    defaults: { asset_type: 'Cab / Car', capacity_max: '1', capacity_unit: 'Vehicles', max_weight: '' },
  },
  other: {
    assetTypes: [
      { value: 'unit', label: 'Unit' },
      { value: 'other', label: 'Other' },
    ],
    capacityUnits: CAPACITY_UNITS,
    showCapacity: true,
    showWeight: true,
    showExtraQtyCharge: true,
    showExtraWeightCharge: true,
    showRackLocation: false,
    capacitySectionTitle: 'Capacity & Weight',
    labels: {
      namePlaceholder: 'Rental asset name',
      descriptionPlaceholder: 'Describe this rental asset…',
      capacity: 'Max Quantity',
      unit: 'UOM',
      location: 'Location',
      locationPlaceholder: 'Location',
    },
    defaults: { asset_type: 'Unit', capacity_max: '1', capacity_unit: 'Units', max_weight: '' },
  },
}

/** Convert a stored slug or label to a human-readable display value.
 *  'milk_dairy' → 'Milk Dairy', 'storage_rack' → 'Storage Rack', 'packets' → 'Packets'. */
export function toReadableValue(raw: string, suggestions: string[]): string {
  if (!raw) return ''
  // Already looks like a label (starts uppercase, no underscores)
  if (/^[A-Z]/.test(raw) && !raw.includes('_')) return raw
  const normalised = raw.toLowerCase().replace(/_/g, ' ')
  const match = suggestions.find((s) => s.toLowerCase() === normalised)
  return match ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getCategoryConfig(category?: string): CategoryFieldConfig {
  if (!category) return CATEGORY_FIELD_CONFIG.other
  // Direct slug match (legacy stored values)
  if (CATEGORY_FIELD_CONFIG[category]) return CATEGORY_FIELD_CONFIG[category]
  // Try converting label → slug: "Milk Dairy" → "milk_dairy"
  const slug = category.toLowerCase().replace(/[\s/&]+/g, '_').replace(/[^a-z_]/g, '')
  return CATEGORY_FIELD_CONFIG[slug] || CATEGORY_FIELD_CONFIG.other
}

export const ASSET_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'partially_occupied', label: 'Partially Occupied' },
  { value: 'fully_occupied', label: 'Fully Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'unavailable', label: 'Temporarily Unavailable' },
  { value: 'retired', label: 'Retired' },
]

/** Sticky-bar catalog lifecycle (same as products). */
export const ASSET_CATALOG_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
] as const

const OPERATIONAL_STATUS_SET = new Set(ASSET_STATUSES.map((s) => s.value))

/** Map API asset → sticky-bar Active / Draft / Archived. */
export function catalogStatusFromAsset(a: { status?: string | null; is_active?: boolean | null }): string {
  const s = String(a.status || '')
  if (s === 'retired' || s === 'archived') return 'archived'
  if (s === 'draft' || a.is_active === false) return 'draft'
  if (s === 'active') return 'active'
  return 'active'
}

/** Preserve occupancy / ops status when loading for edit. */
export function operationalStatusFromAsset(a: { status?: string | null }): string {
  const s = String(a.status || 'available')
  if (OPERATIONAL_STATUS_SET.has(s)) return s
  if (s === 'archived') return 'retired'
  if (s === 'draft') return 'unavailable'
  return 'available'
}

/** Map sticky-bar catalog status back to API status + is_active. */
export function resolveAssetStatusForSave(
  catalog: string,
  operational: string,
): { status: string; is_active: boolean } {
  if (catalog === 'archived') return { status: 'retired', is_active: false }
  if (catalog === 'draft') {
    const op =
      OPERATIONAL_STATUS_SET.has(operational) && operational !== 'retired'
        ? operational
        : 'unavailable'
    return { status: op, is_active: false }
  }
  const op =
    OPERATIONAL_STATUS_SET.has(operational) && operational !== 'retired'
      ? operational
      : 'available'
  return { status: op, is_active: true }
}

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
]

export const DELIVERY_STATUSES = [
  { value: 'not_required', label: 'Not Required' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Van Assigned' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'return_scheduled', label: 'Return Scheduled' },
  { value: 'returned', label: 'Returned' },
]

export type RentalAssetUnit = {
  id: string
  asset_id: string
  vendor_id: string
  serial_no: string
  label?: string | null
  /** good | damaged | lost | retired */
  condition: string
  /** available | rented | maintenance | retired */
  status: string
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type RentalBookingUnit = {
  id: string
  booking_id: string
  unit_id: string
  serial_no: string
  label?: string | null
  /** good | damaged | lost | retired */
  condition: string
  /** rented | available | maintenance | retired */
  status: string
  assigned_at: string
  released_at?: string | null
  assigned_by?: string | null
  notes?: string | null
}

export type RentalReturn = {
  id: string
  booking_id: string
  quantity_returned: number
  /** good | damaged | missing */
  return_condition: string
  damage_charge: number
  late_fee: number
  deposit_refunded: number
  return_notes?: string | null
  unit_ids: string[]
  returned_at: string
}

export type RentalMediaItem = {
  id: string
  url: string
  media_type: 'image' | 'video' | 'model3d'
  is_primary: boolean
  alt_text?: string
  position: number
}

/** True for media staged locally before the asset exists on the server. */
export function isPendingRentalMediaId(id: string): boolean {
  return id.startsWith('pending-')
}

export function detectRentalMediaType(file: File): RentalMediaItem['media_type'] {
  if (file.type.startsWith('video/')) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'glb' || ext === 'gltf') return 'model3d'
  return 'image'
}

/** Build a local preview item; caller must keep the File in a Map keyed by `id`. */
export function makePendingRentalMedia(
  file: File,
  position: number,
  makePrimary: boolean,
): RentalMediaItem {
  return {
    id: `pending-${crypto.randomUUID()}`,
    url: URL.createObjectURL(file),
    media_type: detectRentalMediaType(file),
    is_primary: makePrimary,
    alt_text: file.name,
    position,
  }
}

export function revokeRentalMediaUrls(items: RentalMediaItem[]) {
  for (const item of items) {
    if (isPendingRentalMediaId(item.id) && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
    }
  }
}

export type RentalAsset = {
  id: string
  name: string
  asset_code?: string
  /** Asset kind / form preset (milk_dairy | furniture | equipment | storage | vehicles | other) */
  category?: string
  /** Merchandising category UUID from vendor_category tree */
  category_id?: string | null
  asset_type?: string
  short_description?: string | null
  description?: string
  product_id?: string | null
  capacity_max?: number
  capacity_unit?: string
  current_occupancy?: number
  damaged_qty?: number
  lost_qty?: number
  available_capacity?: number
  // Sub-asset / unit tracking
  parent_asset_id?: string | null
  is_bookable?: boolean
  /** none | hierarchy | serialized */
  unit_mode?: string
  /** Number of direct child assets (hierarchy mode) */
  child_count?: number
  /** How many child assets currently have free capacity */
  available_child_count?: number
  /** Number of serialized units (serialized mode) */
  unit_count?: number
  max_weight?: number | null
  weight_unit?: string
  /** ISO 4217 currency code for rates (default INR). */
  currency?: string
  daily_rate?: number
  weekly_rate?: number
  monthly_rate?: number
  deposit_amount?: number
  extra_qty_charge?: number
  extra_weight_charge?: number
  /** Named extras: [{ name, description, charge_type, show_mode, value }] */
  additional_charges?: {
    id?: string
    name: string
    description?: string
    charge_type: 'amount' | 'percent'
    show_mode?: 'independent' | 'together'
    percent_of?: 'rental' | 'running' | 'grand' | 'deposit'
    value: number
  }[]
  /** Rate charged per capacity_unit per rental period (e.g. ₹10 per packet/day). */
  price_per_unit?: number
  /** Custom UOM label for per-unit pricing if different from capacity_unit. */
  pricing_uom?: string | null
  /** Extended time-plan rates */
  hourly_rate?: number
  per_minute_rate?: number
  yearly_rate?: number
  /** Minute/hour slots: [{ minutes: 15, rate: 50 }, { minutes: 120, rate: 200 }] */
  duration_rates?: { minutes: number; rate: number }[]
  /** Day/week/month/year slots: [{ days: 1, rate: 100 }, { days: 14, rate: 800 }] */
  period_rates?: { days: number; rate: number }[]
  /** Tax % applied on rental rates (e.g. GST 18). */
  tax_rate?: number
  sales_area_id?: string | null
  location?: string
  section?: string
  row_label?: string
  rack_number?: string
  image_url?: string
  media?: RentalMediaItem[]
  status?: string
  display_start_date?: string | null
  display_end_date?: string | null
  is_active?: boolean
  is_visible?: boolean
  store_scope?: string
  store_ids?: string[]
  notes?: string
  /** Customer-facing delivery / booking note on storefront */
  delivery_info?: string | null
  /** When true, storefront shows "Need delivery" on booking */
  delivery_enabled?: boolean
}

export type RentalBooking = {
  id: string
  booking_number?: string
  asset_id: string
  asset_name?: string
  asset_code?: string
  asset_location?: string
  capacity_unit?: string
  capacity_max?: number
  /** none | hierarchy | serialized — from the asset */
  unit_mode?: string
  customer_id?: string | null
  sales_area_id?: string | null
  customer_name: string
  customer_email?: string
  customer_phone?: string
  quantity?: number
  weight_requested?: number | null
  pricing_plan?: string
  start_date: string
  end_date: string
  status: string
  rental_amount?: number
  deposit_amount?: number
  total_amount?: number
  payment_status?: string
  payment_method?: string
  payment_reference?: string
  delivery_status?: string
  van_number?: string
  van_driver_name?: string
  van_driver_phone?: string
  van_vehicle_type?: string
  estimated_delivery_at?: string
  delivered_at?: string
  delivery_notes?: string
  delivery_address?: string
  // Return tracking
  returned_at?: string | null
  quantity_returned?: number | null
  outstanding_quantity?: number
  return_condition?: string | null
  damage_charge?: number
  late_fee?: number
  deposit_refunded?: number
  return_notes?: string | null
  timeline?: Array<{ event: string; detail?: string; at?: string }>
  notes?: string
}

export function statusBadgeClass(status?: string): string {
  const map: Record<string, string> = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    partially_occupied: 'bg-amber-50 text-amber-700 border-amber-200',
    fully_occupied: 'bg-rose-50 text-rose-700 border-rose-200',
    reserved: 'bg-sky-50 text-sky-700 border-sky-200',
    maintenance: 'bg-orange-50 text-orange-700 border-orange-200',
    unavailable: 'bg-gray-100 text-gray-600 border-gray-200',
    retired: 'bg-gray-100 text-gray-500 border-gray-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-blue-50 text-blue-700 border-blue-200',
    confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-gray-100 text-gray-600 border-gray-200',
    cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
    rejected: 'bg-rose-50 text-rose-600 border-rose-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    unpaid: 'bg-rose-50 text-rose-600 border-rose-200',
    in_transit: 'bg-sky-50 text-sky-700 border-sky-200',
    assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return map[status || ''] || 'bg-gray-50 text-gray-600 border-gray-200'
}

export const AVAILABILITY_OPTIONS = [
  { value: 'always', label: 'Always available' },
  { value: 'date_range', label: 'Date range' },
]

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SAR: '﷼',
  SGD: 'S$',
  JPY: '¥',
}

export const CURRENCY_SELECT_OPTIONS = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'AED', label: 'AED' },
  { value: 'SAR', label: 'SAR' },
  { value: 'SGD', label: 'S$ SGD' },
  { value: 'JPY', label: '¥ JPY' },
]

export function currencySymbol(code?: string | null): string {
  const key = (code || 'INR').toUpperCase()
  return CURRENCY_SYMBOLS[key] || key
}

export const emptyAssetForm = () => ({
  name: '',
  /** Asset kind / form preset (kept for API; not shown on Basics) */
  category: 'Other',
  /** Merchandising category UUID */
  category_id: '' as string,
  asset_type: '',
  short_description: '',
  description: '',
  /** Master ID — blank on create → server auto-assigns AST-00N (optional manual before save) */
  asset_code: '',
  product_id: '' as string,
  capacity_max: '1',
  capacity_unit: 'Units',
  max_weight: '',
  weight_unit: 'kg',
  currency: 'INR',
  daily_rate: '0',
  weekly_rate: '0',
  monthly_rate: '0',
  // Keep deposit low for dairy demo (credit gate uses total = rental + deposit)
  deposit_amount: '0',
  extra_qty_charge: '0',
  extra_weight_charge: '0',
  additional_charges: [] as {
    id: string
    name: string
    description: string
    charge_type: 'amount' | 'percent'
    show_mode: 'independent' | 'together'
    percent_of: 'rental' | 'running' | 'grand' | 'deposit'
    value: string
  }[],
  sales_area_id: '',
  location: '',
  section: '',
  row_label: '',
  rack_number: '',
  /** Catalog lifecycle for sticky bar: active | draft | archived */
  status: 'active',
  /** Occupancy / ops status sent to API (available, maintenance, …) */
  operational_status: 'available',
  /** always = no storefront date window; date_range = use start/end */
  availability_mode: 'always' as 'always' | 'date_range',
  display_start_date: '',
  display_end_date: '',
  notes: '',
  /** Customer-facing delivery / booking note on storefront (empty = hidden) */
  delivery_info: '',
  delivery_enabled: false as boolean,
  /** none | hierarchy | serialized */
  unit_mode: 'none' as string,
  parent_asset_id: '' as string,
  is_bookable: true as boolean,
  is_visible: true as boolean,
  store_scope: 'all' as string,
  store_ids: [] as string[],
  price_per_unit: '0',
  pricing_uom: '',
  hourly_rate: '0',
  per_minute_rate: '0',
  yearly_rate: '0',
  duration_rates: [] as { minutes: number; rate: string }[],
  period_rates: [] as { days: number; rate: string }[],
  tax_rate: '0',
})
