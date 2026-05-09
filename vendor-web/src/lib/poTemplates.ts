/**
 * Purchase Order HTML template generators.
 * Each template returns a full HTML string ready to open in a print/preview window.
 */

export interface POTemplateSettings {
  template: 'classic' | 'modern' | 'minimal' | 'formal'
  color: string
  logo_url?: string
  signature_url?: string
  // Display toggles
  show_logo: boolean
  show_signature: boolean
  show_supplier_address: boolean
  show_delivery_date: boolean
  show_description: boolean
  show_unit_price: boolean
  show_notes: boolean
  show_terms: boolean
  show_bank_details: boolean
  show_ship_to: boolean
  show_sold_to: boolean
  show_tax_breakdown: boolean
  show_gstin: boolean
  show_payment_terms: boolean
  show_reference_number: boolean
  /** PDF export margin (mm); used by PO detail download. */
  pdf_margin?: number
  // Vendor info
  vendor_gstin?: string
  // Payment / bank
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  account_holder_name?: string
  upi_id?: string
  payment_terms?: string
  // Default text
  default_notes?: string
  default_terms?: string
  signatory_name?: string
}

export const DEFAULT_PO_SETTINGS: POTemplateSettings = {
  template: 'classic',
  color: '#0f766e',
  show_logo: true,
  show_signature: true,
  show_supplier_address: true,
  show_delivery_date: true,
  show_description: true,
  show_unit_price: true,
  show_notes: true,
  show_terms: false,
  show_bank_details: false,
  show_ship_to: true,
  show_sold_to: true,
  show_tax_breakdown: true,
  show_gstin: true,
  show_payment_terms: true,
  show_reference_number: true,
}

export const PO_TEMPLATE_COLORS = [
  { label: 'Teal',   value: '#0f766e' },
  { label: 'Blue',   value: '#1a56db' },
  { label: 'Green',  value: '#057a55' },
  { label: 'Purple', value: '#6c2bd9' },
  { label: 'Red',    value: '#c81e1e' },
  { label: 'Orange', value: '#b45309' },
  { label: 'Slate',  value: '#334155' },
  { label: 'Rose',   value: '#9d174d' },
]

import { resolveMediaUrl, fetchAsDataUrl, openPrintWindow } from './printUtils'

type POData = Record<string, unknown>

function resolveLogoUrl(settings: POTemplateSettings, po: POData, _backendApiBase: string): string {
  if (!settings.show_logo) return ''
  const path = settings.logo_url || (po.vendor_logo_url as string) || ''
  return resolveMediaUrl(path)
}

function fmt(n: unknown): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(d)
  }
}

function addr(a?: Record<string, string> | null): string {
  if (!a) return ''
  return [a.street, a.city, a.state, a.postal_code].filter(Boolean).join(', ')
}

// ─── Shared blocks ────────────────────────────────────────────────────────────

function poItemRows(items: POData[], settings: POTemplateSettings): string {
  if (!items.length) return `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af">No items</td></tr>`
  return items
    .map((it, i) => {
      const qty   = Number(it.quantity_ordered ?? it.quantity ?? 0)
      const cost  = Number(it.unit_cost ?? it.price ?? 0)
      const total = Number(it.total_cost ?? qty * cost)
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280">${i + 1}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">
          <div style="font-weight:500;font-size:12px">${it.product_name || it.name || ''}</div>
          ${settings.show_description && it.description ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${it.description}</div>` : ''}
          ${it.product_sku ? `<div style="font-size:10px;color:#9ca3af;margin-top:1px">SKU: ${it.product_sku}</div>` : ''}
          ${it.hsn_code ? `<div style="font-size:10px;color:#9ca3af">HSN: ${it.hsn_code}</div>` : ''}
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${qty}</td>
        ${settings.show_unit_price ? `<td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px">${fmt(cost)}</td>` : ''}
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:12px">${fmt(total)}</td>
      </tr>`
    })
    .join('')
}

function poTotalsBlock(po: POData, settings: POTemplateSettings, darkMode = false): string {
  const sub   = Number(po.subtotal ?? 0)
  const disc  = Number(po.discount_amount ?? 0)
  // Real PO data uses tax_amount; sample data uses cgst/sgst/igst breakdown
  const cgst  = Number(po.cgst_amount ?? 0)
  const sgst  = Number(po.sgst_amount ?? 0)
  const igst  = Number(po.igst_amount ?? 0)
  const rawTax = Number(po.total_tax ?? po.tax_amount ?? cgst + sgst + igst)
  const tax   = rawTax || cgst + sgst + igst
  const total = Number(po.grand_total ?? po.total ?? sub + tax - disc)

  const muted = darkMode ? '#9ca3af' : '#6b7280'
  const bold  = darkMode ? '#fff'     : '#111'

  return `
    <tr><td style="padding:5px 10px;text-align:right;color:${muted};font-size:11px">Subtotal</td><td style="padding:5px 10px;text-align:right;font-size:12px">${fmt(sub)}</td></tr>
    ${disc > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:${muted};font-size:11px">Discount</td><td style="padding:5px 10px;text-align:right;color:#dc2626;font-size:12px">-${fmt(disc)}</td></tr>` : ''}
    ${settings.show_tax_breakdown && cgst > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:${muted};font-size:11px">CGST</td><td style="padding:5px 10px;text-align:right;font-size:12px">${fmt(cgst)}</td></tr>` : ''}
    ${settings.show_tax_breakdown && sgst > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:${muted};font-size:11px">SGST</td><td style="padding:5px 10px;text-align:right;font-size:12px">${fmt(sgst)}</td></tr>` : ''}
    ${settings.show_tax_breakdown && igst > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:${muted};font-size:11px">IGST</td><td style="padding:5px 10px;text-align:right;font-size:12px">${fmt(igst)}</td></tr>` : ''}
    ${!settings.show_tax_breakdown && tax > 0 ? `<tr><td style="padding:5px 10px;text-align:right;color:${muted};font-size:11px">Tax</td><td style="padding:5px 10px;text-align:right;font-size:12px">${fmt(tax)}</td></tr>` : ''}
    <tr style="border-top:2px solid ${darkMode ? '#374151' : '#e5e7eb'}">
      <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:14px;color:${bold}">Total</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:14px;color:${bold}">${fmt(total)}</td>
    </tr>`
}

function partyBlock(po: POData, settings: POTemplateSettings, color: string): string {
  const hasSoldTo = settings.show_sold_to
  const hasShipTo = settings.show_ship_to

  if (!hasSoldTo && !hasShipTo) return ''

  const soldTo = `
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px">Sold To / Bill To</div>
      <div style="font-weight:700;font-size:13px">${po.vendor_name || ''}</div>
      ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
      <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${addr(po.vendor_address as Record<string, string>)}</div>
    </div>`

  const shipTo = `
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px">Ship To / Deliver To</div>
      <div style="font-weight:700;font-size:13px">${po.ship_to_name || po.vendor_name || ''}</div>
      ${po.ship_to_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.ship_to_gstin}</div>` : ''}
      <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${addr((po.ship_to_address || po.vendor_address) as Record<string, string>)}</div>
      ${po.ship_to_contact ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">Contact: ${po.ship_to_contact}</div>` : ''}
    </div>`

  if (hasSoldTo && hasShipTo) {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;padding:14px;background:#f8fafc;border-radius:6px;border-left:3px solid ${color}">
      ${soldTo}${shipTo}
    </div>`
  }
  return `<div style="margin-bottom:20px;padding:14px;background:#f8fafc;border-radius:6px;border-left:3px solid ${color}">
    ${hasSoldTo ? soldTo : shipTo}
  </div>`
}

function supplierBlock(po: POData, settings: POTemplateSettings, color: string): string {
  return `
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px">Supplier / Vendor</div>
      <div style="font-weight:700;font-size:13px">${po.supplier_name || ''}</div>
      ${settings.show_gstin && po.supplier_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.supplier_gstin}</div>` : ''}
      ${settings.show_supplier_address && po.supplier_address ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${addr(po.supplier_address as Record<string, string>)}</div>` : ''}
      ${po.supplier_email ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${po.supplier_email}</div>` : ''}
      ${po.supplier_phone ? `<div style="font-size:10px;color:#6b7280">${po.supplier_phone}</div>` : ''}
    </div>`
}

function metaGrid(po: POData, settings: POTemplateSettings): string {
  const rows = [
    { label: 'PO Number',         val: String(po.po_number || ''),                    always: true },
    { label: 'Order Date',        val: fmtDate(po.order_date as string),              always: true },
    { label: 'Expected Delivery', val: fmtDate(po.expected_delivery_date as string),  show: settings.show_delivery_date && !!po.expected_delivery_date },
    { label: 'Payment Terms',     val: String(po.payment_terms || settings.payment_terms || ''),  show: settings.show_payment_terms && !!(po.payment_terms || settings.payment_terms) },
    { label: 'Reference No.',     val: String(po.reference_number || ''),             show: settings.show_reference_number && !!po.reference_number },
    { label: 'Status',            val: String(po.status || 'Draft').toUpperCase(),    always: true },
  ]
  const visible = rows.filter(r => r.always || r.show)
  return visible.map(r => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6">
      <span style="color:#6b7280;font-size:11px">${r.label}</span>
      <span style="font-weight:600;font-size:11px;text-align:right">${r.val}</span>
    </div>`).join('')
}

function poBankBlock(settings: POTemplateSettings): string {
  if (!settings.show_bank_details) return ''
  const { bank_name, account_number, ifsc_code, account_holder_name, upi_id } = settings
  if (!bank_name && !account_number) return ''
  return `<div style="font-size:11px">
    <div style="font-weight:600;margin-bottom:6px;font-size:12px">Payment Details</div>
    ${bank_name ? `<div>Bank: <span style="font-weight:500">${bank_name}</span></div>` : ''}
    ${account_holder_name ? `<div>Name: <span style="font-weight:500">${account_holder_name}</span></div>` : ''}
    ${account_number ? `<div>Account: <span style="font-weight:500">${account_number}</span></div>` : ''}
    ${ifsc_code ? `<div>IFSC: <span style="font-weight:500">${ifsc_code}</span></div>` : ''}
    ${upi_id ? `<div>UPI: <span style="font-weight:500">${upi_id}</span></div>` : ''}
  </div>`
}

function poSignatureBlock(settings: POTemplateSettings, vendorName: string): string {
  if (!settings.show_signature) return ''
  const hasSig = !!(settings.signature_url)
  return `<div style="text-align:center;min-width:160px">
    ${hasSig
      ? `<img src="${settings.signature_url}" style="height:64px;max-width:180px;object-fit:contain;display:block;margin:0 auto 6px" />`
      : `<div style="height:64px;width:180px;border-bottom:1.5px solid #374151;margin:0 auto 6px"></div>`}
    <div style="font-size:10px;color:#6b7280">Authorised Signatory</div>
    <div style="font-size:11px;font-weight:600;margin-top:2px">${vendorName || ''}</div>
  </div>`
}

function poFooter(po: POData, settings: POTemplateSettings): string {
  const notes = (po.notes as string) || settings.default_notes || ''
  const terms = (po.terms_and_conditions as string) || settings.default_terms || ''
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">
      <div style="flex:1">
        ${poBankBlock(settings)}
        ${settings.show_notes && notes ? `<div style="margin-top:${settings.show_bank_details ? '12px' : '0'};font-size:11px"><div style="font-weight:600;margin-bottom:4px">Notes</div><div style="color:#6b7280;white-space:pre-wrap;line-height:1.5">${notes}</div></div>` : ''}
        ${settings.show_terms && terms ? `<div style="margin-top:8px;font-size:10px;color:#9ca3af;white-space:pre-wrap;line-height:1.5">${terms}</div>` : ''}
      </div>
      ${poSignatureBlock(settings, String(po.vendor_name || ''))}
    </div>
    <div style="margin-top:16px;padding-top:10px;border-top:1px solid #f3f4f6;text-align:center;font-size:10px;color:#9ca3af">
      This is a computer-generated Purchase Order. Please contact us for any discrepancies.
    </div>`
}

// ─── Template: Classic ───────────────────────────────────────────────────────

function classicTemplate(po: POData, settings: POTemplateSettings, backendApiBase = ''): string {
  const color   = settings.color || '#0f766e'
  const items   = (po.items as POData[]) || []
  const vendAddr = addr(po.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, po, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PO ${po.po_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#111;background:#f9fafb}
  .page{max-width:820px;margin:20px auto;background:#fff;padding:32px;border-radius:6px}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none}}
</style></head>
<body><div class="page">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid ${color}">
    <div style="display:flex;align-items:center;gap:14px">
      ${logoUrl ? `<img src="${logoUrl}" style="height:64px;max-width:120px;object-fit:contain" crossorigin="anonymous"/>` : ''}
      <div>
        <div style="font-size:20px;font-weight:700;color:#111">${po.vendor_name || ''}</div>
        ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
        <div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.5">${vendAddr}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:2px">PURCHASE ORDER</div>
      <div style="font-size:9px;color:#9ca3af;margin-top:2px">OFFICIAL DOCUMENT</div>
    </div>
  </div>

  <!-- PO Meta + Supplier -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:14px">
      ${metaGrid(po, settings)}
    </div>
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:14px">
      ${supplierBlock(po, settings, color)}
    </div>
  </div>

  <!-- Sold To / Ship To -->
  ${partyBlock(po, settings, color)}

  <!-- Items Table -->
  <table style="margin-bottom:16px">
    <thead>
      <tr style="background:${color};color:#fff">
        <th style="padding:8px 6px;text-align:left;font-size:10px;font-weight:600;width:28px">#</th>
        <th style="padding:8px 6px;text-align:left;font-size:10px;font-weight:600">ITEM / DESCRIPTION</th>
        <th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:600;width:50px">QTY</th>
        ${settings.show_unit_price ? `<th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:600;width:90px">UNIT COST</th>` : ''}
        <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:600;width:90px">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${poItemRows(items, settings)}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <table style="width:300px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <tbody>${poTotalsBlock(po, settings)}</tbody>
    </table>
  </div>

  ${poFooter(po, settings)}
</div></body></html>`
}

// ─── Template: Modern ────────────────────────────────────────────────────────

function modernTemplate(po: POData, settings: POTemplateSettings, backendApiBase = ''): string {
  const color   = settings.color || '#0f766e'
  const items   = (po.items as POData[]) || []
  const vendAddr = addr(po.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, po, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PO ${po.po_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Arial',sans-serif;font-size:12px;color:#111;background:#f3f4f6}
  .page{max-width:820px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-radius:0}}
</style></head>
<body><div class="page">

  <!-- Gradient Header -->
  <div style="background:linear-gradient(135deg,${color} 0%,${color}cc 100%);padding:26px 32px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:14px">
        ${logoUrl ? `<img src="${logoUrl}" style="height:56px;max-width:110px;object-fit:contain;background:#fff;border-radius:6px;padding:4px" crossorigin="anonymous"/>` : ''}
        <div>
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px">${po.vendor_name || ''}</div>
          ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;opacity:.8;margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
          <div style="font-size:10px;opacity:.8;margin-top:2px">${vendAddr}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;opacity:.8;letter-spacing:.15em;text-transform:uppercase">Purchase Order</div>
        <div style="font-family:monospace;font-size:20px;font-weight:700;margin-top:4px">${po.po_number}</div>
        <div style="font-size:10px;opacity:.7;margin-top:4px">${fmtDate(po.order_date as string)}</div>
      </div>
    </div>
  </div>

  <div style="padding:28px 32px">
    <!-- Supplier + Meta row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div style="background:#f8fafc;border-radius:8px;padding:14px">
        ${supplierBlock(po, settings, color)}
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px">PO Details</div>
        ${metaGrid(po, settings)}
      </div>
    </div>

    <!-- Sold To / Ship To -->
    ${partyBlock(po, settings, color)}

    <!-- Items -->
    <table style="margin-bottom:16px">
      <thead>
        <tr style="border-bottom:2px solid ${color}">
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:${color};width:28px">#</th>
          <th style="padding:8px 6px;text-align:left;font-size:10px;color:${color}">ITEM</th>
          <th style="padding:8px 6px;text-align:center;font-size:10px;color:${color};width:50px">QTY</th>
          ${settings.show_unit_price ? `<th style="padding:8px 6px;text-align:right;font-size:10px;color:${color};width:90px">UNIT COST</th>` : ''}
          <th style="padding:8px 6px;text-align:right;font-size:10px;color:${color};width:90px">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${poItemRows(items, settings)}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <div style="background:#f8fafc;border-radius:8px;padding:4px;min-width:280px">
        <table style="width:100%"><tbody>${poTotalsBlock(po, settings)}</tbody></table>
      </div>
    </div>

    ${poFooter(po, settings)}
  </div>
</div></body></html>`
}

// ─── Template: Minimal ───────────────────────────────────────────────────────

function minimalTemplate(po: POData, settings: POTemplateSettings, backendApiBase = ''): string {
  const color   = settings.color || '#0f766e'
  const items   = (po.items as POData[]) || []
  const vendAddr = addr(po.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, po, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PO ${po.po_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff}
  .page{max-width:820px;margin:20px auto;padding:40px}
  table{width:100%;border-collapse:collapse}
  @media print{.page{margin:0}}
</style></head>
<body><div class="page">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" style="height:48px;max-width:100px;object-fit:contain;margin-bottom:8px;display:block" crossorigin="anonymous"/>` : ''}
      <div style="font-size:18px;font-weight:700">${po.vendor_name || ''}</div>
      ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
      <div style="font-size:10px;color:#6b7280;margin-top:2px">${vendAddr}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:300;letter-spacing:2px;color:${color}">PURCHASE ORDER</div>
      <div style="font-family:monospace;font-size:13px;color:#374151;margin-top:4px">${po.po_number}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${fmtDate(po.order_date as string)}</div>
    </div>
  </div>

  <!-- 3-col: Supplier / Sold To / Ship To / Meta -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e5e7eb">
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Supplier</div>
      <div style="font-weight:600;font-size:13px">${po.supplier_name || ''}</div>
      ${settings.show_gstin && po.supplier_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.supplier_gstin}</div>` : ''}
      ${settings.show_supplier_address && po.supplier_address ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${addr(po.supplier_address as Record<string, string>)}</div>` : ''}
      ${po.supplier_email ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${po.supplier_email}</div>` : ''}
    </div>
    ${settings.show_sold_to ? `<div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Sold To</div>
      <div style="font-weight:600;font-size:13px">${po.vendor_name || ''}</div>
      ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
      <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${vendAddr}</div>
    </div>` : '<div></div>'}
    ${settings.show_ship_to ? `<div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Ship To</div>
      <div style="font-weight:600;font-size:13px">${po.ship_to_name || po.vendor_name || ''}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${addr((po.ship_to_address || po.vendor_address) as Record<string, string>)}</div>
      ${po.ship_to_contact ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${po.ship_to_contact}</div>` : ''}
    </div>` : '<div></div>'}
  </div>

  <!-- PO Meta strip -->
  <div style="display:flex;gap:32px;flex-wrap:wrap;margin-bottom:28px;font-size:11px">
    ${settings.show_delivery_date && po.expected_delivery_date ? `<div><span style="color:#9ca3af">Expected Delivery: </span><strong>${fmtDate(po.expected_delivery_date as string)}</strong></div>` : ''}
    ${settings.show_payment_terms && (po.payment_terms || settings.payment_terms) ? `<div><span style="color:#9ca3af">Terms: </span><strong>${po.payment_terms || settings.payment_terms}</strong></div>` : ''}
    ${settings.show_reference_number && po.reference_number ? `<div><span style="color:#9ca3af">Ref: </span><strong>${po.reference_number}</strong></div>` : ''}
    <div><span style="color:#9ca3af">Status: </span><strong>${String(po.status || 'Draft').toUpperCase()}</strong></div>
  </div>

  <!-- Items -->
  <table style="margin-bottom:24px">
    <thead>
      <tr style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
        <th style="padding:8px 4px;text-align:left;font-size:10px;color:#9ca3af;font-weight:500;width:28px">#</th>
        <th style="padding:8px 4px;text-align:left;font-size:10px;color:#9ca3af;font-weight:500">ITEM</th>
        <th style="padding:8px 4px;text-align:center;font-size:10px;color:#9ca3af;font-weight:500;width:50px">QTY</th>
        ${settings.show_unit_price ? `<th style="padding:8px 4px;text-align:right;font-size:10px;color:#9ca3af;font-weight:500;width:90px">UNIT COST</th>` : ''}
        <th style="padding:8px 4px;text-align:right;font-size:10px;color:#9ca3af;font-weight:500;width:90px">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${poItemRows(items, settings)}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <table style="width:260px"><tbody>${poTotalsBlock(po, settings)}</tbody></table>
  </div>

  ${poFooter(po, settings)}
</div></body></html>`
}

// ─── Template: Formal ────────────────────────────────────────────────────────

function formalTemplate(po: POData, settings: POTemplateSettings, backendApiBase = ''): string {
  const color   = settings.color || '#0f766e'
  const items   = (po.items as POData[]) || []
  const vendAddr = addr(po.vendor_address as Record<string, string>)
  const logoUrl = resolveLogoUrl(settings, po, backendApiBase)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PO ${po.po_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Georgia',serif;font-size:12px;color:#1f2937;background:#f9fafb}
  .page{max-width:820px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 10px rgba(0,0,0,.08)}
  table{width:100%;border-collapse:collapse}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none}}
</style></head>
<body><div class="page">

  <div style="background:#1e3a5f;padding:4px 32px">
    <div style="height:2px;background:${color}"></div>
  </div>
  <div style="background:#1e3a5f;padding:22px 32px 20px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:14px">
        ${logoUrl ? `<img src="${logoUrl}" style="height:56px;max-width:110px;object-fit:contain;background:#fff;border-radius:4px;padding:4px" crossorigin="anonymous"/>` : ''}
        <div>
          <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-.3px">${po.vendor_name || ''}</div>
          ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
          <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">${vendAddr}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:${color};text-transform:uppercase;letter-spacing:.2em">Purchase Order</div>
        <div style="font-size:20px;font-weight:700;color:#fff;font-family:monospace;margin-top:4px">${po.po_number}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:4px">${fmtDate(po.order_date as string)}</div>
      </div>
    </div>
  </div>
  <div style="height:4px;background:${color}"></div>

  <div style="padding:24px 32px">
    <!-- Meta + Supplier grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e5e7eb">
      <div style="grid-column:span 1">
        ${supplierBlock(po, settings, color)}
      </div>
      <div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px;border-bottom:1px solid #e5e7eb;padding-bottom:3px">Order Details</div>
        ${metaGrid(po, settings)}
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px">Order Value</div>
        <div style="font-size:28px;font-weight:700;color:${color}">${fmt(Number(po.grand_total ?? po.total ?? 0))}</div>
        <div style="font-size:10px;margin-top:6px;padding:3px 10px;display:inline-block;background:#f0fdf4;color:#16a34a;border-radius:20px">
          ${String(po.status || 'DRAFT').toUpperCase()}
        </div>
      </div>
    </div>

    <!-- Sold To / Ship To -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      ${settings.show_sold_to ? `<div style="background:#f8fafc;border-radius:6px;padding:14px;border-left:3px solid ${color}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px">Sold To / Bill To</div>
        <div style="font-weight:700;font-size:13px">${po.vendor_name || ''}</div>
        ${settings.show_gstin && (po.vendor_gstin || settings.vendor_gstin) ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.vendor_gstin || settings.vendor_gstin}</div>` : ''}
        <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${vendAddr}</div>
      </div>` : '<div></div>'}
      ${settings.show_ship_to ? `<div style="background:#f8fafc;border-radius:6px;padding:14px;border-left:3px solid ${color}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:5px">Ship To / Deliver To</div>
        <div style="font-weight:700;font-size:13px">${po.ship_to_name || po.vendor_name || ''}</div>
        ${po.ship_to_gstin ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">GSTIN: ${po.ship_to_gstin}</div>` : ''}
        <div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">${addr((po.ship_to_address || po.vendor_address) as Record<string, string>)}</div>
        ${po.ship_to_contact ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${po.ship_to_contact}</div>` : ''}
      </div>` : '<div></div>'}
    </div>

    <!-- Items -->
    <table style="margin-bottom:20px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 8px;text-align:left;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color};width:28px">#</th>
          <th style="padding:10px 8px;text-align:left;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color}">ITEM</th>
          <th style="padding:10px 8px;text-align:center;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color};width:50px">QTY</th>
          ${settings.show_unit_price ? `<th style="padding:10px 8px;text-align:right;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color};width:90px">UNIT COST</th>` : ''}
          <th style="padding:10px 8px;text-align:right;font-size:10px;color:#374151;font-weight:700;border-bottom:2px solid ${color};width:90px">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${poItemRows(items, settings)}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <div style="min-width:280px;background:#1e3a5f;border-radius:8px;padding:4px">
        <table style="width:100%">
          <tbody>${poTotalsBlock(po, settings, true)}</tbody>
        </table>
      </div>
    </div>

    ${poFooter(po, settings)}
  </div>
</div></body></html>`
}

// ─── Main Exports ─────────────────────────────────────────────────────────────

export function generatePOHtml(
  po: POData,
  settings: Partial<POTemplateSettings>,
  backendApiBase = '',
): string {
  const s: POTemplateSettings = { ...DEFAULT_PO_SETTINGS, ...settings }
  switch (s.template) {
    case 'modern':  return modernTemplate(po, s, backendApiBase)
    case 'minimal': return minimalTemplate(po, s, backendApiBase)
    case 'formal':  return formalTemplate(po, s, backendApiBase)
    default:        return classicTemplate(po, s, backendApiBase)
  }
}

/**
 * Async version: pre-fetches logo + signature as data URLs (with auth token)
 * so the print popup needs no network requests and images always appear.
 */
export async function printPO(
  po: POData,
  settings: Partial<POTemplateSettings>,
  _backendApiBase = '',
): Promise<void> {
  const s = { ...DEFAULT_PO_SETTINGS, ...settings }

  const rawLogo = s.logo_url || (po.vendor_logo_url as string) || ''
  const rawSig  = s.signature_url || ''

  const [logoDataUrl, sigDataUrl] = await Promise.all([
    s.show_logo      && rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
    s.show_signature && rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
  ])

  const enriched: POTemplateSettings = {
    ...s,
    logo_url:      logoDataUrl || undefined,
    signature_url: sigDataUrl  || undefined,
  }

  const html = generatePOHtml({ ...po, vendor_logo_url: logoDataUrl || po.vendor_logo_url }, enriched, '')
  openPrintWindow(html)
}
