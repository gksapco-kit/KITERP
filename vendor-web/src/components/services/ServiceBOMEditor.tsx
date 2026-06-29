import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Plus, Trash2, Save, Loader2, Factory, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServiceBOM, useUpdateServiceBOM } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { Product } from '@/types'

interface BOMRow {
  component_id: string
  component_name: string
  component_sku: string | null
  component_uom: string | null
  component_cost_price: number | null
  qty_per_service: number
  unit_cost_override: string
  auto_reserve: boolean
  notes: string
  id?: string
  unit_cost?: number
  line_cost?: number
}

interface PickerAnchor {
  top: number
  left: number
  width: number
}

interface ServiceBOMEditorProps {
  serviceId: string
  serviceName?: string
}

export function ServiceBOMEditor({ serviceId, serviceName }: ServiceBOMEditorProps) {
  const { data: bomData, isLoading: bomLoading } = useServiceBOM(serviceId)
  const updateBOM = useUpdateServiceBOM()

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
          component_cost_price: item.component_cost_price != null ? Number(item.component_cost_price) : null,
          qty_per_service: Number(item.qty_per_service),
          unit_cost_override: item.unit_cost_override != null ? String(item.unit_cost_override) : '',
          auto_reserve: item.auto_reserve !== false,
          notes: (item.notes as string) ?? '',
          unit_cost: Number(item.unit_cost ?? 0),
          line_cost: Number(item.line_cost ?? 0),
        }))
      )
      setDirty(false)
    }
  }, [bomData])

  const loadProducts = useCallback(async (q: string) => {
    setProductsLoading(true)
    try {
      const trimmed = q.trim()
      const params = trimmed.length >= 2
        ? { search: trimmed, size: 30 }
        : { size: 50 }
      const res = await vendorApi.listProducts(params)
      setProductResults(res?.items ?? [])
    } catch {
      setProductResults([])
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showPicker === null) return
    const q = search[showPicker] || ''
    const delay = q.trim().length >= 2 ? 250 : 0
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

  const totalMaterialCost = useMemo(() => {
    return rows.reduce((sum, row) => {
      const unitCost = row.unit_cost_override
        ? parseFloat(row.unit_cost_override) || 0
        : row.component_cost_price ?? 0
      return sum + row.qty_per_service * unitCost
    }, 0)
  }, [rows])

  const addRow = () => {
    setRows(r => [...r, {
      component_id: '', component_name: '', component_sku: null, component_uom: null,
      component_cost_price: null, qty_per_service: 1, unit_cost_override: '',
      auto_reserve: true, notes: '',
    }])
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
    const costPrice = product.cost_price
    setRows(r => r.map((row, i) => i === idx ? {
      ...row,
      component_id: product.id,
      component_name: product.name,
      component_sku: product.sku || null,
      component_uom: (product as unknown as Record<string, string>).uom || null,
      component_cost_price: costPrice ?? null,
    } : row))
    closePicker()
    setSearch(s => ({ ...s, [idx]: '' }))
    setDirty(true)
  }

  const handleSave = async () => {
    const validRows = rows.filter(r => r.component_id && r.qty_per_service > 0)
    await updateBOM.mutateAsync({
      serviceId,
      items: validRows.map(r => ({
        component_id: r.component_id,
        qty_per_service: r.qty_per_service,
        unit_cost_override: r.unit_cost_override ? parseFloat(r.unit_cost_override) : undefined,
        auto_reserve: r.auto_reserve,
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
            aria-label="Close material picker"
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
                className="flex-1 text-sm outline-none bg-transparent"
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
                  {(search[showPicker] || '').trim().length >= 2
                    ? 'No matching products found'
                    : 'No products in catalog — add products under Inventory first'}
                </p>
              ) : (
                productResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectComponent(showPicker, p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                    {p.sku && <span className="text-xs text-gray-400 shrink-0">{p.sku}</span>}
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
        <span className="text-sm">Loading service BOM…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pickerPortal}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">
            Materials and products consumed to deliver <strong>{serviceName || 'this service'}</strong>.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Quantities are per one service delivery. Items marked auto-reserve will be held in stock when a booking is confirmed.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={updateBOM.isPending} className="gap-1.5 shrink-0">
            {updateBOM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save BOM
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated material cost per service</span>
          <span className="font-semibold text-foreground">₹{totalMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
          <Factory className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No materials defined yet</p>
          <p className="text-xs text-gray-400 mb-4">Add consumables, spare parts, or products used during service delivery</p>
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Material
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold w-[32%]"><TableColumnLabel>Material / Product</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Qty</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[12%]"><TableColumnLabel>Unit Cost</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Line Cost</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold w-[8%]"><TableColumnLabel>Reserve</TableColumnLabel></th>
                <th className="px-4 py-2.5 text-left font-semibold"><TableColumnLabel>Notes</TableColumnLabel></th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => {
                const unitCost = row.unit_cost_override
                  ? parseFloat(row.unit_cost_override) || 0
                  : row.component_cost_price ?? 0
                const lineCost = row.qty_per_service * unitCost
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={e => {
                          if (showPicker === idx) closePicker()
                          else openPicker(idx, e.currentTarget)
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded border text-sm truncate ${
                          row.component_id ? 'border-gray-200 text-gray-900' : 'border-dashed border-gray-300 text-gray-400'
                        }`}
                      >
                        {row.component_id ? row.component_name : '— select material —'}
                      </button>
                      {row.component_sku && <p className="text-xs text-gray-400 mt-0.5 pl-1">SKU: {row.component_sku}</p>}
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min={0.0001} step={0.0001} value={row.qty_per_service}
                        onChange={e => updateRow(idx, 'qty_per_service', parseFloat(e.target.value) || 0)}
                        className="w-20 text-sm h-8" />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min={0} step={0.01}
                        value={row.unit_cost_override || (row.component_cost_price ?? '')}
                        placeholder={row.component_cost_price != null ? String(row.component_cost_price) : '0'}
                        onChange={e => updateRow(idx, 'unit_cost_override', e.target.value)}
                        className="w-24 text-sm h-8" />
                    </td>
                    <td className="px-4 py-2 text-gray-700 font-medium text-xs">
                      ₹{lineCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={row.auto_reserve}
                        onChange={e => updateRow(idx, 'auto_reserve', e.target.checked)}
                        className="rounded" title="Auto-reserve stock on booking" />
                    </td>
                    <td className="px-4 py-2">
                      <Input value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)}
                        placeholder="Optional" className="text-sm h-8" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <Button type="button" size="sm" variant="outline" onClick={addRow} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Material
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
