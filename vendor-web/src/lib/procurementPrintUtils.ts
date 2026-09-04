/**
 * Print/PDF helpers for GRN, Purchase Returns, and Vendor Invoices.
 * Follows the same pattern as poTemplates.ts — generates a self-contained
 * HTML string that can be passed to openPrintWindow() or downloadAsPdf().
 */

import { openPrintWindow, downloadAsPdf } from './printUtils'
import type { GoodsReceiptNote, PurchaseReturn } from '@/types'

// ── Shared helpers ────────────────────────────────────────────────

function fmt(n: unknown): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}

function statusBadge(status: string, color = '#0f766e'): string {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}18;color:${color};border:1px solid ${color}44;text-transform:uppercase;letter-spacing:.05em">${status.replace(/_/g, ' ')}</span>`
}

function docWrapper(title: string, docNum: string, status: string, date: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${title} — ${docNum}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111827;background:#fff;padding:32px}
  table{width:100%;border-collapse:collapse}
  th{background:#f3f4f6;font-weight:600;font-size:11px;padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  .doc-title{font-size:22px;font-weight:700;letter-spacing:-.3px}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
  .meta-item label{display:block;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .meta-item span{font-size:12px;font-weight:500}
  .totals{max-width:280px;margin-left:auto;margin-top:16px}
  .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
  .totals-total{font-weight:700;font-size:14px;border-top:2px solid #111827;padding-top:6px;margin-top:4px}
  @media print{body{padding:16px}button{display:none!important}}
</style></head><body>
<div class="header">
  <div>
    <div class="doc-title">${title}</div>
    <div style="font-size:14px;font-weight:600;color:#374151;margin-top:4px">${docNum}</div>
    ${statusBadge(status)}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#6b7280">Date</div>
    <div style="font-size:13px;font-weight:600">${date}</div>
  </div>
</div>
${body}
<div style="margin-top:40px;border-top:1px solid #e5e7eb;padding-top:16px;font-size:10px;color:#9ca3af;text-align:center">
  Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
</div>
</body></html>`
}

// ══════════════════════════════════════════════════════════════════
// GRN
// ══════════════════════════════════════════════════════════════════

export function generateGRNHtml(grn: GoodsReceiptNote): string {
  const lines = grn.lines ?? []

  const lineRows = lines.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:#9ca3af">No items</td></tr>`
    : lines.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="color:#6b7280">${i + 1}</td>
      <td><div style="font-weight:500">${l.product_name ?? '—'}</div><div style="font-size:10px;color:#6b7280">${l.product_sku ?? ''}</div></td>
      <td style="text-align:center">${l.quantity_received ?? '—'}</td>
      <td style="text-align:center">${l.quantity_accepted ?? '—'}</td>
      <td style="text-align:center">${l.qc_status ?? '—'}</td>
    </tr>`).join('')

  const body = `
<div class="meta-grid">
  <div class="meta-item"><label>Purchase Order</label><span>${(grn as any).purchase_order_number ?? (grn as any).purchase_order_id ?? '—'}</span></div>
  <div class="meta-item"><label>Supplier</label><span>${grn.supplier?.name ?? '—'}</span></div>
  <div class="meta-item"><label>Delivery Note</label><span>${grn.supplier_delivery_number ?? '—'}</span></div>
  <div class="meta-item"><label>Posting Date</label><span>${fmtDate(grn.posting_date)}</span></div>
  <div class="meta-item"><label>Warehouse</label><span>${grn.warehouse ?? '—'}</span></div>
  <div class="meta-item"><label>Carrier</label><span>${grn.carrier ?? '—'}</span></div>
</div>
<table>
  <thead><tr>
    <th style="width:36px">#</th>
    <th>Item</th>
    <th style="text-align:center">Received</th>
    <th style="text-align:center">Accepted</th>
    <th style="text-align:center">QC Status</th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>
${grn.notes ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px;font-size:12px"><strong>Notes:</strong> ${grn.notes}</div>` : ''}`

  return docWrapper(
    'Goods Receipt Note',
    grn.grn_number ?? grn.id,
    grn.status,
    fmtDate(grn.posting_date),
    body,
  )
}

export async function printGRN(grn: GoodsReceiptNote): Promise<void> {
  openPrintWindow(generateGRNHtml(grn))
}

export async function downloadGRNPdf(grn: GoodsReceiptNote): Promise<void> {
  await downloadAsPdf(generateGRNHtml(grn), `GRN-${grn.grn_number ?? grn.id}.pdf`)
}

// ══════════════════════════════════════════════════════════════════
// Purchase Return
// ══════════════════════════════════════════════════════════════════

export function generateReturnHtml(ret: PurchaseReturn): string {
  const lines = ret.lines ?? []

  const lineRows = lines.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:#9ca3af">No items</td></tr>`
    : lines.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="color:#6b7280">${i + 1}</td>
      <td><div style="font-weight:500">${(l as any).product_name ?? '—'}</div></td>
      <td style="text-align:center">${l.return_qty ?? (l as { quantity_returned?: number }).quantity_returned ?? '—'}</td>
      <td style="text-align:right">${fmt(l.unit_price)}</td>
      <td style="text-align:right;font-weight:600">${fmt(l.total ?? (l as { line_total?: number }).line_total ?? (Number(l.return_qty ?? 0) * Number(l.unit_price ?? 0)))}</td>
    </tr>`).join('')

  const body = `
<div class="meta-grid">
  <div class="meta-item"><label>Supplier</label><span>${(ret as { supplier?: { name?: string }; supplier_name?: string }).supplier?.name ?? ret.supplier_name ?? '—'}</span></div>
  <div class="meta-item"><label>Return Reason</label><span>${(ret.return_reason ?? '—').replace(/_/g, ' ')}</span></div>
  <div class="meta-item"><label>Return Date</label><span>${fmtDate(ret.return_date)}</span></div>
  <div class="meta-item"><label>Authorization #</label><span>${ret.supplier_return_authorization ?? '—'}</span></div>
  <div class="meta-item"><label>Dispatch via</label><span>${ret.dispatched_via ?? '—'}</span></div>
  <div class="meta-item"><label>Tracking #</label><span>${ret.tracking_number ?? '—'}</span></div>
</div>
<table>
  <thead><tr>
    <th style="width:36px">#</th>
    <th>Item</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">Line Total</th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<div class="totals">
  <div class="totals-row"><span>Subtotal</span><span>${fmt(ret.subtotal)}</span></div>
  <div class="totals-row"><span>Tax</span><span>${fmt(ret.tax_amount)}</span></div>
  <div class="totals-row totals-total"><span>Total</span><span>${fmt(ret.total)}</span></div>
</div>
${ret.notes ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px;font-size:12px"><strong>Notes:</strong> ${ret.notes}</div>` : ''}`

  return docWrapper(
    'Purchase Return',
    ret.return_number ?? ret.id,
    ret.status,
    fmtDate(ret.return_date),
    body,
  )
}

export async function printReturn(ret: PurchaseReturn): Promise<void> {
  openPrintWindow(generateReturnHtml(ret))
}

export async function downloadReturnPdf(ret: PurchaseReturn): Promise<void> {
  await downloadAsPdf(generateReturnHtml(ret), `Return-${ret.return_number ?? ret.id}.pdf`)
}

// ══════════════════════════════════════════════════════════════════
// Vendor Invoice
// ══════════════════════════════════════════════════════════════════

export function generateInvoiceHtml(inv: Record<string, unknown>): string {
  const items = (inv.items as Record<string, unknown>[] | undefined) ?? []

  const lineRows = items.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:#9ca3af">No items</td></tr>`
    : items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="color:#6b7280">${i + 1}</td>
      <td><div style="font-weight:500">${String(it.product_name ?? it.description ?? '—')}</div></td>
      <td style="text-align:center">${String(it.quantity ?? '—')}</td>
      <td style="text-align:right">${fmt(it.unit_price)}</td>
      <td style="text-align:right;font-weight:600">${fmt(it.line_total ?? (Number(it.quantity ?? 0) * Number(it.unit_price ?? 0)))}</td>
    </tr>`).join('')

  const supplier = inv.supplier as Record<string, unknown> | undefined

  const body = `
<div class="meta-grid">
  <div class="meta-item"><label>Supplier</label><span>${String(supplier?.name ?? '—')}</span></div>
  <div class="meta-item"><label>Invoice #</label><span>${String(inv.invoice_number ?? '—')}</span></div>
  <div class="meta-item"><label>Invoice Date</label><span>${fmtDate(inv.invoice_date as string)}</span></div>
  <div class="meta-item"><label>Due Date</label><span>${fmtDate(inv.due_date as string)}</span></div>
  <div class="meta-item"><label>Currency</label><span>${String(inv.currency ?? '—')}</span></div>
  <div class="meta-item"><label>Match Status</label><span>${String(inv.match_status ?? '—').replace(/_/g, ' ')}</span></div>
</div>
<table>
  <thead><tr>
    <th style="width:36px">#</th>
    <th>Item / Description</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">Line Total</th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<div class="totals">
  <div class="totals-row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
  <div class="totals-row"><span>Tax</span><span>${fmt(inv.tax_amount)}</span></div>
  <div class="totals-row totals-total"><span>Total</span><span>${fmt(inv.total)}</span></div>
</div>
${inv.notes ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px;font-size:12px"><strong>Notes:</strong> ${String(inv.notes)}</div>` : ''}`

  return docWrapper(
    'Vendor Invoice',
    String(inv.invoice_number ?? inv.id ?? ''),
    String(inv.status ?? ''),
    fmtDate(inv.invoice_date as string),
    body,
  )
}

export async function printInvoice(inv: Record<string, unknown>): Promise<void> {
  openPrintWindow(generateInvoiceHtml(inv))
}

export async function downloadInvoicePdf(inv: Record<string, unknown>): Promise<void> {
  await downloadAsPdf(generateInvoiceHtml(inv), `Invoice-${String(inv.invoice_number ?? inv.id ?? 'export')}.pdf`)
}

// ══════════════════════════════════════════════════════════════════
// Debit Note (formal supplier-facing document for Purchase Returns)
// ══════════════════════════════════════════════════════════════════

/**
 * Generates a formal Debit Note document for a closed Purchase Return.
 * The Debit Note is addressed TO the supplier — it informs them that we are
 * debiting their account (reducing the amount we owe them) for the returned goods.
 */
export function generateDebitNoteHtml(ret: PurchaseReturn): string {
  const lines = ret.lines ?? []
  const dn_number = `DN-${(ret.return_number ?? ret.id).replace(/^RTN-?/, '')}`

  const lineRows = lines.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:#9ca3af">No items</td></tr>`
    : lines.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="color:#6b7280">${i + 1}</td>
      <td><div style="font-weight:500">${(l as any).product_name ?? '—'}</div>
          <div style="font-size:10px;color:#6b7280">Reason: ${(ret.return_reason ?? '').replace(/_/g, ' ')}</div></td>
      <td style="text-align:center">${l.return_qty ?? (l as { quantity_returned?: number }).quantity_returned ?? '—'}</td>
      <td style="text-align:right">${fmt(l.unit_price)}</td>
      <td style="text-align:right;font-weight:600">${fmt(l.total ?? (l as { line_total?: number }).line_total ?? (Number(l.return_qty ?? 0) * Number(l.unit_price ?? 0)))}</td>
    </tr>`).join('')

  const supplierName = (ret as any).supplier?.name ?? (ret as any).supplier_name ?? '—'
  const supplierAddr = (ret as any).supplier?.address ?? ''

  const body = `
<!-- Parties block -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;padding:16px;background:#fef9ec;border:1px solid #fde68a;border-radius:8px">
  <div>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#92400e;font-weight:600;margin-bottom:4px">To (Supplier)</div>
    <div style="font-size:14px;font-weight:700">${supplierName}</div>
    ${supplierAddr ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${supplierAddr}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#92400e;font-weight:600;margin-bottom:4px">Debit Note Details</div>
    <table style="margin-left:auto;font-size:12px">
      <tr><td style="color:#6b7280;padding-right:12px">Debit Note #</td><td style="font-weight:600">${dn_number}</td></tr>
      <tr><td style="color:#6b7280;padding-right:12px">Purchase Return #</td><td>${ret.return_number ?? ret.id}</td></tr>
      <tr><td style="color:#6b7280;padding-right:12px">Date</td><td>${fmtDate(ret.return_date)}</td></tr>
      ${(ret as any).purchase_order_number ? `<tr><td style="color:#6b7280;padding-right:12px">Against PO #</td><td>${(ret as any).purchase_order_number}</td></tr>` : ''}
    </table>
  </div>
</div>

<p style="font-size:12px;color:#374151;margin-bottom:16px">
  We hereby inform you that we have debited your account for the following goods returned to you due to
  <strong>${(ret.return_reason ?? 'return').replace(/_/g, ' ')}</strong>.
  Kindly issue a credit note in our favour for the equivalent amount.
</p>

<table>
  <thead><tr>
    <th style="width:36px">#</th>
    <th>Item / Description</th>
    <th style="text-align:center">Qty Returned</th>
    <th style="text-align:right">Unit Price</th>
    <th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>

<div class="totals">
  <div class="totals-row"><span>Subtotal</span><span>${fmt(ret.subtotal)}</span></div>
  <div class="totals-row"><span>Tax (reversed)</span><span>${fmt(ret.tax_amount)}</span></div>
  <div class="totals-row totals-total" style="color:#b45309"><span>Debit Note Total</span><span>${fmt(ret.total)}</span></div>
</div>

<div style="margin-top:28px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;color:#166534">
  <strong>Declaration:</strong> This debit note has been issued as per the terms of our purchase agreement.
  The corresponding goods have been dispatched / in transit back to you via ${(ret as any).dispatched_via ?? 'your preferred carrier'}.
  ${(ret as any).tracking_number ? `Tracking reference: <strong>${(ret as any).tracking_number}</strong>` : ''}
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:40px">
  <div style="text-align:center">
    <div style="border-top:1px solid #d1d5db;padding-top:8px;font-size:11px;color:#6b7280">Authorised Signatory</div>
  </div>
  <div style="text-align:center">
    <div style="border-top:1px solid #d1d5db;padding-top:8px;font-size:11px;color:#6b7280">Supplier Acknowledgement</div>
  </div>
</div>`

  // Use a custom wrapper with amber accent for debit notes
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Debit Note — ${dn_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111827;background:#fff;padding:32px}
  table{width:100%;border-collapse:collapse}
  th{background:#fef3c7;font-weight:600;font-size:11px;padding:7px 10px;text-align:left;border-bottom:2px solid #fde68a}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top}
  .totals{max-width:280px;margin-left:auto;margin-top:16px}
  .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
  .totals-total{font-weight:700;font-size:15px;border-top:2px solid #92400e;padding-top:6px;margin-top:4px}
  @media print{body{padding:16px}}
</style></head><body>
<!-- Header banner -->
<div style="background:linear-gradient(135deg,#92400e,#b45309);color:#fff;padding:16px 24px;border-radius:8px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:24px;font-weight:800;letter-spacing:-.5px">DEBIT NOTE</div>
    <div style="font-size:13px;opacity:.85;margin-top:2px">${dn_number}</div>
  </div>
  <div style="text-align:right;font-size:12px;opacity:.9">
    <div style="font-size:11px;opacity:.7;margin-bottom:2px">Return Ref</div>
    <div style="font-weight:600">${ret.return_number ?? ret.id}</div>
  </div>
</div>
${body}
<div style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:10px;color:#9ca3af;text-align:center">
  Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
</div>
</body></html>`
}

export async function printDebitNote(ret: PurchaseReturn): Promise<void> {
  openPrintWindow(generateDebitNoteHtml(ret))
}

export async function downloadDebitNotePdf(ret: PurchaseReturn): Promise<void> {
  const dn_number = `DN-${(ret.return_number ?? ret.id).replace(/^RTN-?/, '')}`
  await downloadAsPdf(generateDebitNoteHtml(ret), `DebitNote-${dn_number}.pdf`)
}
