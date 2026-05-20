import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import * as api from '@/api/finance'
import { cn } from '@/lib/utils'
import { Lock, Unlock, XCircle, Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import { finKeys } from '@/hooks/useFinance'
import { formatIsoDate, isAuditWindowAfterFyEnd } from '@/lib/fiscalYearPreview'
import { toast } from 'sonner'

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-emerald-100 text-emerald-800' },
  locked: { label: 'Locked', cls: 'bg-amber-100 text-amber-800' },
  closed: { label: 'Closed', cls: 'bg-slate-200 text-slate-700' },
}

type FyRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  variant_code?: string
  companies?: { company_id: string; is_current: boolean }[]
}

type Company = { id: string; code: string; name: string }

type Props = {
  company: Company
  /** Fiscal years that include this company (from list-all). */
  fiscalYears: FyRow[]
  defaultExpanded?: boolean
  /**
   * When set, the row registers a function the Period Control page can call to try saving
   * the "add audit" form. Returns: 0 = nothing to do, 1 = submitted, 2 = validation error (toast shown).
   */
  registerPageAuditSave?: (companyId: string, trySave: () => 0 | 1 | 2) => () => void
}

export default function CompanyFiscalRow({
  company,
  fiscalYears,
  defaultExpanded = false,
  registerPageAuditSave,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [fyId, setFyId] = useState('')
  const [periodDetailId, setPeriodDetailId] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded || fiscalYears.length === 0) return
    if (!fyId || !fiscalYears.some(f => f.id === fyId)) {
      setFyId(fiscalYears[0].id)
    }
  }, [expanded, fiscalYears, fyId])

  const fy = fiscalYears.find(f => f.id === fyId)
  const currentMeta = fy?.companies?.find(c => c.company_id === company.id)

  const queryClient = useQueryClient()
  const { data: periods = [], isLoading: perLoad } = useQuery({
    queryKey: finKeys.periods(fyId),
    queryFn: () => api.listPeriods(fyId),
    enabled: expanded && !!fyId,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] })
    if (fyId) void queryClient.invalidateQueries({ queryKey: finKeys.periods(fyId) })
  }

  const [addAuditName, setAddAuditName] = useState('Audit / adjustment')
  const [addAuditStart, setAddAuditStart] = useState('')
  const [addAuditEnd, setAddAuditEnd] = useState('')

  const addAuditMut = useMutation({
    mutationFn: (data: { name: string; start_date: string; end_date: string }) =>
      api.addFiscalYearAuditPeriod(fyId, data),
    onSuccess: () => {
      toast.success('Audit / adjustment period added')
      setAddAuditStart('')
      setAddAuditEnd('')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: unknown } } }) =>
      toast.error(
        typeof e?.response?.data?.detail === 'string'
          ? e.response.data.detail
          : 'Could not add audit period',
        { duration: 10_000 },
      ),
  })

  const closeMut = useMutation({
    mutationFn: (id: string) => api.closePeriod(id),
    onSuccess: () => { toast.success('Period closed'); invalidate() },
  })
  const lockMut = useMutation({
    mutationFn: (id: string) => api.lockPeriod(id),
    onSuccess: () => { toast.success('Period locked for posting'); invalidate() },
  })
  const reopenMut = useMutation({
    mutationFn: (id: string) => api.reopenPeriod(id),
    onSuccess: () => { toast.success('Period reopened'); invalidate() },
  })

  const commitAddAudit = useCallback(
    (silentIfIncomplete: boolean) => {
      if (!fyId) {
        if (!silentIfIncomplete) toast.error('Select a fiscal year.')
        return 0
      }
      if (!addAuditName.trim() || !addAuditStart || !addAuditEnd) {
        if (!silentIfIncomplete) {
          toast.error('Enter name, start date, and end date for the audit period')
        }
        return 0
      }
      if (fy) {
        if (!isAuditWindowAfterFyEnd(addAuditStart, addAuditEnd, fy.end_date)) {
          const detail =
            addAuditEnd < addAuditStart
              ? 'Audit end must be on or after the start date.'
              : `The audit window must start after this fiscal year ends (${formatIsoDate(fy.end_date)}).`
          toast.error(detail, { duration: 10_000 })
          return 2
        }
      }
      addAuditMut.mutate({
        name: addAuditName.trim(),
        start_date: addAuditStart,
        end_date: addAuditEnd,
      })
      return 1
    },
    [addAuditName, addAuditStart, addAuditEnd, addAuditMut, fy, fyId],
  )

  const onAddAudit = (e: React.FormEvent) => {
    e.preventDefault()
    commitAddAudit(false)
  }

  useEffect(() => {
    if (!registerPageAuditSave || !expanded || fiscalYears.length === 0) return
    return registerPageAuditSave(company.id, () => commitAddAudit(true))
  }, [registerPageAuditSave, company.id, expanded, fiscalYears.length, commitAddAudit])

  const nCal = fiscalYears.length

  return (
    <div
      className={cn(
        'border border-slate-200 rounded-lg overflow-hidden bg-white',
        expanded && 'ring-1 ring-emerald-200/80',
      )}
    >
      <button
        type="button"
        onClick={() => { setExpanded(e => !e) }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
        aria-expanded={expanded}
      >
        <ChevronRight
          className={cn('w-5 h-5 text-slate-500 shrink-0 transition-transform', expanded && 'rotate-90')}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            <span className="font-mono text-indigo-700">{company.code}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            {company.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {nCal === 0
              ? 'No fiscal calendars linked yet — use Add calendar to create one.'
              : `${nCal} linked calendar${nCal === 1 ? '' : 's'}`}
            {currentMeta?.is_current && fy && (
              <span className="ml-2 text-emerald-700 font-medium">
                · Current: [{fy.variant_code ?? '—'}] {fy.name}
              </span>
            )}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4 bg-white">
          {fiscalYears.length === 0 ? null : (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Fiscal year for this business unit</label>
                <select
                  value={fyId}
                  onChange={e => { setFyId(e.target.value) }}
                  className="mt-1 w-full max-w-2xl border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {fiscalYears.map(f => (
                    <option key={f.id} value={f.id}>
                      [{f.variant_code ?? '—'}] {f.name} ({f.start_date} – {f.end_date})
                      {f.companies?.find(c => c.company_id === company.id)?.is_current ? ' — current' : ''}
                    </option>
                  ))}
                </select>
                {fy && (
                  <p className="text-xs text-slate-500 mt-1">Range: {fy.start_date} to {fy.end_date}</p>
                )}
              </div>

              <form
                onSubmit={onAddAudit}
                className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2"
              >
                <h4 className="text-xs font-semibold text-slate-800">Add audit / adjustment period</h4>
                <p className="text-[11px] text-slate-600">
                  Use <strong className="text-slate-700">Save</strong> at the top or bottom of this page to store the
                  period. Post-close window, starting after{' '}
                  {fy ? <strong>{formatIsoDate(fy.end_date)}</strong> : 'FY end'}. A range that spans
                  more than one month is stored as one period per month.
                </p>
                <div className="grid sm:grid-cols-3 gap-2">
                  <input
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                    value={addAuditName}
                    onChange={e => { setAddAuditName(e.target.value) }}
                    placeholder="Label"
                  />
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                    value={addAuditStart}
                    onChange={e => { setAddAuditStart(e.target.value) }}
                  />
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                    value={addAuditEnd}
                    onChange={e => { setAddAuditEnd(e.target.value) }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">Press Enter in a field to save (same as Save on this page).</p>
              </form>

              {perLoad && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading periods…
                </div>
              )}

              {!perLoad && fyId && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Periods</h4>
                  <ul className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                    {(periods as { id: string; name: string; start_date: string; end_date: string; status: string; period_number?: number; period_kind?: string }[]).map(p => {
                      const st = STATUS[p.status] || STATUS.open
                      const busy = closeMut.isPending || lockMut.isPending || reopenMut.isPending
                      const isAudit = p.period_kind === 'audit'
                      const showDetail = periodDetailId === p.id
                      return (
                        <li
                          key={p.id}
                          className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 px-4 py-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-sm font-semibold text-slate-800">
                                  {p.name}
                                  {p.period_number != null && (
                                    <span className="text-slate-500 font-normal">{' '}#{p.period_number}</span>
                                  )}
                                </span>
                                {isAudit && (
                                  <span
                                    className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30/80"
                                  >
                                    Audit
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-slate-600 font-mono tabular-nums sm:border-l sm:border-slate-200 sm:pl-3">
                                {p.start_date} - {p.end_date}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0">
                              <span
                                className={cn(
                                  'inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border',
                                  st.cls,
                                  p.status === 'open' ? 'border-emerald-200/80' : 'border-transparent',
                                )}
                              >
                                {st.label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {p.status === 'open' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => { if (confirm('Lock this period? Posting to this range will be blocked.')) lockMut.mutate(p.id) }}
                                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                      Lock
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => { if (confirm('Close this period? You can still reopen for corrections with admin rights.')) closeMut.mutate(p.id) }}
                                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-300 bg-slate-100/80 text-slate-800 hover:bg-slate-200/80 disabled:opacity-50"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      Close
                                    </button>
                                  </>
                                )}
                                {(p.status === 'locked' || p.status === 'closed') && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => { if (confirm('Reopen this period for new postings?')) reopenMut.mutate(p.id) }}
                                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                    Reopen
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => { setPeriodDetailId(showDetail ? null : p.id) }}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 -mr-1"
                                  aria-expanded={showDetail}
                                  title={showDetail ? 'Hide details' : 'Show details'}
                                >
                                  <ChevronDown
                                    className={cn('w-4 h-4 transition-transform', showDetail && 'rotate-180')}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                          {showDetail && (
                            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
                              <p>
                                <span className="font-semibold text-slate-500">Period ID:</span>{' '}
                                <code className="text-[11px] text-slate-700">{p.id}</code>
                              </p>
                              <p className="mt-1">
                                {isAudit
                                  ? 'Post-close audit window: entry dates in this range can post to GL; document date may be in the closed fiscal year.'
                                  : 'Standard month within the selected fiscal year.'}
                              </p>
                            </div>
                          )}
                        </li>
                      )
                    })}
                    {periods.length === 0 && !perLoad && (
                      <li className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        No periods for this year.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
