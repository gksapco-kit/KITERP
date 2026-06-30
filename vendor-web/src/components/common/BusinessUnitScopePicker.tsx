import { Store } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StoreScope = 'all' | 'selected'

type StoreOption = { id: string; name: string; code?: string | null; is_active?: boolean }

type Props = {
  stores: StoreOption[]
  scope: StoreScope
  selectedIds: string[]
  onScopeChange: (scope: StoreScope) => void
  onSelectedChange: (ids: string[]) => void
  className?: string
  hideHeader?: boolean
}

export function BusinessUnitScopePicker({
  stores,
  scope,
  selectedIds,
  onScopeChange,
  onSelectedChange,
  className,
  hideHeader = false,
}: Props) {
  const activeStores = stores.filter(s => s.is_active !== false)

  const toggleStore = (id: string) => {
    onSelectedChange(
      selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id],
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-gray-500 shrink-0" />
          <p className="text-sm font-medium text-gray-800">Business unit availability</p>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Choose whether this item is offered at all business units or only at selected ones. Stock levels are still tracked per unit in Inventory.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onScopeChange('all')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            scope === 'all'
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
          )}
        >
          All business units
        </button>
        <button
          type="button"
          onClick={() => onScopeChange('selected')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            scope === 'selected'
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
          )}
        >
          Selected units only
        </button>
      </div>
      {scope === 'selected' && (
        activeStores.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No business units yet. Create one under Business Units first.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                className="font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                disabled={selectedIds.length === activeStores.length}
                onClick={() => onSelectedChange(activeStores.map(s => s.id))}
              >
                Select all
              </button>
              <button
                type="button"
                className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
                disabled={selectedIds.length === 0}
                onClick={() => onSelectedChange([])}
              >
                Clear all
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border bg-gray-50 p-2">
            {activeStores.map(s => {
              const checked = selectedIds.includes(s.id)
              return (
                <label
                  key={s.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm transition-colors',
                    checked ? 'border-indigo-300 bg-indigo-50' : 'border-transparent bg-white hover:bg-gray-100',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStore(s.id)}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-800">{s.name}</span>
                  {s.code && <span className="text-xs text-gray-400">{s.code}</span>}
                </label>
              )
            })}
            </div>
          </div>
        )
      )}
      {scope === 'selected' && selectedIds.length > 0 && (
        <p className="text-xs text-indigo-600 font-medium">
          Available at {selectedIds.length} business unit{selectedIds.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
