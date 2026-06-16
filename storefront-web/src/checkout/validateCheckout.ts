import type { Address, Customer } from './types'

export type CheckoutFieldErrors = Record<string, string>

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function validateCheckoutFields(params: {
  customer: Partial<Customer>
  shippingAddress?: Address
  isGuest: boolean
  requirePhone?: boolean
  usingSavedAddress: boolean
}): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}
  const { customer, shippingAddress, isGuest, requirePhone, usingSavedAddress } = params

  if (isGuest) {
    const email = customer.email?.trim() ?? ''
    if (!email) errors.email = 'Email is required'
    else if (!isValidEmail(email)) errors.email = 'Enter a valid email address'

    if (!customer.firstName?.trim()) errors.firstName = 'First name is required'
    if (!customer.lastName?.trim()) errors.lastName = 'Last name is required'
  }

  if (!usingSavedAddress) {
    const addr = shippingAddress
    if (!addr?.line1?.trim()) errors.line1 = 'Address is required'
    if (!addr?.city?.trim()) errors.city = 'City is required'
    if (!addr?.region?.trim()) errors.region = 'State / region is required'
    if (!addr?.postalCode?.trim()) errors.postalCode = 'Postal code is required'
    if (!addr?.country?.trim()) errors.country = 'Country is required'

    const fullName = addr?.fullName?.trim()
      || [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    if (!fullName) errors.fullName = 'Full name is required'

    if (requirePhone && !addr?.phone?.trim() && !customer.phone?.trim()) {
      errors.phone = 'Phone is required'
    }
  } else if (!shippingAddress?.line1?.trim()) {
    errors.shippingAddress = 'Please select a delivery address'
  }

  return errors
}

export function scrollToFirstCheckoutField(errors: CheckoutFieldErrors) {
  const order = [
    'email',
    'firstName',
    'lastName',
    'fullName',
    'line1',
    'city',
    'region',
    'postalCode',
    'country',
    'phone',
    'shippingAddress',
  ]
  const key = order.find(k => errors[k]) ?? Object.keys(errors)[0]
  if (!key) return
  document.querySelector(`[data-checkout-field="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
