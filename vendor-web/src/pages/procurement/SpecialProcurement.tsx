import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'

import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useMaterialValuation, useUpdateMaterialValuation,
  useServiceEntrySheets, useCreateServiceEntrySheet, useUpdateServiceEntrySheet,
  useSubmitServiceEntrySheet, useApproveServiceEntrySheet,
  usePurchaseOrders,
} from '@/hooks/useVendor'
import { ProcurementSupplierField } from '@/components/procurement/ProcurementSupplierField'
import { formatDate, formatCurrency } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { toast } from 'sonner'
import type { MaterialValuation, ServiceEntrySheet } from '@/types'
import {
  Loader2, Plus, X, Scale, FileCheck, CheckCircle, XCircle, Send,
  Pencil,
} from 'lucide-react'

// ─── SES Status badge ─────────────────────────────────────────────
const SES_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft:     { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-700 dark:text-gray-300',    label: 'Draft' },
  submitted: { bg: 'bg-blue-50 dark:bg-blue-950/50',    text: 'text-blue-700 dark:text-blue-300',    label: 'Submitted' },
  approved:  { bg: 'bg-green-50 dark:bg-green-950/50',  text: 'text-green-700 dark:text-green-300',  label: 'Approved' },
  rejected:  { bg: 'bg-red-50 dark:bg-red-950/50',      text: 'text-red-700 dark:text-red-300',      label: 'Rejected' },
  invoiced:  { bg: 'bg-purple-50 dark:bg-purple-950/50',text: 'text-purple-700 dark:text-purple-300', label: 'Invoiced' },
}

// ─── Material Valuation Edit Modal ────────────────────────────────
function ValuationEditModal({ valuation, onClose }: { valuation: MaterialValuation; onClose: () => void }) {
  const update = useUpdateMaterialValuation()
  const [standardPrice, setStandardPrice] = useState(String(valuation.standard_price ?? ''))
  const [method, setMethod] = useState(valuation.valuation_method)
  useEscapeToClose(onClose, true)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Update Valuation</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Product: <strong>{valuation.product_name || valuation.product_id.slice(0, 12)}</strong></p>
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-gray-800/50 rounded p-3">
            <div><p className="text-gray-500 text-xs">Current Stock</p><p className="font-semibold">{valuation.total_stock}</p></div>
            <div><p className="text-gray-500 text-xs">Total Value</p><p className="font-semibold">{formatCurrency(valuation.total_value)}</p></div>
            <div><p className="text-gray-500 text-xs">Moving Avg Price</p><p className="font-semibold text-blue-600">{formatCurrency(valuation.moving_avg_price)}</p></div>
            <div><p className="text-gray-500 text-xs">Currency</p><p className="font-semibold">{valuation.currency}</p></div>
          </div>
          <div>
            <Label className="text-xs">Valuation Method</Label>
            <Select
              value={method}
              onChange={v => setMethod(v as typeof method)}
              options={[
                { value: 'moving_average', label: 'Moving Average (MAP)' },
                { value: 'standard_price', label: 'Standard Price' },
              ]}
              className="mt-1 text-sm"
            />
          </div>
          {method === 'standard_price' && (
            <div>
              <Label className="text-xs">Standard Price</Label>
              <Input
                type="number" min={0} step={0.01}
                value={standardPrice}
                onChange={e => setStandardPrice(e.target.value)}
                className="mt-1"
                placeholder="Fixed standard price"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => update.mutate({
                id: valuation.id,
                data: { valuation_method: method, standard_price: standardPrice ? Number(standardPrice) : undefined }
              }, { onSuccess: onClose })}
              disabled={update.isPending}
              className="gap-2"
            >
              {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Create SES Modal ─────────────────────────────────────────────
function CreateSESModal({ onClose }: { onClose: () => void }) {
  const create = useCreateServiceEntrySheet()
  const { data: posData } = usePurchaseOrders({ size: 200 })
  const pos = posData?.items ?? []

  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [notes, setNotes] = useState('')

  useEscapeToClose(onClose, true)

  const handleSave = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!totalAmount || Number(totalAmount) <= 0) { toast.error('Enter total amount'); return }
    create.mutate({
      supplier_id: supplierId,
      purchase_order_id: poId || undefined,
      description: description || undefined,
      total_amount: Number(totalAmount),
      currency,
      service_period_from: periodFrom || undefined,
      service_period_to: periodTo || undefined,
      notes: notes || undefined,
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-green-600" /> New Service Entry Sheet
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Supplier"
              required
              returnTo="procurement/special"
              className="col-span-2"
            />
            <div className="col-span-2">
              <Label className="text-xs">Link to PO (optional)</Label>
              <Select
                value={poId}
                onChange={setPoId}
                options={selectOptionsWithBlank(
                  '— No PO —',
                  pos.map((p: { id: string; po_number: string }) => ({ value: p.id, label: p.po_number })),
                )}
                className="mt-1 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Service Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. AMC for HVAC Q1 2026" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Total Amount *</Label>
              <Input type="number" min={0} step={0.01} value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Service Period From</Label>
              <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Service Period To</Label>
              <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create SES
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── SES Detail Panel ─────────────────────────────────────────────
function SESDetailPanel({ ses, onClose }: { ses: ServiceEntrySheet; onClose: () => void }) {
  const submit = useSubmitServiceEntrySheet()
  const approve = useApproveServiceEntrySheet()
  const [remarks, setRemarks] = useState('')
  const badge = SES_BADGE[ses.status] ?? SES_BADGE.draft

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-mono">{ses.ses_number}</p>
            <h2 className="text-lg font-semibold">{ses.supplier_name || 'Service Entry'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">PO Reference</p><p className="font-medium text-blue-600">{ses.po_number || '—'}</p></div>
            <div><p className="text-gray-500">Total Amount</p><p className="font-bold text-lg">{formatCurrency(ses.total_amount)} <span className="text-xs font-normal text-gray-500">{ses.currency}</span></p></div>
            <div><p className="text-gray-500">Service Period</p>
              <p className="font-medium">
                {ses.service_period_from ? formatDate(ses.service_period_from) : '—'}
                {ses.service_period_to ? ` → ${formatDate(ses.service_period_to)}` : ''}
              </p>
            </div>
            <div><p className="text-gray-500">Submitted</p><p className="font-medium">{ses.submitted_at ? formatDate(ses.submitted_at) : '—'}</p></div>
            <div><p className="text-gray-500">Approved</p><p className="font-medium">{ses.accepted_at ? formatDate(ses.accepted_at) : '—'}</p></div>
          </div>
          {ses.notes && <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-sm">{ses.notes}</div>}

          {/* Actions */}
          {ses.status === 'draft' && (
            <div className="flex gap-2 border-t pt-4">
              <Button onClick={() => submit.mutate(ses.id)} disabled={submit.isPending} className="gap-2">
                {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <Send className="w-4 h-4" /> Submit for Approval
              </Button>
            </div>
          )}
          {ses.status === 'submitted' && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm">Approval Decision</h3>
              <Input placeholder="Remarks (required for rejection)" value={remarks} onChange={e => setRemarks(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => approve.mutate({ id: ses.id, data: { status: 'approved', remarks } }, { onSuccess: onClose })} disabled={approve.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                  {approve.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => {
                  if (!remarks.trim()) { toast.error('Enter rejection remarks'); return }
                  approve.mutate({ id: ses.id, data: { status: 'rejected', remarks } }, { onSuccess: onClose })
                }} disabled={approve.isPending} className="gap-2">
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function SpecialProcurementPage() {
  const [tab, setTab] = useState<'valuation' | 'ses'>('valuation')
  const [search, setSearch] = useState('')
  const [showSESForm, setShowSESForm] = useState(false)
  const [editingVal, setEditingVal] = useState<MaterialValuation | undefined>()
  const [selectedSES, setSelectedSES] = useState<ServiceEntrySheet | undefined>()

  const { data: valData, isLoading: valLoading } = useMaterialValuation()
  const valuations: MaterialValuation[] = valData?.items ?? []

  const { data: sesData, isLoading: sesLoading } = useServiceEntrySheets()
  const ses: ServiceEntrySheet[] = sesData?.items ?? []

  const filteredVals = useMemo(() => {
    const q = search.toLowerCase()
    return valuations.filter(v => !q || (v.product_name || '').toLowerCase().includes(q))
  }, [valuations, search])

  const filteredSES = useMemo(() => {
    const q = search.toLowerCase()
    return ses.filter(s =>
      !q ||
      s.ses_number.toLowerCase().includes(q) ||
      (s.supplier_name || '').toLowerCase().includes(q)
    )
  }, [ses, search])

  const totalStockValue = valuations.reduce((s, v) => s + v.total_value, 0)
  const pendingSES = ses.filter(s => s.status === 'submitted').length

  return (
    <div className="space-y-6">
      {editingVal && <ValuationEditModal valuation={editingVal} onClose={() => setEditingVal(undefined)} />}
      {showSESForm && <CreateSESModal onClose={() => setShowSESForm(false)} />}
      {selectedSES && <SESDetailPanel ses={selectedSES} onClose={() => setSelectedSES(undefined)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Special Procurement</h1>
          <p className="text-sm text-gray-500 mt-0.5">Material valuation, service entry sheets, subcontracting & consignment</p>
        </div>
        {tab === 'ses' && (
          <Button className="gap-2" onClick={() => setShowSESForm(true)}>
            <Plus className="w-4 h-4" /> New Service Entry Sheet
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Materials Tracked', count: valuations.length, color: 'text-blue-600' },
          { label: 'Total Stock Value', value: formatCurrency(totalStockValue), color: 'text-green-600' },
          { label: 'SES Pending', count: pendingSES, color: 'text-amber-600' },
          { label: 'SES Approved', count: ses.filter(s => s.status === 'approved').length, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.count !== undefined ? s.count : s.value}</p>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="valuation" className="gap-1.5">
            <Scale className="w-3.5 h-3.5" /> Material Valuation ({valuations.length})
          </TabsTrigger>
          <TabsTrigger value="ses" className="gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Service Entry Sheets ({ses.length})
          </TabsTrigger>
        </TabsList>

        {/* Material Valuation */}
        <TabsContent value="valuation">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search product name…" sortOptions={[{ value: 'product_name', label: 'Product' }, { value: 'total_value', label: 'Value' }]} sortKey="product_name" sortDir="asc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {valLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredVals.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No valuation records yet</p>
                <p className="text-sm">Valuations are auto-created on goods receipt. You can update the method here.</p>
              </div>
            ) : (
              <ResizableTable tableId="material-valuation" defaultWidths={[200, 90, 90, 110, 110, 90, 80]}>
                <thead>
                  <tr>
                    {['Product', 'Method', 'Total Stock', 'MAP Price', 'Std Price', 'Total Value', 'Currency', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVals.map(v => (
                    <tr key={v.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-sm font-medium">{v.product_name || v.product_id.slice(0, 12)}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {v.valuation_method === 'moving_average' ? 'MAP' : 'Std'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold">{v.total_stock}</td>
                      <td className="px-3 py-2 text-sm text-blue-600 font-medium">{formatCurrency(v.moving_avg_price)}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {v.standard_price ? formatCurrency(v.standard_price) : '—'}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-green-700">{formatCurrency(v.total_value)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{v.currency}</td>
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingVal(v)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>

        {/* Service Entry Sheets */}
        <TabsContent value="ses">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search SES number or supplier…" sortOptions={[{ value: 'created_at', label: 'Created' }, { value: 'total_amount', label: 'Amount' }]} sortKey="created_at" sortDir="desc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {sesLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredSES.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No service entry sheets yet</p>
                <p className="text-sm">Create SES documents to confirm service delivery before releasing AP invoices</p>
              </div>
            ) : (
              <ResizableTable tableId="service-entry-sheets" defaultWidths={[120, 160, 110, 100, 110, 110]}>
                <thead>
                  <tr>
                    {['SES No.', 'Supplier', 'PO Ref', 'Total', 'Period', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSES.map(s => {
                    const badge = SES_BADGE[s.status] ?? SES_BADGE.draft
                    return (
                      <tr key={s.id} className="border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={onClickableTableRow(() => setSelectedSES(s))}>
                        <td className="px-3 py-2 font-mono text-xs text-blue-600 font-medium">{s.ses_number}</td>
                        <td className="px-3 py-2 text-sm font-medium">{s.supplier_name || '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{s.po_number || '—'}</td>
                        <td className="px-3 py-2 text-sm font-semibold">{formatCurrency(s.total_amount)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {s.service_period_from ? formatDate(s.service_period_from) : '—'}
                          {s.service_period_to ? ` → ${formatDate(s.service_period_to)}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
