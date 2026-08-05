import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import {
  useBills, useBill, useApAging, useCreateBill, usePostBill, useRecordVendorPayment, usePaymentRuns,
  useAccounts, useAssetCategories, useCreateAssetFromBill,
} from '@/hooks/useFinance'
import { Plus, CheckCircle, X, Eye, Trash2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

const DEP_METHOD_OPTIONS = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'wdv', label: 'Written Down Value' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const TABS = ['Bills', 'AP Aging', 'Payment Runs'] as const
type Tab = typeof TABS[number]

type BillLineForm = { account_id: string; description: string; quantity: string; unit_price: string }
const blankLine = (): BillLineForm => ({ account_id: '', description: '', quantity: '1', unit_price: '' })

// ── Capitalize a posted bill line as a Fixed Asset ──────────────────────────
function CapitalizeAssetModal({ billLineId, defaultName, onClose }: {
  billLineId: string; defaultName: string; onClose: () => void
}) {
  const { data: categories = [] } = useAssetCategories()
  const createMut = useCreateAssetFromBill()
  const [form, setForm] = useState({
    asset_code: '', name: defaultName, category_id: '',
    useful_life_years: '5', depreciation_method: 'straight_line', salvage_value: '0',
  })
  useEscapeToClose(onClose, true)

  const applyCategoryDefaults = (categoryId: string) => {
    const cat = (categories as any[]).find(c => c.id === categoryId)
    setForm(f => ({
      ...f,
      category_id: categoryId,
      depreciation_method: cat?.depreciation_method || f.depreciation_method,
      useful_life_years: cat?.useful_life_years != null ? String(cat.useful_life_years) : f.useful_life_years,
    }))
  }

  const handleSave = () => {
    if (!form.asset_code.trim() || !form.name.trim()) {
      toast.error('Asset code and name are required')
      return
    }
    createMut.mutate({
      bill_line_id: billLineId,
      asset_code: form.asset_code.trim(),
      name: form.name.trim(),
      category_id: form.category_id || undefined,
      useful_life_years: Number(form.useful_life_years) || 5,
      depreciation_method: form.depreciation_method,
      salvage_value: Number(form.salvage_value) || 0,
    }, {
      onSuccess: () => { toast.success('Asset created from bill line'); onClose() },
      onError: (err: unknown) => toast.error(extractApiError(err, 'Could not capitalize this bill line')),
    })
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-lg">Capitalize as Fixed Asset</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Creates a Fixed Asset register entry from this bill line without posting a new GL
          entry. Run the Asset Reconciliation report afterward to confirm it matches the GL.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Asset Code</Label>
            <input value={form.asset_code} onChange={e => setForm(f => ({ ...f, asset_code: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Name</Label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Category</Label>
          <Select
            value={form.category_id}
            onChange={applyCategoryDefaults}
            options={[{ value: '', label: '— No category —' }, ...(categories as any[]).map(c => ({ value: c.id, label: c.name }))]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Depreciation Method</Label>
            <Select value={form.depreciation_method} onChange={v => setForm(f => ({ ...f, depreciation_method: v }))} options={DEP_METHOD_OPTIONS} />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Useful Life (years)</Label>
            <input type="number" min={1} value={form.useful_life_years}
              onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Salvage / Residual Value</Label>
          <input type="number" min={0} value={form.salvage_value}
            onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={createMut.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {createMut.isPending ? 'Saving…' : 'Create Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bill detail drawer — lines + linked assets + capitalize action ─────────
function BillDetailDrawer({ billId, onClose }: { billId: string; onClose: () => void }) {
  const { data: bill, isLoading } = useBill(billId)
  const [capitalizingLine, setCapitalizingLine] = useState<{ id: string; description: string } | null>(null)
  useEscapeToClose(onClose, true)

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-card text-foreground h-full w-full max-w-xl shadow-2xl overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
        {isLoading || !bill ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Loading…</p>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-lg">Bill {(bill as any).bill_no}</h2>
                <p className="text-xs text-gray-500">{(bill as any).bill_date} · Total {fmt((bill as any).total || 0)}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Line Items</p>
              {((bill as any).lines || []).length === 0 ? (
                <p className="text-sm text-gray-500">No line items on this bill.</p>
              ) : (
                <div className="space-y-2">
                  {((bill as any).lines || []).map((ln: any) => (
                    <div key={ln.id} className="border border-gray-200 rounded-lg p-2.5 text-sm flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{ln.description || 'Line item'}</p>
                        <p className="text-xs text-gray-500">Qty {ln.quantity} × {fmt(ln.unit_price || 0)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono">{fmt(ln.line_total || 0)}</span>
                        {(bill as any).status !== 'draft' && (
                          <button
                            onClick={() => setCapitalizingLine({ id: ln.id, description: ln.description || 'Asset' })}
                            title="Capitalize as Asset"
                            className="text-xs px-2 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                          >
                            <Building2 className="w-3.5 h-3.5" /> Capitalize
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(bill as any).status === 'draft' && (
                <p className="text-xs text-amber-600 mt-2">Post this bill to the GL before capitalizing any line as an asset.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Linked Fixed Assets</p>
              {((bill as any).linked_assets || []).length === 0 ? (
                <p className="text-sm text-gray-500">No assets capitalized from this bill yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {((bill as any).linked_assets || []).map((a: any) => (
                    <div key={a.id} className="flex justify-between text-sm border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-gray-700">{a.name} <span className="text-gray-400 font-mono text-xs">({a.asset_code})</span></span>
                      <span className="font-mono">{fmt(a.purchase_cost || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {capitalizingLine && (
        <CapitalizeAssetModal
          billLineId={capitalizingLine.id}
          defaultName={capitalizingLine.description}
          onClose={() => setCapitalizingLine(null)}
        />
      )}
    </div>
  )
}

export default function AccountsPayable() {
  const [tab, setTab] = useState<Tab>('Bills')
  const [showNewBill, setShowNewBill] = useState(false)
  const [detailBillId, setDetailBillId] = useState<string | null>(null)
  const [billForm, setBillForm] = useState({ supplier_id: '', bill_no: '', bill_date: new Date().toISOString().slice(0, 10), total: '', tax_amount: '', subtotal: '', due_date: '', notes: '' })
  const [lines, setLines] = useState<BillLineForm[]>([])

  const { data: billsData, isLoading: billsLoading } = useBills()
  const { data: aging = [], isLoading: agingLoading } = useApAging()
  const { data: runs = [], isLoading: runsLoading } = usePaymentRuns()
  const { data: accounts = [] } = useAccounts()
  const createBillMut = useCreateBill()
  const postBillMut = usePostBill()
  const paymentMut = useRecordVendorPayment()

  const bills = Array.isArray(billsData) ? billsData : (billsData?.items || [])
  const linesTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  )

  const closeNewBill = () => { setShowNewBill(false); setLines([]) }

  const accountOptions = [
    { value: '', label: '— Select GL Account —' },
    ...(accounts as any[]).map(a => ({ value: a.id, label: `${a.code} — ${a.name}` })),
  ]

  const handleSaveBill = () => {
    const payload: Record<string, unknown> = { ...billForm }
    const validLines = lines.filter(l => l.account_id && Number(l.unit_price) > 0)
    if (validLines.length > 0) {
      payload.lines = validLines.map(l => ({
        account_id: l.account_id,
        description: l.description.trim() || undefined,
        quantity: Number(l.quantity) || 1,
        unit_price: Number(l.unit_price) || 0,
        line_total: (Number(l.quantity) || 1) * (Number(l.unit_price) || 0),
      }))
    }
    createBillMut.mutate(payload, { onSuccess: closeNewBill })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Vendor bills, AP aging, and payment runs
        </p>
        {tab === 'Bills' && (
          <button
            type="button"
            onClick={() => setShowNewBill(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Bill
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm border ${tab === t ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Bills' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Bill No', 'Supplier', 'Date', 'Due', 'Total', 'Balance', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {billsLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No bills yet.</td></tr>
              ) : bills.map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{b.bill_no}</td>
                  <td className="px-4 py-2 text-gray-600 font-mono text-xs">{b.supplier_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-gray-600">{b.bill_date}</td>
                  <td className="px-4 py-2 text-gray-600">{b.due_date || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(b.total || 0)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(b.balance_due || 0)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] || ''}`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetailBillId(b.id)} title="View Details" className="p-1 text-gray-500 hover:text-gray-800">
                        <Eye className="w-4 h-4" />
                      </button>
                      {b.status === 'draft' && (
                        <button onClick={() => postBillMut.mutate(b.id)} title="Post Bill"
                          className="p-1 text-green-600 hover:text-green-800"><CheckCircle className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'AP Aging' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Supplier', 'Current', '1-30', '31-60', '61-90', '90+', 'Total'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agingLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : aging.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No outstanding payables.</td></tr>
              ) : (aging as any[]).map((r: any) => (
                <tr key={r.supplier_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.supplier_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmt(r.current || 0)}</td>
                  <td className="px-4 py-2 text-right text-yellow-700">{fmt(r['1_30'] || 0)}</td>
                  <td className="px-4 py-2 text-right text-orange-700">{fmt(r['31_60'] || 0)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmt(r['61_90'] || 0)}</td>
                  <td className="px-4 py-2 text-right text-red-800 font-semibold">{fmt(r['90_plus'] || 0)}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {fmt((r.current||0)+(r['1_30']||0)+(r['31_60']||0)+(r['61_90']||0)+(r['90_plus']||0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Payment Runs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Payment Date', 'Total Amount', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runsLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : (runs as any[]).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No payment runs.</td></tr>
              ) : (runs as any[]).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.name || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.payment_date}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(r.total_amount || 0)}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewBill && (
        <ModalOverlay onClose={closeNewBill} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden">
            <ModalHeader
              title="New Vendor Bill"
              onClose={closeNewBill}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
              {(() => {
                const field = (
                  label: string,
                  key: keyof typeof billForm,
                  type?: string,
                  className = '',
                ) => (
                  <div className={className}>
                    <Label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{label}</Label>
                    <input
                      type={type || 'text'}
                      value={(billForm as any)[key]}
                      onChange={e => setBillForm(f => ({ ...f, [key]: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {field('Supplier ID', 'supplier_id')}
                      {field('Bill Number', 'bill_no')}
                      {field('Bill Date', 'bill_date', 'date')}
                      {field('Due Date', 'due_date', 'date')}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {field('Subtotal', 'subtotal', 'number')}
                      {field('Tax', 'tax_amount', 'number')}
                      {field('Total', 'total', 'number')}
                    </div>
                    {field('Notes', 'notes')}
                  </>
                )
              })()}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Lines {lines.length > 0 ? `(${lines.length})` : '(optional)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLines(ls => [...ls, blankLine()])}
                    className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted/30"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {lines.length > 0 && (
                  <div className="mt-1.5 max-h-28 space-y-1.5 overflow-y-auto">
                    {/* Column headers */}
                    <div className="grid grid-cols-3 gap-1 px-0.5">
                      {['Description', 'Qty', 'Unit Price'].map(h => (
                        <p key={h} className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</p>
                      ))}
                    </div>
                    {lines.map((ln, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-1 rounded-md border border-border bg-muted/15 p-1.5">
                        <div className="min-w-0 space-y-1">
                          <Select value={ln.account_id} onChange={v => setLines(ls => ls.map((l, j) => j === i ? { ...l, account_id: v } : l))} options={accountOptions} />
                          <div className="grid grid-cols-3 gap-1">
                            <input
                              placeholder="Description"
                              value={ln.description}
                              onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, description: e.target.value } : l))}
                              className="col-span-1 h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                              aria-label="Description"
                            />
                            <input
                              type="number"
                              min={0}
                              placeholder="1"
                              value={ln.quantity}
                              onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))}
                              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                              aria-label="Quantity"
                            />
                            <input
                              type="number"
                              min={0}
                              placeholder="0.00"
                              value={ln.unit_price}
                              onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, unit_price: e.target.value } : l))}
                              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                              aria-label="Unit price"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                          className="self-start p-1 text-muted-foreground hover:text-red-600"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <p className="text-right text-[11px] text-muted-foreground">
                      Lines total: <span className="font-mono">{fmt(linesTotal)}</span>
                    </p>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <button type="button" onClick={closeNewBill} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={createBillMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createBillMut.isPending ? 'Saving…' : 'Save Bill'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}

      {detailBillId && (
        <BillDetailDrawer billId={detailBillId} onClose={() => setDetailBillId(null)} />
      )}
    </div>
  )
}
