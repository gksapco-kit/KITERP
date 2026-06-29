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
  useGoodsBatches, useUpdateGoodsBatch,
  useGoodsMovements, useCreateGoodsMovement,
  useProducts, usePlants, useStores,
} from '@/hooks/useVendor'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import type { GoodsBatch, GoodsMovementDocument } from '@/types'
import { Loader2, Plus, X, PackageSearch, ArrowRightLeft, Clock, Pencil } from 'lucide-react'

const QUALITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  unrestricted:       { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-300', label: 'Unrestricted' },
  quality_inspection: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', label: 'In Inspection' },
  blocked:            { bg: 'bg-red-50 dark:bg-red-950/50',     text: 'text-red-700 dark:text-red-300',     label: 'Blocked' },
}

const MOVEMENT_TYPES = [
  { value: '101', label: '101 – GR for PO' },
  { value: '102', label: '102 – GR Reversal' },
  { value: '122', label: '122 – Return to Vendor' },
  { value: '201', label: '201 – GI for Cost Center' },
  { value: '261', label: '261 – GI for Production Order' },
  { value: '301', label: '301 – Plant to Plant Transfer' },
  { value: '311', label: '311 – Storage Location Transfer' },
  { value: '501', label: '501 – Receipt w/o PO' },
]

// ── Batch Edit ──────────────────────────────────────────────────
function BatchQualityModal({ batch, onClose }: { batch: GoodsBatch; onClose: () => void }) {
  const update = useUpdateGoodsBatch()
  const [quality, setQuality] = useState(batch.quality_status)
  const [notes, setNotes] = useState(batch.notes ?? '')
  useEscapeToClose(onClose, true)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Update Batch Quality</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Batch: <strong>{batch.batch_number}</strong></p>
          <div>
            <Label className="text-xs">Quality Status</Label>
            <select
              className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background"
              value={quality}
              onChange={e => setQuality(e.target.value as any)}
            >
              {Object.entries(QUALITY_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => update.mutate({ id: batch.id, data: { quality_status: quality, notes: notes || undefined } }, { onSuccess: onClose })}
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

// ── Goods Movement Modal ─────────────────────────────────────────
function GoodsMovementModal({ onClose }: { onClose: () => void }) {
  const create = useCreateGoodsMovement()
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []
  const [selectedStoreId] = useState(stores[0]?.id ?? '')
  const { data: plantsData } = usePlants(selectedStoreId)
  const plants = plantsData?.plants ?? []
  const { data: productsData } = useProducts({ size: 200 })
  const products = productsData?.items ?? []

  const [movementType, setMovementType] = useState('501')
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10))
  const [plantId, setPlantId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, uom: 'PCS', unit_cost: '' }])

  useEscapeToClose(onClose, true)

  const updateLine = (i: number, field: string, value: any) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const handleSave = () => {
    const validLines = lines.filter(l => l.product_id)
    if (!validLines.length) { toast.error('Add at least one product line'); return }
    create.mutate({
      movement_type: movementType,
      posting_date: postingDate,
      plant_id: plantId || undefined,
      notes: notes || undefined,
      lines: validLines.map(l => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        uom: l.uom,
        unit_cost: l.unit_cost ? Number(l.unit_cost) : undefined,
        to_plant_id: plantId || undefined,
      })),
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Post Goods Movement
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Movement Type *</Label>
              <select
                className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background"
                value={movementType}
                onChange={e => setMovementType(e.target.value)}
              >
                {MOVEMENT_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Posting Date *</Label>
              <Input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Plant</Label>
              <select className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background" value={plantId} onChange={e => setPlantId(e.target.value)}>
                <option value="">All plants</option>
                {plants.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason / reference" className="mt-1" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Material Lines</h3>
              <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, { product_id: '', quantity: 1, uom: 'PCS', unit_cost: '' }])} className="gap-1 h-7 text-xs">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <select className="w-full text-sm border rounded-md px-2 py-1.5 bg-background" value={l.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}>
                      <option value="">Select product…</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={0.001} step={0.001} placeholder="Qty" value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input placeholder="UoM" value={l.uom} onChange={e => updateLine(i, 'uom', e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={0} placeholder="Unit cost" value={l.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Post Movement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function GoodsManagementPage() {
  const [tab, setTab] = useState<'batches' | 'movements'>('batches')
  const [search, setSearch] = useState('')
  const [qualityFilter, setQualityFilter] = useState('')
  const [showMovementForm, setShowMovementForm] = useState(false)
  const [editingBatch, setEditingBatch] = useState<GoodsBatch | undefined>()

  const batchParams: Record<string, unknown> = {}
  if (qualityFilter) batchParams.quality_status = qualityFilter
  const { data: batchData, isLoading: batchLoading } = useGoodsBatches(batchParams)
  const batches: GoodsBatch[] = batchData?.items ?? []

  const { data: movData, isLoading: movLoading } = useGoodsMovements()
  const movements: GoodsMovementDocument[] = movData?.items ?? []

  const filteredBatches = useMemo(() => {
    const q = search.toLowerCase()
    return batches.filter(b =>
      !q ||
      b.batch_number.toLowerCase().includes(q) ||
      (b.product_name || '').toLowerCase().includes(q) ||
      (b.serial_number || '').toLowerCase().includes(q)
    )
  }, [batches, search])

  const filteredMovements = useMemo(() => {
    const q = search.toLowerCase()
    return movements.filter(m =>
      !q ||
      m.document_number.toLowerCase().includes(q) ||
      m.movement_type.includes(q)
    )
  }, [movements, search])

  const expiringSoon = batches.filter(b => {
    if (!b.expiry_date) return false
    const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000)
    return days <= 30 && days >= 0
  }).length

  return (
    <div className="space-y-6">
      {editingBatch && <BatchQualityModal batch={editingBatch} onClose={() => setEditingBatch(undefined)} />}
      {showMovementForm && <GoodsMovementModal onClose={() => setShowMovementForm(false)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Goods Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Batch tracking, serial numbers, quality status & goods movements</p>
        </div>
        <Button className="gap-2" onClick={() => setShowMovementForm(true)}>
          <ArrowRightLeft className="w-4 h-4" /> Post Goods Movement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Batches', count: batches.filter(b => b.quality_status === 'unrestricted').length, color: 'text-green-600' },
          { label: 'In Inspection', count: batches.filter(b => b.quality_status === 'quality_inspection').length, color: 'text-amber-600' },
          { label: 'Expiring (30d)', count: expiringSoon, color: 'text-red-600' },
          { label: 'Movements', count: movements.length, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.count}</p>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="batches" className="gap-1.5">
            <PackageSearch className="w-3.5 h-3.5" /> Batches & Serials ({batches.length})
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" /> Movement Documents ({movements.length})
          </TabsTrigger>
        </TabsList>

        {/* Batches */}
        <TabsContent value="batches">
          <Card>
            <div className="px-0">
              <TableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search batch, serial, product…"
                sortOptions={[{ value: 'created_at', label: 'Created' }, { value: 'expiry_date', label: 'Expiry' }]}
                sortKey="created_at"
                sortDir="desc"
                onSortKeyChange={() => {}}
                onSortDirChange={() => {}}
                leading={
                  <Select
                    value={qualityFilter}
                    onChange={setQualityFilter}
                    options={selectOptionsWithBlank(
                      'All Quality',
                      Object.entries(QUALITY_BADGE).map(([v, { label }]) => ({ value: v, label })),
                    )}
                    className="w-36 text-sm"
                  />
                }
              />
            </div>
            {batchLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <PackageSearch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No batch records found</p>
                <p className="text-sm">Batches are created automatically on goods receipt</p>
              </div>
            ) : (
              <ResizableTable tableId="goods-batches" defaultWidths={[120, 160, 80, 80, 80, 100, 80, 80]}>
                <thead>
                  <tr>
                    {['Batch No.', 'Product', 'Qty Avail.', 'Reserved', 'UoM', 'Expiry', 'Quality', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map(b => {
                    const badge = QUALITY_BADGE[b.quality_status] ?? QUALITY_BADGE.unrestricted
                    const isExpiringSoon = b.expiry_date && Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000) <= 30
                    return (
                      <tr key={b.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-mono text-xs text-blue-600">{b.batch_number}</td>
                        <td className="px-3 py-2 text-sm font-medium">{b.product_name || b.product_id.slice(0, 8)}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-green-700">{b.quantity_available}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{b.quantity_reserved}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{b.uom}</td>
                        <td className="px-3 py-2 text-sm">
                          {b.expiry_date ? (
                            <span className={isExpiringSoon ? 'text-red-600 font-medium flex items-center gap-1' : ''}>
                              {isExpiringSoon && <Clock className="w-3 h-3" />}
                              {formatDate(b.expiry_date)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingBatch(b)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            )}
          </Card>
        </TabsContent>

        {/* Movement Documents */}
        <TabsContent value="movements">
          <Card>
            <div className="px-0">
              <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search document number or type…" sortOptions={[{ value: 'posting_date', label: 'Posting Date' }, { value: 'movement_type', label: 'Type' }]} sortKey="posting_date" sortDir="desc" onSortKeyChange={() => {}} onSortDirChange={() => {}} />
            </div>
            {movLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No goods movements posted yet</p>
                <p className="text-sm">Use "Post Goods Movement" to record stock in/out/transfers</p>
              </div>
            ) : (
              <ResizableTable tableId="goods-movements" defaultWidths={[130, 80, 100, 130, 100, 150]}>
                <thead>
                  <tr>
                    {['Document No.', 'Type', 'Posting Date', 'Plant', 'Lines', 'Posted By'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{m.document_number}</td>
                      <td className="px-3 py-2">
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">{m.movement_type}</span>
                        {m.movement_type_label && <span className="text-xs text-gray-500 ml-1">– {m.movement_type_label}</span>}
                      </td>
                      <td className="px-3 py-2 text-sm">{formatDate(m.posting_date)}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{m.plant_id ? m.plant_id.slice(0, 8) : '—'}</td>
                      <td className="px-3 py-2 text-sm">{m.lines.length}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{m.created_by_name || '—'}</td>
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
