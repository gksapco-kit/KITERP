import {
  parseOfferPageFragments,
  serializeMultiPageCustom,
  isMultiPageOfferHtml,
  countOfferPages,
} from '@/lib/offerPages'

const EDITABLE_STYLES = `
  .page[data-doc-editable="full"]{outline:none;cursor:text;min-height:1122px;box-sizing:border-box}
  .page[data-doc-page-sheet="true"]{min-height:1122px;max-width:800px;width:100%;display:flex;flex-direction:column;box-sizing:border-box}
  .page[data-doc-editable="full"]:focus-within{box-shadow:inset 0 0 0 2px rgba(59,130,246,.45);background:rgba(239,246,255,.15)}
  .page[data-doc-editable="full"] table td,.page[data-doc-editable="full"] table th{min-width:36px}
  .page + .page{margin-top:14px;border-top:2px dashed #e5e7eb;padding-top:14px}
  @media print{.page{page-break-after:always}.page:last-child{page-break-after:auto}}
`

/** Inject editable attributes + styles into generated document HTML. */
export function injectDocumentEditable(html: string): string {
  let out = html
  if (!out.includes('data-doc-editable')) {
    out = out.replace(
      /<div class="page">/g,
      '<div class="page" data-offer-page="1" data-doc-editable="full">',
    )
    if (!out.includes('data-doc-editable')) {
      out = out.replace(
        /<div class="page"([^>]*)>/g,
        '<div class="page"$1 data-offer-page="1" data-doc-editable="full">',
      )
    }
  }
  if (out.includes('</head>') && !out.includes('data-doc-editable-styles')) {
    out = out.replace('</head>', `<style data-doc-editable-styles>${EDITABLE_STYLES}</style></head>`)
  }
  return out
}

/** Wrap stored multi-page/custom HTML for preview or print. */
export function wrapStoredDocumentPages(storedHtml: string, editable = false): string {
  const fragments = parseOfferPageFragments(storedHtml)
  const pages = fragments.map((fragment, i) => {
    let inner = fragment.trim()
    const isPageDiv = inner.startsWith('<div class="page"')
    if (!isPageDiv && inner.startsWith('<div class="page-inner"')) {
      inner = `<div class="page" data-offer-page="${i + 1}">${inner}</div>`
    } else if (!isPageDiv) {
      inner = `<div class="page" data-offer-page="${i + 1}"><div class="page-inner" data-offer-custom="true">${inner}</div></div>`
    } else if (!inner.includes('data-offer-page=')) {
      inner = inner.replace('<div class="page"', `<div class="page" data-offer-page="${i + 1}"`)
    }
    if (editable && !inner.includes('data-doc-editable="full"')) {
      inner = inner.replace('<div class="page"', '<div class="page" data-doc-editable="full"')
    }
    return inner
  })

  const body = pages.join('')
  if (storedHtml.trim().toLowerCase().startsWith('<!doctype') || storedHtml.trim().toLowerCase().startsWith('<html')) {
    let out = storedHtml
    if (editable && !out.includes('data-doc-editable-styles')) {
      out = out.replace('</head>', `<style data-doc-editable-styles>${EDITABLE_STYLES}</style></head>`)
    }
    return out
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1f2937;background:#fff;margin:0;padding:8px}
    ${EDITABLE_STYLES}
  </style></head><body>${body}</body></html>`
}

/** Merge stored page fragments with generated document styles (for print/PDF). */
export function mergeStoredPagesForPrint(generatedHtml: string, storedHtml: string): string {
  const wrapped = wrapStoredDocumentPages(storedHtml, false)
  try {
    const genDoc = new DOMParser().parseFromString(generatedHtml, 'text/html')
    const wrapDoc = new DOMParser().parseFromString(wrapped, 'text/html')
    const styles = Array.from(genDoc.querySelectorAll('style')).map(s => s.outerHTML).join('')
    const title = genDoc.querySelector('title')?.outerHTML ?? '<title>Document</title>'
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${title}${styles}</head><body>${wrapDoc.body.innerHTML}</body></html>`
  } catch {
    return wrapped
  }
}

/** Build preview HTML from generated base + optional stored page overrides. */
export function buildDocumentPreviewHtml(generatedHtml: string, storedPagesHtml?: string, editable = true): string {
  const stored = (storedPagesHtml || '').trim()
  if (stored) {
    return wrapStoredDocumentPages(stored, editable)
  }
  return editable ? injectDocumentEditable(generatedHtml) : generatedHtml
}

/** Replace page 1 in stored HTML with freshly generated page while keeping extra pages. */
export function refreshStoredFirstPage(storedPagesHtml: string, generatedHtml: string): string {
  if (!storedPagesHtml?.trim()) return storedPagesHtml
  const fragments = parseOfferPageFragments(storedPagesHtml)
  if (fragments.length <= 1) return storedPagesHtml

  const doc = new DOMParser().parseFromString(generatedHtml, 'text/html')
  const genPage = doc.querySelector('.page')
  const newFirst = genPage?.outerHTML
    ?? `<div class="page" data-offer-page="1"><div class="page-inner" data-offer-custom="true">${genPage?.innerHTML ?? ''}</div></div>`

  const rest = fragments.slice(1)
  const firstWrapped = newFirst.startsWith('<div class="page"')
    ? newFirst
    : `<div class="page-inner" data-offer-page="1" data-offer-custom="true">${newFirst}</div>`

  if (isMultiPageOfferHtml(storedPagesHtml) || rest.some(f => f.includes('page-inner'))) {
    return serializeMultiPageCustom([firstWrapped, ...rest])
  }
  return storedPagesHtml
}

export function hasStoredDocumentPages(html?: string): boolean {
  return !!(html || '').trim()
}

export { countOfferPages, isMultiPageOfferHtml }

/** A4 continuation sheet (~210×297 mm at 96 dpi). */
export const A4_PAGE_SHEET_STYLE = 'min-height:1122px;max-width:800px;width:100%;margin:0 auto;background:#fff;padding:32px 40px;box-sizing:border-box;display:flex;flex-direction:column;font-family:Arial,sans-serif;font-size:12px;color:#111'

export function createDefaultContinuationPage(pageNumber: number, options?: {
  heading?: string
  subtitle?: string
  accentColor?: string
  footerText?: string
}): string {
  const color = options?.accentColor || '#1a56db'
  const heading = options?.heading || 'Continued'
  const subtitle = options?.subtitle || `Page ${pageNumber}`
  const footer = options?.footerText || 'Continuation page'

  return `<div class="page" data-offer-page="${pageNumber}" data-doc-editable="full" data-doc-page-sheet="true" style="${A4_PAGE_SHEET_STYLE}">
    <div data-section="header" style="flex-shrink:0;padding-bottom:14px;border-bottom:3px solid ${color};margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#6b7280">Document</div>
          <div style="font-size:20px;font-weight:700;color:#111;margin-top:4px">${heading}</div>
        </div>
        <div style="text-align:right;font-size:10px;color:#9ca3af">${subtitle}</div>
      </div>
    </div>
    <div class="body-content" style="flex:1;min-height:480px;padding:8px 0;line-height:1.65">
      <p><br></p>
    </div>
    <div data-section="footer" style="flex-shrink:0;margin-top:auto;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af">
      ${footer}
    </div>
  </div>`
}
