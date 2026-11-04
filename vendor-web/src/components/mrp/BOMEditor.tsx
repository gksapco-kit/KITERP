import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Plus, Trash2, Save, Loader2, Factory, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductBOM, useUpdateProductBOM } from '@/hooks/useVendor'
import { useHasPermission } from '@/hooks/usePermissions'
import { vendorApi } from '@/api/vendor'
import type { Product } from '@/types'
import { ProductRoutingEditor } from '@/components/mrp/ProductRoutingEditor'

interface BOMRow {
  component_id: string
  component_name: string
  component_sku: string | null
  component_uom: string | null
  qty_per_unit: number
  /** Expected loss, % of the net quantity (added to the requirement). */
  scrap_pct: number
  /** ISO dates (yyyy-mm-dd) bounding when this line applies; empty = open ended. */
  valid_from: string
  valid_to: string
  /** An output of the run (received into stock) instead of a consumed material. */
  is_byproduct: boolean
  /** Share of the run's cost carried by a by-product, %. */
  cost_share_pct: number
  notes: string
  id?: string
}

const blankRow = (): BOMRow => ({
  component_id: '', component_name: '', component_sku: null, component_uom: null,
  qty_per_unit: 1, scrap_pct: 0, valid_from: '', valid_to: '', is_byproduct: false, cost_share_pct: 0, notes: '',
})

/** Lines for the same component and role may repeat only as successive, non-overlapping revisions. */
function overlappingComponentIds(rows: BOMRow[]): Set<string> {
  const bad = new Set<string>()
  const lo = (r: BOMRow) => r.valid_from || '0000-01-01'
  const hi = (r: BOMRow) => r.valid_to || '9999-12-31'
  rows.forEach((a, i) => {
    rows.forEach((b, j) => {
      if (j <= i || !a.component_id || a.component_id !== b.component_id || a.is_byproduct !== b.is_byproduct) return
      if (lo(a) <= hi(b) && lo(b) <= hi(a)) bad.add(a.component_id)
    })
  })
  return bad
}

interface PickerAnchor {
  top: number
  left: number
  width: number
}

interface BOMEditorProps {
  productId: string
  productName?: string
}

export function BOMEditor({ productId, productName }: BOMEditorProps) {
  const { data: bomData, isLoading: bomLoading } = useProductBOM(productId)
  const updateBOM = useUpdateProductBOM()
  const canEdit = useHasPermission('production.manage')

  const [rows, setRows] = useState<BOMRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [search, setSearch] = useState<Record<number, string>>({})
  const [showPicker, setShowPicker] = useState<number | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null)
  const [productResults, setProductResults] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const pickerBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (bomData) {
      setRows(
        (bomData as unknown as Record<string, unknown>[]).map(item => ({
          id: item.id as string,
          component_id: item.component_id as string,
          component_name: item.component_name as string,
          component_sku: (item.component_sku as string) ?? null,
          component_uom: (item.component_uom as string) ?? null,
          qty_per_unit: Number(item.qty_per_unit),
          scrap_pct: Number(item.scrap_pct ?? 0),
          valid_from: (item.valid_from as string) ?? '',
          valid_to: (item.valid_to as string) ?? '',
          is_byproduct: Boolean(item.is_byproduct),
          cost_share_pct: Number(item.cost_share_pct ?? 0),
          notes: (item.notes as string) ?? '',
        })),
      )
      setDirty(false)
    }
  }, [bomData])

  const loadProducts = useCallback(async (q: string) => {
    setProductsLoading(true)
    try {
      const trimmed = q.trim()
      const params = trimmed.length >= 1
        ? { search: trimmed, size: 50, status: 'active' }
        : { size: 100, status: 'active' }
      const res = await vendorApi.listProducts(params)
      const items = (res?.items ?? []).filter(p => p.id !== productId)
      setProductResults(items)
    } catch {
      setProductResults([])
    } finally {
      setProductsLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (showPicker === null) return
    const q = search[showPicker] || ''
    const delay = q.trim().length >= 1 ? 200 : 0
    const t = setTimeout(() => loadProducts(q), delay)
    return () => clearTimeout(t)
  }, [showPicker, search, loadProducts])

  useEffect(() => {
    if (showPicker === null) return
    const onScrollOrResize = () => {
      if (!pickerBtnRef.current) return
      const rect = pickerBtnRef.current.getBoundingClientRect()
      setPickerAnchor({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 288) })
    }
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [showPicker])

  const closePicker = useCallback(() => {
    setShowPicker(null)
    setPickerAnchor(null)
    pickerBtnRef.current = null
  }, [])

  const openPicker = (idx: number, btn: HTMLButtonElement) => {
    pickerBtnRef.current = btn
    const rect = btn.getBoundingClientRect()
    setPickerAnchor({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 288) })
    setShowPicker(idx)
    loadProducts(search[idx] || '')
  }

  const addRow = () => {
    setRows(r => [...r, blankRow()])
    setDirty(true)
  }

  const removeRow = (idx: number) => {
    setRows(r => r.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const updateRow = useCallback((idx: number, field: keyof BOMRow, value: string | number | boolean) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    setDirty(true)
  }, [])

  const selectComponent = (idx: number, product: Product) => {
    setRows(r => r.map((row, i) => i === idx ? {
      ...row,
      component_id: product.id,
      component_name: product.name,
      component_sku: product.sku || null,
      component_uom: (product as unknown as Record<string, string>).uom || null,
    } : row))
    closePicker()
    setSearch(s => ({ ...s, [idx]: '' }))
    setDirty(true)
  }

  // A component may repeat only with non-overlapping validity dates (the server rejects it too).
  const duplicateIds = overlappingComponentIds(rows)
  const badDates = rows.some(r => r.valid_from && r.valid_to && r.valid_to < r.valid_from)
  const byproductShare = rows.filter(r => r.is_byproduct).reduce((s, r) => s + (r.cost_share_pct || 0), 0)
  const blocked = duplicateIds.size > 0 || badDates || byproductShare > 100

  const handleSave = async () => {
    const validRows = rows.filter(r => r.component_id && r.qty_per_unit > 0)
    if (blocked) return
    await updateBOM.mutateAsync({
      productId,
      items: validRows.map(r => ({
        component_id: r.component_id,
        qty_per_unit: r.qty_per_unit,
        scrap_pct: r.is_byproduct ? 0 : (r.scrap_pct || 0),
        valid_from: r.valid_from || null,
        valid_to: r.valid_to || null,
        is_byproduct: r.is_byproduct,
        cost_share_pct: r.is_byproduct ? (r.cost_share_pct || 0) : 0,
        notes: r.notes || undefined,
      })),
    })
    setDirty(false)
  }

  const pickerPortal = showPicker !== null && pickerAnchor && typeof document !== 'undefined'
    ? createPortal(
        <>
          <button
            type="button"
            aria-label="Close component picker"
            className="fixed inset-0 z-[200] cursor-default bg-transparent"
            onClick={closePicker}
          />
          <div
            className="fixed z-[210] flex max-h-[min(20rem,calc(100vh-1rem))] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
            style={{ top: pickerAnchor.top, left: pickerAnchor.left, width: pickerAnchor.width }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b p-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus
                value={search[showPicker] || ''}
                onChange={e => setSearch(s => ({ ...s, [showPicker]: e.target.value }))}
                placeholder="Search products…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {search[showPicker] && (
                <button type="button" onClick={() => setSearch(s => ({ ...s, [showPicker]: '' }))}>
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
            <div className="min-h-[8rem] flex-1 overflow-y-auto">
              {productsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading products…</span>
                </div>
              ) : productResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-gray-400">
                  {(search[showPicker] || '').trim()
                    ? 'No matching products found'
                    : 'No products in catalog — add products under Inventory first'}
                </p>
              ) : (
                productResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectComponent(showPicker, p)}
                    className="flex w-full items-center justify-between gap-2 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-indigo-50"
                  >
                    <span className="truncate text-sm font-medium text-gray-900">{p.name}</span>
                    {p.sku && <span className="shrink-0 text-xs text-gray-400">{p.sku}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body,
      )
    : null

  if (bomLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading Bill of Materials…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pickerPortal}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Define the raw materials / components required to produce <strong>{productName || 'this product'}</strong>.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Quantities are per 1 finished unit. MRP will multiply by the order quantity. Scrap % adds the expected loss on top.
          </p>
          {!canEdit && (
            <p className="text-xs text-amber-600 mt-0.5">You have view-only access to production; the BOM cannot be changed.</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            Valid from / to let you prepare a new revision: add the same component again with later dates.
            A by-product is received into stock on completion and carries its cost share.
          </p>
          {duplicateIds.size > 0 && (
            <p className="text-xs text-red-600 mt-0.5">A component appears more than once with overlapping dates — fix the dates or combine the lines.</p>
          )}
          {badDates && <p className="text-xs text-red-600 mt-0.5">A line ends before it starts.</p>}
          {byproductShare > 100 && <p className="text-xs text-red-600 mt-0.5">By-product cost shares add up to more than 100%.</p>}
        </div>
        {dirty && canEdit && (
          <Button size="sm" onClick={handleSave} disabled={updateBOM.isPending || blocked} className="gap-1.5 shrink-0">
            {updateBOM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save BOM
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
          <Factory className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No BOM defined yet</p>
          <p className="mb-4 text-xs text-gray-400">Add the components / raw materials needed to produce this item</p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add First Component
            </Button>
          )}
        </div>
      ) : (
        <fieldset disabled={!canEdit} className="m-0 min-w-0 overflow-visible rounded-xl border p-0 disabled:opacity-90">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold w-[40%]"><TableColumnLabel>Component / Material</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[12%]"><TableColumnLabel>Qty / Unit</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Scrap / Cost %</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[12%]"><TableColumnLabel>Valid from</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[12%]"><TableColumnLabel>Valid to</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[8%]"><TableColumnLabel>UOM</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold"><TableColumnLabel>Notes</TableColumnLabel></th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={e => {
                        if (showPicker === idx) closePicker()
                        else openPicker(idx, e.currentTarget)
                      }}
                      className={`w-full truncate rounded border px-3 py-1.5 text-left text-sm ${
                        duplicateIds.has(row.component_id)
                          ? 'border-red-400 text-gray-900'
                          : row.component_id ? 'border-gray-200 text-gray-900' : 'border-dashed border-gray-300 text-gray-400'
                      }`}
                    >
                      {row.component_id ? row.component_name : '— select component —'}
                    </button>
                    {row.component_sku && (
                      <p className="mt-0.5 pl-1 text-xs text-gray-400">SKU: {row.component_sku}</p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0.0001}
                      step={0.0001}
                      value={row.qty_per_unit}
                      onChange={e => updateRow(idx, 'qty_per_unit', parseFloat(e.target.value) || 0)}
                      className="h-8 w-24 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.is_byproduct ? 'byproduct' : 'material'}
                      onChange={e => updateRow(idx, 'is_byproduct', e.target.value === 'byproduct')}
                      className="h-8 rounded-md border bg-background px-1 text-xs"
                    >
                      <option value="material">Material</option>
                      <option value="byproduct">By-product</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      title={row.is_byproduct ? 'Share of the run cost carried by this by-product (%)' : 'Expected loss (%)'}
                      value={row.is_byproduct ? row.cost_share_pct : row.scrap_pct}
                      onChange={e => updateRow(
                        idx,
                        row.is_byproduct ? 'cost_share_pct' : 'scrap_pct',
                        Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                      )}
                      className="h-8 w-20 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input type="date" value={row.valid_from} onChange={e => updateRow(idx, 'valid_from', e.target.value)} className="h-8 text-xs" />
                  </td>
                  <td className="px-4 py-2">
                    <Input type="date" value={row.valid_to} onChange={e => updateRow(idx, 'valid_to', e.target.value)} className="h-8 text-xs" />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{row.component_uom || '—'}</td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.notes}
                      onChange={e => updateRow(idx, 'notes', e.target.value)}
                      placeholder="Optional note"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-gray-400 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
            <Button size="sm" variant="ghost" onClick={addRow} className="gap-1.5 text-indigo-600 hover:text-indigo-700">
              <Plus className="h-3.5 w-3.5" /> Add Component
            </Button>
            <span className="text-xs text-gray-400">{rows.filter(r => r.component_id).length} component(s)</span>
          </div>
        </fieldset>
      )}

      <div className="border-t pt-2">
        <ProductRoutingEditor productId={productId} />
      </div>
    </div>
  )
}
