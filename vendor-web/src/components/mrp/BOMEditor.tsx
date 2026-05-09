import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Loader2, Factory, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductBOM, useUpdateProductBOM, useProducts } from '@/hooks/useVendor'
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

interface BOMEditorProps {
  productId: string
  productName?: string
}

export function BOMEditor({ productId, productName }: BOMEditorProps) {
  const { data: bomData, isLoading: bomLoading } = useProductBOM(productId)
  const updateBOM = useUpdateProductBOM()
  const { data: productsData } = useProducts()
  const allProducts: Product[] = productsData?.items || []

  const [rows, setRows] = useState<BOMRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [search, setSearch] = useState<Record<number, string>>({})
  const [showPicker, setShowPicker] = useState<number | null>(null)

  // Populate rows when BOM data loads
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
        }))
      )
      setDirty(false)
    }
  }, [bomData])

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
    setShowPicker(null)
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

  const filteredProducts = (idx: number) => {
    const q = (search[idx] || '').toLowerCase()
    return allProducts
      .filter(p => p.id !== productId)
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 8)
  }

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
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
          <Factory className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No BOM defined yet</p>
          <p className="text-xs text-gray-400 mb-4">Add the components / raw materials needed to produce this item</p>
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add First Component
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold w-[40%]">Component / Material</th>
                <th className="px-4 py-2.5 text-left font-semibold w-[12%]">Qty / Unit</th>
                <th className="px-4 py-2.5 text-left font-semibold w-[10%]">UOM</th>
                <th className="px-4 py-2.5 text-left font-semibold">Notes</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {/* Component picker */}
                  <td className="px-4 py-2 relative">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <button
                          type="button"
                          onClick={() => setShowPicker(showPicker === idx ? null : idx)}
                          className={`w-full text-left px-3 py-1.5 rounded border text-sm truncate ${
                            row.component_id ? 'border-gray-200 text-gray-900' : 'border-dashed border-gray-300 text-gray-400'
                          }`}
                        >
                          {row.component_id ? row.component_name : '— select component —'}
                        </button>

                        {showPicker === idx && (
                          <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl">
                            <div className="p-2 border-b flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <input
                                autoFocus
                                value={search[idx] || ''}
                                onChange={e => setSearch(s => ({ ...s, [idx]: e.target.value }))}
                                placeholder="Search products…"
                                className="flex-1 text-sm outline-none"
                              />
                              {search[idx] && (
                                <button type="button" onClick={() => setSearch(s => ({ ...s, [idx]: '' }))}>
                                  <X className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                              )}
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredProducts(idx).length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4">No products found</p>
                              ) : filteredProducts(idx).map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => selectComponent(idx, p)}
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center justify-between gap-2"
                                >
                                  <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                                  {p.sku && <span className="text-xs text-gray-400 shrink-0">{p.sku}</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {row.component_sku && (
                      <p className="text-[11px] text-gray-400 mt-0.5 pl-1">SKU: {row.component_sku}</p>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0.0001}
                      step={0.0001}
                      value={row.qty_per_unit}
                      onChange={e => updateRow(idx, 'qty_per_unit', parseFloat(e.target.value) || 0)}
                      className="w-24 text-sm h-8"
                    />
                  </td>

                  {/* UOM */}
                  <td className="px-4 py-2 text-gray-500 text-xs">{row.component_uom || '—'}</td>

                  {/* Notes */}
                  <td className="px-4 py-2">
                    <Input
                      value={row.notes}
                      onChange={e => updateRow(idx, 'notes', e.target.value)}
                      placeholder="Optional note"
                      className="text-sm h-8"
                    />
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <Button type="button" size="sm" variant="outline" onClick={addRow} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Component
            </Button>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={updateBOM.isPending} className="gap-1.5">
                {updateBOM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save BOM
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
