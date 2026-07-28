import { useState, useLayoutEffect, useRef, useCallback, useEffect } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Stethoscope, ClipboardList, Wrench, Truck,
  FileCheck, BookOpen, Users, ChevronDown, ChevronUp,
  Palette, Building2, ToggleLeft, Check, Upload, X,
  RotateCcw, ArrowLeft, Eye, ScrollText, ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'

// ─── Template Type Definitions ────────────────────────────────────────────────

type DocTemplateId =
  | 'prescription'
  | 'sop'
  | 'work_order'
  | 'delivery_challan'
  | 'quotation'
  | 'quality_report'
  | 'meeting_minutes'
  | 'hr_letter'

interface DocTemplateType {
  id: DocTemplateId
  label: string
  desc: string
  icon: React.ElementType
  color: string
  bg: string
  category: string
}

const TEMPLATE_TYPES: DocTemplateType[] = [
  { id: 'prescription', label: 'Doctor Prescription', desc: 'Rx pads with patient, diagnosis & medication details', icon: Stethoscope, color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-500/15 dark:bg-blue-500/20', category: 'Healthcare' },
  { id: 'sop', label: 'SOP / Procedure', desc: 'Standard Operating Procedure with steps & approvals', icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/12 dark:bg-primary/20', category: 'Operations' },
  { id: 'work_order', label: 'Work Order', desc: 'Job card for services, repairs & maintenance tasks', icon: Wrench, color: 'text-orange-600 dark:text-orange-300', bg: 'bg-orange-500/15 dark:bg-orange-500/20', category: 'Operations' },
  { id: 'delivery_challan', label: 'Delivery Challan', desc: 'Shipment document listing items being dispatched', icon: Truck, color: 'text-teal-600 dark:text-teal-300', bg: 'bg-teal-500/15 dark:bg-teal-500/20', category: 'Logistics' },
  { id: 'quality_report', label: 'Quality Report', desc: 'QC inspection checklist & test results document', icon: FileCheck, color: 'text-green-600 dark:text-green-300', bg: 'bg-green-500/15 dark:bg-green-500/20', category: 'Operations' },
  { id: 'meeting_minutes', label: 'Meeting Minutes', desc: 'Meeting summary with attendees & action items', icon: BookOpen, color: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-500/15 dark:bg-rose-500/20', category: 'Admin' },
  { id: 'hr_letter', label: 'HR Letter', desc: 'Offer, appraisal, warning & experience letters', icon: Users, color: 'text-cyan-600 dark:text-cyan-300', bg: 'bg-cyan-500/15 dark:bg-cyan-500/20', category: 'HR' },
]

/** Billing & procurement templates — open the dedicated full template editors. */
const LINKED_TEMPLATE_TYPES = [
  {
    id: 'invoice_templates',
    label: 'Invoice Templates',
    desc: 'GST invoices, receipts & customer billing — themes, branding & PDF layout',
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-300',
    bg: 'bg-blue-500/15 dark:bg-blue-500/20',
    category: 'Sales',
    href: '/invoices/templates',
  },
  {
    id: 'quotation_templates',
    label: 'Quotation Templates',
    desc: 'Sales estimates & price quotes — print/PDF layout for quotations',
    icon: ScrollText,
    color: 'text-indigo-600 dark:text-indigo-300',
    bg: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    category: 'Sales',
    href: '/quotations/templates',
  },
  {
    id: 'po_templates',
    label: 'Purchase Order Templates',
    desc: 'Supplier purchase orders — themes, branding & print settings',
    icon: ShoppingCart,
    color: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-500/15 dark:bg-amber-500/20',
    category: 'Purchasing',
    href: '/purchase-orders/templates',
  },
] as const

// ─── Per-template settings interfaces ────────────────────────────────────────

interface BaseDocSettings {
  theme_color: string
  logo_url?: string
  show_logo: boolean
  show_watermark: boolean
  watermark_text?: string
  header_note?: string
  footer_note?: string
  show_signature: boolean
  signatory_name?: string
  paper_size: 'A4' | 'Letter' | 'A5'
}

interface PrescriptionSettings extends BaseDocSettings {
  clinic_name?: string
  doctor_name?: string
  doctor_degree?: string
  reg_number?: string
  clinic_address?: string
  clinic_phone?: string
  show_patient_age: boolean
  show_patient_address: boolean
  show_vitals: boolean
  show_allergy_warning: boolean
  rx_layout: 'classic' | 'modern' | 'minimal'
}

interface SOPSettings extends BaseDocSettings {
  dept_label?: string
  show_version: boolean
  show_effective_date: boolean
  show_review_date: boolean
  show_approval_table: boolean
  show_references: boolean
  show_revision_history: boolean
  step_numbering: 'numeric' | 'alpha' | 'roman'
  sop_layout: 'classic' | 'modern' | 'compact'
}

interface WorkOrderSettings extends BaseDocSettings {
  show_customer_details: boolean
  show_assigned_tech: boolean
  show_materials_list: boolean
  show_labor_hours: boolean
  show_warranty_note: boolean
  show_customer_signature: boolean
  wo_layout: 'classic' | 'modern' | 'minimal'
}

interface DeliverySettings extends BaseDocSettings {
  show_vehicle_number: boolean
  show_driver_name: boolean
  show_eway_bill: boolean
  show_receiver_signature: boolean
  show_weight: boolean
  show_batch_number: boolean
  dc_layout: 'classic' | 'modern' | 'minimal'
}

interface QuotationSettings extends BaseDocSettings {
  show_validity: boolean
  validity_days: number
  show_discount: boolean
  show_tax: boolean
  show_terms: boolean
  default_terms?: string
  show_bank_details: boolean
  quote_layout: 'classic' | 'modern' | 'minimal'
}

interface QualitySettings extends BaseDocSettings {
  show_batch_info: boolean
  show_inspector: boolean
  show_test_parameters: boolean
  show_pass_fail: boolean
  show_remarks: boolean
  show_approval: boolean
  qr_layout: 'classic' | 'checklist' | 'table'
}

interface MeetingSettings extends BaseDocSettings {
  show_attendees: boolean
  show_agenda: boolean
  show_action_items: boolean
  show_next_meeting: boolean
  show_decisions: boolean
  mt_layout: 'classic' | 'modern' | 'minimal'
}

interface HRLetterSettings extends BaseDocSettings {
  letter_type: 'offer' | 'appraisal' | 'warning' | 'experience' | 'noc' | 'custom'
  show_hr_signature: boolean
  show_md_signature: boolean
  company_seal: boolean
  hr_layout: 'classic' | 'modern' | 'formal'
}

type AnyDocSettings =
  | PrescriptionSettings | SOPSettings | WorkOrderSettings | DeliverySettings
  | QuotationSettings | QualitySettings | MeetingSettings | HRLetterSettings

// ─── Defaults ─────────────────────────────────────────────────────────────────

const BASE_DEFAULTS: BaseDocSettings = {
  theme_color: '#1a56db',
  show_logo: true,
  show_watermark: false,
  show_signature: true,
  paper_size: 'A4',
}

const DEFAULTS: Record<DocTemplateId, AnyDocSettings> = {
  prescription: {
    ...BASE_DEFAULTS, theme_color: '#0ea5e9',
    show_patient_age: true, show_patient_address: false,
    show_vitals: true, show_allergy_warning: true, rx_layout: 'classic',
  } as PrescriptionSettings,
  sop: {
    ...BASE_DEFAULTS, theme_color: '#64C3A0',
    show_version: true, show_effective_date: true, show_review_date: true,
    show_approval_table: true, show_references: true, show_revision_history: true,
    step_numbering: 'numeric', sop_layout: 'classic',
  } as SOPSettings,
  work_order: {
    ...BASE_DEFAULTS, theme_color: '#ea580c',
    show_customer_details: true, show_assigned_tech: true,
    show_materials_list: true, show_labor_hours: true,
    show_warranty_note: true, show_customer_signature: true, wo_layout: 'classic',
  } as WorkOrderSettings,
  delivery_challan: {
    ...BASE_DEFAULTS, theme_color: '#0d9488',
    show_vehicle_number: true, show_driver_name: true,
    show_eway_bill: false, show_receiver_signature: true,
    show_weight: false, show_batch_number: false, dc_layout: 'classic',
  } as DeliverySettings,
  quotation: {
    ...BASE_DEFAULTS, theme_color: '#4f46e5',
    show_validity: true, validity_days: 15, show_discount: true,
    show_tax: true, show_terms: true, show_bank_details: false, quote_layout: 'classic',
  } as QuotationSettings,
  quality_report: {
    ...BASE_DEFAULTS, theme_color: '#16a34a',
    show_batch_info: true, show_inspector: true, show_test_parameters: true,
    show_pass_fail: true, show_remarks: true, show_approval: true, qr_layout: 'classic',
  } as QualitySettings,
  meeting_minutes: {
    ...BASE_DEFAULTS, theme_color: '#e11d48',
    show_attendees: true, show_agenda: true, show_action_items: true,
    show_next_meeting: true, show_decisions: true, mt_layout: 'classic',
  } as MeetingSettings,
  hr_letter: {
    ...BASE_DEFAULTS, theme_color: '#0891b2',
    letter_type: 'offer', show_hr_signature: true, show_md_signature: true,
    company_seal: false, hr_layout: 'formal',
  } as HRLetterSettings,
}

const STORAGE_KEY = 'doc_template_settings_v1'

function loadSettings(): Record<string, AnyDocSettings> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveSettings(id: string, s: AnyDocSettings) {
  const all = loadSettings()
  all[id] = s
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────

const COLORS = [
  { label: 'Blue',    value: '#1a56db' }, { label: 'Indigo',  value: '#4f46e5' },
  { label: 'Brand',  value: '#64C3A0' }, { label: 'Sky',     value: '#0ea5e9' },
  { label: 'Teal',    value: '#0d9488' }, { label: 'Green',   value: '#16a34a' },
  { label: 'Orange',  value: '#ea580c' }, { label: 'Rose',    value: '#e11d48' },
  { label: 'Cyan',    value: '#0891b2' }, { label: 'Slate',   value: '#475569' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccordionSection({ title, children, defaultOpen = false, badge }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
        onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2">
          {title}
          {badge && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">{badge}</span>}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer gap-3">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full border-2 transition-colors ${checked ? 'border-transparent bg-primary' : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'}`}>
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }} />
      </button>
    </label>
  )
}

// ─── HTML Preview Generators ──────────────────────────────────────────────────

function generatePrescriptionHtml(s: PrescriptionSettings): string {
  const c = s.theme_color || '#0ea5e9'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:600px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:20px 24px;color:#fff}
.rx-body{padding:20px 24px}.sep{border-top:1px solid #e5e7eb;margin:12px 0}
.field{display:flex;gap:8px;margin-bottom:8px;font-size:11px}
.field-label{color:#6b7280;min-width:80px}.field-val{font-weight:600;color:#111}
.rx-title{font-size:28px;font-weight:900;opacity:.3;letter-spacing:2px;margin-bottom:8px}
.med-row{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6}
.med-num{font-size:16px;font-weight:900;color:${c};min-width:20px}
.med-name{font-weight:700;font-size:13px}.med-dose{font-size:11px;color:#6b7280;margin-top:2px}
.sig-area{margin-top:20px;text-align:right}.sig-line{border-top:1px solid #374151;width:160px;margin:0 0 4px auto}
.footer{background:#f8fafc;padding:12px 24px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head><body><div class="page">
<div class="header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:18px;font-weight:800">${s.clinic_name || 'HealthCare Clinic'}</div>
      <div style="font-size:11px;opacity:.8;margin-top:2px">${s.doctor_name || 'Dr. Priya Sharma'}${s.doctor_degree ? `, ${s.doctor_degree}` : ', MBBS, MD'}</div>
      ${s.reg_number ? `<div style="font-size:10px;opacity:.7;margin-top:1px">Reg. No: ${s.reg_number}</div>` : '<div style="font-size:10px;opacity:.7">Reg. No: MH-12345</div>'}
      ${s.clinic_address ? `<div style="font-size:10px;opacity:.7;margin-top:1px">${s.clinic_address}</div>` : ''}
    </div>
    <div style="text-align:right;font-size:10px;opacity:.8">
      ${s.clinic_phone ? `<div>📞 ${s.clinic_phone}</div>` : '<div>📞 +91 99999 00000</div>'}
      <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
    </div>
  </div>
</div>
<div class="rx-body">
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
    <div class="field"><span class="field-label">Patient:</span><span class="field-val">Rahul Mehta</span></div>
    ${s.show_patient_age ? '<div class="field"><span class="field-label">Age / Sex:</span><span class="field-val">34 yr / M</span></div>' : ''}
    ${s.show_patient_address ? '<div class="field"><span class="field-label">Address:</span><span class="field-val">Banjara Hills, Hyd</span></div>' : ''}
  </div>
  ${s.show_vitals ? `<div style="display:flex;gap:16px;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:11px">
    <span><b>BP:</b> 120/80</span><span><b>Temp:</b> 98.6°F</span><span><b>Pulse:</b> 72/min</span><span><b>SpO2:</b> 98%</span>
  </div>` : ''}
  <div style="margin-bottom:8px;font-size:11px"><span class="field-label">Diagnosis:</span> <b>Viral Upper Respiratory Tract Infection</b></div>
  ${s.show_allergy_warning ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:6px 10px;font-size:10px;color:#dc2626;margin-bottom:10px">⚠ Known Allergy: Penicillin</div>' : ''}
  <div class="sep"></div>
  <div class="rx-title">℞</div>
  ${[
    { n: '1', name: 'Tab. Amoxicillin 500mg', dose: '1-0-1 for 5 days | After food' },
    { n: '2', name: 'Tab. Paracetamol 650mg', dose: '1-1-1 SOS (if fever > 101°F)' },
    { n: '3', name: 'Syp. Benadryl 10ml',     dose: 'Twice daily at night' },
  ].map(m => `<div class="med-row"><span class="med-num">${m.n}</span><div><div class="med-name">${m.name}</div><div class="med-dose">${m.dose}</div></div></div>`).join('')}
  <div class="sep"></div>
  <div style="font-size:11px;color:#6b7280">Next Visit: After 5 days. Rest adequately. Drink warm fluids. Avoid cold food.</div>
  ${s.show_signature ? `<div class="sig-area"><div class="sig-line"></div><div style="font-size:11px;font-weight:600">${s.signatory_name || s.doctor_name || 'Dr. Priya Sharma'}</div><div style="font-size:10px;color:#9ca3af">Signature & Stamp</div></div>` : ''}
</div>
<div class="footer">${s.footer_note || 'This prescription is valid for 30 days from the date of issue. Keep out of reach of children.'}</div>
</div></body></html>`
}

function generateSOPHtml(s: SOPSettings): string {
  const c = s.theme_color || '#64C3A0'
  const steps = ['Identify the need for the procedure', 'Gather all required materials and tools', 'Follow safety protocols — wear PPE if required', 'Execute each step in sequence as documented', 'Verify output meets quality criteria', 'Record all observations in the log sheet', 'Obtain supervisor sign-off before closing']
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:740px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:20px 28px;color:#fff}
.meta-bar{background:#f8fafc;border-bottom:1px solid #e5e7eb;padding:10px 28px;display:flex;gap:24px;font-size:11px}
.meta-item{display:flex;flex-direction:column;gap:2px}
.meta-label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
.body{padding:24px 28px}.section{margin-bottom:20px}
.section-title{font-size:13px;font-weight:700;color:${c};border-bottom:2px solid ${c};padding-bottom:4px;margin-bottom:10px}
.step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start}
.step-num{background:${c};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;shrink:0}
.step-text{flex:1;font-size:12px;padding-top:3px}
.approval-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
.approval-table th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
.approval-table td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
.footer{background:#f8fafc;border-top:1px solid #e5e7eb;padding:10px 28px;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body><div class="page">
<div class="header">
  <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Standard Operating Procedure</div>
  <div style="font-size:18px;font-weight:800">Equipment Sanitisation Protocol</div>
  ${s.dept_label ? `<div style="font-size:11px;opacity:.8;margin-top:2px">Department: ${s.dept_label}</div>` : '<div style="font-size:11px;opacity:.8;margin-top:2px">Department: Quality Assurance</div>'}
</div>
<div class="meta-bar">
  <div class="meta-item"><span class="meta-label">SOP Number</span><span>SOP-QA-042</span></div>
  ${s.show_version ? '<div class="meta-item"><span class="meta-label">Version</span><span>v2.1</span></div>' : ''}
  ${s.show_effective_date ? '<div class="meta-item"><span class="meta-label">Effective Date</span><span>01 Apr 2025</span></div>' : ''}
  ${s.show_review_date ? '<div class="meta-item"><span class="meta-label">Next Review</span><span>01 Apr 2026</span></div>' : ''}
</div>
<div class="body">
  <div class="section">
    <div class="section-title">1. Purpose</div>
    <p style="font-size:12px;color:#374151;line-height:1.6">This SOP establishes a standardised method for sanitising production equipment to prevent cross-contamination and maintain product quality.</p>
  </div>
  <div class="section">
    <div class="section-title">2. Scope</div>
    <p style="font-size:12px;color:#374151;line-height:1.6">Applies to all production-line equipment in the manufacturing facility. Mandatory before each shift and after handling allergen-containing materials.</p>
  </div>
  <div class="section">
    <div class="section-title">3. Procedure Steps</div>
    ${steps.map((step, i) => `<div class="step"><div class="step-num">${i + 1}</div><div class="step-text">${step}</div></div>`).join('')}
  </div>
  ${s.show_references ? `<div class="section"><div class="section-title">4. References</div>
    <ul style="font-size:11px;color:#374151;list-style:disc;padding-left:18px;line-height:1.8">
      <li>ISO 22000:2018 — Food Safety Management</li><li>FSSAI Hygiene &amp; Sanitation Guidelines</li><li>Internal QC Manual v3.0</li>
    </ul></div>` : ''}
  ${s.show_approval_table ? `<div class="section"><div class="section-title">${s.show_references ? '5' : '4'}. Approval &amp; Sign-off</div>
    <table class="approval-table"><thead><tr><th><TableColumnLabel>Role</TableColumnLabel></th><th><TableColumnLabel>Name</TableColumnLabel></th><th><TableColumnLabel>Signature</TableColumnLabel></th><th><TableColumnLabel>Date</TableColumnLabel></th></tr></thead>
    <tbody>
      <tr><td>Prepared By</td><td>Anita Rao</td><td style="border-bottom:1px solid #374151;min-width:120px"> </td><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
      <tr><td>Reviewed By</td><td>Dept. Manager</td><td style="border-bottom:1px solid #374151;min-width:120px"> </td><td></td></tr>
      <tr><td>Approved By</td><td>QA Head</td><td style="border-bottom:1px solid #374151;min-width:120px"> </td><td></td></tr>
    </tbody></table></div>` : ''}
</div>
<div class="footer">${s.footer_note || 'Controlled Document — Do not distribute without authorisation. Check intranet for latest version.'}</div>
</div></body></html>`
}

function generateWorkOrderHtml(s: WorkOrderSettings): string {
  const c = s.theme_color || '#ea580c'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:700px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:18px 24px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start}
.body{padding:20px 24px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.info-box{background:#f8fafc;border-radius:8px;padding:12px;font-size:11px}
.info-label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.info-val{font-weight:600;color:#111}
.items-table{width:100%;border-collapse:collapse;font-size:11px;margin:12px 0}
.items-table th{background:${c};color:#fff;padding:7px 10px;text-align:left;font-size:10px}
.items-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
.sig-row{display:flex;justify-content:space-between;margin-top:20px}
.sig-box{text-align:center;width:180px}
.sig-line{border-top:1px solid #374151;margin-bottom:4px}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div style="font-size:11px;opacity:.8;text-transform:uppercase;letter-spacing:.08em">Work Order</div>
    <div style="font-size:18px;font-weight:800;margin-top:2px">WO-2025-0091</div>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.85">
    <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
    <div style="margin-top:4px;background:rgba(255,255,255,.2);padding:3px 10px;border-radius:20px;font-weight:700;font-size:12px">OPEN</div>
  </div>
</div>
<div class="body">
  ${s.show_customer_details ? `<div class="grid2">
    <div class="info-box"><div class="info-label">Customer</div><div class="info-val">Ramesh & Co.</div><div style="font-size:10px;color:#6b7280;margin-top:2px">+91 98765 00001 · ramesh@co.in</div></div>
    <div class="info-box"><div class="info-label">Job Description</div><div class="info-val">Annual AC Servicing & Filter Replacement</div></div>
  </div>` : ''}
  ${s.show_assigned_tech ? `<div class="info-box" style="margin-bottom:12px"><div class="info-label">Assigned Technician</div><div style="display:flex;align-items:center;gap:8px;margin-top:3px"><div style="width:28px;height:28px;border-radius:50%;background:${c}22;display:flex;align-items:center;justify-content:center;font-weight:700;color:${c};font-size:12px">SK</div><div><div class="info-val">Suresh Kumar</div><div style="font-size:10px;color:#6b7280">EMP-042 · HVAC Technician</div></div></div></div>` : ''}
  ${s.show_materials_list ? `<table class="items-table"><thead><tr><th><TableColumnLabel>#</TableColumnLabel></th><th><TableColumnLabel>Material / Part</TableColumnLabel></th><th><TableColumnLabel>Qty</TableColumnLabel></th><th><TableColumnLabel>Unit</TableColumnLabel></th></tr></thead>
    <tbody>
      <tr><td>1</td><td>AC Filter 1.5 Ton Compatible</td><td>2</td><td>Pcs</td></tr>
      <tr><td>2</td><td>Refrigerant R22</td><td>500</td><td>g</td></tr>
      <tr><td>3</td><td>Cleaning Solution</td><td>1</td><td>Ltr</td></tr>
    </tbody></table>` : ''}
  ${s.show_labor_hours ? `<div class="grid2" style="margin-top:12px">
    <div class="info-box"><div class="info-label">Estimated Hours</div><div class="info-val">3 hrs</div></div>
    <div class="info-box"><div class="info-label">Scheduled Time</div><div class="info-val">${new Date().toLocaleDateString('en-IN')} · 10:00 AM</div></div>
  </div>` : ''}
  ${s.show_warranty_note ? '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:12px">⚡ Warranty: Parts carry 3-month warranty. Labour covered for 30 days after service completion.</div>' : ''}
  <div class="sig-row">
    ${s.show_signature ? `<div class="sig-box"><div style="height:40px"> </div><div class="sig-line"></div><div style="font-size:11px;font-weight:600">${s.signatory_name || 'Service Manager'}</div><div style="font-size:10px;color:#9ca3af">Authorised By</div></div>` : '<div></div>'}
    ${s.show_customer_signature ? `<div class="sig-box"><div style="height:40px"> </div><div class="sig-line"></div><div style="font-size:11px;font-weight:600">Customer Signature</div><div style="font-size:10px;color:#9ca3af">Accept &amp; Acknowledge</div></div>` : ''}
  </div>
</div></div></body></html>`
}

function generateDeliveryHtml(s: DeliverySettings): string {
  const c = s.theme_color || '#0d9488'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:700px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:18px 24px;color:#fff;display:flex;justify-content:space-between}
.body{padding:20px 24px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.info-box{background:#f8fafc;border-radius:8px;padding:12px;font-size:11px}
.info-label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.info-val{font-weight:600;color:#111}
.items-table{width:100%;border-collapse:collapse;font-size:11px}
.items-table th{background:${c};color:#fff;padding:7px 10px;text-align:left;font-size:10px}
.items-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
.sig-row{display:flex;justify-content:space-between;margin-top:20px}
.sig-box{text-align:center;min-width:160px}
.sig-line{border-top:1px solid #374151;margin:0 0 4px}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.1em">Delivery Challan</div>
    <div style="font-size:18px;font-weight:800;margin-top:2px">DC-2025-00187</div>
    <div style="font-size:11px;opacity:.75;margin-top:3px">Date: ${new Date().toLocaleDateString('en-IN')}</div>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.85">
    ${s.show_eway_bill ? '<div>e-Way Bill: EWB-241567890</div>' : ''}
    ${s.show_vehicle_number ? '<div style="margin-top:4px">Vehicle: MH-04-AB-1234</div>' : ''}
    ${s.show_driver_name ? '<div style="margin-top:2px">Driver: Ramesh Yadav</div>' : ''}
  </div>
</div>
<div class="body">
  <div class="grid2">
    <div class="info-box"><div class="info-label">Dispatched From</div><div class="info-val">Main Warehouse, Hyderabad</div><div style="font-size:10px;color:#6b7280;margin-top:2px">Gate 3, Logistics Park, Medchal 501401</div></div>
    <div class="info-box"><div class="info-label">Deliver To</div><div class="info-val">ABC Corp – Mumbai Branch</div><div style="font-size:10px;color:#6b7280;margin-top:2px">12, BKC Complex, Mumbai 400051</div></div>
  </div>
  <table class="items-table"><thead><tr><th><TableColumnLabel>#</TableColumnLabel></th><th><TableColumnLabel>Item Description</TableColumnLabel></th><th><TableColumnLabel>SKU</TableColumnLabel></th>${s.show_batch_number ? '<th><TableColumnLabel>Batch</TableColumnLabel></th>' : ''}${s.show_weight ? '<th><TableColumnLabel>Weight</TableColumnLabel></th>' : ''}<th><TableColumnLabel>Qty</TableColumnLabel></th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Office Chair – Ergonomic Pro</td><td>CHR-001</td>${s.show_batch_number ? '<td>B2504</td>' : ''}${s.show_weight ? '<td>8 kg</td>' : ''}<td>10 Pcs</td></tr>
      <tr><td>2</td><td>Standing Desk 120cm</td><td>DSK-204</td>${s.show_batch_number ? '<td>B2504</td>' : ''}${s.show_weight ? '<td>22 kg</td>' : ''}<td>5 Pcs</td></tr>
      <tr><td>3</td><td>Monitor Stand</td><td>MNT-STD</td>${s.show_batch_number ? '<td>B2503</td>' : ''}${s.show_weight ? '<td>1.2 kg</td>' : ''}<td>15 Pcs</td></tr>
    </tbody>
  </table>
  <div class="sig-row">
    ${s.show_signature ? `<div class="sig-box"><div style="height:40px"> </div><div class="sig-line"></div><div style="font-size:11px;font-weight:600">${s.signatory_name || 'Despatch In-charge'}</div></div>` : '<div></div>'}
    ${s.show_receiver_signature ? `<div class="sig-box"><div style="height:40px"> </div><div class="sig-line"></div><div style="font-size:11px;font-weight:600">Receiver Signature</div><div style="font-size:10px;color:#9ca3af">With Date &amp; Stamp</div></div>` : ''}
  </div>
</div></div></body></html>`
}

function generateQuotationHtml(s: QuotationSettings): string {
  const c = s.theme_color || '#4f46e5'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:700px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:20px 24px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start}
.body{padding:20px 24px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.info-box{background:#f8fafc;border-radius:8px;padding:12px;font-size:11px}
.info-label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.info-val{font-weight:600;color:#111}
.items-table{width:100%;border-collapse:collapse;font-size:11px}
.items-table th{background:${c};color:#fff;padding:7px 10px;text-align:left;font-size:10px}
.items-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
.totals{margin-left:auto;margin-top:12px;width:260px;font-size:12px}
.total-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6}
.total-row.grand{font-weight:800;font-size:14px;color:${c};border-top:2px solid ${c};border-bottom:none;padding-top:6px}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.1em">Quotation</div>
    <div style="font-size:18px;font-weight:800;margin-top:2px">QT-2025-0034</div>
    <div style="font-size:11px;opacity:.75;margin-top:3px">Date: ${new Date().toLocaleDateString('en-IN')}${s.show_validity ? ` · Valid for ${s.validity_days || 15} days` : ''}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:14px;font-weight:700">Your Business Name</div>
    <div style="font-size:10px;opacity:.8;margin-top:2px">GSTIN: 36ABCDE1234F1Z5</div>
  </div>
</div>
<div class="body">
  <div class="grid2">
    <div class="info-box"><div class="info-label">Quoted To</div><div class="info-val">Sharma Enterprises</div><div style="font-size:10px;color:#6b7280;margin-top:2px">+91 98765 00011 · sharma@ent.com</div></div>
    <div class="info-box"><div class="info-label">Subject</div><div class="info-val">Office Furniture Supply</div><div style="font-size:10px;color:#6b7280;margin-top:2px">As per discussion on ${new Date().toLocaleDateString('en-IN')}</div></div>
  </div>
  <table class="items-table" style="margin-bottom:12px"><thead><tr><th><TableColumnLabel>#</TableColumnLabel></th><th><TableColumnLabel>Description</TableColumnLabel></th><th><TableColumnLabel>Qty</TableColumnLabel></th><th style="text-align:right"><TableColumnLabel>Unit Price</TableColumnLabel></th>${s.show_discount ? '<th style="text-align:right"><TableColumnLabel>Disc.</TableColumnLabel></th>' : ''}<th style="text-align:right"><TableColumnLabel>Amount</TableColumnLabel></th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Ergonomic Office Chair</td><td>10</td><td style="text-align:right">₹4,500</td>${s.show_discount ? '<td style="text-align:right">5%</td>' : ''}<td style="text-align:right">₹42,750</td></tr>
      <tr><td>2</td><td>Height-adjustable Desk</td><td>5</td><td style="text-align:right">₹12,000</td>${s.show_discount ? '<td style="text-align:right">—</td>' : ''}<td style="text-align:right">₹60,000</td></tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>₹1,02,750</span></div>
    ${s.show_discount ? '<div class="total-row"><span>Discount</span><span style="color:#16a34a">-₹2,250</span></div>' : ''}
    ${s.show_tax ? '<div class="total-row"><span>GST (18%)</span><span>₹18,090</span></div>' : ''}
    <div class="total-row grand"><span>Grand Total</span><span>₹1,18,590</span></div>
  </div>
  ${s.show_terms && s.default_terms ? `<div style="margin-top:16px;font-size:10px;color:#6b7280;border-top:1px solid #f3f4f6;padding-top:10px">${s.default_terms}</div>` : ''}
</div></div></body></html>`
}

function generateQualityHtml(s: QualitySettings): string {
  const c = s.theme_color || '#16a34a'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:700px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:18px 24px;color:#fff;display:flex;justify-content:space-between}
.body{padding:20px 24px}
.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.meta-box{background:#f8fafc;border-radius:8px;padding:10px;font-size:11px}
.meta-label{color:#9ca3af;font-size:10px;text-transform:uppercase;margin-bottom:2px}
.check-table{width:100%;border-collapse:collapse;font-size:11px}
.check-table th{background:${c};color:#fff;padding:7px 10px;text-align:left;font-size:10px}
.check-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
.badge-pass{background:#dcfce7;color:#16a34a;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px}
.badge-fail{background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px}
.badge-na{background:#f3f4f6;color:#6b7280;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.1em">Quality Inspection Report</div>
    <div style="font-size:18px;font-weight:800;margin-top:2px">QC-2025-00432</div>
    <div style="font-size:11px;opacity:.75;margin-top:3px">Date: ${new Date().toLocaleDateString('en-IN')}</div>
  </div>
  <div style="background:rgba(255,255,255,.2);border-radius:8px;padding:8px 16px;text-align:center">
    <div style="font-size:22px;font-weight:900">PASS</div>
    <div style="font-size:10px;opacity:.8">Overall Result</div>
  </div>
</div>
<div class="body">
  ${s.show_batch_info ? `<div class="meta-grid">
    <div class="meta-box"><div class="meta-label">Product</div><div style="font-weight:600">Herbal Face Cream 50g</div></div>
    <div class="meta-box"><div class="meta-label">Batch No.</div><div style="font-weight:600">B2504-012</div></div>
    <div class="meta-box"><div class="meta-label">Batch Size</div><div style="font-weight:600">500 Units</div></div>
  </div>` : ''}
  ${s.show_inspector ? `<div style="background:#f8fafc;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px;display:flex;gap:24px">
    <div><span style="color:#9ca3af">Inspector:</span> <span style="font-weight:600">Sunita Verma</span></div>
    <div><span style="color:#9ca3af">Shift:</span> <span style="font-weight:600">Morning (06:00–14:00)</span></div>
  </div>` : ''}
  ${s.show_test_parameters ? `<table class="check-table"><thead><tr><th><TableColumnLabel>#</TableColumnLabel></th><th><TableColumnLabel>Parameter</TableColumnLabel></th><th><TableColumnLabel>Specification</TableColumnLabel></th><th><TableColumnLabel>Observed</TableColumnLabel></th>${s.show_pass_fail ? '<th><TableColumnLabel>Result</TableColumnLabel></th>' : ''}${s.show_remarks ? '<th><TableColumnLabel>Remarks</TableColumnLabel></th>' : ''}</tr></thead>
    <tbody>
      <tr><td>1</td><td>pH Level</td><td>5.5 – 6.5</td><td>6.0</td>${s.show_pass_fail ? '<td><span class="badge-pass">PASS</span></td>' : ''}${s.show_remarks ? '<td>Within range</td>' : ''}</tr>
      <tr><td>2</td><td>Viscosity</td><td>8000–12000 cPs</td><td>9500 cPs</td>${s.show_pass_fail ? '<td><span class="badge-pass">PASS</span></td>' : ''}${s.show_remarks ? '<td>Acceptable</td>' : ''}</tr>
      <tr><td>3</td><td>Microbial Count</td><td>&lt;100 CFU/g</td><td>45 CFU/g</td>${s.show_pass_fail ? '<td><span class="badge-pass">PASS</span></td>' : ''}${s.show_remarks ? '<td>Well within limit</td>' : ''}</tr>
      <tr><td>4</td><td>Packaging Seal</td><td>Intact</td><td>Intact</td>${s.show_pass_fail ? '<td><span class="badge-pass">PASS</span></td>' : ''}${s.show_remarks ? '<td>—</td>' : ''}</tr>
    </tbody>
  </table>` : ''}
  ${s.show_approval ? `<div style="display:flex;justify-content:space-between;margin-top:20px">
    ${s.show_signature ? `<div style="text-align:center;min-width:160px"><div style="height:40px"> </div><div style="border-top:1px solid #374151;margin-bottom:4px"></div><div style="font-size:11px;font-weight:600">${s.signatory_name || 'QC Manager'}</div></div>` : '<div></div>'}
    <div style="text-align:center;min-width:160px"><div style="height:40px"> </div><div style="border-top:1px solid #374151;margin-bottom:4px"></div><div style="font-size:11px;font-weight:600">Production Manager</div></div>
  </div>` : ''}
</div></div></body></html>`
}

function generateMeetingHtml(s: MeetingSettings): string {
  const c = s.theme_color || '#e11d48'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Arial',sans-serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:700px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{background:${c};padding:18px 24px;color:#fff}
.body{padding:20px 24px}.section{margin-bottom:18px}
.section-title{font-size:12px;font-weight:700;color:${c};border-bottom:1px solid ${c}33;padding-bottom:4px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
.attendee{display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border-radius:20px;padding:3px 10px;font-size:11px;margin:3px}
.agenda-item{display:flex;gap:8px;margin-bottom:6px;font-size:11px}
.agenda-num{background:${c};color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:1px}
.action-row{display:flex;gap:8px;margin-bottom:6px;font-size:11px;align-items:flex-start}
.action-check{width:14px;height:14px;border:1px solid #d1d5db;border-radius:3px;flex-shrink:0;margin-top:2px}
</style></head><body><div class="page">
<div class="header">
  <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Meeting Minutes</div>
  <div style="font-size:17px;font-weight:800">Quarterly Product Review — Q1 2025</div>
  <div style="display:flex;gap:20px;margin-top:6px;font-size:11px;opacity:.85">
    <span>📅 ${new Date().toLocaleDateString('en-IN')}</span>
    <span>🕐 10:00 AM – 11:30 AM</span>
    <span>📍 Conference Room A</span>
  </div>
</div>
<div class="body">
  ${s.show_attendees ? `<div class="section"><div class="section-title">Attendees</div>
    <div>${['Ravi Menon (Chair)', 'Anita Rao (QA)', 'Deepak Singh (Sales)', 'Pooja Iyer (Finance)', 'Suresh Kumar (Ops)'].map(a => `<span class="attendee">${a}</span>`).join('')}</div>
  </div>` : ''}
  ${s.show_agenda ? `<div class="section"><div class="section-title">Agenda</div>
    ${['Q1 sales performance review', 'New product launch timeline discussion', 'Budget allocation for Q2 marketing', 'Customer feedback on recent orders', 'Any other business (AOB)']
      .map((a, i) => `<div class="agenda-item"><div class="agenda-num">${i+1}</div><div>${a}</div></div>`).join('')}
  </div>` : ''}
  ${s.show_decisions ? `<div class="section"><div class="section-title">Key Decisions</div>
    <ul style="list-style:disc;padding-left:16px;font-size:11px;line-height:1.8;color:#374151">
      <li>New product launch confirmed for 15 May 2025</li>
      <li>Marketing budget increased by 20% for Q2</li>
      <li>Weekly stand-ups to replace bi-weekly reviews</li>
    </ul>
  </div>` : ''}
  ${s.show_action_items ? `<div class="section"><div class="section-title">Action Items</div>
    ${[
      { task: 'Prepare Q1 sales summary deck', owner: 'Deepak Singh', due: '20 Apr 2025' },
      { task: 'Finalise product launch checklist', owner: 'Anita Rao', due: '25 Apr 2025' },
      { task: 'Submit Q2 budget proposal to MD', owner: 'Pooja Iyer', due: '22 Apr 2025' },
    ].map(a => `<div class="action-row"><div class="action-check"></div><div style="flex:1">${a.task}<span style="color:#9ca3af;margin-left:8px">→ ${a.owner}</span></div><div style="color:#6b7280;white-space:nowrap">${a.due}</div></div>`).join('')}
  </div>` : ''}
  ${s.show_next_meeting ? `<div style="background:#f8fafc;border-radius:8px;padding:10px 14px;font-size:11px;border-left:3px solid ${c}">
    <span style="color:#9ca3af">Next Meeting:</span> <span style="font-weight:600">15 May 2025 · 10:00 AM · Conference Room A</span>
  </div>` : ''}
</div></div></body></html>`
}

function generateHRLetterHtml(s: HRLetterSettings): string {
  const c = s.theme_color || '#0891b2'
  const letterContent: Record<string, { subject: string; body: string }> = {
    offer: { subject: 'Offer of Employment', body: `<p>Dear <strong>Mr./Ms. [Candidate Name]</strong>,</p>
<p style="margin-top:12px">We are pleased to offer you the position of <strong>Senior Software Engineer</strong> at <strong>Your Company Name</strong>, effective <strong>01 May 2025</strong>.</p>
<p style="margin-top:10px">Your compensation package will be as follows:</p>
<ul style="margin:10px 0 10px 20px;list-style:disc">
  <li>Annual CTC: <strong>₹18,00,000 /-</strong></li>
  <li>Probation Period: 3 months</li>
  <li>Annual Leave: 18 days</li>
</ul>
<p>Please sign and return the duplicate copy of this letter as acceptance by <strong>25 April 2025</strong>.</p>` },
    appraisal: { subject: 'Annual Performance Appraisal', body: `<p>Dear <strong>Rahul Sharma</strong>,</p>
<p style="margin-top:12px">We are pleased to inform you of your annual performance review outcome for the period <strong>FY 2024–25</strong>.</p>
<p style="margin-top:10px">Your overall performance rating is <strong>Exceeds Expectations (4.2 / 5.0)</strong>.</p>
<p style="margin-top:10px">Your revised salary with effect from <strong>01 April 2025</strong> will be <strong>₹9,00,000/- per annum</strong> (CTC), representing an increment of 18%.</p>` },
    experience: { subject: 'Experience Certificate', body: `<p>To Whomsoever It May Concern,</p>
<p style="margin-top:12px">This is to certify that <strong>Ms. Priya Nair</strong> was employed with us as a <strong>Marketing Executive</strong> from <strong>01 June 2022</strong> to <strong>31 March 2025</strong>.</p>
<p style="margin-top:10px">During her tenure, she demonstrated excellent communication skills and consistently delivered quality results. We wish her all the best in her future endeavours.</p>` },
    warning: { subject: 'Warning Letter — Misconduct', body: `<p>Dear <strong>Mr. Arun Joshi</strong>,</p>
<p style="margin-top:12px">This letter serves as an official written warning regarding repeated instances of tardiness and insubordination observed on <strong>08 April 2025</strong>.</p>
<p style="margin-top:10px">You are hereby advised to adhere to company policies immediately. Failure to do so may result in further disciplinary action, including termination of employment.</p>` },
    noc: { subject: 'No Objection Certificate', body: `<p>To Whomsoever It May Concern,</p>
<p style="margin-top:12px">This is to certify that <strong>Mr. Suresh Pillai</strong> (Employee ID: EMP-042), presently employed with us as a <strong>Systems Analyst</strong>, has obtained our permission to pursue <strong>part-time MBA studies</strong> at Osmania University, Hyderabad.</p>
<p style="margin-top:10px">We have no objection to the same, provided it does not interfere with his regular duties.</p>` },
    custom: { subject: 'HR Communication', body: `<p>Dear <strong>[Employee Name]</strong>,</p>
<p style="margin-top:12px">This is to inform you regarding [subject matter of the letter].</p>
<p style="margin-top:10px">Please acknowledge receipt of this letter by signing and returning the duplicate copy.</p>` },
  }
  const content = letterContent[s.letter_type] || letterContent.offer
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Georgia',serif;font-size:12px;color:#1f2937;background:#f9fafb}
.page{max-width:660px;margin:16px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
.header{border-top:6px solid ${c};padding:20px 28px;border-bottom:1px solid #e5e7eb}
.letterhead{display:flex;justify-content:space-between;align-items:flex-start}
.body{padding:24px 28px;line-height:1.7;font-size:12px;color:#374151}
.footer-bar{background:#f8fafc;border-top:1px solid #e5e7eb;padding:14px 28px;display:flex;justify-content:space-between}
.sig-box{text-align:center;min-width:160px}
.sig-line{border-top:1px solid #374151;margin-bottom:4px;margin-top:36px}
</style></head><body><div class="page">
<div class="header">
  <div class="letterhead">
    <div><div style="font-size:18px;font-weight:800;color:${c}">Your Company Name</div>
    <div style="font-size:10px;color:#6b7280;margin-top:2px">123, Business Park, Hyderabad 500001 · +91 40-12345678</div></div>
    <div style="text-align:right;font-size:11px;color:#6b7280">
      <div>Ref: HR/${new Date().getFullYear()}/042</div>
      <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
    </div>
  </div>
</div>
<div class="body">
  <div style="font-weight:700;font-size:13px;text-decoration:underline;margin-bottom:16px;color:#111">${content.subject}</div>
  ${content.body}
  <p style="margin-top:16px">Yours sincerely,</p>
  <div style="display:flex;justify-content:space-between;margin-top:20px">
    ${s.show_hr_signature ? `<div class="sig-box"><div class="sig-line"></div><div style="font-weight:700;font-size:11px">${s.signatory_name || 'HR Manager'}</div><div style="font-size:10px;color:#9ca3af">Human Resources</div></div>` : '<div></div>'}
    ${s.show_md_signature ? `<div class="sig-box"><div class="sig-line"></div><div style="font-weight:700;font-size:11px">Managing Director</div><div style="font-size:10px;color:#9ca3af">Authorised Signatory</div></div>` : '<div></div>'}
  </div>
  ${s.company_seal ? '<div style="width:80px;height:80px;border:2px dashed #d1d5db;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:12px;font-size:10px;color:#9ca3af;text-align:center">Company<br/>Seal</div>' : ''}
</div>
<div style="padding:10px 28px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;text-align:center">
  ${s.footer_note || 'This is a computer-generated document. Valid only with authorised signature and company seal.'}
</div>
</div></body></html>`
}

function generateHtml(id: DocTemplateId, settings: AnyDocSettings): string {
  switch (id) {
    case 'prescription':    return generatePrescriptionHtml(settings as PrescriptionSettings)
    case 'sop':             return generateSOPHtml(settings as SOPSettings)
    case 'work_order':      return generateWorkOrderHtml(settings as WorkOrderSettings)
    case 'delivery_challan':return generateDeliveryHtml(settings as DeliverySettings)
    case 'quotation':       return generateQuotationHtml(settings as QuotationSettings)
    case 'quality_report':  return generateQualityHtml(settings as QualitySettings)
    case 'meeting_minutes': return generateMeetingHtml(settings as MeetingSettings)
    case 'hr_letter':       return generateHRLetterHtml(settings as HRLetterSettings)
    default: return '<html><body>No template</body></html>'
  }
}

// ─── Template-specific Settings Panels ───────────────────────────────────────

function PrescriptionPanel({ s, set }: { s: PrescriptionSettings; set: <K extends keyof PrescriptionSettings>(k: K, v: PrescriptionSettings[K]) => void }) {
  return (<>
    <AccordionSection title="Clinic / Doctor Details" defaultOpen>
      {[
        { key: 'clinic_name',    label: 'Clinic / Hospital Name', placeholder: 'HealthCare Clinic' },
        { key: 'doctor_name',    label: 'Doctor Name',            placeholder: 'Dr. Priya Sharma' },
        { key: 'doctor_degree',  label: 'Degrees / Specialisation',placeholder: 'MBBS, MD – General Medicine' },
        { key: 'reg_number',     label: 'Reg. / License No.',     placeholder: 'MH-12345' },
        { key: 'clinic_address', label: 'Clinic Address',         placeholder: '12, Medical Complex, City' },
        { key: 'clinic_phone',   label: 'Contact Number',         placeholder: '+91 99999 00000' },
      ].map(f => (
        <div key={f.key}>
          <Label className="text-xs text-gray-500">{f.label}</Label>
          {f.key === 'clinic_phone' || f.key === 'phone' || f.key.endsWith('_phone') ? (
            <PhoneInput
              value={(s[f.key as keyof PrescriptionSettings] as string) || ''}
              onChange={v => set(f.key as keyof PrescriptionSettings, v as never)}
              defaultCountryIso="IN"
              compact
              compactCountry
              subtleFeedback
              autoComplete="tel"
              name={f.key}
              className="mt-0.5"
            />
          ) : (
            <Input className="mt-0.5 text-sm h-8" placeholder={f.placeholder}
              value={(s[f.key as keyof PrescriptionSettings] as string) || ''}
              onChange={e => set(f.key as keyof PrescriptionSettings, e.target.value as never)} />
          )}
        </div>
      ))}
    </AccordionSection>
    <AccordionSection title="Display Options" defaultOpen>
      <ToggleRow label="Show patient age & gender" checked={s.show_patient_age} onChange={v => set('show_patient_age', v)} />
      <ToggleRow label="Show patient address" checked={s.show_patient_address} onChange={v => set('show_patient_address', v)} />
      <ToggleRow label="Show vitals section (BP, Temp, Pulse, SpO2)" checked={s.show_vitals} onChange={v => set('show_vitals', v)} />
      <ToggleRow label="Show allergy warning bar" checked={s.show_allergy_warning} onChange={v => set('show_allergy_warning', v)} />
    </AccordionSection>
  </>)
}

function SOPPanel({ s, set }: { s: SOPSettings; set: <K extends keyof SOPSettings>(k: K, v: SOPSettings[K]) => void }) {
  return (<>
    <AccordionSection title="SOP Details" defaultOpen>
      <div>
        <Label className="text-xs text-gray-500">Department Label</Label>
        <Input className="mt-0.5 text-sm h-8" placeholder="e.g. Quality Assurance, Production"
          value={s.dept_label || ''} onChange={e => set('dept_label', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs text-gray-500">Step Numbering Style</Label>
        <div className="flex gap-2 mt-1">
          {(['numeric', 'alpha', 'roman'] as const).map(o => (
            <button key={o} onClick={() => set('step_numbering', o)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${s.step_numbering === o ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {o === 'numeric' ? '1, 2, 3' : o === 'alpha' ? 'a, b, c' : 'i, ii, iii'}
            </button>
          ))}
        </div>
      </div>
    </AccordionSection>
    <AccordionSection title="Sections to Show" defaultOpen>
      <ToggleRow label="Version number" checked={s.show_version} onChange={v => set('show_version', v)} />
      <ToggleRow label="Effective date" checked={s.show_effective_date} onChange={v => set('show_effective_date', v)} />
      <ToggleRow label="Next review date" checked={s.show_review_date} onChange={v => set('show_review_date', v)} />
      <ToggleRow label="References section" checked={s.show_references} onChange={v => set('show_references', v)} />
      <ToggleRow label="Approval & sign-off table" checked={s.show_approval_table} onChange={v => set('show_approval_table', v)} />
      <ToggleRow label="Revision history table" checked={s.show_revision_history} onChange={v => set('show_revision_history', v)} />
    </AccordionSection>
  </>)
}

function WorkOrderPanel({ s, set }: { s: WorkOrderSettings; set: <K extends keyof WorkOrderSettings>(k: K, v: WorkOrderSettings[K]) => void }) {
  return (
    <AccordionSection title="Work Order Sections" defaultOpen>
      <ToggleRow label="Customer details" checked={s.show_customer_details} onChange={v => set('show_customer_details', v)} />
      <ToggleRow label="Assigned technician" checked={s.show_assigned_tech} onChange={v => set('show_assigned_tech', v)} />
      <ToggleRow label="Materials / parts list" checked={s.show_materials_list} onChange={v => set('show_materials_list', v)} />
      <ToggleRow label="Labour hours estimate" checked={s.show_labor_hours} onChange={v => set('show_labor_hours', v)} />
      <ToggleRow label="Warranty note" checked={s.show_warranty_note} onChange={v => set('show_warranty_note', v)} />
      <ToggleRow label="Customer acceptance signature" checked={s.show_customer_signature} onChange={v => set('show_customer_signature', v)} />
    </AccordionSection>
  )
}

function DeliveryPanel({ s, set }: { s: DeliverySettings; set: <K extends keyof DeliverySettings>(k: K, v: DeliverySettings[K]) => void }) {
  return (
    <AccordionSection title="Delivery Challan Sections" defaultOpen>
      <ToggleRow label="Vehicle / transport number" checked={s.show_vehicle_number} onChange={v => set('show_vehicle_number', v)} />
      <ToggleRow label="Driver name" checked={s.show_driver_name} onChange={v => set('show_driver_name', v)} />
      <ToggleRow label="e-Way Bill number" checked={s.show_eway_bill} onChange={v => set('show_eway_bill', v)} />
      <ToggleRow label="Item weight column" checked={s.show_weight} onChange={v => set('show_weight', v)} />
      <ToggleRow label="Batch number column" checked={s.show_batch_number} onChange={v => set('show_batch_number', v)} />
      <ToggleRow label="Receiver signature block" checked={s.show_receiver_signature} onChange={v => set('show_receiver_signature', v)} />
    </AccordionSection>
  )
}

function QuotationPanel({ s, set }: { s: QuotationSettings; set: <K extends keyof QuotationSettings>(k: K, v: QuotationSettings[K]) => void }) {
  return (<>
    <AccordionSection title="Quotation Options" defaultOpen>
      <ToggleRow label="Show validity period" checked={s.show_validity} onChange={v => set('show_validity', v)} />
      {s.show_validity && (
        <div>
          <Label className="text-xs text-gray-500">Valid for (days)</Label>
          <Input type="number" min={1} max={365} className="mt-0.5 text-sm h-8 w-24" value={s.validity_days || 15}
            onChange={e => set('validity_days', Number(e.target.value))} />
        </div>
      )}
      <ToggleRow label="Show discount column" checked={s.show_discount} onChange={v => set('show_discount', v)} />
      <ToggleRow label="Show tax (GST)" checked={s.show_tax} onChange={v => set('show_tax', v)} />
      <ToggleRow label="Show bank details" checked={s.show_bank_details} onChange={v => set('show_bank_details', v)} />
    </AccordionSection>
    <AccordionSection title="Terms & Conditions">
      <ToggleRow label="Show terms & conditions" checked={s.show_terms} onChange={v => set('show_terms', v)} />
      {s.show_terms && (
        <div>
          <Label className="text-xs text-gray-500">Default Terms</Label>
          <textarea className="w-full mt-0.5 text-sm border rounded-lg px-3 py-2 min-h-[72px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Quote is valid for 15 days. GST extra as applicable."
            value={s.default_terms || ''} onChange={e => set('default_terms', e.target.value)} />
        </div>
      )}
    </AccordionSection>
  </>)
}

function QualityPanel({ s, set }: { s: QualitySettings; set: <K extends keyof QualitySettings>(k: K, v: QualitySettings[K]) => void }) {
  return (
    <AccordionSection title="QC Report Sections" defaultOpen>
      <ToggleRow label="Batch / product information" checked={s.show_batch_info} onChange={v => set('show_batch_info', v)} />
      <ToggleRow label="Inspector details" checked={s.show_inspector} onChange={v => set('show_inspector', v)} />
      <ToggleRow label="Test parameters table" checked={s.show_test_parameters} onChange={v => set('show_test_parameters', v)} />
      <ToggleRow label="Pass / Fail result column" checked={s.show_pass_fail} onChange={v => set('show_pass_fail', v)} />
      <ToggleRow label="Remarks column" checked={s.show_remarks} onChange={v => set('show_remarks', v)} />
      <ToggleRow label="Approval sign-off" checked={s.show_approval} onChange={v => set('show_approval', v)} />
    </AccordionSection>
  )
}

function MeetingPanel({ s, set }: { s: MeetingSettings; set: <K extends keyof MeetingSettings>(k: K, v: MeetingSettings[K]) => void }) {
  return (
    <AccordionSection title="Meeting Minutes Sections" defaultOpen>
      <ToggleRow label="Attendees list" checked={s.show_attendees} onChange={v => set('show_attendees', v)} />
      <ToggleRow label="Agenda items" checked={s.show_agenda} onChange={v => set('show_agenda', v)} />
      <ToggleRow label="Key decisions" checked={s.show_decisions} onChange={v => set('show_decisions', v)} />
      <ToggleRow label="Action items with owner & due date" checked={s.show_action_items} onChange={v => set('show_action_items', v)} />
      <ToggleRow label="Next meeting info" checked={s.show_next_meeting} onChange={v => set('show_next_meeting', v)} />
    </AccordionSection>
  )
}

function HRLetterPanel({ s, set }: { s: HRLetterSettings; set: <K extends keyof HRLetterSettings>(k: K, v: HRLetterSettings[K]) => void }) {
  const letterTypes = [
    { id: 'offer', label: 'Offer Letter' }, { id: 'appraisal', label: 'Appraisal' },
    { id: 'experience', label: 'Experience Cert.' }, { id: 'warning', label: 'Warning Letter' },
    { id: 'noc', label: 'NOC Letter' }, { id: 'custom', label: 'Custom' },
  ]
  return (<>
    <AccordionSection title="Letter Type" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        {letterTypes.map(t => (
          <button key={t.id} onClick={() => set('letter_type', t.id as HRLetterSettings['letter_type'])}
            className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${s.letter_type === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>
    </AccordionSection>
    <AccordionSection title="Signature Options" defaultOpen>
      <ToggleRow label="HR Manager signature" checked={s.show_hr_signature} onChange={v => set('show_hr_signature', v)} />
      <ToggleRow label="Managing Director signature" checked={s.show_md_signature} onChange={v => set('show_md_signature', v)} />
      <ToggleRow label="Company seal placeholder" checked={s.company_seal} onChange={v => set('company_seal', v)} />
    </AccordionSection>
  </>)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentTemplatesPage() {
  const navigate = useNavigate()
  const [activeType, setActiveType] = useState<DocTemplateId | null>(null)
  const [settingsTab, setSettingsTab] = useState<'design' | 'branding' | 'content'>('design')
  const [allSettings, setAllSettings] = useState<Record<string, AnyDocSettings>>(loadSettings)
  const [previewHtml, setPreviewHtml] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0)

  const activeTemplateType = TEMPLATE_TYPES.find(t => t.id === activeType)

  const currentSettings = useCallback((): AnyDocSettings => {
    if (!activeType) return {} as AnyDocSettings
    return allSettings[activeType] || { ...DEFAULTS[activeType] }
  }, [activeType, allSettings])

  const set = useCallback(<K extends keyof AnyDocSettings>(key: K, value: AnyDocSettings[K]) => {
    if (!activeType) return
    setAllSettings(prev => ({
      ...prev,
      [activeType]: { ...(prev[activeType] || DEFAULTS[activeType]), [key]: value },
    }))
  }, [activeType])

  // Rebuild preview whenever active type or settings change
  useEffect(() => {
    if (!activeType) return
    const s = currentSettings()
    setPreviewHtml(generateHtml(activeType, s))
  }, [activeType, allSettings, currentSettings])

  useLayoutEffect(() => {
    const el = previewRef.current
    if (!el) return
    const recalc = () => {
      const { width } = el.getBoundingClientRect()
      if (width > 0) setPreviewScale(width / 720)
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeType])

  const handleSave = () => {
    if (!activeType) return
    saveSettings(activeType, currentSettings())
    toast.success(`${activeTemplateType?.label} template saved!`)
  }

  const handleReset = () => {
    if (!activeType) return
    setAllSettings(prev => ({ ...prev, [activeType]: { ...DEFAULTS[activeType] } }))
    toast('Template reset to defaults')
  }

  const applyDocLogoFile = useCallback(async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => resolve(String(ev.target?.result ?? ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    set('logo_url', dataUrl as never)
  }, [set])

  const s = activeType ? currentSettings() : null

  // ── Gallery view (no template selected) ──────────────────────────────────
  if (!activeType) {
    const categories = [...new Set([
      ...LINKED_TEMPLATE_TYPES.map(t => t.category),
      ...TEMPLATE_TYPES.map(t => t.category),
    ])]
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FileText className="h-6 w-6 text-primary" /> Document Templates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure and preview printable templates for your business documents — including invoices, quotations,
            purchase orders, prescriptions, SOPs, and more.
          </p>
        </div>

        {categories.map(cat => (
          <div key={cat}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{cat}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {LINKED_TEMPLATE_TYPES.filter(t => t.category === cat).map(tmpl => {
                const Icon = tmpl.icon
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => navigate(tmpl.href)}
                    className="group relative rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md dark:hover:shadow-none dark:hover:ring-1 dark:hover:ring-primary/25"
                  >
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tmpl.bg}`}>
                      <Icon className={`h-5 w-5 ${tmpl.color}`} />
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-foreground">{tmpl.label}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{tmpl.desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary transition-all group-hover:gap-2">
                      <Eye className="h-3.5 w-3.5" /> Configure & Preview
                    </div>
                  </button>
                )
              })}
              {TEMPLATE_TYPES.filter(t => t.category === cat).map(tmpl => {
                const Icon = tmpl.icon
                const saved = !!allSettings[tmpl.id]
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => { setActiveType(tmpl.id); setSettingsTab('design') }}
                    className="group relative max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md dark:hover:shadow-none dark:hover:ring-1 dark:hover:ring-primary/25"
                  >
                    {saved && (
                      <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-xs font-bold text-green-700 dark:text-green-300">
                        <Check className="h-2.5 w-2.5" /> Saved
                      </span>
                    )}
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tmpl.bg}`}>
                      <Icon className={`h-5 w-5 ${tmpl.color}`} />
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-foreground">{tmpl.label}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{tmpl.desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary transition-all group-hover:gap-2">
                      <Eye className="h-3.5 w-3.5" /> Configure & Preview
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Configurator view ─────────────────────────────────────────────────────
  const Icon = activeTemplateType!.icon
  return (
    <div className="space-y-0">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveType(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeTemplateType!.bg}`}>
            <Icon className={`h-4.5 w-4.5 ${activeTemplateType!.color}`} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{activeTemplateType!.label} Template</h1>
            <p className="text-xs text-muted-foreground">{activeTemplateType!.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-1.5 text-sm text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button onClick={handleSave} className="gap-2 text-sm">
            <Check className="h-4 w-4" /> Save Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left: Preview */}
        <div className="sticky top-4 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Eye className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Live Preview</span>
            <span className="text-xs text-gray-400">(sample data)</span>
          </div>
          <div ref={previewRef} className="flex-1 border rounded-xl overflow-y-auto bg-gray-50 shadow-inner">
            {previewScale > 0 && (
              <div style={{
                width: `${720 / previewScale}px`,
                height: `${1020 / previewScale}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}>
                <iframe srcDoc={previewHtml} title="Doc Preview" className="border-0 bg-white"
                  style={{ width: '720px', height: '1020px', pointerEvents: 'none', display: 'block' }}
                  scrolling="no" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Settings */}
        <div className="space-y-4 pb-8">

          {/* Tab bar */}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {([
              { id: 'design',   label: 'Design',   icon: Palette },
              { id: 'branding', label: 'Branding',  icon: Building2 },
              { id: 'content',  label: 'Content',   icon: ToggleLeft },
            ] as { id: typeof settingsTab; label: string; icon: React.ElementType }[]).map(t => {
              const TIcon = t.icon
              return (
                <button key={t.id} onClick={() => setSettingsTab(t.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all border-b-2 ${settingsTab === t.id ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                  <TIcon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* ── Design tab: color + paper size ── */}
          {settingsTab === 'design' && <>
            <AccordionSection title="Theme Colour" defaultOpen>
              <div className="flex flex-wrap gap-2 mb-2">
                {COLORS.map(c => (
                  <button key={c.value} title={c.label} onClick={() => set('theme_color', c.value as never)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${(s as BaseDocSettings)?.theme_color === c.value ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c.value }}>
                    {(s as BaseDocSettings)?.theme_color === c.value && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500 shrink-0">Custom</Label>
                <input type="color" value={(s as BaseDocSettings)?.theme_color || '#1a56db'}
                  onChange={e => set('theme_color', e.target.value as never)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
                <Input value={(s as BaseDocSettings)?.theme_color || '#1a56db'}
                  onChange={e => set('theme_color', e.target.value as never)}
                  className="flex-1 text-xs font-mono h-8" maxLength={7} />
              </div>
            </AccordionSection>

            <AccordionSection title="Paper Size">
              <div className="flex gap-2">
                {(['A4', 'Letter', 'A5'] as const).map(p => (
                  <button key={p} onClick={() => set('paper_size', p as never)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${(s as BaseDocSettings)?.paper_size === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </AccordionSection>

            <AccordionSection title="Watermark">
              <ToggleRow label="Show watermark on document" checked={(s as BaseDocSettings)?.show_watermark || false} onChange={v => set('show_watermark', v as never)} />
              {(s as BaseDocSettings)?.show_watermark && (
                <div>
                  <Label className="text-xs text-gray-500">Watermark Text</Label>
                  <Input className="mt-0.5 text-sm h-8" placeholder="e.g. DRAFT, CONFIDENTIAL"
                    value={(s as BaseDocSettings)?.watermark_text || ''}
                    onChange={e => set('watermark_text', e.target.value as never)} />
                </div>
              )}
            </AccordionSection>
          </>}

          {/* ── Branding tab: logo + signature ── */}
          {settingsTab === 'branding' && <>
            <AccordionSection title="Logo" defaultOpen>
              <ToggleRow label="Show logo" checked={(s as BaseDocSettings)?.show_logo} onChange={v => set('show_logo', v as never)} />
              <div className="mt-2">
                <ImageSourcePicker
                  title="Logo"
                  onFile={applyDocLogoFile}
                  onUrl={(url) => set('logo_url', url as never)}
                  buttonLabel="Upload logo (PNG/SVG)"
                  buttonVariant="outline"
                  buttonSize="sm"
                  buttonClassName="gap-1.5"
                />
                {(s as BaseDocSettings)?.logo_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <SingleImagePreview
                      url={(s as BaseDocSettings).logo_url!}
                      alt="Logo"
                      className="rounded"
                      imgClassName="h-10 max-w-[100px] object-contain border rounded"
                      editable
                      onSave={applyDocLogoFile}
                    >
                      <button onClick={() => set('logo_url', undefined as never)} className="absolute -top-1 -right-1 z-10 p-1 hover:bg-red-50 rounded bg-white shadow-sm">
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </SingleImagePreview>
                  </div>
                )}
              </div>
            </AccordionSection>

            <AccordionSection title="Signature & Authority" defaultOpen>
              <ToggleRow label="Show authorised signature block" checked={(s as BaseDocSettings)?.show_signature} onChange={v => set('show_signature', v as never)} />
              {(s as BaseDocSettings)?.show_signature && (
                <div>
                  <Label className="text-xs text-gray-500">Signatory Name / Title</Label>
                  <Input className="mt-0.5 text-sm h-8" placeholder="e.g. Operations Manager"
                    value={(s as BaseDocSettings)?.signatory_name || ''}
                    onChange={e => set('signatory_name', e.target.value as never)} />
                </div>
              )}
            </AccordionSection>

            <AccordionSection title="Header & Footer Notes">
              <div>
                <Label className="text-xs text-gray-500">Header Note (optional)</Label>
                <Input className="mt-0.5 text-sm h-8" placeholder="e.g. CONFIDENTIAL"
                  value={(s as BaseDocSettings)?.header_note || ''}
                  onChange={e => set('header_note', e.target.value as never)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Footer Note</Label>
                <Input className="mt-0.5 text-sm h-8" placeholder="e.g. Computer generated document — valid without signature"
                  value={(s as BaseDocSettings)?.footer_note || ''}
                  onChange={e => set('footer_note', e.target.value as never)} />
              </div>
            </AccordionSection>
          </>}

          {/* ── Content tab: template-specific ── */}
          {settingsTab === 'content' && s && (() => {
            switch (activeType) {
              case 'prescription':     return <PrescriptionPanel s={s as PrescriptionSettings} set={set as any} />
              case 'sop':              return <SOPPanel s={s as SOPSettings} set={set as any} />
              case 'work_order':       return <WorkOrderPanel s={s as WorkOrderSettings} set={set as any} />
              case 'delivery_challan': return <DeliveryPanel s={s as DeliverySettings} set={set as any} />
              case 'quotation':        return <QuotationPanel s={s as QuotationSettings} set={set as any} />
              case 'quality_report':   return <QualityPanel s={s as QualitySettings} set={set as any} />
              case 'meeting_minutes':  return <MeetingPanel s={s as MeetingSettings} set={set as any} />
              case 'hr_letter':        return <HRLetterPanel s={s as HRLetterSettings} set={set as any} />
              default: return null
            }
          })()}
        </div>
      </div>
    </div>
  )
}
