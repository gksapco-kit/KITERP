import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useContacts, useSaveContact } from '@/hooks/useCrm'
import type { Contact } from '@/api/crm'
import { Plus, Loader2, UserPlus, Mail, Phone, Pencil } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { COUNTRY_CODES, splitPhone, useCrmExtras, CrmExtrasView } from './crmExtras'
import { formatDateTime } from '@/lib/utils'

function ContactForm({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const save = useSaveContact()
  const isEdit = !!contact
  const cf = (contact?.custom_fields || {}) as Record<string, unknown>
  const initialPhone = splitPhone(contact?.phone)
  const extras = useCrmExtras(contact?.custom_fields)

  const [form, setForm] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone_cc: initialPhone.cc,
    phone: initialPhone.number,
    mobile: contact?.mobile || '',
    title: contact?.title || '',
    lifecycle_stage: contact?.lifecycle_stage || 'subscriber',
    lead_source: contact?.lead_source || '',
    tags: (contact?.tags || []).join(', '),
    company: typeof cf.company === 'string' ? cf.company : '',
    location: typeof cf.location === 'string' ? cf.location : '',
    notes: contact?.notes || '',
  })

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) return

    const phone = form.phone.trim() ? `${form.phone_cc} ${form.phone.trim()}` : null

    const base: Record<string, unknown> = {}
    if (form.company.trim()) base.company = form.company.trim()
    if (form.location.trim()) base.location = form.location.trim()

    save.mutate(
      {
        id: contact?.id,
        data: {
          first_name: form.first_name,
          last_name: form.last_name || undefined,
          email: form.email || undefined,
          phone,
          mobile: form.mobile || undefined,
          title: form.title || undefined,
          lifecycle_stage: form.lifecycle_stage,
          lead_source: form.lead_source || undefined,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          notes: form.notes.trim() || null,
          custom_fields: extras.serialize(base),
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title={isEdit ? 'Edit contact' : 'Add contact'} onClose={onClose} maxW="max-w-3xl">
      <form onSubmit={handle} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input value={form.first_name} onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))} />
          </Field>
          <Field label="Last name">
            <Input value={form.last_name} onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))} />
          </Field>
        </div>
        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="VP Sales" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <div className="flex gap-2">
              <select value={form.phone_cc} onChange={(e) => setForm(p => ({ ...p, phone_cc: e.target.value }))}
                aria-label="Country code" className="h-10 shrink-0 rounded-md border border-input bg-background px-2 text-sm">
                {COUNTRY_CODES.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <Input type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="98765 43210" />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current company">
            <Input value={form.company} onChange={(e) => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Acme Inc" />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City, Country" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lifecycle stage">
            <select value={form.lifecycle_stage} onChange={(e) => setForm(p => ({ ...p, lifecycle_stage: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="subscriber">Subscriber</option>
              <option value="lead">Lead</option>
              <option value="mql">MQL</option>
              <option value="sql">SQL</option>
              <option value="customer">Customer</option>
              <option value="evangelist">Evangelist</option>
            </select>
          </Field>
          <Field label="Lead source">
            <Input value={form.lead_source} onChange={(e) => setForm(p => ({ ...p, lead_source: e.target.value }))} placeholder="website, referral…" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="Tags (comma separated)">
            <Input value={form.tags} onChange={(e) => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="vip, enterprise" />
          </Field>
          <Field label="Note">
            <Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Anything worth remembering…" className="min-h-[40px]" />
          </Field>
        </div>

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
  contact, onClose, onEdit,
}: { contact: Contact; onClose: () => void; onEdit: () => void }) {
  const cf = (contact.custom_fields || {}) as Record<string, unknown>
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'

  return (
    <CrmModal title="Contact details" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 break-words">{fullName}</p>
            {contact.title && <p className="text-sm text-gray-500">{contact.title}</p>}
          </div>
          <Badge variant="soft">{contact.lifecycle_stage || 'subscriber'}</Badge>
        </div>

        <dl className="rounded-lg border px-4">
          <ViewRow label="Email" value={contact.email || undefined} />
          <ViewRow label="Phone" value={contact.phone || undefined} />
          <ViewRow label="Mobile" value={contact.mobile || undefined} />
          <ViewRow label="Company" value={typeof cf.company === 'string' ? cf.company : undefined} />
          <ViewRow label="Location" value={typeof cf.location === 'string' ? cf.location : undefined} />
          <ViewRow label="Lead source" value={contact.lead_source || undefined} />
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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewing, setViewing] = useState<Contact | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)

  const { data, isLoading } = useContacts({ page, size: 20, q: search || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add contact
        </Button>
      </div>

      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search by name, email, phone…"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email / Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                  <EmptyRow cols={6} message="No contacts yet" action={
                    <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                      <UserPlus className="w-4 h-4 mr-1" /> Add your first contact
                    </Button>
                  } />
                ) : data.items.map(c => {
                  const cf = (c.custom_fields || {}) as Record<string, unknown>
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewing(c)}>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</p>
                        {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {c.email && <p className="flex items-center gap-1 text-gray-600"><Mail className="w-3 h-3 shrink-0" />{c.email}</p>}
                        {c.phone && <p className="flex items-center gap-1 text-gray-500 text-xs"><Phone className="w-3 h-3 shrink-0" />{c.phone}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <p>{typeof cf.company === 'string' && cf.company ? cf.company : '—'}</p>
                        {typeof cf.location === 'string' && cf.location && <p className="text-xs text-gray-400">{cf.location}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="soft">{c.lifecycle_stage || 'subscriber'}</Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">{c.lead_source || '—'}</td>
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

      {showCreate && <ContactForm onClose={() => setShowCreate(false)} />}

      {viewing && !editing && (
        <ContactView
          contact={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing) }}
        />
      )}

      {editing && (
        <ContactForm
          contact={editing}
          onClose={() => { setEditing(null); setViewing(null) }}
        />
      )}
    </div>
  )
}
