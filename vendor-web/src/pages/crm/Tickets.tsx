import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTickets, useSaveTicket } from '@/hooks/useCrm'
import { Plus, Loader2, LifeBuoy, AlertTriangle, Eye } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const STATUSES = ['open', 'pending', 'on_hold', 'resolved', 'closed']

function TicketForm({ onClose }: { onClose: () => void }) {
  const save = useSaveTicket()
  const [form, setForm] = useState({
    subject: '', description: '', priority: 'normal', source: 'web',
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim()) return
    save.mutate(
      {
        data: {
          subject: form.subject,
          description: form.description || undefined,
          priority: form.priority,
          source: form.source,
        },
      },
      {
        onSuccess: () => {
          toast.success('Ticket created')
          onClose()
        },
        onError: (err) => toast.error(extractApiError(err, 'Could not create ticket')),
      },
    )
  }
  return (
    <CrmModal title="New ticket" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Subject" required>
          <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {['web', 'email', 'chat', 'phone', 'api'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function TicketsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('open')
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useTickets({ page, size: 20, q: search || undefined, status: status || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New ticket
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', ...STATUSES].map(s => (
          <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>

      <SearchBar value={searchInput} onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search tickets…" />

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ticket</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Priority</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Source</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Updated</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No tickets" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <LifeBuoy className="w-4 h-4 mr-1" /> Open ticket
                  </Button>
                } />
              ) : data.items.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{t.number}</span>
                      <span className="truncate">{t.subject}</span>
                      {t.sla_breached && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" aria-label="SLA breached" />}
                    </p>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant={t.priority === 'urgent' ? 'destructive' : t.priority === 'high' ? 'warning' : 'secondary'}>{t.priority}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={t.status === 'resolved' || t.status === 'closed' ? 'success' : 'soft'}>{t.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden lg:table-cell">{t.source}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden xl:table-cell">{formatDateTime(t.updated_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/tickets/${t.id}`)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <TicketForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
