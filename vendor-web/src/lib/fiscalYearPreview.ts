/**
 * Must match backend `fiscal_year_bounds` (fiscal_calendar.py) for the same template/year.
 * Used to show users the exact range before create and to validate audit windows client-side.
 */
export type FiscalTemplate = 'jan_dec' | 'jul_jun' | 'apr_mar' | 'custom'

export function formatIsoDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function computeFiscalYearPreview(
  template: FiscalTemplate,
  yearAnchor: number,
  customStart: string,
  customEnd: string,
): { start: string; end: string; label: string } | null {
  if (template === 'custom') {
    if (!customStart || !customEnd) return null
    return { start: customStart, end: customEnd, label: 'Custom range' }
  }
  if (template === 'jan_dec') {
    return {
      start: `${yearAnchor}-01-01`,
      end: `${yearAnchor}-12-31`,
      label: `FY ${yearAnchor}`,
    }
  }
  if (template === 'jul_jun') {
    return {
      start: `${yearAnchor}-07-01`,
      end: `${yearAnchor + 1}-06-30`,
      label: `FY ${yearAnchor}-${String(yearAnchor + 1).slice(2)}`,
    }
  }
  if (template === 'apr_mar') {
    return {
      start: `${yearAnchor}-04-01`,
      end: `${yearAnchor + 1}-03-31`,
      label: `FY ${yearAnchor}-${String(yearAnchor + 1).slice(2)}`,
    }
  }
  return null
}

const VC_MAX = 40

/** Default variant_code (unique per org) derived from pattern + year or custom range — no user input. */
export function buildDefaultVariantCode(
  template: FiscalTemplate,
  yearAnchor: number,
  customStart: string,
  customEnd: string,
): string {
  let s: string
  if (template === 'custom') {
    if (customStart && customEnd) {
      const a = customStart.replace(/-/g, '')
      const b = customEnd.replace(/-/g, '')
      s = `CUST-${a}-${b}`
    } else {
      s = 'CUST'
    }
  } else if (template === 'jan_dec') {
    s = `JD-${yearAnchor}`
  } else if (template === 'jul_jun') {
    s = `JJ-${yearAnchor}-${String(yearAnchor + 1).slice(2)}`
  } else {
    s = `AM-${yearAnchor}-${String(yearAnchor + 1).slice(2)}`
  }
  return s.length > VC_MAX ? s.slice(0, VC_MAX) : s
}

/**
 * Post-close audit: entire window must be strictly after the fiscal year end (ISO YYYY-MM-DD).
 * `auditEnd` must be on or after `auditStart`.
 */
export function isAuditWindowAfterFyEnd(
  auditStart: string,
  auditEnd: string,
  fyEnd: string,
): boolean {
  if (!auditStart || !auditEnd || !fyEnd) return true
  if (auditEnd < auditStart) return false
  return auditStart > fyEnd
}

export function formatApiDetail(e: { response?: { data?: { detail?: unknown } } }): string {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d
      .map((x: { msg?: string; loc?: unknown }) => (typeof x === 'object' && x && 'msg' in x ? (x as { msg: string }).msg : String(x)))
      .filter(Boolean)
      .join(' ')
  }
  return 'Request failed'
}
