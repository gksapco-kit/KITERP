/** Normalize phone to E.164 for Twilio (+country + number). Mirrors backend sms_service.normalize_e164. */
export function normalizePhoneE164(phone: string): string {
  const raw = (phone || '').trim()
  if (!raw || raw === '-' || raw === '—') return ''
  const cleaned = raw.replace(/[\s\-().]/g, '')
  if (!cleaned) return ''
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`
  if (!cleaned.startsWith('+')) return `+${cleaned.replace(/^\+/, '')}`
  return cleaned
}

export function isValidPhoneE164(phone: string): boolean {
  const normalized = normalizePhoneE164(phone)
  const digits = normalized.replace(/\D/g, '')
  return normalized.startsWith('+') && digits.length >= 10 && digits.length <= 15
}
