/** Shared helpers for vendor signup OTP on the storefront. */

export type OtpChannel = 'email' | 'phone'

export function normalizeAuthApiDetail(
  detail: unknown,
  fallback: string,
  channel?: OtpChannel,
): string {
  if (typeof detail === 'string' && detail.trim()) {
    if (detail === 'Not Found') {
      if (channel === 'email') {
        return 'Could not send verification email — check the address or try again later.'
      }
      if (channel === 'phone') {
        return 'Could not send verification SMS — check the number or try again later.'
      }
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
