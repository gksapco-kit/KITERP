import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useKanban, useMoveDeal, usePipelines, useSaveDeal, useForecast } from '@/hooks/useCrm'
import { useHREmployees } from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { Deal, Stage } from '@/api/crm'
import { crmApi } from '@/api/crm'
import type { EmployeeProfile } from '@/types'
import { Plus, Loader2, GitBranch, TrendingUp, Paperclip, Trash2, FileText, User } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { modalWidthMd } from '@/lib/modalUi'
import { CURRENCIES, currencySymbol, amountInWords, CrmDateTimeField } from './crmExtras'
import { DealDetail } from './DealDetail'
import { formatCurrency, formatDate } from '@/lib/utils'

type CustomRow = { id: number; key: string; value: string }

function DealForm({ pipelineId, stageId, onClose }: { pipelineId: string; stageId?: string; onClose: () => void }) {
  const save = useSaveDeal()
  const { data: pipelines } = usePipelines()
  const pipeline = pipelines?.find(p => p.id === pipelineId)
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empName = (e: EmployeeProfile) => e.vendor_user?.user?.full_name ?? e.employee_code
  const user = useAuthStore(st => st.user)
  const meName = user?.full_name || user?.email || 'Me'

  const [form, setForm] = useState({
    title: '', amount: '', currency: 'INR', stage_id: stageId || pipeline?.stages?.[0]?.id || '',
    expected_close_date: '', description: '', source: '', owner: meName,
  })
  const [docs, setDocs] = useState<{ url: string; filename: string }[]>([])
  const [custom, setCustom] = useState<CustomRow[]>([])
  const [seq, setSeq] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!form.stage_id && pipeline?.stages?.length) {
      setForm(p => ({ ...p, stage_id: stageId || pipeline.stages[0].id }))
    }
  }, [pipeline, stageId, form.stage_id])

  const onDocs = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        const d = await crmApi.uploadDocument(f)
        setDocs(prev => [...prev, { url: d.url, filename: d.filename }])
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.stage_id) return
    const customFields: Record<string, unknown> = {}
    if (form.owner.trim()) customFields.owner_name = form.owner.trim()
    if (docs.length) customFields.documents = docs
    for (const r of custom) {
      const k = r.key.trim()
      if (k) customFields[k] = r.value.trim()
    }
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
          custom_fields: Object.keys(customFields).length ? customFields : undefined,
        },
      },
      { onSuccess: onClose },
    )
  }

  const formId = 'deal-form-new'

  return (
    <CrmModal
      title="Add deal"
      onClose={onClose}
      maxW={modalWidthMd}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save deal
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3 pb-4">
        <Field label="Title" required>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </Field>
        <div>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <Field label="Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">{currencySymbol(form.currency)}</span>
                  <Input type="number" min="0" className="pl-7" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
              </Field>
            </div>
            <div className="w-36 shrink-0">
              <Field label="Currency">
                <Select
                  className="w-36 shrink-0"
                  value={form.currency}
                  onChange={v => setForm(p => ({ ...p, currency: v }))}
                  options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code}` }))}
                />
              </Field>
            </div>
          </div>
          {form.amount && Number(form.amount) > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {formatCurrency(Number(form.amount), form.currency)} — {amountInWords(Number(form.amount))} {form.currency}
            </p>
          )}
        </div>
        <Field label="Stage">
          <Select
            value={form.stage_id}
            onChange={v => setForm(p => ({ ...p, stage_id: v }))}
            options={(pipeline?.stages ?? []).map(s => ({ value: s.id, label: s.name }))}
          />
        </Field>
        <Field label="Expected close">
          <CrmDateTimeField
            value={form.expected_close_date}
            onChange={v => setForm(p => ({ ...p, expected_close_date: v }))}
            scheduleAccent
          />
        </Field>
        <Field label="Source"><Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} /></Field>
        <Field label="Deal owner">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Select
              className="pl-9"
              value={form.owner}
              onChange={v => setForm(p => ({ ...p, owner: v }))}
              options={[
                { value: meName, label: `${meName} (me)` },
                ...employees.filter(e => empName(e) !== meName).map(e => ({
                  value: empName(e),
                  label: empName(e),
                })),
              ]}
            />
          </div>
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>

        {/* Attachments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Attachments</p>
            {uploading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {docs.length > 0 && (
            <ul className="space-y-1.5">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-sm text-blue-600 hover:underline">{d.filename}</a>
                  <button type="button" onClick={() => setDocs(prev => prev.filter((_, n) => n !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileRef} type="file" multiple className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={e => onDocs(e.target.files)} />
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Paperclip className="w-4 h-4 mr-2" /> Attach document(s)
          </Button>
        </div>

        {/* Add more details (custom fields) */}
        {custom.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">More details</p>
            {custom.map(r => (
              <div key={r.id} className="flex gap-2">
                <Input value={r.key} onChange={e => setCustom(prev => prev.map(x => x.id === r.id ? { ...x, key: e.target.value } : x))} placeholder="Field name" className="flex-1" />
                <Input value={r.value} onChange={e => setCustom(prev => prev.map(x => x.id === r.id ? { ...x, value: e.target.value } : x))} placeholder="Value" className="flex-1" />
                <Button type="button" variant="cancel" size="icon" aria-label="Remove" onClick={() => setCustom(prev => prev.filter(x => x.id !== r.id))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" className="w-full"
          onClick={() => { setCustom(prev => [...prev, { id: seq, key: '', value: '' }]); setSeq(s => s + 1) }}>
          <Plus className="w-4 h-4 mr-2" /> Add field
        </Button>
      </form>
    </CrmModal>
  )
}

function DealCard({ deal, onDragStart, onOpen }: { deal: Deal; onDragStart: (e: React.DragEvent) => void; onOpen: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <p className="line-clamp-2 text-sm font-medium text-foreground">
        {deal.number && <span className="mr-1 font-mono text-xs text-muted-foreground">{deal.number}</span>}
        {deal.title}
      </p>
      <p className="mt-1 text-base font-semibold text-primary">{formatCurrency(deal.amount, deal.currency)}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
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
  const [openDealId, setOpenDealId] = useState<string | null>(null)
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

  const openDealCount = kanban?.columns?.reduce((n, c) => n + c.deals.length, 0) ?? 0
  const stageCount = kanban?.columns?.length ?? 0

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CRM</p>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Sales Pipeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="h-8 w-44 text-sm"
            value={pipelineId}
            onChange={setPipelineId}
            options={(pipelines ?? []).map(p => ({ value: p.id, label: p.name }))}
            wrapperClassName="w-44 shrink-0"
          />
          <Button className="h-8 gap-1.5 px-3 text-sm" onClick={() => setShowCreate({})}>
            <Plus className="h-4 w-4" /> Add deal
          </Button>
        </div>
      </div>

      {forecast && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <div className="bg-card px-3 py-2.5 sm:px-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pipeline value</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {formatCurrency(forecast.total_value || 0)}
            </p>
          </div>
          <div className="bg-card px-3 py-2.5 sm:px-4">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Weighted
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-primary sm:text-lg">
              {formatCurrency(forecast.weighted_value || 0)}
            </p>
          </div>
          <div className="bg-card px-3 py-2.5 sm:px-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Open deals</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">{openDealCount}</p>
          </div>
          <div className="bg-card px-3 py-2.5 sm:px-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Stages</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">{stageCount}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto pb-1">
          {kanban?.columns?.map(col => {
            const colTotal = col.deals.reduce((s, d) => s + (d.amount || 0), 0)
            return (
              <div
                key={col.stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop(col.stage)}
                className="flex max-h-[min(70vh,42rem)] min-h-[18rem] w-[min(100%,16rem)] min-w-[14rem] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted/40"
              >
                <div className="flex shrink-0 items-start gap-2 border-b border-border/60 bg-card/80 px-2.5 py-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2 pt-0.5">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: col.stage.color || 'hsl(var(--primary))' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-foreground" title={col.stage.name}>
                        {col.stage.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {col.deals.length} {col.deals.length === 1 ? 'deal' : 'deals'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreate({ stageId: col.stage.id })}
                    aria-label={`Add deal to ${col.stage.name}`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {col.deals.length ? (
                    col.deals.map(d => (
                      <DealCard key={d.id} deal={d} onDragStart={onDragStart(d)} onOpen={() => setOpenDealId(d.id)} />
                    ))
                  ) : (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/40 px-3 py-8">
                      <p className="text-center text-xs text-muted-foreground">Drop deals here</p>
                    </div>
                  )}
                </div>
                <div className="shrink-0 border-t border-border/60 bg-card px-3 py-2.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(colTotal)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && pipelineId && (
        <DealForm pipelineId={pipelineId} stageId={showCreate.stageId} onClose={() => setShowCreate(null)} />
      )}

      {openDealId && (
        <DealDetail dealId={openDealId} onClose={() => setOpenDealId(null)} />
      )}
    </div>
  )
}
