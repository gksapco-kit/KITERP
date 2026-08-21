import { COUNTRIES } from '@/data/countries'

/** Normalize phone to E.164 (+country + number). Mirrors backend sms_service.normalize_e164. */
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

/** Public display with country code, e.g. "+91 9441757900". */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const raw = (phone || '').trim()
  if (!raw) return ''
  const e164 = normalizePhoneE164(raw)
  if (!e164) return raw

  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const country of sorted) {
    if (e164.startsWith(country.dialCode)) {
      const national = e164.slice(country.dialCode.length).replace(/\D/g, '')
      if (national) return `${country.dialCode} ${national}`
    }
  }
  return e164
}
