import { AxiosError } from 'axios'
import { toast } from 'sonner'

/**
 * Map known raw DB / server error strings into short, user-readable messages.
 * Prevents multi-line SQLAlchemy stack traces from reaching the UI.
 */
function _sanitiseDetail(detail: string): string {
  const d = detail.toLowerCase()

  if (d.includes('not-null constraint') || d.includes('notnullviolation') || d.includes('null value in column')) {
    const col = detail.match(/null value in column "(\w+)"/)
    const field = col ? col[1].replace(/_/g, ' ') : 'a required field'
    return `Missing required value: "${field}" cannot be empty`
  }
  if (d.includes('unique constraint') || d.includes('uniqueviolation') || d.includes('already exists')) {
    return 'A record with this information already exists'
  }
  if (d.includes('foreign key constraint') || d.includes('foreignkeyviolation')) {
    return 'The referenced record does not exist — please check the linked data'
  }
  if (d.includes("session's transaction has been rolled back") || d.includes('integrityerror')) {
    return 'A database conflict occurred — please try again'
  }
  if (d.includes('deadlock')) {
    return 'A temporary conflict occurred — please try again'
  }
  if (d.includes('wb_builder_previews')) {
    return 'Preview database table is missing — run backend migrations (e.g. alembic upgrade web006) and restart the API'
  }
  // Truncate anything suspiciously long (stack traces, SQL dumps)
  if (detail.length > 200) {
    return detail.slice(0, 197).trimEnd() + '…'
  }
  return detail
}

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
/** True when the draft preview POST failed because preview storage is not on this DB (or similar). */
export function isBuilderPreviewInfraFailure(error: unknown): boolean {
  const ax = error as AxiosError<{ detail?: string }>
  const raw = ax?.response?.data
  const blob =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object' && raw && typeof (raw as { detail?: unknown }).detail === 'string'
        ? String((raw as { detail: string }).detail)
        : raw != null
          ? JSON.stringify(raw)
          : ''
  const s = blob.toLowerCase()
  return s.includes('wb_builder_previews') || (s.includes('relation') && s.includes('does not exist'))
}

export function extractApiError(error: unknown, context: string): string {
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
      return `${context}: Unable to reach the server — check if the backend is running`
    }
    return `${context}: No response from server — please check your connection`
  }

  const { status, data } = ax.response

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const rec = data.detail as Record<string, unknown>
    if (rec.error === 'ambiguous_login' && typeof rec.message === 'string') {
      return `${context}: ${rec.message}`
    }
    if (typeof rec.message === 'string') {
      return `${context}: ${_sanitiseDetail(rec.message)}`
    }
  }

  if (data?.detail && Array.isArray(data.detail)) {
    const fieldErrors = (data.detail as ApiErrorDetail[])
      .map(e => {
        const field = e.loc?.filter(p => p !== 'body')?.join('.') || e.field || 'field'
        const msg = e.msg || e.message || 'invalid value'
        return `${field}: ${msg}`
      })
      .slice(0, 5)
    const suffix = data.detail.length > 5 ? ` (+${data.detail.length - 5} more)` : ''
    return `${context}: ${fieldErrors.join('; ')}${suffix}`
  }

  if (data?.detail && typeof data.detail === 'string') {
    return `${context}: ${_sanitiseDetail(data.detail)}`
  }

  if (data?.message && typeof data.message === 'string') {
    return `${context}: ${data.message}`
  }

  if (data?.error && typeof data.error === 'string') {
    return `${context}: ${data.error}`
  }

  switch (status) {
    case 400:
      return `${context}: Invalid request — please check the data you entered`
    case 401:
      return `${context}: Your session has expired — please log in again`
    case 403:
      return `${context}: You don't have permission to perform this action`
    case 404:
      return `${context}: The requested resource was not found — it may have been deleted`
    case 409:
      return `${context}: Conflict — this item may already exist or is being modified by another user`
    case 413:
      return `${context}: The uploaded file is too large`
    case 422:
      return `${context}: The server could not process the data — check required fields`
    case 429:
      return `${context}: Too many requests — please wait a moment and try again`
    case 500:
      return `${context}: Internal server error — the team has been notified`
    case 502:
    case 503:
      return `${context}: The server is temporarily unavailable — please try again shortly`
    default:
      return `${context}: Unexpected error (HTTP ${status})`
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

export type AmbiguousVendorOption = { slug: string; name: string }

/** When /auth/login returns ambiguous_login, use this to show a business picker instead of a generic toast. */
export function parseAmbiguousVendorLogin(error: unknown): { vendors: AmbiguousVendorOption[] } | null {
  const ax = error as AxiosError<{ detail?: unknown }>
  const raw = ax?.response?.data?.detail
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  if (rec.error !== 'ambiguous_login') return null
  const vendors = rec.vendors
  if (!Array.isArray(vendors)) return null
  const out: AmbiguousVendorOption[] = []
  for (const row of vendors) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const slug = typeof r.slug === 'string' ? r.slug.trim() : ''
    const name = typeof r.name === 'string' ? r.name.trim() : slug
    if (slug) out.push({ slug, name: name || slug })
  }
  return out.length ? { vendors: out } : null
}
