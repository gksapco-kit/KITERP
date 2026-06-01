export const VARIANT_ACCENT_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
]

export const UOM_OPTIONS: { value: string; label: string; group: string }[] = [
  // Count
  { value: 'piece', label: 'Piece (pc)', group: 'Count' },
  { value: 'unit', label: 'Unit', group: 'Count' },
  { value: 'pair', label: 'Pair', group: 'Count' },
  { value: 'dozen', label: 'Dozen (12)', group: 'Count' },
  { value: 'gross', label: 'Gross (144)', group: 'Count' },
  { value: 'set', label: 'Set', group: 'Count' },
  { value: 'pack', label: 'Pack', group: 'Count' },
  { value: 'bundle', label: 'Bundle', group: 'Count' },
  { value: 'box', label: 'Box', group: 'Count' },
  { value: 'case', label: 'Case', group: 'Count' },
  { value: 'carton', label: 'Carton', group: 'Count' },
  { value: 'pallet', label: 'Pallet', group: 'Count' },
  { value: 'roll', label: 'Roll', group: 'Count' },
  { value: 'sheet', label: 'Sheet', group: 'Count' },
  { value: 'bag', label: 'Bag', group: 'Count' },
  { value: 'bottle', label: 'Bottle', group: 'Count' },
  { value: 'can', label: 'Can', group: 'Count' },
  { value: 'jar', label: 'Jar', group: 'Count' },
  { value: 'tube', label: 'Tube', group: 'Count' },
  { value: 'sachet', label: 'Sachet', group: 'Count' },
  { value: 'pouch', label: 'Pouch', group: 'Count' },
  // Weight
  { value: 'mg', label: 'Milligram (mg)', group: 'Weight' },
  { value: 'g', label: 'Gram (g)', group: 'Weight' },
  { value: 'kg', label: 'Kilogram (kg)', group: 'Weight' },
  { value: 'tonne', label: 'Metric Ton (t)', group: 'Weight' },
  { value: 'oz', label: 'Ounce (oz)', group: 'Weight' },
  { value: 'lb', label: 'Pound (lb)', group: 'Weight' },
  { value: 'quintal', label: 'Quintal (100 kg)', group: 'Weight' },
  // Volume
  { value: 'ml', label: 'Millilitre (ml)', group: 'Volume' },
  { value: 'cl', label: 'Centilitre (cl)', group: 'Volume' },
  { value: 'l', label: 'Litre (L)', group: 'Volume' },
  { value: 'kl', label: 'Kilolitre (kL)', group: 'Volume' },
  { value: 'fl_oz', label: 'Fluid Ounce (fl oz)', group: 'Volume' },
  { value: 'pt', label: 'Pint (pt)', group: 'Volume' },
  { value: 'qt', label: 'Quart (qt)', group: 'Volume' },
  { value: 'gal', label: 'Gallon (gal)', group: 'Volume' },
  { value: 'cup', label: 'Cup', group: 'Volume' },
  { value: 'tbsp', label: 'Tablespoon (tbsp)', group: 'Volume' },
  // Length
  { value: 'mm', label: 'Millimetre (mm)', group: 'Length' },
  { value: 'cm', label: 'Centimetre (cm)', group: 'Length' },
  { value: 'm', label: 'Metre (m)', group: 'Length' },
  { value: 'km', label: 'Kilometre (km)', group: 'Length' },
  { value: 'in', label: 'Inch (in)', group: 'Length' },
  { value: 'ft', label: 'Foot (ft)', group: 'Length' },
  { value: 'yd', label: 'Yard (yd)', group: 'Length' },
  // Area
  { value: 'sq_m', label: 'Square Metre (m²)', group: 'Area' },
  { value: 'sq_ft', label: 'Square Foot (ft²)', group: 'Area' },
  { value: 'sq_yd', label: 'Square Yard (yd²)', group: 'Area' },
  { value: 'acre', label: 'Acre', group: 'Area' },
  { value: 'hectare', label: 'Hectare (ha)', group: 'Area' },
  // Time / Service
  { value: 'hour', label: 'Hour (hr)', group: 'Time' },
  { value: 'day', label: 'Day', group: 'Time' },
  { value: 'week', label: 'Week', group: 'Time' },
  { value: 'month', label: 'Month', group: 'Time' },
  { value: 'year', label: 'Year', group: 'Time' },
  { value: 'session', label: 'Session', group: 'Time' },
  { value: 'per_session', label: 'Per Session', group: 'Time' },
  // Energy / Power
  { value: 'watt', label: 'Watt (W)', group: 'Energy' },
  { value: 'kw', label: 'Kilowatt (kW)', group: 'Energy' },
  { value: 'kwh', label: 'Kilowatt-Hour (kWh)', group: 'Energy' },
  // Data
  { value: 'mb', label: 'Megabyte (MB)', group: 'Data' },
  { value: 'gb', label: 'Gigabyte (GB)', group: 'Data' },
  { value: 'tb', label: 'Terabyte (TB)', group: 'Data' },
]

export const UOM_GROUPS = [...new Set(UOM_OPTIONS.map(u => u.group))]

export const SUBSCRIPTION_INTERVALS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
]

export const SCHEDULE_MODE_OPTIONS = [
  { value: 'dates', label: 'Date Range' },
  { value: 'cycles', label: 'Billing Cycles' },
  { value: 'pick_dates', label: 'Pick Dates' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'recurring', label: 'Recurring' },
]

export const SERVICE_TYPE_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'repair', label: 'Repair' },
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'training', label: 'Training' },
  { value: 'assessment', label: 'Assessment' },
]

export const SERVICE_MODE_OPTIONS = [
  { value: 'in_store', label: 'In Store / Shop' },
  { value: 'home_visit', label: 'Home Visit' },
  { value: 'both', label: 'In Store & Home Visit' },
  { value: 'online', label: 'Online / Remote' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'office', label: 'Office' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'salon', label: 'Salon / Spa' },
  { value: 'studio', label: 'Studio' },
  { value: 'lab', label: 'Lab / Diagnostic Center' },
  { value: 'gym', label: 'Gym / Fitness Center' },
  { value: 'restaurant', label: 'Restaurant / Kitchen' },
  { value: 'workshop', label: 'Workshop / Garage' },
  { value: 'field', label: 'On-site / Field' },
  { value: 'co_working', label: 'Co-working Space' },
  { value: 'event_venue', label: 'Event Venue / Hall' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'school', label: 'School / Training Center' },
  { value: 'other', label: 'Other' },
]

export const DEFAULT_AVAILABILITY = [
  { day_of_week: 0, start_time: '09:00', end_time: '18:00', is_available: true },
  { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_available: true },
  { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_available: true },
  { day_of_week: 3, start_time: '09:00', end_time: '18:00', is_available: true },
  { day_of_week: 4, start_time: '09:00', end_time: '18:00', is_available: true },
  { day_of_week: 5, start_time: '10:00', end_time: '16:00', is_available: true },
  { day_of_week: 6, start_time: '09:00', end_time: '18:00', is_available: false },
]

export const LEAD_TIME_UNITS = [
  { value: 'minutes', label: 'Minutes', toHours: 1 / 60 },
  { value: 'hours', label: 'Hours', toHours: 1 },
  { value: 'days', label: 'Days', toHours: 24 },
  { value: 'weeks', label: 'Weeks', toHours: 168 },
  { value: 'months', label: 'Months', toHours: 720 },
]

export const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
