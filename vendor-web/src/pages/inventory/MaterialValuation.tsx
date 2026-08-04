import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useMaterialValuation, useUpdateMaterialValuation } from '@/hooks/useVendor'
import { formatCurrency } from '@/lib/utils'
import type { MaterialValuation } from '@/types'
import { Loader2, X, Scale, Pencil, TrendingUp, DollarSign, Package } from 'lucide-react'

// ─── Edit Modal ───────────────────────────────────────────────────
function ValuationEditModal({
  valuation,
  onClose,
}: {
  valuation: MaterialValuation
  onClose: () => void
}) {
  const update = useUpdateMaterialValuation()
  const [standardPrice, setStandardPrice] = useState(String(valuation.standard_price ?? ''))
  const [method, setMethod] = useState(valuation.valuation_method)
  useEscapeToClose(onClose, true)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Update Valuation</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Product:{' '}
            <strong>{valuation.product_name || valuation.product_id.slice(0, 12)}</strong>
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <div>
              <p className="text-gray-500 text-xs">Current Stock</p>
              <p className="font-semibold">{valuation.total_stock}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Value</p>
              <p className="font-semibold">{formatCurrency(valuation.total_value)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Moving Avg Price</p>
              <p className="font-semibold text-blue-600">{formatCurrency(valuation.moving_avg_price)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Currency</p>
              <p className="font-semibold">{valuation.currency}</p>
            </div>
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
                type="number"
                min={0}
                step={0.01}
                value={standardPrice}
                onChange={e => setStandardPrice(e.target.value)}
                className="mt-1"
                placeholder="Fixed standard price"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                update.mutate(
                  {
                    id: valuation.id,
                    data: {
                      valuation_method: method,
                      standard_price: standardPrice ? Number(standardPrice) : undefined,
                    },
                  },
                  { onSuccess: onClose },
                )
              }
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

// ─── Main Page ────────────────────────────────────────────────────
export default function MaterialValuationPage() {
  const [search, setSearch] = useState('')
  const [editingVal, setEditingVal] = useState<MaterialValuation | undefined>()

  const { data: valData, isLoading } = useMaterialValuation()
  const valuations: MaterialValuation[] = valData?.items ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return valuations.filter(v => !q || (v.product_name || '').toLowerCase().includes(q))
  }, [valuations, search])

  const totalValue = valuations.reduce((s, v) => s + v.total_value, 0)
  const mapCount = valuations.filter(v => v.valuation_method === 'moving_average').length
  const stdCount = valuations.filter(v => v.valuation_method === 'standard_price').length

  return (
    <div className="space-y-6">
      {editingVal && (
        <ValuationEditModal valuation={editingVal} onClose={() => setEditingVal(undefined)} />
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Scale className="w-6 h-6 text-primary" />
          Material Valuation
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          View and update inventory valuation methods (MAP / Standard Price) per material
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Package className="w-3.5 h-3.5" /> Materials Tracked
          </div>
          <p className="text-2xl font-bold text-blue-600">{valuations.length}</p>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Total Stock Value
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Moving Average (MAP)
          </div>
          <p className="text-2xl font-bold text-indigo-600">{mapCount}</p>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Scale className="w-3.5 h-3.5" /> Standard Price
          </div>
          <p className="text-2xl font-bold text-amber-600">{stdCount}</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="px-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search product name…"
            sortOptions={[
              { value: 'product_name', label: 'Product' },
              { value: 'total_value', label: 'Value' },
            ]}
            sortKey="product_name"
            sortDir="asc"
            onSortKeyChange={() => {}}
            onSortDirChange={() => {}}
          />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No valuation records yet</p>
            <p className="text-sm">
              Valuations are auto-created on goods receipt. You can update the method here.
            </p>
          </div>
        ) : (
          <ResizableTable
            tableId="material-valuation"
            defaultWidths={[220, 100, 100, 120, 120, 100, 80, 60]}
          >
            <thead>
              <tr>
                {[
                  'Product',
                  'Method',
                  'Total Stock',
                  'MAP Price',
                  'Std Price',
                  'Total Value',
                  'Currency',
                  '',
                ].map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr
                  key={v.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-3 py-2 text-sm font-medium">
                    {v.product_name || v.product_id.slice(0, 12)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.valuation_method === 'moving_average'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {v.valuation_method === 'moving_average' ? 'MAP' : 'Std'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold">{v.total_stock}</td>
                  <td className="px-3 py-2 text-sm text-blue-600 font-medium">
                    {formatCurrency(v.moving_avg_price)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {v.standard_price ? formatCurrency(v.standard_price) : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-green-700">
                    {formatCurrency(v.total_value)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{v.currency}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingVal(v)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResizableTable>
        )}
      </Card>
    </div>
  )
}
