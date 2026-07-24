import { useState, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import { ArrowLeft, Play, CheckCircle, AlertTriangle, Clock, TrendingUp, BarChart2, X } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  usePeriodEndReport,
  useVarianceRuns,
  useCreateVarianceRun,
  usePostVarianceRun,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import type { VarianceRunOut } from '@/api/controlling'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const RUN_TYPES = [
  { value: 'production_variance', label: 'Production Variance' },
  { value: 'overhead_variance', label: 'Overhead Variance' },
  { value: 'price_variance', label: 'Price Variance' },
]

interface StatusCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
  urgent?: boolean
}

function StatusCard({ icon, label, value, sub, color = 'gray', urgent }: StatusCardProps) {
  const bg: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200',
    green: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    violet: 'bg-accent border-primary/30',
    blue: 'bg-blue-50 border-blue-200',
  }
  const text: Record<string, string> = {
    gray: 'text-gray-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    violet: 'text-primary',
    blue: 'text-blue-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${bg[color]} ${urgent ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={text[color]}>{icon}</div>
        <span className="text-xs text-gray-600">{label}</span>
        {urgent && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 ml-auto" />}
      </div>
      <p className={`text-2xl font-bold ${text[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function PeriodEndPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [showCreateRun, setShowCreateRun] = useState(false)
  const [runType, setRunType] = useState('production_variance')
  const [postRunId, setPostRunId] = useState<string | null>(null)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')

  useEscapeToClose(() => setShowCreateRun(false), showCreateRun)

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: report, isLoading: repLoading } = usePeriodEndReport(year, month, activeCo || undefined)
  const { data: vruns = [], isLoading: vLoading } = useVarianceRuns({
    company_id: activeCo || undefined,
    period_year: year,
    period_month: month,
  })

  const createRunMut = useCreateVarianceRun()
  const postRunMut = usePostVarianceRun()

  const handleCreateRun = async () => {
    setError('')
    try {
      await createRunMut.mutateAsync({
        company_id: activeCo,
        period_year: year,
        period_month: month,
        run_type: runType,
        run_date: new Date().toISOString().split('T')[0],
        narration: `${RUN_TYPES.find(r => r.value === runType)?.label} — ${MONTHS[month - 1]} ${year}`,
      })
      setShowCreateRun(false)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to create variance run')
    }
  }

  const handlePostRun = async () => {
    if (!postRunId) return
    setError('')
    try {
      await postRunMut.mutateAsync({ runId: postRunId, entry_date: entryDate || undefined })
      setPostRunId(null)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setError(e2?.response?.data?.detail ?? 'Failed to post variance run')
    }
  }

  const variance = report ? parseFloat(report.total_variance) : 0
  const varColor = variance < 0 ? 'red' : variance > 0 ? 'amber' : 'green'

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/controlling" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Period-End Closing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overhead absorption, variance settlement, period close checklist</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-3 items-center">
        {companies.length > 1 && (
          <Select
            value={activeCo}
            onChange={setCompanyId}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            options={companies.map(c => ({ value: String(c.id), label: String(c.code) }))}
          />
        )}
        <Select
          value={String(year)}
          onChange={v => setYear(Number(v))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          options={[currentYear - 1, currentYear, currentYear + 1].map(y => ({
            value: String(y),
            label: String(y),
          }))}
        />
        <Select
          value={String(month)}
          onChange={v => setMonth(Number(v))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
        <span className="text-sm font-medium text-gray-700 ml-2">
          Period: <strong>{MONTHS[month - 1]} {year}</strong>
        </span>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>}

      {/* Status cards */}
      {repLoading ? (
        <div className="text-gray-400 text-sm">Loading period-end report…</div>
      ) : report ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatusCard
            icon={<Clock className="w-5 h-5" />}
            label="Open orders (WIP)"
            value={report.open_orders}
            color={report.open_orders > 0 ? 'amber' : 'green'}
            urgent={report.open_orders > 0}
          />
          <StatusCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Completed orders"
            value={report.completed_orders}
            color="green"
          />
          <StatusCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="WIP actual cost"
            value={formatCurrency(parseFloat(report.total_actual))}
            color="blue"
          />
          <StatusCard
            icon={<BarChart2 className="w-5 h-5" />}
            label="Total variance"
            value={formatCurrency(Math.abs(variance))}
            sub={variance < 0 ? 'Over-absorption' : variance > 0 ? 'Under-absorption' : 'On target'}
            color={varColor}
          />
          <StatusCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Pending variance runs"
            value={report.pending_variance_runs}
            color={report.pending_variance_runs > 0 ? 'amber' : 'green'}
            urgent={report.pending_variance_runs > 0}
          />
          <StatusCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Pending allocations"
            value={report.pending_allocations}
            color={report.pending_allocations > 0 ? 'amber' : 'green'}
            urgent={report.pending_allocations > 0}
          />
          <StatusCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Goods movements"
            value={report.goods_movements_count}
            color="gray"
          />
          <StatusCard
            icon={<Clock className="w-5 h-5" />}
            label="Activity confirmations"
            value={report.activity_confirmations_count}
            color="gray"
          />
        </div>
      ) : null}

      {/* Period-end checklist */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Period-End Checklist</h2>
        <div className="space-y-2">
          {[
            { label: 'All goods movements posted', done: true },
            { label: 'All activity time confirmations posted', done: (report?.activity_confirmations_count ?? 0) > 0 },
            { label: 'Overhead rates set for all cost pools', done: true },
            { label: 'All open orders reviewed for WIP accrual', done: (report?.open_orders ?? 0) === 0 },
            { label: 'Cost center allocations complete', done: (report?.pending_allocations ?? 0) === 0 },
            { label: 'Variance runs created and posted', done: (report?.pending_variance_runs ?? 0) === 0 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <CheckCircle className={`w-4 h-4 shrink-0 ${item.done ? 'text-emerald-500' : 'text-gray-300'}`} />
              <span className={item.done ? 'text-gray-700' : 'text-gray-400 line-through'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Variance runs section */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Variance Runs</h2>
          <button
            onClick={() => setShowCreateRun(true)}
            className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 text-sm font-medium"
          >
            <Play className="w-3.5 h-3.5" /> Run Variance Calculation
          </button>
        </div>
        {vLoading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : (vruns as VarianceRunOut[]).length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No variance runs for {MONTHS[month - 1]} {year}. Click "Run Variance Calculation" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Run Date</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Orders</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Total Planned</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Total Actual</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Variance</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Price Var</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Usage Var</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(vruns as VarianceRunOut[]).map(vr => {
                const v = parseFloat(vr.total_variance)
                return (
                  <tr key={vr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{RUN_TYPES.find(r => r.value === vr.run_type)?.label ?? vr.run_type}</td>
                    <td className="px-4 py-3 text-gray-600">{vr.run_date}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{vr.order_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(parseFloat(vr.total_planned))}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(parseFloat(vr.total_actual))}</td>
                    <td className={`px-4 py-3 text-right font-medium ${v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : 'text-gray-700'}`}>
                      {v >= 0 ? '+' : ''}{formatCurrency(v)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(parseFloat(vr.price_variance))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(parseFloat(vr.usage_variance))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        vr.status === 'posted' ? 'bg-emerald-100 text-emerald-700' :
                        vr.status === 'reversed' ? 'bg-gray-100 text-gray-500' :
                        'bg-amber-100 text-amber-700'
                      }`}>{vr.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {vr.status === 'open' && (
                        <button
                          onClick={() => setPostRunId(vr.id)}
                          className="text-xs text-primary hover:text-primary flex items-center gap-1 whitespace-nowrap"
                        >
                          <Play className="w-3 h-3" /> Post to GL
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create variance run modal */}
      {showCreateRun && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreateRun(false)}>
          <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="text-lg font-semibold text-gray-900">Run Variance Calculation</h2></div>

              <button
                type="button"
                onClick={() => setShowCreateRun(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <p className="text-sm text-gray-500">
              Calculates planned vs actual variances across all completed orders for {MONTHS[month - 1]} {year}.
            </p>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Run Type</Label>
              <Select
                value={runType}
                onChange={setRunType}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                options={RUN_TYPES.map(r => ({ value: r.value, label: r.label }))}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowCreateRun(false)}
                className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button>
              <button onClick={handleCreateRun} disabled={createRunMut.isPending}
                className="flex-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {createRunMut.isPending ? 'Running…' : 'Calculate Variance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post variance run modal */}
      {postRunId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900">Post Variance to GL</h2>
            <p className="text-sm text-gray-500">
              This will post the variance amount to the production variance account in the general ledger.
            </p>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Entry Date</Label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setPostRunId(null)}
                className="btn-cancel flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button>
              <button onClick={handlePostRun} disabled={postRunMut.isPending}
                className="flex-1 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {postRunMut.isPending ? 'Posting…' : 'Post to GL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
