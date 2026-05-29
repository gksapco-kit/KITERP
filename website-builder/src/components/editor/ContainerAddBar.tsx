import { Plus } from 'lucide-react'
import { blockRegistry } from '../../lib/blockRegistry'
import { CONTAINER_QUICK_ADD } from '../../lib/containerQuickAdd'
import type { BlockType } from '../../types/builder'

interface ContainerAddBarProps {
  onAdd: (type: BlockType) => void
  compact?: boolean
}

export function ContainerAddBar({ onAdd, compact }: ContainerAddBarProps) {
  return (
    <div className={compact ? 'space-y-2' : 'mt-4 space-y-2 border-t border-dashed border-gray-200 pt-4'}>
      <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
        <Plus className="h-3 w-3" />
        Add component
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CONTAINER_QUICK_ADD.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAdd(type)
            }}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            title={blockRegistry[type]?.label ?? label}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
