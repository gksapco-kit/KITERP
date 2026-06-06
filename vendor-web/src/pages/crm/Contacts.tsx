import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useContacts, useSaveContact } from '@/hooks/useCrm'
import { useTeamMembers } from '@/hooks/useVendor'
import type { Contact } from '@/api/crm'
import { Plus, Loader2, UserPlus, Mail, Phone, Pencil, Building2, User } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { COUNTRY_CODES, splitPhone, useCrmExtras, CrmExtrasView } from './crmExtras'
import { SALUTATIONS, contactDisplayName, inputCls } from './crmContactsShared'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type RecordFilter = '' | 'person' | 'company'

function SalesPersonSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const team = useTeamMembers({ size: 100 })
  const members = team.data?.items ?? []
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      <option value="">— None —</option>
      {members.filter(m => m.user_id).map(m => (
        <option key={m.user_id} value={m.user_id!}>
          {m.user?.full_name || m.user?.email || m.role_name || 'Member'}
        </option>
      ))}
    </select>
  )
}

function ContactPersonsSection({ companyId }: { companyId: string }) {
  const { data, isLoading } = useContacts({ parent_contact_id: companyId, size: 50 })
  const [adding, setAdding] = useState(false)

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact persons</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add person
        </Button>
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : !data?.items?.length ? (
        <p className="text-xs text-gray-400">No contact persons yet.</p>
      ) : (
        <ul className="divide-y">
          {data.items.map(p => (
            <li key={p.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{contactDisplayName(p)}</p>
                <p className="text-xs text-gray-500 truncate">{p.title || p.email || p.phone || '—'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <ContactForm
          parentCompanyId={companyId}
          defaultType="person"
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

function ContactForm({
  contact, onClose, defaultType = 'person', parentCompanyId,
}: {
  contact?: Contact
  onClose: () => void
  defaultType?: 'person' | 'company'
  parentCompanyId?: string
}) {
  const save = useSaveContact()
  const isEdit = !!contact
  const cf = (contact?.custom_fields || {}) as Record<string, unknown>
  const initialPhone = splitPhone(contact?.phone)
  const extras = useCrmExtras(contact?.custom_fields)
  const { data: companiesData } = useContacts({ record_type: 'company', size: 200 })

  const recordType = contact?.record_type === 'company' ? 'company' : 'person'
  const [type, setType] = useState<'person' | 'company'>(contact ? recordType : defaultType)

  const [form, setForm] = useState({
    salutation: contact?.salutation || '',
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone_cc: initialPhone.cc,
    phone: initialPhone.number,
    mobile: contact?.mobile || '',
    title: contact?.title || '',
    industry: contact?.industry || '',
    region: contact?.region || '',
    website: contact?.website || '',
    annual_revenue: contact?.annual_revenue != null ? String(contact.annual_revenue) : '',
    employee_count: contact?.employee_count != null ? String(contact.employee_count) : '',
    lifecycle_stage: contact?.lifecycle_stage || 'subscriber',
    lead_source: contact?.lead_source || '',
    tags: (contact?.tags || []).join(', '),
    location: typeof cf.location === 'string' ? cf.location : '',
    notes: contact?.notes || '',
    owner_id: contact?.owner_id || '',
    parent_contact_id: contact?.parent_contact_id || parentCompanyId || '',
  })

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) return

    const phone = form.phone.trim() ? `${form.phone_cc} ${form.phone.trim()}` : null
    const base: Record<string, unknown> = {}
    if (form.location.trim()) base.location = form.location.trim()

    save.mutate(
      {
        id: contact?.id,
        data: {
          record_type: type,
          salutation: type === 'person' && form.salutation ? form.salutation : undefined,
          first_name: form.first_name.trim(),
          last_name: type === 'person' ? (form.last_name || undefined) : undefined,
          email: form.email || undefined,
          phone,
          mobile: form.mobile || undefined,
          title: form.title || undefined,
          industry: type === 'company' ? (form.industry || undefined) : undefined,
          region: type === 'company' ? (form.region || undefined) : undefined,
          website: type === 'company' ? (form.website || undefined) : undefined,
          annual_revenue: type === 'company' && form.annual_revenue ? Number(form.annual_revenue) : undefined,
          employee_count: type === 'company' && form.employee_count ? Number(form.employee_count) : undefined,
          lifecycle_stage: form.lifecycle_stage,
          lead_source: form.lead_source || undefined,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          notes: form.notes.trim() || null,
          owner_id: form.owner_id || undefined,
          parent_contact_id: type === 'person' && form.parent_contact_id ? form.parent_contact_id : undefined,
          custom_fields: extras.serialize(base),
        },
      },
      { onSuccess: onClose },
    )
  }

  const companies = companiesData?.items ?? []

  return (
    <CrmModal
      title={isEdit ? (type === 'company' ? 'Edit company' : 'Edit contact') : (type === 'company' ? 'Add company' : 'Add contact')}
      onClose={onClose}
      maxW="max-w-3xl"
    >
      <form onSubmit={handle} className="space-y-3">
        {!parentCompanyId && !isEdit && (
          <Field label="Type">
            <div className="flex gap-2">
              {(['person', 'company'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md border text-sm transition-colors ${
                    type === t ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-input hover:bg-gray-50'
                  }`}
                >
                  {t === 'company' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  {t === 'company' ? 'Company' : 'Person'}
                </button>
              ))}
            </div>
          </Field>
        )}

        {type === 'person' ? (
          <>
            <div className="grid grid-cols-[96px_1fr_1fr] gap-3">
              <Field label="Salutation">
                <select value={form.salutation} onChange={e => setForm(p => ({ ...p, salutation: e.target.value }))} className={inputCls}>
                  <option value="">—</option>
                  {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="First name" required>
                <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
              </Field>
              <Field label="Last name">
                <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
              </Field>
            </div>
            <Field label="Title">
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="VP Sales" />
            </Field>
            {!parentCompanyId && (
              <Field label="Company">
                <select
                  value={form.parent_contact_id}
                  onChange={e => setForm(p => ({ ...p, parent_contact_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— None —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name}</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        ) : (
          <>
            <Field label="Company name" required>
              <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry"><Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} /></Field>
              <Field label="Region"><Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} /></Field>
            </div>
            <Field label="Website"><Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Annual revenue"><Input type="number" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} /></Field>
              <Field label="Employees"><Input type="number" value={form.employee_count} onChange={e => setForm(p => ({ ...p, employee_count: e.target.value }))} /></Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <div className="flex gap-2">
              <select value={form.phone_cc} onChange={e => setForm(p => ({ ...p, phone_cc: e.target.value }))}
                aria-label="Country code" className="h-10 shrink-0 rounded-md border border-input bg-background px-2 text-sm">
                {COUNTRY_CODES.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="98765 43210" />
            </div>
          </Field>
        </div>

        {type === 'person' && (
          <Field label="Mobile">
            <Input type="tel" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
          </Field>
        )}

        <Field label="Sales person">
          <SalesPersonSelect value={form.owner_id} onChange={v => setForm(p => ({ ...p, owner_id: v }))} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lifecycle stage">
            <select value={form.lifecycle_stage} onChange={e => setForm(p => ({ ...p, lifecycle_stage: e.target.value }))} className={inputCls}>
              <option value="subscriber">Subscriber</option>
              <option value="lead">Lead</option>
              <option value="mql">MQL</option>
              <option value="sql">SQL</option>
              <option value="customer">Customer</option>
              <option value="evangelist">Evangelist</option>
            </select>
          </Field>
          <Field label="Lead source">
            <Input value={form.lead_source} onChange={e => setForm(p => ({ ...p, lead_source: e.target.value }))} placeholder="website, referral…" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="Tags (comma separated)">
            <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="vip, enterprise" />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City, Country" />
          </Field>
        </div>

        <Field label="Note">
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Anything worth remembering…" className="min-h-[40px]" />
        </Field>

        {extras.actionToolbar}
        {extras.sections}
        {extras.documentsSection}
        {extras.photosSection}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isEdit ? 'Save changes' : 'Save'}
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

function ViewRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-800 break-words">{value}</dd>
    </div>
  )
}

function ContactView({
  contact, onClose, onEdit, companyName,
}: { contact: Contact; onClose: () => void; onEdit: () => void; companyName?: string }) {
  const cf = (contact.custom_fields || {}) as Record<string, unknown>
  const isCompany = contact.record_type === 'company'

  return (
    <CrmModal title={isCompany ? 'Company details' : 'Contact details'} onClose={onClose} maxW="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 break-words">{contactDisplayName(contact)}</p>
            {contact.title && !isCompany && <p className="text-sm text-gray-500">{contact.title}</p>}
            {contact.number && <p className="text-xs font-mono text-gray-400 mt-0.5">{contact.number}</p>}
          </div>
          <Badge variant="soft">{isCompany ? 'Company' : (contact.lifecycle_stage || 'subscriber')}</Badge>
        </div>

        <dl className="rounded-lg border px-4">
          {!isCompany && contact.salutation && <ViewRow label="Salutation" value={contact.salutation} />}
          <ViewRow label="Email" value={contact.email || undefined} />
          <ViewRow label="Phone" value={contact.phone || undefined} />
          {!isCompany && <ViewRow label="Mobile" value={contact.mobile || undefined} />}
          {!isCompany && companyName && <ViewRow label="Company" value={companyName} />}
          {isCompany && <ViewRow label="Industry" value={contact.industry || undefined} />}
          {isCompany && <ViewRow label="Region" value={contact.region || undefined} />}
          {isCompany && <ViewRow label="Website" value={contact.website || undefined} />}
          {isCompany && contact.annual_revenue != null && (
            <ViewRow label="Revenue" value={formatCurrency(Number(contact.annual_revenue), 'INR')} />
          )}
          {isCompany && contact.employee_count != null && <ViewRow label="Employees" value={contact.employee_count} />}
          <ViewRow label="Lead source" value={contact.lead_source || undefined} />
          <ViewRow label="Location" value={typeof cf.location === 'string' ? cf.location : undefined} />
          <ViewRow
            label="Tags"
            value={contact.tags?.length ? (
              <div className="flex flex-wrap gap-1">
                {contact.tags.map(t => <Badge key={t} variant="soft">{t}</Badge>)}
              </div>
            ) : undefined}
          />
          <ViewRow label="Last activity" value={contact.last_activity_at ? formatDateTime(contact.last_activity_at) : undefined} />
          <ViewRow label="Added" value={contact.created_at ? formatDateTime(contact.created_at) : undefined} />
        </dl>

        {contact.notes && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Note</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg border bg-gray-50 px-3 py-2">{contact.notes}</p>
          </div>
        )}

        {isCompany && <ContactPersonsSection companyId={contact.id} />}

        <CrmExtrasView cf={contact.custom_fields} />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Close</Button>
          <Button type="button" className="flex-1" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>
      </div>
    </CrmModal>
  )
}

export default function ContactsPage() {
  const [searchParams] = useSearchParams()
  const initialType = (searchParams.get('type') === 'company' ? 'company' : searchParams.get('type') === 'person' ? 'person' : '') as RecordFilter

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState<RecordFilter>(initialType)
  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<'person' | 'company'>('person')
  const [viewing, setViewing] = useState<Contact | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)

  const { data, isLoading } = useContacts({
    page, size: 20, q: search || undefined,
    record_type: typeFilter || undefined,
  })
  const { data: companiesData } = useContacts({ record_type: 'company', size: 200 })
  const companyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companiesData?.items ?? []) m.set(c.id, c.first_name)
    return m
  }, [companiesData?.items])

  const openCreate = (t: 'person' | 'company') => {
    setCreateType(t)
    setShowCreate(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreate('company')}>
            <Building2 className="w-4 h-4 mr-2" /> Add company
          </Button>
          <Button onClick={() => openCreate('person')}>
            <Plus className="w-4 h-4 mr-2" /> Add contact
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['', 'person', 'company'] as const).map(t => (
          <button
            key={t || 'all'}
            onClick={() => { setTypeFilter(t); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              typeFilter === t ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === '' ? 'All' : t === 'person' ? 'People' : 'Companies'}
          </button>
        ))}
      </div>

      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search by name, email, phone, industry…"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email / Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                  <EmptyRow cols={6} message="No contacts yet" action={
                    <Button size="sm" variant="outline" onClick={() => openCreate('person')}>
                      <UserPlus className="w-4 h-4 mr-1" /> Add your first contact
                    </Button>
                  } />
                ) : data.items.map(c => {
                  const cf = (c.custom_fields || {}) as Record<string, unknown>
                  const companyLabel = c.record_type === 'company'
                    ? '—'
                    : (c.parent_contact_id ? companyMap.get(c.parent_contact_id) : (typeof cf.company === 'string' ? cf.company : '—'))
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewing(c)}>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{contactDisplayName(c)}</p>
                        {c.title && c.record_type !== 'company' && <p className="text-xs text-gray-500">{c.title}</p>}
                        {c.number && <p className="text-xs font-mono text-gray-400">{c.number}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="soft">{c.record_type === 'company' ? 'Company' : 'Person'}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {c.email && <p className="flex items-center gap-1 text-gray-600"><Mail className="w-3 h-3 shrink-0" />{c.email}</p>}
                        {c.phone && <p className="flex items-center gap-1 text-gray-500 text-xs"><Phone className="w-3 h-3 shrink-0" />{c.phone}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{companyLabel || '—'}</p>
                        {typeof cf.location === 'string' && cf.location && <p className="text-xs text-gray-400">{cf.location}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="soft">{c.lifecycle_stage || 'subscriber'}</Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{formatDateTime(c.last_activity_at || undefined)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && (
        <ContactForm defaultType={createType} onClose={() => setShowCreate(false)} />
      )}

      {viewing && !editing && (
        <ContactView
          contact={viewing}
          companyName={viewing.parent_contact_id ? companyMap.get(viewing.parent_contact_id) : undefined}
          onClose={() => setViewing(null)}
          onEdit={() => setEditing(viewing)}
        />
      )}

      {editing && (
        <ContactForm contact={editing} onClose={() => { setEditing(null); setViewing(null) }} />
      )}
    </div>
  )
}
