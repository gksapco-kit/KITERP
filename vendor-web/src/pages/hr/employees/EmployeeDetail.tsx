import { useState, useRef, useEffect, useMemo } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, User, Briefcase, FileText, Calendar, Plane, DollarSign, Receipt,
  Plus, Trash2, CheckCircle, Upload, LogOut, Heart, Image, List,
  File as FileIcon, X, Settings, Clock, Circle, AlertTriangle, Copy, Check, ChevronDown,
  KeyRound, Loader2, Pencil, Save,
} from 'lucide-react'
import type { FamilyMember } from '@/types'
import {
  useHREmployee, useUpdateHREmployee, useHRDepartments, useHRDesignations,
  useHRLeaveBalances, useHRSalaryStructures, useHRMyPayslips,
  useCreateHRSalaryStructure, useSubmitLeaveRequest, useHRLeavePolicies,
  useHREmployees, useSetHREmployeePortalPassword,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { useAuthStore } from '@/stores/authStore'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { toast } from 'sonner'
import { EmployeeTabBar } from './EmployeeTabBar'
import { resolveEmployeeTab, type EmployeeTabId } from './employeeMasterTabs'
import { IdentityTab } from './EmployeeMasterTabPanels'
import {
  AddressesTab,
  BankTab,
  KycTab,
  EmployeePersonalTab,
  FamilyTab,
  NotesTab,
  EmployeeCredentialsTab,
  ShareDropdown,
} from './employeeTabPanelsExtended'
import { employeeDisplayName, sanitizeEmployeeUpdatePayload } from '@/lib/hrEmployeeDisplay'
import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { useVendorStore } from '@/stores/vendorStore'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/ImageAttachmentLightbox'

const CLEARANCE_ITEMS = [
  { key: 'it', label: 'IT / Assets' },
  { key: 'finance', label: 'Finance / F&F' },
  { key: 'admin', label: 'Admin / Facilities' },
  { key: 'hr', label: 'HR / Documents' },
]

function PersonalTab({ emp, onSave }: { emp: any; onSave: (data: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    employee_code_custom: emp.employee_code_custom ?? '',
    date_of_birth: emp.date_of_birth ?? '',
    gender: emp.gender ?? '',
    blood_group: emp.blood_group ?? '',
    marital_status: emp.marital_status ?? '',
    nationality: emp.nationality ?? 'Indian',
    personal_email: emp.personal_email ?? '',
    personal_phone: emp.personal_phone ?? '',
    emergency_contact_name: emp.emergency_contact_name ?? '',
    emergency_contact_phone: emp.emergency_contact_phone ?? '',
    emergency_contact_relation: emp.emergency_contact_relation ?? '',
    pan_number: emp.pan_number ?? '',
    aadhaar_number: emp.aadhaar_number ?? '',
    uan_number: emp.uan_number ?? '',
    esi_number: emp.esi_number ?? '',
    bank_name: emp.bank_name ?? '',
    account_holder_name: emp.account_holder_name ?? '',
    account_number: emp.account_number ?? '',
    account_type: emp.account_type ?? 'savings',
    ifsc_code: emp.ifsc_code ?? '',
  })

  function Field({ label, value, field, type = 'text', options }: { label: string; value: string; field: string; type?: string; options?: string[] }) {
    const isPhone = field === 'phone' || field.endsWith('_phone')
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        {editing ? (
          options ? (
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}>
              <option value="">—</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : isPhone ? (
            <PhoneInput
              value={(form as any)[field] || ''}
              onChange={(v) => setForm(f => ({ ...f, [field]: v }))}
              defaultCountryIso="IN"
            />
          ) : (
            <input type={type} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
          )
        ) : (
          <p className="text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Personal Information</h3>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button onClick={() => { onSave(form); setEditing(false) }} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Save</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Edit</button>
        )}
      </div>

      {/* Identity */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Field label="Employee Code / Username" value={emp.employee_code_custom ?? emp.employee_code ?? ''} field="employee_code_custom" />
        <Field label="Date of Birth" value={emp.date_of_birth ?? ''} field="date_of_birth" type="date" />
        <Field label="Gender" value={emp.gender ?? ''} field="gender" options={['male', 'female', 'other', 'prefer_not_to_say']} />
        <Field label="Blood Group" value={emp.blood_group ?? ''} field="blood_group" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
        <Field label="Marital Status" value={emp.marital_status ?? ''} field="marital_status" options={['single', 'married', 'divorced', 'widowed']} />
        <Field label="Nationality" value={emp.nationality ?? ''} field="nationality" />
        <Field label="Personal Email" value={emp.personal_email ?? ''} field="personal_email" type="email" />
        <Field label="Personal Phone" value={emp.personal_phone ?? ''} field="personal_phone" />
        <Field label="Emergency Contact" value={emp.emergency_contact_name ?? ''} field="emergency_contact_name" />
        <Field label="Emergency Phone" value={emp.emergency_contact_phone ?? ''} field="emergency_contact_phone" />
        <Field label="Emergency Relation" value={emp.emergency_contact_relation ?? ''} field="emergency_contact_relation" />
      </div>

      {/* Bank & Compliance */}
      <div className="pt-4 border-t">
        <h4 className="font-medium text-gray-700 mb-3">Bank Details</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Bank Name" value={emp.bank_name ?? ''} field="bank_name" />
          <Field label="Account Type" value={emp.account_type ?? ''} field="account_type" options={['savings', 'current']} />
          <Field label="Account Holder Name" value={emp.account_holder_name ?? ''} field="account_holder_name" />
          <Field label="Account Number" value={emp.account_number ?? ''} field="account_number" />
          <Field label="IFSC Code" value={emp.ifsc_code ?? ''} field="ifsc_code" />
        </div>
      </div>

      {/* KYC */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="font-medium text-gray-700 mb-3">KYC & Legal Compliance</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="PAN Number" value={emp.pan_number ?? ''} field="pan_number" />
          <Field label="Aadhaar Number" value={emp.aadhaar_number ?? ''} field="aadhaar_number" />
          <Field label="UAN (PF)" value={emp.uan_number ?? ''} field="uan_number" />
          <Field label="ESI Number" value={emp.esi_number ?? ''} field="esi_number" />
        </div>
      </div>

      {/* Family Members — always visible, editing mode enables add/remove */}
      <FamilyMembersSection emp={emp} editing={editing} onSave={onSave} />
    </div>
  )
}

function FamilyMembersSection({ emp, editing, onSave }: { emp: any; editing: boolean; onSave: (data: Record<string, unknown>) => void }) {
  const [members, setMembers] = useState<FamilyMember[]>(emp.family_members ?? [])
  const [dirty, setDirty] = useState(false)

  function addMember() {
    setMembers(prev => [...prev, { name: '', relation: '', dob: '', phone: '', gender: '', blood_group: '' }])
    setDirty(true)
  }
  function updateMember(i: number, m: FamilyMember) {
    setMembers(prev => prev.map((f, idx) => idx === i ? m : f))
    setDirty(true)
  }
  function removeMember(i: number) {
    setMembers(prev => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }
  function saveMembers() {
    onSave({ family_members: members })
    setDirty(false)
  }

  return (
    <div className="mt-6 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-700 flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-red-400" /> Family Members
        </h4>
        {dirty && (
          <button onClick={saveMembers} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
            Save Members
          </button>
        )}
      </div>
      <div className="space-y-3">
        {members.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">No family members recorded.</p>
        )}
        {members.map((m, i) => (
          <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">Member {i + 1}</span>
              {editing && (
                <button type="button" onClick={() => removeMember(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { label: 'Name', field: 'name' as keyof FamilyMember, placeholder: 'Full name' },
                { label: 'Relation', field: 'relation' as keyof FamilyMember, placeholder: 'e.g. Spouse' },
                { label: 'Phone', field: 'phone' as keyof FamilyMember, placeholder: 'Mobile' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  {editing ? (
                    <input
                      className="w-full border rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      value={m[field] ?? ''}
                      placeholder={placeholder}
                      onChange={e => updateMember(i, { ...m, [field]: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{m[field] || <span className="text-gray-400">—</span>}</p>
                  )}
                </div>
              ))}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Date of Birth</p>
                {editing ? (
                  <input
                    type="date"
                    className="w-full border rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={m.dob ?? ''}
                    onChange={e => updateMember(i, { ...m, dob: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-gray-900">{m.dob || <span className="text-gray-400">—</span>}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Gender</p>
                {editing ? (
                  <select
                    className="w-full border rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={m.gender ?? ''}
                    onChange={e => updateMember(i, { ...m, gender: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{m.gender || <span className="text-gray-400">—</span>}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Blood Group</p>
                {editing ? (
                  <select
                    className="w-full border rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={m.blood_group ?? ''}
                    onChange={e => updateMember(i, { ...m, blood_group: e.target.value })}
                  >
                    <option value="">—</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{m.blood_group || <span className="text-gray-400">—</span>}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {editing && (
          <button
            type="button"
            onClick={addMember}
            className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Family Member
          </button>
        )}
      </div>
    </div>
  )
}

function EmploymentTab({ emp, departments, designations, onSave }: { emp: any; departments: any[]; designations: any[]; onSave: (data: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    department_id: emp.department_id ?? '',
    designation_id: emp.designation_id ?? '',
    employment_type: emp.employment_type ?? 'full_time',
    date_of_joining: emp.date_of_joining ?? '',
    probation_end_date: emp.probation_end_date ?? '',
    notice_period_days: emp.notice_period_days ?? 30,
    status: emp.status ?? 'active',
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Employment Details</h3>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button onClick={() => { onSave(form); setEditing(false) }} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Save</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Edit</button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Employee Code', value: emp.employee_code, readOnly: true },
          { label: 'Status', value: emp.status?.replace('_', ' ') },
        ].map(f => (
          <div key={f.label}>
            <p className="text-xs font-medium text-gray-500 mb-1">{f.label}</p>
            {editing && !f.readOnly && f.label === 'Status' ? (
              <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="on_notice">On Notice</option>
                <option value="exited">Exited</option>
              </select>
            ) : (
              <p className="text-sm font-semibold text-gray-900">{f.value || '—'}</p>
            )}
          </div>
        ))}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Department</p>
          {editing ? (
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">— None —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : <p className="text-sm text-gray-900">{emp.department?.name ?? '—'}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Designation</p>
          {editing ? (
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.designation_id} onChange={e => setForm(f => ({ ...f, designation_id: e.target.value }))}>
              <option value="">— None —</option>
              {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : <p className="text-sm text-gray-900">{emp.designation?.name ?? '—'}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Employment Type</p>
          {editing ? (
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          ) : <p className="text-sm text-gray-900">{emp.employment_type?.replace('_', '-') ?? '—'}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Date of Joining</p>
          {editing ? <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
            : <p className="text-sm text-gray-900">{emp.date_of_joining ?? '—'}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Probation End</p>
          {editing ? <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.probation_end_date} onChange={e => setForm(f => ({ ...f, probation_end_date: e.target.value }))} />
            : <p className="text-sm text-gray-900">{emp.probation_end_date ?? '—'}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Notice Period (days)</p>
          {editing ? <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.notice_period_days} onChange={e => setForm(f => ({ ...f, notice_period_days: parseInt(e.target.value) || 30 }))} />
            : <p className="text-sm text-gray-900">{emp.notice_period_days ?? 30} days</p>}
        </div>
      </div>
    </div>
  )
}

// ── Configurable document types (localStorage) ──────────────────
const DEFAULT_DOC_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'experience', label: 'Experience Certificate' },
  { value: 'education', label: 'Education Certificate' },
  { value: 'salary_slip', label: 'Salary Slip' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
]

function getCustomDocTypes(): { value: string; label: string }[] {
  try { return JSON.parse(localStorage.getItem('hr_doc_types') ?? '[]') } catch { return [] }
}
function saveCustomDocType(label: string) {
  const value = label.toLowerCase().replace(/\s+/g, '_')
  const existing = getCustomDocTypes()
  if (!existing.some(t => t.value === value)) {
    localStorage.setItem('hr_doc_types', JSON.stringify([...existing, { value, label }]))
  }
  return value
}
function getAllDocTypes() {
  return [...DEFAULT_DOC_TYPES, ...getCustomDocTypes()]
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url)
}

function DocTypeIcon({ url }: { url?: string }) {
  if (!url) return <FileIcon className="w-8 h-8 text-gray-300" />
  if (isImageUrl(url)) return <Image className="w-8 h-8 text-blue-400" />
  return <FileIcon className="w-8 h-8 text-orange-400" />
}

function DocumentsTab({ empId }: { empId: string }) {
  const [docs, setDocs] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list')
  const [showAdd, setShowAdd] = useState(false)
  const [showTypeManager, setShowTypeManager] = useState(false)
  const [docTypes, setDocTypes] = useState(getAllDocTypes)
  const [newTypeName, setNewTypeName] = useState('')

  // Upload form state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    document_type: 'aadhaar',
    document_name: 'Aadhaar Card',
    file_url: '',
    expiry_date: '',
    notes: '',
  })

  async function loadDocs() {
    if (!loaded) {
      const d = await vendorApi.hrListDocuments(empId)
      setDocs(d)
      setLoaded(true)
    }
  }
  if (!loaded) { loadDocs() }

  function handleTypeChange(value: string) {
    const label = docTypes.find(t => t.value === value)?.label ?? value
    setForm(f => ({ ...f, document_type: value, document_name: label }))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    // Auto-fill name from file if empty
    if (!form.document_name || form.document_name === docTypes.find(t => t.value === form.document_type)?.label) {
      setForm(f => ({ ...f, document_name: file.name.replace(/\.[^.]+$/, '') }))
    }
  }

  async function addDoc(e: React.FormEvent) {
    e.preventDefault()
    setUploading(true)
    try {
      let fileUrl = form.file_url
      let contentType = ''
      if (selectedFile) {
        const uploaded = await vendorApi.hrUploadDocumentFile(empId, selectedFile)
        fileUrl = uploaded.file_url
        contentType = uploaded.content_type
      }
      const doc = await vendorApi.hrAddDocument(empId, {
        document_type: form.document_type,
        document_name: form.document_name,
        file_url: fileUrl || undefined,
        expiry_date: form.expiry_date || undefined,
        notes: form.notes || undefined,
      })
      setDocs(d => [...d, { ...doc, _content_type: contentType }])
      setShowAdd(false)
      setSelectedFile(null)
      setPreview(null)
      setForm({ document_type: 'aadhaar', document_name: 'Aadhaar Card', file_url: '', expiry_date: '', notes: '' })
    } finally {
      setUploading(false)
    }
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Delete this document?')) return
    await vendorApi.hrDeleteDocument(empId, docId)
    setDocs(d => d.filter(x => x.id !== docId))
  }

  function addCustomType() {
    const label = newTypeName.trim()
    if (!label) return
    const value = saveCustomDocType(label)
    const updated = getAllDocTypes()
    setDocTypes(updated)
    setNewTypeName('')
  }

  function removeCustomType(value: string) {
    const existing = getCustomDocTypes().filter(t => t.value !== value)
    localStorage.setItem('hr_doc_types', JSON.stringify(existing))
    setDocTypes(getAllDocTypes())
  }

  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)/i
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState<number | null>(null)
  const galleryImageDocs = useMemo(
    () => docs.filter((doc) => doc.file_url && imageExtensions.test(doc.file_url)),
    [docs],
  )
  const galleryLightboxItems = useMemo(
    () => urlsToLightboxItems(
      galleryImageDocs.map((doc) => doc.file_url as string),
      {
        idPrefix: 'emp-doc',
        altText: (i) => galleryImageDocs[i]?.document_name ?? `Document ${i + 1}`,
      },
    ),
    [galleryImageDocs],
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Documents & Gallery</h3>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'gallery' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Gallery view"
            >
              <Image className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShowTypeManager(v => !v)}
            title="Manage document types"
            className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
      </div>

      {/* Document Type Manager */}
      {showTypeManager && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /> Manage Document Types
          </h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {DEFAULT_DOC_TYPES.map(t => (
              <span key={t.value} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{t.label}</span>
            ))}
            {getCustomDocTypes().map(t => (
              <span key={t.value} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {t.label}
                <button onClick={() => removeCustomType(t.value)} className="hover:text-red-500 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="New document type name (e.g. NOC, Nomination Form)"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomType() } }}
            />
            <button onClick={addCustomType} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
              + Add Type
            </button>
          </div>
        </div>
      )}

      {/* Upload / Add Form */}
      {showAdd && (
        <form onSubmit={addDoc} className="mb-5 p-4 bg-gray-50 rounded-xl border space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Upload Document</h4>

          {/* File drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            {preview ? (
              <div className="flex flex-col items-center gap-2">
                <img src={preview} className="max-h-32 rounded-lg object-contain" alt="preview" />
                <p className="text-xs text-gray-500">{selectedFile?.name}</p>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <FileIcon className="w-10 h-10 text-orange-400" />
                <p className="text-sm text-gray-700 font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3 text-gray-400">
                <Upload className="w-8 h-8" />
                <p className="text-sm">Click to select file or drag & drop</p>
                <p className="text-xs">Images, PDF, Word — max 10 MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="sr-only"
              onChange={handleFileSelect}
            />
          </div>
          {selectedFile && (
            <button type="button" onClick={() => { setSelectedFile(null); setPreview(null) }} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <X className="w-3 h-3" /> Remove file
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Document Type</Label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={form.document_type}
                onChange={e => handleTypeChange(e.target.value)}
              >
                {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1" required>Document Name</Label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                required
                value={form.document_name}
                onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</Label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={form.expiry_date}
                onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Notes</Label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                placeholder="Optional notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAdd(false); setSelectedFile(null); setPreview(null) }} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={uploading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {uploading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {uploading ? 'Uploading…' : 'Save Document'}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {docs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No documents uploaded yet.</p>
          <button onClick={() => setShowAdd(true)} className="mt-2 text-sm text-blue-500 hover:underline">Upload first document →</button>
        </div>
      )}

      {/* Gallery View */}
      {viewMode === 'gallery' && docs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {docs.map(doc => {
            const isImg = doc.file_url && imageExtensions.test(doc.file_url)
            return (
              <div key={doc.id} className="group relative border rounded-xl overflow-hidden bg-gray-50 hover:shadow-md transition-shadow">
                {isImg ? (
                  <ClickableImageButton
                    src={doc.file_url}
                    alt={doc.document_name}
                    title="View image"
                    className="w-full"
                    imgClassName="w-full h-32 object-cover"
                    onClick={() => {
                      const imgIdx = galleryImageDocs.findIndex((d) => d.id === doc.id)
                      if (imgIdx >= 0) setGalleryLightboxIndex(imgIdx)
                    }}
                  />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                    <FileIcon className="w-10 h-10 text-gray-300" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-900 truncate">{doc.document_name}</p>
                  <p className="text-xs text-gray-400 truncate">{doc.document_type?.replace(/_/g, ' ')}</p>
                  {doc.expiry_date && (
                    <p className="text-xs text-orange-500 mt-0.5">Exp: {doc.expiry_date}</p>
                  )}
                </div>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.verified_at && <span className="p-1 bg-green-500 rounded-full"><CheckCircle className="w-3 h-3 text-white" /></span>}
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-1 bg-white rounded-full shadow text-blue-600 hover:bg-blue-50">
                      <Upload className="w-3 h-3" />
                    </a>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id) }} className="p-1 bg-white rounded-full shadow text-red-400 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ImageLightboxSession
        items={galleryLightboxItems}
        openIndex={galleryLightboxIndex}
        onClose={() => setGalleryLightboxIndex(null)}
      />

      {/* List View */}
      {viewMode === 'list' && docs.length > 0 && (
        <div className="space-y-2">
          {docs.map(doc => {
            const isImg = doc.file_url && imageExtensions.test(doc.file_url)
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-white transition-colors">
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                  {isImg ? (
                    <img src={doc.file_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.document_name}</p>
                  <p className="text-xs text-gray-500">
                    {docTypes.find(t => t.value === doc.document_type)?.label ?? doc.document_type?.replace(/_/g, ' ')}
                    {doc.expiry_date && <span className="text-orange-500 ml-2">· Exp {doc.expiry_date}</span>}
                    {doc.notes && <span className="ml-2 text-gray-400">· {doc.notes}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.verified_at && <CheckCircle className="w-4 h-4 text-green-500" aria-label="Verified" />}
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                  )}
                  <button onClick={() => deleteDoc(doc.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LeavesTab({ empId }: { empId: string }) {
  const { data: balances = [] } = useHRLeaveBalances(empId)
  const { data: policies = [] } = useHRLeavePolicies()
  const submit = useSubmitLeaveRequest()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leave_policy_id: '', from_date: '', to_date: '', days: 1, reason: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit.mutateAsync({ ...form, days: Number(form.days) })
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Leave Balances</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
          <Plus className="w-3.5 h-3.5" /> Apply Leave
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {balances.map((b: any) => (
          <div key={b.id} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-700">{b.leave_policy?.name ?? b.leave_policy_id}</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{b.available?.toFixed(1)}</p>
            <p className="text-xs text-blue-600">of {b.allocated} days available</p>
          </div>
        ))}
        {balances.length === 0 && <p className="text-sm text-gray-400 col-span-3">No leave balances configured.</p>}
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border p-4 space-y-3">
          <h4 className="font-medium text-sm">New Leave Request</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</Label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" required value={form.leave_policy_id} onChange={e => setForm(f => ({ ...f, leave_policy_id: e.target.value }))}>
                <option value="">— Select —</option>
                {policies.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Days</Label>
              <input type="number" min={0.5} step={0.5} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.days} onChange={e => setForm(f => ({ ...f, days: parseFloat(e.target.value) }))} />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">From</Label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" required value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">To</Label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" required value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Reason</Label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={submit.isPending} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg disabled:opacity-50">Submit</button>
          </div>
        </form>
      )}
    </div>
  )
}

function SalaryTab({ empId }: { empId: string }) {
  const { data: structures = [] } = useHRSalaryStructures({ employee_id: empId })
  const createStructure = useCreateHRSalaryStructure()
  const [showForm, setShowForm] = useState(false)
  const [earnings, setEarnings] = useState({ basic: 0, hra: 0, da: 0, special_allowance: 0, conveyance: 0, medical: 0 })
  const [deductions, setDeductions] = useState({ pf_employee: 0, esi_employee: 0, professional_tax: 0, tds: 0 })
  const [effectiveFrom, setEffectiveFrom] = useState('')

  async function handleSave() {
    await createStructure.mutateAsync({ employee_id: empId, effective_from: effectiveFrom, earnings, deductions })
    setShowForm(false)
  }

  const active = structures.find((s: any) => s.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Salary Structure</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
          <Plus className="w-3.5 h-3.5" /> {active ? 'Revise' : 'Create'}
        </button>
      </div>
      {active && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-xs font-medium text-green-700 mb-2">Earnings</p>
            {Object.entries(active.earnings ?? {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-0.5">
                <span className="text-gray-600">{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span className="font-medium">₹{Number(v).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm">
              <span>Gross</span><span>₹{Number(active.gross_monthly).toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <p className="text-xs font-medium text-red-700 mb-2">Deductions</p>
            {Object.entries(active.deductions ?? {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-0.5">
                <span className="text-gray-600">{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span className="font-medium">₹{Number(v).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="col-span-2 bg-blue-50 rounded-xl p-4 border border-blue-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-600">Net Monthly Pay</p>
              <p className="text-2xl font-bold text-blue-900">₹{Number(active.net_monthly).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-600">Annual CTC</p>
              <p className="text-lg font-semibold text-blue-800">₹{Number(active.ctc_annual).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
      {!active && !showForm && <p className="text-sm text-gray-400 text-center py-8">No salary structure configured.</p>}
      {showForm && (
        <div className="bg-gray-50 rounded-xl border p-4 space-y-4">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Effective From</Label>
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Earnings (₹/month)</h4>
              {Object.keys(earnings).map(k => (
                <div key={k} className="flex items-center gap-2 mb-2">
                  <label className="text-xs w-32 text-gray-600">{k.replace(/_/g, ' ')}</label>
                  <input type="number" min={0} className="flex-1 border rounded px-2 py-1 text-sm" value={(earnings as any)[k]} onChange={e => setEarnings(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Deductions (₹/month)</h4>
              {Object.keys(deductions).map(k => (
                <div key={k} className="flex items-center gap-2 mb-2">
                  <label className="text-xs w-32 text-gray-600">{k.replace(/_/g, ' ')}</label>
                  <input type="number" min={0} className="flex-1 border rounded px-2 py-1 text-sm" value={(deductions as any)[k]} onChange={e => setDeductions(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={createStructure.isPending} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg disabled:opacity-50">Save Structure</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PayslipsTab({ empId }: { empId: string }) {
  const { data: payslips = [] } = useHRMyPayslips()
  const mine = payslips.filter((p: any) => p.employee_id === empId)

  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-4">Payslips</h3>
      {mine.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No payslips yet.</p>
      ) : (
        <div className="space-y-2">
          {mine.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium">{new Date(p.payroll_run?.year, p.payroll_run?.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                <p className="text-xs text-gray-500">Net: ₹{Number(p.net_amount).toLocaleString()}</p>
              </div>
              <a
                href={vendorApi.hrGetPayslipHtmlUrl(p.payroll_run_id, p.id)}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View Payslip
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CredentialsTab({ emp }: { emp: any }) {
  const setPortalPw = useSetHREmployeePortalPassword()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const user = emp.vendor_user?.user
  const loginEmail = (user?.email as string | undefined)?.trim() ?? ''
  const codeCustom = (emp.employee_code_custom as string | undefined)?.trim() ?? ''
  const codeAuto = (emp.employee_code as string | undefined)?.trim() ?? ''
  const loginAliases = [...new Set([codeCustom, codeAuto].filter(Boolean))]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    await setPortalPw.mutateAsync({ id: emp.id, password })
    setPassword('')
    setConfirmPassword('')
  }

  if (!user) {
    return (
      <div>
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" /> Credentials
        </h3>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This employee has no linked login account. Portal passwords apply only to team members who have a user record (the same account used for HR / ESS on the business front).
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" /> Credentials — HR / ESS portal
      </h3>
      <p className="text-xs text-gray-500 mb-4 max-w-xl">
        Employees open your business front <span className="font-mono bg-gray-100 px-1 rounded">/hr/login</span> and sign in with their work email or employee code plus the password you set here. This is separate from the vendor dashboard login.
      </p>

      <div className="grid gap-3 mb-6 max-w-lg">
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-0.5">Work email (login)</p>
          <p className="text-sm font-mono text-gray-900 break-all">{loginEmail || '—'}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-0.5">Employee code(s) (login)</p>
          <p className="text-sm font-mono text-gray-900">{loginAliases.length ? loginAliases.join(' · ') : '—'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">New portal password</Label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</Label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={setPortalPw.isPending || !password || !confirmPassword}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {setPortalPw.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Update portal password
        </button>
      </form>
    </div>
  )
}

// ── AssigneeInput — employee picker with email fallback ───────────────────────

function AssigneeInput({
  value,
  onChange,
  onNotifyEmail,
}: {
  value: string
  onChange: (val: string) => void
  onNotifyEmail: (email: string, name: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'search' | 'email'>('search')
  const [email, setEmail] = useState('')
  const [notified, setNotified] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useHREmployees(query.length >= 1 ? { search: query } : undefined)
  const employees: any[] = (data as any)?.items ?? []

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectEmployee(emp: any) {
    const name = emp.vendor_user?.user?.full_name ?? emp.employee_code
    onChange(name)
    setQuery(name)
    setOpen(false)
    setMode('search')
  }

  function handleNotify() {
    if (!email) return
    onNotifyEmail(email, value || email)
    setNotified(true)
  }

  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

  return (
    <div ref={ref} className="relative">
      {mode === 'search' ? (
        <>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Search employee…"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setNotified(false) }}
          />
          {open && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
              {employees.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {employees.map((emp: any) => {
                    const user = emp.vendor_user?.user
                    return (
                      <li key={emp.id}>
                        <button
                          type="button"
                          onMouseDown={() => selectEmployee(emp)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{user?.full_name ?? emp.employee_code}</p>
                            <p className="text-xs text-gray-400 truncate">{user?.email ?? ''} · {emp.department?.name ?? ''}</p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="px-3 py-2.5 text-xs text-gray-400">No employees found.</div>
              )}
              <div className="border-t px-3 py-2 bg-gray-50">
                <button
                  type="button"
                  onMouseDown={() => { setMode('email'); setOpen(false) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Assign by email instead
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              autoFocus
              type="email"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="assignee@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); onChange(e.target.value); setNotified(false) }}
            />
            <button
              type="button"
              onClick={handleNotify}
              disabled={!isEmail(email) || notified}
              className={`flex items-center gap-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                notified
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-40'
              }`}
            >
              {notified ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {notified ? 'Sent' : 'Notify'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('search'); setEmail(''); onChange(query) }}
              className="px-2 border rounded-lg hover:bg-gray-50 text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {notified && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Notification sent to {email}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskComment {
  id: string
  text: string
  author: string
  createdAt: string
  type: 'comment' | 'change_reason'
}

interface TaskHistoryEntry {
  id: string
  changedBy: string
  changedAt: string
  reason: string
  changes: { field: string; from: string; to: string }[]
}

interface TaskAttachment {
  id: string
  name: string
  size: number
  mimeType: string
}

interface ExitTask {
  id: string
  number: number
  title: string
  assignedTo: string
  dueDate: string
  priority: 'low' | 'medium' | 'high'
  done: boolean
  notes: string
  comments: TaskComment[]
  history: TaskHistoryEntry[]
  attachments: TaskAttachment[]
  createdAt: string
  createdBy: string
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  high:   { label: 'High',   color: 'bg-red-100 text-red-600',      dot: 'bg-red-500'    },
}

// ── TaskCard ───────────────────────────────────────────────────────────────────

function TaskCard({
  task, taskNum, currentUser, isOwner, onUpdate, onToggle, onRemove,
}: {
  task: ExitTask
  taskNum: string
  currentUser: string
  isOwner: boolean
  onUpdate: (updated: ExitTask) => void
  onToggle: () => void
  onRemove: () => void
}) {
  const pc = PRIORITY_CONFIG[task.priority]
  const isOverdue = !task.done && task.dueDate && new Date(task.dueDate) < new Date()

  type TabId = 'details' | 'comments' | 'history' | 'documents'
  const [copied, setCopied]             = useState(false)
  const [activeTab, setActiveTab]       = useState<TabId>('details')
  const [editing, setEditing]           = useState(false)
  const [editForm, setEditForm]         = useState({ title: task.title, assignedTo: task.assignedTo, dueDate: task.dueDate, priority: task.priority as ExitTask['priority'], notes: task.notes })
  const [changeReason, setChangeReason] = useState('')
  const [changeReasonErr, setChangeReasonErr] = useState(false)
  const [newComment, setNewComment]     = useState('')
  const fileInputRef                    = useRef<HTMLInputElement>(null)

  function copyNum() {
    navigator.clipboard.writeText(taskNum).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function fmt(iso: string) {
    try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
  }

  function saveEdit() {
    if (isOwner && !changeReason.trim()) { setChangeReasonErr(true); return }
    const labels: Record<string, string> = { title: 'Title', assignedTo: 'Assigned To', dueDate: 'Due Date', priority: 'Priority', notes: 'Notes' }
    const changes = (Object.keys(editForm) as (keyof typeof editForm)[])
      .filter(k => editForm[k] !== (task as any)[k])
      .map(k => ({ field: labels[k] ?? k, from: String((task as any)[k] || '—'), to: String(editForm[k] || '—') }))
    const history: TaskHistoryEntry[] = [...(task.history ?? [])]
    if (changes.length > 0 || changeReason.trim())
      history.push({ id: crypto.randomUUID(), changedBy: currentUser, changedAt: new Date().toISOString(), reason: changeReason.trim(), changes })
    const comments: TaskComment[] = [...task.comments]
    if (changeReason.trim())
      comments.push({ id: crypto.randomUUID(), text: changeReason.trim(), author: currentUser, createdAt: new Date().toISOString(), type: 'change_reason' })
    onUpdate({ ...task, ...editForm, comments, history })
    setEditing(false); setChangeReason(''); setChangeReasonErr(false); setActiveTab('details')
  }

  function cancelEdit() {
    setEditForm({ title: task.title, assignedTo: task.assignedTo, dueDate: task.dueDate, priority: task.priority, notes: task.notes })
    setChangeReason(''); setChangeReasonErr(false); setEditing(false)
  }

  function addComment() {
    if (!newComment.trim()) return
    const comments: TaskComment[] = [...task.comments, { id: crypto.randomUUID(), text: newComment.trim(), author: currentUser, createdAt: new Date().toISOString(), type: 'comment' }]
    onUpdate({ ...task, comments }); setNewComment('')
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const next: TaskAttachment[] = files.map(f => ({ id: crypto.randomUUID(), name: f.name, size: f.size, mimeType: f.type }))
    onUpdate({ ...task, attachments: [...(task.attachments ?? []), ...next] })
    e.target.value = ''
  }

  function removeAttachment(id: string) {
    onUpdate({ ...task, attachments: (task.attachments ?? []).filter(a => a.id !== id) })
  }

  function fmtBytes(b: number) {
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  const tabDefs = [
    { id: 'details'   as TabId, label: 'Details' },
    { id: 'comments'  as TabId, label: 'Comments' + (task.comments.length ? ' (' + task.comments.length + ')' : '') },
    { id: 'history'   as TabId, label: 'History'  + ((task.history ?? []).length ? ' (' + task.history.length + ')' : '') },
    { id: 'documents' as TabId, label: 'Documents' + ((task.attachments ?? []).length ? ' (' + task.attachments.length + ')' : '') },
  ]

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${task.done ? 'opacity-65' : 'bg-white shadow-sm'}`}>

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={onToggle} className="shrink-0" title={task.done ? 'Mark pending' : 'Mark done'}>
            {task.done ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300 hover:text-green-400" />}
          </button>
          <span className="font-mono text-xs font-bold text-blue-700 tracking-wider shrink-0">{taskNum}</span>
          <button type="button" onClick={copyNum}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border transition-all shrink-0 ${copied ? 'border-green-300 bg-green-50 text-green-600' : 'border-gray-200 bg-white text-gray-400 hover:text-blue-600 hover:border-blue-300'}`}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <span className="text-gray-300 shrink-0">·</span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${pc.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} /> {pc.label}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate min-w-0 ml-1">{task.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <FileText className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          <button type="button" onClick={onRemove}
            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Inner Tabs ── */}
      <div className="flex border-b bg-white text-xs font-medium">
        {tabDefs.map(t => (
          <button key={t.id} type="button"
            onClick={() => { setActiveTab(t.id); setEditing(t.id === 'details' ? editing : false) }}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="px-4 py-3">

        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
                  <AssigneeInput value={editForm.assignedTo} onChange={v => setEditForm(f => ({ ...f, assignedTo: v }))} onNotifyEmail={() => {}} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as ExitTask['priority'] }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  <span className={isOwner ? 'text-red-600' : 'text-gray-500'}>
                    Reason for Change {isOwner && <span className="text-red-500">*</span>}
                  </span>
                  {isOwner && <span className="text-gray-400 font-normal ml-1">(required for owner edits)</span>}
                </label>
                <textarea rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none resize-none ${changeReasonErr ? 'border-red-400 focus:ring-red-300' : 'focus:ring-blue-500'}`}
                  placeholder="Describe what changed and why…"
                  value={changeReason}
                  onChange={e => { setChangeReason(e.target.value); setChangeReasonErr(false) }}
                />
                {changeReasonErr && <p className="text-xs text-red-500 mt-0.5">Change reason is required.</p>}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancelEdit} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
                <button type="button" onClick={saveEdit} className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Save Changes</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                {task.assignedTo && (
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{task.assignedTo[0]?.toUpperCase()}</div>
                    {task.assignedTo}
                  </span>
                )}
                {task.dueDate && (
                  <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                    {isOverdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {isOverdue ? 'Overdue — ' : 'Due '}{task.dueDate}
                  </span>
                )}
                {task.createdBy && (
                  <span className="text-xs text-gray-400">Created by {task.createdBy}</span>
                )}
              </div>
              {task.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed">{task.notes}</p>}
            </div>
          )
        )}

        {/* COMMENTS TAB */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            {task.comments.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No comments yet.</p>}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {task.comments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${c.type === 'change_reason' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                    {c.author[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{c.author}</span>
                      {c.type === 'change_reason' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">Change Reason</span>
                      )}
                      <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed bg-white border rounded-lg px-2.5 py-1.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {(task.history ?? []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">No history yet.</p>}
            {(task.history ?? []).map(h => (
              <div key={h.id} className="border rounded-lg p-3 bg-gray-50 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-700">{h.changedBy}</span>
                  <span className="text-gray-400">{fmt(h.changedAt)}</span>
                  {h.reason && <span className="ml-auto text-orange-600 italic truncate">"{h.reason}"</span>}
                </div>
                {h.changes.map((ch, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-700">{ch.field}:</span>
                    <span className="line-through text-red-400">{ch.from || '—'}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600 font-medium">{ch.to || '—'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFiles} />
            {(task.attachments ?? []).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No documents attached.</p>
            )}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(task.attachments ?? []).map(a => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50 text-xs">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="flex-1 truncate font-medium text-gray-700">{a.name}</span>
                  <span className="text-gray-400 shrink-0">{fmtBytes(a.size)}</span>
                  <button type="button" onClick={() => removeAttachment(a.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 rounded-lg py-3 text-sm text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* ── Always-visible comment bar (hidden only when Comments tab is active) ── */}
      {activeTab !== 'comments' && (
        <div className="border-t px-4 py-2 flex gap-2 items-center bg-gray-50/60">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
            {currentUser[0]?.toUpperCase()}
          </div>
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Add a comment…"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment() } }}
          />
          <button type="button" onClick={addComment} disabled={!newComment.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors whitespace-nowrap">
            Post
          </button>
        </div>
      )}

      {/* ── Comment input in Comments tab ── */}
      {activeTab === 'comments' && (
        <div className="border-t px-4 py-2 flex gap-2 items-center bg-gray-50/60">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
            {currentUser[0]?.toUpperCase()}
          </div>
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Add a comment…"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment() } }}
          />
          <button type="button" onClick={addComment} disabled={!newComment.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors whitespace-nowrap">
            Post
          </button>
        </div>
      )}
    </div>
  )
}

function ExitTab({ emp, onSave }: { emp: any; onSave: (data: Record<string, unknown>) => void }) {
  const { user } = useAuthStore()
  const currentUser = user?.full_name || user?.email || 'Unknown'
  const isOwner = (user as any)?.vendor_role?.role === 'owner' || (user as any)?.vendor_role?.role_name?.toLowerCase() === 'owner'

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    date_of_exit: emp.date_of_exit ?? '',
    lwd: emp.lwd ?? '',
    exit_reason: emp.exit_reason ?? '',
    exit_interview_notes: emp.exit_interview_notes ?? '',
    notice_served: emp.notice_served ?? false,
    status: emp.status ?? 'active',
  })
  const [clearance, setClearance] = useState<Record<string, boolean>>(emp.exit_clearance ?? {})

  // ── Tasks ─────────────────────────────────────────────────────
  const TASKS_KEY = `exit_tasks_${emp.id}`

  const parseTasks = (raw: string | undefined | null): ExitTask[] => {
    try { return JSON.parse(raw ?? '[]').map((t: any) => ({ ...t, comments: t.comments ?? [], history: t.history ?? [], attachments: t.attachments ?? [] })) } catch { return [] }
  }

  const [tasks, setTasks] = useState<ExitTask[]>(() => {
    // Prefer localStorage over backend field (backend may not store this column yet)
    const stored = localStorage.getItem(TASKS_KEY)
    if (stored) return parseTasks(stored)
    return parseTasks(emp.exit_tasks)
  })

  function saveTasks(newTasks: ExitTask[]) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(newTasks))
    setTasks(newTasks)
    // Attempt backend save (best-effort)
    onSave({ exit_tasks: JSON.stringify(newTasks) })
  }

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', assignedTo: '', dueDate: '', priority: 'medium' as ExitTask['priority'], notes: '' })

  function handleNotifyEmail(email: string, name: string) {
    import('@/api/client').then(({ apiClient }) => {
      apiClient.post('/vendors/me/notifications/send-email', {
        to: email,
        subject: `Exit task assigned: ${taskForm.title || 'New task'}`,
        body: `Hi ${name},\n\nYou have been assigned an exit task for employee ${emp.vendor_user?.user?.full_name ?? emp.employee_code}.\n\nTask: ${taskForm.title}\n\nPlease action this at your earliest convenience.`,
      }).catch(() => {})
    })
  }

  function addTask() {
    if (!taskForm.title.trim()) return
    const newTask: ExitTask = {
      ...taskForm,
      id: crypto.randomUUID(),
      number: tasks.length > 0 ? Math.max(...tasks.map(t => t.number)) + 1 : 1,
      done: false,
      comments: [],
      history: [],
      attachments: [],
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
    }
    const updated = [...tasks, newTask]
    saveTasks(updated)
    setTaskForm({ title: '', assignedTo: '', dueDate: '', priority: 'medium', notes: '' })
    setShowTaskForm(false)
  }

  function updateTask(updated: ExitTask) {
    saveTasks(tasks.map(t => t.id === updated.id ? updated : t))
  }

  function toggleTask(id: string) {
    saveTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function removeTask(id: string) {
    saveTasks(tasks.filter(t => t.id !== id))
  }

  function toggleClearance(key: string) {
    setClearance(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    onSave({ ...form, exit_clearance: clearance })
    setEditing(false)
  }

  const isExited = emp.status === 'exited' || emp.status === 'on_notice'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <LogOut className="w-4 h-4 text-red-500" /> Exit Management
        </h3>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Save</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Edit</button>
        )}
      </div>

      {!isExited && !editing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-sm text-yellow-800">
          This employee is currently <strong>{emp.status?.replace('_', ' ')}</strong>. Fill out exit details when the employee is leaving.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Last Day of Employment</p>
          {editing ? (
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.date_of_exit} onChange={e => setForm(f => ({ ...f, date_of_exit: e.target.value }))} />
          ) : (
            <p className="text-sm text-gray-900">{emp.date_of_exit ?? <span className="text-gray-400">—</span>}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Last Working Day (LWD)</p>
          {editing ? (
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.lwd} onChange={e => setForm(f => ({ ...f, lwd: e.target.value }))} />
          ) : (
            <p className="text-sm text-gray-900">{emp.lwd ?? <span className="text-gray-400">—</span>}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Exit Reason</p>
          {editing ? (
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.exit_reason} onChange={e => setForm(f => ({ ...f, exit_reason: e.target.value }))}>
              <option value="">— Select —</option>
              <option value="resignation">Resignation</option>
              <option value="termination">Termination</option>
              <option value="retirement">Retirement</option>
              <option value="contract_end">Contract End</option>
              <option value="absconding">Absconding</option>
              <option value="other">Other</option>
            </select>
          ) : (
            <p className="text-sm text-gray-900 capitalize">{emp.exit_reason?.replace('_', ' ') ?? <span className="text-gray-400">—</span>}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
          {editing ? (
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="on_notice">On Notice</option>
              <option value="exited">Exited</option>
            </select>
          ) : (
            <p className="text-sm text-gray-900 capitalize">{emp.status?.replace('_', ' ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="notice-served"
            checked={editing ? form.notice_served : (emp.notice_served ?? false)}
            onChange={e => editing && setForm(f => ({ ...f, notice_served: e.target.checked }))}
            disabled={!editing}
            className="rounded"
          />
          <label htmlFor="notice-served" className="text-sm text-gray-700">Notice Period Served</label>
        </div>
      </div>

      {/* Exit Interview Notes */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 mb-1">Exit Interview Notes</p>
        {editing ? (
          <textarea
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Notes from exit interview, feedback, reasons elaborated…"
            value={form.exit_interview_notes}
            onChange={e => setForm(f => ({ ...f, exit_interview_notes: e.target.value }))}
          />
        ) : (
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{emp.exit_interview_notes || <span className="text-gray-400">—</span>}</p>
        )}
      </div>

      {/* Clearance Checklist */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">Exit Clearance Checklist</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CLEARANCE_ITEMS.map(item => {
            const done = clearance[item.key] ?? false
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => editing && toggleClearance(item.key)}
                className={`flex items-center gap-2 p-3 border rounded-lg text-sm transition-colors ${
                  done
                    ? 'bg-green-50 border-green-300 text-green-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                } ${editing ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
              >
                <CheckCircle className={`w-4 h-4 ${done ? 'text-green-500' : 'text-gray-300'}`} />
                {item.label}
              </button>
            )
          })}
        </div>
        {editing && (
          <p className="text-xs text-gray-400 mt-2">Click each item to toggle clearance status.</p>
        )}
      </div>

      {/* ── Exit Tasks ─────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <List className="w-4 h-4 text-blue-500" />
            Exit Tasks
            {tasks.length > 0 && (
              <span className="text-xs font-normal px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {tasks.filter(t => t.done).length}/{tasks.length} done
              </span>
            )}
          </h4>
          <button
            type="button"
            onClick={() => setShowTaskForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>

        {/* New task form */}
        {showTaskForm && (
          <div className="border rounded-xl p-4 mb-4 bg-blue-50/30 space-y-3">
            <SectionLabel>New Task</SectionLabel>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Task Title <span className="text-red-500">*</span></label>
              <input
                autoFocus
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                placeholder="e.g. Collect laptop from employee"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</Label>
                <AssigneeInput
                  value={taskForm.assignedTo}
                  onChange={v => setTaskForm(f => ({ ...f, assignedTo: v }))}
                  onNotifyEmail={handleNotifyEmail}
                />
              </div>
              <div>
                <Label className="block text-xs font-medium text-gray-600 mb-1">Due Date</Label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={taskForm.dueDate}
                  onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="block text-xs font-medium text-gray-600 mb-1">Priority</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={taskForm.priority}
                  onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as ExitTask['priority'] }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                placeholder="Any additional context…"
                value={taskForm.notes}
                onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowTaskForm(false)}
                className="btn-cancel px-3 py-1.5 text-sm border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addTask}
                disabled={!taskForm.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        {tasks.length === 0 && !showTaskForm ? (
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
            <List className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-sm">No exit tasks yet.</p>
            <p className="text-xs mt-0.5">Add tasks to track pending actions like asset returns, account closures, etc.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => {
              const pc = PRIORITY_CONFIG[task.priority]
              const isOverdue = !task.done && task.dueDate && new Date(task.dueDate) < new Date()
              const taskNum = `HR-EX-${String(task.number).padStart(6, '0')}`
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  taskNum={taskNum}
                  currentUser={currentUser}
                  isOwner={isOwner}
                  onUpdate={updateTask}
                  onToggle={() => toggleTask(task.id)}
                  onRemove={() => removeTask(task.id)}
                />
              )
            })}
          </div>
        )}

        {tasks.length > 0 && (
          <p className="mt-2 text-xs text-gray-400 text-right">Changes auto-saved on each action.</p>
        )}
      </div>
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: emp, isLoading } = useHREmployee(id ?? null)
  const vendorSlug = useVendorStore(s => s.vendor?.slug ?? '')
  const { data: departments = [] } = useHRDepartments()
  const { data: designations = [] } = useHRDesignations()
  const updateEmployee = useUpdateHREmployee()
  const [activeTab, setActiveTab] = useState<EmployeeTabId>(() => resolveEmployeeTab(searchParams.get('tab')))
  const [editing, setEditing] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({})
  const isSaving = updateEmployee.isPending

  useEffect(() => {
    setActiveTab(resolveEmployeeTab(searchParams.get('tab')))
  }, [searchParams])

  // Reset pending changes when emp reloads (after a save)
  useEffect(() => {
    setPendingChanges({})
    setEditing(false)
  }, [emp?.updated_at])

  function setTab(tab: EmployeeTabId) {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  function collect(data: Record<string, unknown>) {
    setPendingChanges(prev => ({ ...prev, ...data }))
  }

  async function handleSaveAll() {
    if (Object.keys(pendingChanges).length === 0) {
      setEditing(false)
      return
    }
    try {
      await updateEmployee.mutateAsync({
        id: emp.id,
        data: sanitizeEmployeeUpdatePayload(pendingChanges),
      })
      toast.success('Changes saved')
      setEditing(false)
      setPendingChanges({})
    } catch {
      toast.error('Failed to save changes')
    }
  }

  function handleCancelEdit() {
    setEditing(false)
    setPendingChanges({})
  }

  // For credentials / ops tabs that still do their own save (passwords, leaves, etc.)
  async function handleDirectSave(data: Record<string, unknown>) {
    await updateEmployee.mutateAsync({ id: emp.id, data: sanitizeEmployeeUpdatePayload(data) })
  }

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!emp) return <div className="p-8 text-center text-red-500">Employee not found.</div>

  const displayName = employeeDisplayName(emp)
  const initials = displayName[0]?.toUpperCase() ?? emp.employee_code?.[0] ?? '?'
  const hasPendingChanges = Object.keys(pendingChanges).length > 0

  const returnTo = searchParams.get('returnTo')
  const returnClaimId = searchParams.get('claimId')?.trim() ?? ''
  const backToExpenseClaim =
    (returnTo === '/hr/expenses' || returnTo === 'expenses') && returnClaimId.length > 0

  // Master tabs support global edit; ops tabs handle their own editing
  const isMasterTab = ['identity', 'credentials', 'addresses', 'bank', 'kyc', 'personal', 'family', 'notes'].includes(activeTab)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        {backToExpenseClaim ? (
          <Link
            to={`/hr/expenses?claim=${encodeURIComponent(returnClaimId)}`}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 -ml-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Back to expense claim"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Back to expense claim</span>
          </Link>
        ) : (
          <Link to="/hr/employees" className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0" title="Back to employees">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
        )}
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{displayName}</h1>
          <p className="text-sm text-gray-500 truncate">
            {(emp.employee_code_custom as string | undefined) || (emp.employee_code as string | undefined)}
            {emp.designation?.name ? ` · ${emp.designation.name}` : ''}
            {emp.department?.name ? ` · ${emp.department.name}` : ''}
          </p>
        </div>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
          emp.status === 'active' ? 'bg-green-100 text-green-700' :
          emp.status === 'probation' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {emp.status?.replace('_', ' ')}
        </span>

        {/* ── Share access + Global edit / save ── */}
        {isMasterTab && (
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (() => {
              const linkedUser = (emp as any).vendor_user?.user
              const loginEmail = (linkedUser?.email ?? '').trim()
              const storedOtp = (linkedUser?.portal_temp_password ?? '').trim()
              const codeCustom = String(emp.employee_code_custom ?? '').trim()
              const codeAuto = String(emp.employee_code ?? '').trim()
              const loginAliases = [...new Set([codeCustom, codeAuto].filter(Boolean))]
              const hrPortalUrl = vendorSlug
                ? `${getStorefrontAppOrigin()}/store/${encodeURIComponent(vendorSlug)}/hr/login`
                : `${getStorefrontAppOrigin()}/hr/login`
              return (
                <ShareDropdown
                  hrPortalUrl={hrPortalUrl}
                  loginEmail={loginEmail}
                  loginAliases={loginAliases}
                  displayName={displayName}
                  otp={storedOtp || null}
                />
              )
            })()}
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                    hasPendingChanges
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-gray-100 text-gray-500'
                  } disabled:opacity-50`}
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit profile
              </button>
            )}
          </div>
        )}
      </div>

      {editing && hasPendingChanges && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Save className="w-3.5 h-3.5 shrink-0" />
          Unsaved changes across tabs — click <strong className="mx-0.5">Save changes</strong> to apply them all.
        </div>
      )}

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <EmployeeTabBar activeTab={activeTab} onTabChange={setTab} />
        <div className="p-6">
          {activeTab === 'identity' && (
            <IdentityTab
              emp={emp as Record<string, unknown>}
              editing={editing}
              onChange={collect}
              departments={departments}
              designations={designations}
            />
          )}
          {activeTab === 'credentials' && (
            <EmployeeCredentialsTab
              emp={emp as Record<string, unknown>}
              editing={editing}
              onSave={handleDirectSave}
              empId={String(emp.id)}
            />
          )}
          {activeTab === 'addresses' && (
            <AddressesTab emp={emp as Record<string, unknown>} editing={editing} onChange={collect} />
          )}
          {activeTab === 'bank' && (
            <BankTab emp={emp as Record<string, unknown>} editing={editing} onChange={collect} />
          )}
          {activeTab === 'kyc' && (
            <KycTab emp={emp as Record<string, unknown>} editing={editing} onChange={collect} />
          )}
          {activeTab === 'personal' && (
            <EmployeePersonalTab emp={emp as Record<string, unknown>} editing={editing} onChange={collect} />
          )}
          {activeTab === 'family' && (
            <FamilyTab emp={emp as Record<string, unknown>} editing={editing} onChange={collect} />
          )}
          {activeTab === 'notes' && (
            <NotesTab emp={emp as Record<string, unknown>} editing={editing} onChange={collect} />
          )}
          {activeTab === 'documents' && <DocumentsTab empId={emp.id} />}
          {activeTab === 'leaves' && <LeavesTab empId={emp.id} />}
          {activeTab === 'salary' && <SalaryTab empId={emp.id} />}
          {activeTab === 'payslips' && <PayslipsTab empId={emp.id} />}
          {activeTab === 'exit' && <ExitTab emp={emp} onSave={handleDirectSave} />}
        </div>
      </div>
    </div>
  )
}
