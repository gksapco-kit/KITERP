export const RENTAL_CATEGORIES = [
  { value: 'milk_dairy', label: 'Milk Dairy' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'storage', label: 'Storage' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'other', label: 'Other' },
]

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

export const CAPACITY_UNITS = [
  { value: 'packets', label: 'Packets' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'litres', label: 'Litres' },
  { value: 'kg', label: 'Kg' },
  { value: 'units', label: 'Units' },
  { value: 'custom', label: 'Custom' },
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
      capacity: 'Max Capacity',
      unit: 'UOM',
      location: 'Warehouse Location',
      locationPlaceholder: 'Dairy Warehouse – Hyderabad',
    },
    defaults: { asset_type: 'storage_rack', capacity_max: '100', capacity_unit: 'packets', max_weight: '500' },
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
    defaults: { asset_type: 'chair', capacity_max: '50', capacity_unit: 'units', max_weight: '' },
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
    defaults: { asset_type: 'refrigerator', capacity_max: '5', capacity_unit: 'units', max_weight: '200' },
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
      capacity: 'Max Capacity',
      unit: 'UOM',
      location: 'Facility Location',
      locationPlaceholder: 'Storage Facility – Hyderabad',
    },
    defaults: { asset_type: 'storage_unit', capacity_max: '50', capacity_unit: 'boxes', max_weight: '1000' },
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
    defaults: { asset_type: 'cab', capacity_max: '1', capacity_unit: 'units', max_weight: '' },
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
      capacity: 'Max Capacity',
      unit: 'UOM',
      location: 'Location',
      locationPlaceholder: 'Location',
    },
    defaults: { asset_type: 'unit', capacity_max: '1', capacity_unit: 'units', max_weight: '' },
  },
}

export function getCategoryConfig(category?: string): CategoryFieldConfig {
  return CATEGORY_FIELD_CONFIG[category || ''] || CATEGORY_FIELD_CONFIG.other
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

export type RentalAsset = {
  id: string
  name: string
  asset_code?: string
  category?: string
  asset_type?: string
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
  max_weight?: number | null
  weight_unit?: string
  daily_rate?: number
  weekly_rate?: number
  monthly_rate?: number
  deposit_amount?: number
  extra_qty_charge?: number
  extra_weight_charge?: number
  /** Rate charged per capacity_unit per rental period (e.g. ₹10 per packet/day). */
  price_per_unit?: number
  /** Custom UOM label for per-unit pricing if different from capacity_unit. */
  pricing_uom?: string | null
  /** Extended time-plan rates */
  hourly_rate?: number
  per_minute_rate?: number
  yearly_rate?: number
  sales_area_id?: string | null
  location?: string
  section?: string
  row_label?: string
  rack_number?: string
  image_url?: string
  status?: string
  display_start_date?: string | null
  display_end_date?: string | null
  is_active?: boolean
  notes?: string
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

export const emptyAssetForm = () => ({
  name: '',
  category: 'milk_dairy',
  asset_type: 'storage_rack',
  description: '',
  capacity_max: '100',
  capacity_unit: 'packets',
  max_weight: '500',
  weight_unit: 'kg',
  daily_rate: '500',
  weekly_rate: '3000',
  monthly_rate: '10000',
  // Keep deposit low for dairy demo (credit gate uses total = rental + deposit)
  deposit_amount: '0',
  extra_qty_charge: '0',
  extra_weight_charge: '0',
  sales_area_id: '',
  location: '',
  section: '',
  row_label: '',
  rack_number: '',
  status: 'available',
  /** always = no storefront date window; date_range = use start/end */
  availability_mode: 'always' as 'always' | 'date_range',
  display_start_date: '',
  display_end_date: '',
  notes: '',
  /** none | hierarchy | serialized */
  unit_mode: 'none' as string,
  parent_asset_id: '' as string,
  is_bookable: true as boolean,
  price_per_unit: '0',
  pricing_uom: '',
  hourly_rate: '0',
  per_minute_rate: '0',
  yearly_rate: '0',
})
