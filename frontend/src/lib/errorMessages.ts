import type { AxiosError } from 'axios'
import { toast } from 'sonner'

/** True when the request never got a useful HTTP response (offline, proxy down, timeout). */
export function isAxiosNetworkError(error: unknown): boolean {
  const ax = error as AxiosError
  if (ax?.response) return false
  const code = ax?.code ?? ''
  const msg = ax?.message ?? ''
  return (
    code === 'ERR_NETWORK'
    || code === 'ECONNABORTED'
    || msg.includes('Network Error')
    || msg.toLowerCase().includes('timeout')
  )
}

/** True when the server rejected credentials or the session is invalid. */
export function isAxiosAuthError(error: unknown): boolean {
  const ax = error as AxiosError
  const status = ax?.response?.status
  return status === 401 || status === 403
}

interface ApiErrorDetail {
  loc?: (string | number)[]
  msg?: string
  message?: string
  field?: string
}

/**
 * Build a readable message from an API error, using the real backend reason when available.
 * Handles string `detail`, Pydantic/FastAPI validation arrays, `{message}` objects,
 * network errors, and falls back to status-based text.
 */
export function extractApiError(error: unknown, context: string): string {
  const ax = error as AxiosError<{
    detail?: string | ApiErrorDetail[] | Record<string, unknown>
    message?: string
    error?: string
  }>

  if (!ax?.response) {
    if (ax?.code === 'ECONNABORTED' || ax?.message?.toLowerCase().includes('timeout')) {
      return `${context}: Request timed out — check your connection and try again`
    }
    if (ax?.code === 'ERR_NETWORK' || ax?.message?.includes('Network Error')) {
      return `${context}: Unable to reach the server — check if the backend is running`
    }
    if (error instanceof Error && error.message) return `${context}: ${error.message}`
    return `${context}: No response from server — please check your connection`
  }

  const { status, data } = ax.response
  const detail = data?.detail

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const msg = (detail as Record<string, unknown>).message
    if (typeof msg === 'string' && msg.trim()) return `${context}: ${msg}`
  }
  if (Array.isArray(detail)) {
    const parts = [...new Set(
      (detail as ApiErrorDetail[]).map((e) => {
        const field = e.loc?.filter((p) => p !== 'body').join('.') || e.field || ''
        const msg = e.msg || e.message || 'invalid value'
        return field ? `${field}: ${msg}` : msg
      }),
    )]
    const shown = parts.slice(0, 5).join('; ')
    const suffix = parts.length > 5 ? ` (+${parts.length - 5} more)` : ''
    if (shown) return `${context}: ${shown}${suffix}`
  }
  if (typeof detail === 'string' && detail.trim()) {
    return `${context}: ${detail.length > 400 ? `${detail.slice(0, 397)}…` : detail}`
  }
  if (typeof data?.message === 'string' && data.message.trim()) return `${context}: ${data.message}`
  if (typeof data?.error === 'string' && data.error.trim()) return `${context}: ${data.error}`

  switch (status) {
    case 400: return `${context}: Invalid request — please check the data you entered`
    case 401: return `${context}: Your session has expired — please log in again`
    case 403: return `${context}: You don't have permission to perform this action`
    case 404: return `${context}: The requested item was not found`
    case 409: return `${context}: This item already exists or conflicts with another record`
    case 413: return `${context}: The uploaded file is too large`
    case 422: return `${context}: Some required information is missing or invalid`
    case 429: return `${context}: Too many requests — please wait a moment and try again`
    case 500: return `${context}: Internal server error — please try again`
    case 502:
    case 503: return `${context}: The server is temporarily unavailable — please try again shortly`
    default: return `${context}: Unexpected error (HTTP ${status})`
  }
}

/**
 * Shorthand for onError handlers in React Query mutations.
 * Usage: onError: apiError('Could not save product')
 */
export function apiError(context: string) {
  return (error: unknown) => {
    toast.error(extractApiError(error, context))
  }
}
