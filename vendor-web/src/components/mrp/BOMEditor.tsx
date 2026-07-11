import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Plus, Trash2, Save, Loader2, Factory, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductBOM, useUpdateProductBOM } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { Product } from '@/types'

interface BOMRow {
  component_id: string
  component_name: string
  component_sku: string | null
  component_uom: string | null
  qty_per_unit: number
  notes: string
  id?: string
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
        (bomData as Record<string, unknown>[]).map(item => ({
          id: item.id as string,
          component_id: item.component_id as string,
          component_name: item.component_name as string,
          component_sku: (item.component_sku as string) ?? null,
          component_uom: (item.component_uom as string) ?? null,
          qty_per_unit: Number(item.qty_per_unit),
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
    setRows(r => [...r, { component_id: '', component_name: '', component_sku: null, component_uom: null, qty_per_unit: 1, notes: '' }])
    setDirty(true)
  }

  const removeRow = (idx: number) => {
    setRows(r => r.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const updateRow = useCallback((idx: number, field: keyof BOMRow, value: string | number) => {
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

  const handleSave = async () => {
    const validRows = rows.filter(r => r.component_id && r.qty_per_unit > 0)
    await updateBOM.mutateAsync({
      productId,
      items: validRows.map(r => ({
        component_id: r.component_id,
        qty_per_unit: r.qty_per_unit,
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
            Quantities are per 1 finished unit. MRP will multiply by the order quantity.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={updateBOM.isPending} className="gap-1.5 shrink-0">
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
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add First Component
          </Button>
        </div>
      ) : (
        <div className="overflow-visible rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold w-[40%]"><TableColumnLabel>Component / Material</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[12%]"><TableColumnLabel>Qty / Unit</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>UOM</TableColumnLabel></th>
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
                        row.component_id ? 'border-gray-200 text-gray-900' : 'border-dashed border-gray-300 text-gray-400'
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
                      <Trash2 className="h-4 w-4" />
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
        </div>
      )}
    </div>
  )
}
