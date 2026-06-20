import { useState } from 'react'
import { formLabelClass } from '@/components/common/FormSectionNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { CheckCircle, RotateCcw, Filter, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useAccruals, useApproveAccrual, useReverseAccrual, useBulkApproveAccruals } from '@/hooks/useCommission'
import {
  ACCRUAL_STATUS_COLORS,
  commissionEmptyCell,
  commissionFilterBtn,
  commissionFilterPanel,
  commissionInfoBanner,
  commissionPageSub,
  commissionPageTitle,
  commissionPaginationActive,
  commissionPaginationInactive,
  commissionRowHover,
  commissionTableIconBtn,
  commissionTableShell,
  commissionTbody,
  commissionThead,
  commissionTh,
} from '@/pages/commission/commissionUi'

const CHANNELS = ['', 'pos', 'online', 'booking']
const STATUSES = ['', 'accrued', 'approved', 'paid', 'reversed', 'disputed']

export default function AccrualsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({
    status: '', channel: '', date_from: '', date_to: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const params = { page, size: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, isLoading } = useAccruals(params)
  const approve = useApproveAccrual()
  const reverse = useReverseAccrual()
  const bulkApprove = useBulkApproveAccruals()

  const items = data?.items || []
  const pages = data?.pages || 1
  const total = data?.total || 0

  const handleApprove = async (id: string) => {
    try { await approve.mutateAsync(id); toast.success('Accrual approved') }
    catch { toast.error('Failed to approve') }
  }

  const handleReverse = async (id: string) => {
    if (!confirm('Reverse this accrual? This cannot be undone.')) return
    try { await reverse.mutateAsync(id); toast.success('Reversed') }
    catch { toast.error('Failed to reverse') }
  }

  const handleBulkApprove = async () => {
    if (!confirm('Approve all accrued accruals?')) return
    try {
      const r = await bulkApprove.mutateAsync(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
      toast.success(`Approved ${r.approved} accruals`)
    } catch { toast.error('Bulk approve failed') }
  }

  const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const fmtPoints = (v: number) => (v === 0 ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 }))
  const fmtEquity = (v: number) => (v === 0 ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 6 }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={commissionPageTitle}>Commission Accruals</h1>
          <p className={commissionPageSub}>{total} accruals found</p>
          <p className={commissionInfoBanner}>
            <strong className="font-medium">Points</strong> rules earn <strong>points</strong>, not rupees — check the <em>Points</em> column.
            For currency commission, edit the plan rule and use <strong>percentage</strong> or <strong>flat</strong>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => setShowFilters(p => !p)} className={commissionFilterBtn}>
            <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3 w-3" />
          </button>
          <Button onClick={handleBulkApprove} disabled={bulkApprove.isPending} className="gap-2">
            <CheckCircle className="h-4 w-4" /> Bulk Approve
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className={`${commissionFilterPanel} grid grid-cols-4 gap-4`}>
          <div>
            <Label className={`block mb-1 ${formLabelClass}`}>Status</Label>
            <Select
              value={filters.status}
              onChange={(v) => setFilters(p => ({ ...p, status: v }))}
              options={STATUSES.map(s => ({ value: s, label: s || 'All' }))}
              aria-label="Status filter"
              className="w-full"
            />
          </div>
          <div>
            <Label className={`block mb-1 ${formLabelClass}`}>Channel</Label>
            <Select
              value={filters.channel}
              onChange={(v) => setFilters(p => ({ ...p, channel: v }))}
              options={CHANNELS.map(c => ({ value: c, label: c || 'All' }))}
              aria-label="Channel filter"
              className="w-full"
            />
          </div>
          <div>
            <Label className={`block mb-1 ${formLabelClass}`}>From</Label>
            <Input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(p => ({ ...p, date_from: e.target.value }))}
              className="h-9"
            />
          </div>
          <div>
            <Label className={`block mb-1 ${formLabelClass}`}>To</Label>
            <Input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(p => ({ ...p, date_to: e.target.value }))}
              className="h-9"
            />
          </div>
        </div>
      )}

      <div className={commissionTableShell}>
        <table className="w-full text-sm">
          <thead className={commissionThead}>
            <tr>
              {['Date', 'Source', 'Payee', 'Channel', 'Base', 'Type', 'Commission', 'Points', 'Equity', 'Status', ''].map(h => (
                <th key={h} className={commissionTh}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={commissionTbody}>
            {isLoading ? (
              <tr><td colSpan={11} className={commissionEmptyCell}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} className={commissionEmptyCell}>No accruals found</td></tr>
            ) : items.map(a => (
              <tr key={a.id} className={commissionRowHover}>
                <td className="px-4 py-3 text-muted-foreground">{a.sale_date}</td>
                <td className="px-4 py-3">
                  <div className="text-xs font-mono text-muted-foreground">{a.source_type}/{a.source_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground/80">{a.source_line_ref}</div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{a.payee_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{a.channel || '—'}</td>
                <td className="px-4 py-3 text-foreground">{fmtCurrency(a.base_amount)}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize text-xs">{a.calculation_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{fmtCurrency(a.commission_amount ?? 0)}</td>
                <td className="px-4 py-3 text-foreground tabular-nums">{fmtPoints(a.points_amount ?? 0)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{fmtEquity(a.equity_units_amount ?? 0)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACCRUAL_STATUS_COLORS[a.status] || 'bg-muted text-muted-foreground'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    {a.status === 'accrued' && (
                      <button type="button" onClick={() => handleApprove(a.id)} title="Approve"
                        className={`${commissionTableIconBtn} hover:text-emerald-500 dark:hover:text-emerald-400`}>
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {['accrued', 'approved'].includes(a.status) && (
                      <button type="button" onClick={() => handleReverse(a.id)} title="Reverse"
                        className={`${commissionTableIconBtn} hover:text-red-500 dark:hover:text-red-400`}>
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
            <button key={i} type="button" onClick={() => setPage(i + 1)}
              className={page === i + 1 ? commissionPaginationActive : commissionPaginationInactive}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
