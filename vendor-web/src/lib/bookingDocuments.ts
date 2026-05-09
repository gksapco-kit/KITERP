// Shared booking printable document types and print utilities.
// Template selections are stored in localStorage keyed by service ID so no
// backend schema changes are required.
import { openPrintWindow, downloadAsPdf } from '@/lib/printUtils'

export const BOOKING_DOC_TYPES = [
  {
    id: 'booking_confirmation',
    label: 'Booking Confirmation',
    desc: 'Appointment slip for the customer to keep',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  {
    id: 'work_order',
    label: 'Work Order',
    desc: 'Job card for the service with tasks and sign-off',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  {
    id: 'prescription',
    label: 'Doctor Prescription',
    desc: 'Rx pad with patient and medication details',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    id: 'delivery_challan',
    label: 'Delivery Challan',
    desc: 'Handover document listing items dispatched',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  {
    id: 'quotation',
    label: 'Quotation / Estimate',
    desc: 'Price estimate before or after service',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  {
    id: 'quality_report',
    label: 'Quality Report',
    desc: 'QC checklist and inspection results',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    id: 'sop',
    label: 'SOP / Procedure',
    desc: 'Standard Operating Procedure for the service',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
] as const

export type BookingDocTypeId = typeof BOOKING_DOC_TYPES[number]['id']


const LS_KEY = (serviceId: string) => `svc_doc_templates_${serviceId}`

export function getServiceDocTemplates(serviceId: string): BookingDocTypeId[] {
  try {
    const raw = localStorage.getItem(LS_KEY(serviceId))
    return raw ? (JSON.parse(raw) as BookingDocTypeId[]) : []
  } catch {
    return []
  }
}

export function setServiceDocTemplates(serviceId: string, ids: BookingDocTypeId[]) {
  localStorage.setItem(LS_KEY(serviceId), JSON.stringify(ids))
}

// ── HTML generators ───────────────────────────────────────────────────────────

interface BookingInfo {
  booking_number?: string
  service_name?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  booking_date?: string
  start_time?: string
  end_time?: string
  duration_minutes?: number
  notes?: string
  assigned_staff_name?: string
  total?: number
}

function baseStyles() {
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#222;background:#fff}
      .page{max-width:780px;margin:0 auto;padding:36px}
      h1{font-size:20px;font-weight:700;margin-bottom:2px}
      .sub{font-size:12px;color:#777;margin-bottom:20px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}
      .block .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:3px}
      .block .val{font-size:13px;font-weight:600;color:#111}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th{background:#f4f4f5;padding:9px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#666}
      td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
      .divider{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
      .sig-box{border:1px dashed #ccc;border-radius:8px;height:64px;margin-top:8px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px}
      .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#aaa;text-align:center}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style>
  `
}

function infoGrid(b: BookingInfo) {
  const date = b.booking_date
    ? new Date(b.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
  const time = b.start_time
    ? `${b.start_time.slice(0, 5)}${b.end_time ? ' – ' + b.end_time.slice(0, 5) : ''}${b.duration_minutes ? ` (${b.duration_minutes} min)` : ''}`
    : '—'
  return `
    <div class="grid">
      <div class="block"><div class="lbl">Customer</div><div class="val">${b.customer_name || '—'}</div></div>
      <div class="block"><div class="lbl">Service</div><div class="val">${b.service_name || '—'}</div></div>
      <div class="block"><div class="lbl">Booking #</div><div class="val">${b.booking_number || '—'}</div></div>
      <div class="block"><div class="lbl">Date &amp; Time</div><div class="val">${date} · ${time}</div></div>
      ${b.customer_phone ? `<div class="block"><div class="lbl">Phone</div><div class="val">${b.customer_phone}</div></div>` : ''}
      ${b.assigned_staff_name ? `<div class="block"><div class="lbl">Service Provider</div><div class="val">${b.assigned_staff_name}</div></div>` : ''}
    </div>
  `
}

function docHeader(title: string, subtitle: string) {
  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
      <div>
        <h1>${title}</h1>
        <div class="sub">${subtitle}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#999">
        Generated: ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  `
}

function generateBookingConfirmation(b: BookingInfo): string {
  const date = b.booking_date
    ? new Date(b.booking_date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const time = b.start_time
    ? `${b.start_time.slice(0, 5)}${b.end_time ? ' – ' + b.end_time.slice(0, 5) : ''}${b.duration_minutes ? ` (${b.duration_minutes} min)` : ''}`
    : '—'
  const fmt = (n: unknown) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Booking Confirmation – ${b.booking_number || ''}</title>${baseStyles()}
<style>
  .confirm-card{background:#f5f3ff;border:2px solid #8b5cf6;border-radius:16px;padding:28px;margin:20px 0;text-align:center}
  .confirm-card .ref{font-size:28px;font-weight:800;color:#5b21b6;letter-spacing:.04em;margin-bottom:4px}
  .confirm-card .status{display:inline-block;background:#8b5cf6;color:#fff;padding:4px 18px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.05em;margin-bottom:12px}
  .confirm-meta{font-size:14px;color:#4c1d95;font-weight:600}
  .confirm-detail{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;text-align:left}
  .detail-block{background:#fff;border:1px solid #ddd6fe;border-radius:10px;padding:14px}
  .detail-block .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7c3aed;margin-bottom:4px;font-weight:700}
  .detail-block .val{font-size:14px;font-weight:700;color:#1e1b4b}
  .qr-placeholder{border:2px dashed #ddd6fe;border-radius:10px;width:80px;height:80px;display:flex;align-items:center;justify-content:center;color:#c4b5fd;font-size:10px;text-align:center;margin:12px auto 0}
</style>
</head>
<body><div class="page">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="font-size:22px;color:#1e1b4b">✓ Appointment Confirmed</h1>
    <div class="sub" style="color:#7c3aed">Please bring this confirmation slip on the day of your appointment</div>
  </div>
  <div class="confirm-card">
    <div class="status">CONFIRMED</div>
    <div class="ref">${b.booking_number || '—'}</div>
    <div class="confirm-meta">${b.service_name || '—'}</div>
    <div class="confirm-detail">
      <div class="detail-block"><div class="lbl">Customer</div><div class="val">${b.customer_name || '—'}</div>${b.customer_phone ? `<div style="font-size:12px;color:#6d28d9;margin-top:2px">${b.customer_phone}</div>` : ''}</div>
      <div class="detail-block"><div class="lbl">Date</div><div class="val">${date}</div></div>
      <div class="detail-block"><div class="lbl">Time</div><div class="val">${time}</div></div>
      <div class="detail-block"><div class="lbl">${b.assigned_staff_name ? 'Service Provider' : 'Amount'}</div><div class="val">${b.assigned_staff_name || fmt(b.total)}</div></div>
    </div>
    <div class="qr-placeholder">QR<br/>Code</div>
  </div>
  ${b.notes ? `<p style="font-size:12px;color:#555;text-align:center;margin-bottom:16px;font-style:italic">"${b.notes}"</p>` : ''}
  <hr class="divider"/>
  <p style="font-size:11px;color:#7c3aed;text-align:center;margin-bottom:6px;font-weight:600">CANCELLATION POLICY</p>
  <p style="font-size:11px;color:#aaa;text-align:center">Please cancel or reschedule at least 24 hours before your appointment to avoid charges.</p>
  <div class="footer">Booking Confirmation · ${b.booking_number || ''} · Keep this for your records</div>
</div></body></html>`
}

function generateWorkOrder(b: BookingInfo): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Work Order – ${b.booking_number || ''}</title>${baseStyles()}</head>
<body><div class="page">
  ${docHeader('WORK ORDER', `Job Card for Booking ${b.booking_number || ''}`)}
  <hr class="divider"/>
  ${infoGrid(b)}
  <hr class="divider"/>
  <table>
    <thead><tr><th>#</th><th>Task / Description</th><th>Status</th><th>Remarks</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${b.service_name || 'Service'}</td><td style="color:#f59e0b">Pending</td><td></td></tr>
      <tr><td>2</td><td></td><td></td><td></td></tr>
      <tr><td>3</td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
  ${b.notes ? `<p style="font-size:12px;color:#555;margin-bottom:16px"><strong>Customer Notes:</strong> ${b.notes}</p>` : ''}
  <hr class="divider"/>
  <div class="grid" style="margin-top:20px">
    <div><div class="lbl">Service Provider Signature</div><div class="sig-box">Sign here</div></div>
    <div><div class="lbl">Customer Acknowledgement</div><div class="sig-box">Sign here</div></div>
  </div>
  <div class="footer">This work order was auto-generated for booking ${b.booking_number || ''}</div>
</div></body></html>`
}

function generatePrescription(b: BookingInfo): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Prescription – ${b.booking_number || ''}</title>${baseStyles()}</head>
<body><div class="page">
  ${docHeader('℞ PRESCRIPTION', `Booking ${b.booking_number || ''}`)}
  <hr class="divider"/>
  ${infoGrid(b)}
  <hr class="divider"/>
  <p style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Diagnosis</p>
  <div style="border:1px solid #e5e7eb;border-radius:8px;min-height:60px;padding:12px;margin-bottom:16px;font-size:13px;color:#555"></div>
  <p style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Medications</p>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
    <tbody>
      <tr><td>1</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>3</td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
  <p style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Advice / Instructions</p>
  <div style="border:1px solid #e5e7eb;border-radius:8px;min-height:48px;padding:12px;margin-bottom:20px"></div>
  <hr class="divider"/>
  <div style="display:flex;justify-content:flex-end">
    <div style="text-align:center">
      <div class="sig-box" style="width:200px">Doctor Signature</div>
      <div style="font-size:11px;color:#888;margin-top:6px">${b.assigned_staff_name || 'Doctor Name'} · Registration #</div>
    </div>
  </div>
  <div class="footer">Computer-generated prescription. Valid for this consultation only.</div>
</div></body></html>`
}

function generateDeliveryChallan(b: BookingInfo): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Delivery Challan – ${b.booking_number || ''}</title>${baseStyles()}</head>
<body><div class="page">
  ${docHeader('DELIVERY CHALLAN', `Booking ${b.booking_number || ''}`)}
  <hr class="divider"/>
  ${infoGrid(b)}
  <hr class="divider"/>
  <table>
    <thead><tr><th>#</th><th>Description of Goods / Service</th><th>Qty</th><th>Unit</th><th>Remarks</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${b.service_name || ''}</td><td>1</td><td>Nos</td><td></td></tr>
      <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>3</td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
  <hr class="divider"/>
  <p style="font-size:11px;color:#777;margin-bottom:16px">This is not a tax invoice. It is a delivery document only.</p>
  <div class="grid">
    <div><div class="lbl">Dispatched by</div><div class="sig-box">Signature</div></div>
    <div><div class="lbl">Received by (Customer)</div><div class="sig-box">Signature</div></div>
  </div>
  <div class="footer">Delivery Challan · Booking ${b.booking_number || ''}</div>
</div></body></html>`
}

function generateQuotation(b: BookingInfo): string {
  const amt = b.total ? `₹${Number(b.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Quotation – ${b.booking_number || ''}</title>${baseStyles()}</head>
<body><div class="page">
  ${docHeader('QUOTATION / ESTIMATE', `Ref: ${b.booking_number || ''}`)}
  <hr class="divider"/>
  ${infoGrid(b)}
  <hr class="divider"/>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${b.service_name || 'Service'}</td><td>1</td><td>${amt}</td><td>${amt}</td></tr>
      <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
    </tbody>
    <tfoot>
      <tr><td colspan="4" style="text-align:right;font-weight:600">Total</td><td style="font-weight:700">${amt}</td></tr>
    </tfoot>
  </table>
  <p style="font-size:11px;color:#777;margin-bottom:20px">This quotation is valid for 7 days from the date of issue.</p>
  <hr class="divider"/>
  <div class="grid">
    <div><div class="lbl">Authorised by</div><div class="sig-box">Signature</div></div>
    <div><div class="lbl">Customer Acceptance</div><div class="sig-box">Signature</div></div>
  </div>
  <div class="footer">Quotation · Not a tax invoice</div>
</div></body></html>`
}

function generateQualityReport(b: BookingInfo): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Quality Report – ${b.booking_number || ''}</title>${baseStyles()}</head>
<body><div class="page">
  ${docHeader('QUALITY INSPECTION REPORT', `Booking ${b.booking_number || ''}`)}
  <hr class="divider"/>
  ${infoGrid(b)}
  <hr class="divider"/>
  <table>
    <thead><tr><th>#</th><th>Inspection Parameter</th><th>Standard</th><th>Actual</th><th>Pass / Fail</th></tr></thead>
    <tbody>
      ${[1,2,3,4,5].map(i => `<tr><td>${i}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600">Overall Result</p>
  <div style="display:flex;gap:24px;margin-bottom:20px">
    <label style="font-size:13px;cursor:pointer"><input type="checkbox" style="margin-right:6px"/>Pass</label>
    <label style="font-size:13px;cursor:pointer"><input type="checkbox" style="margin-right:6px"/>Fail</label>
    <label style="font-size:13px;cursor:pointer"><input type="checkbox" style="margin-right:6px"/>Conditional</label>
  </div>
  <p style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600">Remarks</p>
  <div style="border:1px solid #e5e7eb;border-radius:8px;min-height:48px;padding:12px;margin-bottom:20px"></div>
  <hr class="divider"/>
  <div class="grid">
    <div><div class="lbl">Inspector Signature</div><div class="sig-box">Signature</div></div>
    <div><div class="lbl">Customer Acknowledgement</div><div class="sig-box">Signature</div></div>
  </div>
  <div class="footer">Quality Inspection Report · Booking ${b.booking_number || ''}</div>
</div></body></html>`
}

function generateSOP(b: BookingInfo): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SOP – ${b.service_name || ''}</title>${baseStyles()}</head>
<body><div class="page">
  ${docHeader('STANDARD OPERATING PROCEDURE', b.service_name || 'Service Procedure')}
  <hr class="divider"/>
  ${infoGrid(b)}
  <hr class="divider"/>
  <table>
    <thead><tr><th>Step</th><th>Activity</th><th>Responsible</th><th>Duration</th><th>Done</th></tr></thead>
    <tbody>
      ${[1,2,3,4,5,6].map(i => `<tr><td>${i}</td><td></td><td>${i===1 ? b.assigned_staff_name || '' : ''}</td><td></td><td style="text-align:center">☐</td></tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600">Notes / Special Instructions</p>
  <div style="border:1px solid #e5e7eb;border-radius:8px;min-height:48px;padding:12px;margin-bottom:20px">${b.notes || ''}</div>
  <hr class="divider"/>
  <div class="grid">
    <div><div class="lbl">Reviewed by</div><div class="sig-box">Signature</div></div>
    <div><div class="lbl">Approved by</div><div class="sig-box">Signature</div></div>
  </div>
  <div class="footer">SOP · ${b.service_name || ''} · Booking ${b.booking_number || ''}</div>
</div></body></html>`
}

function buildDocHtml(typeId: BookingDocTypeId, booking: BookingInfo): string | null {
  const generators: Record<BookingDocTypeId, (b: BookingInfo) => string> = {
    booking_confirmation: generateBookingConfirmation,
    work_order:           generateWorkOrder,
    prescription:         generatePrescription,
    delivery_challan:     generateDeliveryChallan,
    quotation:            generateQuotation,
    quality_report:       generateQualityReport,
    sop:                  generateSOP,
  }
  return generators[typeId]?.(booking) ?? null
}

export function viewBookingDocument(typeId: BookingDocTypeId, booking: BookingInfo) {
  const html = buildDocHtml(typeId, booking)
  if (!html) return
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

export function printBookingDocument(typeId: BookingDocTypeId, booking: BookingInfo) {
  const html = buildDocHtml(typeId, booking)
  if (!html) return
  openPrintWindow(html)
}

export async function downloadBookingDocument(typeId: BookingDocTypeId, booking: BookingInfo) {
  const html = buildDocHtml(typeId, booking)
  if (!html) return
  const label = BOOKING_DOC_TYPES.find(d => d.id === typeId)?.label || typeId
  const filename = `${label.replace(/\s+/g, '_')}_${booking.booking_number || 'booking'}.pdf`
  await downloadAsPdf(html, filename)
}
