/**
 * CostBookings — full ledger of all CO cost bookings (production completions,
 * COGS issues, variance adjustments, WIP accruals) across all orders.
 */
import { useState, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Link } from 'react-router-dom'
import { ExternalLink, Receipt, TrendingDown, TrendingUp, DollarSign } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import { useManufacturingOrders } from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'

const BOOKING_TYPES = [
  { value: '', label: 'All booking types' },
  { value: 'production_completion', label: 'Production Completion' },
  { value: 'cogs_issue', label: 'COGS Issue' },
  { value: 'variance_adjustment', label: 'Variance Adjustment' },
  { value: 'wip_accrual', label: 'WIP Accrual' },
]

const bookingTypeColor = (t: string) => {
  const m: Record<string, string> = {
    production_completion: 'bg-blue-100 text-blue-700',
    cogs_issue: 'bg-red-100 text-red-700',
    variance_adjustment: 'bg-amber-100 text-amber-700',
    wip_accrual: 'bg-emerald-100 text-emerald-700',
  }
  return m[t] ?? 'bg-gray-100 text-gray-600'
}

const bookingTypeLabel = (t: string) =>
  BOOKING_TYPES.find(b => b.value === t)?.label ?? t.replace(/_/g, ' ')

interface CostBookingRow {
  id: string
  order_id: string
  order_no: string
  booking_type: string
  amount: string
  qty_basis: string | null
  unit_cost: string | null
  entry_date: string | null
  narration: string | null
  journal_entry_id: string | null
}

interface OrderWithBookings {
  id: string
  order_no: string
  cost_bookings: CostBookingRow[]
}

export default function CostBookingsPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [bookingType, setBookingType] = useState('')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: orders = [], isLoading } = useManufacturingOrders({
    company_id: activeCo || undefined,
  })

  // Flatten all bookings from all orders
  const allBookings: CostBookingRow[] = useMemo(() => {
    const ordersArr = orders as OrderWithBookings[]
    const flat: CostBookingRow[] = []
    for (const o of ordersArr) {
      for (const bk of o.cost_bookings ?? []) {
        flat.push({ ...bk, order_no: o.order_no, order_id: o.id })
      }
    }
    return flat.filter(b => !bookingType || b.booking_type === bookingType)
  }, [orders, bookingType])

  const totalByType = useMemo(() => {
    const agg: Record<string, number> = {}
    for (const b of allBookings) {
      agg[b.booking_type] = (agg[b.booking_type] ?? 0) + parseFloat(b.amount)
    }
    return agg
  }, [allBookings])

  const grandTotal = allBookings.reduce((s, b) => s + parseFloat(b.amount), 0)

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cost Bookings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Full ledger of all CO cost bookings — production completions, COGS issues, WIP accruals and variance adjustments.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Total bookings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{allBookings.length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-blue-600">Production completions</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">
            {formatCurrency(totalByType['production_completion'] ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-600">COGS issued</span>
          </div>
          <p className="text-2xl font-bold text-red-700">
            {formatCurrency(totalByType['cogs_issue'] ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-accent p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary/80" />
            <span className="text-xs text-primary">Grand total posted</span>
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
            {companies.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        )}
        <select value={bookingType} onChange={e => setBookingType(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {BOOKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Booking by type summary */}
      {Object.keys(totalByType).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BOOKING_TYPES.filter(t => t.value && totalByType[t.value] !== undefined).map(t => (
            <div key={t.value} className="rounded-lg border border-gray-100 bg-white p-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bookingTypeColor(t.value)}`}>
                {t.label}
              </span>
              <p className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(totalByType[t.value] ?? 0)}</p>
              <p className="text-xs text-gray-400">
                {allBookings.filter(b => b.booking_type === t.value).length} entries
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Bookings table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-800 text-sm">Booking Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Order</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Booking Type</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Date</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Qty Basis</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Unit Cost</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right"><TableColumnLabel>Amount</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>Narration</TableColumnLabel></th>
                <th className="px-4 py-3 font-medium text-gray-600"><TableColumnLabel>GL</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && allBookings.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No cost bookings found. Post a production completion or COGS issue from an order.
                  </td>
                </tr>
              )}
              {allBookings.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/controlling/orders/${b.order_id}`}
                      className="font-mono text-xs text-primary hover:underline flex items-center gap-1">
                      {b.order_no} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bookingTypeColor(b.booking_type)}`}>
                      {bookingTypeLabel(b.booking_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.entry_date ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {b.qty_basis ? parseFloat(b.qty_basis).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {b.unit_cost ? formatCurrency(parseFloat(b.unit_cost)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(parseFloat(b.amount))}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate text-xs">{b.narration ?? '—'}</td>
                  <td className="px-4 py-3">
                    {b.journal_entry_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Posted
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {allBookings.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold text-sm border-t border-gray-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
