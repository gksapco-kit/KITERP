import { useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useContacts } from '@/hooks/useCrm'
import { useTeamMembers } from '@/hooks/useVendor'
import type { EmployeeProfile, TeamMember } from '@/types'
import { Search } from 'lucide-react'
import { Field } from './_shared'
import { contactDisplayName } from './crmContactsShared'

export const PARTICIPANT_TYPES = [
  { id: '', label: 'None' },
  { id: 'customer', label: 'Customer' },
  { id: 'internal', label: 'Internal' },
  { id: 'external', label: 'External' },
]

export const inputCls = 'flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm'

export function empDisplayName(e: EmployeeProfile) {
  return e.vendor_user?.user?.full_name ?? e.full_name ?? e.employee_code
}

export function empEmail(e: EmployeeProfile) {
  return e.vendor_user?.user?.email ?? e.personal_email ?? ''
}

export function empOptionLabel(e: EmployeeProfile) {
  const name = empDisplayName(e)
  const email = empEmail(e)
  return email ? `${name} · ${email}` : name
}

export function findMyEmployee(
  employees: EmployeeProfile[],
  user: { id?: string; email?: string } | null | undefined,
  membershipUserId?: string | null,
) {
  if (!employees.length || !user) return undefined
  return employees.find(e =>
    e.vendor_user?.user?.id === user.id
    || e.vendor_user?.user?.email === user.email
    || (membershipUserId && e.vendor_user?.user?.id === membershipUserId),
  )
}

export function appendCommaNames(existing: string, name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return existing
  const parts = existing.split(',').map(s => s.trim()).filter(Boolean)
  const key = trimmed.toLowerCase()
  if (parts.some(p => p.toLowerCase() === key || p.toLowerCase().startsWith(key + ' ·'))) return existing
  return [...parts, trimmed].join(', ')
}

type PickerPerson = { id: string; name: string; email: string; label: string }

function buildPickerPeople(employees: EmployeeProfile[], teamMembers: TeamMember[]): PickerPerson[] {
  const people: PickerPerson[] = []
  const seen = new Set<string>()

  const push = (id: string, name: string, email: string) => {
    if (!name.trim()) return
    const key = (email || id).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const label = email ? `${name} · ${email}` : name
    people.push({ id, name, email, label })
  }

  for (const e of employees) {
    push(e.id, empDisplayName(e), empEmail(e))
  }
  for (const m of teamMembers) {
    if (!m.user_id) continue
    const name = m.user?.full_name || m.user?.email || m.role_name || ''
    const email = m.user?.email || ''
    push(m.user_id, name, email)
  }

  return people.sort((a, b) => a.name.localeCompare(b.name))
}

function personMatchesFilter(p: PickerPerson, q: string): boolean {
  if (!q) return true
  const hay = `${p.name} ${p.email} ${p.label}`.toLowerCase()
  return hay.includes(q.toLowerCase())
}

function ForValueControl({
  ptype, value, externalName, onSelect, onExternal, required,
}: {
  ptype: string
  value: string
  externalName: string
  onSelect: (v: string) => void
  onExternal: (v: string) => void
  required?: boolean
}) {
  const companies = useContacts({ record_type: 'company', size: 100 })
  const people = useContacts({ record_type: 'person', size: 100 })
  const team = useTeamMembers({ size: 100 })

  if (ptype === 'external') {
    return (
      <Input
        value={externalName}
        onChange={e => onExternal(e.target.value)}
        placeholder="Name"
        className="h-9"
        required={required}
      />
    )
  }

  let options: { value: string; label: string }[] = []
  let loading = false
  if (ptype === 'customer') {
    loading = companies.isLoading || people.isLoading
    options = [
      ...(companies.data?.items ?? []).map(c => ({
        value: `account:${c.linked_account_id || c.id}`,
        label: c.first_name,
      })),
      ...(people.data?.items ?? []).map(c => ({
        value: `contact:${c.id}`,
        label: contactDisplayName(c) || c.email || 'Contact',
      })),
    ]
  } else if (ptype === 'internal') {
    loading = team.isLoading
    options = (team.data?.items ?? [])
      .filter(m => m.user_id)
      .map(m => ({ value: m.user_id!, label: m.user?.full_name || m.user?.email || m.role_name || 'Member' }))
  }

  const selected = options.find(o => o.value === value)

  return (
    <Select
      value={value}
      onChange={onSelect}
      disabled={!ptype || loading}
      options={[
        { value: '', label: !ptype ? '—' : loading ? 'Loading…' : 'Select…' },
        ...(value && !selected ? [{ value, label: value.includes(':') ? 'Selected record' : value }] : []),
        ...options,
      ]}
      placeholder={!ptype ? '—' : loading ? 'Loading…' : 'Select…'}
      aria-label="Participant record"
      className={inputCls}
    />
  )
}

/** Validate For | Record | Responsible based on participant type selection. */
export function validateCrmPeopleRow(values: {
  participant_type: string
  participant_value: string
  participant_external: string
  responsible: string
}): string | null {
  const { participant_type: ptype } = values
  if (!ptype) return null

  if (ptype === 'customer' && !values.participant_value.trim()) {
    return 'Select a customer record'
  }
  if (ptype === 'internal' && !values.participant_value.trim()) {
    return 'Select an internal assignee'
  }
  if (ptype === 'external' && !values.participant_external.trim()) {
    return 'Enter the external participant name'
  }
  if (!values.responsible.trim()) {
    return 'Select a responsible person'
  }
  return null
}

/** For | Record | Responsible — one compact row */
export function CrmPeopleRow({
  participantType, participantValue, participantExternal,
  onParticipantTypeChange, onParticipantValue, onParticipantExternal,
  responsible, onResponsible, meName, employees,
}: {
  participantType: string
  participantValue: string
  participantExternal: string
  onParticipantTypeChange: (v: string) => void
  onParticipantValue: (v: string) => void
  onParticipantExternal: (v: string) => void
  responsible: string
  onResponsible: (v: string) => void
  meName: string
  employees: EmployeeProfile[]
}) {
  const recordLabel = participantType === 'external' ? 'Name'
    : participantType === 'internal' ? 'Assignee'
      : participantType === 'customer' ? 'Record' : 'Record'

  const recordRequired = !!participantType
  const responsibleRequired = !!participantType

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Field label="For">
        <Select
          value={participantType}
          onChange={onParticipantTypeChange}
          options={PARTICIPANT_TYPES.map(r => ({ value: r.id, label: r.label }))}
          aria-label="Participant type"
          className={inputCls}
        />
      </Field>
      <Field label={recordLabel} required={recordRequired}>
        <ForValueControl
          ptype={participantType}
          value={participantValue}
          externalName={participantExternal}
          onSelect={onParticipantValue}
          onExternal={onParticipantExternal}
          required={recordRequired}
        />
      </Field>
      <Field label="Responsible" required={responsibleRequired}>
        <Select
          value={responsible}
          onChange={onResponsible}
          options={[
            { value: meName, label: `${meName} (me)` },
            ...employees.filter(e => empDisplayName(e) !== meName).map(e => ({
              value: empDisplayName(e),
              label: empDisplayName(e),
            })),
          ]}
          aria-label="Responsible person"
          className={inputCls}
        />
      </Field>
    </div>
  )
}

/** Monitor | Also watch — one compact row */
export function MonitorSection({
  managerId, additional, employees, onManager, onAdditional,
}: {
  managerId: string
  additional: string
  employees: EmployeeProfile[]
  onManager: (id: string) => void
  onAdditional: (v: string) => void
}) {
  const team = useTeamMembers({ size: 100 })
  const [filterQuery, setFilterQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)

  const pickerPeople = useMemo(
    () => buildPickerPeople(employees, team.data?.items ?? []),
    [employees, team.data?.items],
  )

  const watched = additional.split(',').map(s => s.trim()).filter(Boolean)

  const addWatcher = (label: string) => {
    const next = appendCommaNames(additional, label)
    if (next !== additional) onAdditional(next)
    setFilterQuery('')
    setListOpen(false)
  }

  const removeWatcher = (label: string) => {
    onAdditional(watched.filter(n => n !== label).join(', '))
  }

  const available = pickerPeople.filter(p =>
    p.id !== managerId
    && !watched.some(w => w.toLowerCase() === p.label.toLowerCase() || w.toLowerCase().startsWith(p.name.toLowerCase() + ' ·'))
    && personMatchesFilter(p, filterQuery),
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Field label="Monitor">
        <Select
          value={managerId}
          onChange={onManager}
          options={selectOptionsWithBlank('— None —', employees.map(e => ({
            value: e.id,
            label: empOptionLabel(e),
          })))}
          placeholder="— None —"
          aria-label="Monitor"
          className={inputCls}
        />
      </Field>
      <Field label="Also watch">
        <div className="space-y-1.5">
          <div className="relative">
            <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-input text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                ref={filterRef}
                value={filterQuery}
                onChange={e => { setFilterQuery(e.target.value); setListOpen(true) }}
                onFocus={() => setListOpen(true)}
                onBlur={() => setTimeout(() => setListOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setFilterQuery(''); setListOpen(false) }
                  if (e.key === 'Enter' && available[0]) { e.preventDefault(); addWatcher(available[0].label) }
                }}
                placeholder="+ Add — search name or mail ID"
                className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-0"
              />
            </div>
            {listOpen && available.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-input bg-background py-1 shadow-md">
                {available.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-gray-50"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => addWatcher(p.label)}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.email && <span className="text-gray-500"> · {p.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {watched.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {watched.map(label => {
                const emailIdx = label.indexOf(' · ')
                const name = emailIdx >= 0 ? label.slice(0, emailIdx) : label
                const email = emailIdx >= 0 ? label.slice(emailIdx + 3) : ''
                return (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 max-w-full"
                    title={email || label}
                  >
                    <span className="truncate">
                      <span className="font-medium">{name}</span>
                      {email && <span className="text-gray-500"> · {email}</span>}
                    </span>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-700 leading-none shrink-0"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeWatcher(label)}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </Field>
    </div>
  )
}

/** @deprecated use CrmPeopleRow — kept for any external imports */
export function CrmForValueField(props: {
  labelPrefix: string
  ptype: string
  value: string
  externalName: string
  onSelect: (v: string) => void
  onExternal: (v: string) => void
}) {
  const label = props.ptype === 'external' ? 'Name'
    : props.ptype === 'internal' ? 'Assignee'
      : props.ptype === 'customer' ? 'Record' : 'Record'
  return (
    <Field label={label}>
      <ForValueControl {...props} />
    </Field>
  )
}
