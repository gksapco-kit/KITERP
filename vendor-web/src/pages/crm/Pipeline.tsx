import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useKanban, useMoveDeal, usePipelines, useSaveDeal, useForecast } from '@/hooks/useCrm'
import type { Deal, Stage } from '@/api/crm'
import { Plus, Loader2, GitBranch, TrendingUp } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { formatCurrency, formatDate } from '@/lib/utils'

function DealForm({ pipelineId, stageId, onClose }: { pipelineId: string; stageId?: string; onClose: () => void }) {
  const save = useSaveDeal()
  const { data: pipelines } = usePipelines()
  const pipeline = pipelines?.find(p => p.id === pipelineId)
  const [form, setForm] = useState({
    title: '', amount: '', currency: 'INR', stage_id: stageId || pipeline?.stages?.[0]?.id || '',
    expected_close_date: '', description: '', source: '',
  })
  useEffect(() => {
    if (!form.stage_id && pipeline?.stages?.length) {
      setForm(p => ({ ...p, stage_id: stageId || pipeline.stages[0].id }))
    }
  }, [pipeline, stageId, form.stage_id])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.stage_id) return
    save.mutate(
      {
        data: {
          title: form.title,
          pipeline_id: pipelineId,
          stage_id: form.stage_id,
          amount: form.amount ? Number(form.amount) : 0,
          currency: form.currency,
          expected_close_date: form.expected_close_date || undefined,
          description: form.description || undefined,
          source: form.source || undefined,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <CrmModal title="Add deal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title" required>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></Field>
          <Field label="Currency"><Input value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} /></Field>
        </div>
        <Field label="Stage">
          <select value={form.stage_id} onChange={e => setForm(p => ({ ...p, stage_id: e.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {pipeline?.stages?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expected close"><Input type="date" value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></Field>
          <Field label="Source"><Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} /></Field>
        </div>
        <Field label="Description">
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save deal
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

function DealCard({ deal, onDragStart }: { deal: Deal; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-gray-900 line-clamp-2">{deal.title}</p>
      <p className="text-base font-semibold text-blue-600 mt-1">{formatCurrency(deal.amount, deal.currency)}</p>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>{deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'}</span>
        {deal.probability != null && <Badge variant="soft">{deal.probability}%</Badge>}
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const { data: pipelines } = usePipelines()
  const [pipelineId, setPipelineId] = useState<string>('')
  const [showCreate, setShowCreate] = useState<{ stageId?: string } | null>(null)
  const move = useMoveDeal()

  useEffect(() => {
    if (!pipelineId && pipelines?.length) setPipelineId(pipelines[0].id)
  }, [pipelines, pipelineId])

  const { data: kanban, isLoading } = useKanban(pipelineId ? { pipeline_id: pipelineId } : {})
  const { data: forecast } = useForecast(pipelineId ? { pipeline_id: pipelineId } : {}) as {
    data?: { total_value?: number; weighted_value?: number; by_stage?: Array<{ stage: string; count: number; value: number }> }
  }

  const onDragStart = (deal: Deal) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', deal.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDrop = (stage: Stage) => (e: React.DragEvent) => {
    e.preventDefault()
    const dealId = e.dataTransfer.getData('text/plain')
    if (dealId) move.mutate({ id: dealId, payload: { stage_id: stage.id } })
  }

  if (!pipelines?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <GitBranch className="w-12 h-12 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">No pipelines yet</h2>
        <p className="text-sm text-gray-500 mt-1">A default pipeline will be created automatically when you add your first deal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={pipelineId} onChange={e => setPipelineId(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-white px-3 text-sm">
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button onClick={() => setShowCreate({})}>
            <Plus className="w-4 h-4 mr-2" /> Add deal
          </Button>
        </div>
      </div>

      {forecast && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs uppercase text-gray-500">Pipeline value</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(forecast.total_value || 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Weighted</p>
              <p className="text-xl font-semibold text-emerald-600">{formatCurrency(forecast.weighted_value || 0)}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {forecast.by_stage?.map(s => (
                <Badge key={s.stage} variant="secondary">{s.stage}: {s.count} • {formatCurrency(s.value)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {kanban?.columns?.map(col => (
            <div key={col.stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(col.stage)}
              className="w-72 shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[70vh]">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.stage.color || '#6366f1' }} />
                  <p className="text-sm font-semibold truncate">{col.stage.name}</p>
                  <span className="text-xs text-gray-500">({col.deals.length})</span>
                </div>
                <button onClick={() => setShowCreate({ stageId: col.stage.id })}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-white">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {col.deals.length ? col.deals.map(d => (
                  <DealCard key={d.id} deal={d} onDragStart={onDragStart(d)} />
                )) : (
                  <p className="text-xs text-gray-400 text-center py-6">Drop deals here</p>
                )}
              </div>
              <div className="px-3 py-2 border-t bg-white text-xs text-gray-600">
                {formatCurrency(col.deals.reduce((s, d) => s + (d.amount || 0), 0))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && pipelineId && (
        <DealForm pipelineId={pipelineId} stageId={showCreate.stageId} onClose={() => setShowCreate(null)} />
      )}
    </div>
  )
}
