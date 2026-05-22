import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useLeads, useSaveLead, useConvertLead } from '@/hooks/useCrm'
import { crmApi, type Lead } from '@/api/crm'
import { Plus, Loader2, Target, Sparkles, ArrowRight } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted'] as const

function LeadForm({ onClose }: { onClose: () => void }) {
  const save = useSaveLead()
  const [form, setForm] = useState({
    first_name: '', last_name: '', company: '', email: '', phone: '',
    title: '', source: 'website', status: 'new', notes: '',
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name && !form.last_name && !form.email && !form.phone) return
    save.mutate(
      {
        data: {
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          company: form.company || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          title: form.title || undefined,
          source: form.source,
          status: form.status,
          notes: form.notes || undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title="New lead" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} /></Field>
          <Field label="Last name"><Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} /></Field>
        </div>
        <Field label="Company"><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></Field>
        <Field label="Title"><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            <Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="website, ads, referral" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save lead
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

function ConvertModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const convert = useConvertLead()
  const [createDeal, setCreateDeal] = useState(true)
  const [dealTitle, setDealTitle] = useState(`${lead.company || lead.first_name || 'Lead'} – Opportunity`)
  const [dealAmount, setDealAmount] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    convert.mutate(
      {
        id: lead.id,
        payload: {
          create_deal: createDeal,
          deal_title: createDeal ? dealTitle : undefined,
          deal_amount: createDeal && dealAmount ? Number(dealAmount) : undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title={`Convert lead`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-gray-600">
          Converts <strong>{[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email}</strong>{' '}
          into a contact{lead.company ? ' and account' : ''}.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={createDeal} onChange={e => setCreateDeal(e.target.checked)} />
          Create deal
        </label>
        {createDeal && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal title"><Input value={dealTitle} onChange={e => setDealTitle(e.target.value)} /></Field>
            <Field label="Amount"><Input type="number" value={dealAmount} onChange={e => setDealAmount(e.target.value)} placeholder="0" /></Field>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={convert.isPending}>
            {convert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Convert
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function LeadsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  const { data, isLoading } = useLeads({ page, size: 20, q: search || undefined, status: status || undefined })

  const score = async (id: string) => {
    await crmApi.scoreLead(id)
    qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New lead
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map(s => (
          <button key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>

      <SearchBar value={searchInput} onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search by name, company, email…" />

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Lead</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Company</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Source</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Score</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Created</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={7} /> : !data?.items?.length ? (
                <EmptyRow cols={7} message="No leads yet" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <Target className="w-4 h-4 mr-1" /> Capture your first lead
                  </Button>
                } />
              ) : data.items.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}</p>
                    <p className="text-xs text-gray-500">{l.email || l.phone || '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{l.company || '—'}</td>
                  <td className="px-6 py-4 text-xs hidden lg:table-cell">
                    {l.source ? <Badge variant="soft">{l.source}</Badge> : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={l.status === 'qualified' ? 'success' : l.status === 'unqualified' ? 'destructive' : 'secondary'}>
                      {l.status || 'new'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono hidden xl:table-cell">{l.score ?? '—'}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden xl:table-cell">{formatDateTime(l.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => score(l.id)} title="AI score">
                        <Sparkles className="w-4 h-4 text-primary/80" />
                      </Button>
                      {l.status !== 'converted' && (
                        <Button variant="ghost" size="sm" onClick={() => setConvertLead(l)} title="Convert">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <LeadForm onClose={() => setShowCreate(false)} />}
      {convertLead && <ConvertModal lead={convertLead} onClose={() => setConvertLead(null)} />}
    </div>
  )
}
