import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAccounts, useSaveAccount } from '@/hooks/useCrm'
import { Plus, Loader2, Building2, Globe } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatCurrency } from '@/lib/utils'

function AccountForm({ onClose }: { onClose: () => void }) {
  const save = useSaveAccount()
  const [form, setForm] = useState({
    name: '', industry: '', region: '', website: '', phone: '', email: '',
    annual_revenue: '', employee_count: '', tags: '',
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    save.mutate(
      {
        data: {
          name: form.name,
          industry: form.industry || undefined,
          region: form.region || undefined,
          website: form.website || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : undefined,
          employee_count: form.employee_count ? Number(form.employee_count) : undefined,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title="Add account" onClose={onClose}>
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
          <Field label="Phone"><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Annual revenue"><Input type="number" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} /></Field>
          <Field label="Employees"><Input type="number" value={form.employee_count} onChange={e => setForm(p => ({ ...p, employee_count: e.target.value }))} /></Field>
        </div>
        <Field label="Tags (comma separated)">
          <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
        </Field>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function AccountsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useAccounts({ page, size: 20, q: search || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
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
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Industry</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Region</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Revenue</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Employees</th>
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
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{a.name}</p>
                    {a.website && <a href={a.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Globe className="w-3 h-3" />{a.website.replace(/^https?:\/\//, '')}</a>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                    {a.industry ? <Badge variant="soft">{a.industry}</Badge> : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">{a.region || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">{a.annual_revenue ? formatCurrency(a.annual_revenue) : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden xl:table-cell">{a.employee_count || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <AccountForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
