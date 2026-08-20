export type RegistrationFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'heading'
  | 'terms'
  | 'image'

export type RegistrationField = {
  id: string
  key: string
  label: string
  type: RegistrationFieldType
  required: boolean
  placeholder?: string
  help?: string
  content?: string
  options?: string[]
}

export type RegistrationTheme = {
  accent: string
  layout: 'card' | 'split' | 'minimal'
  cover_title?: string
  cover_subtitle?: string
  logo_url?: string
  company_name?: string
  company_phone?: string
  company_address?: string
}

export type RegistrationFormRecord = {
  id: string
  name: string
  description?: string
  template_key?: string
  status: 'draft' | 'published'
  version: number
  fields: RegistrationField[]
  theme: RegistrationTheme
  use_on_storefront: boolean
  use_on_staff_booking: boolean
  submission_count?: number
  created_at?: string | null
  updated_at?: string | null
}

export type RegistrationTemplate = {
  key: string
  name: string
  tagline: string
  description: string
  accent: string
  layout: RegistrationTheme['layout']
  cover_title: string
  cover_subtitle: string
  company_name?: string
  company_phone?: string
  company_address?: string
  logo_url?: string
  badge?: 'Popular' | 'New'
  icon: 'shield' | 'car' | 'party' | 'wrench' | 'home' | 'wallet' | 'sparkles'
  fields: Omit<RegistrationField, 'id'>[]
}

function field(
  partial: Pick<RegistrationField, 'key' | 'label' | 'type'> & Partial<Omit<RegistrationField, 'id' | 'key' | 'label' | 'type'>>,
): Omit<RegistrationField, 'id'> {
  return {
    key: partial.key,
    label: partial.label,
    type: partial.type,
    required: partial.required ?? false,
    placeholder: partial.placeholder ?? '',
    help: partial.help ?? '',
    content: partial.content ?? '',
    options: partial.options ?? [],
  }
}

/** Modern starter templates for rental intake (Google Forms-style). */
export const REGISTRATION_TEMPLATES: RegistrationTemplate[] = [
  {
    key: 'renter_kyc',
    name: 'Renter KYC',
    tagline: 'Identity & emergency contact',
    description: 'A polished identity form — name, ID proof and emergency contact before handover.',
    accent: '#0f766e',
    layout: 'card',
    badge: 'Popular',
    icon: 'shield',
    cover_title: 'Renter registration',
    cover_subtitle: 'A few details so we can confirm your booking and keep the rental secure.',
    fields: [
      field({ key: 'full_name', label: 'Full name', type: 'text', required: true, placeholder: 'Name as on ID' }),
      field({ key: 'phone', label: 'Mobile number', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@email.com' }),
      field({ key: 'date_of_birth', label: 'Date of birth', type: 'date' }),
      field({
        key: 'id_type',
        label: 'ID type',
        type: 'select',
        required: true,
        options: ['Aadhaar', 'Passport', 'Driving licence', 'Voter ID', 'Other'],
      }),
      field({ key: 'id_number', label: 'ID number', type: 'text', required: true, placeholder: 'ID / document number' }),
      field({ key: 'address', label: 'Current address', type: 'textarea', required: true, placeholder: 'House / street / city' }),
      field({ key: 'emergency_name', label: 'Emergency contact name', type: 'text', required: true }),
      field({ key: 'emergency_phone', label: 'Emergency contact phone', type: 'phone', required: true }),
      field({
        key: 'agree_terms',
        label: 'I confirm the details are accurate and I accept the rental terms',
        type: 'checkbox',
        required: true,
      }),
    ],
  },
  {
    key: 'vehicle_licence',
    name: 'Vehicle licence',
    tagline: 'Driving licence & experience',
    description: 'Cars, bikes and vans — licence class, expiry and driving experience in a split layout.',
    accent: '#4f46e5',
    layout: 'split',
    icon: 'car',
    cover_title: 'Driver verification',
    cover_subtitle: 'We need a valid licence before this vehicle can be reserved.',
    fields: [
      field({ key: 'full_name', label: 'Driver name', type: 'text', required: true, placeholder: 'Name on licence' }),
      field({ key: 'phone', label: 'Mobile number', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'licence_number', label: 'Licence number', type: 'text', required: true, placeholder: 'DL number' }),
      field({ key: 'licence_expiry', label: 'Licence expiry', type: 'date', required: true }),
      field({
        key: 'vehicle_class',
        label: 'Licence class',
        type: 'select',
        required: true,
        options: ['Two-wheeler', 'LMV / Car', 'Transport', 'Heavy vehicle'],
      }),
      field({ key: 'years_experience', label: 'Years of driving experience', type: 'number', placeholder: 'e.g. 5' }),
      field({ key: 'address', label: 'Address', type: 'textarea', required: true, placeholder: 'Current residential address' }),
      field({
        key: 'agree_terms',
        label: 'I am licensed to drive this vehicle and accept damage liability terms',
        type: 'checkbox',
        required: true,
      }),
    ],
  },
  {
    key: 'event_party',
    name: 'Event & party',
    tagline: 'Venue, guests & occasion',
    description: 'Tents, furniture and décor — occasion, guest count and venue in a card layout.',
    accent: '#7c3aed',
    layout: 'card',
    icon: 'party',
    cover_title: 'Event details',
    cover_subtitle: 'Tell us about the occasion so we can prepare the right setup.',
    fields: [
      field({ key: 'organizer_name', label: 'Organizer name', type: 'text', required: true }),
      field({ key: 'phone', label: 'Mobile number', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'event_name', label: 'Event / occasion', type: 'text', required: true, placeholder: 'Wedding, birthday, corporate…' }),
      field({ key: 'event_date', label: 'Event date', type: 'date', required: true }),
      field({ key: 'venue', label: 'Venue / address', type: 'textarea', required: true, placeholder: 'Hall / plot / city' }),
      field({ key: 'guest_count', label: 'Expected guests', type: 'number', placeholder: 'e.g. 150' }),
      field({ key: 'special_requests', label: 'Special requests', type: 'textarea', placeholder: 'Setup time, colour theme, extras…' }),
      field({
        key: 'agree_terms',
        label: 'I agree to the rental period, delivery window and damage policy',
        type: 'checkbox',
        required: true,
      }),
    ],
  },
  {
    key: 'equipment_site',
    name: 'Equipment on-site',
    tagline: 'Job site & operator',
    description: 'Tools and machines — site address, purpose and trained operator in a minimal layout.',
    accent: '#d97706',
    layout: 'minimal',
    icon: 'wrench',
    cover_title: 'Equipment registration',
    cover_subtitle: 'Who will operate this equipment, and where will it be used?',
    fields: [
      field({ key: 'company_or_name', label: 'Company / hirer name', type: 'text', required: true }),
      field({ key: 'phone', label: 'Mobile number', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'site_address', label: 'Site address', type: 'textarea', required: true, placeholder: 'Job site / plot / city' }),
      field({ key: 'purpose', label: 'Purpose of hire', type: 'textarea', required: true }),
      field({ key: 'operator_name', label: 'On-site operator', type: 'text', required: true }),
      field({ key: 'operator_phone', label: 'Operator phone', type: 'phone', required: true }),
      field({
        key: 'need_delivery',
        label: 'Need delivery to site',
        type: 'select',
        required: true,
        options: ['Yes', 'No — I will collect'],
      }),
      field({
        key: 'agree_terms',
        label: 'The operator is trained for this equipment and I accept safety terms',
        type: 'checkbox',
        required: true,
      }),
    ],
  },
  {
    key: 'guest_stay',
    name: 'Guest registration',
    tagline: '1RK suites / rooms',
    description: 'Printed guest form layout — room, personal, address, emergency, vehicle, co-living and documents.',
    accent: '#111827',
    layout: 'split',
    badge: 'New',
    icon: 'home',
    cover_title: 'Guest Registration Form',
    cover_subtitle: 'Please complete room, guest, emergency and document details for check-in.',
    company_name: 'RR 1RK SUITES',
    company_phone: '9000198919',
    company_address: '# H.No: 1-110/A/16/1 Plot No:16, Gopal Reddy Nagar, Kondapur RTO office, Serilingampally, Hyd – 500084.',
    fields: [
      field({ key: 'sec_room', label: 'Room details', type: 'heading' }),
      field({ key: 'room_no', label: 'Room no.', type: 'text', required: true, placeholder: 'e.g. 101' }),
      field({ key: 'check_in_date', label: 'Check-in date', type: 'date', required: true }),
      field({ key: 'check_out_date', label: 'Check-out date', type: 'date', required: true }),
      field({
        key: 'stay_type',
        label: 'Stay type',
        type: 'select',
        required: true,
        options: ['Daily', 'Weekly', 'Monthly', 'Co-Living'],
      }),
      field({ key: 'security_deposit', label: 'Security deposit', type: 'number', placeholder: 'Amount' }),
      field({ key: 'advance_amount', label: 'Advance amount paid', type: 'number', placeholder: 'Amount' }),
      field({ key: 'balance_due', label: 'Balance amount due', type: 'number', placeholder: 'Amount' }),
      field({
        key: 'payment_mode',
        label: 'Mode of payment',
        type: 'select',
        required: true,
        options: ['Cash', 'UPI', 'Bank Transfer'],
      }),

      field({ key: 'sec_personal', label: 'Personal details', type: 'heading' }),
      field({ key: 'full_name', label: 'Full name', type: 'text', required: true, placeholder: 'Name as on ID' }),
      field({ key: 'date_of_birth', label: 'Date of birth', type: 'date', required: true }),
      field({
        key: 'gender',
        label: 'Gender',
        type: 'select',
        required: true,
        options: ['Male', 'Female'],
      }),
      field({ key: 'occupation', label: 'Occupation', type: 'text', required: true }),
      field({ key: 'employee_id', label: 'Employee ID', type: 'text', placeholder: 'If employed' }),
      field({ key: 'company_name_address', label: 'Company name & address', type: 'textarea', placeholder: 'Company / office address' }),
      field({ key: 'mobile', label: 'Mobile no.', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'alt_mobile', label: 'Alternative mobile no.', type: 'phone', placeholder: 'Optional' }),
      field({ key: 'email', label: 'Email ID', type: 'email', required: true, placeholder: 'you@email.com' }),
      field({ key: 'aadhaar', label: 'Aadhaar no.', type: 'text', required: true, placeholder: '12-digit Aadhaar' }),

      field({ key: 'sec_address', label: 'Permanent address', type: 'heading' }),
      field({ key: 'house_no', label: 'House no. / Flat no.', type: 'text', required: true }),
      field({ key: 'street', label: 'Street / Area', type: 'text', required: true }),
      field({ key: 'city', label: 'City / District', type: 'text', required: true }),
      field({ key: 'state', label: 'State', type: 'text', required: true }),
      field({ key: 'pincode', label: 'Pincode', type: 'text', required: true, placeholder: '6-digit pincode' }),

      field({ key: 'sec_emergency', label: 'Emergency contact details', type: 'heading' }),
      field({ key: 'emergency_name', label: 'Name', type: 'text', required: true }),
      field({ key: 'emergency_relationship', label: 'Relationship', type: 'text', required: true, placeholder: 'Parent / spouse / friend' }),
      field({ key: 'emergency_mobile', label: 'Mobile number', type: 'phone', required: true }),
      field({ key: 'emergency_address', label: 'Address', type: 'textarea', required: true }),

      field({ key: 'sec_vehicle', label: 'Vehicle details (if any)', type: 'heading' }),
      field({ key: 'vehicle_type', label: 'Vehicle type', type: 'text', placeholder: 'Bike / car / scooter' }),
      field({ key: 'vehicle_number', label: 'Vehicle number', type: 'text', placeholder: 'e.g. TS 09 AB 1234' }),

      field({ key: 'sec_coliving', label: 'Co-living occupant details (if applicable)', type: 'heading' }),
      field({ key: 'second_occupant_name', label: 'Second occupant name', type: 'text' }),
      field({ key: 'second_occupant_company', label: 'Company name', type: 'text' }),
      field({ key: 'second_occupant_mobile', label: 'Mobile number', type: 'phone' }),
      field({ key: 'second_occupant_email', label: 'Email ID', type: 'email' }),
      field({ key: 'second_occupant_aadhaar', label: 'Aadhaar number', type: 'text' }),

      field({ key: 'sec_docs', label: 'Documents submitted', type: 'heading' }),
      field({ key: 'doc_aadhaar', label: 'Aadhaar card copy', type: 'checkbox' }),
      field({ key: 'doc_photo', label: 'Passport size photograph', type: 'checkbox' }),
      field({ key: 'doc_company_id', label: 'Company ID card', type: 'checkbox' }),
      field({ key: 'doc_vehicle_rc', label: 'Vehicle RC copy', type: 'checkbox' }),
      field({
        key: 'guest_photo',
        label: 'Guest photo',
        type: 'image',
        required: false,
        help: 'Optional passport-size or ID photo',
      }),
      field({
        key: 'agree_terms',
        label: 'I agree to the terms and conditions',
        type: 'terms',
        required: true,
        content:
          '1. Guests must provide accurate personal and document details at check-in.\n'
          + '2. The security deposit may be adjusted for damage, missing items, or extra stay.\n'
          + '3. House rules, visitor policy and quiet hours must be followed.\n'
          + '4. The property is not responsible for loss of personal belongings.',
      }),
    ],
  },
  {
    key: 'security_deposit',
    name: 'Deposit & handover',
    tagline: 'ID, deposit & vehicle',
    description: 'Capture ID, vehicle number and deposit acknowledgement before keys are handed over.',
    accent: '#be185d',
    layout: 'card',
    icon: 'wallet',
    cover_title: 'Handover registration',
    cover_subtitle: 'We collect this once so handover and deposit refund stay straightforward.',
    fields: [
      field({ key: 'full_name', label: 'Renter name', type: 'text', required: true }),
      field({ key: 'phone', label: 'Mobile number', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'id_number', label: 'ID number', type: 'text', required: true, placeholder: 'Aadhaar / licence / passport' }),
      field({ key: 'vehicle_number', label: 'Vehicle / asset number (if any)', type: 'text', placeholder: 'e.g. KA 01 AB 1234' }),
      field({
        key: 'deposit_mode',
        label: 'Deposit payment mode',
        type: 'select',
        required: true,
        options: ['UPI', 'Card', 'Cash', 'Already paid online', 'Waived'],
      }),
      field({ key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Visible damage already noted, extra helmet…' }),
      field({
        key: 'agree_deposit',
        label: 'I understand the security deposit may be adjusted for damage, fuel or late return',
        type: 'checkbox',
        required: true,
      }),
    ],
  },
  {
    key: 'blank_modern',
    name: 'Blank modern',
    tagline: 'Start from a clean form',
    description: 'A short modern starter — add, remove or rename fields to match your rental.',
    accent: '#334155',
    layout: 'card',
    icon: 'sparkles',
    cover_title: 'Registration',
    cover_subtitle: 'Please complete this form to continue with your booking.',
    fields: [
      field({ key: 'full_name', label: 'Full name', type: 'text', required: true, placeholder: 'Your full name' }),
      field({ key: 'phone', label: 'Mobile number', type: 'phone', required: true, placeholder: '10-digit mobile' }),
      field({ key: 'email', label: 'Email', type: 'email', placeholder: 'you@email.com' }),
      field({ key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Anything we should know?' }),
    ],
  },
]

export function fieldsFromTemplate(tpl: RegistrationTemplate): RegistrationField[] {
  return tpl.fields.map((f, i) => ({
    ...f,
    id: `f_${tpl.key}_${i}_${Math.random().toString(36).slice(2, 7)}`,
  }))
}

export function themeFromTemplate(tpl: RegistrationTemplate): RegistrationTheme {
  return {
    accent: tpl.accent,
    layout: tpl.layout,
    cover_title: tpl.cover_title,
    cover_subtitle: tpl.cover_subtitle,
    logo_url: tpl.logo_url || '',
    company_name: tpl.company_name || '',
    company_phone: tpl.company_phone || '',
    company_address: tpl.company_address || '',
  }
}

export const FIELD_TYPE_OPTIONS: { value: RegistrationFieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'heading', label: 'Section heading' },
  { value: 'terms', label: 'Terms and conditions' },
  { value: 'image', label: 'Image upload' },
]
