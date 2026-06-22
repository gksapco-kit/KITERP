import { z } from 'zod'

/**
 * Whether the combined login field should show phone UI (vs plain email input).
 * Empty → email UI so one placeholder can cover both flows.
 */
export function inferLoginUiPhoneMode(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  if (t.includes('@')) return false
  const afterLeadingSeparators = t.replace(/^[\s()\-._]+/, '')
  if (!afterLeadingSeparators) return false
  if (afterLeadingSeparators.startsWith('+')) return true
  return /^\d/.test(afterLeadingSeparators)
}

/** Login value is a valid email or a plausible phone (E.164 from PhoneInput or common national formatting). */
export function isValidEmailOrPhoneLogin(val: string): boolean {
  const t = val.trim()
  if (!t) return false
  if (t.includes('@')) {
    return z.string().email().safeParse(t).success
  }
  if (!/^\+?[0-9\s().-]+$/.test(t)) return false
  const digits = t.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** Phone from PhoneInput (+country code). Empty is valid when the field is optional. */
export function isValidPhoneNumber(val: string): boolean {
  const t = val.trim()
  if (!t) return true
  if (!/^\+?[0-9\s().-]+$/.test(t)) return false
  const digits = t.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/** Empty is valid when the field is optional. */
export function isValidEmail(val: string): boolean {
  const t = val.trim()
  if (!t) return true
  return z.string().email().safeParse(t).success
}
