/** Shared helpers for platform forgot-password OTP flows. */

export const NOT_REGISTERED_EMAIL =
  'This email is not registered. Check the address or create a business account first.'
export const NOT_REGISTERED_PHONE =
  'This phone number is not registered. Check the number or create a business account first.'

export type OtpChannel = 'email' | 'phone'

export function resetCodeWasIssued(res: {
  dev_hint?: string | null
  expires_at?: string | null
}): boolean {
  if (res.dev_hint) return true
  return Boolean(res.expires_at)
}

export function normalizeAuthApiDetail(
  detail: unknown,
  fallback: string,
  channel?: OtpChannel,
): string {
  if (typeof detail === 'string' && detail.trim()) {
    if (detail === 'Not Found') {
      if (channel === 'email') return NOT_REGISTERED_EMAIL
      if (channel === 'phone') return NOT_REGISTERED_PHONE
      return fallback
    }
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg)
    }
  }
  return fallback
}

export function extractAuthApiDetail(
  error: unknown,
  fallback: string,
  channel?: OtpChannel,
): string {
  const ax = error as { response?: { data?: { detail?: unknown } } }
  return normalizeAuthApiDetail(ax?.response?.data?.detail, fallback, channel)
}
