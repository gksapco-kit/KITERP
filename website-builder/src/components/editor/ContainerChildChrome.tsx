import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import type { ContainerAlign, ContainerLayout } from '../../types/builder'
import { ContainerAlignCompact } from './ContainerAlignCompact'

interface ContainerChildChromeProps {
  layout: ContainerLayout
  span: 1 | 2 | 3
  alignX?: ContainerAlign
  alignY?: ContainerAlign
  index: number
  total: number
  onSpanChange: (span: 1 | 2 | 3) => void
  onAlignChange: (alignX: ContainerAlign | undefined, alignY: ContainerAlign | undefined) => void
  onMove: (direction: 'up' | 'down') => void
  dragHandleRef?: (element: HTMLElement | null) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

export function ContainerChildChrome({
  layout,
  span,
  alignX,
  alignY,
  index,
  total,
  onSpanChange,
  onAlignChange,
  onMove,
  dragHandleRef,
  dragHandleProps,
}: ContainerChildChromeProps) {
  const maxSpan = layout === 'grid' ? 3 : layout === 'row' ? 2 : 1
  const spanOptions: (1 | 2 | 3)[] =
    maxSpan === 3 ? [1, 2, 3] : maxSpan === 2 ? [1, 2] : [1]

  return (
    <div
      className="mb-1 flex items-center gap-1 rounded-md border border-gray-200/80 bg-gray-50/90 px-1 py-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        ref={dragHandleRef}
        className="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...dragHandleProps}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {layout !== 'column' && (
        <div className="flex items-center gap-0.5 border-l border-gray-200 pl-1">
          <span className="px-1 text-[10px] text-gray-400">Width</span>
          {spanOptions.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSpanChange(n)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                span === n
                  ? 'bg-brand-100 text-brand-700'
                  : 'text-gray-500 hover:bg-white hover:text-gray-800'
              }`}
            >
              {layout === 'row' && n === 2 ? 'Full' : `${n} col`}
            </button>
          ))}
        </div>
      )}

      <ContainerAlignCompact
        alignX={alignX}
        alignY={alignY}
        onAlignX={(v) => onAlignChange(v, alignY)}
        onAlignY={(v) => onAlignChange(alignX, v)}
      />

      <div className="ml-auto flex items-center border-l border-gray-200 pl-1">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove('up')}
          className="rounded p-0.5 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={index >= total - 1}
          onClick={() => onMove('down')}
          className="rounded p-0.5 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
