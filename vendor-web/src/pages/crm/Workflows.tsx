import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useWorkflows, useSaveWorkflow, useEmailTemplates } from '@/hooks/useCrm'
import { useTeamMembers } from '@/hooks/useVendor'
import { crmApi, type Workflow } from '@/api/crm'
import {
  Plus, Loader2, Edit3, Trash2, CheckCircle2, AlertCircle, Zap,
} from 'lucide-react'
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
              className="h-3.5 w-3.5 rounded border-gray-300"
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

  const triggerEvent = (trigger: Record<string, unknown>) =>
    String(trigger?.event || '—')

  const statusBadgeVariant = (status: string) => {
    if (status === 'active') return 'success' as const
    if (status === 'paused') return 'warning' as const
    return 'secondary' as const
  }

  return (
    <div className="w-full space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          Automate follow-ups with triggers and step sequences
        </p>
        <Button className="h-9 shrink-0 gap-1.5 px-3" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
        </div>
      ) : !data?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No workflows yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a workflow to send emails, assign tasks, or notify your team when CRM events fire.
            </p>
            <Button className="mt-4 h-9 gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-[repeat(auto-fill,minmax(28rem,1fr))]">
          {data.map((w) => {
            const steps = w.steps?.length ?? 0
            return (
              <Card
                key={w.id}
                className="overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="p-0">
                  <div className="flex items-start justify-between gap-2 border-b bg-muted/25 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-snug sm:text-base">{w.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{triggerLabel(w.trigger)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span
                          className="rounded-md border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          title={triggerEvent(w.trigger)}
                        >
                          {triggerEvent(w.trigger)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {steps} step{steps === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(w.status)} className="shrink-0 capitalize">
                      {w.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border/80 border-b text-center text-xs">
                    <div className="bg-muted/15 px-2 py-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Runs
                      </p>
                      <p className="mt-0.5 text-base font-semibold tabular-nums">{w.run_count}</p>
                    </div>
                    <div className="bg-emerald-500/8 px-2 py-2.5">
                      <p className="flex items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </p>
                      <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                        {w.success_count}
                      </p>
                    </div>
                    <div className="bg-destructive/8 px-2 py-2.5">
                      <p className="flex items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                        <AlertCircle className="h-3 w-3" /> Fail
                      </p>
                      <p className="mt-0.5 text-base font-semibold tabular-nums text-destructive">
                        {w.failure_count}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {w.last_run_at ? (
                        <>Last run {formatDateTime(w.last_run_at)}</>
                      ) : (
                        'Never run'
                      )}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2 text-xs"
                        onClick={() => setEdit(w)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(w.id)}
                        aria-label="Delete workflow"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showCreate && <WorkflowForm onClose={() => setShowCreate(false)} />}
      {edit && <WorkflowForm wf={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
