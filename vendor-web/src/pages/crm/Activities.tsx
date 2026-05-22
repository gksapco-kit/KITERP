import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useActivities, useSaveActivity, useCompleteActivity } from '@/hooks/useCrm'
import { Plus, Loader2, Activity as ActivityIcon, CheckCircle2, Calendar, Phone, Mail, Users } from 'lucide-react'
import { CrmModal, Field, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'

const TYPES = [
  { id: 'task', label: 'Task', icon: ActivityIcon },
  { id: 'call', label: 'Call', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'meeting', label: 'Meeting', icon: Users },
  { id: 'note', label: 'Note', icon: ActivityIcon },
]

function ActivityForm({ onClose }: { onClose: () => void }) {
  const save = useSaveActivity()
  const [form, setForm] = useState({
    type: 'task', subject: '', description: '', due_at: '',
    duration_minutes: '', priority: 'medium', location: '', meeting_url: '',
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim()) return
    save.mutate(
      {
        data: {
          type: form.type, subject: form.subject,
          description: form.description || undefined,
          due_at: form.due_at || undefined,
          duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
          priority: form.priority,
          location: form.location || undefined,
          meeting_url: form.meeting_url || undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title="New activity" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </div>
        <Field label="Subject" required><Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due at"><Input type="datetime-local" value={form.due_at} onChange={e => setForm(p => ({ ...p, due_at: e.target.value }))} /></Field>
          <Field label="Duration (min)"><Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} /></Field>
        </div>
        {form.type === 'meeting' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></Field>
            <Field label="Meeting URL"><Input value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))} /></Field>
          </div>
        )}
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

export default function ActivitiesPage() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('pending')
  const [showCreate, setShowCreate] = useState(false)
  const complete = useCompleteActivity()
  const { data, isLoading } = useActivities({ page, size: 20, type: type || undefined, status: status || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Activities & Tasks</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New activity
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', ...TYPES.map(t => t.id)].map(t => (
          <button key={t || 'all'} onClick={() => { setType(t); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${type === t ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t || 'all types'}
          </button>
        ))}
        <span className="w-px bg-gray-200 mx-1" />
        {['pending', 'in_progress', 'completed', 'cancelled', ''].map(s => (
          <button key={s || 'all-status'} onClick={() => { setStatus(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'all status'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Activity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Due</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Priority</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No activities" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <Calendar className="w-4 h-4 mr-1" /> Schedule activity
                  </Button>
                } />
              ) : data.items.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{a.subject}</p>
                    {a.description && <p className="text-xs text-gray-500 line-clamp-1">{a.description}</p>}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant="soft">{a.type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden lg:table-cell">{a.due_at ? formatDateTime(a.due_at) : '—'}</td>
                  <td className="px-6 py-4 hidden xl:table-cell">
                    <Badge variant={a.priority === 'urgent' ? 'destructive' : a.priority === 'high' ? 'warning' : 'secondary'}>
                      {a.priority || 'medium'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={a.status === 'completed' ? 'success' : a.status === 'cancelled' ? 'destructive' : 'secondary'}>
                      {a.status || 'pending'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {a.status !== 'completed' && (
                      <Button variant="ghost" size="sm" onClick={() => complete.mutate({ id: a.id })} title="Mark complete">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <ActivityForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
