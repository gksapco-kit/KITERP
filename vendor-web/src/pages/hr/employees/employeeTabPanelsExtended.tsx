import { useEffect, useRef, useState } from 'react'
import {
  Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Link2, Loader2,
  LogIn, Mail, Plus, RefreshCw, Share2, ShieldCheck, Trash2, X,
} from 'lucide-react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useGenerateEmployeeOtp, useSetHREmployeePortalPassword } from '@/hooks/useVendor'
import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { useVendorStore } from '@/stores/vendorStore'
import type { FamilyMember, HRAddress } from '@/types'
import { toast } from 'sonner'
import { EMPTY_ADDR, AddressFields } from './EmployeeMasterTabPanels'

// ── tiny copy-to-clipboard hook ────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }
  return { copied, copy }
}

function CopyBtn({ text, id, copied, copy }: { text: string; id: string; copied: string | null; copy: (t: string, id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => copy(text, id)}
      className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
      title="Copy"
    >
      {copied === id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied === id ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── display helper ─────────────────────────────────────────────────────────

function FieldRow({
  label,
  editing,
  children,
  display,
}: {
  label: string
  editing: boolean
  children: React.ReactNode
  display: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {editing ? children : <p className="text-sm text-gray-900">{display || <span className="text-gray-400">—</span>}</p>}
    </div>
  )
}

// ── Addresses ──────────────────────────────────────────────────────────────

export function AddressesTab({
  emp,
  editing,
  onChange,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
}) {
  const initCurrent = { ...EMPTY_ADDR, ...((emp.current_address as HRAddress) ?? {}) }
  const initPermanent = { ...EMPTY_ADDR, ...((emp.permanent_address as HRAddress) ?? {}) }
  const [current, setCurrent] = useState<HRAddress>(initCurrent)
  const [permanent, setPermanent] = useState<HRAddress>(initPermanent)
  const [sameAsCurrent, setSameAsCurrent] = useState(
    JSON.stringify(emp.current_address ?? {}) === JSON.stringify(emp.permanent_address ?? {}),
  )

  useEffect(() => {
    setCurrent({ ...EMPTY_ADDR, ...((emp.current_address as HRAddress) ?? {}) })
    setPermanent({ ...EMPTY_ADDR, ...((emp.permanent_address as HRAddress) ?? {}) })
  }, [emp])

  function emitCurrent(a: HRAddress) {
    setCurrent(a)
    onChange({ current_address: a, permanent_address: sameAsCurrent ? a : permanent })
  }
  function emitPermanent(a: HRAddress) {
    setPermanent(a)
    onChange({ current_address: current, permanent_address: a })
  }
  function toggleSame(v: boolean) {
    setSameAsCurrent(v)
    onChange({ current_address: current, permanent_address: v ? current : permanent })
  }

  return (
    <div className="space-y-6">
      <AddressFields label="Current address" addr={current} onChange={emitCurrent} editing={editing} />
      {editing && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={sameAsCurrent} onChange={e => toggleSame(e.target.checked)} className="rounded" />
          Permanent address same as current
        </label>
      )}
      {!sameAsCurrent && (
        <AddressFields label="Permanent address" addr={permanent} onChange={emitPermanent} editing={editing} />
      )}
    </div>
  )
}

// ── Bank ───────────────────────────────────────────────────────────────────

type BankForm = { bank_name: string; account_holder_name: string; account_number: string; account_type: string; ifsc_code: string }

export function BankTab({
  emp,
  editing,
  onChange,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
}) {
  const initial: BankForm = {
    bank_name: String(emp.bank_name ?? ''),
    account_holder_name: String(emp.account_holder_name ?? ''),
    account_number: String(emp.account_number ?? ''),
    account_type: String(emp.account_type ?? 'savings'),
    ifsc_code: String(emp.ifsc_code ?? ''),
  }
  const [form, setForm] = useState<BankForm>(initial)
  useEffect(() => { setForm(initial) }, [emp]) // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof BankForm>(k: K, v: BankForm[K]) {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange(next)
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <FieldRow label="Bank name" editing={editing} display={form.bank_name}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.bank_name} onChange={e => update('bank_name', e.target.value)} placeholder="e.g. State Bank of India" />
      </FieldRow>
      <FieldRow label="Account type" editing={editing} display={form.account_type}>
        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.account_type} onChange={e => update('account_type', e.target.value)}>
          <option value="savings">Savings</option>
          <option value="current">Current</option>
        </select>
      </FieldRow>
      <FieldRow label="Account holder" editing={editing} display={form.account_holder_name}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.account_holder_name} onChange={e => update('account_holder_name', e.target.value)} placeholder="As per bank records" />
      </FieldRow>
      <FieldRow label="Account number" editing={editing} display={form.account_number}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={form.account_number} onChange={e => update('account_number', e.target.value.replace(/\D/g, ''))} />
      </FieldRow>
      <FieldRow label="IFSC code" editing={editing} display={form.ifsc_code}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none" maxLength={11} value={form.ifsc_code} onChange={e => update('ifsc_code', e.target.value.toUpperCase())} />
      </FieldRow>
    </div>
  )
}

// ── KYC ───────────────────────────────────────────────────────────────────

type KycForm = { pan_number: string; aadhaar_number: string; uan_number: string; esi_number: string }

export function KycTab({
  emp,
  editing,
  onChange,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
}) {
  const initial: KycForm = {
    pan_number: String(emp.pan_number ?? ''),
    aadhaar_number: String(emp.aadhaar_number ?? ''),
    uan_number: String(emp.uan_number ?? ''),
    esi_number: String(emp.esi_number ?? ''),
  }
  const [form, setForm] = useState<KycForm>(initial)
  useEffect(() => { setForm(initial) }, [emp]) // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof KycForm>(k: K, v: KycForm[K]) {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange(next)
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <FieldRow label="PAN number" editing={editing} display={form.pan_number}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none" maxLength={10} placeholder="ABCDE1234F" value={form.pan_number} onChange={e => update('pan_number', e.target.value.toUpperCase())} />
      </FieldRow>
      <FieldRow label="Aadhaar number" editing={editing} display={form.aadhaar_number}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" maxLength={12} placeholder="12 digits" value={form.aadhaar_number} onChange={e => update('aadhaar_number', e.target.value.replace(/\D/g, '').slice(0, 12))} />
      </FieldRow>
      <FieldRow label="UAN (PF)" editing={editing} display={form.uan_number}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={form.uan_number} onChange={e => update('uan_number', e.target.value)} />
      </FieldRow>
      <FieldRow label="ESI number" editing={editing} display={form.esi_number}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={form.esi_number} onChange={e => update('esi_number', e.target.value)} />
      </FieldRow>
    </div>
  )
}

// ── Personal ──────────────────────────────────────────────────────────────

type PersonalForm = {
  date_of_birth: string; gender: string; blood_group: string
  marital_status: string; nationality: string
  emergency_contact_name: string; emergency_contact_phone: string; emergency_contact_relation: string
}

export function EmployeePersonalTab({
  emp,
  editing,
  onChange,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
}) {
  const initial: PersonalForm = {
    date_of_birth: String(emp.date_of_birth ?? ''),
    gender: String(emp.gender ?? ''),
    blood_group: String(emp.blood_group ?? ''),
    marital_status: String(emp.marital_status ?? ''),
    nationality: String(emp.nationality ?? 'Indian'),
    emergency_contact_name: String(emp.emergency_contact_name ?? ''),
    emergency_contact_phone: String(emp.emergency_contact_phone ?? ''),
    emergency_contact_relation: String(emp.emergency_contact_relation ?? ''),
  }
  const [form, setForm] = useState<PersonalForm>(initial)
  useEffect(() => { setForm(initial) }, [emp]) // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof PersonalForm>(k: K, v: PersonalForm[K]) {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange(next)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FieldRow label="Date of birth" editing={editing} display={form.date_of_birth}>
          <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
        </FieldRow>
        <FieldRow label="Gender" editing={editing} display={form.gender}>
          <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.gender} onChange={e => update('gender', e.target.value)}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </FieldRow>
        <FieldRow label="Blood group" editing={editing} display={form.blood_group}>
          <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.blood_group} onChange={e => update('blood_group', e.target.value)}>
            <option value="">—</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Marital status" editing={editing} display={form.marital_status}>
          <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.marital_status} onChange={e => update('marital_status', e.target.value)}>
            <option value="">—</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </FieldRow>
        <FieldRow label="Nationality" editing={editing} display={form.nationality}>
          <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.nationality} onChange={e => update('nationality', e.target.value)} />
        </FieldRow>
      </div>
      <div className="pt-4 border-t">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Emergency contact</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FieldRow label="Name" editing={editing} display={form.emergency_contact_name}>
            <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.emergency_contact_name} onChange={e => update('emergency_contact_name', e.target.value)} />
          </FieldRow>
          <FieldRow label="Phone" editing={editing} display={form.emergency_contact_phone}>
            <PhoneInput value={form.emergency_contact_phone} onChange={v => update('emergency_contact_phone', v)} defaultCountryIso="IN" />
          </FieldRow>
          <FieldRow label="Relation" editing={editing} display={form.emergency_contact_relation}>
            <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Spouse, Parent" value={form.emergency_contact_relation} onChange={e => update('emergency_contact_relation', e.target.value)} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}

// ── Family ─────────────────────────────────────────────────────────────────

export function FamilyTab({
  emp,
  editing,
  onChange,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
}) {
  const [members, setMembers] = useState<FamilyMember[]>((emp.family_members as FamilyMember[]) ?? [])

  useEffect(() => {
    setMembers((emp.family_members as FamilyMember[]) ?? [])
  }, [emp])

  function setAndEmit(next: FamilyMember[]) {
    setMembers(next)
    onChange({ family_members: next })
  }

  return (
    <div className="space-y-3">
      {members.length === 0 && <p className="text-sm text-gray-400 text-center py-3">No family members recorded.</p>}
      {members.map((m, i) => (
        <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">Member {i + 1}</span>
            {editing && (
              <button type="button" onClick={() => setAndEmit(members.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(['name', 'relation', 'phone'] as const).map(field => (
              <div key={field}>
                <p className="text-xs text-gray-500 mb-0.5 capitalize">{field}</p>
                {editing ? (
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={m[field] ?? ''} onChange={e => setAndEmit(members.map((f, idx) => idx === i ? { ...f, [field]: e.target.value } : f))} />
                ) : (
                  <p className="text-sm text-gray-900">{m[field] || <span className="text-gray-400">—</span>}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {editing && (
        <button type="button" onClick={() => setAndEmit([...members, { name: '', relation: '', dob: '', phone: '', gender: '', blood_group: '' }])} className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Plus className="w-4 h-4" /> Add family member
        </button>
      )}
    </div>
  )
}

// ── Notes ──────────────────────────────────────────────────────────────────

export function NotesTab({
  emp,
  editing,
  onChange,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
}) {
  const [notes, setNotes] = useState(String(emp.notes ?? ''))
  useEffect(() => { setNotes(String(emp.notes ?? '')) }, [emp])

  function handleChange(v: string) {
    setNotes(v)
    onChange({ notes: v })
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Internal notes</label>
      {editing ? (
        <textarea rows={6} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Internal remarks, hiring notes…" value={notes} onChange={e => handleChange(e.target.value)} />
      ) : (
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{notes || <span className="text-gray-400">—</span>}</p>
      )}
    </div>
  )
}

// ── Credentials ────────────────────────────────────────────────────────────

export function ShareDropdown({
  hrPortalUrl,
  loginEmail,
  loginAliases,
  displayName,
  otp,
}: {
  hrPortalUrl: string
  loginEmail: string
  loginAliases: string[]
  displayName: string
  otp?: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function buildMessage() {
    const activeOtp = (otp ?? '').trim()
    return [
      `Hi ${displayName},`,
      '',
      'Here are your HR portal login details:',
      `Portal URL: ${hrPortalUrl}`,
      loginEmail ? `Username / Email: ${loginEmail}` : '',
      loginAliases.length ? `Employee code: ${loginAliases.join(' or ')}` : '',
      activeOtp ? `One-time password: ${activeOtp}` : '',
      '',
      activeOtp
        ? 'Use the one-time password above to sign in. You will be prompted to set a new permanent password on first login.'
        : 'Use the password set by your HR admin to sign in. Contact HR if you need a password reset.',
    ].filter(l => l !== null && l !== '').join('\n')
  }

  /** Plain key-value list of every credential field (for admin clipboard). */
  function buildCredentialsText() {
    const activeOtp = (otp ?? '').trim()
    return [
      'HR Portal Credentials',
      '',
      displayName ? `Name: ${displayName}` : null,
      `Portal URL: ${hrPortalUrl}`,
      loginEmail ? `Work email: ${loginEmail}` : null,
      loginAliases.length ? `Employee code: ${loginAliases.join(' / ')}` : null,
      activeOtp ? `One-time password: ${activeOtp}` : 'One-time password: (not set)',
    ].filter((line): line is string => line != null).join('\n')
  }

  function copyAll() {
    navigator.clipboard.writeText(buildMessage())
    toast.success('Access details copied')
    setOpen(false)
  }

  function copyCredentials() {
    navigator.clipboard.writeText(buildCredentialsText())
    toast.success('Credentials copied')
    setOpen(false)
  }

  function shareEmail() {
    const subject = encodeURIComponent('Your HR Portal Access Details')
    const body = encodeURIComponent(buildMessage())
    window.open(`mailto:${loginEmail}?subject=${subject}&body=${body}`)
    setOpen(false)
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage())}`)
    setOpen(false)
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share access
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-56 bg-white border rounded-xl shadow-lg z-50 py-1 text-sm">
            <button type="button" onClick={copyAll} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
              <Copy className="w-3.5 h-3.5 text-gray-400" /> Copy access message
            </button>
            <button type="button" onClick={copyCredentials} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
              <KeyRound className="w-3.5 h-3.5 text-gray-400" /> Copy credentials
            </button>
            {loginEmail && (
              <button type="button" onClick={shareEmail} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
                <Mail className="w-3.5 h-3.5 text-gray-400" /> Send via email
              </button>
            )}
            <button type="button" onClick={shareWhatsApp} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L.057 23.93l6.225-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.799 9.799 0 01-4.988-1.362l-.358-.213-3.695.97.985-3.597-.234-.371A9.817 9.817 0 012.182 12C2.182 6.591 6.591 2.182 12 2.182S21.818 6.591 21.818 12 17.409 21.818 12 21.818z"/></svg>
              Send via WhatsApp
            </button>
          </div>
        )}
      </div>

    </>
  )
}

export function EmployeeCredentialsTab({
  emp,
  editing,
  onSave,
  empId,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onSave: (data: Record<string, unknown>) => void
  empId: string
}) {
  const setPortalPw = useSetHREmployeePortalPassword()
  const generateOtp = useGenerateEmployeeOtp()
  const { copied, copy } = useCopy()

  const [posPin, setPosPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [otpVisible, setOtpVisible] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const userObj = (emp as { vendor_user?: { user?: { email?: string; portal_temp_password?: string | null; portal_temp_password_expires_at?: string | null } } }).vendor_user?.user
  const loginEmail = (userObj?.email ?? '').trim()
  const storedOtp = (userObj?.portal_temp_password ?? '').trim()
  const otpExpiresAt = userObj?.portal_temp_password_expires_at ? new Date(userObj.portal_temp_password_expires_at) : null
  const otpExpired = otpExpiresAt ? otpExpiresAt < new Date() : false
  function otpExpiryLabel() {
    if (!otpExpiresAt) return null
    const diff = otpExpiresAt.getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h >= 24) return `Expires in ${Math.floor(h / 24)}d ${h % 24}h`
    if (h > 0) return `Expires in ${h}h ${m}m`
    return `Expires in ${m}m`
  }
  const codeCustom = String(emp.employee_code_custom ?? '').trim()
  const codeAuto = String(emp.employee_code ?? '').trim()
  const displayName = String(emp.full_name ?? '').trim() || codeAuto
  const loginAliases = [...new Set([codeCustom, codeAuto].filter(Boolean))]
  const hasPin = Boolean((emp as { pos_pin_hash?: string }).pos_pin_hash)
  const hasPortalAccess = Boolean(userObj)
  const vendorSlug = useVendorStore(s => s.vendor?.slug ?? '')

  const hrPortalUrl = vendorSlug
    ? `${getStorefrontAppOrigin()}/store/${encodeURIComponent(vendorSlug)}/hr/login`
    : `${getStorefrontAppOrigin()}/hr/login`

  async function handlePortalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    await setPortalPw.mutateAsync({ id: String(emp.id), password })
    toast.success('Portal password updated')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleGenerateOtp() {
    await generateOtp.mutateAsync(empId)
    // The employee query will be invalidated by the hook, re-fetching emp with the new OTP
  }

  function savePin() {
    if (posPin.length < 4) return
    onSave({ pos_pin: posPin })
    setPosPin('')
    toast.success('POS PIN updated')
  }

  return (
    <div className="space-y-8">

      {/* ── HR / ESS portal ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-gray-900">HR / ESS Portal</h3>
          </div>
          {hasPortalAccess && (
            <ShareDropdown
              hrPortalUrl={hrPortalUrl}
              loginEmail={loginEmail}
              loginAliases={loginAliases}
              displayName={displayName}
              otp={storedOtp || null}
            />
          )}
        </div>

        {/* Generate OTP + Copy OTP — above the portal link (always shown so HR can auto-provision access) */}
        <div className="mb-3 max-w-lg flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateOtp}
              disabled={generateOtp.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {generateOtp.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {storedOtp ? 'Regenerate one-time password' : 'Generate one-time password'}
            </button>
            {storedOtp && !otpExpired && (
              <button
                type="button"
                onClick={() => copy(storedOtp, 'otp-quick')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                {copied === 'otp-quick'
                  ? <><span className="text-green-600 text-xs">✓ Copied</span></>
                  : <><Copy className="w-3.5 h-3.5" /> Copy OTP</>}
              </button>
            )}
        </div>

        {/* Active OTP display — shown when OTP exists */}
        {storedOtp && (
          <div className={`rounded-xl border mb-4 max-w-lg ${otpExpired ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className={`flex items-center gap-2 px-4 py-3 border-b ${otpExpired ? 'border-red-200' : 'border-amber-200'}`}>
              <ShieldCheck className={`w-4 h-4 ${otpExpired ? 'text-red-500' : 'text-amber-600'}`} />
              <span className="text-sm font-semibold text-gray-900">One-time login password</span>
              {otpExpired
                ? <span className="text-xs px-1.5 py-0.5 bg-red-200 text-red-800 rounded-full font-semibold uppercase tracking-wide">Expired</span>
                : <span className="text-xs px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full font-semibold uppercase tracking-wide">Active</span>}
              {otpExpiryLabel() && !otpExpired && (
                <span className="ml-auto text-xs text-amber-700">{otpExpiryLabel()}</span>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <p className={`text-xl font-mono font-bold tracking-widest flex-1 select-all ${otpExpired ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {otpVisible ? storedOtp : '•'.repeat(storedOtp.length)}
                </p>
                <button type="button" onClick={() => setOtpVisible(v => !v)} className="text-gray-400 hover:text-gray-700 shrink-0">
                  {otpVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {!otpExpired && <CopyBtn text={storedOtp} id="otp" copied={copied} copy={copy} />}
              </div>
              <p className={`text-xs mt-1.5 ${otpExpired ? 'text-red-600' : 'text-amber-700'}`}>
                {otpExpired
                  ? 'This OTP has expired. Click Regenerate to issue a new one.'
                  : 'Active until the employee logs in or you regenerate. Valid for 72 hours.'}
              </p>
            </div>
          </div>
        )}

        {/* Portal URL */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 flex items-center gap-2 mb-4 max-w-lg">
          <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <p className="text-sm font-mono text-blue-600 flex-1 truncate">{hrPortalUrl}</p>
          <CopyBtn text={hrPortalUrl} id="portal-url" copied={copied} copy={copy} />
        </div>

        {!hasPortalAccess ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 max-w-lg">
            No linked user account. Grant portal access from <strong>Staff Access Control</strong> to enable password management.
          </div>
        ) : (
          <>
            {/* Login identifiers */}
            <div className="grid gap-2 max-w-lg mb-6">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-0.5">Work email (login)</p>
                  <p className="text-sm font-mono text-gray-900 truncate">{loginEmail || '—'}</p>
                </div>
                {loginEmail && <CopyBtn text={loginEmail} id="login-email" copied={copied} copy={copy} />}
              </div>
              {loginAliases.length > 0 && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-0.5">Employee code(s) (login)</p>
                    <p className="text-sm font-mono text-gray-900">{loginAliases.join(' · ')}</p>
                  </div>
                  <CopyBtn text={loginAliases.join(', ')} id="emp-codes" copied={copied} copy={copy} />
                </div>
              )}
            </div>

            {/* Manual password set/reset */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Set / reset portal password</p>
            <form onSubmit={handlePortalSubmit} className="max-w-md space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
                <input type="password" autoComplete="new-password" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Minimum 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
                <input type="password" autoComplete="new-password" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={setPortalPw.isPending || !password || !confirmPassword} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {setPortalPw.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Update portal password
              </button>
            </form>
          </>
        )}
      </section>

      {/* ── POS PIN ── */}
      <section className="pt-6 border-t">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-gray-900">POS PIN</h3>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-2 h-2 rounded-full ${hasPin ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm text-gray-600">{hasPin ? 'PIN configured' : 'No POS PIN set'}</span>
        </div>
        <div className="flex items-end gap-3 max-w-xs">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">{hasPin ? 'Change PIN' : 'Set PIN'} (4–6 digits)</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-9 tracking-widest"
                placeholder="● ● ● ●"
                value={posPin}
                onChange={e => setPosPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button type="button" onClick={() => setShowPin(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="button" disabled={posPin.length < 4} onClick={savePin} className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 mb-0.5">
            Save PIN
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Used for quick POS terminal login — stored securely.</p>
      </section>
    </div>
  )
}
