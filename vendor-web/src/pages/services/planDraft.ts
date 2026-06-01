import { DEFAULT_AVAILABILITY, VARIANT_ACCENT_PALETTE } from './serviceCatalogConstants'

export interface AvailSlot {
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

export interface PlanDraft {
  _key: string
  name: string
  description: string
  color?: string
  price: string
  uom: string
  price_type: string
  subscription_interval: string
  subscription_trial_days: string
  subscription_setup_fee: string
  subscription_billing_cycles: string
  subscription_schedule_modes: string[]
  duration_minutes: string
  is_active: boolean
  enable_pricing: boolean
  enable_tax: boolean
  enable_booking: boolean
  enable_availability: boolean
  enable_lifecycle: boolean
  service_frequency: string
  service_mode: string
  buffer_minutes: string
  service_capacity: string
  plan_price_type: string
  price_min: string
  price_max: string
  compare_at_price: string
  cost_price: string
  currency: string
  discount_percentage: string
  discount_amount: string
  offer_label: string
  discount_start_date: string
  discount_end_date: string
  is_taxable: boolean
  tax_rate: string
  sac_code: string
  gst_rate: string
  requires_booking: boolean
  max_bookings_per_slot: string
  advance_booking_days: string
  booking_lead_time_value: string
  booking_lead_time_unit: string
  cancellation_policy: string
  cancellation_hours: string
  rescheduling_policy: string
  no_show_policy: string
  availability: AvailSlot[]
  service_expiry_date: string
  validity_period_days: string
  renewal_required: boolean
}

export function newPlan(i: number): PlanDraft {
  return {
    _key: `plan-${Date.now()}-${i}`,
    name: `Plan ${i + 1}`,
    description: '',
    color: VARIANT_ACCENT_PALETTE[i % VARIANT_ACCENT_PALETTE.length],
    price: '',
    uom: 'per_session',
    price_type: 'per_cycle',
    subscription_interval: 'monthly',
    subscription_trial_days: '',
    subscription_setup_fee: '',
    subscription_billing_cycles: '',
    subscription_schedule_modes: ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring'],
    duration_minutes: '',
    is_active: true,
    enable_pricing: true,
    enable_tax: false,
    enable_booking: false,
    enable_availability: false,
    enable_lifecycle: false,
    service_frequency: 'once',
    service_mode: 'in_store',
    buffer_minutes: '0',
    service_capacity: '1',
    plan_price_type: 'fixed',
    price_min: '',
    price_max: '',
    compare_at_price: '',
    cost_price: '',
    currency: 'INR',
    discount_percentage: '',
    discount_amount: '',
    offer_label: '',
    discount_start_date: '',
    discount_end_date: '',
    is_taxable: true,
    tax_rate: '',
    sac_code: '',
    gst_rate: '',
    requires_booking: true,
    max_bookings_per_slot: '1',
    advance_booking_days: '30',
    booking_lead_time_value: '',
    booking_lead_time_unit: 'hours',
    cancellation_policy: '',
    cancellation_hours: '',
    rescheduling_policy: '',
    no_show_policy: '',
    availability: [...DEFAULT_AVAILABILITY],
    service_expiry_date: '',
    validity_period_days: '',
    renewal_required: false,
  }
}
