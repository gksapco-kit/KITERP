import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAccounts, useSaveAccount } from '@/hooks/useCrm'
import type { Account } from '@/api/crm'
import { Plus, Loader2, Building2, Globe, Pencil } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { COUNTRY_CODES, splitPhone, useCrmExtras, CrmExtrasView } from './crmExtras'
import { formatCurrency, formatDateTime } from '@/lib/utils'

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const save = useSaveAccount()
  const isEdit = !!account
  const initialPhone = splitPhone(account?.phone)
  const extras = useCrmExtras(account?.custom_fields)

  const [form, setForm] = useState({
    name: account?.name || '',
    industry: account?.industry || '',
    region: account?.region || '',
    website: account?.website || '',
    phone_cc: initialPhone.cc,
    phone: initialPhone.number,
    email: account?.email || '',
    annual_revenue: account?.annual_revenue != null ? String(account.annual_revenue) : '',
    employee_count: account?.employee_count != null ? String(account.employee_count) : '',
    tags: (account?.tags || []).join(', '),
    notes: account?.notes || '',
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const phone = form.phone.trim() ? `${form.phone_cc} ${form.phone.trim()}` : null

    save.mutate(
      {
        id: account?.id,
        data: {
          name: form.name,
          industry: form.industry || undefined,
          region: form.region || undefined,
          website: form.website || undefined,
          phone,
          email: form.email || undefined,
          annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : undefined,
          employee_count: form.employee_count ? Number(form.employee_count) : undefined,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          notes: form.notes.trim() || null,
          custom_fields: extras.serialize(),
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title={isEdit ? 'Edit account' : 'Add account'} onClose={onClose} maxW="max-w-3xl">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Company name" required>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Industry"><Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} /></Field>
          <Field label="Region"><Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Website"><Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" /></Field>
          <Field label="Phone">
            <div className="flex gap-2">
              <select value={form.phone_cc} onChange={(e) => setForm(p => ({ ...p, phone_cc: e.target.value }))}
                aria-label="Country code" className="h-10 shrink-0 rounded-md border border-input bg-background px-2 text-sm">
                {COUNTRY_CODES.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="98765 43210" />
            </div>
          </Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Annual revenue"><Input type="number" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} /></Field>
          <Field label="Employees"><Input type="number" value={form.employee_count} onChange={e => setForm(p => ({ ...p, employee_count: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="Tags (comma separated)">
            <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="vip, enterprise" />
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

function AccountView({
  account, onClose, onEdit,
}: { account: Account; onClose: () => void; onEdit: () => void }) {
  return (
    <CrmModal title="Account details" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 break-words">{account.name}</p>
            {account.website && (
              <a href={account.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Globe className="w-3 h-3" />{account.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
          {account.industry && <Badge variant="soft">{account.industry}</Badge>}
        </div>

        <dl className="rounded-lg border px-4">
          <ViewRow label="Email" value={account.email || undefined} />
          <ViewRow label="Phone" value={account.phone || undefined} />
          <ViewRow label="Region" value={account.region || undefined} />
          <ViewRow label="Annual revenue" value={account.annual_revenue ? formatCurrency(account.annual_revenue) : undefined} />
          <ViewRow label="Employees" value={account.employee_count || undefined} />
          <ViewRow
            label="Tags"
            value={account.tags?.length ? (
              <div className="flex flex-wrap gap-1">
                {account.tags.map(t => <Badge key={t} variant="soft">{t}</Badge>)}
              </div>
            ) : undefined}
          />
          <ViewRow label="Added" value={account.created_at ? formatDateTime(account.created_at) : undefined} />
        </dl>

        {account.notes && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Note</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg border bg-gray-50 px-3 py-2">{account.notes}</p>
          </div>
        )}

        <CrmExtrasView cf={account.custom_fields} />

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

export default function AccountsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewing, setViewing] = useState<Account | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const { data, isLoading } = useAccounts({ page, size: 20, q: search || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add account
        </Button>
      </div>

      <SearchBar value={searchInput} onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search by name, industry…" />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Industry</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Employees</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? <LoadingRow cols={5} /> : !data?.items?.length ? (
                  <EmptyRow cols={5} message="No accounts yet" action={
                    <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                      <Building2 className="w-4 h-4 mr-1" /> Add account
                    </Button>
                  } />
                ) : data.items.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewing(a)}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.website && <span className="text-xs text-blue-600 flex items-center gap-1"><Globe className="w-3 h-3" />{a.website.replace(/^https?:\/\//, '')}</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {a.industry ? <Badge variant="soft">{a.industry}</Badge> : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.region || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.annual_revenue ? formatCurrency(a.annual_revenue) : '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.employee_count || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <AccountForm onClose={() => setShowCreate(false)} />}

      {viewing && !editing && (
        <AccountView
          account={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing) }}
        />
      )}

      {editing && (
        <AccountForm
          account={editing}
          onClose={() => { setEditing(null); setViewing(null) }}
        />
      )}
    </div>
  )
}
