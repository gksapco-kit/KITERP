/**
 * Invoice HTML template generators.
 * Each template returns a full HTML string ready to open in a print window.
 */

export type PaperSize = 'A4' | '2inch' | '3inch' | '4inch'

/** One draggable / togglable section in the invoice layout editor. */
export interface LayoutSection {
  id: string
  label: string
  visible: boolean
}

/** Default section order and visibility for every invoice template. */
export const DEFAULT_LAYOUT_SECTIONS: LayoutSection[] = [
  { id: 'header',    label: 'Business Header',        visible: true },
  { id: 'meta',      label: 'Invoice Info & Bill To',  visible: true },
  { id: 'items',     label: 'Line Items',              visible: true },
  { id: 'totals',    label: 'Totals & Tax Summary',    visible: true },
  { id: 'gst',       label: 'GST / Supply Info',       visible: true },
  { id: 'footer',    label: 'Bank + Notes + Signature', visible: true },
  { id: 'legal',     label: 'Legal Footer Line',       visible: true },
]

export const INVOICE_TEMPLATE_IDS = [
  'classic', 'modern', 'minimal', 'luxury', 'corporate', 'colorblock', 'compact', 'bold', 'visual',
  'centered', 'letterhead', 'banner', 'executive', 'stripe',
  'gstpro', 'retail', 'sideright', 'framed', 'slimleft', 'premiumright',
  'leftlogo', 'rightlogo',
  'footerleft', 'footerright',
  'toprightbottomleft', 'topleftbottomright',
  'toprightlogobottomleft',
  'topleftlogobottomright',
] as const

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATE_IDS)[number]

export type UrlPosition =
  | 'auto'
  | 'below-address'
  | 'header'
  | 'header-left'
  | 'header-right'
  | 'meta'
  | 'footer'
  | 'footer-left'
  | 'footer-right'

export const URL_POSITION_OPTIONS: { id: UrlPosition; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto (per theme)', hint: 'Uses the best position for the active template' },
  { id: 'below-address', label: 'Below address', hint: 'Under vendor address in the header' },
  { id: 'header', label: 'Header', hint: 'End of the header section' },
  { id: 'header-left', label: 'Header left', hint: 'Left side of the header' },
  { id: 'header-right', label: 'Header right', hint: 'Right side of the header' },
  { id: 'meta', label: 'Invoice meta', hint: 'Near invoice number / bill to' },
  { id: 'footer', label: 'Footer', hint: 'Above signature & bank details' },
  { id: 'footer-left', label: 'Footer left', hint: 'Bottom-left of the document' },
  { id: 'footer-right', label: 'Footer right', hint: 'Bottom-right of the document' },
]

export const INVOICE_TEMPLATE_LABELS: Record<InvoiceTemplateId, string> = {
  classic: 'Classic',
  modern: 'Modern',
  minimal: 'Minimal',
  luxury: 'Luxury',
  corporate: 'Corporate',
  colorblock: 'Colorblock',
  compact: 'Compact',
  bold: 'Bold',
  visual: 'Visual',
  rightlogo: 'Right Logo',
  leftlogo: 'Left Logo',
  centered: 'Centered',
  letterhead: 'Letterhead',
  banner: 'Banner',
  executive: 'Executive',
  stripe: 'Stripe',
  gstpro: 'GST Pro',
  retail: 'Retail',
  sideright: 'Side Right',
  framed: 'Framed',
  slimleft: 'Slim Left',
  premiumright: 'Premium Right',
  footerleft: 'Footer Left',
  footerright: 'Footer Right',
  toprightbottomleft: 'Top Right · Bottom Left',
  topleftbottomright: 'Top Left · Bottom Right',
  toprightlogobottomleft: 'Top Right Logo · Bottom Left Logo',
  topleftlogobottomright: 'Top Left Logo · Bottom Right Logo',
}

export type LogoShape =
  | 'square' | 'rounded' | 'circle' | 'pill' | 'sharp'
  | 'squircle' | 'oval' | 'diamond' | 'hexagon' | 'arch' | 'shield'

export const LOGO_SHAPES: { id: LogoShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'squircle', label: 'Squircle' },
  { id: 'circle', label: 'Circle' },
  { id: 'oval', label: 'Oval' },
  { id: 'pill', label: 'Pill' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'arch', label: 'Arch' },
  { id: 'shield', label: 'Shield' },
]

export function logoShapeBorderRadius(shape: LogoShape = 'rounded'): string {
  switch (shape) {
    case 'circle':
    case 'oval': return '50%'
    case 'pill': return '9999px'
    case 'squircle': return '28%'
    case 'rounded': return '8px'
    case 'square': return '4px'
    case 'arch': return '50% 50% 6px 6px'
    case 'sharp':
    case 'diamond':
    case 'hexagon':
    case 'shield':
      return '0'
    default: return '8px'
  }
}

export interface InvoiceSettings {
  template: InvoiceTemplateId
  color: string
  paper_size: PaperSize
  logo_url?: string
  /** Clip shape for the company logo on printed documents. Default rounded. */
  logo_shape?: LogoShape
  signature_url?: string
  signatory_name?: string
  show_logo: boolean
  show_phone: boolean
  show_description: boolean
  show_hsn: boolean
  show_bank_details: boolean
  show_signature: boolean
  show_tax_breakdown: boolean
  show_notes: boolean
  show_terms: boolean
  show_gstin: boolean
  show_shipping_address: boolean
  show_place_of_supply: boolean
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  account_holder_name?: string
  upi_id?: string
  default_notes?: string
  default_terms?: string
  default_payment_terms?: string
  /** Show a sequential item number (#) column in the line-items table. */
  show_item_numbers?: boolean
  /** Show the Discount column in the line-items table. */
  show_discount?: boolean
  /** Where to display discounts: per-item column, summary row in totals, or both. Default 'both'. */
  discount_display?: 'column' | 'summary' | 'both'
  /** Custom label for the discount row in totals (default "Discount"). */
  discount_label?: string

  // ── Tax display settings ──────────────────────────────────────────
  /** Show the taxable amount row (subtotal after discount) in the totals block. */
  show_taxable_amount?: boolean
  /** Show the round-off row in the totals block. */
  show_round_off?: boolean
  /** Show total amount in words below the totals block. */
  show_amount_in_words?: boolean
  /** Show a note that prices are inclusive of all taxes. */
  show_tax_inclusive_note?: boolean
  /** Custom label for the combined tax row when breakdown is hidden (default "Tax"). */
  tax_label?: string
  /** Custom label for CGST rows (default "CGST"). */
  cgst_label?: string
  /** Custom label for SGST rows (default "SGST"). */
  sgst_label?: string
  /** Custom label for IGST rows (default "IGST"). */
  igst_label?: string

  /** Optional stamp/label text on the document (e.g. "ORIGINAL", "DUPLICATE", "DRAFT"). */
  watermark?: string
  /** Where to place the watermark stamp. Default 'diagonal'. */
  watermark_position?: 'top' | 'bottom' | 'diagonal'
  /** Font size of the watermark stamp. Default 'md'. */
  watermark_size?: 'sm' | 'md' | 'lg'
  /** Opacity of the watermark stamp (0–1). Default 0.15 for top/bottom, 0.07 for diagonal. */
  watermark_opacity?: number
  /** Extra whitespace margin (mm) added on all sides when downloading as PDF. Default 5. */
  pdf_margin?: number
  /** PDF page orientation. Default portrait. */
  pdf_orientation?: 'portrait' | 'landscape'
  /** JPEG quality for PDF image rendering (0–1). Default 0.98 = high. */
  pdf_image_quality?: number
  /** Show a product thumbnail image alongside each line item. Default false. */
  show_product_images?: boolean
  /** Show the vendor/business address in the invoice header. Default true. */
  show_vendor_address?: boolean
  /** Show the Bill To / customer section on the invoice. Default true. */
  show_customer_address?: boolean
  /** Global font size scale applied to the entire document. Default 'md'. */
  font_size_scale?: 'sm' | 'md' | 'lg'
  /** Ordered list of layout sections; controls position and visibility. */
  layout_sections?: LayoutSection[]

  // ── QR Code ──────────────────────────────────────────────────────────
  /** Data URL or URL of a QR code image to print on the document. */
  qr_code_url?: string
  /** Whether to print the QR code on the document. Default false. */
  show_qr_code?: boolean
  /** Optional label shown below the QR code (e.g. "Scan to Pay", "Verify"). */
  qr_code_label?: string
  /** Where to place the QR code. Default 'footer'. */
  qr_code_position?: 'footer' | 'header'

  // ── Website URL ────────────────────────────────────────────────────────
  /** Custom website / store URL printed on the document. Empty string = hidden. */
  website_url?: string
  /** Show website URL on the document. Default false. */
  show_url?: boolean
  /** Where to place the URL. 'auto' picks the best spot per template theme. */
  url_position?: UrlPosition

  // ── Additional visibility toggles ────────────────────────────────────
  /** Show customer email in the Bill To section. Default true. */
  show_customer_email?: boolean
  /** Show financial year (F.Y.) in the invoice meta box. Default true. */
  show_financial_year?: boolean
  /** Show due date in the invoice meta box. Default true. */
  show_due_date?: boolean
  /** Show booking/reference number in the header. Default true. */
  show_booking_number?: boolean
  /** Show the copy label ("ORIGINAL FOR RECIPIENT") in the header. Default true. */
  show_copy_label?: boolean
  /** Show the Amount Paid row in totals. Default true. */
  show_amount_paid?: boolean
  /** Show the Balance Due row in totals. Default true. */
  show_balance_due?: boolean
  /** Show the legal footer line ("Computer generated invoice..."). Default true. */
  show_legal_note?: boolean
  /** Show Payment Terms in the GST Info / footer area. Default true. */
  show_payment_terms?: boolean
}

export const PAPER_SIZES: { id: PaperSize; label: string; sub: string; cssSize: string; maxWidth: string }[] = [
  { id: 'A4',     label: 'A4',     sub: '210 × 297 mm',  cssSize: 'A4',         maxWidth: '800px' },
  { id: '4inch',  label: '4"',     sub: '104 mm wide',   cssSize: '104mm auto', maxWidth: '98mm'  },
  { id: '3inch',  label: '3"',     sub: '80 mm wide',    cssSize: '80mm auto',  maxWidth: '74mm'  },
  { id: '2inch',  label: '2"',     sub: '58 mm wide',    cssSize: '58mm auto',  maxWidth: '52mm'  },
]

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  template: 'classic',
  color: '#1a56db',
  paper_size: 'A4',
  logo_shape: 'rounded',
  show_logo: true,
  show_phone: true,
  show_description: true,
  show_hsn: true,
  show_bank_details: true,
  show_signature: true,
  show_tax_breakdown: true,
  show_notes: true,
  show_terms: false,
  show_gstin: true,
  show_shipping_address: false,
  show_place_of_supply: true,
  show_item_numbers: false,
  show_discount: false,
  discount_display: 'both',
  discount_label: 'Discount',
  show_taxable_amount: false,
  show_round_off: true,
  show_amount_in_words: false,
  show_tax_inclusive_note: false,
  tax_label: 'Tax',
  cgst_label: 'CGST',
  sgst_label: 'SGST',
  igst_label: 'IGST',
  show_product_images: false,
  show_vendor_address: true,
  show_customer_address: true,
  watermark: '',
  pdf_margin: 5,
  pdf_orientation: 'portrait',
  pdf_image_quality: 0.98,
  font_size_scale: 'md',
  layout_sections: DEFAULT_LAYOUT_SECTIONS,
  show_qr_code: false,
  qr_code_label: 'Scan to Pay',
  qr_code_position: 'footer',
  show_url: false,
  url_position: 'auto',
  show_customer_email: true,
  show_financial_year: true,
  show_due_date: true,
  show_booking_number: true,
  show_copy_label: true,
  show_amount_paid: true,
  show_balance_due: true,
  show_legal_note: true,
  show_payment_terms: true,
}

/** Defaults when quotation template settings have never been saved. */
export const DEFAULT_QUOTATION_SETTINGS: InvoiceSettings = {
  ...DEFAULT_INVOICE_SETTINGS,
  show_amount_paid: false,
  show_balance_due: false,
  show_terms: true,
  show_payment_terms: false,
  default_terms: 'This quotation is valid until the date shown above. Prices are subject to change after expiry.',
}

export type InvoiceColorPaletteId = 'professional' | 'fresh' | 'vivid' | 'warm'

export const INVOICE_COLOR_PALETTE_GROUPS: { id: InvoiceColorPaletteId | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'professional', label: 'Professional' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
]

export const TEMPLATE_COLORS: {
  label: string
  value: string
  palette: InvoiceColorPaletteId
}[] = [
  { label: 'Blue',    value: '#1a56db', palette: 'professional' },
  { label: 'Teal',    value: '#0694a2', palette: 'fresh' },
  { label: 'Green',   value: '#057a55', palette: 'fresh' },
  { label: 'Purple',  value: '#6c2bd9', palette: 'vivid' },
  { label: 'Red',     value: '#c81e1e', palette: 'warm' },
  { label: 'Orange',  value: '#b45309', palette: 'warm' },
  { label: 'Slate',   value: '#334155', palette: 'professional' },
  { label: 'Rose',    value: '#9d174d', palette: 'vivid' },
  { label: 'Indigo',  value: '#4f46e5', palette: 'professional' },
  { label: 'Sky',     value: '#0284c7', palette: 'fresh' },
  { label: 'Emerald', value: '#10b981', palette: 'fresh' },
  { label: 'Amber',   value: '#f59e0b', palette: 'warm' },
  { label: 'Pink',    value: '#ec4899', palette: 'vivid' },
  { label: 'Violet',  value: '#7c3aed', palette: 'vivid' },
  { label: 'Navy',    value: '#1e40af', palette: 'professional' },
  { label: 'Gold',    value: '#ca8a04', palette: 'warm' },
]

export function getTemplateColorLabel(hex: string): string {
  const match = TEMPLATE_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase())
  return match?.label ?? 'Custom'
}

import { resolveMediaUrl, fetchAsDataUrl, openPrintWindow } from './printUtils'

// ── POS-specific invoice settings (localStorage) ─────────────────────────────

export const POS_INV_SETTINGS_KEY = 'pos_invoice_settings'

/** Load POS-specific invoice settings from localStorage. */
export function loadPosInvoiceSettings(): Partial<InvoiceSettings> {
  try {
    const raw = localStorage.getItem(POS_INV_SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as Partial<InvoiceSettings>) : {}
  } catch {
    return {}
  }
}

/** Persist POS-specific invoice settings to localStorage. */
export function savePosInvoiceSettings(settings: Partial<InvoiceSettings>): void {
  try {
    localStorage.setItem(POS_INV_SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* quota errors — silently ignore */ }
}

type InvData = Record<string, unknown>

function isQuotationDoc(inv: InvData): boolean {
  return inv.invoice_type === 'estimate'
}

/** Rewrite invoice-centric labels in generated HTML for quotation documents. */
function applyQuotationLabels(html: string, inv: InvData): string {
  if (!isQuotationDoc(inv)) return html
  let out = html
  out = out.replace(/<title>Invoice /g, '<title>Quotation ')
  out = out.replace(/TAX INVOICE/g, 'QUOTATION')
  out = out.replace(/(?<=>)INVOICE(?=<)/g, 'QUOTATION')
  out = out.replace(/Invoice No\.?/g, 'Quotation No.')
  out = out.replace(/Invoice Date/g, 'Quotation Date')
  out = out.replace(/Due Date/g, 'Valid Until')
  out = out.replace(/>Due:</g, '>Valid:')
  out = out.replace(/>Due </g, '>Valid ')
  out = out.replace(/Computer generated invoice[^<]*/gi, 'Computer generated quotation.')
  out = out.replace(/valid tax invoice/gi, 'valid quotation')
  out = out.replace(/<tr[^>]*>[\s\S]*?Amount Paid[\s\S]*?<\/tr>/gi, '')
  out = out.replace(/<tr[^>]*>[\s\S]*?Balance Due[\s\S]*?<\/tr>/gi, '')
  out = out.replace(/Balance Due:/g, '')
  out = out.replace(/Paid in Full/g, '')
  return out
}

function fmt(n: unknown): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function fmtDate(d?: string | null): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

function vendorAddr(addr?: Record<string, string> | null): string {
  if (!addr) return ''
  const street = addr.street_address || addr.street || addr.address_line1 || addr.line1
  const line2 = addr.line2 || addr.address_line2
  const state = addr.state || addr.region
  const postal = addr.postal_code || addr.pincode || addr.zip
  return [street, line2, addr.city, state, postal, addr.country].filter(Boolean).join(', ')
}

function addressHasContent(addr?: Record<string, string> | null): boolean {
  if (!addr || typeof addr !== 'object') return false
  return !!vendorAddr(addr) || !!(addr.label || addr.phone || '').trim()
}

/**
 * Resolve invoice template logo path.
 * Empty string means the user explicitly removed the logo (no fallback).
 * Undefined/null falls back to the vendor logo on the document.
 */
export function resolveInvoiceTemplateLogoPath(
  settings: Partial<InvoiceSettings>,
  vendorLogoUrl?: string | null,
): string {
  if (settings.show_logo === false) return ''
  if (settings.logo_url === '') return ''
  if (settings.logo_url) return settings.logo_url
  return vendorLogoUrl || ''
}

/** Resolve website URL for invoice print — settings override, then document vendor field. */
export function resolveWebsiteUrl(
  settings: Partial<InvoiceSettings>,
  inv?: InvData,
): string {
  if (settings.website_url === '') return ''
  const custom = settings.website_url?.trim()
  if (custom) return custom
  return String(inv?.vendor_website_url || inv?.vendor_website || '').trim()
}

const TEMPLATE_DEFAULT_URL_POSITION: Partial<Record<InvoiceTemplateId, Exclude<UrlPosition, 'auto'>>> = {
  leftlogo: 'header-left',
  slimleft: 'header-left',
  footerleft: 'footer-left',
  toprightlogobottomleft: 'footer-left',
  toprightbottomleft: 'footer-left',
  rightlogo: 'header-right',
  premiumright: 'header-right',
  sideright: 'header-right',
  footerright: 'footer-right',
  topleftlogobottomright: 'footer-right',
  topleftbottomright: 'footer-right',
  centered: 'below-address',
  letterhead: 'below-address',
  corporate: 'below-address',
  banner: 'header-right',
  executive: 'below-address',
  minimal: 'below-address',
  modern: 'below-address',
  luxury: 'header-right',
  colorblock: 'header-left',
  compact: 'meta',
  retail: 'footer',
  gstpro: 'meta',
}

function resolvedUrlPosition(settings: InvoiceSettings): Exclude<UrlPosition, 'auto'> {
  const pos = settings.url_position ?? 'auto'
  if (pos !== 'auto') return pos
  return TEMPLATE_DEFAULT_URL_POSITION[settings.template] ?? 'below-address'
}

function vendorUrlLine(settings: InvoiceSettings, inv: InvData, extraStyle = ''): string {
  if (!(settings.show_url ?? false)) return ''
  const url = resolveWebsiteUrl(settings, inv)
  if (!url) return ''
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const display = url.replace(/^https?:\/\//i, '')
  const safeHref = href.replace(/"/g, '&quot;')
  return `<div class="inv-vendor-url" style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.4;word-break:break-all;${extraStyle}"><span style="color:#9ca3af">Website:</span> <a href="${safeHref}" style="color:#4b5563;text-decoration:none">${display}</a></div>`
}

function injectInMarkedSection(
  html: string,
  sectionId: string,
  transform: (content: string) => string,
): string {
  const re = new RegExp(`(<!--INV:${sectionId}:S-->)([\\s\\S]*?)(<!--INV:${sectionId}:E-->)`, 'g')
  return html.replace(re, (_, open, content, close) => open + transform(content) + close)
}

function injectAfterVendorContact(content: string, line: string): string {
  if (content.includes('inv-vendor-url')) return content
  const addrRe = /(<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1\.[45][^"]*">[\s\S]*?<\/div>)/
  if (addrRe.test(content)) return content.replace(addrRe, `$1\n${line}`)
  const gstinRe = /(<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN:[^<]*<\/div>)/
  if (gstinRe.test(content)) return content.replace(gstinRe, `$1\n${line}`)
  const nameRe = /(<div style="font-size:(?:20|22)px;font-weight:[^"]*">[^<]*<\/div>)/
  if (nameRe.test(content)) return content.replace(nameRe, `$1\n${line}`)
  return `${content}\n${line}`
}

function injectWebsiteUrl(html: string, settings: InvoiceSettings, inv: InvData): string {
  const line = vendorUrlLine(settings, inv)
  if (!line) return html

  const pos = resolvedUrlPosition(settings)

  switch (pos) {
    case 'below-address':
      return injectInMarkedSection(html, 'header', c => injectAfterVendorContact(c, line))
    case 'header':
      return injectInMarkedSection(html, 'header', c => (c.includes('inv-vendor-url') ? c : `${c}\n${line}`))
    case 'header-left':
      return injectInMarkedSection(html, 'header', c => (
        c.includes('inv-vendor-url') ? c : `${vendorUrlLine(settings, inv, 'text-align:left;')}\n${c}`
      ))
    case 'header-right':
      return injectInMarkedSection(html, 'header', c => (
        c.includes('inv-vendor-url') ? c : `${c}\n${vendorUrlLine(settings, inv, 'text-align:right;')}`
      ))
    case 'meta':
      return injectInMarkedSection(html, 'meta', c => (c.includes('inv-vendor-url') ? c : `${c}\n${line}`))
    case 'footer':
      return injectInMarkedSection(html, 'footer', c => (c.includes('inv-vendor-url') ? c : `${line}\n${c}`))
    case 'footer-left':
      return injectInMarkedSection(html, 'footer', c => (
        c.includes('inv-vendor-url') ? c : `${vendorUrlLine(settings, inv, 'text-align:left;margin-bottom:8px;')}\n${c}`
      ))
    case 'footer-right':
      return injectInMarkedSection(html, 'footer', c => (
        c.includes('inv-vendor-url') ? c : `${c}\n${vendorUrlLine(settings, inv, 'text-align:right;margin-top:8px;')}`
      ))
    default:
      return html
  }
}

function thermalVendorUrlLine(settings: InvoiceSettings, inv: InvData): string {
  if (!(settings.show_url ?? false)) return ''
  const url = resolveWebsiteUrl(settings, inv)
  if (!url) return ''
  const display = url.replace(/^https?:\/\//i, '')
  return `<div class="c inv-vendor-url" style="font-size:${settings.paper_size === '2inch' ? '7px' : '8px'};margin-top:2px">${display}</div>`
}

/**
 * Resolve the logo URL safely — handles data:, absolute, and relative paths.
 * backendApiBase is kept for backward-compat but resolveMediaUrl does the real work.
 */
function resolveLogoUrl(settings: InvoiceSettings, inv: InvData, _backendApiBase: string): string {
  const path = resolveInvoiceTemplateLogoPath(settings, inv.vendor_logo_url as string)
  if (!path) return ''
  return resolveMediaUrl(path)
}

function parseLogoHeightPx(style: string, fallback = 64): number {
  const match = style.match(/height:\s*(\d+)px/i)
  return match ? parseInt(match[1], 10) : fallback
}

function logoClipWrap(url: string, base: string, w: number, h: number, clipPath: string): string {
  return `<span style="display:inline-block;width:${w}px;height:${h}px;clip-path:${clipPath};-webkit-clip-path:${clipPath};overflow:hidden;flex-shrink:0;line-height:0;vertical-align:middle;"><img src="${url}" style="${base}width:100%;height:100%;object-fit:cover;display:block;" crossorigin="anonymous"/></span>`
}

function logoTag(url: string, style: string, shape: LogoShape = 'rounded'): string {
  if (!url) return ''
  const size = parseLogoHeightPx(style)
  const cleanStyle = style
    .replace(/border-radius:[^;]+;?/gi, '')
    .replace(/object-fit:[^;]+;?/gi, '')
    .replace(/aspect-ratio:[^;]+;?/gi, '')
    .replace(/clip-path:[^;]+;?/gi, '')
    .replace(/\bwidth:\s*[^;]+;?/gi, '')
    .replace(/max-width:\s*[^;]+;?/gi, '')
    .replace(/height:\s*[^;]+;?/gi, '')
    .replace(/display:\s*block;?/gi, '')
    .trim()
    .replace(/;\s*;/g, ';')

  const base = cleanStyle ? `${cleanStyle};` : ''

  switch (shape) {
    case 'circle':
      return `<img src="${url}" style="${base}width:${size}px;height:${size}px;max-width:${size}px;min-width:${size}px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    case 'oval': {
      const w = Math.round(size * 1.45)
      const h = size
      return `<img src="${url}" style="${base}width:${w}px;height:${h}px;max-width:${w}px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    }
    case 'pill':
      return `<img src="${url}" style="${base}height:${size}px;width:${Math.round(size * 2.1)}px;max-width:${Math.round(size * 2.4)}px;border-radius:9999px;object-fit:contain;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    case 'squircle':
      return `<img src="${url}" style="${base}width:${size}px;height:${size}px;max-width:${size}px;min-width:${size}px;border-radius:28%;object-fit:cover;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    case 'arch':
      return `<img src="${url}" style="${base}width:${size}px;height:${size}px;max-width:${size}px;border-radius:50% 50% 8px 8px;object-fit:cover;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    case 'sharp':
      return `<img src="${url}" style="${base}height:${size}px;max-width:${size * 2}px;border-radius:0;object-fit:contain;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    case 'square':
      return `<img src="${url}" style="${base}width:${size}px;height:${size}px;max-width:${size}px;min-width:${size}px;border-radius:4px;object-fit:contain;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
    case 'diamond':
      return logoClipWrap(url, base, size, size, 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)')
    case 'hexagon':
      return logoClipWrap(url, base, size, size, 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)')
    case 'shield':
      return logoClipWrap(url, base, size, Math.round(size * 1.12), 'polygon(50% 0%, 92% 12%, 92% 58%, 50% 100%, 8% 58%, 8% 12%)')
    case 'rounded':
    default:
      return `<img src="${url}" style="${base}height:${size}px;max-width:${size * 2}px;border-radius:8px;object-fit:contain;display:block;flex-shrink:0;" crossorigin="anonymous"/>`
  }
}

function logoImg(logoUrl: string, style: string, settings: InvoiceSettings): string {
  return logoTag(logoUrl, style, settings.logo_shape ?? 'rounded')
}

const INV_TABLE_CELL_PAD = '8px 10px'
const INV_PAGE_PAD_X = '32px'

function invoiceTableHead(settings: InvoiceSettings, color: string, filled = true): string {
  const tr = filled
    ? `<tr style="background:${color};color:#fff">`
    : `<tr style="border-bottom:2px solid ${color}">`
  const th = filled
    ? `padding:${INV_TABLE_CELL_PAD};font-size:10px;font-weight:600;white-space:nowrap`
    : `padding:${INV_TABLE_CELL_PAD};font-size:10px;font-weight:600;white-space:nowrap;color:${color}`
  return `${tr}
    <th style="${th};text-align:center;width:36px">#</th>
    <th style="${th};text-align:left">ITEM</th>
    ${settings.show_hsn ? `<th style="${th};text-align:center">HSN</th>` : ''}
    <th style="${th};text-align:center;width:48px">QTY</th>
    <th style="${th};text-align:right">RATE</th>
    <th style="${th};text-align:right">DISC</th>
    <th style="${th};text-align:right">TAX</th>
    <th style="${th};text-align:right">AMOUNT</th>
  </tr>`
}

function invoiceItemsSection(items: InvData[], settings: InvoiceSettings, color: string, filled = true): string {
  return `<table style="margin-bottom:16px;width:100%;border-collapse:collapse">
    <thead>${invoiceTableHead(settings, color, filled)}</thead>
    <tbody>${itemRows(items, settings, color)}</tbody>
  </table>`
}

function itemThumb(it: InvData): string {
  const url = (it.image_url || it.image || '') as string
  if (!url) return `<div style="width:40px;height:40px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;flex-shrink:0"></div>`
  return `<img src="${resolveMediaUrl(url)}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;border:1px solid #e5e7eb;flex-shrink:0;display:block" crossorigin="anonymous"/>`
}

function itemRows(items: InvData[], settings: InvoiceSettings, color: string): string {
  const showImg = settings.show_product_images
  // Show discount column only when discount_display includes 'column'
  const showDiscCol = settings.show_discount && (settings.discount_display ?? 'both') !== 'summary'
  return items.map((it, i) => {
    const qty   = Number(it.qty || it.quantity || 0)
    const rate  = Number(it.rate || it.price || 0)
    const disc  = Number(it.discount || 0)
    const tax   = Number(it.cgst_amt || 0) + Number(it.sgst_amt || 0) + Number(it.igst_amt || 0)
    // Taxable amount = qty × rate − line discount (pre-tax). Matches the Subtotal row.
    // We do NOT use it.total which the backend stores as tax-inclusive.
    const total = qty * rate - disc
    const nameCell = showImg
      ? `<div style="display:flex;align-items:center;gap:8px">${itemThumb(it)}<div><div style="font-weight:500">${it.name || ''}</div>${settings.show_description && it.description ? `<div style="font-size:10px;color:#6b7280">${it.description}</div>` : ''}</div></div>`
      : `<div style="font-weight:500">${it.name || ''}</div>${settings.show_description && it.description ? `<div style="font-size:10px;color:#6b7280">${it.description}</div>` : ''}`
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top;color:#6b7280">${i + 1}</td>
      <td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top">${nameCell}</td>
      ${settings.show_hsn ? `<td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top;color:#6b7280">${it.hsn_sac || it.hsn_code || ''}</td>` : ''}
      <td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top">${qty}</td>
      <td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top">${fmt(rate)}</td>
      ${showDiscCol ? `<td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;color:#dc2626">${disc > 0 ? `-${fmt(disc)}` : '-'}</td>` : ''}
      <td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top">${tax > 0 ? fmt(tax) : '-'}</td>
      <td style="padding:${INV_TABLE_CELL_PAD};border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;font-weight:500">${fmt(total)}</td>
    </tr>`
  }).join('')
}

/** Convert a number to Indian-English words (up to crores). */
function numToWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function below100(x: number): string {
    return x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`
  }
  function below1000(x: number): string {
    return x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' + below100(x % 100) : ''}` : below100(x)
  }
  if (n === 0) return 'Zero'
  const rupees = Math.floor(n)
  const paise  = Math.round((n - rupees) * 100)
  let result = ''
  if (rupees >= 10000000) { result += `${below1000(Math.floor(rupees / 10000000))} Crore `; }
  const rem1 = rupees % 10000000
  if (rem1 >= 100000) { result += `${below100(Math.floor(rem1 / 100000))} Lakh `; }
  const rem2 = rem1 % 100000
  if (rem2 >= 1000) { result += `${below1000(Math.floor(rem2 / 1000))} Thousand `; }
  result += below1000(rem2 % 1000)
  result = result.trim()
  return `${result} Rupee${rupees !== 1 ? 's' : ''}${paise > 0 ? ` and ${below100(paise)} Paise` : ' Only'}`
}

function totalsBlock(inv: InvData, settings: InvoiceSettings): string {
  const sub    = Number(inv.subtotal || 0)
  const disc   = Number(inv.discount_amount || 0)
  const taxable = Number(inv.taxable_amount || (sub - disc) || 0)
  const cgst   = Number(inv.cgst_amount || 0)
  const sgst   = Number(inv.sgst_amount || 0)
  const igst   = Number(inv.igst_amount || 0)
  const tax    = Number(inv.total_tax || 0)
  const round  = Number(inv.round_off || 0)
  const total  = Number(inv.total || 0)
  const paid   = Number(inv.amount_paid || 0)
  const bal    = Number(inv.balance_due || 0)

  const discLabel   = settings.discount_label   || 'Discount'
  const taxLabel    = settings.tax_label        || 'Tax'
  const cgstLabel   = settings.cgst_label       || 'CGST'
  const sgstLabel   = settings.sgst_label       || 'SGST'
  const igstLabel   = settings.igst_label       || 'IGST'
  const showDiscSum = disc > 0 && settings.show_discount && (settings.discount_display ?? 'both') !== 'column'

  return `
    <tr><td style="padding:5px 10px;text-align:right;color:#6b7280">Subtotal</td><td style="padding:5px 10px;text-align:right">${fmt(sub)}</td></tr>
    ${showDiscSum ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">${discLabel}</td><td style="padding:5px 10px;text-align:right;color:#dc2626">-${fmt(disc)}</td></tr>` : ''}
    ${settings.show_taxable_amount && (disc > 0 || taxable !== sub) ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">Taxable Amount</td><td style="padding:5px 10px;text-align:right">${fmt(taxable)}</td></tr>` : ''}
    ${settings.show_tax_breakdown && cgst > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">${cgstLabel}</td><td style="padding:5px 10px;text-align:right">${fmt(cgst)}</td></tr>` : ''}
    ${settings.show_tax_breakdown && sgst > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">${sgstLabel}</td><td style="padding:5px 10px;text-align:right">${fmt(sgst)}</td></tr>` : ''}
    ${settings.show_tax_breakdown && igst > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">${igstLabel}</td><td style="padding:5px 10px;text-align:right">${fmt(igst)}</td></tr>` : ''}
    ${!settings.show_tax_breakdown && tax > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">${taxLabel}</td><td style="padding:5px 10px;text-align:right">${fmt(tax)}</td></tr>` : ''}
    ${settings.show_round_off !== false && round !== 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#6b7280">Round Off</td><td style="padding:5px 10px;text-align:right">${fmt(round)}</td></tr>` : ''}
    <tr style="font-weight:700;font-size:14px;border-top:2px solid #111">
      <td style="padding:8px 10px;text-align:right">Total</td>
      <td style="padding:8px 10px;text-align:right">${fmt(total)}</td>
    </tr>
    ${!isQuotationDoc(inv) && (settings.show_amount_paid ?? true) && paid > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#059669">Amount Paid</td><td style="padding:5px 10px;text-align:right;color:#059669">${fmt(paid)}</td></tr>` : ''}
    ${!isQuotationDoc(inv) && (settings.show_balance_due ?? true) && bal > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:#dc2626;font-weight:600">Balance Due</td><td style="padding:5px 10px;text-align:right;color:#dc2626;font-weight:600">${fmt(bal)}</td></tr>` : ''}
    ${settings.show_amount_in_words && total > 0 ? `<tr><td colspan="2" style="padding:6px 10px;border-top:1px dashed #e5e7eb;font-size:10px;color:#6b7280;font-style:italic">Amount in words: <span style="font-weight:500;color:#374151">${numToWords(total)}</span></td></tr>` : ''}
    ${settings.show_tax_inclusive_note ? `<tr><td colspan="2" style="padding:4px 10px;font-size:10px;color:#9ca3af;font-style:italic;text-align:right">* All prices are inclusive of applicable taxes</td></tr>` : ''}
  `
}

function bankBlock(settings: InvoiceSettings): string {
  if (!settings.show_bank_details) return ''
  const { bank_name, account_number, ifsc_code, account_holder_name, upi_id } = settings
  if (!bank_name && !account_number) return ''
  return `<div style="font-size:11px">
    <div style="font-weight:600;margin-bottom:6px;font-size:12px">Bank Details</div>
    ${bank_name ? `<div>Bank: <span style="font-weight:500">${bank_name}</span></div>` : ''}
    ${account_holder_name ? `<div>Name: <span style="font-weight:500">${account_holder_name}</span></div>` : ''}
    ${account_number ? `<div>Account: <span style="font-weight:500">${account_number}</span></div>` : ''}
    ${ifsc_code ? `<div>IFSC: <span style="font-weight:500">${ifsc_code}</span></div>` : ''}
    ${upi_id ? `<div>UPI: <span style="font-weight:500">${upi_id}</span></div>` : ''}
  </div>`
}

function qrBlock(settings: InvoiceSettings, size = 80): string {
  if (!settings.show_qr_code || !settings.qr_code_url) return ''
  const label = settings.qr_code_label || ''
  return `<div style="text-align:center;flex-shrink:0">
    <img src="${settings.qr_code_url}" style="width:${size}px;height:${size}px;object-fit:contain;display:block;margin:0 auto${label ? ' 4px' : ' 0'}" />
    ${label ? `<div style="font-size:9px;color:#6b7280;margin-top:2px">${label}</div>` : ''}
  </div>`
}

function qrBlockHeader(settings: InvoiceSettings): string {
  if (!settings.show_qr_code || !settings.qr_code_url || settings.qr_code_position !== 'header') return ''
  return qrBlock(settings, 56)
}

function qrBlockFooter(settings: InvoiceSettings): string {
  if (!settings.show_qr_code || !settings.qr_code_url || (settings.qr_code_position ?? 'footer') !== 'footer') return ''
  return qrBlock(settings, 80)
}

function signatureBlock(settings: InvoiceSettings, vendorName: string): string {
  if (!settings.show_signature) return ''
  const displayName = settings.signatory_name || vendorName
  return `<div style="text-align:center;min-width:160px">
    ${settings.signature_url
      ? `<img src="${settings.signature_url}" style="height:64px;max-width:180px;object-fit:contain;display:block;margin:0 auto 6px" />`
      : `<div style="height:64px;border-bottom:1.5px solid #374151;width:180px;margin:0 auto 6px"></div>`}
    <div style="font-size:10px;color:#6b7280">Authorised Signatory for</div>
    <div style="font-size:11px;font-weight:600;margin-top:2px">${displayName}</div>
  </div>`
}

function quotationImageUrls(f: { value?: string; values?: string[] }): string[] {
  if (Array.isArray(f.values) && f.values.length) return f.values.filter(Boolean)
  return f.value ? [String(f.value)] : []
}

function quotationExtraFieldsBlock(inv: InvData): string {
  if (!isQuotationDoc(inv)) return ''
  const fields = (inv.extra_fields as Array<{ label?: string; type?: string; value?: string; values?: string[] }>) || []
  const visible = fields.filter(f => {
    if (!f.label) return false
    if (f.type === 'image') return quotationImageUrls(f).length > 0
    return Boolean(f.value)
  })
  if (visible.length === 0) return ''

  const rows = visible.map(f => {
    const label = String(f.label)
    const value = String(f.value || '')
    const type = String(f.type || 'text')
    if (type === 'image') {
      const imgs = quotationImageUrls(f)
      const thumbs = imgs.map((url, i) => {
        const src = resolveMediaUrl(url)
        return `<img src="${src}" alt="${label} ${i + 1}" style="max-height:120px;max-width:160px;object-fit:contain;border-radius:6px;border:1px solid #e5e7eb;margin:0 8px 8px 0" crossorigin="anonymous"/>`
      }).join('')
      return `<div style="margin-bottom:10px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:6px">${label}</div>
        <div style="display:flex;flex-wrap:wrap;align-items:flex-start">${thumbs}</div>
      </div>`
    }
    if (type === 'link') {
      return `<div style="margin-bottom:6px;font-size:11px"><span style="color:#374151;font-weight:600">${label}:</span> <a href="${value}" style="color:#1a56db">${value}</a></div>`
    }
    if (type === 'email') {
      return `<div style="margin-bottom:6px;font-size:11px"><span style="color:#374151;font-weight:600">${label}:</span> <a href="mailto:${value}" style="color:#1a56db">${value}</a></div>`
    }
    if (type === 'phone') {
      return `<div style="margin-bottom:6px;font-size:11px"><span style="color:#374151;font-weight:600">${label}:</span> <span style="color:#6b7280">${value}</span></div>`
    }
    return `<div style="margin-bottom:6px;font-size:11px"><span style="color:#374151;font-weight:600">${label}:</span> <span style="color:#6b7280;white-space:pre-wrap">${value}</span></div>`
  }).join('')

  return `<div style="margin-bottom:14px;padding:12px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:8px">Additional Information</div>
    ${rows}
  </div>`
}

type FooterLogoOpts = { url: string; position: 'left' | 'right' | 'center' | 'bottom-left' | 'bottom-right'; size?: 'sm' | 'md' }

function commonFooter(inv: InvData, settings: InvoiceSettings, footerLogo?: FooterLogoOpts): string {
  const extraFieldsHtml = quotationExtraFieldsBlock(inv)
  const notes      = (inv.notes as string) || settings.default_notes || ''
  const terms      = (inv.terms_and_conditions as string) || settings.default_terms || ''
  const shipAddr   = inv.shipping_address as Record<string, string> | null
  const billAddr   = inv.billing_address as Record<string, string> | null
  const placeOfSupply = inv.place_of_supply as string | null
  const isInterState  = inv.is_inter_state as boolean
  const rawPayTerms = (inv.payment_terms as string) || settings.default_payment_terms || ''
  const payTerms   = (settings.show_payment_terms ?? true) ? rawPayTerms : ''
  const showShipBlock = settings.show_shipping_address && addressHasContent(shipAddr)

  const gstHtml = (showShipBlock) || (settings.show_place_of_supply && placeOfSupply) ? `
    <div style="margin-bottom:14px;display:grid;grid-template-columns:${showShipBlock && settings.show_place_of_supply && placeOfSupply ? '1fr 1fr' : '1fr'};gap:16px">
      ${showShipBlock && shipAddr ? `
      <div style="padding:10px 12px;background:#f8fafc;border-radius:6px;border-left:3px solid #e5e7eb;font-size:11px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:4px">Ship To</div>
        ${shipAddr.label ? `<div style="font-weight:600;font-size:12px">${shipAddr.label}</div>` : ''}
        <div style="color:#6b7280;line-height:1.5;margin-top:2px">${vendorAddr(shipAddr)}</div>
        ${(billAddr && vendorAddr(billAddr) !== vendorAddr(shipAddr)) ? `<div style="font-size:9px;color:#9ca3af;margin-top:4px">Bill To: ${vendorAddr(billAddr)}</div>` : ''}
      </div>` : ''}
      ${settings.show_place_of_supply && placeOfSupply ? `
      <div style="padding:10px 12px;background:#f8fafc;border-radius:6px;font-size:11px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:4px">GST Info</div>
        <div style="margin-bottom:3px"><span style="color:#374151;font-weight:500">Place of Supply:</span> <span style="color:#6b7280">${placeOfSupply}</span></div>
        <div style="margin-bottom:3px"><span style="color:#374151;font-weight:500">Supply Type:</span> <span style="color:#6b7280">${isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</span></div>
        ${payTerms ? `<div><span style="color:#374151;font-weight:500">Payment Terms:</span> <span style="color:#6b7280">${payTerms}</span></div>` : ''}
      </div>` : (payTerms ? `
      <div style="padding:10px 12px;background:#f8fafc;border-radius:6px;font-size:11px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:4px">Payment Terms</div>
        <div style="color:#374151;font-weight:500">${payTerms}</div>
      </div>` : '')}
    </div>` : ''

  const qrHtml = qrBlockFooter(settings)
  const logoH = footerLogo?.size === 'sm' ? 44 : 56
  const footerLogoHtml = footerLogo?.url
    ? logoImg(footerLogo.url, `height:${logoH}px;max-width:100px;object-fit:contain`, settings)
    : ''
  const notesBlock = `<div style="flex:1">
        ${bankBlock(settings)}
        ${settings.show_notes && notes ? `<div style="margin-top:${settings.show_bank_details ? '12px' : '0'};font-size:11px"><div style="font-weight:600;margin-bottom:4px">Notes</div><div style="color:#6b7280;white-space:pre-wrap;line-height:1.5">${notes}</div></div>` : ''}
        ${settings.show_terms && terms ? `<div style="margin-top:8px;font-size:10px;color:#9ca3af;white-space:pre-wrap;line-height:1.5">${terms}</div>` : ''}
      </div>`

  const footerRow = footerLogo?.position === 'left'
    ? `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px">
        <div style="flex-shrink:0;align-self:center">${footerLogoHtml}</div>
        ${notesBlock}
        ${qrHtml}
        ${signatureBlock(settings, String(inv.vendor_name || ''))}
      </div>`
    : footerLogo?.position === 'right'
      ? `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px">
          ${notesBlock}
          ${qrHtml}
          ${signatureBlock(settings, String(inv.vendor_name || ''))}
          <div style="flex-shrink:0;align-self:center">${footerLogoHtml}</div>
        </div>`
      : `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
          ${notesBlock}
          ${qrHtml}
          ${signatureBlock(settings, String(inv.vendor_name || ''))}
        </div>`

  const footerCenterLogo = footerLogo?.position === 'center' && footerLogoHtml
    ? `<div style="display:flex;justify-content:center;margin-top:14px;padding-top:14px;border-top:1px dashed #e5e7eb">${footerLogoHtml}</div>`
    : ''

  const footerBelowLogo = (footerLogo?.position === 'bottom-left' || footerLogo?.position === 'bottom-right') && footerLogoHtml
    ? `<div style="display:flex;justify-content:${footerLogo.position === 'bottom-left' ? 'flex-start' : 'flex-end'};margin-top:14px;padding-top:14px;border-top:1px dashed #e5e7eb">${footerLogoHtml}</div>`
    : ''

  const footerHtml = `
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb">
      ${footerLogo?.position === 'center' ? footerRow + footerCenterLogo : footerRow + footerBelowLogo}
    </div>`

  const legalHtml = (settings.show_legal_note ?? true) ? `
    <div style="margin-top:16px;padding-top:10px;border-top:1px solid #f3f4f6;text-align:center;font-size:10px;color:#9ca3af">
      Computer generated invoice. No signature required. | This is a valid tax invoice.
    </div>` : ''

  return `${extraFieldsHtml}${sec('gst', gstHtml)}${sec('footer', footerHtml)}${sec('legal', legalHtml)}`
}

// ─── Template: Classic ───────────────────────────────────────────────────────

function classicTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#111;background:#f9fafb}
  .page{max-width:800px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none}}
</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="display:flex;align-items:center;gap:14px">
      ${logoImg(logoUrl, 'height:64px;max-width:120px', settings)}
      <div>
        <div style="font-size:20px;font-weight:700;color:#111">${inv.vendor_name || ''}</div>
        ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
        ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px">
      ${qrBlockHeader(settings)}
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:2px">TAX INVOICE</div>
        ${(settings.show_copy_label ?? true) ? '<div style="font-size:9px;color:#9ca3af;margin-top:2px">ORIGINAL FOR RECIPIENT</div>' : ''}
        ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;font-family:monospace">Booking: ${inv.booking_number}</div>` : ''}
      </div>
    </div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:#6b7280;font-size:11px">Invoice No.</span>
        <span style="font-weight:700;font-family:monospace">${inv.invoice_number}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:#6b7280;font-size:11px">Date</span>
        <span>${fmtDate(inv.created_at as string)}</span>
      </div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="display:flex;justify-content:space-between"><span style="color:#6b7280;font-size:11px">Due Date</span><span>${fmtDate(inv.due_date as string)}</span></div>` : ''}
      ${(settings.show_financial_year ?? true) && inv.financial_year ? `<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#6b7280;font-size:11px">F.Y.</span><span>${inv.financial_year}</span></div>` : ''}
    </div>
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="font-size:11px;color:#6b7280">${inv.customer_email}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
  </div>`)}
${sec('items', `
  <table style="margin-bottom:16px;width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:${color};color:#fff">
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:center;font-size:10px;font-weight:600;width:36px">#</th>
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:left;font-size:10px;font-weight:600">ITEM</th>
        ${settings.show_hsn ? `<th style="padding:${INV_TABLE_CELL_PAD};text-align:center;font-size:10px;font-weight:600">HSN</th>` : ''}
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:center;font-size:10px;font-weight:600;width:48px">QTY</th>
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:right;font-size:10px;font-weight:600">RATE</th>
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:right;font-size:10px;font-weight:600">DISC</th>
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:right;font-size:10px;font-weight:600">TAX</th>
        <th style="padding:${INV_TABLE_CELL_PAD};text-align:right;font-size:10px;font-weight:600">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${itemRows(items, settings, color)}</tbody>
  </table>`)}
${sec('totals', `
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <table style="width:280px">
      <tbody>${totalsBlock(inv, settings)}</tbody>
    </table>
  </div>`)}
  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Modern ────────────────────────────────────────────────────────

function modernTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#111;background:#f3f4f6}
  .page{max-width:800px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-radius:0}}
</style></head>
<body><div class="page">
${sec('header', `
  <div style="background:linear-gradient(135deg,${color} 0%,${color}cc 100%);padding:28px 32px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:14px">
        ${logoImg(logoUrl, 'height:56px;max-width:110px;background:#fff;padding:4px', settings)}
        <div>
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px">${inv.vendor_name || ''}</div>
          ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;opacity:.8;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
          ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;opacity:.8;margin-top:2px">${addr}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px">
        ${qrBlockHeader(settings)}
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:900;opacity:.9;letter-spacing:1px">INVOICE</div>
          <div style="font-family:monospace;font-size:14px;margin-top:4px">${inv.invoice_number}</div>
          ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;opacity:.7;margin-top:4px">Booking: ${inv.booking_number}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`)}

  <div style="padding:28px 32px">
${sec('meta', `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;background:#f8fafc;border-radius:8px;padding:14px">
      <div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Invoice Date</div>
        <div style="font-weight:600">${fmtDate(inv.created_at as string)}</div>
      </div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Due Date</div><div style="font-weight:600">${fmtDate(inv.due_date as string)}</div></div>` : '<div></div>'}
      ${settings.show_customer_address !== false ? `<div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Bill To</div>
        <div style="font-weight:700">${inv.customer_name || ''}</div>
        ${settings.show_phone && inv.customer_phone ? `<div style="font-size:10px;color:#6b7280">${inv.customer_phone}</div>` : ''}
        ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:10px;color:#6b7280">GSTIN: ${inv.customer_gstin}</div>` : ''}
      </div>` : '<div></div>'}
    </div>`)}
${sec('items', `
    <table style="margin-bottom:16px">
      <thead>
        <tr style="border-bottom:2px solid ${color}">
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:${color}">#</th>
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:${color}">ITEM</th>
          ${settings.show_hsn ? `<th style="padding:8px 6px;text-align:center;font-size:10px;color:${color}">HSN</th>` : ''}
          <th style="padding:8px 6px;text-align:center;font-size:10px;color:${color}">QTY</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${color}">RATE</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${color}">DISC.</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${color}">TAX</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${color}">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${itemRows(items, settings, color)}</tbody>
    </table>`)}
${sec('totals', `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <div style="background:#f8fafc;border-radius:8px;padding:12px;min-width:260px">
        <table style="width:100%"><tbody>${totalsBlock(inv, settings)}</tbody></table>
      </div>
    </div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Minimal ───────────────────────────────────────────────────────

function minimalTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff}
  .page{max-width:800px;margin:20px auto;padding:40px}
  table{width:100%;border-collapse:collapse}
  @media print{.page{margin:0}}
</style></head>
<body><div class="page">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px">
    <div>
      ${logoImg(logoUrl, 'height:48px;max-width:100px;margin-bottom:8px;display:block', settings)}<br/>
      <div style="font-size:18px;font-weight:700">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${addr}</div>` : ''}
    </div>
    <div style="display:flex;align-items:flex-start;gap:14px">
      ${qrBlockHeader(settings)}
      <div style="text-align:right">
        <div style="font-size:28px;font-weight:300;letter-spacing:2px;color:${color}">INVOICE</div>
        <div style="font-family:monospace;font-size:13px;color:#374151;margin-top:4px">${inv.invoice_number}</div>
        ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#6b7280;font-family:monospace;margin-top:4px">Booking: ${inv.booking_number}</div>` : ''}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:32px">
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:8px">Bill To</div>
      <div style="font-weight:600;font-size:13px">${inv.customer_name || ''}</div>
      ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_email}</div>` : ''}
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
    <div style="text-align:right">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:8px">Invoice Details</div>
      <div style="font-size:11px;margin-bottom:4px"><span style="color:#6b7280">Date: </span>${fmtDate(inv.created_at as string)}</div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:11px"><span style="color:#6b7280">Due: </span>${fmtDate(inv.due_date as string)}</div>` : ''}
    </div>
  </div>

  <!-- Items -->
  <table style="margin-bottom:24px">
    <thead>
      <tr style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
        <th style="padding:8px 4px;text-align:left;font-size:10px;color:#9ca3af;font-weight:500">#</th>
        <th style="padding:8px 4px;text-align:left;font-size:10px;color:#9ca3af;font-weight:500">DESCRIPTION</th>
        ${settings.show_hsn ? `<th style="padding:8px 4px;text-align:center;font-size:10px;color:#9ca3af;font-weight:500">HSN</th>` : ''}
        <th style="padding:8px 4px;text-align:center;font-size:10px;color:#9ca3af;font-weight:500">QTY</th>
        <th style="padding:8px 4px;text-align:right;font-size:10px;color:#9ca3af;font-weight:500">RATE</th>
        <th style="padding:8px 4px;text-align:right;font-size:10px;color:#9ca3af;font-weight:500">DISC.</th>
        <th style="padding:8px 4px;text-align:right;font-size:10px;color:#9ca3af;font-weight:500">TAX</th>
        <th style="padding:8px 4px;text-align:right;font-size:10px;color:#9ca3af;font-weight:500">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${itemRows(items, settings, color)}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <table style="width:240px"><tbody>${totalsBlock(inv, settings)}</tbody></table>
  </div>

  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Luxury ────────────────────────────────────────────────────────

function luxuryTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Georgia',serif;font-size:12px;color:#1f2937;background:#f9fafb}
  .page{max-width:800px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 10px rgba(0,0,0,.08)}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none}}
</style></head>
<body><div class="page">

  <!-- Dark Header -->
  <div style="background:#1f2937;padding:28px 32px;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;right:0;width:200px;height:100%;background:${color};opacity:.15;transform:skewX(-15deg) translateX(30px)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;position:relative">
      <div style="display:flex;align-items:center;gap:14px">
        ${logoImg(logoUrl, 'height:56px;max-width:110px;background:#fff;padding:4px', settings)}
        <div>
          <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px">${inv.vendor_name || ''}</div>
          ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
          ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">${addr}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:12px">
        ${qrBlockHeader(settings)}
        <div style="text-align:right">
          <div style="font-size:11px;color:${color};text-transform:uppercase;letter-spacing:.2em">Tax Invoice</div>
          <div style="font-size:20px;font-weight:700;color:#fff;font-family:monospace;margin-top:4px">${inv.invoice_number}</div>
          ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:4px">Booking: ${inv.booking_number}</div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- Accent bar -->
  <div style="height:4px;background:${color}"></div>

  <div style="padding:28px 32px">
    <!-- Meta row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:20px">
      ${settings.show_customer_address !== false ? `<div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Bill To</div>
        <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
        ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${inv.customer_email}</div>` : ''}
        ${settings.show_phone && inv.customer_phone ? `<div style="font-size:10px;color:#6b7280">${inv.customer_phone}</div>` : ''}
        ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
      </div>` : '<div></div>'}
      <div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Invoice Date</div>
        <div style="font-weight:600">${fmtDate(inv.created_at as string)}</div>
        ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">Due: ${fmtDate(inv.due_date as string)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Total Amount</div>
        <div style="font-size:24px;font-weight:700;color:${color}">${fmt(inv.total)}</div>
        <div style="font-size:10px;margin-top:4px;padding:2px 8px;display:inline-block;background:${inv.balance_due ? '#fef2f2' : '#f0fdf4'};color:${inv.balance_due ? '#dc2626' : '#16a34a'};border-radius:20px">
          ${inv.balance_due ? `Balance Due: ${fmt(inv.balance_due)}` : 'Paid in Full'}
        </div>
      </div>
    </div>

    <!-- Items -->
    <table style="margin-bottom:20px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 8px;text-align:left;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">#</th>
          <th style="padding:10px 8px;text-align:left;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">ITEM</th>
          ${settings.show_hsn ? `<th style="padding:10px 8px;text-align:center;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">HSN</th>` : ''}
          <th style="padding:10px 8px;text-align:center;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">QTY</th>
          <th style="padding:10px 8px;text-align:right;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">RATE</th>
          <th style="padding:10px 8px;text-align:right;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">DISC.</th>
          <th style="padding:10px 8px;text-align:right;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">TAX</th>
          <th style="padding:10px 8px;text-align:right;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${itemRows(items, settings, color)}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <div style="min-width:260px;background:#1f2937;border-radius:8px;padding:14px">
        <table style="width:100%">
          <tbody>
            ${totalsBlock(inv, settings).replace(/color:#6b7280/g, 'color:#9ca3af').replace(/color:#dc2626/g, 'color:#f87171').replace(/color:#059669/g, 'color:#34d399').replace(/#111/g, '#fff').replace(/font-size:14px/g, 'font-size:14px;color:#fff')}
          </tbody>
        </table>
      </div>
    </div>

    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Layout section helpers ───────────────────────────────────────────────────

/** Wrap HTML content in a named section marker pair. */
function sec(id: string, content: string): string {
  return `<!--INV:${id}:S-->${content}<!--INV:${id}:E-->`
}

/**
 * Reorder / hide sections in the generated HTML.
 * Each template wraps its major blocks in <!--INV:id:S-->...<!--INV:id:E--> markers.
 * This function extracts those blocks, reorders them per user config, hides invisible
 * ones, then splices the result back between the pre/post wrappers.
 */
function applyLayout(html: string, settings: InvoiceSettings): string {
  const sections = settings.layout_sections?.length
    ? settings.layout_sections
    : DEFAULT_LAYOUT_SECTIONS

  // Find all marked sections
  const regex = /<!--INV:(\w+):S-->([\s\S]*?)<!--INV:\1:E-->/g
  type Match = { id: string; full: string; start: number; end: number }
  const matches: Match[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    matches.push({ id: m[1], full: m[0], start: m.index, end: m.index + m[0].length })
  }
  if (matches.length === 0) return html

  const before = html.slice(0, matches[0].start)
  const after  = html.slice(matches[matches.length - 1].end)
  const map    = new Map(matches.map(m => [m.id, m.full]))

  // Build ordered visible list
  const order = sections.map(s => s.id)
  // Append any sections that exist in HTML but aren't in the user config (fallback)
  matches.forEach(m => { if (!order.includes(m.id)) order.push(m.id) })

  const visible = new Set(
    sections.filter(s => s.visible).map(s => s.id)
  )
  // Sections not listed in config are visible by default
  matches.forEach(m => { if (!sections.find(s => s.id === m.id)) visible.add(m.id) })

  const body = order
    .filter(id => visible.has(id) && map.has(id))
    .map(id => map.get(id)!)
    .join('\n')

  return before + body + after
}

/**
 * Build CSS to scale fonts and inject a watermark.
 * Uses `zoom` which properly rescales block layout in Chromium (html2pdf) and Edge.
 */
function layoutCss(settings: InvoiceSettings): string {
  const zoomMap = { sm: '0.88', md: '1', lg: '1.12' }
  const zoom    = zoomMap[settings.font_size_scale ?? 'md']
  const wm      = settings.watermark?.trim() ?? ''
  const pos     = settings.watermark_position ?? 'diagonal'
  const sizeMap = { sm: pos === 'diagonal' ? '56px' : '11px', md: pos === 'diagonal' ? '80px' : '13px', lg: pos === 'diagonal' ? '110px' : '16px' }
  const fs      = sizeMap[settings.watermark_size ?? 'md']
  const defaultOpacity = pos === 'diagonal' ? 0.07 : 0.18
  const op      = settings.watermark_opacity ?? defaultOpacity

  let wmCss = ''
  if (wm) {
    if (pos === 'diagonal') {
      wmCss = `
  .page::after{
    content:"${wm.replace(/"/g, '&quot;')}";
    position:fixed;top:50%;left:50%;
    transform:translate(-50%,-50%) rotate(-45deg);
    font-size:${fs};font-weight:900;opacity:${op};
    color:#000;pointer-events:none;white-space:nowrap;
    letter-spacing:8px;
  }`
    } else {
      const placement = pos === 'top'
        ? 'top:0;left:0;right:0;border-bottom:1px solid currentColor;'
        : 'bottom:0;left:0;right:0;border-top:1px solid currentColor;'
      wmCss = `
  .page::after{
    content:"${wm.replace(/"/g, '&quot;')}";
    position:fixed;${placement}
    font-size:${fs};font-weight:700;opacity:${op};
    color:#000;pointer-events:none;
    text-align:center;padding:3px 0;letter-spacing:4px;
    background:rgba(0,0,0,0.03);
  }`
    }
  }
  return zoom === '1' && !wm ? '' : `
  .page{zoom:${zoom}}${wmCss}`
}

// ─── Paper size helpers ───────────────────────────────────────────────────────

function pageCss(paperSize: PaperSize): string {
  const p = PAPER_SIZES.find(s => s.id === paperSize) || PAPER_SIZES[0]
  const margin = paperSize === 'A4' ? '10mm' : '3mm'
  return `@page { size: ${p.cssSize}; margin: ${margin}; }`
}

function isNarrow(paperSize: PaperSize): boolean {
  return paperSize === '2inch' || paperSize === '3inch' || paperSize === '4inch'
}

function injectPageCss(html: string, paperSize: PaperSize, settings: InvoiceSettings): string {
  const css = pageCss(paperSize) + layoutCss(settings)
  return html.replace('</style>', `  ${css}\n</style>`)
}

// ─── Template: Thermal (narrow receipt) ──────────────────────────────────────

function thermalTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const p       = PAPER_SIZES.find(s => s.id === settings.paper_size) || PAPER_SIZES[0]
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)
  const fs      = settings.paper_size === '2inch' ? '8px' : settings.paper_size === '3inch' ? '9px' : '10px'
  const headerFs = settings.paper_size === '2inch' ? '11px' : '13px'

  const sub    = Number(inv.subtotal || 0)
  const disc   = Number(inv.discount_amount || 0)
  const cgst   = Number(inv.cgst_amount || 0)
  const sgst   = Number(inv.sgst_amount || 0)
  const igst   = Number(inv.igst_amount || 0)
  const tax    = Number(inv.total_tax || 0)
  const round  = Number(inv.round_off || 0)
  const total  = Number(inv.total || 0)
  const paid   = Number(inv.amount_paid || 0)
  const bal    = Number(inv.balance_due || 0)

  const notes  = (inv.notes as string) || settings.default_notes || ''
  const terms  = (inv.terms_and_conditions as string) || settings.default_terms || ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',Courier,monospace;font-size:${fs};color:#000;background:#fff}
  .page{width:${p.maxWidth};max-width:${p.maxWidth};margin:0 auto;padding:3px}
  .c{text-align:center}
  .r{text-align:right}
  .b{font-weight:bold}
  .sep{border-top:1px dashed #000;margin:3px 0}
  .row{display:flex;justify-content:space-between;line-height:1.6}
  table{width:100%;border-collapse:collapse;font-size:${fs}}
  th{border-bottom:1px solid #000;padding:1px 2px;font-size:${fs}}
  td{padding:1px 2px;vertical-align:top}
  @media print{body{background:#fff}.page{margin:0}}
  ${pageCss(settings.paper_size)}
</style></head>
<body><div class="page">

  ${logoUrl ? `<div class="c" style="margin-bottom:3px">${logoImg(logoUrl, `height:36px;max-width:${p.maxWidth}`, settings)}</div>` : ''}
  <div class="c b" style="font-size:${headerFs}">${inv.vendor_name || ''}</div>
  ${settings.show_vendor_address !== false && addr ? `<div class="c" style="font-size:${fs}">${addr}</div>` : ''}
  ${settings.show_gstin && inv.vendor_gstin ? `<div class="c">GSTIN: ${inv.vendor_gstin}</div>` : ''}
  ${thermalVendorUrlLine(settings, inv)}

  <div class="sep"></div>
  <div class="c b" style="font-size:${headerFs};letter-spacing:.08em">TAX INVOICE</div>
  <div class="sep"></div>

  <div class="row"><span>Invoice No:</span><span class="b">${inv.invoice_number}</span></div>
  <div class="row"><span>Date:</span><span>${fmtDate(inv.created_at as string)}</span></div>
  ${(settings.show_due_date ?? true) && inv.due_date ? `<div class="row"><span>Due:</span><span>${fmtDate(inv.due_date as string)}</span></div>` : ''}
  ${(settings.show_financial_year ?? true) && inv.financial_year ? `<div class="row"><span>F.Y.:</span><span>${inv.financial_year}</span></div>` : ''}
  ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div class="row"><span>Ref:</span><span>${inv.booking_number}</span></div>` : ''}

  ${settings.show_customer_address !== false ? `
  <div class="sep"></div>
  <div><span class="b">Bill To:</span> ${inv.customer_name || ''}</div>
  ${settings.show_phone && inv.customer_phone ? `<div>${inv.customer_phone}</div>` : ''}
  ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div>${inv.customer_email}</div>` : ''}
  ${settings.show_gstin && inv.customer_gstin ? `<div>GSTIN: ${inv.customer_gstin}</div>` : ''}` : ''}

  <div class="sep"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;width:42%">ITEM</th>
        <th style="text-align:center;width:10%">Q</th>
        <th style="text-align:right;width:22%">RATE</th>
        <th style="text-align:right;width:26%">AMT</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it) => {
        const qty   = Number(it.qty || it.quantity || 0)
        const rate  = Number(it.rate || it.price || 0)
        const disc  = Number(it.discount || 0)
        // Pre-tax taxable amount — consistent with the Subtotal row below.
        const lineAmt = qty * rate - disc
        return `<tr>
          <td>${it.name || ''}</td>
          <td style="text-align:center">${qty}</td>
          <td style="text-align:right">${fmt(rate)}</td>
          <td style="text-align:right">${fmt(lineAmt)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
  ${disc > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(disc)}</span></div>` : ''}
  ${settings.show_tax_breakdown && cgst > 0 ? `<div class="row"><span>CGST</span><span>${fmt(cgst)}</span></div>` : ''}
  ${settings.show_tax_breakdown && sgst > 0 ? `<div class="row"><span>SGST</span><span>${fmt(sgst)}</span></div>` : ''}
  ${settings.show_tax_breakdown && igst > 0 ? `<div class="row"><span>IGST</span><span>${fmt(igst)}</span></div>` : ''}
  ${!settings.show_tax_breakdown && tax > 0 ? `<div class="row"><span>Tax</span><span>${fmt(tax)}</span></div>` : ''}
  ${round !== 0 ? `<div class="row"><span>Round Off</span><span>${fmt(round)}</span></div>` : ''}
  <div class="sep"></div>
  <div class="row b" style="font-size:${headerFs}"><span>TOTAL</span><span>${fmt(total)}</span></div>
  ${paid > 0 ? `<div class="row" style="color:#059669"><span>Paid</span><span>${fmt(paid)}</span></div>` : ''}
  ${bal > 0 ? `<div class="row b" style="color:#dc2626"><span>Balance Due</span><span>${fmt(bal)}</span></div>` : ''}

  ${settings.show_bank_details && (settings.bank_name || settings.account_number) ? `
  <div class="sep"></div>
  <div class="b">Payment Details</div>
  ${settings.bank_name ? `<div>${settings.bank_name}</div>` : ''}
  ${settings.account_holder_name ? `<div>${settings.account_holder_name}</div>` : ''}
  ${settings.account_number ? `<div>A/C: ${settings.account_number}</div>` : ''}
  ${settings.ifsc_code ? `<div>IFSC: ${settings.ifsc_code}</div>` : ''}
  ${settings.upi_id ? `<div>UPI: ${settings.upi_id}</div>` : ''}
  ` : ''}

  ${settings.show_notes && notes ? `
  <div class="sep"></div>
  <div class="b">Notes</div>
  <div style="white-space:pre-wrap">${notes}</div>
  ` : ''}

  ${settings.show_signature ? `
  <div class="sep"></div>
  ${settings.signature_url
    ? `<div class="c"><img src="${settings.signature_url}" style="height:48px;max-width:80%;object-fit:contain;display:block;margin:4px auto"/></div>`
    : `<div style="height:30px;border-bottom:1px solid #000;margin:0 20px 4px"></div>`}
  <div class="c" style="margin-top:2px">Authorised Signatory</div>
  <div class="c b">${settings.signatory_name || (inv.vendor_name || '')}</div>
  ` : ''}

  ${(settings.show_qr_code && settings.qr_code_url) ? `
  <div class="sep"></div>
  <div class="c">
    <img src="${settings.qr_code_url}" style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto"/>
    ${settings.qr_code_label ? `<div style="font-size:${fs};color:#6b7280;margin-top:3px">${settings.qr_code_label}</div>` : ''}
  </div>
  ` : ''}

  <div class="sep"></div>
  <div class="c" style="font-size:${fs}">${(settings.show_legal_note ?? true) ? 'Computer generated. Valid tax invoice.' : ''}</div>
  ${settings.show_terms && terms ? `<div class="sep"></div><div style="font-size:${fs};white-space:pre-wrap">${terms}</div>` : ''}
</div></body></html>`
}

// ─── Template: Corporate ─────────────────────────────────────────────────────

function corporateTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f3f4f6}
  .page{max-width:800px;margin:20px auto;background:#fff;border-left:5px solid ${color}}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-left:5px solid ${color}}}
</style></head>
<body><div class="page">

  <!-- Letterhead -->
  <div style="padding:28px 32px 20px;border-bottom:1px solid #e5e7eb">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;align-items:center;gap:14px">
        ${logoImg(logoUrl, 'height:60px;max-width:120px', settings)}
        <div>
          <div style="font-size:20px;font-weight:800;color:#111;letter-spacing:-0.5px">${inv.vendor_name || ''}</div>
          ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:3px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
          ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px">
        ${qrBlockHeader(settings)}
        <div style="text-align:right;padding-left:20px;border-left:3px solid ${color};min-width:180px">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:${color};font-weight:700">Tax Invoice</div>
          <div style="font-size:22px;font-weight:800;font-family:monospace;color:#111;margin-top:3px">${inv.invoice_number}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px">Date: ${fmtDate(inv.created_at as string)}</div>
          ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:10px;color:#6b7280">Due: ${fmtDate(inv.due_date as string)}</div>` : ''}
          ${(settings.show_financial_year ?? true) && inv.financial_year ? `<div style="font-size:10px;color:#6b7280">F.Y.: ${inv.financial_year}</div>` : ''}
          ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;font-family:monospace;color:#6b7280;margin-top:2px">Ref: ${inv.booking_number}</div>` : ''}
        </div>
      </div>
    </div>
  </div>

  ${settings.show_customer_address !== false ? `
  ${sec('meta', `
  <div style="padding:14px ${INV_PAGE_PAD_X};background:#f8fafc;border-bottom:1px solid #e5e7eb">
    <div style="border-left:4px solid ${color};padding:2px 0 2px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:${color};font-weight:700;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px;line-height:1.35">${inv.customer_name || ''}</div>
      ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.4">${inv.customer_email}</div>` : ''}
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.4">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.4">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>
  </div>`)}` : ''}

  <div style="padding:20px ${INV_PAGE_PAD_X} 28px">
  ${sec('items', invoiceItemsSection(items, settings, color))}
  ${sec('totals', `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <table style="width:260px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table>
    </div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Colorblock ─────────────────────────────────────────────────────

function colorblockTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f3f4f6}
  .page{max-width:800px;margin:20px auto;background:#fff;display:flex;min-height:1000px}
  .sidebar{width:200px;background:${color};flex-shrink:0;padding:28px 18px;display:flex;flex-direction:column;gap:20px}
  .main{flex:1;padding:28px 28px;display:flex;flex-direction:column;gap:20px}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0}}
</style></head>
<body><div class="page">

  <!-- Sidebar -->
  <div class="sidebar">
    ${logoUrl ? `<div style="margin-bottom:4px">${logoImg(logoUrl, 'height:50px;max-width:160px;background:rgba(255,255,255,.15);padding:4px', settings)}</div>` : ''}
    <div>
      <div style="font-size:14px;font-weight:800;color:#fff;line-height:1.3">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:4px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:4px;line-height:1.5">${addr}</div>` : ''}
    </div>
    <div style="border-top:1px solid rgba(255,255,255,.2);padding-top:16px">
      <div style="font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px">Invoice No.</div>
      <div style="font-size:13px;font-weight:700;font-family:monospace;color:#fff;word-break:break-all">${inv.invoice_number}</div>
    </div>
    <div>
      <div style="font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px">Date</div>
      <div style="font-size:11px;font-weight:600;color:#fff">${fmtDate(inv.created_at as string)}</div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.12em;margin-top:8px;margin-bottom:4px">Due Date</div><div style="font-size:11px;font-weight:600;color:#fff">${fmtDate(inv.due_date as string)}</div>` : ''}
    </div>
    <div>
      <div style="font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px">Total</div>
      <div style="font-size:20px;font-weight:800;color:#fff">${fmt(inv.total)}</div>
      <div style="margin-top:4px;font-size:9px;padding:2px 8px;display:inline-block;background:${Number(inv.balance_due) > 0 ? 'rgba(220,38,38,.25)' : 'rgba(22,163,74,.25)'};color:${Number(inv.balance_due) > 0 ? '#fca5a5' : '#86efac'};border-radius:20px">
        ${Number(inv.balance_due) > 0 ? `Due: ${fmt(inv.balance_due)}` : 'Paid in Full'}
      </div>
    </div>
    ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:9px;color:rgba(255,255,255,.5)">Ref: ${inv.booking_number}</div>` : ''}
    ${(settings.show_qr_code && settings.qr_code_url) ? `
    <div style="border-top:1px solid rgba(255,255,255,.2);padding-top:14px;text-align:center">
      <img src="${settings.qr_code_url}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto;background:rgba(255,255,255,.9);border-radius:6px;padding:4px"/>
      ${settings.qr_code_label ? `<div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:4px">${settings.qr_code_label}</div>` : ''}
    </div>` : ''}
  </div>

  <!-- Main content -->
  <div class="main">
    <!-- Bill To -->
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${color};margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:14px">${inv.customer_name || ''}</div>
      ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_email}</div>` : ''}
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : ''}

    <!-- Items -->
    <div>
      <table>
        <thead>
          <tr style="border-bottom:2px solid ${color}">
            <th style="padding:7px 5px;text-align:left;font-size:10px;color:${color}">#</th>
            <th style="padding:7px 5px;text-align:left;font-size:10px;color:${color}">ITEM</th>
            ${settings.show_hsn ? `<th style="padding:7px 5px;text-align:center;font-size:10px;color:${color}">HSN</th>` : ''}
            <th style="padding:7px 5px;text-align:center;font-size:10px;color:${color}">QTY</th>
            <th style="padding:7px 5px;text-align:right;font-size:10px;color:${color}">RATE</th>
            <th style="padding:7px 5px;text-align:right;font-size:10px;color:${color}">DISC.</th>
            <th style="padding:7px 5px;text-align:right;font-size:10px;color:${color}">TAX</th>
            <th style="padding:7px 5px;text-align:right;font-size:10px;color:${color}">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${itemRows(items, settings, color)}</tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end">
      <table style="width:240px"><tbody>${totalsBlock(inv, settings)}</tbody></table>
    </div>

    <div style="margin-top:auto">
      ${commonFooter(inv, settings)}
    </div>
  </div>
</div></body></html>`
}

// ─── Template: Compact ───────────────────────────────────────────────────────

function compactTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:11px;color:#1f2937;background:#fff}
  .page{max-width:800px;margin:20px auto;padding:24px 28px}
  table{width:100%;border-collapse:collapse}
  @media print{.page{margin:0}}
</style></head>
<body><div class="page">

  <!-- Header: compact two-column -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid ${color}">
    <div style="display:flex;align-items:center;gap:10px">
      ${logoImg(logoUrl, 'height:40px;max-width:90px', settings)}
      <div>
        <div style="font-size:15px;font-weight:800;color:#111">${inv.vendor_name || ''}</div>
        ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:9px;color:#6b7280">GSTIN: ${inv.vendor_gstin}</div>` : ''}
        ${settings.show_vendor_address !== false && addr ? `<div style="font-size:9px;color:#6b7280">${addr}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:12px">
      ${qrBlockHeader(settings)}
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:${color};letter-spacing:1px">TAX INVOICE</div>
        <div style="font-family:monospace;font-size:12px;color:#374151;margin-top:2px">${inv.invoice_number}</div>
        <div style="font-size:9px;color:#9ca3af;margin-top:2px">Date: ${fmtDate(inv.created_at as string)}${(settings.show_due_date ?? true) && inv.due_date ? ` | Due: ${fmtDate(inv.due_date as string)}` : ''}${(settings.show_financial_year ?? true) && inv.financial_year ? ` | FY: ${inv.financial_year}` : ''}</div>
        ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:9px;font-family:monospace;color:#6b7280">Ref: ${inv.booking_number}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- Bill To: inline row -->
  ${settings.show_customer_address !== false ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;padding:8px 10px;background:#f8fafc;border-radius:4px;font-size:11px">
    <div>
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-right:6px">Bill To:</span>
      <span style="font-weight:700">${inv.customer_name || ''}</span>
      ${settings.show_phone && inv.customer_phone ? `<span style="color:#6b7280;margin-left:8px">${inv.customer_phone}</span>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<span style="color:#6b7280;margin-left:8px">GSTIN: ${inv.customer_gstin}</span>` : ''}
    </div>
    ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="color:#6b7280">${inv.customer_email}</div>` : '<div></div>'}
  </div>` : ''}

  <!-- Items Table: compact -->
  <table style="margin-bottom:10px;font-size:10.5px">
    <thead>
      <tr style="background:${color};color:#fff">
        <th style="padding:5px 6px;text-align:left;font-size:9px;font-weight:600">#</th>
        <th style="padding:5px 6px;text-align:left;font-size:9px;font-weight:600">ITEM</th>
        ${settings.show_hsn ? `<th style="padding:5px 6px;text-align:center;font-size:9px;font-weight:600">HSN</th>` : ''}
        <th style="padding:5px 6px;text-align:center;font-size:9px;font-weight:600">QTY</th>
        <th style="padding:5px 6px;text-align:right;font-size:9px;font-weight:600">RATE</th>
        <th style="padding:5px 6px;text-align:right;font-size:9px;font-weight:600">DISC.</th>
        <th style="padding:5px 6px;text-align:right;font-size:9px;font-weight:600">TAX</th>
        <th style="padding:5px 6px;text-align:right;font-size:9px;font-weight:600">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, i) => {
        const qty   = Number(it.qty || it.quantity || 0)
        const rate  = Number(it.rate || it.price || 0)
        const disc  = Number(it.discount || 0)
        const tax   = Number(it.cgst_amt || 0) + Number(it.sgst_amt || 0) + Number(it.igst_amt || 0)
        const total = qty * rate - disc
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;font-size:10px">${i + 1}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb">
            <div style="font-weight:500;font-size:10.5px">${it.name || ''}</div>
            ${settings.show_description && it.description ? `<div style="font-size:9px;color:#6b7280">${it.description}</div>` : ''}
          </td>
          ${settings.show_hsn ? `<td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:10px">${it.hsn_sac || ''}</td>` : ''}
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:10px">${qty}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:10px">${fmt(rate)}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:10px">${disc > 0 ? fmt(disc) : '-'}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:10px">${tax > 0 ? fmt(tax) : '-'}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500;font-size:10.5px">${fmt(total)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <table style="width:240px;font-size:11px"><tbody>${totalsBlock(inv, settings)}</tbody></table>
  </div>

  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Bold ──────────────────────────────────────────────────────────

function boldTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f8fafc}
  .page{max-width:800px;margin:20px auto;background:#fff;overflow:hidden}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0}}
</style></head>
<body><div class="page">

  <!-- Hero strip -->
  <div style="background:${color};padding:0">
    <div style="display:flex;justify-content:space-between;align-items:stretch">
      <div style="padding:24px 28px;display:flex;align-items:center;gap:14px">
        ${logoImg(logoUrl, 'height:52px;max-width:110px;background:rgba(255,255,255,.2);padding:4px', settings)}
        <div>
          <div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.5px">${inv.vendor_name || ''}</div>
          ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:9px;color:rgba(255,255,255,.65);margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
          ${settings.show_vendor_address !== false && addr ? `<div style="font-size:9px;color:rgba(255,255,255,.65);margin-top:1px">${addr}</div>` : ''}
        </div>
      </div>
      <div style="background:rgba(0,0,0,.18);padding:24px 28px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;min-width:200px">
        ${qrBlockHeader(settings)}
        <div style="font-size:9px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.15em">Invoice No.</div>
        <div style="font-size:16px;font-weight:800;font-family:monospace;color:#fff;margin-top:2px">${inv.invoice_number}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.55);margin-top:6px">${fmtDate(inv.created_at as string)}</div>
        ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:9px;font-family:monospace;color:rgba(255,255,255,.5);margin-top:2px">Ref: ${inv.booking_number}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- Big total bar -->
  <div style="background:#1f2937;padding:16px 28px;display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;gap:32px">
      ${settings.show_customer_address !== false ? `<div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em">Bill To</div>
        <div style="font-size:13px;font-weight:700;color:#fff;margin-top:2px">${inv.customer_name || ''}</div>
        ${settings.show_phone && inv.customer_phone ? `<div style="font-size:10px;color:#9ca3af">${inv.customer_phone}</div>` : ''}
        ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:10px;color:#9ca3af">GSTIN: ${inv.customer_gstin}</div>` : ''}
      </div>` : ''}
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em">Due Date</div><div style="font-size:12px;font-weight:600;color:#fff;margin-top:2px">${fmtDate(inv.due_date as string)}</div></div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em">Total Amount</div>
      <div style="font-size:30px;font-weight:900;color:${color};line-height:1;margin-top:4px">${fmt(inv.total)}</div>
      <div style="margin-top:5px;font-size:9px;display:inline-block;padding:2px 10px;border-radius:20px;background:${Number(inv.balance_due) > 0 ? 'rgba(220,38,38,.2)' : 'rgba(22,163,74,.2)'};color:${Number(inv.balance_due) > 0 ? '#f87171' : '#4ade80'}">
        ${Number(inv.balance_due) > 0 ? `Balance Due: ${fmt(inv.balance_due)}` : '✓ Paid in Full'}
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <div style="padding:24px 28px 0">
    <table style="margin-bottom:16px">
      <thead>
        <tr style="border-bottom:3px solid ${color}">
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:#374151;font-weight:700">#</th>
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:#374151;font-weight:700">ITEM</th>
          ${settings.show_hsn ? `<th style="padding:8px 6px;text-align:center;font-size:10px;color:#374151;font-weight:700">HSN</th>` : ''}
          <th style="padding:8px 6px;text-align:center;font-size:10px;color:#374151;font-weight:700">QTY</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:#374151;font-weight:700">RATE</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:#374151;font-weight:700">DISC.</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:#374151;font-weight:700">TAX</th>
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:#374151;font-weight:700">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${itemRows(items, settings, color)}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <table style="width:260px"><tbody>${totalsBlock(inv, settings)}</tbody></table>
    </div>
  </div>

  <div style="padding:0 28px 28px">
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Visual (product-image showcase) ───────────────────────────────

function visualTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  const sub    = Number(inv.subtotal || 0)
  const disc   = Number(inv.discount_amount || 0)
  const cgst   = Number(inv.cgst_amount || 0)
  const sgst   = Number(inv.sgst_amount || 0)
  const igst   = Number(inv.igst_amount || 0)
  const tax    = Number(inv.total_tax || 0)
  const round  = Number(inv.round_off || 0)
  const total  = Number(inv.total || 0)
  const paid   = Number(inv.amount_paid || 0)
  const bal    = Number(inv.balance_due || 0)

  const itemCards = items.map((it, i) => {
    const qty   = Number(it.qty || it.quantity || 0)
    const rate  = Number(it.rate || it.price || 0)
    const disc2 = Number(it.discount || 0)
    const tax2  = Number(it.cgst_amt || 0) + Number(it.sgst_amt || 0) + Number(it.igst_amt || 0)
    // Pre-tax taxable amount (consistent with Subtotal row).
    const total2 = qty * rate - disc2
    const imgUrl = (it.image_url || it.image || '') as string
    const hasImg = !!imgUrl

    return `
    <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #f1f5f9${i === 0 ? ';border-top:1px solid #f1f5f9' : ''}">
      <!-- Product image -->
      <div style="flex-shrink:0;width:72px;height:72px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;background:#f8fafc">
        ${hasImg
          ? `<img src="${resolveMediaUrl(imgUrl)}" style="width:72px;height:72px;object-fit:cover;display:block" crossorigin="anonymous"/>`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:22px">&#9638;</div>`}
      </div>
      <!-- Item details -->
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.35">${it.name || ''}</div>
            ${settings.show_description && it.description ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.4">${it.description}</div>` : ''}
            ${settings.show_hsn && (it.hsn_sac || it.hsn_code) ? `<div style="font-size:9px;color:#94a3b8;margin-top:3px">HSN/SAC: ${it.hsn_sac || it.hsn_code}</div>` : ''}
          </div>
          <div style="font-size:15px;font-weight:800;color:${color};white-space:nowrap;flex-shrink:0">${fmt(total2)}</div>
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">
          <div style="font-size:10px;background:#f1f5f9;border-radius:20px;padding:2px 10px;color:#64748b">
            <span style="color:#94a3b8">Qty</span> <strong>${qty}</strong>
          </div>
          <div style="font-size:10px;background:#f1f5f9;border-radius:20px;padding:2px 10px;color:#64748b">
            <span style="color:#94a3b8">Rate</span> <strong>${fmt(rate)}</strong>
          </div>
          ${disc2 > 0 ? `<div style="font-size:10px;background:#fef2f2;border-radius:20px;padding:2px 10px;color:#dc2626"><span style="color:#fca5a5">Disc</span> <strong>-${fmt(disc2)}</strong></div>` : ''}
          ${tax2 > 0 ? `<div style="font-size:10px;background:#f0fdf4;border-radius:20px;padding:2px 10px;color:#16a34a"><span style="color:#86efac">Tax</span> <strong>${fmt(tax2)}</strong></div>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#f8fafc}
  .page{max-width:800px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07)}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none}}
</style></head>
<body><div class="page">

${sec('header', `
  <!-- Visual header: left brand / right invoice badge -->
  <div style="padding:28px 32px;border-bottom:1px solid #f1f5f9">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
      <!-- Brand -->
      <div style="display:flex;align-items:center;gap:14px">
        ${logoImg(logoUrl, 'height:56px;max-width:110px', settings)}
        <div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.4px">${inv.vendor_name || ''}</div>
          ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
          ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
        </div>
      </div>
      <!-- Invoice badge -->
      <div style="display:flex;align-items:flex-start;gap:12px;flex-shrink:0">
        ${qrBlockHeader(settings)}
        <div style="background:${color};border-radius:10px;padding:16px 20px;text-align:right;min-width:180px">
          <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.7);font-weight:600">Tax Invoice</div>
          <div style="font-size:18px;font-weight:900;font-family:monospace;color:#fff;margin-top:4px">${inv.invoice_number}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:6px">${fmtDate(inv.created_at as string)}</div>
          ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">Due: ${fmtDate(inv.due_date as string)}</div>` : ''}
          ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:9px;font-family:monospace;color:rgba(255,255,255,.55);margin-top:4px">Ref: ${inv.booking_number}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`)}

${sec('meta', `
  <!-- Bill To + summary strip -->
  <div style="display:grid;grid-template-columns:1fr auto;gap:0;border-bottom:1px solid #f1f5f9">
    ${settings.show_customer_address !== false ? `<div style="padding:16px 32px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;font-weight:600;margin-bottom:5px">Bill To</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${(settings.show_customer_email ?? true) && inv.customer_email ? `<div style="font-size:11px;color:#64748b">${inv.customer_email}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#64748b;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
    <div style="padding:16px 32px;text-align:right;border-left:1px solid #f1f5f9;display:flex;flex-direction:column;justify-content:center">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;font-weight:600;margin-bottom:5px">Total Amount</div>
      <div style="font-size:28px;font-weight:900;color:${color};line-height:1">${fmt(total)}</div>
      <div style="margin-top:6px;display:inline-flex;align-items:center;justify-content:flex-end">
        <span style="font-size:10px;padding:2px 10px;border-radius:20px;font-weight:600;background:${bal > 0 ? '#fef2f2' : '#f0fdf4'};color:${bal > 0 ? '#dc2626' : '#16a34a'}">
          ${bal > 0 ? `Balance Due: ${fmt(bal)}` : '✓ Paid in Full'}
        </span>
      </div>
    </div>
  </div>`)}

${sec('items', `
  <!-- Product cards -->
  <div style="padding:4px 32px 8px">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;font-weight:600;margin:14px 0 0">
      Items (${items.length})
    </div>
    ${itemCards}
  </div>`)}

${sec('totals', `
  <!-- Totals panel -->
  <div style="display:flex;justify-content:flex-end;padding:0 32px 20px">
    <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;min-width:280px">
      <table style="width:100%;border-collapse:collapse">
        <tbody>
          <tr><td style="padding:8px 14px;color:#64748b;font-size:11px">Subtotal</td><td style="padding:8px 14px;text-align:right;font-size:11px">${fmt(sub)}</td></tr>
          ${disc > 0 ? `<tr><td style="padding:8px 14px;color:#dc2626;font-size:11px">Discount</td><td style="padding:8px 14px;text-align:right;color:#dc2626;font-size:11px">-${fmt(disc)}</td></tr>` : ''}
          ${settings.show_tax_breakdown && cgst > 0 ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:11px">CGST</td><td style="padding:8px 14px;text-align:right;font-size:11px">${fmt(cgst)}</td></tr>` : ''}
          ${settings.show_tax_breakdown && sgst > 0 ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:11px">SGST</td><td style="padding:8px 14px;text-align:right;font-size:11px">${fmt(sgst)}</td></tr>` : ''}
          ${settings.show_tax_breakdown && igst > 0 ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:11px">IGST</td><td style="padding:8px 14px;text-align:right;font-size:11px">${fmt(igst)}</td></tr>` : ''}
          ${!settings.show_tax_breakdown && tax > 0 ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:11px">Tax</td><td style="padding:8px 14px;text-align:right;font-size:11px">${fmt(tax)}</td></tr>` : ''}
          ${round !== 0 ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:11px">Round Off</td><td style="padding:8px 14px;text-align:right;font-size:11px">${fmt(round)}</td></tr>` : ''}
          <tr style="background:${color}">
            <td style="padding:12px 14px;font-weight:800;font-size:13px;color:#fff">Total</td>
            <td style="padding:12px 14px;text-align:right;font-weight:800;font-size:13px;color:#fff">${fmt(total)}</td>
          </tr>
          ${paid > 0 ? `<tr><td style="padding:8px 14px;color:#059669;font-size:11px;font-weight:600">Amount Paid</td><td style="padding:8px 14px;text-align:right;color:#059669;font-size:11px;font-weight:600">${fmt(paid)}</td></tr>` : ''}
          ${bal > 0 ? `<tr><td style="padding:8px 14px;color:#dc2626;font-weight:700;font-size:11px">Balance Due</td><td style="padding:8px 14px;text-align:right;color:#dc2626;font-weight:700;font-size:11px">${fmt(bal)}</td></tr>` : ''}
        </tbody>
      </table>
    </div>
  </div>`)}

  <div style="padding:0 32px 28px">
    ${commonFooter(inv, settings)}
  </div>

</div></body></html>`
}

// ─── Template: Right Logo ────────────────────────────────────────────────────

function rightlogoTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="flex:1;padding-right:20px">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:1px">TAX INVOICE</div>
      ${(settings.show_copy_label ?? true) ? '<div style="font-size:9px;color:#9ca3af;margin-top:2px">ORIGINAL FOR RECIPIENT</div>' : ''}
      <div style="font-size:20px;font-weight:700;color:#111;margin-top:12px">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
      ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;font-family:monospace">Booking: ${inv.booking_number}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;min-width:140px">
      ${logoImg(logoUrl, 'height:72px;max-width:140px;object-fit:contain', settings)}
      ${qrBlockHeader(settings)}
    </div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Invoice No.</span><span style="font-weight:700;font-family:monospace">${inv.invoice_number}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Date</span><span>${fmtDate(inv.created_at as string)}</span></div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="display:flex;justify-content:space-between"><span style="color:#6b7280;font-size:11px">Due Date</span><span>${fmtDate(inv.due_date as string)}</span></div>` : ''}
    </div>
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
  </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Centered ──────────────────────────────────────────────────────

function centeredTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff}.page{max-width:800px;margin:20px auto;padding:36px}@media print{.page{margin:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid ${color}">
    ${logoImg(logoUrl, 'height:64px;max-width:160px;object-fit:contain;margin:0 auto 10px;display:block', settings)}
    <div style="font-size:22px;font-weight:700;color:#111">${inv.vendor_name || ''}</div>
    ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
    ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.5">${addr}</div>` : ''}
    <div style="margin-top:14px;font-size:24px;font-weight:300;letter-spacing:4px;color:${color}">INVOICE</div>
    <div style="font-family:monospace;font-size:13px;color:#374151;margin-top:4px">${inv.invoice_number}</div>
    ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">Ref: ${inv.booking_number}</div>` : ''}
    <div style="margin-top:12px;display:flex;justify-content:center;gap:16px;align-items:flex-start">${qrBlockHeader(settings)}</div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:24px">
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Bill To</div>
      <div style="font-weight:600;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
    <div style="text-align:right">
      <div style="font-size:11px;margin-bottom:4px"><span style="color:#6b7280">Date: </span>${fmtDate(inv.created_at as string)}</div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:11px"><span style="color:#6b7280">Due: </span>${fmtDate(inv.due_date as string)}</div>` : ''}
    </div>
  </div>`)}
${sec('items', invoiceItemsSection(items, settings, color, false))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:260px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Left Logo ─────────────────────────────────────────────────────

function leftlogoTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f3f4f6}.page{max-width:800px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="padding:24px 28px 20px;border-bottom:4px double ${color}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:20px">
      <div style="display:flex;align-items:center;gap:14px;min-width:140px">
        ${logoImg(logoUrl, 'height:72px;max-width:130px;object-fit:contain', settings)}
      </div>
      <div style="flex:1;padding:0 8px">
        <div style="font-size:20px;font-weight:800;color:#111">${inv.vendor_name || ''}</div>
        ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:3px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
        ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.4">${addr}</div>` : ''}
        <div style="margin-top:10px;font-size:18px;font-weight:700;color:${color};letter-spacing:2px">TAX INVOICE</div>
        <div style="font-family:monospace;font-size:12px;color:#374151;margin-top:4px">${inv.invoice_number}</div>
        ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">Ref: ${inv.booking_number}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:72px">
        ${qrBlockHeader(settings)}
      </div>
    </div>
  </div>`)}
  <div style="padding:24px 28px">
${sec('meta', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;background:#f8fafc;border-radius:8px;padding:14px">
      ${settings.show_customer_address !== false ? `<div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Bill To</div>
        <div style="font-weight:700">${inv.customer_name || ''}</div>
        ${settings.show_phone && inv.customer_phone ? `<div style="font-size:10px;color:#6b7280">${inv.customer_phone}</div>` : ''}
        ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:10px;color:#6b7280">GSTIN: ${inv.customer_gstin}</div>` : ''}
      </div>` : '<div></div>'}
      <div style="text-align:right">
        <div style="font-size:11px;color:#6b7280">Date: <strong style="color:#111">${fmtDate(inv.created_at as string)}</strong></div>
        ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">Due: <strong style="color:#111">${fmtDate(inv.due_date as string)}</strong></div>` : ''}
      </div>
    </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Footer Left Logo ───────────────────────────────────────────────

function footerleftTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="flex:1">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:1px">TAX INVOICE</div>
      ${(settings.show_copy_label ?? true) ? '<div style="font-size:9px;color:#9ca3af;margin-top:2px">ORIGINAL FOR RECIPIENT</div>' : ''}
      <div style="font-size:20px;font-weight:700;color:#111;margin-top:12px">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
      ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;font-family:monospace">Booking: ${inv.booking_number}</div>` : ''}
    </div>
    <div>${qrBlockHeader(settings)}</div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Invoice No.</span><span style="font-weight:700;font-family:monospace">${inv.invoice_number}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Date</span><span>${fmtDate(inv.created_at as string)}</span></div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="display:flex;justify-content:space-between"><span style="color:#6b7280;font-size:11px">Due Date</span><span>${fmtDate(inv.due_date as string)}</span></div>` : ''}
    </div>
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
  </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings, logoUrl ? { url: logoUrl, position: 'left' } : undefined)}
</div></body></html>`
}

// ─── Template: Footer Right Logo ─────────────────────────────────────────────

function footerrightTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="flex:1">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:1px">TAX INVOICE</div>
      ${(settings.show_copy_label ?? true) ? '<div style="font-size:9px;color:#9ca3af;margin-top:2px">ORIGINAL FOR RECIPIENT</div>' : ''}
      <div style="font-size:20px;font-weight:700;color:#111;margin-top:12px">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
    </div>
    <div>${qrBlockHeader(settings)}</div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Invoice No.</span><span style="font-weight:700;font-family:monospace">${inv.invoice_number}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:#6b7280;font-size:11px">Date</span><span>${fmtDate(inv.created_at as string)}</span></div>
    </div>
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
    </div>` : '<div></div>'}
  </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings, logoUrl ? { url: logoUrl, position: 'right' } : undefined)}
</div></body></html>`
}

// ─── Template: Top Right Logo · Bottom Left Logo ─────────────────────────────

function toprightlogobottomleftTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="flex:1;padding-right:24px">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:1px">TAX INVOICE</div>
      ${(settings.show_copy_label ?? true) ? '<div style="font-size:9px;color:#9ca3af;margin-top:2px">ORIGINAL FOR RECIPIENT</div>' : ''}
      <div style="font-size:20px;font-weight:700;color:#111;margin-top:12px">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
      ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;font-family:monospace">Booking: ${inv.booking_number}</div>` : ''}
      <div style="font-family:monospace;font-size:12px;color:#374151;margin-top:8px">${inv.invoice_number}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;min-width:140px">
      ${logoImg(logoUrl, 'height:72px;max-width:140px;object-fit:contain', settings)}
      ${qrBlockHeader(settings)}
    </div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Invoice No.</span><span style="font-weight:700;font-family:monospace">${inv.invoice_number}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:#6b7280;font-size:11px">Date</span><span>${fmtDate(inv.created_at as string)}</span></div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#6b7280;font-size:11px">Due Date</span><span>${fmtDate(inv.due_date as string)}</span></div>` : ''}
    </div>
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
  </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings, logoUrl ? { url: logoUrl, position: 'bottom-left', size: 'md' } : undefined)}
</div></body></html>`
}

// ─── Template: Top Right · Bottom Left (legacy id) ───────────────────────────

function toprightbottomleftTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  return toprightlogobottomleftTemplate(inv, settings, backendApiBase)
}

// ─── Template: Top Left Logo · Bottom Right Logo ─────────────────────────────

function topleftlogobottomrightTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-width:140px">
      ${logoImg(logoUrl, 'height:72px;max-width:140px;object-fit:contain', settings)}
      ${qrBlockHeader(settings)}
    </div>
    <div style="flex:1;text-align:right;padding-left:24px">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:1px">TAX INVOICE</div>
      ${(settings.show_copy_label ?? true) ? '<div style="font-size:9px;color:#9ca3af;margin-top:2px">ORIGINAL FOR RECIPIENT</div>' : ''}
      <div style="font-size:20px;font-weight:700;color:#111;margin-top:12px">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${addr}</div>` : ''}
      ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;font-family:monospace">Booking: ${inv.booking_number}</div>` : ''}
      <div style="font-family:monospace;font-size:12px;color:#374151;margin-top:8px">${inv.invoice_number}</div>
    </div>
  </div>`)}
${sec('meta', `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280;font-size:11px">Invoice No.</span><span style="font-weight:700;font-family:monospace">${inv.invoice_number}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:#6b7280;font-size:11px">Date</span><span>${fmtDate(inv.created_at as string)}</span></div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#6b7280;font-size:11px">Due Date</span><span>${fmtDate(inv.due_date as string)}</span></div>` : ''}
    </div>
    ${settings.show_customer_address !== false ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '<div></div>'}
  </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings, logoUrl ? { url: logoUrl, position: 'bottom-right', size: 'md' } : undefined)}
</div></body></html>`
}

// ─── Template: Top Left · Bottom Right (legacy id) ───────────────────────────

function topleftbottomrightTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  return topleftlogobottomrightTemplate(inv, settings, backendApiBase)
}

// ─── Template: Letterhead ──────────────────────────────────────────────────────

function letterheadTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',Georgia,serif;font-size:12px;color:#1f2937;background:#fff}.page{max-width:800px;margin:20px auto;padding:40px 44px;border:1px solid #e5e7eb}@media print{.page{margin:0;border:none}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:1px solid #111;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoImg(logoUrl, 'height:52px;max-width:100px;object-fit:contain', settings)}
      <div>
        <div style="font-size:18px;font-weight:700;color:#111">${inv.vendor_name || ''}</div>
        ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${addr}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right">
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280">GSTIN: ${inv.vendor_gstin}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.15em">Official Tax Invoice</div>
    <div style="display:flex;align-items:center;gap:12px">${qrBlockHeader(settings)}<span style="font-family:monospace;font-size:14px;font-weight:700">${inv.invoice_number}</span></div>
  </div>`)}
${sec('meta', settings.show_customer_address !== false ? `
  <div style="margin-bottom:20px;padding:12px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:4px">Bill To</div>
    <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
    ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
    <div style="font-size:11px;color:#6b7280;margin-top:6px">Date: ${fmtDate(inv.created_at as string)}${(settings.show_due_date ?? true) && inv.due_date ? ` · Due: ${fmtDate(inv.due_date as string)}` : ''}</div>
  </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color, false))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:260px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Banner ────────────────────────────────────────────────────────

function bannerTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)
  const logoBox = logoImg(logoUrl, 'height:48px;max-width:96px;object-fit:contain;background:#fff;border-radius:6px;padding:4px', settings)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f8fafc}.page{max-width:800px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden}@media print{body{background:#fff}.page{margin:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="background:linear-gradient(90deg,${color} 0%,${color}dd 100%);padding:20px 28px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="min-width:110px">${logoBox}</div>
      <div style="flex:1;text-align:center">
        <div style="font-size:22px;font-weight:900;letter-spacing:1px">INVOICE</div>
        <div style="font-size:13px;opacity:.85;margin-top:4px">${inv.vendor_name || ''}</div>
        ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:9px;opacity:.7;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      </div>
      <div style="min-width:110px;display:flex;justify-content:flex-end;text-align:right;font-size:10px;opacity:.9">
        <div>
          <div style="font-weight:700;letter-spacing:.05em">TAX INVOICE</div>
          <div style="font-family:monospace;margin-top:4px;opacity:.85">${inv.invoice_number}</div>
        </div>
      </div>
    </div>
  </div>
  <div style="padding:16px 28px;background:#f8fafc;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
    <div style="font-family:monospace;font-weight:700;font-size:14px;color:${color}">${inv.invoice_number}</div>
    <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:#6b7280">
      ${qrBlockHeader(settings)}
      <span>${fmtDate(inv.created_at as string)}</span>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<span>Due ${fmtDate(inv.due_date as string)}</span>` : ''}
    </div>
  </div>
  ${settings.show_vendor_address !== false && addr ? `<div style="padding:8px 28px;font-size:10px;color:#6b7280;border-bottom:1px solid #f1f5f9">${addr}</div>` : ''}`)}
  <div style="padding:24px 28px">
${sec('meta', settings.show_customer_address !== false ? `
    <div style="margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid ${color}">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:4px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Executive ───────────────────────────────────────────────────────

function executiveTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff}.page{max-width:800px;margin:20px auto;padding:36px}@media print{.page{margin:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;position:relative">
    <div style="flex:1;z-index:1">
      <div style="font-size:11px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px">Tax Invoice</div>
      <div style="font-size:24px;font-weight:700;color:#111;line-height:1.2">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.5;max-width:360px">${addr}</div>` : ''}
      <div style="margin-top:16px;font-family:monospace;font-size:15px;font-weight:600;color:#374151">${inv.invoice_number}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${fmtDate(inv.created_at as string)}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;z-index:1">
      ${logoImg(logoUrl, 'height:96px;max-width:180px;object-fit:contain', settings)}
      ${qrBlockHeader(settings)}
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,${color},transparent);margin-bottom:24px"></div>`)}
${sec('meta', settings.show_customer_address !== false ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Bill To</div>
      <div style="font-weight:600;font-size:14px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>
    ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="text-align:right"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Due Date</div><div style="font-weight:600">${fmtDate(inv.due_date as string)}</div></div>` : '<div></div>'}
  </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color, false))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><div style="background:#f8fafc;border-radius:8px;padding:12px;min-width:260px"><table style="width:100%;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div></div>`)}
  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Stripe ──────────────────────────────────────────────────────────

function stripeTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;overflow:hidden;border-radius:6px}@media print{body{background:#fff}.page{margin:0;border-radius:0}}</style></head>
<body><div class="page">
  <div style="height:6px;background:linear-gradient(90deg,${color} 33%,#1f2937 33%,#1f2937 66%,${color} 66%)"></div>
${sec('header', `
  <div style="padding:22px 28px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb">
    <div style="display:flex;align-items:center;gap:12px;min-width:130px">
      ${logoImg(logoUrl, 'height:50px;max-width:100px;object-fit:contain', settings)}
    </div>
    <div style="text-align:center;flex:1">
      <div style="font-size:19px;font-weight:800;color:#111">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:9px;color:#6b7280;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      <div style="font-size:16px;font-weight:700;color:${color};margin-top:6px;letter-spacing:1px">TAX INVOICE</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:130px">
      ${qrBlockHeader(settings)}
      <div style="font-family:monospace;font-size:11px;color:#6b7280">${inv.invoice_number}</div>
    </div>
  </div>
  ${settings.show_vendor_address !== false && addr ? `<div style="padding:6px 28px;font-size:10px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6">${addr}</div>` : ''}`)}
  <div style="padding:24px 28px">
${sec('meta', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Invoice Details</div>
        <div style="font-family:monospace;font-weight:700">${inv.invoice_number}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">${fmtDate(inv.created_at as string)}</div>
        ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="font-size:11px;color:#6b7280">Due: ${fmtDate(inv.due_date as string)}</div>` : ''}
      </div>
      ${settings.show_customer_address !== false ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px">
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Bill To</div>
        <div style="font-weight:700">${inv.customer_name || ''}</div>
        ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
        ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">GSTIN: ${inv.customer_gstin}</div>` : ''}
      </div>` : '<div></div>'}
    </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: GST Pro (logo left) ───────────────────────────────────────────

function gstproTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f1f5f9}.page{max-width:800px;margin:20px auto;background:#fff;border:1px solid #cbd5e1}@media print{body{background:#fff}.page{margin:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:grid;grid-template-columns:auto 1fr auto;gap:16px;padding:20px 24px;border-bottom:2px solid ${color};align-items:start">
    <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:#f8fafc;min-width:110px;text-align:center">
      ${logoImg(logoUrl, 'height:64px;max-width:100px;object-fit:contain;display:block;margin:0 auto', settings)}
    </div>
    <div>
      <div style="font-size:18px;font-weight:800;color:#111">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">GSTIN: <strong>${inv.vendor_gstin}</strong></div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.4">${addr}</div>` : ''}
    </div>
    <div style="text-align:right;min-width:130px">
      <div style="background:${color};color:#fff;padding:8px 14px;border-radius:4px;font-weight:800;font-size:14px;letter-spacing:1px">TAX INVOICE</div>
      ${(settings.show_copy_label ?? true) ? '<div style="font-size:8px;color:#9ca3af;margin-top:4px">ORIGINAL FOR RECIPIENT</div>' : ''}
      ${qrBlockHeader(settings)}
    </div>
  </div>`)}
  <div style="padding:16px 24px">
${sec('meta', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
      <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden">
        <div style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:5px 10px;text-transform:uppercase;letter-spacing:.08em">Invoice Details</div>
        <div style="padding:10px;font-size:11px;line-height:1.7">
          <div><span style="color:#6b7280">No:</span> <strong style="font-family:monospace">${inv.invoice_number}</strong></div>
          <div><span style="color:#6b7280">Date:</span> ${fmtDate(inv.created_at as string)}</div>
          ${(settings.show_due_date ?? true) && inv.due_date ? `<div><span style="color:#6b7280">Due:</span> ${fmtDate(inv.due_date as string)}</div>` : ''}
          ${(settings.show_financial_year ?? true) && inv.financial_year ? `<div><span style="color:#6b7280">F.Y.:</span> ${inv.financial_year}</div>` : ''}
        </div>
      </div>
      ${settings.show_customer_address !== false ? `<div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden">
        <div style="background:#f1f5f9;font-size:9px;font-weight:700;padding:5px 10px;text-transform:uppercase;letter-spacing:.08em;color:#374151">Bill To</div>
        <div style="padding:10px;font-size:11px;line-height:1.6">
          <div style="font-weight:700;font-size:12px">${inv.customer_name || ''}</div>
          ${settings.show_phone && inv.customer_phone ? `<div style="color:#6b7280">${inv.customer_phone}</div>` : ''}
          ${settings.show_gstin && inv.customer_gstin ? `<div style="color:#6b7280">GSTIN: ${inv.customer_gstin}</div>` : ''}
        </div>
      </div>` : '<div></div>'}
    </div>`)}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:300px;border-collapse:collapse;border:1px solid #e5e7eb"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Retail (logo left) ──────────────────────────────────────────────

function retailTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)
  const total   = Number(inv.total || 0)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff}.page{max-width:800px;margin:20px auto}@media print{.page{margin:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#111;color:#fff">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoImg(logoUrl, 'height:48px;max-width:90px;object-fit:contain;background:#fff;border-radius:4px;padding:3px', settings)}
      <div>
        <div style="font-size:16px;font-weight:800">${inv.vendor_name || ''}</div>
        ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:9px;opacity:.7;margin-top:2px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;opacity:.6;text-transform:uppercase">Invoice Total</div>
      <div style="font-size:26px;font-weight:900;color:${color}">${fmt(total)}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;padding:10px 20px;background:${color}15;border-bottom:2px solid ${color};font-size:11px">
    <span><strong>Invoice:</strong> <span style="font-family:monospace">${inv.invoice_number}</span></span>
    <span><strong>Date:</strong> ${fmtDate(inv.created_at as string)}</span>
    ${(settings.show_due_date ?? true) && inv.due_date ? `<span><strong>Due:</strong> ${fmtDate(inv.due_date as string)}</span>` : ''}
  </div>`)}
  <div style="padding:20px">
${sec('meta', settings.show_customer_address !== false ? `
    <div style="margin-bottom:16px;padding:10px 14px;background:#f8fafc;border-left:4px solid ${color};border-radius:0 6px 6px 0">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px">Customer</div>
      <div style="font-weight:700">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280">${inv.customer_phone}</div>` : ''}
    </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:280px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#9ca3af;text-align:center;margin-top:8px">${addr}</div>` : ''}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Side Right (logo right sidebar) ─────────────────────────────────

function siderightTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f9fafb}.page{max-width:800px;margin:20px auto;background:#fff;display:flex;min-height:600px;border-radius:6px;overflow:hidden}@media print{body{background:#fff}.page{margin:0}}</style></head>
<body><div class="page">
  <div style="flex:1;padding:28px 24px">
    <div style="margin-bottom:20px">
      <div style="font-size:22px;font-weight:800;color:${color}">INVOICE</div>
      <div style="font-family:monospace;font-size:13px;color:#374151;margin-top:4px">${inv.invoice_number}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${fmtDate(inv.created_at as string)}</div>
    </div>
${sec('meta', settings.show_customer_address !== false ? `
    <div style="margin-bottom:18px;padding:12px;background:#f8fafc;border-radius:6px">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Bill To</div>
      <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
      ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280">GSTIN: ${inv.customer_gstin}</div>` : ''}
    </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:260px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${commonFooter(inv, settings)}
  </div>
  <div style="width:150px;background:${color};color:#fff;padding:20px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;flex-shrink:0">
    ${logoImg(logoUrl, 'height:72px;max-width:120px;object-fit:contain;background:rgba(255,255,255,.15);border-radius:6px;padding:6px', settings)}
    <div style="text-align:center;width:100%">
      <div style="font-size:11px;font-weight:700;line-height:1.3">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:8px;opacity:.75;margin-top:6px;word-break:break-all">GSTIN: ${inv.vendor_gstin}</div>` : ''}
    </div>
    <div style="width:100%;height:1px;background:rgba(255,255,255,.25)"></div>
    <div style="font-size:9px;text-align:center;opacity:.8;width:100%">
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="margin-bottom:4px">Due ${fmtDate(inv.due_date as string)}</div>` : ''}
      ${(settings.show_booking_number ?? true) && inv.booking_number ? `<div style="font-family:monospace;font-size:8px">${inv.booking_number}</div>` : ''}
    </div>
    ${qrBlockHeader(settings)}
  </div>
</div></body></html>`
}

// ─── Template: Framed (logo right) ───────────────────────────────────────────

function framedTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;font-size:12px;color:#1f2937;background:#f8fafc}.page{max-width:800px;margin:20px auto;background:#fff;border:3px double ${color};padding:28px 32px}@media print{body{background:#fff}.page{margin:0}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #d1d5db">
    <div style="flex:1;padding-right:16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:${color};font-weight:700">Tax Invoice</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px;color:#111">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.4">${addr}</div>` : ''}
      <div style="margin-top:10px;font-family:monospace;font-size:12px;color:#374151">${inv.invoice_number} · ${fmtDate(inv.created_at as string)}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
      ${logoImg(logoUrl, 'height:80px;max-width:130px;object-fit:contain', settings)}
      ${qrBlockHeader(settings)}
    </div>
  </div>`)}
${sec('meta', settings.show_customer_address !== false ? `
  <div style="margin-bottom:18px;font-size:11px">
    <span style="color:#9ca3af;text-transform:uppercase;font-size:9px;letter-spacing:.1em">Bill To — </span>
    <strong>${inv.customer_name || ''}</strong>
    ${settings.show_phone && inv.customer_phone ? ` · ${inv.customer_phone}` : ''}
    ${settings.show_gstin && inv.customer_gstin ? ` · GSTIN: ${inv.customer_gstin}` : ''}
  </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color, false))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:270px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
  ${commonFooter(inv, settings)}
</div></body></html>`
}

// ─── Template: Slim Left (logo left column) ──────────────────────────────────

function slimleftTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#fff}.page{max-width:800px;margin:20px auto;display:flex;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}@media print{.page{margin:0;border:none}}</style></head>
<body><div class="page">
  <div style="width:170px;background:#f8fafc;border-right:1px solid #e5e7eb;padding:20px 14px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:10px">
    ${logoImg(logoUrl, 'height:70px;max-width:130px;object-fit:contain', settings)}
    <div style="text-align:center;width:100%">
      <div style="font-size:12px;font-weight:800;color:#111;line-height:1.3">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:8px;color:#6b7280;margin-top:6px;word-break:break-all">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:8px;color:#9ca3af;margin-top:6px;line-height:1.4">${addr}</div>` : ''}
    </div>
    <div style="width:100%;height:2px;background:${color};margin-top:4px"></div>
    ${qrBlockHeader(settings)}
  </div>
  <div style="flex:1;padding:22px 24px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div style="font-size:20px;font-weight:800;color:${color}">TAX INVOICE</div>
      <div style="text-align:right;font-size:11px;color:#6b7280">
        <div style="font-family:monospace;font-weight:700;color:#111;font-size:13px">${inv.invoice_number}</div>
        <div style="margin-top:2px">${fmtDate(inv.created_at as string)}</div>
        ${(settings.show_due_date ?? true) && inv.due_date ? `<div>Due: ${fmtDate(inv.due_date as string)}</div>` : ''}
      </div>
    </div>
${sec('meta', settings.show_customer_address !== false ? `
    <div style="margin-bottom:16px;padding:10px 12px;border:1px dashed #d1d5db;border-radius:6px">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px">Bill To</div>
      <div style="font-weight:700">${inv.customer_name || ''}</div>
      ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280">${inv.customer_phone}</div>` : ''}
    </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><table style="width:260px;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Premium Right (logo right, feature strip) ─────────────────────

function premiumrightTemplate(inv: InvData, settings: InvoiceSettings, backendApiBase: string): string {
  const color   = settings.color || '#1a56db'
  const items   = (inv.items as InvData[]) || []
  const addr    = vendorAddr(inv.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, inv, backendApiBase)
  const total   = Number(inv.total || 0)
  const bal     = Number(inv.balance_due || 0)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${inv.invoice_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;background:#f3f4f6}.page{max-width:800px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.06)}@media print{body{background:#fff}.page{margin:0;box-shadow:none}}</style></head>
<body><div class="page">
${sec('header', `
  <div style="padding:24px 28px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
    <div style="flex:1">
      <div style="display:inline-block;background:${color};color:#fff;font-size:9px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Tax Invoice</div>
      <div style="font-size:22px;font-weight:800;color:#111;line-height:1.2">${inv.vendor_name || ''}</div>
      ${settings.show_gstin && inv.vendor_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">GSTIN: ${inv.vendor_gstin}</div>` : ''}
      ${settings.show_vendor_address !== false && addr ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.4">${addr}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
      ${logoImg(logoUrl, 'height:88px;max-width:150px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:6px;background:#fff', settings)}
      ${qrBlockHeader(settings)}
    </div>
  </div>
  <div style="margin:18px 28px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
    <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;border:1px solid #e5e7eb">
      <div style="font-size:8px;color:#9ca3af;text-transform:uppercase">Invoice No</div>
      <div style="font-family:monospace;font-weight:700;font-size:11px;margin-top:3px">${inv.invoice_number}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;border:1px solid #e5e7eb">
      <div style="font-size:8px;color:#9ca3af;text-transform:uppercase">Date</div>
      <div style="font-weight:600;font-size:11px;margin-top:3px">${fmtDate(inv.created_at as string)}</div>
    </div>
    <div style="background:${color}12;border-radius:8px;padding:10px;text-align:center;border:1px solid ${color}40">
      <div style="font-size:8px;color:#6b7280;text-transform:uppercase">Total</div>
      <div style="font-weight:800;font-size:12px;color:${color};margin-top:3px">${fmt(total)}</div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;border:1px solid #e5e7eb">
      <div style="font-size:8px;color:#9ca3af;text-transform:uppercase">Status</div>
      <div style="font-weight:600;font-size:11px;margin-top:3px;color:${bal > 0 ? '#dc2626' : '#059669'}">${bal > 0 ? 'Due' : 'Paid'}</div>
    </div>
  </div>`)}
  <div style="padding:20px 28px 28px">
${sec('meta', settings.show_customer_address !== false ? `
    <div style="margin-bottom:16px;display:flex;gap:16px">
      <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;border-left:4px solid ${color}">
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Bill To</div>
        <div style="font-weight:700;font-size:13px">${inv.customer_name || ''}</div>
        ${settings.show_phone && inv.customer_phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${inv.customer_phone}</div>` : ''}
        ${settings.show_gstin && inv.customer_gstin ? `<div style="font-size:11px;color:#6b7280">GSTIN: ${inv.customer_gstin}</div>` : ''}
      </div>
      ${(settings.show_due_date ?? true) && inv.due_date ? `<div style="padding:12px;background:#fef3c7;border-radius:8px;min-width:120px;text-align:center">
        <div style="font-size:8px;color:#92400e;text-transform:uppercase">Due Date</div>
        <div style="font-weight:700;font-size:12px;color:#92400e;margin-top:4px">${fmtDate(inv.due_date as string)}</div>
      </div>` : ''}
    </div>` : '')}
${sec('items', invoiceItemsSection(items, settings, color))}
${sec('totals', `<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><div style="background:#f8fafc;border-radius:8px;padding:12px;min-width:280px;border:1px solid #e5e7eb"><table style="width:100%;border-collapse:collapse"><tbody>${totalsBlock(inv, settings)}</tbody></table></div></div>`)}
    ${commonFooter(inv, settings)}
  </div>
</div></body></html>`
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generateInvoiceHtml(
  inv: InvData,
  settings: Partial<InvoiceSettings>,
  backendApiBase = '',
): string {
  const s: InvoiceSettings = { ...DEFAULT_INVOICE_SETTINGS, ...settings }
  // Narrow paper sizes always use the thermal receipt template
  if (isNarrow(s.paper_size)) return thermalTemplate(inv, s, backendApiBase)
  let html: string
  switch (s.template) {
    case 'modern':     html = modernTemplate(inv, s, backendApiBase); break
    case 'minimal':    html = minimalTemplate(inv, s, backendApiBase); break
    case 'luxury':     html = luxuryTemplate(inv, s, backendApiBase); break
    case 'corporate':  html = corporateTemplate(inv, s, backendApiBase); break
    case 'colorblock': html = colorblockTemplate(inv, s, backendApiBase); break
    case 'compact':    html = compactTemplate(inv, s, backendApiBase); break
    case 'bold':       html = boldTemplate(inv, s, backendApiBase); break
    case 'visual':     html = visualTemplate(inv, s, backendApiBase); break
    case 'rightlogo':  html = rightlogoTemplate(inv, s, backendApiBase); break
    case 'leftlogo':
    case 'dual':       html = leftlogoTemplate(inv, s, backendApiBase); break
    case 'centered':   html = centeredTemplate(inv, s, backendApiBase); break
    case 'letterhead': html = letterheadTemplate(inv, s, backendApiBase); break
    case 'banner':     html = bannerTemplate(inv, s, backendApiBase); break
    case 'executive':  html = executiveTemplate(inv, s, backendApiBase); break
    case 'stripe':     html = stripeTemplate(inv, s, backendApiBase); break
    case 'gstpro':     html = gstproTemplate(inv, s, backendApiBase); break
    case 'retail':     html = retailTemplate(inv, s, backendApiBase); break
    case 'sideright':  html = siderightTemplate(inv, s, backendApiBase); break
    case 'framed':     html = framedTemplate(inv, s, backendApiBase); break
    case 'slimleft':   html = slimleftTemplate(inv, s, backendApiBase); break
    case 'premiumright': html = premiumrightTemplate(inv, s, backendApiBase); break
    case 'footerleft':   html = footerleftTemplate(inv, s, backendApiBase); break
    case 'footerright':  html = footerrightTemplate(inv, s, backendApiBase); break
    case 'toprightbottomleft':
    case 'topbottom':         html = toprightbottomleftTemplate(inv, s, backendApiBase); break
    case 'toprightlogobottomleft': html = toprightlogobottomleftTemplate(inv, s, backendApiBase); break
    case 'topleftbottomright': html = topleftbottomrightTemplate(inv, s, backendApiBase); break
    case 'topleftlogobottomright': html = topleftlogobottomrightTemplate(inv, s, backendApiBase); break
    default:           html = classicTemplate(inv, s, backendApiBase)
  }
  html = injectWebsiteUrl(html, s, inv)
  html = applyLayout(html, s)
  html = applyQuotationLabels(html, inv)
  return injectPageCss(html, s.paper_size, s)
}

/**
 * Async version: pre-fetches logo + signature as data URLs (with auth token)
 * so the print popup needs no network requests and images always appear.
 */
export async function printInvoice(
  inv: InvData,
  settings: Partial<InvoiceSettings>,
  _backendApiBase = '',
): Promise<void> {
  const s = { ...DEFAULT_INVOICE_SETTINGS, ...settings }

  // Resolve raw paths
  const rawLogo = resolveInvoiceTemplateLogoPath(s, inv.vendor_logo_url as string)
  const rawSig  = s.signature_url || ''
  const items   = (inv.items as InvData[]) || []

  // Pre-fetch logo, signature, and (when enabled) all item images as data URLs.
  // This ensures the print popup needs zero network requests and images always render.
  const needItemImages = s.show_product_images || s.template === 'visual'

  const [logoDataUrl, sigDataUrl, ...itemDataUrls] = await Promise.all([
    s.show_logo      && rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
    s.show_signature && rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
    ...items.map(it => {
      const url = (it.image_url || it.image || '') as string
      return needItemImages && url ? fetchAsDataUrl(url).catch(() => '') : Promise.resolve('')
    }),
  ])

  // Embed pre-fetched item images back onto the item objects
  const enrichedItems = items.map((it, i) => ({
    ...it,
    image_url: itemDataUrls[i] || (it.image_url as string) || '',
  }))

  // Build enriched settings with embedded images; pass '' as base since
  // all URLs are now data: — no network needed inside the popup.
  const enriched: InvoiceSettings = {
    ...s,
    logo_url:      logoDataUrl || undefined,
    signature_url: sigDataUrl  || undefined,
  }

  const html = generateInvoiceHtml(
    { ...inv, vendor_logo_url: logoDataUrl || inv.vendor_logo_url, items: enrichedItems },
    enriched,
    '',
  )
  openPrintWindow(html)
}
