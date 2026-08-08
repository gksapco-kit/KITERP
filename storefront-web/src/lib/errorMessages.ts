import { AxiosError, isAxiosError } from 'axios'
import { toast } from 'sonner'
import { friendlyOtpDeliveryMessage } from './otpAuth'

interface ApiErrorDetail {
  loc?: (string | number)[]
  msg?: string
  message?: string
  type?: string
  field?: string
}

/**
 * Extracts the most descriptive error message from an API error response.
 * Handles Pydantic validation arrays, plain detail strings, network errors,
 * and HTTP status-based messages.
 */
export function extractApiError(error: unknown, context: string): string {
  // Plain Error (e.g. "Cart item not found") — not an Axios/network failure.
  if (error instanceof Error && !isAxiosError(error)) {
    const msg = error.message?.trim()
    if (msg) return `${context}: ${msg}`
  }

  const ax = error as AxiosError<{
    detail?: string | ApiErrorDetail[]
    message?: string
    error?: string
  }>

  if (!ax?.response) {
    if (ax?.code === 'ECONNABORTED' || ax?.message?.includes('timeout')) {
      return `${context}: Request timed out — check your internet connection and try again`
    }
    if (ax?.code === 'ERR_NETWORK' || ax?.message?.includes('Network Error')) {
      return `${context}: Unable to reach the server — ensure the backend API is running (port 8000) and the storefront dev server is proxying /api (npm run dev in storefront-web, or nginx /api in production)`
    }
    if (ax?.code === 'ERR_CANCELED') {
      return `${context}: Request was cancelled`
    }
    return `${context}: No response from server — please check your connection and that the API is reachable`
  }

  const { status, data } = ax.response

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const rec = data.detail as Record<string, unknown>
    if (typeof rec.message === 'string' && rec.message.trim()) {
      return `${context}: ${rec.message}`
    }
    if (typeof rec.technical === 'string' && rec.technical.trim()) {
      return `${context}: Account data conflict — please contact the store or try a different email/phone`
    }
  }

  if (data?.detail && Array.isArray(data.detail)) {
    const fieldErrors = (data.detail as ApiErrorDetail[])
      .map(e => {
        const field = e.loc?.filter(p => p !== 'body')?.join('.') || e.field || 'field'
        const msg = e.msg || e.message || 'invalid value'
        return `${field}: ${msg}`
      })
      .slice(0, 3)
    const suffix = data.detail.length > 3 ? ` (+${data.detail.length - 3} more)` : ''
    return `${context}: ${fieldErrors.join('; ')}${suffix}`
  }

  if (data?.detail && typeof data.detail === 'string') {
    return `${context}: ${friendlyOtpDeliveryMessage(data.detail)}`
  }

  if (data?.message && typeof data.message === 'string') {
    return `${context}: ${data.message}`
  }

  if (data?.error && typeof data.error === 'string') {
    return `${context}: ${data.error}`
  }

  switch (status) {
    case 400:
      return `${context}: Invalid request — please check the information you provided`
    case 401:
      return `${context}: Please log in to continue`
    case 403:
      return `${context}: You don't have permission for this action`
    case 404:
      return `${context}: Not found — the item may have been removed`
    case 409:
      return `${context}: This action conflicts with an existing record`
    case 413:
      return `${context}: The uploaded file is too large`
    case 422:
      return `${context}: Some information is missing or invalid — please review your input`
    case 429:
      return `${context}: Too many requests — please wait a moment and try again`
    case 500:
      return `${context}: Something went wrong on our end — please try again`
    case 502:
    case 503:
      return `${context}: The store is temporarily unavailable — please try again shortly`
    default:
      return `${context}: Unexpected error (HTTP ${status})`
  }
}

/**
 * Shorthand for onError handlers in React Query mutations.
 * Usage: onError: apiError('Could not place order')
 */
export function apiError(context: string) {
  return (error: unknown) => {
    toast.error(extractApiError(error, context))
  }
}

/** User-facing login/register errors — never show raw SQL or stack traces in the form. */
export function formatCustomerAuthError(
  error: unknown,
  fallback = 'Could not sign in. Check your email or phone and password.',
): string {
  const ax = error as AxiosError<{
    detail?: string | ApiErrorDetail[] | Record<string, unknown>
    message?: string
  }>
  const detail = ax?.response?.data?.detail
  const topMessage = ax?.response?.data?.message

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const rec = detail as Record<string, unknown>
    if (rec.code === 'ambiguous_vendor_resolution' || typeof rec.message === 'string') {
      const msg = typeof rec.message === 'string' ? rec.message : ''
      if (/duplicate|ambiguous|multiple/i.test(msg) || rec.code === 'ambiguous_vendor_resolution') {
        return 'This email or phone is already linked to an account for this store. Try signing in, or use a different contact.'
      }
      if (msg && msg.length <= 200) return msg
    }
  }

  if (typeof detail === 'string') {
    if (/UndefinedColumn|asyncpg|sqlalchemy|does not exist|traceback|MultipleResultsFound/i.test(detail)) {
      return 'Sign-in is temporarily unavailable. Please try again in a moment.'
    }
    const friendly = friendlyOtpDeliveryMessage(detail)
    if (friendly.length <= 200 && !/class\s+['"]/.test(friendly)) {
      return friendly
    }
  }

  if (typeof topMessage === 'string' && topMessage.trim()) {
    if (/ambiguous vendor|duplicate database/i.test(topMessage)) {
      return 'This email or phone is already linked to an account for this store. Try signing in, or use a different contact.'
    }
    if (topMessage.length <= 160) return topMessage
  }

  if (ax?.response?.status === 401) {
    return 'Invalid email, phone, or password.'
  }

  if (ax?.response?.status === 409) {
    return 'This email or phone is already linked to an account for this store. Try signing in, or use a different contact.'
  }

  if (!ax?.response) {
    if (ax?.code === 'ECONNABORTED' || ax?.message?.includes('timeout')) {
      return 'The store is taking too long to respond. Check your connection and try again.'
    }
    if (ax?.code === 'ERR_NETWORK' || ax?.message?.includes('Network Error')) {
      return 'Cannot reach the store API. Start the backend (port 8000) and open the business front at http://127.0.0.1:3002 so /api requests are proxied correctly.'
    }
    return 'Unable to reach the store. Check your connection, ensure the backend is running, and try again.'
  }

  return fallback
}
