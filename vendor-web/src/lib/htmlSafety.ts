/**
 * Defences for HTML that is generated from business data and then previewed, printed or exported
 * to PDF (invoices, quotations, POS receipts, purchase orders, ...).
 *
 * Why this exists: the document builders interpolate data such as the customer name, notes and
 * item names straight into HTML strings, and some of that data is typed by customers (storefront,
 * POS). The finished HTML is then written into same-origin frames/windows or injected into the
 * app's own DOM for PDF export, where an `<img onerror=...>` would run with the vendor's session.
 *
 * Three layers, so no single miss is enough:
 *  1. `escapeDocData`      -- escape the data before it is put into HTML (fixes the root cause).
 *  2. `withNoScriptCsp`    -- a Content-Security-Policy that forbids script in print/preview frames.
 *  3. `stripActiveContent` -- remove scripts / handlers / javascript: URLs before HTML goes into
 *                             the app's own DOM (PDF export), where a CSP tag would not apply.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
}

/** Keys whose value is deliberately HTML (the server sanitises it on save and on read). */
const RAW_HTML_KEYS: ReadonlySet<string> = new Set(['template_pages_html'])
const MAX_DEPTH = 8

/**
 * Deep copy of ``value`` with every string HTML-escaped. Numbers, booleans and null pass through.
 * The document builders only ever insert these values as HTML text or quoted attribute values, where
 * escaping is exactly right (an escaped `&` in a URL attribute still means `&` to the browser).
 */
export function escapeDocData<T>(value: T, rawKeys: ReadonlySet<string> = RAW_HTML_KEYS, depth = 0): T {
  if (typeof value === 'string') return escapeHtml(value) as unknown as T
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value
  if (Array.isArray(value)) {
    return value.map((item) => escapeDocData(item, rawKeys, depth + 1)) as unknown as T
  }
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = rawKeys.has(key) ? item : escapeDocData(item, rawKeys, depth + 1)
  }
  return out as T
}

// ── Layer 2: Content-Security-Policy for frames/windows we write HTML into ─────────────────────

/** No script of any kind (this also blocks inline `onerror=` style handlers); everything else works. */
const NO_SCRIPT_POLICY = "script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"
const CSP_MARKER = 'data-kiterp-csp'

export function withNoScriptCsp(html: string): string {
  if (!html || html.includes(CSP_MARKER)) return html
  const meta = `<meta http-equiv="Content-Security-Policy" content="${NO_SCRIPT_POLICY}" ${CSP_MARKER}>`
  // It must come before any other content, but after the doctype (anything before it triggers quirks mode).
  // The HTML parser moves a leading <meta> into <head>.
  const doctype = html.match(/^\s*<!doctype[^>]*>/i)
  return doctype ? doctype[0] + meta + html.slice(doctype[0].length) : meta + html
}

/** `document.write` into a window we opened, with the no-script policy applied. */
export function writeSafeHtml(target: Window, html: string): void {
  target.document.write(withNoScriptCsp(html))
  target.document.close()
}

// ── Layer 3: strip active content before HTML is injected into the app's own DOM ───────────────

const DROP_SELECTOR = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'link', 'form',
  'foreignObject', 'meta[http-equiv]',
].join(',')

const URL_ATTRS = new Set([
  'href', 'src', 'xlink:href', 'background', 'poster', 'data', 'action', 'formaction', 'ping', 'longdesc',
])
const DROP_ATTRS = new Set(['srcdoc', 'formaction', 'action'])

function isUnsafeUrl(raw: string): boolean {
  // Browsers ignore whitespace/control characters inside the scheme ("java\nscript:").
  const value = raw.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase()
  if (/^(javascript|vbscript):/.test(value)) return true
  return value.startsWith('data:') && !value.startsWith('data:image/')
}

/**
 * Remove everything that can run code or load active content, keeping layout, styles and images.
 * Works on a parsed (inert) document, so entity tricks like `jav&#x61;script:` are already decoded.
 */
export function stripActiveContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll(DROP_SELECTOR).forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || DROP_ATTRS.has(name)) el.removeAttribute(attr.name)
      else if (URL_ATTRS.has(name) && isUnsafeUrl(attr.value)) el.removeAttribute(attr.name)
    }
  })
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML
}
