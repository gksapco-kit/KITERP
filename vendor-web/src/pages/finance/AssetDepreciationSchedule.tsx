import { useState } from 'react'
import { Select } from '@/components/ui/select'
import { useAssetCategories, useDepreciationScheduleReport } from '@/hooks/useFinance'
import { Download } from 'lucide-react'
import { downloadCsv, fmt } from './assetReportShared'

export default function AssetDepreciationSchedule() {
  const { data: categories = [] } = useAssetCategories()
  const [categoryId, setCategoryId] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const yearStart = `${new Date().getFullYear()}-01-01`
  const [fromDate, setFromDate] = useState(yearStart)
  const [toDate, setToDate] = useState(today)

  const scheduleQ = useDepreciationScheduleReport({
    from_date: fromDate, to_date: toDate, category_id: categoryId || undefined,
  })
  const schedule = scheduleQ.data as any

  const exportSchedule = () => {
    if (!schedule) return
    downloadCsv(`depreciation_schedule_${fromDate}_${toDate}.csv`,
      ['Date', 'Asset Code', 'Asset Name', 'Category', 'Amount', 'Book Value After'],
      schedule.entries.map((e: any) => [
        e.depreciation_date, e.asset_code, e.asset_name, e.category_name || '',
        e.amount.toFixed(2), e.book_value_after != null ? e.book_value_after.toFixed(2) : '',
      ]))
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Depreciation Schedule</h1>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="w-44">
          <Select
            value={categoryId}
            onChange={setCategoryId}
            options={[{ value: '', label: 'All Categories' }, ...categories.map((c: any) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        <button
          onClick={exportSchedule}
          disabled={!schedule}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {scheduleQ.isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !schedule ? (
        <p className="text-sm text-gray-500">No data.</p>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Total Depreciation ({fromDate} to {toDate})</p>
            <p className="text-lg font-mono font-semibold text-red-500">{fmt(schedule.total_amount)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Date', 'Asset Code', 'Asset Name', 'Category', 'Amount', 'Book Value After'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedule.entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No depreciation entries in this period.</td></tr>
                ) : schedule.entries.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{e.depreciation_date}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{e.asset_code}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{e.asset_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{e.category_name || '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-500">{fmt(e.amount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{e.book_value_after != null ? fmt(e.book_value_after) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
