/** Shared helpers for forgot-password and signup OTP flows. */

export const NOT_REGISTERED_EMAIL =
  'This email is not registered. Check the address or create a business account first.'
export const NOT_REGISTERED_PHONE =
  'This phone number is not registered. Check the number or create a business account first.'

export type OtpChannel = 'email' | 'phone'

export function resetCodeWasIssued(
  data: { dev_hint?: string | null; expires_at?: string | null } | null | undefined,
): boolean {
  if (!data) return false
  if (data.dev_hint) return true
  return Boolean(data.expires_at)
}

/** Rewrite technical email/SMS provider errors into user-friendly copy. */
export function friendlyOtpDeliveryMessage(
  detail: string,
  channel?: OtpChannel,
): string {
  const d = (detail || '').trim()
  if (!d) return d

  if (/maximum credits|credits exceeded|over quota|trial ended|0 emails|email provider limit|plan reached/i.test(d)) {
    return channel === 'phone'
      ? "We couldn't send an SMS right now. Please try again in a few minutes."
      : 'Email delivery is temporarily unavailable (provider limit reached). Please use phone verification, or try again later.'
  }

  if (/sendgrid.*401|api key was rejected|unauthorized|authorization/i.test(d)) {
    return channel === 'phone'
      ? "We couldn't send the code right now. Please try again in a few minutes."
      : "We couldn't send email right now. Please use phone verification, or try again later."
  }

  if (/FROM_EMAIL|Sender Authentication|\.env\.config|SMTP_PASSWORD|SENDGRID_API_KEY/i.test(d)) {
    return "We couldn't send email right now. Please use phone verification, or contact support."
  }

  if (/sendgrid send failed|couldn't send the verification email|couldn't send email|email service is not configured/i.test(d)) {
    return channel === 'phone'
      ? d
      : "We couldn't send the verification email. Please use phone verification, or try again later."
  }

  if (/sms service is not configured|could not send sms/i.test(d)) {
    return "We couldn't send an SMS right now. Please try email instead, or try again later."
  }

  return d
}

/** Map generic API ``Not Found`` (stale route or 404 body) to channel-specific auth messages. */
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
    return friendlyOtpDeliveryMessage(detail.trim(), channel)
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) {
      return friendlyOtpDeliveryMessage(String((first as { msg: unknown }).msg), channel)
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
