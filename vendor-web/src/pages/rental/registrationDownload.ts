/** Build printable HTML / CSV for filled registration submissions. */

export type DownloadField = { key: string; label: string; type: string }

export type DownloadSubmission = {
  id: string
  form_name?: string | null
  customer_name?: string | null
  booking_number?: string | null
  channel?: string | null
  created_at?: string | null
  deleted_at?: string | null
  answers?: Record<string, unknown> | null
  fields?: DownloadField[] | null
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function answerText(field: DownloadField, raw: unknown): string {
  if (field.type === 'checkbox' || field.type === 'terms' || typeof raw === 'boolean') {
    const yes = raw === true || raw === 'true' || raw === 'Yes' || raw === 'yes' || raw === 1 || raw === '1'
    const no = raw === false || raw === 'false' || raw === 'No' || raw === 'no' || raw === 0 || raw === '0'
    if (yes) return 'Yes'
    if (no) return 'No'
  }
  if (raw == null || raw === '') return ''
  return String(raw)
}

export function registrationFileName(row: DownloadSubmission, ext: string): string {
  const base = [
    row.customer_name || 'Guest',
    row.booking_number || '',
    row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
  ]
    .filter(Boolean)
    .join(' — ')
    .replace(/[^\w.\- ]+/g, '_')
    .trim() || 'registration'
  return `${base}.${ext}`
}

export function buildRegistrationHtml(
  row: DownloadSubmission,
  opts?: { accent?: string; companyName?: string },
): string {
  const accent = opts?.accent || '#0f766e'
  const fields = Array.isArray(row.fields) ? row.fields : []
  const answers = row.answers || {}
  const title = row.form_name || 'Registration form'
  const when = row.created_at
    ? new Date(row.created_at).toLocaleString('en-IN')
    : '—'

  type Section = { heading: string | null; fields: DownloadField[] }
  const sections: Section[] = []
  let current: Section = { heading: null, fields: [] }
  for (const field of fields) {
    if (field.type === 'heading') {
      if (current.heading || current.fields.length) sections.push(current)
      current = { heading: field.label || 'Section', fields: [] }
      continue
    }
    current.fields.push(field)
  }
  if (current.heading || current.fields.length) sections.push(current)

  const meta = [
    row.customer_name ? `<strong>Guest:</strong> ${esc(row.customer_name)}` : '',
    row.booking_number ? `<strong>Booking:</strong> ${esc(row.booking_number)}` : '',
    row.channel ? `<strong>Channel:</strong> ${esc(row.channel)}` : '',
    `<strong>Submitted:</strong> ${esc(when)}`,
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ')

  let body = ''
  for (const section of sections) {
    if (section.heading) {
      body += `<div class="section">${esc(section.heading)}</div>`
    }
    body += '<table class="fields">'
    for (const field of section.fields) {
      if (field.type === 'image') continue
      const val = answerText(field, answers[field.key]) || '—'
      body += `<tr><th>${esc(field.label)}</th><td>${esc(val)}</td></tr>`
    }
    body += '</table>'
  }

  if (!fields.length) {
    body = '<p class="empty">No field answers were stored with this registration.</p>'
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
  .page { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  .meta { font-size: 12px; color: #334155; margin-bottom: 18px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
  .section { margin: 16px 0 6px; padding: 6px 10px; background: ${accent}; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; border-radius: 4px; }
  table.fields { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.fields th, table.fields td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; vertical-align: top; }
  table.fields th { width: 38%; text-align: left; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; font-size: 10px; background: #f8fafc; }
  table.fields td { font-weight: 600; color: #0f172a; }
  .empty { color: #64748b; font-size: 13px; }
</style></head><body><div class="page">
  <h1>${esc(title)}</h1>
  <p class="sub">${opts?.companyName ? esc(opts.companyName) + ' · ' : ''}Filled registration</p>
  <div class="meta">${meta}</div>
  ${body}
</div></body></html>`
}

function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function buildRegistrationCsv(
  rows: DownloadSubmission[],
  fields: DownloadField[],
): string {
  const answerFields = fields.filter((f) => f.type !== 'heading')
  const headers = [
    'Customer',
    'Booking',
    'Channel',
    'Submitted',
    ...answerFields.map((f) => f.label),
  ]
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    const answers = row.answers || {}
    const when = row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : ''
    const cols = [
      row.customer_name || '',
      row.booking_number || '',
      row.channel || '',
      when,
      ...answerFields.map((f) => answerText(f, answers[f.key])),
    ]
    lines.push(cols.map((c) => csvCell(String(c))).join(','))
  }
  return `\uFEFF${lines.join('\n')}`
}

export function downloadBlob(content: string | Blob, filename: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
