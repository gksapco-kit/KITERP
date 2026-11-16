import type { InvoiceSettings } from '@/lib/invoiceTemplates'

/**
 * POS receipts are the vendor's invoice settings with a few per-vendor overrides layered on top
 * (stored server-side as `pos_receipt_settings`). The POS settings modal must therefore save
 * only what differs from the invoice settings — never a full copy. A full copy would freeze the
 * invoice settings (terms, bank details, signature, ...) at the moment of saving, so later edits
 * on the Invoice settings page would silently stop reaching POS receipts.
 */

/**
 * What the modal's controls edit. Booleans are the resolved "shown" state of each toggle.
 * The optional keys (receipt text / sizing) use `undefined` or `''` to mean "use the default",
 * which removes the override.
 */
export interface PosModalValues {
  template: InvoiceSettings['template']
  paper_size: InvoiceSettings['paper_size']
  color: string
  show_logo: boolean
  show_hsn: boolean
  show_tax_breakdown: boolean
  show_notes: boolean
  show_signature: boolean
  show_legal_note?: boolean
  receipt_title?: string
  receipt_footer_text?: string
  receipt_signature_label?: string
  receipt_font_size?: number
  receipt_header_font_size?: number
  receipt_url_font_size?: number
  receipt_title_font_size?: number
  receipt_logo_height?: number
  receipt_line_spacing?: number
}

const VALUE_KEYS: (keyof PosModalValues)[] = [
  'template', 'paper_size', 'color',
  'show_logo', 'show_hsn', 'show_tax_breakdown', 'show_notes', 'show_signature', 'show_legal_note',
  'receipt_title', 'receipt_footer_text', 'receipt_signature_label',
  'receipt_font_size', 'receipt_header_font_size', 'receipt_url_font_size', 'receipt_title_font_size',
  'receipt_logo_height', 'receipt_line_spacing',
]

// Toggles are "on" unless explicitly false (matches how the templates read them).
const BOOLEAN_KEYS = new Set<keyof PosModalValues>([
  'show_logo', 'show_hsn', 'show_tax_breakdown', 'show_notes', 'show_signature', 'show_legal_note',
])

/** A control left blank means "no override" (follow the invoice settings / built-in default). */
function isUnset(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

function baseValue(base: Partial<InvoiceSettings>, key: keyof PosModalValues): unknown {
  const v = (base as Record<string, unknown>)[key]
  return BOOLEAN_KEYS.has(key) ? v !== false : v
}

/**
 * Overrides to save: the existing POS overrides, with the modal's controls applied.
 * A control whose value equals the invoice setting is removed, so it keeps following the invoice
 * settings. Overrides the modal has no control for (custom pages, footer text, ...) are preserved.
 */
export function buildPosOverrides(
  base: Partial<InvoiceSettings>,
  existing: Partial<InvoiceSettings>,
  values: PosModalValues,
): Partial<InvoiceSettings> {
  const out: Record<string, unknown> = { ...existing }
  for (const key of VALUE_KEYS) {
    const v = values[key]
    if (isUnset(v) || v === baseValue(base, key)) delete out[key]
    else out[key] = v
  }
  return out as Partial<InvoiceSettings>
}

/** Settings used to render a POS document: invoice settings, then overrides, then live control values. */
export function previewPosSettings(
  base: Partial<InvoiceSettings>,
  existing: Partial<InvoiceSettings>,
  values: PosModalValues,
): Partial<InvoiceSettings> {
  const live: Record<string, unknown> = { ...existing }
  // A blank control must not wipe out a value coming from the invoice settings.
  for (const key of VALUE_KEYS) {
    if (isUnset(values[key])) delete live[key]
    else live[key] = values[key]
  }
  return { ...base, ...live } as Partial<InvoiceSettings>
}
