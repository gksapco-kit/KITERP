import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import type { SortDir } from '@/lib/tableList'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useInfoRecords, useCreateInfoRecord, useUpdateInfoRecord, useDeleteInfoRecord,
  useSourceList, useCreateSourceListEntry, useUpdateSourceListEntry, useDeleteSourceListEntry,
} from '@/hooks/useVendor'
import { ProcurementSupplierField } from '@/components/procurement/ProcurementSupplierField'
import { ProcurementProductField } from '@/components/procurement/ProcurementProductField'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { PurchasingInfoRecord, SourceList } from '@/types'
import { Loader2, Plus, X, Pencil, Trash2, Database, Link2, ShieldCheck, ShieldOff, Star } from 'lucide-react'

function ProductCell({
  productId,
  productName,
  productSku,
  productDescription,
}: {
  productId: string
  productName?: string
  productSku?: string | null
  productDescription?: string | null
}) {
  const subtitle = [productSku, productDescription].filter(Boolean).join(' · ')
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium truncate">{productName || productId.slice(0, 8)}</div>
      {subtitle ? <div className="text-xs text-gray-500 truncate">{subtitle}</div> : null}
    </div>
  )
}

function SupplierCell({
  supplierId,
  supplierName,
  supplierContactName,
}: {
  supplierId: string
  supplierName?: string
  supplierContactName?: string | null
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{supplierName || supplierId.slice(0, 8)}</div>
      {supplierContactName ? <div className="text-xs text-gray-500 truncate">{supplierContactName}</div> : null}
    </div>
  )
}

// ── Info Record Form ──────────────────────────────────────────────
function InfoRecordForm({
  initial,
  onClose,
}: {
  initial?: PurchasingInfoRecord
  onClose: () => void
}) {
  const create = useCreateInfoRecord()
  const update = useUpdateInfoRecord()

  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? '')
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR')
  const [minQty, setMinQty] = useState(String(initial?.min_order_qty ?? '1'))
  const [leadTime, setLeadTime] = useState(String(initial?.lead_time_days ?? '0'))
  const [validFrom, setValidFrom] = useState(initial?.valid_from ?? '')
  const [validTo, setValidTo] = useState(initial?.valid_to ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  useEscapeToClose(onClose, true)

  const handleSave = () => {
    const payload = {
      supplier_id: supplierId,
      product_id: productId,
      price: Number(price),
      currency,
      min_order_qty: Number(minQty),
      lead_time_days: Number(leadTime),
      valid_from: validFrom || undefined,
      valid_to: validTo || undefined,
      is_active: isActive,
      notes: notes || undefined,
    }
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  const busy = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">{initial ? 'Edit Info Record' : 'New Purchasing Info Record'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Supplier"
              required
              returnTo="procurement/sourcing"
              className="col-span-2"
            />
            <ProcurementProductField
              value={productId}
              onChange={setProductId}
              label="Product"
              required
              className="col-span-2"
            />
            <div>
              <Label className="text-xs">Price *</Label>
              <Input type="number" min={0} step={0.01} value={price} onChange={e => setPrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Min Order Qty</Label>
              <Input type="number" min={0} step={0.001} value={minQty} onChange={e => setMinQty(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Lead Time (days)</Label>
              <Input type="number" min={0} value={leadTime} onChange={e => setLeadTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Valid From</Label>
              <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Valid To</Label>
              <Input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="mt-1" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="pir-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <label htmlFor="pir-active" className="text-sm">Active</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy} className="gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {initial ? 'Save Changes' : 'Create Record'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Source List Form ──────────────────────────────────────────────
function SourceListForm({ initial, onClose }: { initial?: SourceList; onClose: () => void }) {
  const create = useCreateSourceListEntry()
  const update = useUpdateSourceListEntry()

  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? '')
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [isFixed, setIsFixed] = useState(initial?.is_fixed ?? false)
  const [isBlocked, setIsBlocked] = useState(initial?.is_blocked ?? false)
  const [priority, setPriority] = useState(String(initial?.priority ?? '0'))
  const [validFrom, setValidFrom] = useState(initial?.valid_from ?? '')
  const [validTo, setValidTo] = useState(initial?.valid_to ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  useEscapeToClose(onClose, true)

  const handleSave = () => {
    const payload = {
      supplier_id: supplierId,
      product_id: productId,
      is_fixed: isFixed,
      is_blocked: isBlocked,
      priority: Number(priority),
      valid_from: validFrom || undefined,
      valid_to: validTo || undefined,
      notes: notes || undefined,
    }
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  const busy = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">{initial ? 'Edit Source List Entry' : 'New Source List Entry'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ProcurementProductField
              value={productId}
              onChange={setProductId}
              label="Product"
              required
              className="col-span-2"
            />
            <ProcurementSupplierField
              value={supplierId}
              onChange={setSupplierId}
              label="Approved Supplier"
              required
              returnTo="procurement/sourcing"
              className="col-span-2"
            />
            <div>
              <Label className="text-xs">Priority (0 = highest)</Label>
              <Input type="number" min={0} value={priority} onChange={e => setPriority(e.target.value)} className="mt-1" />
            </div>
            <div />
            <div>
              <Label className="text-xs">Valid From</Label>
              <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Valid To</Label>
              <Input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sl-fixed" checked={isFixed} onChange={e => setIsFixed(e.target.checked)} />
              <label htmlFor="sl-fixed" className="text-sm">Fixed (only source)</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sl-blocked" checked={isBlocked} onChange={e => setIsBlocked(e.target.checked)} />
              <label htmlFor="sl-blocked" className="text-sm text-red-600">Blocked</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy} className="gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {initial ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SourcingSetupPage() {
  const [tab, setTab] = useState<'info-records' | 'source-list'>('info-records')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Info Records
  const [showPIRForm, setShowPIRForm] = useState(false)
  const [editingPIR, setEditingPIR] = useState<PurchasingInfoRecord | undefined>()
  const { data: pirData, isLoading: pirLoading } = useInfoRecords()
  const deletePIR = useDeleteInfoRecord()
  const pirs: PurchasingInfoRecord[] = pirData?.items ?? []

  // Source List
  const [showSLForm, setShowSLForm] = useState(false)
  const [editingSL, setEditingSL] = useState<SourceList | undefined>()
  const { data: slData, isLoading: slLoading } = useSourceList()
  const deleteSL = useDeleteSourceListEntry()
  const sourceEntries: SourceList[] = slData?.items ?? []

  const filteredPIRs = useMemo(() => {
    const q = search.toLowerCase()
    return pirs.filter(r =>
      !q ||
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.product_sku || '').toLowerCase().includes(q) ||
      (r.product_description || '').toLowerCase().includes(q) ||
      (r.supplier_name || '').toLowerCase().includes(q) ||
      (r.supplier_contact_name || '').toLowerCase().includes(q)
    )
  }, [pirs, search])

  const filteredSL = useMemo(() => {
    const q = search.toLowerCase()
    return sourceEntries.filter(s =>
      !q ||
      (s.product_name || '').toLowerCase().includes(q) ||
      (s.product_sku || '').toLowerCase().includes(q) ||
      (s.product_description || '').toLowerCase().includes(q) ||
      (s.supplier_name || '').toLowerCase().includes(q) ||
      (s.supplier_contact_name || '').toLowerCase().includes(q)
    )
  }, [sourceEntries, search])

  return (
    <div className="space-y-6">
      {showPIRForm && (
        <InfoRecordForm
          initial={editingPIR}
          onClose={() => { setShowPIRForm(false); setEditingPIR(undefined) }}
        />
      )}
      {showSLForm && (
        <SourceListForm
          initial={editingSL}
          onClose={() => { setShowSLForm(false); setEditingSL(undefined) }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sourcing Setup</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vendor-material price agreements and approved supplier lists</p>
        </div>
        {tab === 'info-records' ? (
          <Button className="gap-2" onClick={() => { setEditingPIR(undefined); setShowPIRForm(true) }}>
            <Plus className="w-4 h-4" /> New Info Record
          </Button>
        ) : (
          <Button className="gap-2" onClick={() => { setEditingSL(undefined); setShowSLForm(true) }}>
            <Plus className="w-4 h-4" /> Add Source Entry
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="info-records" className="gap-1.5">
            <Database className="w-3.5 h-3.5" /> Info Records ({pirs.length})
          </TabsTrigger>
          <TabsTrigger value="source-list" className="gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Source List ({sourceEntries.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Info Records Tab ── */}
        <TabsContent value="info-records">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search product or supplier…" sortOptions={[{ value: 'created_at', label: 'Created' }, { value: 'supplier_name', label: 'Supplier' }]} sortKey="created_at" sortDir="desc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {pirLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredPIRs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No info records yet</p>
                <p className="text-sm">Add supplier-material price agreements to enable automatic price lookup in POs</p>
              </div>
            ) : (
              <ResizableTable tableId="proc-info-records" defaultWidths={[170, 170, 80, 70, 80, 80, 80, 100, 80]}>
                <thead>
                  <tr>
                    {['Product', 'Supplier', 'Price', 'Currency', 'Min Qty', 'Lead (days)', 'Valid From', 'Valid To', 'Status', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPIRs.map(r => (
                    <tr key={r.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        <ProductCell
                          productId={r.product_id}
                          productName={r.product_name}
                          productSku={r.product_sku}
                          productDescription={r.product_description}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <SupplierCell
                          supplierId={r.supplier_id}
                          supplierName={r.supplier_name}
                          supplierContactName={r.supplier_contact_name}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold">{formatCurrency(r.price)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.currency}</td>
                      <td className="px-3 py-2 text-sm">{r.min_order_qty}</td>
                      <td className="px-3 py-2 text-sm">{r.lead_time_days}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{r.valid_from ? formatDate(r.valid_from) : '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{r.valid_to ? formatDate(r.valid_to) : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPIR(r); setShowPIRForm(true) }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deletePIR.mutate(r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>

        {/* ── Source List Tab ── */}
        <TabsContent value="source-list">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search product or supplier…" sortOptions={[{ value: 'created_at', label: 'Created' }, { value: 'priority', label: 'Priority' }]} sortKey="created_at" sortDir="desc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {slLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredSL.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No source list entries yet</p>
                <p className="text-sm">Define which suppliers are approved / fixed for each material</p>
              </div>
            ) : (
              <ResizableTable tableId="proc-source-list" defaultWidths={[180, 180, 80, 100, 100, 80, 80]}>
                <thead>
                  <tr>
                    {['Product', 'Supplier', 'Priority', 'Valid From', 'Valid To', 'Fixed', 'Status', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSL.map(s => (
                    <tr key={s.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        <ProductCell
                          productId={s.product_id}
                          productName={s.product_name}
                          productSku={s.product_sku}
                          productDescription={s.product_description}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <SupplierCell
                          supplierId={s.supplier_id}
                          supplierName={s.supplier_name}
                          supplierContactName={s.supplier_contact_name}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400" /> {s.priority}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">{s.valid_from ? formatDate(s.valid_from) : '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{s.valid_to ? formatDate(s.valid_to) : '—'}</td>
                      <td className="px-3 py-2">
                        {s.is_fixed && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Fixed</span>}
                      </td>
                      <td className="px-3 py-2">
                        {s.is_blocked
                          ? <span className="flex items-center gap-1 text-xs text-red-600"><ShieldOff className="w-3 h-3" /> Blocked</span>
                          : <span className="flex items-center gap-1 text-xs text-green-600"><ShieldCheck className="w-3 h-3" /> Active</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSL(s); setShowSLForm(true) }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteSL.mutate(s.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
