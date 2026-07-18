import { useMemo, useState } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useContacts, useSaveContact } from '@/hooks/useCrm'
import { useTeamMembers } from '@/hooks/useVendor'
import type { Contact } from '@/api/crm'
import { Plus, Loader2, UserPlus, Mail, Pencil, Building2, User, ChevronDown, ChevronUp } from 'lucide-react'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { normalizePhoneE164 } from '@/lib/phoneE164'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { useCrmExtras, CrmExtrasView } from './crmExtras'
import { SALUTATIONS, contactDisplayName } from './crmContactsShared'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'

type RecordFilter = '' | 'person' | 'company'

function SalesPersonSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const team = useTeamMembers({ size: 100 })
  const members = team.data?.items ?? []
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="— None —"
      options={selectOptionsWithBlank(
        '— None —',
        members.filter(m => m.user_id).map(m => ({
          value: m.user_id!,
          label: m.user?.full_name || m.user?.email || m.role_name || 'Member',
        })),
      )}
    />
  )
}

function ContactPersonsSection({ companyId }: { companyId: string }) {
  const { data, isLoading } = useContacts({ parent_contact_id: companyId, size: 50 })
  const [adding, setAdding] = useState(false)

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <SectionLabel>Contact persons</SectionLabel>
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
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
  const extras = useCrmExtras(contact?.custom_fields)
  const { data: companiesData } = useContacts({ record_type: 'company', size: 200 })

  const recordType = contact?.record_type === 'company' ? 'company' : 'person'
  const [type, setType] = useState<'person' | 'company'>(contact ? recordType : defaultType)

  const [form, setForm] = useState({
    salutation: contact?.salutation || '',
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone: contact?.phone ? normalizePhoneE164(contact.phone) : '',
    mobile: contact?.mobile ? normalizePhoneE164(contact.mobile) : '',
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

    const phone = form.phone.trim() ? normalizePhoneE164(form.phone.trim()) : null
    const mobile = form.mobile.trim() ? normalizePhoneE164(form.mobile.trim()) : undefined
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
          mobile,
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
  const formId = contact ? `contact-form-${contact.id}` : 'contact-form-new'
  const [moreOpen, setMoreOpen] = useState(false)
  const inputCls = 'h-8 text-sm'

  return (
    <CrmModal
      title={isEdit ? (type === 'company' ? 'Edit company' : 'Edit contact') : (type === 'company' ? 'Add company' : 'Add contact')}
      onClose={onClose}
      maxW="max-w-md min-h-[min(34rem,calc(100dvh-1.5rem))]"
      footer={
        <>
          <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} className="h-8 rounded-md px-3 text-sm" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            {isEdit ? 'Save' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handle} className="space-y-2.5" autoComplete="off">
        {!parentCompanyId && !isEdit && (
          <Field label="Type">
            <div className="flex gap-1.5">
              {(['person', 'company'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors',
                    type === t
                      ? 'border-primary bg-primary/5 font-medium text-primary'
                      : 'border-input hover:bg-muted/50',
                  )}
                >
                  {t === 'company' ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  {t === 'company' ? 'Company' : 'Person'}
                </button>
              ))}
            </div>
          </Field>
        )}

        <FormSection title={type === 'company' ? 'Company details' : 'Name & role'}>
        {type === 'person' ? (
          <>
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
              <Field label="Salutation">
                <Select
                  value={form.salutation}
                  onChange={v => setForm(p => ({ ...p, salutation: v }))}
                  placeholder="—"
                  className="w-full min-w-0"
                  triggerClassName={cn('min-w-0 w-full', inputCls)}
                  options={selectOptionsWithBlank('—', SALUTATIONS.map(s => ({ value: s, label: s })))}
                />
              </Field>
              <Field label="First name" required>
                <Input
                  className={inputCls}
                  value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                  autoComplete="off"
                  name="crm-contact-first-name"
                  data-1p-ignore="true"
                  data-lpignore="true"
                />
              </Field>
              <Field label="Last name">
                <Input
                  className={inputCls}
                  value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                  autoComplete="off"
                  name="crm-contact-last-name"
                  data-1p-ignore="true"
                />
              </Field>
            </div>
            <Field label="Title">
              <Input className={inputCls} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="VP Sales" />
            </Field>
            {!parentCompanyId && (
              <Field label="Company">
                <Select
                  value={form.parent_contact_id}
                  onChange={v => setForm(p => ({ ...p, parent_contact_id: v }))}
                  placeholder="— None —"
                  triggerClassName={inputCls}
                  options={selectOptionsWithBlank(
                    '— None —',
                    companies.map(c => ({ value: c.id, label: c.first_name })),
                  )}
                />
              </Field>
            )}
          </>
        ) : (
          <>
            <Field label="Company name" required>
              <Input
                className={inputCls}
                value={form.first_name}
                onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                autoComplete="off"
                name="crm-company-name"
              />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Industry"><Input className={inputCls} value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} /></Field>
              <Field label="Region"><Input className={inputCls} value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} /></Field>
            </div>
            <Field label="Website"><Input className={inputCls} value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" /></Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Annual revenue"><Input className={inputCls} type="number" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} /></Field>
              <Field label="Employees"><Input className={inputCls} type="number" value={form.employee_count} onChange={e => setForm(p => ({ ...p, employee_count: e.target.value }))} /></Field>
            </div>
          </>
        )}
        </FormSection>

        <FormSection title="Contact channels">
          <Field label="Email">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={cn(inputCls, 'pl-8')}
                placeholder="name@company.com"
                autoComplete="off"
                name="crm-contact-email"
              />
            </div>
          </Field>
          <div className={type === 'person' ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2' : ''}>
            <Field label="Phone">
              <PhoneInput
                value={form.phone}
                onChange={v => setForm(p => ({ ...p, phone: v }))}
                defaultCountryIso="IN"
                inferCountryFromLocation
                compact
                compactCountry
                subtleFeedback
                placeholder="Office or landline"
              />
            </Field>
            {type === 'person' && (
              <Field label="Mobile">
                <PhoneInput
                  value={form.mobile}
                  onChange={v => setForm(p => ({ ...p, mobile: v }))}
                  defaultCountryIso="IN"
                  inferCountryFromLocation
                  compact
                  compactCountry
                  subtleFeedback
                  placeholder="SMS / WhatsApp"
                />
              </Field>
            )}
          </div>
        </FormSection>

        <div className="overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => setMoreOpen(v => !v)}
            className="flex w-full items-center justify-between bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            <span>{moreOpen ? 'Fewer details' : 'More details'}</span>
            {moreOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {moreOpen && (
            <div className="space-y-2.5 p-2.5">
              <FormSection title="Assignment & source">
                <Field label="Sales person">
                  <SalesPersonSelect value={form.owner_id} onChange={v => setForm(p => ({ ...p, owner_id: v }))} />
                </Field>
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Lifecycle stage">
                    <Select
                      value={form.lifecycle_stage}
                      onChange={v => setForm(p => ({ ...p, lifecycle_stage: v }))}
                      triggerClassName={inputCls}
                      options={[
                        { value: 'subscriber', label: 'Subscriber' },
                        { value: 'lead', label: 'Lead' },
                        { value: 'mql', label: 'MQL' },
                        { value: 'sql', label: 'SQL' },
                        { value: 'customer', label: 'Customer' },
                        { value: 'evangelist', label: 'Evangelist' },
                      ]}
                    />
                  </Field>
                  <Field label="Lead source">
                    <Input className={inputCls} value={form.lead_source} onChange={e => setForm(p => ({ ...p, lead_source: e.target.value }))} placeholder="website, referral…" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Tags">
                    <Input className={inputCls} value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="vip, enterprise" />
                  </Field>
                  <Field label="Location">
                    <Input className={inputCls} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City, Country" />
                  </Field>
                </div>
              </FormSection>

              <Field label="Note">
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Anything worth remembering…"
                  className="min-h-[3rem] resize-none text-sm"
                />
              </Field>

              {extras.actionToolbar}
              {extras.sections}
              {extras.documentsSection}
              {extras.photosSection}
            </div>
          )}
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
    <CrmModal
      title={isCompany ? 'Company details' : 'Contact details'}
      onClose={onClose}
      maxW="max-w-md"
      footer={
        <>
          <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={onClose}>
            Close
          </Button>
          <Button type="button" className="h-8 rounded-md px-3 text-sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
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
      </div>
    </CrmModal>
  )
}

export default function ContactsPage() {
  const [searchParams] = useSearchParams()
  const initialType = (searchParams.get('type') === 'company' ? 'company' : searchParams.get('type') === 'person' ? 'person' : '') as RecordFilter

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState<RecordFilter>(initialType)
  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<'person' | 'company'>('person')
  const [viewing, setViewing] = useState<Contact | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)

  const { data, isLoading } = useContacts({
    page, size: pageSize, q: search || undefined,
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
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          People and companies for CRM outreach
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="h-8 gap-1.5 px-3 text-sm" onClick={() => openCreate('company')}>
            <Building2 className="h-3.5 w-3.5" /> Add company
          </Button>
          <Button className="h-8 gap-1.5 px-3 text-sm" onClick={() => openCreate('person')}>
            <Plus className="h-3.5 w-3.5" /> Add contact
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
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Name</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Email / Phone</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Company</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Stage</TableColumnLabel></th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Last activity</TableColumnLabel></th>
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
                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={onClickableTableRow(() => setViewing(c))}>
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
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} itemLabel="contacts" />
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
