import { useEffect, useState, useRef } from 'react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useStores } from '@/hooks/useVendor'
import type { HRAddress, HRDepartment, HRDesignation } from '@/types'

// ── Shared helpers ──────────────────────────────────────────────────────────

export const EMPTY_ADDR: HRAddress = { street: '', city: '', state: '', pincode: '', country: 'India' }

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

export function AddressFields({
  label,
  addr,
  onChange,
  editing,
}: {
  label: string
  addr: HRAddress
  onChange: (a: HRAddress) => void
  editing: boolean
}) {
  if (!editing) {
    const line = [addr.street, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(', ')
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-900">{line || <span className="text-gray-400">—</span>}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Street / House No. / Area"
        value={addr.street ?? ''}
        onChange={e => onChange({ ...addr, street: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="City" value={addr.city ?? ''} onChange={e => onChange({ ...addr, city: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="State" value={addr.state ?? ''} onChange={e => onChange({ ...addr, state: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="PIN Code" maxLength={10} value={addr.pincode ?? ''} onChange={e => onChange({ ...addr, pincode: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Country" value={addr.country ?? ''} onChange={e => onChange({ ...addr, country: e.target.value })} />
      </div>
    </div>
  )
}

// ── Identity ────────────────────────────────────────────────────────────────

export function IdentityTab({
  emp,
  editing,
  onChange,
  departments,
  designations,
}: {
  emp: Record<string, unknown>
  editing: boolean
  onChange: (data: Record<string, unknown>) => void
  departments: HRDepartment[]
  designations: HRDesignation[]
}) {
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []
  const linkedUser = (emp as { vendor_user?: { user?: { full_name?: string } } }).vendor_user?.user

  const initial = {
    full_name: String(emp.full_name ?? linkedUser?.full_name ?? ''),
    personal_email: String(emp.personal_email ?? ''),
    personal_phone: String(emp.personal_phone ?? ''),
    employee_code_custom: String(emp.employee_code_custom ?? ''),
    store_id: String(emp.store_id ?? ''),
    department_id: String(emp.department_id ?? ''),
    designation_id: String(emp.designation_id ?? ''),
    employment_type: String(emp.employment_type ?? 'full_time'),
    date_of_joining: String(emp.date_of_joining ?? ''),
    probation_end_date: String(emp.probation_end_date ?? ''),
    notice_period_days: Number(emp.notice_period_days ?? 30),
    lwd: String(emp.lwd ?? ''),
    status: String(emp.status ?? 'active'),
  }

  const [form, setForm] = useState(initial)
  const [empIdMode, setEmpIdMode] = useState<'auto' | 'manual'>(
    emp.employee_code_custom ? 'manual' : 'auto',
  )
  const manualInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm(initial)
    setEmpIdMode(emp.employee_code_custom ? 'manual' : 'auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp])

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    const next = { ...form, [field]: value }
    setForm(next)
    onChange({
      ...next,
      notice_period_days: Number(next.notice_period_days) || 30,
      store_id: next.store_id || null,
      department_id: next.department_id || null,
      designation_id: next.designation_id || null,
    })
  }

  const empT = emp as {
    store?: { name?: string }
    department?: { name?: string }
    designation?: { name?: string }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <FieldRow label="Full name" editing={editing} display={String(emp.full_name ?? linkedUser?.full_name ?? '')}>
        <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.full_name} onChange={e => update('full_name', e.target.value)} />
      </FieldRow>
      <FieldRow label="Personal email" editing={editing} display={String(emp.personal_email ?? '')}>
        <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.personal_email} onChange={e => update('personal_email', e.target.value)} />
      </FieldRow>
      <FieldRow label="Personal phone" editing={editing} display={String(emp.personal_phone ?? '')}>
        <PhoneInput value={form.personal_phone} onChange={v => update('personal_phone', v)} defaultCountryIso="IN" />
      </FieldRow>
      {/* Employee ID — toggle between auto (system code) and manual (custom code) */}
      <div className="col-span-1">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-500">Employee ID</label>
          {editing && (
            <div className="flex bg-gray-100 rounded-md p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setEmpIdMode('auto')
                  update('employee_code_custom', '')
                }}
                className={`px-2 py-0.5 rounded transition-colors ${empIdMode === 'auto' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmpIdMode('manual')
                  setTimeout(() => manualInputRef.current?.focus(), 50)
                }}
                className={`px-2 py-0.5 rounded transition-colors ${empIdMode === 'manual' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Manual
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <p className="text-sm font-mono text-gray-900">
            {String(emp.employee_code_custom || emp.employee_code || '') || <span className="text-gray-400">—</span>}
          </p>
        ) : empIdMode === 'manual' ? (
          <input
            ref={manualInputRef}
            className="w-full border border-blue-400 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            placeholder="e.g. Hyd001"
            value={form.employee_code_custom}
            onChange={e => update('employee_code_custom', e.target.value)}
          />
        ) : (
          <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 select-none">
            <span className="font-medium">{String(emp.employee_code ?? '—')}</span>
            <span className="text-gray-400 text-xs ml-auto">auto</span>
          </div>
        )}
      </div>
      <FieldRow label="Employer / entity" editing={editing} display={empT.store?.name ?? ''}>
        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.store_id} onChange={e => update('store_id', e.target.value)}>
          <option value="">— No specific entity —</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` · ${s.code}` : ''}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Department" editing={editing} display={empT.department?.name ?? ''}>
        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.department_id} onChange={e => update('department_id', e.target.value)}>
          <option value="">— None —</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Designation" editing={editing} display={empT.designation?.name ?? ''}>
        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.designation_id} onChange={e => update('designation_id', e.target.value)}>
          <option value="">— None —</option>
          {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Employment type" editing={editing} display={String(emp.employment_type ?? '').replace('_', '-')}>
        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.employment_type} onChange={e => update('employment_type', e.target.value)}>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </select>
      </FieldRow>
      <FieldRow label="Status" editing={editing} display={String(emp.status ?? '').replace('_', ' ')}>
        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.status} onChange={e => update('status', e.target.value)}>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="on_notice">On Notice</option>
          <option value="exited">Exited</option>
        </select>
      </FieldRow>
      <FieldRow label="Date of joining" editing={editing} display={String(emp.date_of_joining ?? '')}>
        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.date_of_joining} onChange={e => update('date_of_joining', e.target.value)} />
      </FieldRow>
      <FieldRow label="Probation end" editing={editing} display={String(emp.probation_end_date ?? '')}>
        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.probation_end_date} onChange={e => update('probation_end_date', e.target.value)} />
      </FieldRow>
      <FieldRow label="Last working day" editing={editing} display={String(emp.lwd ?? '')}>
        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.lwd} onChange={e => update('lwd', e.target.value)} />
      </FieldRow>
      <FieldRow label="Notice period (days)" editing={editing} display={String(emp.notice_period_days ?? 30)}>
        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.notice_period_days} onChange={e => update('notice_period_days', Number(e.target.value))} />
      </FieldRow>
    </div>
  )
}
