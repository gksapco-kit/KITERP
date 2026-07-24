import { cn } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { Button } from '@/components/ui/button'
import {
  hrInputClass,
  hrSelectClass,
  hrInfoBannerClass,
  hrTableHeadClass,
  hrStatIconClass,
  hrStatusBadge,
  hrLabelClass,
} from '../hrFormUi'
import { SectionLabel } from '@/components/common/FieldLabel'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Users, UserCheck, UserX, Clock, Eye, EyeOff,
  ChevronDown, ChevronUp, Loader2, X, Building2, Trash2,
  LogOut, LogIn, KeyRound, Upload, File,
} from 'lucide-react'
import {
  useHREmployees, useHRDepartments, useCreateHREmployee,
  useHRDesignations, useStores,
  useHRNextEmployeeCode, useHRSeedTestData,
} from '@/hooks/useVendor'
import { employeeDisplayName } from '@/lib/hrEmployeeDisplay'
import { DeptModal } from '@/components/hr/DeptModal'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { DesigModal } from '@/components/hr/DesigModal'
import type { EmployeeProfile, HRDepartment, HRDesignation, FamilyMember } from '@/types'
import { EMPLOYEE_MASTER_TABS, type EmployeeMasterTabId } from './employeeMasterTabs'

// ── Status / type helpers ────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: hrStatusBadge.active,
  on_notice: hrStatusBadge.on_notice,
  exited: hrStatusBadge.exited,
  probation: hrStatusBadge.probation,
}

const DEFAULT_EMP_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
]

/** Dense controls so Add Employee Identity fits one viewport. */
const denseFieldClass =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const denseLabelClass = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'

function getCustomEmpTypes(): { value: string; label: string }[] {
  try {
    return JSON.parse(localStorage.getItem('hr_custom_emp_types') ?? '[]')
  } catch { return [] }
}
function saveCustomEmpType(label: string) {
  const existing = getCustomEmpTypes()
  const value = label.toLowerCase().replace(/\s+/g, '_')
  if (existing.some(t => t.value === value)) return value
  localStorage.setItem('hr_custom_emp_types', JSON.stringify([...existing, { value, label }]))
  return value
}


// ── Address block helper ─────────────────────────────────────────

interface HRAddr { street: string; city: string; state: string; pincode: string; country: string }
const EMPTY_ADDR: HRAddr = { street: '', city: '', state: '', pincode: '', country: 'India' }

function AddressFields({
  label,
  addr,
  onChange,
}: {
  label: string
  addr: HRAddr
  onChange: (a: HRAddr) => void
}) {
  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Street / House No. / Area"
        value={addr.street}
        onChange={e => onChange({ ...addr, street: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="City" value={addr.city} onChange={e => onChange({ ...addr, city: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="State" value={addr.state} onChange={e => onChange({ ...addr, state: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="PIN Code" maxLength={10} value={addr.pincode} onChange={e => onChange({ ...addr, pincode: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Country" value={addr.country} onChange={e => onChange({ ...addr, country: e.target.value })} />
      </div>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────

function Section({ icon: Icon, title, children, collapsible = false }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(!collapsible)
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen(v => !v)}
        className={`flex w-full items-center justify-between border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground ${collapsible ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default'}`}
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</span>
        {collapsible && (open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

// ── Family Member Row ────────────────────────────────────────────

const EMPTY_MEMBER: FamilyMember = { name: '', relation: '', dob: '', phone: '', gender: '', blood_group: '' }

function FamilyMemberRow({
  member,
  index,
  onChange,
  onRemove,
}: {
  member: FamilyMember
  index: number
  onChange: (m: FamilyMember) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">Member {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 p-0.5">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-0.5 block text-xs text-muted-foreground" required>Name</Label>
          <input
            className={hrInputClass}
            value={member.name}
            onChange={e => onChange({ ...member, name: e.target.value })}
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <Label className="mb-0.5 block text-xs text-muted-foreground" required>Relation</Label>
          <Select
            className={hrInputClass}
            value={member.relation}
            onChange={v => onChange({ ...member, relation: v })}
            options={[
              { value: '', label: '— Select —' },
              ...['Spouse', 'Child', 'Parent', 'Sibling', 'Guardian', 'Other'].map(r => ({
                value: r.toLowerCase(),
                label: r,
              })),
            ]}
          />
        </div>
        <div>
          <Label className="mb-0.5 block text-xs text-muted-foreground">Date of Birth</Label>
          <input
            type="date"
            className={hrInputClass}
            value={member.dob ?? ''}
            onChange={e => onChange({ ...member, dob: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-0.5 block text-xs text-muted-foreground">Phone</Label>
          <PhoneInput
            value={member.phone ?? ''}
            onChange={v => onChange({ ...member, phone: v })}
          />
        </div>
        <div>
          <Label className="mb-0.5 block text-xs text-muted-foreground">Gender</Label>
          <Select
            className={hrInputClass}
            value={member.gender ?? ''}
            onChange={v => onChange({ ...member, gender: v })}
            options={[
              { value: '', label: '—' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
        <div>
          <Label className="mb-0.5 block text-xs text-muted-foreground">Blood Group</Label>
          <Select
            className={hrInputClass}
            value={member.blood_group ?? ''}
            onChange={v => onChange({ ...member, blood_group: v })}
            options={[
              { value: '', label: '—' },
              ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => ({ value: g, label: g })),
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main Modal ───────────────────────────────────────────────────

function AddEmployeeModal({
  departments,
  onClose,
}: {
  departments: HRDepartment[]
  onClose: () => void
}) {
  const { data: designations = [] } = useHRDesignations()
  const { data: storesData } = useStores()
  const createEmployee = useCreateHREmployee()

  const stores = storesData?.stores ?? []

  // ── Identity & Assignment ──────────────────────────────────────
  const [employeeFullName, setEmployeeFullName] = useState('')

  const [departmentId, setDepartmentId] = useState('')
  const [designationId, setDesignationId] = useState('')

  // Employer (entity the employee belongs to)
  const [employerStoreId, setEmployerStoreId] = useState('')
  const [employeeIdOverride, setEmployeeIdOverride] = useState('')
  const [employeeIdManual, setEmployeeIdManual] = useState(false)

  const { data: nextCodeData } = useHRNextEmployeeCode(employerStoreId || undefined)

  // Employment Type (with custom creation)
  const [empTypeOptions, setEmpTypeOptions] = useState(() => [...DEFAULT_EMP_TYPES, ...getCustomEmpTypes()])
  const [employmentType, setEmploymentType] = useState('full_time')
  const [showNewEmpType, setShowNewEmpType] = useState(false)
  const [newEmpTypeLabel, setNewEmpTypeLabel] = useState('')

  const [dateOfJoining, setDateOfJoining] = useState('')
  const [lwd, setLwd] = useState('')

  // ── Credentials ────────────────────────────────────────────────
  const [posPin, setPosPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  // ── Addresses ─────────────────────────────────────────────────
  const [currentAddr, setCurrentAddr] = useState<HRAddr>({ ...EMPTY_ADDR })
  const [permanentAddr, setPermanentAddr] = useState<HRAddr>({ ...EMPTY_ADDR })
  const [sameAsCurrent, setSameAsCurrent] = useState(false)

  // ── Bank Details ───────────────────────────────────────────────
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [accountType, setAccountType] = useState('savings')
  const [ifscCode, setIfscCode] = useState('')

  // ── KYC / Legal ────────────────────────────────────────────────
  const [panNumber, setPanNumber] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [uanNumber, setUanNumber] = useState('')
  const [esiNumber, setEsiNumber] = useState('')

  // ── Personal ───────────────────────────────────────────────────
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [nationality, setNationality] = useState('Indian')
  const [personalEmail, setPersonalEmail] = useState('')
  const [personalPhone, setPersonalPhone] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')

  // ── Family Members ─────────────────────────────────────────────
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])

  // ── Notes ──────────────────────────────────────────────────────
  const [notes, setNotes] = useState('')

  // ── Documents ─────────────────────────────────────────────────
  interface EmpDoc { type: string; label: string; file: File }
  const [documents, setDocuments] = useState<EmpDoc[]>([])
  const [docType, setDocType] = useState('id_proof')
  const [docLabel, setDocLabel] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [showDocForm, setShowDocForm] = useState(false)

  const DOC_TYPES = [
    { value: 'id_proof',        label: 'ID Proof' },
    { value: 'address_proof',   label: 'Address Proof' },
    { value: 'pan_card',        label: 'PAN Card' },
    { value: 'aadhaar_card',    label: 'Aadhaar Card' },
    { value: 'resume',          label: 'Resume / CV' },
    { value: 'offer_letter',    label: 'Offer Letter' },
    { value: 'experience',      label: 'Experience Letter' },
    { value: 'education',       label: 'Educational Certificate' },
    { value: 'bank_passbook',   label: 'Bank Passbook' },
    { value: 'other',           label: 'Other' },
  ]

  function addDocument() {
    if (!docFile) return
    const label = docLabel.trim() || DOC_TYPES.find(t => t.value === docType)?.label || docType
    setDocuments(prev => [...prev, { type: docType, label, file: docFile }])
    setDocType('id_proof')
    setDocLabel('')
    setDocFile(null)
    setShowDocForm(false)
  }

  function removeDocument(index: number) {
    setDocuments(prev => prev.filter((_, i) => i !== index))
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Inline Dept / Desig creation ─────────────────────────────
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [showDesigModal, setShowDesigModal] = useState(false)

  // ── Tabs ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<EmployeeMasterTabId>('identity')

  function addEmpType() {
    const label = newEmpTypeLabel.trim()
    if (!label) return
    const value = saveCustomEmpType(label)
    setEmpTypeOptions(prev => prev.some(t => t.value === value) ? prev : [...prev, { value, label }])
    setEmploymentType(value)
    setNewEmpTypeLabel('')
    setShowNewEmpType(false)
  }

  function addFamilyMember() {
    setFamilyMembers(prev => [...prev, { ...EMPTY_MEMBER }])
  }
  function updateFamilyMember(index: number, m: FamilyMember) {
    setFamilyMembers(prev => prev.map((f, i) => i === index ? m : f))
  }
  function removeFamilyMember(index: number) {
    setFamilyMembers(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const name = employeeFullName.trim()
    if (!name) return
    if (!personalEmail.trim() && !personalPhone.trim()) return

    const payload: Record<string, unknown> = {
      full_name: name,
    }
    if (departmentId) payload.department_id = departmentId
    if (designationId) payload.designation_id = designationId
    if (employmentType) payload.employment_type = employmentType
    if (dateOfJoining) payload.date_of_joining = dateOfJoining
    if (lwd) payload.lwd = lwd
    if (posPin) payload.pos_pin = posPin

    // Employer
    if (employerStoreId) payload.store_id = employerStoreId
    // Employee ID: manual override goes as custom code; auto → backend assigns
    if (employeeIdManual && employeeIdOverride.trim()) {
      payload.employee_code_custom = employeeIdOverride.trim()
    }

    const currentAddrFilled = currentAddr.street || currentAddr.city
    if (currentAddrFilled) payload.current_address = currentAddr
    const permAddrFilled = sameAsCurrent ? currentAddrFilled : (permanentAddr.street || permanentAddr.city)
    if (permAddrFilled) payload.permanent_address = sameAsCurrent ? currentAddr : permanentAddr

    if (bankName) payload.bank_name = bankName
    if (accountNumber) payload.account_number = accountNumber
    if (accountHolderName) payload.account_holder_name = accountHolderName
    if (accountType) payload.account_type = accountType
    if (ifscCode) payload.ifsc_code = ifscCode

    if (panNumber) payload.pan_number = panNumber.toUpperCase()
    if (aadhaarNumber) payload.aadhaar_number = aadhaarNumber
    if (uanNumber) payload.uan_number = uanNumber
    if (esiNumber) payload.esi_number = esiNumber

    if (dateOfBirth) payload.date_of_birth = dateOfBirth
    if (gender) payload.gender = gender
    if (bloodGroup) payload.blood_group = bloodGroup
    if (maritalStatus) payload.marital_status = maritalStatus
    if (nationality) payload.nationality = nationality
    if (personalEmail) payload.personal_email = personalEmail
    if (personalPhone) payload.personal_phone = personalPhone
    if (emergencyName) payload.emergency_contact_name = emergencyName
    if (emergencyPhone) payload.emergency_contact_phone = emergencyPhone
    if (emergencyRelation) payload.emergency_contact_relation = emergencyRelation

    if (familyMembers.length > 0) payload.family_members = familyMembers
    if (notes) payload.notes = notes

    if (documents.length > 0) {
      const formData = new FormData()
      Object.entries(payload).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val))
        }
      })
      documents.forEach((doc, i) => {
        formData.append(`documents[${i}][type]`, doc.type)
        formData.append(`documents[${i}][label]`, doc.label)
        formData.append(`documents[${i}][file]`, doc.file)
      })
      await createEmployee.mutateAsync(formData as any)
    } else {
      await createEmployee.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <>
      <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
        <ModalPanel className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[960px] !rounded-lg overflow-hidden">
          <ModalHeader
            title="Add Employee"
            onClose={onClose}
            className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
          />

          {/* Compact tab bar */}
          <div className="flex shrink-0 gap-0.5 overflow-x-auto px-3">
            {EMPLOYEE_MASTER_TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors focus:outline-none',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <form id="add-employee-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <ModalBody className="overflow-y-auto px-4 pb-1 pt-2">

            {/* Tab: Identity & Assignment */}
            {activeTab === 'identity' && (
              <div className="space-y-2">
                <div className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[11px] leading-snug text-foreground">
                  HR records payroll and employment data only. Grant portal login from
                  <strong className="mx-1">Staff Access Control</strong> when needed.
                </div>
                <div>
                  <label className={denseLabelClass}>
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    className={denseFieldClass}
                    placeholder="John Smith"
                    value={employeeFullName}
                    onChange={e => setEmployeeFullName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={denseLabelClass}>
                      Personal Email <span className="font-normal text-muted-foreground/80">(email or phone)</span>
                    </label>
                    <input
                      type="email"
                      className={denseFieldClass}
                      placeholder="personal@email.com"
                      value={personalEmail}
                      onChange={e => setPersonalEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Personal Phone</Label>
                    <PhoneInput compact compactCountry value={personalPhone} onChange={setPersonalPhone} placeholder="Personal mobile" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={cn(denseLabelClass, 'flex items-center gap-1')}>
                      <Building2 className="h-3 w-3" /> Employer / Business Entity
                    </label>
                    <Select
                      className={denseFieldClass}
                      value={employerStoreId}
                      onChange={v => { setEmployerStoreId(v); setEmployeeIdManual(false); setEmployeeIdOverride('') }}
                      options={[
                        { value: '', label: '— No specific entity —' },
                        ...stores.map(s => ({
                          value: s.id,
                          label: `${s.name}${s.code ? ` · ${s.code}` : ''}`,
                        })),
                      ]}
                    />
                  </div>
                  <div>
                    <div className="mb-0.5 flex items-center justify-between">
                      <label className="text-[11px] font-medium text-muted-foreground">Employee ID</label>
                      <div className="flex rounded-md bg-muted p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => { setEmployeeIdManual(false); setEmployeeIdOverride('') }}
                          className={cn('rounded px-1.5 py-0.5 transition-colors', !employeeIdManual ? 'bg-background font-medium text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmployeeIdManual(true)}
                          className={cn('rounded px-1.5 py-0.5 transition-colors', employeeIdManual ? 'bg-background font-medium text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                    {employeeIdManual ? (
                      <input
                        autoFocus
                        className={cn(denseFieldClass, 'border-primary/40 font-mono')}
                        placeholder="e.g. Hyd001"
                        value={employeeIdOverride}
                        onChange={e => setEmployeeIdOverride(e.target.value)}
                      />
                    ) : (
                      <div className="flex h-8 select-none items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 font-mono text-sm text-muted-foreground">
                        <span className="text-[10px] text-muted-foreground/70">System</span>
                        <span className="font-medium text-foreground">{nextCodeData?.next_code ?? '—'}</span>
                      </div>
                    )}
                    {employeeIdManual && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Custom ID; system still assigns an internal code.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className={denseLabelClass}>Department</Label>
                    <div className="flex gap-1">
                      <Select
                        className={cn(denseFieldClass, 'flex-1')}
                        value={departmentId}
                        onChange={setDepartmentId}
                        options={[
                          { value: '', label: '— None —' },
                          ...departments.map(d => ({ value: d.id, label: d.name })),
                        ]}
                      />
                      <button type="button" title="Create department" onClick={() => setShowDeptModal(true)} className="flex h-8 items-center rounded-md border border-border px-2 text-primary hover:bg-primary/10">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Designation</Label>
                    <div className="flex gap-1">
                      <Select
                        className={cn(denseFieldClass, 'flex-1')}
                        value={designationId}
                        onChange={setDesignationId}
                        options={[
                          { value: '', label: '— None —' },
                          ...designations.map((d: HRDesignation) => ({ value: d.id, label: d.name })),
                        ]}
                      />
                      <button type="button" title="Create designation" onClick={() => setShowDesigModal(true)} className="flex h-8 items-center rounded-md border border-border px-2 text-primary hover:bg-primary/10">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className={denseLabelClass}>Employment Type</Label>
                    {showNewEmpType ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          className={cn(denseFieldClass, 'flex-1')}
                          placeholder="e.g. Freelancer"
                          value={newEmpTypeLabel}
                          onChange={e => setNewEmpTypeLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmpType() } if (e.key === 'Escape') setShowNewEmpType(false) }}
                        />
                        <button type="button" onClick={addEmpType} className="h-8 rounded-md bg-primary px-2 text-xs text-white hover:bg-primary/90">Add</button>
                        <button type="button" aria-label="Close" onClick={() => setShowNewEmpType(false)} className="flex h-8 items-center rounded-md border border-border px-1.5 hover:bg-muted">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Select
                          className={cn(denseFieldClass, 'flex-1')}
                          value={employmentType}
                          onChange={setEmploymentType}
                          options={empTypeOptions.map(t => ({ value: t.value, label: t.label }))}
                        />
                        <button type="button" title="Add custom employment type" onClick={() => setShowNewEmpType(true)} className="flex h-8 items-center rounded-md border border-border px-2 text-primary hover:bg-primary/10">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Date of Joining</Label>
                    <input type="date" className={denseFieldClass} value={dateOfJoining} onChange={e => setDateOfJoining(e.target.value)} />
                  </div>
                  <div>
                    <label className={denseLabelClass}>Last Working Day <span className="font-normal text-muted-foreground/70">(LWD)</span></label>
                    <input type="date" className={denseFieldClass} value={lwd} onChange={e => setLwd(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Credentials */}
            {activeTab === 'credentials' && (
              <div className="space-y-6">
                {/* POS PIN */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">POS PIN</h3>
                  </div>
                  <div className="relative w-48">
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      pattern="\d{4,6}"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-10 tracking-widest"
                      placeholder="● ● ● ●"
                      value={posPin}
                      onChange={e => setPosPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    <button type="button" onClick={() => setShowPin(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">4–6 digits. Used at POS terminals for quick login.</p>
                </section>
                {/* Portal note */}
                <section className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <LogIn className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">HR / ESS portal</h3>
                  </div>
                  <div className={cn(hrInfoBannerClass, 'max-w-lg')}>
                    Portal access (login email + password) is managed separately under <strong>Staff Access Control</strong> after the profile is created. The employee code you assign will also work as a login username.
                  </div>
                </section>
              </div>
            )}

            {/* Tab: Addresses */}
            {activeTab === 'addresses' && (
              <div className="space-y-4">
                <AddressFields label="Current Address" addr={currentAddr} onChange={setCurrentAddr} />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="same-addr" checked={sameAsCurrent} onChange={e => setSameAsCurrent(e.target.checked)} className="rounded" />
                  <label htmlFor="same-addr" className="cursor-pointer text-xs text-muted-foreground">Permanent address same as current</label>
                </div>
                {!sameAsCurrent && <AddressFields label="Permanent Address" addr={permanentAddr} onChange={setPermanentAddr} />}
              </div>
            )}

            {/* Tab: Bank Details */}
            {activeTab === 'bank' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">Bank Name</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. State Bank of India" value={bankName} onChange={e => setBankName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">Account Type</Label>
                  <Select
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={accountType}
                    onChange={setAccountType}
                    options={[
                      { value: 'savings', label: 'Savings' },
                      { value: 'current', label: 'Current' },
                    ]}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">Account Holder Name</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="As per bank records" value={accountHolderName} onChange={e => setAccountHolderName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">Account Number</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Account number" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">IFSC Code</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none" placeholder="SBIN0001234" maxLength={11} value={ifscCode} onChange={e => setIfscCode(e.target.value.toUpperCase())} />
                </div>
              </div>
            )}

            {/* Tab: KYC & Legal */}
            {activeTab === 'kyc' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">PAN Number</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ABCDE1234F" maxLength={10} value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">Aadhaar Number</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="12 digits" maxLength={12} value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">UAN (PF Number)</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Universal Account Number" value={uanNumber} onChange={e => setUanNumber(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-muted-foreground">ESI Number</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Employee State Insurance No." value={esiNumber} onChange={e => setEsiNumber(e.target.value)} />
                </div>
              </div>
            )}

            {/* Tab: Personal Information */}
            {activeTab === 'personal' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">Date of Birth</Label>
                    <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">Gender</Label>
                    <Select
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={gender}
                      onChange={setGender}
                      options={[
                        { value: '', label: '—' },
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                      ]}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">Blood Group</Label>
                    <Select
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={bloodGroup}
                      onChange={setBloodGroup}
                      options={[
                        { value: '', label: '—' },
                        ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => ({ value: g, label: g })),
                      ]}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">Marital Status</Label>
                    <Select
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={maritalStatus}
                      onChange={setMaritalStatus}
                      options={[
                        { value: '', label: '—' },
                        { value: 'single', label: 'Single' },
                        { value: 'married', label: 'Married' },
                        { value: 'divorced', label: 'Divorced' },
                        { value: 'widowed', label: 'Widowed' },
                      ]}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">Nationality</Label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={nationality} onChange={e => setNationality(e.target.value)} />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <SectionLabel className="mb-3">Emergency Contact</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Name</Label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</Label>
                      <PhoneInput value={emergencyPhone} onChange={setEmergencyPhone} placeholder="Emergency contact" />
                    </div>
                    <div className="col-span-2">
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Relation</Label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Spouse, Parent, Sibling" value={emergencyRelation} onChange={e => setEmergencyRelation(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Family Members */}
            {activeTab === 'family' && (
              <div className="space-y-3">
                {familyMembers.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No family members added yet.</p>
                )}
                {familyMembers.map((m, i) => (
                  <FamilyMemberRow
                    key={i}
                    member={m}
                    index={i}
                    onChange={updated => updateFamilyMember(i, updated)}
                    onRemove={() => removeFamilyMember(i)}
                  />
                ))}
                <button
                  type="button"
                  onClick={addFamilyMember}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="w-4 h-4" /> Add Family Member
                </button>
              </div>
            )}

            {/* Tab: Documents */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                {/* Uploaded documents list */}
                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <File className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{doc.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {DOC_TYPES.find(t => t.value === doc.type)?.label} · {doc.file.name} · {formatBytes(doc.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocument(i)}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add document form */}
                {showDocForm ? (
                  <div className={cn(hrInfoBannerClass, 'space-y-3 rounded-xl p-4')}>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New Document</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="mb-1 block text-xs font-medium text-muted-foreground">Document Type</Label>
                        <Select
                          className={hrInputClass}
                          value={docType}
                          onChange={setDocType}
                          options={DOC_TYPES.map(t => ({ value: t.value, label: t.label }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Label <span className="font-normal text-muted-foreground/70">(optional)</span></label>
                        <input
                          className={hrInputClass}
                          placeholder="e.g. Aadhaar Front Side"
                          value={docLabel}
                          onChange={e => setDocLabel(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">File <span className="text-red-500">*</span></label>
                      <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background transition-colors hover:border-primary hover:bg-primary/5">
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                          onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                        />
                        {docFile ? (
                          <div className="flex flex-col items-center gap-1">
                            <File className="h-6 w-6 text-primary" />
                            <p className="max-w-xs truncate text-sm font-medium text-foreground">{docFile.name}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(docFile.size)}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                            <Upload className="w-6 h-6" />
                            <p className="text-sm">Click to upload or drag & drop</p>
                            <p className="text-xs">PDF, JPG, PNG, DOCX — max 10 MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowDocForm(false); setDocFile(null); setDocLabel('') }}
                      >
                        Cancel
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            addDocument()
                            setShowDocForm(true)
                            setDocType('id_proof')
                            setDocLabel('')
                            setDocFile(null)
                          }}
                          disabled={!docFile}
                        >
                          <Plus className="h-3.5 w-3.5" /> Save &amp; Add More
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addDocument}
                          disabled={!docFile}
                        >
                          <Plus className="h-3.5 w-3.5" /> Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDocForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Upload className="w-4 h-4" /> Upload Document
                  </button>
                )}

                {documents.length === 0 && !showDocForm && (
                  <p className="-mt-2 text-center text-xs text-muted-foreground">
                    Upload ID proofs, certificates, offer letters and more.
                  </p>
                )}
              </div>
            )}

            {/* Tab: Notes */}
            {activeTab === 'notes' && (
              <div>
                <Label className={denseLabelClass}>Internal Notes</Label>
                <textarea
                  rows={5}
                  className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Any internal remarks, background context, hiring notes…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
              <Button
                type="submit"
                size="sm"
                className="h-8"
                disabled={createEmployee.isPending || !employeeFullName.trim() || (!personalEmail.trim() && !personalPhone.trim())}
              >
                {createEmployee.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {createEmployee.isPending ? 'Creating…' : 'Create Profile'}
              </Button>
            </ModalFooter>
          </form>
        </ModalPanel>
      </ModalOverlay>

      {/* Inline Dept creation — z-[60] stacks above this modal */}
      {showDeptModal && (
        <DeptModal
          departments={departments}
          onClose={() => setShowDeptModal(false)}
          onCreated={dept => { setDepartmentId(dept.id); setShowDeptModal(false) }}
        />
      )}

      {/* Inline Desig creation */}
      {showDesigModal && (
        <DesigModal
          onClose={() => setShowDesigModal(false)}
          onCreated={desig => { setDesignationId(desig.id); setShowDesigModal(false) }}
        />
      )}
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const seed = useHRSeedTestData()

  const { data, isLoading } = useHREmployees({
    department_id: deptFilter || undefined,
    status: statusFilter || undefined,
    employment_type: typeFilter || undefined,
    search: search || undefined,
  })
  const { data: departments = [] } = useHRDepartments()

  const employees: EmployeeProfile[] = data?.items ?? []
  const total: number = data?.total ?? 0

  const stats = {
    total,
    active: employees.filter(e => e.status === 'active').length,
    on_notice: employees.filter(e => e.status === 'on_notice').length,
    probation: employees.filter(e => e.status === 'probation').length,
  }

  const allEmpTypes = [...DEFAULT_EMP_TYPES, ...getCustomEmpTypes()]
  const empTypeLabel = (v: string) => allEmpTypes.find(t => t.value === v)?.label ?? v

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} total employee profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => seed.mutate(30)}
            disabled={seed.isPending}
            title="Insert 10 sample employees with 30 days of attendance data into this vendor"
            className="border-dashed"
          >
            {seed.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {seed.isPending ? 'Seeding…' : 'Seed Test Data'}
          </Button>
          <Button type="button" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'blue' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'green' },
          { label: 'On Notice', value: stats.on_notice, icon: Clock, color: 'yellow' },
          { label: 'Probation', value: stats.probation, icon: UserX, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className={cn('mb-2 inline-flex rounded-lg p-2', hrStatIconClass[color])}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(hrInputClass, 'pl-9')}
            placeholder="Search employees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          className={cn(hrSelectClass, 'min-w-[10rem]')}
          value={deptFilter}
          onChange={setDeptFilter}
          options={[
            { value: '', label: 'All Departments' },
            ...departments.map((d: HRDepartment) => ({ value: d.id, label: d.name })),
          ]}
        />
        <Select
          className={cn(hrSelectClass, 'min-w-[10rem]')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'probation', label: 'Probation' },
            { value: 'on_notice', label: 'On Notice' },
            { value: 'exited', label: 'Exited' },
          ]}
        />
        <Select
          className={cn(hrSelectClass, 'min-w-[10rem]')}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: '', label: 'All Types' },
            ...allEmpTypes.map(t => ({ value: t.value, label: t.label })),
          ]}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No employees found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={hrTableHeadClass}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"><TableColumnLabel>Employee</TableColumnLabel></th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"><TableColumnLabel>Department</TableColumnLabel></th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"><TableColumnLabel>Designation</TableColumnLabel></th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map(emp => {
                const name = employeeDisplayName(emp)
                return (
                  <tr
                    key={emp.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={onClickableTableRow(() => navigate(`/hr/employees/${emp.id}`))}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          {name[0]?.toUpperCase() ?? emp.employee_code?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{name}</p>
                          <p className="text-xs text-muted-foreground">{emp.employee_code_custom ?? emp.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{emp.designation?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {empTypeLabel(emp.employment_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[emp.status] ?? 'bg-muted text-muted-foreground')}>
                        {emp.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {emp.status !== 'exited' && (
                          <Link
                            to={`/hr/employees/${emp.id}?tab=exit`}
                            className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1"
                            title="Exit form"
                          >
                            <LogOut className="w-3.5 h-3.5" /> Exit
                          </Link>
                        )}
                        <Link to={`/hr/employees/${emp.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddEmployeeModal departments={departments} onClose={() => setShowModal(false)} />}
    </div>
  )
}
