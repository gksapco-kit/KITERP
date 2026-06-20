import type { SyntheticEvent } from 'react'
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Move,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  alignOverlayInContainer,
  guidesForContainerAlign,
  type OverlayContainerAlign,
  type OverlayGuideLine,
} from '@/lib/overlayAlignmentSnap'
import type { OverlayLayerItem } from '@/lib/builderOverlayVisual'
import { visualActionBtn, visualPanel } from '@/components/websites/designBarVisualUi'

type OverlayPatch = Partial<Pick<OverlayLayerItem, 'x' | 'y'>>

const GRID_ALIGNS: {
  id: OverlayContainerAlign
  label: string
  Icon: typeof AlignHorizontalJustifyStart
}[] = [
  { id: 'left', label: 'Align left in section', Icon: AlignHorizontalJustifyStart },
  { id: 'center-h', label: 'Center horizontally in section', Icon: AlignHorizontalJustifyCenter },
  { id: 'right', label: 'Align right in section', Icon: AlignHorizontalJustifyEnd },
  { id: 'top', label: 'Align top in section', Icon: AlignVerticalJustifyStart },
  { id: 'center-v', label: 'Center vertically in section', Icon: AlignVerticalJustifyCenter },
  { id: 'bottom', label: 'Align bottom in section', Icon: AlignVerticalJustifyEnd },
]

function boxFromItem(item: Pick<OverlayLayerItem, 'x' | 'y' | 'w' | 'h'>) {
  return {
    x: item.x ?? 0,
    y: item.y ?? 0,
    w: item.w ?? 100,
    h: item.h ?? 100,
  }
}

export function OverlayAlignControls({
  item,
  containerWidth,
  containerHeight,
  onUpdate,
  onShowGuides,
  onStopBubble,
  variant = 'toolbar',
}: {
  item: Pick<OverlayLayerItem, 'x' | 'y' | 'w' | 'h'>
  containerWidth: number
  containerHeight: number
  onUpdate: (patch: OverlayPatch) => void
  onShowGuides?: (guides: OverlayGuideLine[]) => void
  onStopBubble?: (e: SyntheticEvent) => void
  variant?: 'compact' | 'toolbar'
}) {
  const cw = Math.max(1, containerWidth)
  const ch = Math.max(1, containerHeight)

  const applyAlign = (mode: OverlayContainerAlign) => {
    const next = alignOverlayInContainer(boxFromItem(item), cw, ch, mode)
    onUpdate({ x: next.x, y: next.y })
    if (onShowGuides) {
      onShowGuides(guidesForContainerAlign(next, cw, ch, mode))
      window.setTimeout(() => onShowGuides([]), 1600)
    }
  }

  const cell =
    variant === 'toolbar'
      ? 'flex h-6 w-full items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-primary/10 hover:text-primary dark:border-gray-600 dark:bg-gray-800'
      : cn(visualActionBtn('muted'), 'h-6 w-6 px-0')

  const gridClass =
    variant === 'toolbar'
      ? 'grid grid-cols-3 gap-0.5'
      : cn(visualPanel, 'grid grid-cols-3 gap-0 overflow-hidden p-0')

  return (
    <div className="space-y-1">
      <div className={gridClass} role="group" aria-label="Align in section">
        {GRID_ALIGNS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            className={cell}
            onMouseDown={onStopBubble}
            onClick={() => applyAlign(id)}
          >
            <Icon className="h-3 w-3" />
          </button>
        ))}
      </div>
      <button
        type="button"
        title="Center in section — pink guides appear while dragging"
        aria-label="Center in section"
        className={cn(cell, variant === 'toolbar' && 'h-6 w-full gap-1 text-[9px] font-semibold')}
        onMouseDown={onStopBubble}
        onClick={() => applyAlign('center')}
      >
        {variant === 'toolbar' ? (
          <>
            <AlignCenter className="h-3 w-3 shrink-0" />
            Center
          </>
        ) : (
          <Move className="h-3 w-3" />
        )}
      </button>
    </div>
  )
}
