import type { LogoShape } from '@/lib/invoiceTemplates'
import { OFFER_PAGE_BREAK, isMultiPageOfferHtml, parseOfferPageFragments, isCustomOfferPageFragment } from '@/lib/offerPages'
import { OFFER_LAYOUT_THUMBNAILS, layoutThumbnailLabel } from '@/lib/offerLayoutThumbnails'
import { normalizeOfferLayoutId, renderOfferLayoutShell, applyOfferAccentColor, DEFAULT_OFFER_ACCENT } from '@/lib/offerLayoutShells'

export type { LogoShape } from '@/lib/invoiceTemplates'

/** All invoice-style + offer-specific layout ids (legacy `standard` / `two_column` still accepted). */
export type OfferLayoutId = string

export type OfferWatermarkStyle = 'diagonal_text' | 'center_mark'

export interface OfferWatermarkOptions {
  enabled: boolean
  text?: string
  opacity?: number
  style?: OfferWatermarkStyle
}

export const OFFER_LAYOUTS = OFFER_LAYOUT_THUMBNAILS.map(t => ({
  id: t.id as OfferLayoutId,
  label: t.name,
  description: t.desc,
}))

export const LAYOUT_LOGO_PLACEMENT: Record<string, string> = {
  classic: 'Logo left in coloured header bar',
  standard: 'Logo left in coloured header bar',
  modern: 'Logo left inside gradient header',
  minimal: 'Small logo top-left',
  luxury: 'Logo left on dark premium header',
  corporate: 'Logo left with left accent border',
  colorblock: 'Logo in left colour sidebar',
  two_column: 'Logo in left sidebar above company',
  compact: 'Logo left in compact header',
  bold: 'Logo left in bold header band',
  visual: 'Logo left with highlighted meta strip',
  centered: 'Logo centered above company name',
  letterhead: 'Logo left on formal letterhead rule',
  banner: 'Logo left in full-width banner',
  executive: 'Logo on executive header strip',
  stripe: 'Logo left in tri-stripe header',
  gstpro: 'Logo left with GST-style header',
  retail: 'Logo centered in retail header',
  sideright: 'Logo in right sidebar panel',
  framed: 'Logo top-left inside framed border',
  slimleft: 'Logo in slim left column',
  premiumright: 'Logo right in premium header',
  leftlogo: 'Logo left beside company block',
  rightlogo: 'Logo top-right in header',
  footerleft: 'No header logo — logo bottom-left in footer',
  footerright: 'No header logo — logo bottom-right in footer',
  toprightlogobottomleft: 'Logo top-right and bottom-left',
  topleftlogobottomright: 'Logo top-left and bottom-right',
  toprightbottomleft: 'Logo top-right and bottom-left',
  topleftbottomright: 'Logo top-left and bottom-right',
  official_gulf: 'Logo left of company block (Gulf letter)',
  employment_formal: 'Logo top-left above candidate details',
  branded_bands: 'Logo left beside company in branded header',
  classic_formal: 'Logo centered above title',
}

export interface OfferLogoOptions {
  url?: string
  show?: boolean
  shape?: LogoShape
}

export const WATERMARK_STYLES: { id: OfferWatermarkStyle; label: string }[] = [
  { id: 'diagonal_text', label: 'Diagonal text' },
  { id: 'center_mark', label: 'Center logo mark' },
]

export const MERGE_VAR_KEYS = [
  'candidate_name', 'designation', 'department', 'store',
  'offered_ctc', 'offered_date', 'joining_date', 'expiry_date',
  'vendor_name', 'candidate_email', 'candidate_phone', 'today',
] as const

export type MergeVarKey = (typeof MERGE_VAR_KEYS)[number]

export const SAMPLE_MERGE_VALUES: Record<MergeVarKey, string> = {
  candidate_name: 'Rahul Sharma',
  designation: 'Software Engineer',
  department: 'Engineering',
  store: 'Head Office',
  offered_ctc: 'Rs.12,00,000',
  offered_date: '01 May 2026',
  joining_date: '15 May 2026',
  expiry_date: '10 May 2026',
  vendor_name: 'Your Company',
  candidate_email: 'rahul@example.com',
  candidate_phone: '+91 98765 43210',
  today: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
}

export const DEFAULT_OFFER_BODY = `<p>Dear <strong>{{candidate_name}}</strong>,</p>
<p>We are pleased to offer you the position of <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department at <strong>{{vendor_name}}</strong>.</p>
<p>Please review the key details below:</p>
<table>
  <tr><th>Annual CTC</th><td>{{offered_ctc}}</td></tr>
  <tr><th>Offer Date</th><td>{{offered_date}}</td></tr>
  <tr><th>Joining Date</th><td>{{joining_date}}</td></tr>
  <tr><th>Valid Until</th><td>{{expiry_date}}</td></tr>
  <tr><th>Location</th><td>{{store}}</td></tr>
</table>
<p>This offer is contingent upon successful completion of reference and background verification checks.</p>
<p>We look forward to welcoming you to our team.</p>
<p>Yours sincerely,<br/><strong>{{vendor_name}}</strong><br/>Human Resources</p>`

export function replaceMergeVars(html: string, values: Record<string, string>): string {
  let out = html
  for (const [key, val] of Object.entries(values)) {
    out = out.replaceAll(`{{${key}}}`, val)
  }
  return out
}

function parseOpacity(value?: number): number {
  const op = value ?? 0.12
  return Math.max(0.04, Math.min(0.35, op))
}

function watermarkBlock(vendorName: string, wm?: OfferWatermarkOptions): string {
  if (!wm?.enabled) return ''
  const label = (wm.text || vendorName || 'CONFIDENTIAL').trim() || 'CONFIDENTIAL'
  const op = parseOpacity(wm.opacity)
  const initials = vendorName.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'CO'
  if (wm.style === 'center_mark') {
    return `<div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden">
      <div style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border-radius:50%;
        border:4px solid rgba(148,163,184,${op});display:flex;align-items:center;justify-content:center;
        font-size:56px;font-weight:900;color:rgba(100,116,139,${op})">${initials}</div>
      <div style="position:absolute;top:62%;left:50%;transform:translate(-50%,-50%);font-size:13px;font-weight:700;
        letter-spacing:.22em;text-transform:uppercase;color:rgba(100,116,139,${op * 0.85});white-space:nowrap">${label}</div>
    </div>`
  }
  return `<div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;display:flex;align-items:center;justify-content:center">
    <div style="transform:rotate(-32deg);font-size:58px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
      color:rgba(100,116,139,${op});white-space:nowrap">${label}</div>
  </div>`
}

function escAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function initialsMark(vendor: string, size: number): string {
  const initials = vendor.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'CO'
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid #1a56db;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;color:#ea580c;font-size:${Math.max(12, Math.floor(size / 3))}px">${initials}</div>`
}

function logoClipWrap(url: string, w: number, h: number, clipPath: string): string {
  return `<span style="display:inline-block;width:${w}px;height:${h}px;clip-path:${clipPath};-webkit-clip-path:${clipPath};overflow:hidden;flex-shrink:0;line-height:0;vertical-align:middle;"><img src="${escAttr(url)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></span>`
}

function offerLogoTag(url: string, size: number, shape: LogoShape = 'rounded'): string {
  switch (shape) {
    case 'circle':
      return `<img src="${escAttr(url)}" alt="" style="width:${size}px;height:${size}px;max-width:${size}px;min-width:${size}px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0;" />`
    case 'oval': {
      const w = Math.round(size * 1.45)
      return `<img src="${escAttr(url)}" alt="" style="width:${w}px;height:${size}px;max-width:${w}px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0;" />`
    }
    case 'pill':
      return `<img src="${escAttr(url)}" alt="" style="height:${size}px;width:${Math.round(size * 2.1)}px;max-width:${Math.round(size * 2.4)}px;border-radius:9999px;object-fit:contain;display:block;flex-shrink:0;" />`
    case 'squircle':
      return `<img src="${escAttr(url)}" alt="" style="width:${size}px;height:${size}px;max-width:${size}px;min-width:${size}px;border-radius:28%;object-fit:cover;display:block;flex-shrink:0;" />`
    case 'arch':
      return `<img src="${escAttr(url)}" alt="" style="width:${size}px;height:${size}px;max-width:${size}px;border-radius:50% 50% 8px 8px;object-fit:cover;display:block;flex-shrink:0;" />`
    case 'sharp':
      return `<img src="${escAttr(url)}" alt="" style="height:${size}px;max-width:${size * 2}px;border-radius:0;object-fit:contain;display:block;flex-shrink:0;" />`
    case 'square':
      return `<img src="${escAttr(url)}" alt="" style="width:${size}px;height:${size}px;max-width:${size}px;min-width:${size}px;border-radius:4px;object-fit:contain;display:block;flex-shrink:0;" />`
    case 'diamond':
      return logoClipWrap(url, size, size, 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)')
    case 'hexagon':
      return logoClipWrap(url, size, size, 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)')
    case 'shield':
      return logoClipWrap(url, size, Math.round(size * 1.12), 'polygon(50% 0%, 92% 12%, 92% 58%, 50% 100%, 8% 58%, 8% 12%)')
    case 'rounded':
    default:
      return `<img src="${escAttr(url)}" alt="" style="height:${size}px;max-width:${size * 2}px;border-radius:8px;object-fit:contain;display:block;flex-shrink:0;" />`
  }
}

function headerMark(vendor: string, logo?: OfferLogoOptions, size = 52): string {
  if (!logo?.show) return ''
  if (logo.url) return offerLogoTag(logo.url, size, logo.shape ?? 'rounded')
  return initialsMark(vendor, size)
}

export function isCustomOfferHtml(html: string): boolean {
  const s = (html || '').trim()
  return s.includes('data-offer-custom="true"')
    || (s.startsWith('<div class="page-inner"') && s.includes('data-offer-custom'))
    || (isMultiPageOfferHtml(s) && s.includes('data-offer-custom'))
}

export { OFFER_PAGE_BREAK, isMultiPageOfferHtml, countOfferPages, addOfferPage, removeOfferPage } from '@/lib/offerPages'

/** Pull letter body fragment from a full custom template so a new layout shell can be applied. */
export function extractBodyFragmentForLayout(html: string): string {
  if (isMultiPageOfferHtml(html)) {
    const fragments = parseOfferPageFragments(html)
    const bodies = fragments.map(f => {
      try {
        const doc = new DOMParser().parseFromString(f, 'text/html')
        const pick =
          doc.querySelector('.offer-editable-body')
          ?? doc.querySelector('.body-content')
          ?? doc.querySelector('[data-offer-editable]')
        if (pick?.innerHTML) return pick.innerHTML.trim()
        const inner = doc.querySelector('.page-inner')
        if (inner?.innerHTML) return inner.innerHTML.trim()
      } catch { /* fall through */ }
      return f
    })
    return bodies.join(OFFER_PAGE_BREAK)
  }
  if (!isCustomOfferHtml(html)) return html
  try {
    const wrapped = html.trim().startsWith('<div') ? html : `<div>${html}</div>`
    const doc = new DOMParser().parseFromString(wrapped, 'text/html')
    const pick =
      doc.querySelector('.offer-editable-body')
      ?? doc.querySelector('.body-content')
      ?? doc.querySelector('[data-offer-editable]')
    if (pick?.innerHTML) return pick.innerHTML.trim()
    const inner = doc.querySelector('.page-inner')
    if (inner?.innerHTML) return inner.innerHTML.trim()
  } catch {
    /* fallback below */
  }
  return html
    .replace(/^[\s\S]*?data-offer-custom="true"\s*>/i, '')
    .replace(/<\/div>\s*$/i, '')
    .trim()
}

function injectEditablePageInner(inner: string, footerHtml: string): string {
  let out = inner.trim()
  if (!out.includes('data-offer-editable="full"')) {
    out = out.replace('<div class="page-inner">', '<div class="page-inner" data-offer-editable="full">')
    if (!out.includes('data-offer-editable="full"')) {
      out = out.replace('class="page-inner"', 'class="page-inner" data-offer-editable="full"')
    }
  }
  if (footerHtml && !out.includes('footer-note')) {
    out = out.replace(/<\/div>\s*$/, `${footerHtml}</div>`)
  }
  return out
}

const EDITABLE_PAGE_STYLES = `
    .page-inner[data-offer-editable="full"]{outline:none;cursor:text;min-height:120px}
    .page-inner[data-offer-editable="full"]:focus-within{box-shadow:inset 0 0 0 2px rgba(59,130,246,.45);background:rgba(239,246,255,.2)}
    .page-inner[data-offer-editable="full"] table td,.page-inner[data-offer-editable="full"] table th{min-width:36px}
    .page-inner[data-offer-editable="full"] [contenteditable]:focus{outline:none}
    .page + .page{margin-top:14px;border-top:2px dashed #e5e7eb;padding-top:14px}
    @media print{.page{page-break-after:always;box-shadow:none!important;margin:0!important;border:none!important}.page:last-child{page-break-after:auto}}
    .offer-editable-body{outline:none;min-height:48px;border-radius:6px}
    .offer-editable-body:hover{box-shadow:inset 0 0 0 1px rgba(59,130,246,.35)}
    .offer-editable-body:focus{box-shadow:inset 0 0 0 2px rgba(59,130,246,.55);background:rgba(239,246,255,.35)}
    .offer-editable-body table td,.offer-editable-body table th{min-width:40px}`

function buildLayoutInner(
  layout: OfferLayoutId,
  content: string,
  vendor: string,
  candidate: string,
  ref: string,
  today: string,
  embed: boolean,
  logo?: OfferLogoOptions,
  editableBody = false,
  accentColor?: string,
): string {
  const bodyHtml = editableBody
    ? `<div class="offer-editable-body" data-offer-editable="true" spellcheck="true">${content}</div>`
    : content
  const mark = (size = 52) => headerMark(vendor, logo, size)
  return renderOfferLayoutShell(layout, {
    content: bodyHtml,
    vendor,
    candidate,
    ref,
    today,
    embed,
    logo,
    mark,
    accentColor,
  })
}

export function buildOfferPreviewHtml(
  bodyHtml: string,
  layout: OfferLayoutId,
  vendorName: string,
  values: Partial<Record<MergeVarKey, string>> = {},
  watermark?: OfferWatermarkOptions,
  logo?: OfferLogoOptions,
): string {
  const merged = replaceMergeVars(bodyHtml, {
    ...SAMPLE_MERGE_VALUES,
    vendor_name: vendorName || SAMPLE_MERGE_VALUES.vendor_name,
    ...values,
  } as Record<string, string>)
  return wrapOfferPreview(merged, layout, vendorName, values.candidate_name || SAMPLE_MERGE_VALUES.candidate_name, true, watermark, logo)
}

export function wrapOfferPreview(
  bodyHtml: string,
  layout: OfferLayoutId,
  vendorName: string,
  candidateName = '',
  embed = false,
  watermark?: OfferWatermarkOptions,
  logo?: OfferLogoOptions,
  options?: { mergeBodyVars?: boolean; editableBody?: boolean; editableTemplate?: boolean; accentColor?: string },
): string {
  const raw = bodyHtml || '<p></p>'
  const s0 = raw.trim().toLowerCase()
  if (s0.startsWith('<!doctype') || s0.startsWith('<html')) return raw

  const accentColor = options?.accentColor || DEFAULT_OFFER_ACCENT
  const esc = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const vendor = esc(vendorName || 'Company')
  const candidate = esc(candidateName || SAMPLE_MERGE_VALUES.candidate_name)
  const today = esc(SAMPLE_MERGE_VALUES.today)
  const ref = 'PREVIEW'
  const footerNote = `<div class="footer-note">Computer-generated offer letter issued by ${vendor}.</div>`

  const base = embed
    ? `*{box-sizing:border-box;margin:0;padding:0}html,body{height:auto;overflow-x:hidden;width:100%}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1f2937;background:#fff;line-height:1.65}
    .page{background:#fff;width:100%;max-width:100%;margin:0;position:relative;overflow:hidden}
    .page-inner{position:relative;z-index:1}
    .body-content{overflow-wrap:break-word;word-break:break-word}.body-content p{margin-bottom:10px}
    .body-content table{width:100%;max-width:100%;border-collapse:collapse;margin:10px 0;font-size:12px;table-layout:fixed}
    .body-content th,.body-content td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-word}
    .body-content th{background:#f8fafc;width:34%}
    ${EDITABLE_PAGE_STYLES}
    .footer-note{margin:0;padding:16px 32px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;position:relative;z-index:1}`
    : `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1f2937;background:#f3f4f6;line-height:1.7}
    .page{background:#fff;max-width:780px;margin:0 auto;box-shadow:0 2px 16px rgba(0,0,0,.08);border-radius:4px;position:relative;overflow:hidden}
    .page-inner{position:relative;z-index:1}.body-content p{margin-bottom:12px}
    .body-content table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
    .body-content th,.body-content td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left}
    .body-content th{background:#f8fafc}
    ${EDITABLE_PAGE_STYLES}
    .footer-note{margin-top:32px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;position:relative;z-index:1}`

  const wm = watermarkBlock(vendorName, watermark)
  const fragments = parseOfferPageFragments(raw)
  const multiPage = fragments.length > 1 || isMultiPageOfferHtml(raw)
  const mergeBody = options?.mergeBodyVars !== false
  const useFullEdit = options?.editableTemplate === true

  const mergeFragment = (fragment: string) => (mergeBody
    ? replaceMergeVars(fragment, {
      ...SAMPLE_MERGE_VALUES,
      vendor_name: vendorName || SAMPLE_MERGE_VALUES.vendor_name,
      candidate_name: candidateName || SAMPLE_MERGE_VALUES.candidate_name,
    })
    : fragment)

  if (multiPage) {
    const customPages = isMultiPageOfferHtml(raw) || fragments.every(isCustomOfferPageFragment)
    const pageBlocks = fragments.map((fragment, i) => {
      const isLast = i === fragments.length - 1
      let normalized = fragment.trim()
      if (normalized.startsWith('<div class="page"')) {
        try {
          const pdoc = new DOMParser().parseFromString(normalized, 'text/html')
          const inner = pdoc.querySelector('.page-inner')
          normalized = inner?.outerHTML ?? `<div class="page-inner" data-offer-page="${i + 1}" data-offer-custom="true">${pdoc.querySelector('.page')?.innerHTML ?? ''}</div>`
        } catch {
          /* use fragment as-is below */
        }
      }
      if (customPages || isCustomOfferPageFragment(normalized)) {
        let inner = mergeFragment(normalized)
        if (!inner.includes('class="page-inner"')) {
          inner = `<div class="page-inner" data-offer-page="${i + 1}" data-offer-custom="true">${inner}</div>`
        }
        if (useFullEdit) {
          inner = injectEditablePageInner(inner, isLast ? footerNote : '')
        }
        return `<div class="page" data-offer-page="${i + 1}">${wm}${inner}</div>`
      }
      const content = mergeFragment(fragment)
      const inner = buildLayoutInner(layout, content, vendor, candidate, ref, today, embed, logo, !useFullEdit && options?.editableBody, accentColor)
      if (useFullEdit) {
        return `<div class="page" data-offer-page="${i + 1}">${wm}${injectEditablePageInner(inner, isLast ? footerNote : '')}</div>`
      }
      return `<div class="page" data-offer-page="${i + 1}">${wm}${inner}${isLast ? footerNote : ''}</div>`
    }).join('')
    return applyOfferAccentColor(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${base}</style></head><body>${pageBlocks}</body></html>`, accentColor)
  }

  if (isCustomOfferHtml(raw)) {
    let inner = raw.trim()
    if (!inner.includes('class="page-inner"')) {
      inner = `<div class="page-inner" data-offer-custom="true">${inner}</div>`
    }
    const mergeBodySingle = options?.mergeBodyVars !== false
    if (mergeBodySingle) {
      inner = replaceMergeVars(inner, {
        ...SAMPLE_MERGE_VALUES,
        vendor_name: vendorName || SAMPLE_MERGE_VALUES.vendor_name,
        candidate_name: candidateName || SAMPLE_MERGE_VALUES.candidate_name,
      })
    }
    if (options?.editableTemplate) {
      inner = injectEditablePageInner(inner, '')
      if (!inner.includes('data-offer-custom="true"')) {
        inner = inner.replace('class="page-inner"', 'class="page-inner" data-offer-custom="true"')
      }
    }
    return applyOfferAccentColor(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${base}</style></head><body><div class="page">${wm}${inner}</div></body></html>`, accentColor)
  }

  const content = mergeFragment(raw)

  const inner = buildLayoutInner(
    layout,
    content,
    vendor,
    candidate,
    ref,
    today,
    embed,
    logo,
    !useFullEdit && options?.editableBody,
    accentColor,
  )

  if (useFullEdit) {
    const editableInner = injectEditablePageInner(inner, footerNote)
    return applyOfferAccentColor(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${base}</style></head><body><div class="page">${wm}${editableInner}</div></body></html>`, accentColor)
  }

  return applyOfferAccentColor(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${base}</style></head><body><div class="page" data-offer-page="1">${wm}${inner}${footerNote}</div></body></html>`, accentColor)
}

/** Blank A4 continuation sheet for offer letters (page-inner fragment, not .page wrapper). */
export function createBlankOfferContinuationPage(opts: {
  pageNumber: number
  vendorName?: string
  accentColor?: string
}): string {
  const vendor = opts.vendorName || 'Your Company'
  const color = opts.accentColor || '#1a56db'
  const n = opts.pageNumber
  const pad = '24px 32px'
  const footerNote = `<div class="footer-note">Computer-generated offer letter issued by ${vendor}.</div>`

  return `<div class="page-inner" data-offer-page="${n}" data-offer-custom="true" style="min-height:1122px;display:flex;flex-direction:column;box-sizing:border-box">
    <div data-section="header" style="flex-shrink:0;padding:${pad};padding-bottom:18px;border-bottom:3px solid ${color};margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#6b7280">Offer Letter</div>
          <div style="font-size:18px;font-weight:700;color:#111;margin-top:4px">${vendor}</div>
        </div>
        <div style="text-align:right;font-size:10px;color:#9ca3af">Page ${n}</div>
      </div>
    </div>
    <div class="body-content" style="flex:1;min-height:480px;padding:${pad};line-height:1.65">
      <p><br></p>
    </div>
    <div data-section="footer" style="flex-shrink:0;margin-top:auto">
      ${footerNote}
    </div>
  </div>`
}

export function layoutLabel(id: string): string {
  return layoutThumbnailLabel(id)
}

export { normalizeOfferLayoutId } from '@/lib/offerLayoutShells'

export function findBestOfferTemplate(
  templates: { id: string; designation_id?: string | null; department_id?: string | null; store_id?: string | null; is_default: boolean }[],
  scope: { designation_id?: string; department_id?: string; store_id?: string },
) {
  if (!templates.length) return null
  let best = templates[0]
  let bestScore = -1
  for (const t of templates) {
    let score = 0
    if (scope.designation_id && t.designation_id === scope.designation_id) score += 4
    if (scope.department_id && t.department_id === scope.department_id) score += 2
    if (scope.store_id && t.store_id === scope.store_id) score += 1
    if (score === 0 && t.is_default) score = 10
    if (score > bestScore) { bestScore = score; best = t }
  }
  return best
}

export function defaultWatermark(vendorName?: string): OfferWatermarkOptions {
  return { enabled: false, text: vendorName || '', opacity: 0.12, style: 'diagonal_text' }
}
