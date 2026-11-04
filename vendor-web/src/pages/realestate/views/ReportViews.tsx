import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { errMessage, reApi } from '@/api/realestate'
import { fieldClass, fmtMoney, humanize } from '../shared'
import { Kpi, Loading, ProjectFilter, SimpleTable } from './parts'
import type { Col } from './parts'

/**
 * Generic "KPIs + tables + action buttons" report. The backend returns the whole layout, so operational
 * overviews (leasing, facility, society, assets) share one renderer.
 */
type Format = 'text' | 'money' | 'number' | 'percent' | 'date' | 'badge'
type ReportParam = { name: string; label: string; type: string; required?: boolean; choices?: string[] }
type Report = {
  title: string
  period?: string
  kpis: { label: string; value: string | number; format: Format; tone?: 'bad' | 'good' | 'warn' | null }[]
  actions?: { label: string; path: string; method: string; params: ReportParam[]; confirm?: string }[]
  tables: { title: string; columns: { key: string; label: string; format: Format }[]; rows: Record<string, any>[] }[]
}

function fmt(v: unknown, f: Format): string {
  if (v === null || v === undefined || v === '') return '—'
  switch (f) {
    case 'money':
      return fmtMoney(Number(v))
    case 'percent':
      return typeof v === 'number' ? `${v}%` : String(v)
    case 'number':
      return typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)
    case 'date':
      return new Date(String(v)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    case 'badge':
      return humanize(String(v))
    default:
      return String(v)
  }
}

function ActionButton({ action, queryKey }: { action: NonNullable<Report['actions']>[number]; queryKey: unknown[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const run = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {}
      for (const p of action.params) {
        const raw = values[p.name] ?? ''
        if (p.required && raw === '') throw new Error(`${p.label} is required`)
        if (raw !== '') body[p.name] = raw
      }
      return reApi.post<{ message?: string }>(action.path, body)
    },
    onSuccess: (out) => {
      toast.success(out?.message ?? 'Done')
      setOpen(false)
      qc.invalidateQueries({ queryKey })
    },
    onError: (e) => toast.error(errMessage(e)),
  })
  const start = () => {
    if (action.params.length === 0 && !action.confirm) run.mutate()
    else setOpen(true)
  }
  return (
    <>
      <Button size="sm" onClick={start} disabled={run.isPending && !open}>{action.label}</Button>
      {open && (
        <ModalOverlay onClose={() => setOpen(false)}>
          <ModalPanel className="max-w-lg">
            <ModalHeader title={action.label} onClose={() => setOpen(false)} />
            <ModalBody>
              {action.confirm && <p className="mb-3 text-sm">{action.confirm}</p>}
              <div className="space-y-3">
                {action.params.map((p) => (
                  <div key={p.name}>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {p.label}{p.required && <span className="text-red-500"> *</span>}
                    </label>
                    {p.choices ? (
                      <select className={fieldClass} value={values[p.name] ?? ''} onChange={(e) => setValues((s) => ({ ...s, [p.name]: e.target.value }))}>
                        <option value="">—</option>
                        {p.choices.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
                      </select>
                    ) : (
                      <Input
                        type={p.type === 'date' ? 'date' : p.type === 'number' || p.type === 'money' ? 'number' : 'text'}
                        value={values[p.name] ?? ''}
                        onChange={(e) => setValues((s) => ({ ...s, [p.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="cancel" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => run.mutate()} disabled={run.isPending}>
                {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {action.label}
              </Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </>
  )
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv(d: Report) {
  const parts = [d.title + (d.period ? `  (${d.period})` : ''), '', 'Summary', ...d.kpis.map((k) => [k.label, k.value].map(csvCell).join(','))]
  for (const t of d.tables) {
    parts.push('', t.title, t.columns.map((c) => csvCell(c.label)).join(','))
    for (const r of t.rows) parts.push(t.columns.map((c) => csvCell(r[c.key])).join(','))
  }
  const url = URL.createObjectURL(new Blob([parts.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportView({ endpoint, filters = [] }: { endpoint: string; filters?: ('project' | 'dates')[] }) {
  const [projectId, setProjectId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const params = { project_id: projectId || undefined, from_date: from || undefined, to_date: to || undefined }
  const queryKey = ['re-report', endpoint, params]
  const q = useQuery({ queryKey, queryFn: () => reApi.report<Report>(endpoint, params), placeholderData: (prev) => prev })
  const d = q.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {filters.includes('project') && <ProjectFilter value={projectId} onChange={setProjectId} />}
          {filters.includes('dates') && (
            <>
              <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          {d?.period && <span className="text-xs text-muted-foreground">Showing {d.period}</span>}
        </div>
        {d && (
          <div className="flex flex-wrap justify-end gap-2">
            {d.actions?.map((a) => <ActionButton key={a.path} action={a} queryKey={queryKey} />)}
            {filters.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => exportCsv(d)}><Download className="h-4 w-4" /> Export CSV</Button>
            )}
          </div>
        )}
      </div>
      {q.isLoading || !d ? <Loading /> : <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {d.kpis.map((k) => <Kpi key={k.label} label={k.label} value={fmt(k.value, k.format)} tone={k.tone ?? undefined} />)}
      </div>
      {d.tables.map((t) => {
        const cols: Col<Record<string, any>>[] = t.columns.map((c) => ({
          key: c.key,
          label: c.label,
          right: c.format === 'money' || c.format === 'number' || c.format === 'percent',
          render: (r) => fmt(r[c.key], c.format),
        }))
        return (
          <div key={t.title}>
            <h3 className="mb-2 text-sm font-semibold">{t.title}</h3>
            <SimpleTable cols={cols} rows={t.rows} empty="Nothing to show" />
          </div>
        )
      })}
      </>}
    </div>
  )
}

export const LeasingOverview = () => <ReportView endpoint="/leasing/overview" />
export const Renewals = () => <ReportView endpoint="/leasing/renewals" />
export const FacilityOverview = () => <ReportView endpoint="/facility/overview" />
export const SocietyOverview = () => <ReportView endpoint="/society/overview" />
export const AssetsOverview = () => <ReportView endpoint="/assets/overview" />
export const WorkforceOverview = () => <ReportView endpoint="/workforce/overview" />
export const SalesMis = () => <ReportView endpoint="/reports/sales-mis" filters={['project', 'dates']} />
export const CollectionReport = () => <ReportView endpoint="/reports/collections" filters={['project', 'dates']} />
export const ProjectCostingReport = () => <ReportView endpoint="/reports/project-costing" filters={['project']} />
export const Profitability = () => <ReportView endpoint="/reports/profitability" filters={['project']} />
export const Occupancy = () => <ReportView endpoint="/reports/occupancy" filters={['project']} />
export const InventoryAgeing = () => <ReportView endpoint="/reports/inventory-ageing" filters={['project']} />

export default ReportView
