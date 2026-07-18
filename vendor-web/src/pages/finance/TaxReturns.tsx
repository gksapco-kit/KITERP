import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useTaxReturns, useCreateTaxReturn, useComputeTaxReturn, useFileTaxReturn, useTaxCodes, useCreateTaxCode } from '@/hooks/useFinance'
import { Plus, Calculator, Send } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  computed: 'bg-blue-100 text-blue-700',
  filed: 'bg-green-100 text-green-700',
  nil: 'bg-yellow-100 text-yellow-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const inputCls =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'

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

  const closeNew = () => setShowNew(false)
  const closeNewCode = () => setShowNewCode(false)

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          GST/TDS returns and tax codes
        </p>
        <div className="flex shrink-0 gap-1.5">
          {tab === 'returns' && (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> New Return
            </button>
          )}
          {tab === 'codes' && (
            <button
              type="button"
              onClick={() => setShowNewCode(true)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> New Tax Code
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(['returns', 'codes'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg border px-4 py-2 text-sm capitalize ${tab === t ? 'border-primary bg-primary text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {t === 'returns' ? 'Tax Returns' : 'Tax Codes'}
          </button>
        ))}
      </div>

      {tab === 'returns' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                {['Type', 'Period', 'Due Date', 'Tax Liability', 'ITC', 'Net Payable', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</th>
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
                  <td className="px-4 py-2 text-xs text-gray-600">{r.period_start} → {r.period_end}</td>
                  <td className="px-4 py-2 text-gray-600">{r.due_date || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(r.total_tax_liability || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-600">{fmt(r.total_itc || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(r.net_payable || 0)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {r.status === 'draft' && (
                        <button type="button" onClick={() => computeMut.mutate(r.id)} title="Compute"
                          disabled={computeMut.isPending}
                          className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50">
                          <Calculator className="h-4 w-4" />
                        </button>
                      )}
                      {r.status === 'computed' && (
                        <button
                          type="button"
                          onClick={() => fileMut.mutate({ id: r.id, data: { filing_reference: `FILED-${Date.now()}` } })}
                          disabled={fileMut.isPending}
                          title="File Return"
                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                {['Code', 'Name', 'Type', 'Rate %', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</th>
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
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <ModalOverlay onClose={closeNew} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="New Tax Return"
              onClose={closeNew}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              <div>
                <Label className={labelCls}>Return Type</Label>
                <Select
                  value={returnForm.return_type}
                  onChange={v => setReturnForm(f => ({ ...f, return_type: v }))}
                  options={['GSTR1', 'GSTR3B', 'TDS', 'Income'].map(t => ({ value: t, label: t }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Period Start', key: 'period_start', type: 'date' },
                  { label: 'Period End', key: 'period_end', type: 'date' },
                  { label: 'Due Date', key: 'due_date', type: 'date', span: 'col-span-2' },
                  { label: 'Notes', key: 'notes', span: 'col-span-2' },
                ].map(({ label, key, type, span }) => (
                  <div key={key} className={span}>
                    <Label className={labelCls}>{label}</Label>
                    <input
                      type={type || 'text'}
                      value={(returnForm as any)[key]}
                      onChange={e => setReturnForm(f => ({ ...f, [key]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNew} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => createMut.mutate(returnForm, { onSuccess: closeNew })}
                disabled={createMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createMut.isPending ? 'Saving…' : 'Create'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}

      {showNewCode && (
        <ModalOverlay onClose={closeNewCode} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="New Tax Code"
              onClose={closeNewCode}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Code', key: 'code' },
                  { label: 'Name', key: 'name' },
                  { label: 'Rate %', key: 'rate', type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <Label className={labelCls}>{label}</Label>
                    <input
                      type={type || 'text'}
                      value={(codeForm as any)[key]}
                      onChange={e => setCodeForm(f => ({ ...f, [key]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                ))}
                <div>
                  <Label className={labelCls}>Tax Type</Label>
                  <Select
                    value={codeForm.tax_type}
                    onChange={v => setCodeForm(f => ({ ...f, tax_type: v }))}
                    options={['CGST', 'SGST', 'IGST', 'TDS', 'TCS', 'Income'].map(t => ({ value: t, label: t }))}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNewCode} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => createCodeMut.mutate({ ...codeForm, rate: Number(codeForm.rate) }, { onSuccess: closeNewCode })}
                disabled={createCodeMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createCodeMut.isPending ? 'Saving…' : 'Create'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
