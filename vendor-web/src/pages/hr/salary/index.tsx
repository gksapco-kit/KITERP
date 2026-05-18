import { useState } from 'react'
import { DollarSign, Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useHRSalaryStructures, useCreateHRSalaryStructure, useHREmployees } from '@/hooks/useVendor'
import type { SalaryStructure } from '@/types'

const DEFAULT_EARNINGS = { basic: 0, hra: 0, da: 0, special_allowance: 0, conveyance: 0, medical: 0 }
const DEFAULT_DEDUCTIONS = { pf_employee: 0, esi_employee: 0, professional_tax: 0, tds: 0 }

function SalaryModal({ employees, onClose }: { employees: any[]; onClose: () => void }) {
  const create = useCreateHRSalaryStructure()
  const [empId, setEmpId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [earnings, setEarnings] = useState({ ...DEFAULT_EARNINGS })
  const [deductions, setDeductions] = useState({ ...DEFAULT_DEDUCTIONS })
  const [customEarning, setCustomEarning] = useState('')
  const [customDeduction, setCustomDeduction] = useState('')

  const gross = Object.values(earnings).reduce((s, v) => s + v, 0)
  const totalDed = Object.values(deductions).reduce((s, v) => s + v, 0)
  const net = gross - totalDed

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!empId) return
    await create.mutateAsync({ employee_id: empId, effective_from: effectiveFrom, earnings, deductions })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold mb-4">Create / Revise Salary Structure</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Employee *</label>
              <select required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={empId} onChange={e => setEmpId(e.target.value)}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Effective From *</label>
              <input type="date" required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2">Earnings (₹/month)</h4>
              {Object.keys(earnings).map(k => (
                <div key={k} className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-gray-600 w-36 capitalize">{k.replace(/_/g, ' ')}</label>
                  <input type="number" min={0} className="flex-1 border rounded px-2 py-1 text-sm text-right" value={(earnings as any)[k]}
                    onChange={e => setEarnings(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <input className="flex-1 border rounded px-2 py-1 text-xs" placeholder="Add component…" value={customEarning} onChange={e => setCustomEarning(e.target.value)} />
                <button type="button" onClick={() => { if (customEarning) { setEarnings(p => ({ ...p, [customEarning.toLowerCase().replace(/ /g, '_')]: 0 })); setCustomEarning('') } }} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">+ Add</button>
              </div>
              <div className="border-t mt-2 pt-2 flex justify-between text-sm font-semibold text-green-700">
                <span>Gross</span><span>₹{gross.toLocaleString()}</span>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">Deductions (₹/month)</h4>
              {Object.keys(deductions).map(k => (
                <div key={k} className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-gray-600 w-36 capitalize">{k.replace(/_/g, ' ')}</label>
                  <input type="number" min={0} className="flex-1 border rounded px-2 py-1 text-sm text-right" value={(deductions as any)[k]}
                    onChange={e => setDeductions(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <input className="flex-1 border rounded px-2 py-1 text-xs" placeholder="Add deduction…" value={customDeduction} onChange={e => setCustomDeduction(e.target.value)} />
                <button type="button" onClick={() => { if (customDeduction) { setDeductions(p => ({ ...p, [customDeduction.toLowerCase().replace(/ /g, '_')]: 0 })); setCustomDeduction('') } }} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">+ Add</button>
              </div>
              <div className="border-t mt-2 pt-2 flex justify-between text-sm font-semibold text-red-700">
                <span>Total Ded.</span><span>₹{totalDed.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Net */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-600">Net Monthly Pay</p>
              <p className="text-2xl font-bold text-blue-900">₹{net.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-600">Annual CTC</p>
              <p className="text-lg font-semibold text-blue-800">₹{(gross * 12).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending} className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-50">
              {create.isPending ? 'Saving…' : 'Save Structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SalaryPage() {
  const { data: structures = [], isLoading } = useHRSalaryStructures()
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees = empData?.items ?? []
  const [showModal, setShowModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Group active structures by employee
  const active = (structures as SalaryStructure[]).filter(s => s.is_active)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Structures</h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} active salary structures</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add / Revise
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : active.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No salary structures configured.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Employee', 'Effective From', 'Gross', 'Deductions', 'Net', 'CTC/Yr', ''].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map(s => {
                const emp = (s.employee as any)
                const name = emp?.vendor_user?.user?.full_name ?? emp?.employee_code ?? '—'
                const isOpen = expanded === s.id
                return (
                  <>
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-sm text-gray-900">{name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{s.effective_from}</td>
                      <td className="py-3 px-4 text-sm text-green-700 font-semibold">₹{Number(s.gross_monthly).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-red-600">₹{(Number(s.gross_monthly) - Number(s.net_monthly)).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm font-bold text-blue-700">₹{Number(s.net_monthly).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">₹{Number(s.ctc_annual).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <button onClick={() => setExpanded(isOpen ? null : s.id)} className="p-1 text-gray-400 hover:text-blue-600">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${s.id}-detail`} className="bg-gray-50 border-b">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-xs font-semibold text-green-700 mb-2">Earnings</h4>
                              {Object.entries(s.earnings ?? {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs py-0.5 text-gray-600">
                                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                                  <span className="font-medium">₹{Number(v).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-red-700 mb-2">Deductions</h4>
                              {Object.entries(s.deductions ?? {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs py-0.5 text-gray-600">
                                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                                  <span className="font-medium">₹{Number(v).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <SalaryModal employees={employees} onClose={() => setShowModal(false)} />}
    </div>
  )
}
