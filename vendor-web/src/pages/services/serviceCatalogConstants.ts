export const VARIANT_ACCENT_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
]

export { UOM_OPTIONS, UOM_GROUPS, formatUomDisplay, uomLabel } from '@/lib/uomOptions'

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
  { value: 'in_store', label: 'In Store' },
  { value: 'shop', label: 'Shop' },
  { value: 'home_visit', label: 'Home Visit' },
  { value: 'both', label: 'In Store & Home Visit' },
  { value: 'online', label: 'Online' },
  { value: 'remote', label: 'Remote' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'office', label: 'Office' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'salon', label: 'Salon' },
  { value: 'spa', label: 'Spa' },
  { value: 'studio', label: 'Studio' },
  { value: 'lab', label: 'Lab' },
  { value: 'diagnostic_center', label: 'Diagnostic Center' },
  { value: 'gym', label: 'Gym' },
  { value: 'fitness_center', label: 'Fitness Center' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'garage', label: 'Garage' },
  { value: 'on_site', label: 'On-site' },
  { value: 'field', label: 'Field' },
  { value: 'co_working', label: 'Co-working Space' },
  { value: 'event_venue', label: 'Event Venue' },
  { value: 'hall', label: 'Hall' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'school', label: 'School' },
  { value: 'training_center', label: 'Training Center' },
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
