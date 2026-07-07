import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { humanizeApiValidationError } from '@/lib/formFieldErrors'

/**
 * Map known raw DB / server error strings into short, user-readable messages.
 * Prevents multi-line SQLAlchemy stack traces from reaching the UI.
 */
function _sanitiseDetail(detail: string): string {
  const d = detail.toLowerCase()

  if (detail === 'Not Found') {
    return 'Not found — check your details or contact support if this persists'
  }
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
  if (d.includes('multiple rows were found') || d.includes('multipleresultsfound')) {
    return (
      'Your account matched more than one vendor record for this business (often duplicate team membership). '
      + 'Remove duplicate vendor_user rows or reopen this store from the admin handoff link.'
    )
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

export const GSTIN_FORMAT_MSG =
  'Please enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).'

/** Turn Pydantic/FastAPI field errors into short, readable copy. */
function humanizeValidationMessage(field: string, msg: string): string {
  const fieldName = field.split(/[.>]/).pop()?.trim().toLowerCase() ?? field.toLowerCase()
  const lower = msg.toLowerCase()

  if (fieldName === 'gstin' || lower.includes('gstin')) {
    if (lower.includes('match pattern') || lower.includes('string_pattern')) {
      return GSTIN_FORMAT_MSG
    }
  }

  if (lower.includes('match pattern') || lower.includes('string_pattern_mismatch')) {
    return 'Invalid format — please check the value and try again.'
  }

  return humanizeApiValidationError(field, msg)
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

/** True when axios failed before receiving any HTTP response (proxy down, backend reloading, offline). */
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
    if (typeof rec.technical === 'string' && (rec.code === 'ambiguous_vendor_resolution' || !rec.message)) {
      return `${context}: ${_sanitiseDetail(rec.technical as string)}`
    }
  }

  if (data?.detail && Array.isArray(data.detail)) {
    const fieldErrors = [...new Set(
      (data.detail as ApiErrorDetail[])
        .map(e => {
          const field = e.loc?.filter(p => p !== 'body')?.join('.') || e.field || 'field'
          const raw = e.msg || e.message || 'invalid value'
          return humanizeValidationMessage(field, raw)
        }),
    )].slice(0, 5)
    const suffix = data.detail.length > 5 ? ` (+${data.detail.length - 5} more)` : ''
    return fieldErrors.length === 1
      ? `${context}: ${fieldErrors[0]}`
      : `${context}: ${fieldErrors.join('; ')}${suffix}`
  }

  if (data?.detail && typeof data.detail === 'string') {
    const detail = data.detail
    if (/gstin/i.test(detail) && /match pattern/i.test(detail)) {
      return `${context}: ${GSTIN_FORMAT_MSG}`
    }
    return `${context}: ${_sanitiseDetail(detail)}`
  }

  if (data?.message && typeof data.message === 'string') {
    return `${context}: ${_sanitiseDetail(data.message)}`
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
      if (typeof ax.response?.data === 'object' && ax.response.data && typeof (ax.response.data as { detail?: unknown }).detail === 'string') {
        return `${context}: ${_sanitiseDetail(String((ax.response.data as { detail: string }).detail))}`
      }
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
/** When /auth/login returns requires_2fa, prompt for authenticator code and retry. */
export function parseRequires2fa(error: unknown): boolean {
  const ax = error as AxiosError<{ detail?: unknown }>
  const raw = ax?.response?.data?.detail
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  return (raw as Record<string, unknown>).error === 'requires_2fa'
}

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
