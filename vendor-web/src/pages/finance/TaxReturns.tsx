import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useTaxReturns, useCreateTaxReturn, useComputeTaxReturn, useFileTaxReturn, useTaxCodes, useCreateTaxCode } from '@/hooks/useFinance'
import { Plus, Calculator, Send, X } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  computed: 'bg-blue-100 text-blue-700',
  filed: 'bg-green-100 text-green-700',
  nil: 'bg-yellow-100 text-yellow-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export default function TaxReturns() {
  const [tab, setTab] = useState<'returns' | 'codes'>('returns')
  const [showNew, setShowNew] = useState(false)
  const [returnForm, setReturnForm] = useState({ return_type: 'GSTR1', period_start: '', period_end: '', due_date: '', notes: '' })
  const [showNewCode, setShowNewCode] = useState(false)
  const [codeForm, setCodeForm] = useState({ code: '', name: '', tax_type: 'CGST', rate: '' })

  const { data: returns = [], isLoading } = useTaxReturns()
  const { data: codes = [] } = useTaxCodes()
  const createMut = useCreateTaxReturn()
  const computeMut = useComputeTaxReturn()
  const fileMut = useFileTaxReturn()
  const createCodeMut = useCreateTaxCode()

  useEscapeToClose(() => setShowNew(false), showNew)
  useEscapeToClose(() => setShowNewCode(false), showNewCode)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tax Returns</h1>
        <div className="flex gap-2">
          {tab === 'returns' && (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
              <Plus className="w-4 h-4" /> New Return
            </button>
          )}
          {tab === 'codes' && (
            <button onClick={() => setShowNewCode(true)} className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
              <Plus className="w-4 h-4" /> New Tax Code
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(['returns', 'codes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border capitalize ${tab === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'returns' ? 'Tax Returns' : 'Tax Codes'}
          </button>
        ))}
      </div>

      {tab === 'returns' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Type', 'Period', 'Due Date', 'Tax Liability', 'ITC', 'Net Payable', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : (returns as any[]).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No tax returns yet.</td></tr>
              ) : (returns as any[]).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-700">{r.return_type}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{r.period_start} → {r.period_end}</td>
                  <td className="px-4 py-2 text-gray-600">{r.due_date || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(r.total_tax_liability || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-600">{fmt(r.total_itc || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(r.net_payable || 0)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {r.status === 'draft' && (
                        <button onClick={() => computeMut.mutate(r.id)} title="Compute"
                          disabled={computeMut.isPending}
                          className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50">
                          <Calculator className="w-4 h-4" />
                        </button>
                      )}
                      {r.status === 'computed' && (
                        <button onClick={() => fileMut.mutate({ id: r.id, data: { filing_reference: `FILED-${Date.now()}` } })}
                          disabled={fileMut.isPending}
                          title="File Return"
                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'codes' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Code', 'Name', 'Type', 'Rate %', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(codes as any[]).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No tax codes configured.</td></tr>
              ) : (codes as any[]).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-semibold text-gray-700">{c.code}</td>
                  <td className="px-4 py-2 text-gray-800">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.tax_type}</td>
                  <td className="px-4 py-2 text-right font-mono">{c.rate}%</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="font-semibold text-lg">New Tax Return</h2></div>

              <button type="button" aria-label="Close"
                type="button"
                onClick={() => setShowNew(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Return Type</Label>
              <select value={returnForm.return_type} onChange={e => setReturnForm(f => ({ ...f, return_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['GSTR1', 'GSTR3B', 'TDS', 'Income'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {[
              { label: 'Period Start', key: 'period_start', type: 'date' },
              { label: 'Period End', key: 'period_end', type: 'date' },
              { label: 'Due Date', key: 'due_date', type: 'date' },
              { label: 'Notes', key: 'notes' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <Label className="block text-xs font-medium text-gray-600 mb-1">{label}</Label>
                <input type={type || 'text'} value={(returnForm as any)[key]}
                  onChange={e => setReturnForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createMut.mutate(returnForm, { onSuccess: () => setShowNew(false) })}
                disabled={createMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createMut.isPending ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setShowNewCode(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3 mb-4">

              <div className="min-w-0"><h2 className="font-semibold text-lg">New Tax Code</h2></div>

              <button type="button" aria-label="Close"
                type="button"
                onClick={() => setShowNewCode(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Code', key: 'code' }, { label: 'Name', key: 'name' }, { label: 'Rate %', key: 'rate', type: 'number' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">{label}</Label>
                  <input type={type || 'text'} value={(codeForm as any)[key]}
                    onChange={e => setCodeForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div>
                <Label className="block text-xs font-medium text-gray-600 mb-1">Tax Type</Label>
                <select value={codeForm.tax_type} onChange={e => setCodeForm(f => ({ ...f, tax_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['CGST', 'SGST', 'IGST', 'TDS', 'TCS', 'Income'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewCode(false)} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => createCodeMut.mutate({ ...codeForm, rate: Number(codeForm.rate) }, { onSuccess: () => setShowNewCode(false) })}
                disabled={createCodeMut.isPending}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createCodeMut.isPending ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
