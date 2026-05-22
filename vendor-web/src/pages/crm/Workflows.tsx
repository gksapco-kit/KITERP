import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useWorkflows, useSaveWorkflow } from '@/hooks/useCrm'
import { crmApi, type Workflow } from '@/api/crm'
import { Plus, Loader2, Workflow as WorkflowIcon, Edit3, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const TRIGGER_PRESETS: { id: string; label: string; trigger: Record<string, unknown> }[] = [
  { id: 'lead.created',    label: 'When a lead is created',     trigger: { event: 'lead.created' } },
  { id: 'contact.created', label: 'When a contact is created',  trigger: { event: 'contact.created' } },
  { id: 'deal.won',        label: 'When a deal is won',         trigger: { event: 'deal.won' } },
  { id: 'ticket.created',  label: 'When a ticket is created',   trigger: { event: 'ticket.created' } },
  { id: 'manual',          label: 'Manual trigger only',        trigger: { event: 'manual' } },
]

function WorkflowForm({ wf, onClose }: { wf?: Workflow; onClose: () => void }) {
  const save = useSaveWorkflow()
  const [form, setForm] = useState({
    name: wf?.name || '',
    description: wf?.description || '',
    trigger: wf?.trigger ? JSON.stringify(wf.trigger, null, 2) : JSON.stringify(TRIGGER_PRESETS[0].trigger, null, 2),
    steps: wf?.steps ? JSON.stringify(wf.steps, null, 2) :
      '[\n  { "type": "send_email", "template_id": "" },\n  { "type": "wait", "minutes": 60 },\n  { "type": "create_task", "subject": "Follow up" }\n]',
    requires_approval: wf?.requires_approval || false,
    status: wf?.status || 'draft',
  })
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return
    let trigger: Record<string, unknown>, steps: Record<string, unknown>[]
    try { trigger = JSON.parse(form.trigger || '{}') } catch { setError('Trigger must be valid JSON'); return }
    try { steps = JSON.parse(form.steps || '[]') } catch { setError('Steps must be valid JSON'); return }
    save.mutate(
      {
        id: wf?.id,
        data: {
          name: form.name,
          description: form.description || undefined,
          trigger, steps,
          requires_approval: form.requires_approval,
          status: form.status,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <CrmModal title={wf ? 'Edit workflow' : 'New workflow'} onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Field>
        <Field label="Description"><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></Field>
        <Field label="Trigger preset">
          <select onChange={e => {
              const preset = TRIGGER_PRESETS.find(p => p.id === e.target.value)
              if (preset) setForm(p => ({ ...p, trigger: JSON.stringify(preset.trigger, null, 2) }))
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {TRIGGER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Trigger (JSON)">
          <textarea value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        </Field>
        <Field label="Steps (JSON array)">
          <textarea value={form.steps} onChange={e => setForm(p => ({ ...p, steps: e.target.value }))}
            className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
          <p className="text-xs text-gray-500 mt-1">
            Step types: <code>send_email</code>, <code>send_sms</code>, <code>send_whatsapp</code>, <code>wait</code>, <code>create_task</code>, <code>assign_user</code>, <code>update_field</code>, <code>webhook</code>
          </p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 mt-7 text-sm">
            <input type="checkbox" checked={form.requires_approval} onChange={e => setForm(p => ({ ...p, requires_approval: e.target.checked }))} />
            Require approval before run
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
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

export default function WorkflowsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useWorkflows()
  const [edit, setEdit] = useState<Workflow | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const remove = async (id: string) => {
    if (!confirm('Delete this workflow?')) return
    await crmApi.deleteWorkflow(id)
    qc.invalidateQueries({ queryKey: ['crm', 'workflows'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Automation</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data?.length ? (
        <Card><CardContent className="p-12 text-center">
          <WorkflowIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No workflows yet — automate routine work like assigning leads or sending follow-ups.</p>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create workflow</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(w => (
            <Card key={w.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{w.name}</h3>
                    {w.description && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{w.description}</p>}
                  </div>
                  <Badge variant={w.status === 'active' ? 'success' : w.status === 'paused' ? 'warning' : 'secondary'}>{w.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-gray-50 rounded-md p-2 text-center">
                    <p className="text-gray-500">Runs</p>
                    <p className="font-semibold">{w.run_count}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-md p-2 text-center">
                    <p className="text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Success</p>
                    <p className="font-semibold text-emerald-700">{w.success_count}</p>
                  </div>
                  <div className="bg-rose-50 rounded-md p-2 text-center">
                    <p className="text-rose-600 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> Failure</p>
                    <p className="font-semibold text-rose-700">{w.failure_count}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {w.last_run_at ? `Last run ${formatDateTime(w.last_run_at)}` : 'Never run'}
                </p>
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setEdit(w)}><Edit3 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(w.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <WorkflowForm onClose={() => setShowCreate(false)} />}
      {edit && <WorkflowForm wf={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
