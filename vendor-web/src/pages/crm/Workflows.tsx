import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useWorkflows, useSaveWorkflow, useEmailTemplates } from '@/hooks/useCrm'
import { useTeamMembers } from '@/hooks/useVendor'
import { crmApi, type Workflow } from '@/api/crm'
import { Plus, Loader2, Workflow as WorkflowIcon, Edit3, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  WorkflowStepBuilder, WORKFLOW_TRIGGERS,
  parseWorkflowSteps, serializeWorkflowSteps, parseWorkflowTrigger,
  type WorkflowStep,
} from './crmMarketingForms'

import { askConfirm } from '@/components/common/ConfirmProvider'
function WorkflowForm({ wf, onClose }: { wf?: Workflow; onClose: () => void }) {
  const qc = useQueryClient()
  const save = useSaveWorkflow()
  const { data: templates } = useEmailTemplates()
  const team = useTeamMembers({ size: 100 })
  const teamOptions = useMemo(() => (team.data?.items ?? [])
    .filter(m => m.user_id)
    .map(m => ({
      id: m.user_id!,
      label: m.user?.full_name || m.user?.email || m.role_name || 'Member',
    })), [team.data?.items])

  const [form, setForm] = useState({
    name: wf?.name || '',
    description: wf?.description || '',
    trigger: parseWorkflowTrigger(wf?.trigger),
    steps: parseWorkflowSteps(wf?.steps),
    requires_approval: wf?.requires_approval || false,
    status: wf?.status || 'draft',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Workflow name is required')
      return
    }
    if (!form.steps.length) {
      toast.error('Add at least one workflow step')
      return
    }
    try {
      await save.mutateAsync({
        id: wf?.id,
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          trigger: { event: form.trigger },
          steps: serializeWorkflowSteps(form.steps),
          requires_approval: form.requires_approval,
          status: form.status,
        },
      })
      await qc.invalidateQueries({ queryKey: ['crm', 'workflows'] })
      toast.success(wf ? 'Workflow updated' : 'Workflow saved')
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save workflow'))
    }
  }

  const formId = wf ? `workflow-form-${wf.id}` : 'workflow-form-new'
  const inputClsLocal = 'h-8 text-sm'

  return (
    <CrmModal
      title={wf ? 'Edit workflow' : 'New workflow'}
      onClose={onClose}
      maxW="w-full max-w-md"
      footer={
        <>
          {!form.steps.length && (
            <p className="mr-auto text-[11px] text-amber-600">Add at least one step to save.</p>
          )}
          <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} className="h-8 rounded-md px-3 text-sm" disabled={save.isPending || !form.steps.length}>
            {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-2.5">
        <Field label="Name" required>
          <Input
            className={inputClsLocal}
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Welcome new lead"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Input
            className={inputClsLocal}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="What does this automate?"
          />
        </Field>
        <Field label="When to run" required>
          <Select
            value={form.trigger}
            onChange={v => setForm(p => ({ ...p, trigger: v }))}
            triggerClassName={inputClsLocal}
            options={WORKFLOW_TRIGGERS.map(t => ({ value: t.id, label: t.label }))}
          />
        </Field>
        <Field label="Then do">
          <WorkflowStepBuilder
            steps={form.steps}
            onChange={(steps: WorkflowStep[]) => setForm(p => ({ ...p, steps }))}
            templates={(templates ?? []).map(t => ({ id: t.id, name: t.name }))}
            teamOptions={teamOptions}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Status" className="min-w-[7.5rem] flex-1">
            <Select
              value={form.status}
              onChange={v => setForm(p => ({ ...p, status: v }))}
              triggerClassName={inputClsLocal}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
              ]}
            />
          </Field>
          <label className="mb-0.5 flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={form.requires_approval}
              onChange={e => setForm(p => ({ ...p, requires_approval: e.target.checked }))}
            />
            Require approval
          </label>
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
    if (!await askConfirm('Delete this workflow?')) return
    await crmApi.deleteWorkflow(id)
    qc.invalidateQueries({ queryKey: ['crm', 'workflows'] })
  }

  const triggerLabel = (trigger: Record<string, unknown>) =>
    WORKFLOW_TRIGGERS.find(t => t.id === trigger?.event)?.label || String(trigger?.event || '—')

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Automate follow-ups with triggers and step sequences
        </p>
        <Button className="h-8 gap-1.5 px-3 text-sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> New workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data?.length ? (
        <Card><CardContent className="p-12 text-center">
          <WorkflowIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">Automate follow-ups with triggers and visual steps.</p>
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
                    <p className="text-xs text-gray-500 mt-0.5">{triggerLabel(w.trigger)}</p>
                    <p className="text-xs text-gray-400">{w.steps?.length ?? 0} step(s)</p>
                  </div>
                  <Badge variant={w.status === 'active' ? 'success' : w.status === 'paused' ? 'warning' : 'secondary'}>{w.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-gray-50 rounded-md p-2 text-center">
                    <p className="text-gray-500">Runs</p>
                    <p className="font-semibold">{w.run_count}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-md p-2 text-center">
                    <p className="text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</p>
                    <p className="font-semibold text-emerald-700">{w.success_count}</p>
                  </div>
                  <div className="bg-rose-50 rounded-md p-2 text-center">
                    <p className="text-rose-600 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> Fail</p>
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
