import { useDraggable } from '@dnd-kit/core'
import { getBlockIcon } from '../../lib/icons'
import type { BlockDefinition } from '../../types/builder'

interface PaletteItemProps {
  definition: BlockDefinition
}

export function PaletteItem({ definition }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${definition.type}`,
    data: { type: definition.type, source: 'palette' },
  })

  const Icon = getBlockIcon(definition.icon)

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={`flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600">
        <Icon className="h-4 w-4" />
      </span>
      {definition.label}
    </button>
  )
}
