import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useContacts, useSaveContact } from '@/hooks/useCrm'
import { Plus, Loader2, UserPlus, Mail, Phone } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'

function ContactForm({ onClose }: { onClose: () => void }) {
  const save = useSaveContact()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', mobile: '',
    title: '', lifecycle_stage: 'subscriber', lead_source: '', tags: '',
  })
  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) return
    save.mutate(
      {
        data: {
          first_name: form.first_name,
          last_name: form.last_name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          mobile: form.mobile || undefined,
          title: form.title || undefined,
          lifecycle_stage: form.lifecycle_stage,
          lead_source: form.lead_source || undefined,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title="Add contact" onClose={onClose}>
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
            <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
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
        <Field label="Tags (comma separated)">
          <Input value={form.tags} onChange={(e) => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="vip, enterprise" />
        </Field>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function ContactsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useContacts({ page, size: 20, q: search || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
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
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Email / Phone</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Stage</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Source</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={5} /> : !data?.items?.length ? (
                <EmptyRow cols={5} message="No contacts yet" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <UserPlus className="w-4 h-4 mr-1" /> Add your first contact
                  </Button>
                } />
              ) : data.items.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</p>
                    {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm hidden md:table-cell">
                    {c.email && <p className="flex items-center gap-1 text-gray-600"><Mail className="w-3 h-3" />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1 text-gray-500 text-xs"><Phone className="w-3 h-3" />{c.phone}</p>}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <Badge variant="soft">{c.lifecycle_stage || 'subscriber'}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden lg:table-cell">{c.lead_source || '—'}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden xl:table-cell">{formatDateTime(c.last_activity_at || undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <ContactForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
