/**
 * Shared utilities for generating print-ready HTML documents.
 *
 * Core problem this solves:
 * - Images served from the backend require an Authorization header that browser
 *   <img> tags inside a popup window cannot send.
 * - Simply prepending window.location.origin to a relative path is wrong when
 *   the static files live on a different port (backend) and Vite only proxies /api.
 * - Blindly concatenating backendApiBase + path breaks data: URLs and absolute URLs.
 *
 * Solution: fetch each image with the stored auth token, convert to a base64
 * data URL, and embed it directly in the generated HTML so the print window
 * needs zero network requests.
 */
// ── Backend base URL ──────────────────────────────────────────────────────────

function getBackendBase(): string {
  const apiUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL
    || 'http://127.0.0.1:8000/api/v1'
  // Strip /api/v1 suffix to get the raw origin
  return apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
}

/**
 * Resolve a logo/signature path to an absolute URL.
 * - data: URLs are returned unchanged
 * - Absolute http(s) URLs are returned unchanged
 * - Relative paths are prefixed with the backend origin
 */
export function resolveMediaUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('data:')) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/')) return `${getBackendBase()}${path}`
  return `${getBackendBase()}/${path}`
}

/**
 * Fetch an image (with the stored Bearer token) and return it as a base64
 * data URL so it can be embedded directly in print HTML.
 *
 * Returns '' on any failure so the template gracefully shows the placeholder.
 */
export async function fetchAsDataUrl(url: string): Promise<string> {
  if (!url) return ''
  if (url.startsWith('data:')) return url  // already embedded

  const resolved = resolveMediaUrl(url)
  if (!resolved) return ''

  try {
    const token = localStorage.getItem('access_token') || ''
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(resolved, { headers })
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string) || '')
      reader.onerror  = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

/**
 * Print an HTML document via a hidden <iframe> — no popup window ever appears.
 * The browser's native print dialog opens directly, exactly like Ctrl+P.
 */
export function openPrintWindow(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    // iframes not available — fall back to popup
    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print() }, 800) }
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Wait for images / fonts inside the iframe to finish loading
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      // Clean up after the user closes the print dialog
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }, 3000)
    }
  }, 700)
}

// ── CDN html2pdf.js loader ────────────────────────────────────────────────────
// html2pdf.js bundles a patched version of html2canvas that correctly renders
// border-bottom, flex layouts, and other CSS that the standalone html2canvas
// npm package mishandles (borders appear as dashes, text misaligns, etc.).
// We load it once from CDN and cache it on window.

declare global {
  interface Window { html2pdf?: unknown }
}

const HTML2PDF_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'

function loadHtml2Pdf(): Promise<(...args: unknown[]) => {
  set(o: unknown): unknown; from(el: unknown): unknown; save(): Promise<void>
}> {
  return new Promise((resolve, reject) => {
    if (typeof window.html2pdf === 'function') {
      resolve(window.html2pdf as never)
      return
    }
    const existing = document.querySelector(`script[src="${HTML2PDF_CDN}"]`)
    const tag = existing ?? document.createElement('script')
    if (!existing) {
      (tag as HTMLScriptElement).src = HTML2PDF_CDN
      ;(tag as HTMLScriptElement).crossOrigin = 'anonymous'
      document.head.appendChild(tag)
    }
    tag.addEventListener('load', () => resolve(window.html2pdf as never))
    tag.addEventListener('error', () => reject(new Error('html2pdf CDN load failed')))
    // Race: script may already be in DOM and executed
    if (existing && typeof window.html2pdf === 'function') {
      resolve(window.html2pdf as never)
      return
    }
  })
}

/**
 * Download a document as a PDF directly to the local machine's Downloads folder.
 *
 * Uses html2pdf.js (CDN, loaded once and cached) which bundles a patched
 * html2canvas that correctly renders CSS borders, flex layouts, and fonts —
 * unlike the standalone html2canvas npm package which renders border-bottom
 * as dashes and misaligns flex containers.
 *
 * The PDF is generated entirely in-page (a hidden off-screen div), so no popup
 * window appears.  jsPDF.save() triggers a silent browser download.
 *
 * @param margin       Extra whitespace (mm) on all sides. Default 5 mm.
 * @param orientation  PDF page orientation. Default 'portrait'.
 */
export async function downloadAsPdf(
  html: string,
  filename: string,
  opts: { margin?: number; orientation?: 'portrait' | 'landscape'; imageQuality?: number } = {},
): Promise<void> {
  const safeName     = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_')
  const margin       = Math.max(0, opts.margin ?? 5)
  const orientation  = opts.orientation ?? 'portrait'
  const imageQuality = Math.min(1, Math.max(0.5, opts.imageQuality ?? 0.98))

  // ── Mount off-screen container with the FULL HTML (head styles + body) ─────
  // We extract the <style> blocks separately so CSS classes (.page, table, etc.)
  // apply correctly — html2pdf needs real computed styles, not just inline ones.
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(m => `<style>${m[1]}</style>`).join('\n')

  const bodyMatch   = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html

  const container = document.createElement('div')
  container.style.cssText = [
    'position:absolute', 'left:-9999px', 'top:0',
    'width:900px',        // wider than any template's max-width (800 px)
    'background:#ffffff',
  ].join(';')
  container.innerHTML = styleBlocks + bodyContent
  document.body.appendChild(container)

  try {
    const h2p = await loadHtml2Pdf()

    // Target just the .page element (invoice content) to avoid capturing the
    // grey outer background that the body background sets.
    const target = (container.querySelector('.page') as HTMLElement | null) ?? container

    type Chain = {
      set: (o: Record<string, unknown>) => Chain
      from: (el: HTMLElement) => Chain
      save: () => Promise<void>
    }
    const chain = h2p() as Chain
    await chain
      .set({
        margin,
        filename:    safeName,
        image:       { type: 'jpeg', quality: imageQuality },
        html2canvas: {
          scale:    2,
          useCORS:  true,
          logging:  false,
          letterRendering: true,   // fixes character-spacing / kerning
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(target)
      .save()
  } catch {
    // CDN unavailable — fall back to jsPDF image approach
    _pdfFallback(html, safeName, margin, orientation)
  } finally {
    document.body.removeChild(container)
  }
}

/** jsPDF-only fallback when CDN is unavailable (no html2canvas). */
async function _pdfFallback(
  html: string, safeName: string, margin: number, orientation: 'portrait' | 'landscape',
): Promise<void> {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { _downloadHtmlFallback(html, safeName.replace(/\.pdf$/i, '') + '.html'); return }
  const base = html.replace(/<\/body>\s*<\/html>\s*$/i, '')
  w.document.write(`${base}
<script src="${HTML2PDF_CDN}" crossorigin="anonymous"><\/script>
<script>
window.addEventListener('load',function(){
  html2pdf().set({margin:${margin},filename:'${safeName}',
    image:{type:'jpeg',quality:.97},
    html2canvas:{scale:2,useCORS:true,letterRendering:true},
    jsPDF:{unit:'mm',format:'a4',orientation:'${orientation}'}})
  .from(document.querySelector('.page')||document.body).save()
  .then(function(){setTimeout(function(){window.close()},600)});
});
<\/script></body></html>`)
  w.document.close()
}

function _downloadHtmlFallback(html: string, name: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── WhatsApp & SMS sharing ────────────────────────────────────────────────────

/**
 * Build a clean share message for invoices/POs.
 */
export function buildShareMessage(opts: {
  type: 'invoice' | 'po' | 'receipt'
  number: string
  vendorName: string
  customerOrSupplier: string
  total: number | string
  items?: Array<{ name: string; qty: number; amount: number }>
  date?: string
  status?: string
}): string {
  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const label = opts.type === 'po' ? 'Purchase Order' : opts.type === 'receipt' ? 'Receipt' : 'Invoice'
  const lines: string[] = [
    `*${opts.vendorName}*`,
    `${label}: *${opts.number}*`,
    opts.date ? `Date: ${opts.date}` : '',
    opts.customerOrSupplier ? `To: ${opts.customerOrSupplier}` : '',
    '',
  ]
  if (opts.items?.length) {
    opts.items.slice(0, 5).forEach(it =>
      lines.push(`• ${it.name} × ${it.qty}  –  ${fmt(it.amount)}`)
    )
    if (opts.items.length > 5) lines.push(`  …and ${opts.items.length - 5} more item(s)`)
    lines.push('')
  }
  lines.push(`*Total: ${typeof opts.total === 'number' ? fmt(opts.total) : opts.total}*`)
  if (opts.status) lines.push(`Status: ${opts.status}`)
  return lines.filter(l => l !== undefined).join('\n')
}

/**
 * Generate a PDF Blob from invoice HTML without downloading it.
 * Used by the WhatsApp PDF sharing flow.
 */
export async function generatePdfBlob(
  html: string,
  opts: { margin?: number; orientation?: 'portrait' | 'landscape'; imageQuality?: number } = {},
): Promise<Blob | null> {
  const margin       = opts.margin ?? 5
  const orientation  = opts.orientation ?? 'portrait'
  const imageQuality = Math.min(1, Math.max(0.5, opts.imageQuality ?? 0.98))

  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(m => `<style>${m[1]}</style>`).join('\n')
  const bodyMatch   = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px;background:#ffffff'
  container.innerHTML = styleBlocks + bodyContent
  document.body.appendChild(container)

  try {
    const h2p = await loadHtml2Pdf()
    const target = (container.querySelector('.page') as HTMLElement | null) ?? container
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain = (h2p as any)()
    const blob: Blob = await chain
      .set({
        margin,
        image:       { type: 'jpeg', quality: imageQuality },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
        jsPDF:       { unit: 'mm', format: 'a4', orientation },
        pagebreak:   { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(target)
      .output('blob')
    return blob instanceof Blob ? blob : null
  } catch {
    return null
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container)
  }
}

/**
 * Share an invoice/receipt via WhatsApp as a PDF attachment.
 *
 * Strategy (in order):
 * 1. Generate the PDF blob from the invoice HTML.
 * 2a. Mobile / Web-Share-capable browsers: use navigator.share({ files }) →
 *     the OS native share-sheet opens and the user picks WhatsApp.
 * 2b. Desktop / unsupported: download the PDF silently and open WhatsApp Web
 *     with a text pre-fill so the user can attach the saved file themselves.
 */
export async function shareInvoiceViaWhatsApp(opts: {
  html: string
  filename: string
  phone?: string | null
  textMessage: string
  pdfOpts?: { margin?: number; orientation?: 'portrait' | 'landscape'; imageQuality?: number }
}): Promise<void> {
  const { html, filename, phone, textMessage, pdfOpts } = opts
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`

  let blob: Blob | null = null
  try {
    blob = await generatePdfBlob(html, pdfOpts)
  } catch { /* ignore — fall back to text */ }

  // ── Path A: Web Share API with file (mobile / Chromium 86+ on HTTPS) ────
  if (blob && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      const file = new File([blob], safeName, { type: 'application/pdf' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: safeName.replace(/\.pdf$/i, '') })
        return
      }
    } catch (err) {
      // User cancelled (AbortError) or share failed — fall through
      if ((err as DOMException)?.name === 'AbortError') return
    }
  }

  // ── Path B: Desktop fallback — download PDF + open WhatsApp text ─────────
  if (blob) {
    // Silently download the PDF so the user has it ready to attach
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = safeName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  // Open WhatsApp with the text (with a note about the downloaded PDF)
  const note = blob ? '\n\n_(PDF receipt downloaded — please attach it to this chat)_' : ''
  const clean = (phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '')
  const waUrl = clean
    ? `https://wa.me/${clean}?text=${encodeURIComponent(textMessage + note)}`
    : `https://wa.me/?text=${encodeURIComponent(textMessage + note)}`
  window.open(waUrl, '_blank')
}

/**
 * Open WhatsApp with a pre-filled text message only (no PDF).
 * Use shareInvoiceViaWhatsApp for invoice/receipt sharing with PDF.
 */
export function shareViaWhatsApp(message: string, phone?: string | null): void {
  const clean = (phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '')
  const url = clean
    ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

/**
 * Send an SMS with a pre-filled body.
 * Uses the sms: URI scheme — works natively on mobile; desktop may open the
 * default messaging app if configured.
 */
export function shareViaSms(message: string, phone?: string | null): void {
  const clean = (phone || '').replace(/[^0-9+]/g, '')
  // sms: URI — semicolon separator works on both iOS and Android
  const url = clean
    ? `sms:${clean}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`
  window.location.href = url
}
