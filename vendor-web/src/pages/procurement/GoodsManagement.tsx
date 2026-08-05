import { useState, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { UOM_OPTIONS } from '@/lib/uomOptions'

import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import {
  useGoodsBatches, useUpdateGoodsBatch,
  useGoodsMovements, useCreateGoodsMovement,
  useProducts, usePlants,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { formatDate } from '@/lib/utils'
import { normalizeUom } from '@/lib/procurementProductContext'
import { variantSelectOption } from '@/lib/productVariants'
import { toast } from 'sonner'
import type { GoodsBatch, GoodsMovementDocument, Product } from '@/types'
import { Loader2, Plus, X, PackageSearch, ArrowRightLeft, Clock, Pencil, ChevronDown, ChevronRight } from 'lucide-react'

type MovementLine = {
  product_id: string
  variant_id: string
  quantity: number | string
  uom: string
  unit_cost: string
}

function emptyMovementLine(): MovementLine {
  return { product_id: '', variant_id: '', quantity: 1, uom: 'piece', unit_cost: '' }
}

function positiveNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return !Number.isNaN(n) && n > 0 ? n : null
}

function activeVariantsOf(product: any): any[] {
  return (product?.variants ?? []).filter((v: any) => v.is_active !== false)
}

/** Resolve UOM + unit cost from product master, falling back to variants when product-level is empty/zero. */
function resolveMasterLineFields(product: any, variantId?: string): {
  variant_id: string
  quantity: number
  uom: string
  unit_cost: string
} {
  const variants = activeVariantsOf(product)
  const variant = variantId ? variants.find((v: any) => v.id === variantId) : null
  const src = variant ?? product

  let cost =
    positiveNum(src?.cost_price) ??
    positiveNum(src?.price) ??
    (variant
      ? (positiveNum(product?.cost_price) ?? positiveNum(product?.price))
      : null)

  let uomRaw = (variant?.uom || (!variant ? product?.uom : '') || '').trim()

  // Product-level often stores 0 / default piece with real pricing/UOM on variants
  if (!variant && variants.length) {
    const ranked = variants
      .map((v: any) => ({
        v,
        cost: positiveNum(v.cost_price) ?? positiveNum(v.price),
        uom: (v.uom || '').trim(),
      }))
    if (cost == null) {
      const priced = ranked.filter(r => r.cost != null).sort((a, b) => (a.cost! - b.cost!))
      if (priced.length) {
        cost = priced[0].cost
        if (!uomRaw || uomRaw === 'piece') uomRaw = priced[0].uom || uomRaw
      }
    }
    if (!uomRaw || uomRaw === 'piece') {
      const withUom = ranked.find(r => r.uom && r.uom !== 'piece')
      if (withUom) uomRaw = withUom.uom
    }
  }

  const uom = normalizeUom(uomRaw || 'piece')
  const packQty = src?.uom_quantity != null ? Number(src.uom_quantity) : NaN
  const quantity = !Number.isNaN(packQty) && packQty > 0 ? packQty : 1

  return {
    variant_id: variant?.id || '',
    quantity,
    uom,
    unit_cost: cost != null ? String(cost) : '',
  }
}

/** Seed from a specific variant (price, UOM, pack qty). */
function lineFromVariant(current: MovementLine, variantId: string, products: Product[]): MovementLine {
  const p = products.find(x => x.id === current.product_id) as any
  if (!p) return { ...current, variant_id: variantId }
  return {
    product_id: current.product_id,
    ...resolveMasterLineFields(p, variantId || undefined),
  }
}

/** Seed qty / UOM / unit cost from product master when product first selected. */
function lineFromProduct(productId: string, products: Product[]): MovementLine {
  if (!productId) return emptyMovementLine()
  const p = products.find(x => x.id === productId) as any
  if (!p) return { ...emptyMovementLine(), product_id: productId }

  const variants = activeVariantsOf(p)
  // Auto-select the only variant so UOM/cost from that row are used immediately
  const autoVariantId = variants.length === 1 ? variants[0].id : undefined
  return {
    product_id: productId,
    ...resolveMasterLineFields(p, autoVariantId),
  }
}

function stockHint(product: any, variantId: string): { label: string; cls: string } | null {
  if (!product) return null
  const variants = activeVariantsOf(product)

  // When a product has multiple variants and none is selected yet, show the
  // aggregate on-hand across all variants instead of the (misleadingly zero)
  // product-level quantity, and prompt the user to pick a variant.
  if (!variantId && variants.length > 1) {
    const total = variants.reduce((sum: number, v: any) => sum + (v.quantity ?? 0), 0)
    const uom = normalizeUom(product.uom) || 'pc'
    return {
      label: `${variants.length} variants · ${total} ${uom} on hand total — select a variant to see individual stock`,
      cls: 'text-blue-500',
    }
  }

  const src = variantId ? variants.find((v: any) => v.id === variantId) : product
  if (!src) return null
  const qty = src.quantity ?? 0
  const status = src.stock_status || 'in_stock'
  const uom = normalizeUom(src.uom || product.uom) || 'pc'
  const cls =
    status === 'out_of_stock' ? 'text-red-500' :
    status === 'low_stock'    ? 'text-amber-500' :
    'text-gray-400'
  return { label: `On hand: ${qty} ${uom}`, cls }
}

const QUALITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  unrestricted:       { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-300', label: 'Unrestricted' },
  quality_inspection: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', label: 'In Inspection' },
  blocked:            { bg: 'bg-red-50 dark:bg-red-950/50',     text: 'text-red-700 dark:text-red-300',     label: 'Blocked' },
}

const MOVEMENT_TYPES = [
  { value: 'gr_po', label: 'GR for PO' },
  { value: 'gr_reversal', label: 'GR Reversal' },
  { value: 'return_to_vendor', label: 'Return to Vendor' },
  { value: 'gi_cost_center', label: 'GI for Cost Center' },
  { value: 'gi_production', label: 'GI for Production Order' },
  { value: 'plant_transfer', label: 'Plant to Plant Transfer' },
  { value: 'sloc_transfer', label: 'Storage Location Transfer' },
  { value: 'receipt_no_po', label: 'Receipt w/o PO' },
]

const movementLabel = (mt: string) => MOVEMENT_TYPES.find(t => t.value === mt)?.label ?? mt

// ── Batch Edit ──────────────────────────────────────────────────
function BatchQualityModal({ batch, onClose }: { batch: GoodsBatch; onClose: () => void }) {
  const update = useUpdateGoodsBatch()
  const [quality, setQuality] = useState(batch.quality_status)
  const [notes, setNotes] = useState(batch.notes ?? '')
  useEscapeToClose(onClose, true)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Update Batch Quality</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Batch: <strong>{batch.batch_number}</strong>
            {batch.product_name ? (
              <>
                {' · '}
                <span className="text-gray-800">{batch.product_name}</span>
                {batch.variant_name ? <span className="text-gray-500"> ({batch.variant_name})</span> : null}
              </>
            ) : null}
          </p>
          <div>
            <Label className="text-xs">Quality Status</Label>
            <Select
              value={quality}
              onChange={v => setQuality(v as typeof quality)}
              options={Object.entries(QUALITY_BADGE).map(([v, { label }]) => ({ value: v, label }))}
              className="mt-1 text-sm"
            />
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
  const { data: plantsData } = usePlants()
  const plants = plantsData?.plants ?? []
  const { data: productsData } = useProducts({ size: 200 })
  const listProducts = (productsData?.items ?? []) as Product[]

  /** Full product payloads (with variants/cost/uom) keyed by id — list endpoint can be thin. */
  const [productCache, setProductCache] = useState<Record<string, Product>>({})
  const [loadingLine, setLoadingLine] = useState<number | null>(null)
  const fetchingRef = useRef<Record<string, Promise<Product | null>>>({})

  const products = useMemo(() => {
    return listProducts.map(p => productCache[p.id] ?? p)
  }, [listProducts, productCache])

  const [movementType, setMovementType] = useState('receipt_no_po')
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10))
  const [plantId, setPlantId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<MovementLine[]>([emptyMovementLine()])

  useEscapeToClose(onClose, true)

  const updateLine = (i: number, patch: Partial<MovementLine>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const ensureFullProduct = useCallback(async (productId: string): Promise<Product | null> => {
    if (!productId) return null
    const cached = productCache[productId] as (Product & { __full?: boolean }) | undefined
    if (cached?.__full) return cached

    if (fetchingRef.current[productId]) return fetchingRef.current[productId]

    const req = (async () => {
      try {
        const full = await vendorApi.getProduct(productId) as Product & { __full?: boolean }
        full.__full = true
        setProductCache(prev => ({ ...prev, [productId]: full }))
        return full
      } catch {
        const fallback = (productCache[productId] ?? listProducts.find(p => p.id === productId) ?? null) as Product | null
        return fallback
      } finally {
        delete fetchingRef.current[productId]
      }
    })()

    fetchingRef.current[productId] = req
    return req
  }, [productCache, listProducts])

  const selectProduct = async (i: number, productId: string) => {
    if (!productId) {
      setLines(prev => prev.map((l, idx) => idx === i ? emptyMovementLine() : l))
      return
    }
    // Optimistic seed from whatever we have, then always refine from full product master
    setLines(prev => prev.map((l, idx) => idx === i ? lineFromProduct(productId, products as Product[]) : l))
    setLoadingLine(i)
    try {
      const full = await ensureFullProduct(productId)
      if (!full) return
      setLines(prev => prev.map((l, idx) => idx === i ? lineFromProduct(productId, [full]) : l))
    } finally {
      setLoadingLine(null)
    }
  }

  const selectVariant = async (i: number, variantId: string) => {
    const productId = lines[i]?.product_id
    if (!productId) {
      updateLine(i, { variant_id: variantId })
      return
    }
    setLoadingLine(i)
    try {
      const full = await ensureFullProduct(productId)
      const catalog = full ? [full] : (products as Product[])
      setLines(prev => prev.map((l, idx) => {
        if (idx !== i) return l
        return lineFromVariant({ ...l, product_id: productId }, variantId, catalog)
      }))
    } finally {
      setLoadingLine(null)
    }
  }

  const needsPlant = ['gr_po', 'receipt_no_po', 'gi_cost_center', 'gi_production', 'return_to_vendor', 'gr_reversal'].includes(movementType)

  const handleSave = () => {
    const validLines = lines.filter(l => l.product_id)
    if (!validLines.length) { toast.error('Add at least one product line'); return }
    if (needsPlant && !plantId) {
      toast.error('Select a plant — required to update inventory stock')
      return
    }
    create.mutate({
      movement_type: movementType,
      posting_date: postingDate,
      plant_id: plantId || undefined,
      notes: notes || undefined,
      lines: validLines.map(l => ({
        product_id: l.product_id,
        variant_id: l.variant_id || undefined,
        quantity: Number(l.quantity),
        uom: l.uom,
        unit_cost: l.unit_cost ? Number(l.unit_cost) : undefined,
        to_plant_id: plantId || undefined,
      })),
    }, { onSuccess: onClose })
  }

  const uomOptions = useMemo(() => {
    const base = UOM_OPTIONS.map(u => ({ value: u.value, label: u.label }))
    const known = new Set(base.map(o => o.value))
    for (const l of lines) {
      const u = normalizeUom(l.uom)
      if (u && !known.has(u)) {
        known.add(u)
        base.push({ value: u, label: u })
      }
    }
    return base
  }, [lines])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Post Goods Movement
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <CardContent className="p-6 space-y-5">
          {/* Header fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Movement Type *</Label>
              <Select
                value={movementType}
                onChange={setMovementType}
                options={MOVEMENT_TYPES.map(m => ({ value: m.value, label: m.label }))}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Posting Date *</Label>
              <Input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">
                Plant {needsPlant && <span className="text-red-500">*</span>}
              </Label>
              <Select
                value={plantId}
                onChange={setPlantId}
                options={selectOptionsWithBlank(
                  needsPlant ? 'Select plant…' : 'All plants',
                  plants.map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })),
                )}
                className={`mt-1 text-sm ${needsPlant && !plantId ? 'ring-1 ring-red-300' : ''}`}
              />
              {needsPlant && !plantId && (
                <p className="text-[11px] text-red-500 mt-1">Required — determines which business unit receives the stock</p>
              )}
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason / reference" className="mt-1" />
            </div>
          </div>

          {/* Material lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Material Lines</h3>
              <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, emptyMovementLine()])} className="gap-1 h-7 text-xs">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[2.5fr_2fr_1.2fr_1.5fr_1.5fr_2rem] gap-2 mb-1 px-0.5">
              {['Product', 'Variant', 'Qty', 'UoM', 'Unit Cost (₹)', ''].map(h => (
                <p key={h} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</p>
              ))}
            </div>

            <div className="space-y-3">
              {lines.map((l, i) => {
                const product = products.find(p => p.id === l.product_id)
                const activeVariants = (product?.variants ?? []).filter((v: any) => v.is_active !== false)
                const hint = stockHint(product, l.variant_id)
                return (
                  <div key={i} className="space-y-1">
                    <div className="grid grid-cols-[2.5fr_2fr_1.2fr_1.5fr_1.5fr_2rem] gap-2 items-center">
                      {/* Product */}
                      <Select
                        value={l.product_id}
                        onChange={v => selectProduct(i, v)}
                        options={selectOptionsWithBlank(
                          'Select product…',
                          products.map((p: any) => ({ value: p.id, label: p.name })),
                        )}
                        className="text-sm"
                      />
                      {/* Variant */}
                      {activeVariants.length > 0 ? (
                        <Select
                          value={l.variant_id}
                          onChange={v => selectVariant(i, v)}
                          options={selectOptionsWithBlank(
                            '— Product level —',
                            activeVariants.map((v: any) => variantSelectOption(v)),
                          )}
                          className="text-sm"
                        />
                      ) : (
                        <div className="h-10 flex items-center text-xs text-gray-400 px-2 border rounded-md bg-gray-50">
                          {l.product_id ? 'No variants' : '—'}
                        </div>
                      )}
                      {/* Qty */}
                      <Input
                        type="number"
                        min={0.001}
                        step={0.001}
                        value={l.quantity}
                        onChange={e => updateLine(i, { quantity: e.target.value })}
                        className="h-10 text-sm"
                        aria-label="Quantity"
                      />
                      {/* UoM */}
                      <div className="relative">
                        <Select
                          value={l.uom || 'piece'}
                          onChange={v => updateLine(i, { uom: v })}
                          options={uomOptions}
                          className="text-sm"
                          disabled={loadingLine === i}
                        />
                      </div>
                      {/* Unit cost */}
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={l.unit_cost}
                          onChange={e => updateLine(i, { unit_cost: e.target.value })}
                          className="h-10 text-sm"
                          placeholder="0.00"
                          aria-label="Unit cost"
                          disabled={loadingLine === i}
                        />
                        {loadingLine === i && (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
                        )}
                      </div>
                      {/* Remove */}
                      <div className="flex justify-center">
                        {lines.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}>
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* On-hand stock hint + master-data tip */}
                    {hint && (
                      <p className={`text-[11px] pl-1 ${hint.cls}`}>{hint.label}</p>
                    )}
                  </div>
                )
              })}
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

// ── Movement List with expandable lines ───────────────────────────
function MovementsTable({ movements }: { movements: GoodsMovementDocument[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {['', 'Document No.', 'Type', 'Posting Date', 'Plant', 'Lines', 'Notes', 'Posted By'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movements.map(m => (
            <>
              <tr
                key={m.id}
                className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              >
                <td className="px-2 py-2 text-gray-400">
                  {expanded === m.id
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-blue-600 whitespace-nowrap">{m.document_number}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">{movementLabel(m.movement_type)}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.posting_date)}</td>
                <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={m.plant_name || m.plant_id || undefined}>
                  {m.plant_name || (m.plant_id ? m.plant_id.slice(0, 8) : '—')}
                </td>
                <td className="px-3 py-2">{m.lines.length}</td>
                <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate" title={m.notes || undefined}>{m.notes || '—'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{m.performed_by_name || '—'}</td>
              </tr>
              {expanded === m.id && (
                <tr key={`${m.id}-detail`} className="border-t bg-blue-50/40 dark:bg-blue-950/20">
                  <td colSpan={8} className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Material Lines</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left pb-1 pr-4 font-medium">Product</th>
                            <th className="text-left pb-1 pr-4 font-medium">Variant</th>
                            <th className="text-right pb-1 pr-4 font-medium">Qty</th>
                            <th className="text-left pb-1 pr-4 font-medium">UoM</th>
                            <th className="text-right pb-1 font-medium">Unit Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(m.lines as any[]).map((ln: any, idx: number) => (
                            <tr key={idx} className="border-t border-blue-100 dark:border-blue-900">
                              <td className="py-1 pr-4 font-medium">{ln.product_name || ln.product_id?.slice(0, 8) || '—'}</td>
                              <td className="py-1 pr-4 text-gray-500">{ln.variant_name || ln.variant_id?.slice(0, 8) || '—'}</td>
                              <td className="py-1 pr-4 text-right tabular-nums">{ln.quantity}</td>
                              <td className="py-1 pr-4 text-gray-500">{ln.uom || '—'}</td>
                              <td className="py-1 text-right tabular-nums">{ln.unit_cost != null ? `₹${Number(ln.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
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
      (b.variant_name || '').toLowerCase().includes(q) ||
      (b.serial_number || '').toLowerCase().includes(q)
    )
  }, [batches, search])

  const filteredMovements = useMemo(() => {
    const q = search.toLowerCase()
    return movements.filter(m =>
      !q ||
      m.document_number.toLowerCase().includes(q) ||
      m.movement_type.includes(q) ||
      movementLabel(m.movement_type).toLowerCase().includes(q)
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
                searchPlaceholder="Search batch, product, or variant…"
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
                        <td className="px-3 py-2 text-sm overflow-hidden">
                          <div className="min-w-0">
                            <p className="font-medium truncate" title={b.product_name || b.product_id}>
                              {b.product_name || b.product_id.slice(0, 8)}
                            </p>
                            {b.variant_name ? (
                              <p className="text-xs text-gray-500 truncate" title={b.variant_name}>
                                {b.variant_name}
                              </p>
                            ) : null}
                          </div>
                        </td>
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
              <MovementsTable movements={filteredMovements} />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
