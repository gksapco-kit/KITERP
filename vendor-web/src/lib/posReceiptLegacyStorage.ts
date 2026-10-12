import type { InvoiceSettings } from '@/lib/invoiceTemplates'

/**
 * LEGACY browser storage for POS receipt overrides.
 *
 * POS receipt settings now live on the server (vendor.settings.pos_receipt_settings) and are
 * read through `usePosReceiptSettings()`. Older versions kept them in this browser's
 * localStorage under a key that was not scoped to a vendor. These helpers exist only so that
 * copy can be migrated to the server once and then removed.
 *
 * Kept in its own tiny module (type-only import above) so the shared hooks don't pull the
 * large invoice-template renderer into every bundle.
 */
export const POS_INV_SETTINGS_KEY = 'pos_invoice_settings'

export function loadLegacyPosInvoiceSettings(): Partial<InvoiceSettings> {
  try {
    const raw = localStorage.getItem(POS_INV_SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Partial<InvoiceSettings>)
      : {}
  } catch {
    return {}
  }
}

export function clearLegacyPosInvoiceSettings(): void {
  try {
    localStorage.removeItem(POS_INV_SETTINGS_KEY)
  } catch { /* ignore */ }
}
