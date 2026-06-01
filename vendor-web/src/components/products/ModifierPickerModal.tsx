import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { vendorApi, type ModifierGroup, type SelectedModifier } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'

export type ModifierPickerProduct = {
  id: string
  variant_id?: string
  name: string
  sku?: string
  price: number
  tax_rate?: number
  hsn_code?: string
  sac_code?: string
  item_type: 'product' | 'service'
  image_url?: string
  duration_minutes?: number
}

type Props = {
  item: ModifierPickerProduct
  onConfirm: (item: ModifierPickerProduct & { modifiers: SelectedModifier[] }) => void
  onClose: () => void
  confirmLabel?: string
}

export function ModifierPickerModal({ item, onConfirm, onClose, confirmLabel = 'Add to cart' }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-modifiers', item.id],
    queryFn: () => vendorApi.productListModifiers(item.id),
  })

  const groups = (data?.items ?? []).filter(g => g.is_active && g.options?.some(o => o.is_active))
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})

  useEffect(() => {
    if (!groups.length) return
    const defaults: Record<string, Set<string>> = {}
    for (const g of groups) {
      const defOpts = g.options.filter(o => o.is_default && o.is_active)
      if (defOpts.length) defaults[g.id] = new Set(defOpts.map(o => o.id))
    }
    setSelected(defaults)
  }, [groups.length])

  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelected(prev => {
      const cur = new Set(prev[group.id] ?? [])
      if (group.selection_type === 'single') {
        return { ...prev, [group.id]: new Set([optionId]) }
      }
      if (cur.has(optionId)) cur.delete(optionId)
      else cur.add(optionId)
      return { ...prev, [group.id]: cur }
    })
  }

  function isValid() {
    for (const g of groups) {
      if (g.is_required) {
        const count = selected[g.id]?.size ?? 0
        if (count < (g.min_select || 1)) return false
      }
    }
    return true
  }

  function buildModifiers(): SelectedModifier[] {
    const result: SelectedModifier[] = []
    for (const g of groups) {
      const selIds = selected[g.id] ?? new Set()
      for (const opt of g.options) {
        if (selIds.has(opt.id)) {
          result.push({
            group_id: g.id,
            group_name: g.name,
            option_id: opt.id,
            option_name: opt.name,
            price_delta: opt.price_delta,
          })
        }
      }
    }
    return result
  }

  const totalExtra = buildModifiers().reduce((s, m) => s + m.price_delta, 0)

  if (!isLoading && !groups.length) {
    onConfirm({ ...item, modifiers: [] })
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Customise your order</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}
          {groups.map(g => (
            <div key={g.id}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                <span className="text-xs text-gray-400">
                  {g.is_required ? 'Required' : 'Optional'}
                  {g.selection_type === 'multiple' ? ' · pick many' : ' · pick one'}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.options.filter(o => o.is_active).map(opt => {
                  const checked = selected[g.id]?.has(opt.id) ?? false
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(g, opt.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                        checked ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <span>{opt.name}</span>
                      <span className={cn('text-xs', opt.price_delta > 0 ? 'text-emerald-600' : 'text-gray-400')}>
                        {opt.price_delta > 0
                          ? `+${formatCurrency(opt.price_delta)}`
                          : opt.price_delta < 0
                            ? formatCurrency(opt.price_delta)
                            : 'free'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">{formatCurrency(item.price + totalExtra)}</span>
            {totalExtra > 0 && (
              <span className="text-xs text-gray-400 ml-1">(+{formatCurrency(totalExtra)} extras)</span>
            )}
          </div>
          <Button className="flex-1" disabled={!isValid()} onClick={() => onConfirm({ ...item, modifiers: buildModifiers() })}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
