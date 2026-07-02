import { useState } from 'react'
import { Select } from '@/components/ui/select'
import { useAssetCategories, useAssetRegisterReport } from '@/hooks/useFinance'
import { Download } from 'lucide-react'
import { STATUS_COLORS, downloadCsv, fmt } from './assetReportShared'

export default function AssetReports() {
  const { data: categories = [] } = useAssetCategories()
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const registerQ = useAssetRegisterReport({
    category_id: categoryId || undefined,
    status: status || undefined,
  })
  const register = registerQ.data as any

  const exportRegister = () => {
    if (!register) return
    downloadCsv(`fixed_asset_register_${today}.csv`,
      ['Asset Code', 'Name', 'Category', 'Status', 'Acquisition Date', 'Cost', 'Accumulated Depreciation', 'Net Book Value'],
      register.assets.map((a: any) => [
        a.asset_code, a.name, a.category_name, a.status, a.acquisition_date || '',
        a.cost.toFixed(2), a.accumulated_depreciation.toFixed(2), a.net_book_value.toFixed(2),
      ]))
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Asset Register</h1>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="w-44">
          <Select
            value={categoryId}
            onChange={setCategoryId}
            options={[{ value: '', label: 'All Categories' }, ...categories.map((c: any) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <div className="w-36">
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'disposed', label: 'Disposed' },
              { value: 'under_maintenance', label: 'Under Maintenance' },
            ]}
          />
        </div>
        <button
          onClick={exportRegister}
          disabled={!register}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {registerQ.isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !register ? (
        <p className="text-sm text-gray-500">No data.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Total Cost</p>
              <p className="text-lg font-mono font-semibold">{fmt(register.total_cost)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Total Accumulated Depreciation</p>
              <p className="text-lg font-mono font-semibold text-red-500">{fmt(register.total_accumulated_depreciation)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Total Net Book Value</p>
              <p className="text-lg font-mono font-semibold text-blue-700">{fmt(register.total_net_book_value)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">By Category</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {register.by_category.map((b: any) => (
                  <tr key={b.category_name}>
                    <td className="px-4 py-2">{b.category_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{b.count} asset{b.count === 1 ? '' : 's'}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(b.cost)}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-500">{fmt(b.accumulated_depreciation)}</td>
                    <td className="px-4 py-2 text-right font-mono text-blue-700">{fmt(b.net_book_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Code', 'Name', 'Category', 'Status', 'Acquisition', 'Cost', 'Accum Dep', 'NBV'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {register.assets.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No assets match these filters.</td></tr>
                ) : register.assets.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{a.asset_code}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{a.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{a.category_name}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{a.acquisition_date}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(a.cost)}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-500">{fmt(a.accumulated_depreciation)}</td>
                    <td className="px-4 py-2 text-right font-mono text-blue-700">{fmt(a.net_book_value)}</td>
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
