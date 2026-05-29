export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export function validateSignup(input: {
  name: string
  email: string
  password: string
  confirmPassword: string
  phone?: string
}): string | null {
  const name = input.name.trim()
  if (name.length < 2) return 'Please enter your full name (at least 2 characters).'
  if (!isValidEmail(input.email)) return 'Please enter a valid email address.'
  if (input.phone?.trim() && !isValidPhone(input.phone)) return 'Please enter a valid phone number (10–15 digits).'
  if (input.password.length < 8) return 'Password must be at least 8 characters.'
  if (input.password !== input.confirmPassword) return 'Passwords do not match.'
  return null
}

export function validateLogin(input: { email: string; password: string }): string | null {
  if (!isValidEmail(input.email)) return 'Please enter a valid email address.'
  if (!input.password) return 'Please enter your password.'
  return null
}
