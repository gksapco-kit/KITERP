import type { InvoiceSettings } from '@/lib/invoiceTemplates'

/**
 * POS receipts are the vendor's invoice settings with a few per-vendor overrides layered on top
 * (stored server-side as `pos_receipt_settings`). The POS settings modal must therefore save
 * only what differs from the invoice settings — never a full copy. A full copy would freeze the
 * invoice settings (terms, bank details, signature, ...) at the moment of saving, so later edits
 * on the Invoice settings page would silently stop reaching POS receipts.
 */

/** What the modal's controls edit. Booleans are the resolved "shown" state of each toggle. */
export interface PosModalValues {
  template: InvoiceSettings['template']
  paper_size: InvoiceSettings['paper_size']
  color: string
  show_logo: boolean
  show_hsn: boolean
  show_tax_breakdown: boolean
  show_notes: boolean
  show_signature: boolean
}

const VALUE_KEYS: (keyof PosModalValues)[] = [
  'template', 'paper_size', 'color',
  'show_logo', 'show_hsn', 'show_tax_breakdown', 'show_notes', 'show_signature',
]

// Toggles are "on" unless explicitly false (matches how the templates read them).
const BOOLEAN_KEYS = new Set<keyof PosModalValues>([
  'show_logo', 'show_hsn', 'show_tax_breakdown', 'show_notes', 'show_signature',
])

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
    if (values[key] === baseValue(base, key)) delete out[key]
    else out[key] = values[key]
  }
  return out as Partial<InvoiceSettings>
}

/** Settings used to render a POS document: invoice settings, then overrides, then live control values. */
export function previewPosSettings(
  base: Partial<InvoiceSettings>,
  existing: Partial<InvoiceSettings>,
  values: PosModalValues,
): Partial<InvoiceSettings> {
  return { ...base, ...existing, ...values } as Partial<InvoiceSettings>
}
