import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useAssets, useCreateAsset, useRunDepreciation, useDisposeAsset, useAssetCategories, useCreateAssetCategory } from '@/hooks/useFinance'
import { Plus, Zap, Trash2, X } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  disposed: 'bg-red-100 text-red-600',
  under_maintenance: 'bg-yellow-100 text-yellow-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export default function FixedAssets() {
  const [tab, setTab] = useState<'assets' | 'categories'>('assets')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({
    asset_code: '', name: '', acquisition_date: new Date().toISOString().slice(0, 10),
    purchase_cost: '', salvage_value: '', useful_life_years: '5',
    depreciation_method: 'straight_line', location: '', serial_number: '', notes: ''
  })

  const { data: assets = [], isLoading } = useAssets()
  const { data: categories = [] } = useAssetCategories()
  const createMut = useCreateAsset()
  const depMut = useRunDepreciation()
  const disposeMut = useDisposeAsset()
  const createCatMut = useCreateAssetCategory()

  useEscapeToClose(() => setShowNew(false), showNew)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fixed Assets</h1>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      <div className="flex gap-2">
        {(['assets', 'categories'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border capitalize ${tab === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'assets' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Code', 'Name', 'Acquisition', 'Cost', 'Current Value', 'Accum Dep', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : (assets as any[]).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No assets registered yet.</td></tr>
              ) : (assets as any[]).map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{a.asset_code}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{a.name}</td>
                  <td className="px-4 py-2 text-gray-600">{a.acquisition_date}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(a.purchase_cost || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-700">{fmt(a.current_value || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-500">{fmt(a.accumulated_depreciation || 0)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {a.status === 'active' && (
                        <>
                          <button onClick={() => depMut.mutate(a.id)} title="Run Depreciation"
                            disabled={depMut.isPending}
                            className="p-1 text-yellow-600 hover:text-yellow-800 disabled:opacity-50">
                            <Zap className="w-4 h-4" />
                          </button>
                          <button onClick={() => disposeMut.mutate({ id: a.id, data: { disposal_date: new Date().toISOString().slice(0,10), disposal_method: 'scrapped', sale_price: 0 } })}
                            title="Dispose" disabled={disposeMut.isPending}
                            className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(categories as any[]).map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="font-semibold text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-500 mt-1 capitalize">{c.depreciation_method?.replace('_', ' ')} · {c.useful_life_years} years</p>
              <p className="text-xs text-gray-400">Salvage: {c.salvage_pct}%</p>
            </div>
          ))}
          {(categories as any[]).length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500 text-sm bg-white rounded-xl border border-gray-200">No categories yet.</div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="font-semibold text-lg">Register New Asset</h2></div>

              <button type="button" aria-label="Close"
                type="button"
                onClick={() => setShowNew(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Asset Code', key: 'asset_code' },
                { label: 'Name', key: 'name' },
                { label: 'Acquisition Date', key: 'acquisition_date', type: 'date' },
                { label: 'Purchase Cost', key: 'purchase_cost', type: 'number' },
                { label: 'Salvage Value', key: 'salvage_value', type: 'number' },
                { label: 'Useful Life (years)', key: 'useful_life_years', type: 'number' },
                { label: 'Location', key: 'location' },
                { label: 'Serial Number', key: 'serial_number' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type || 'text'} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Depreciation Method</label>
              <select value={form.depreciation_method} onChange={e => setForm(f => ({ ...f, depreciation_method: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="straight_line">Straight Line</option>
                <option value="wdv">Written Down Value</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowNew(false)} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createMut.mutate({ ...form, purchase_cost: Number(form.purchase_cost), salvage_value: Number(form.salvage_value), useful_life_years: Number(form.useful_life_years) }, { onSuccess: () => setShowNew(false) })}
                disabled={createMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createMut.isPending ? 'Saving…' : 'Register Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
