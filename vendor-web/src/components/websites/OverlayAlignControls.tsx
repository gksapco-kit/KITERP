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
import { visualActionBtn, visualIconBtn, visualPanel } from '@/components/websites/designBarVisualUi'

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
      : 'flex h-full min-h-0 w-full items-center justify-center bg-white text-gray-600 transition-colors hover:bg-primary/10 hover:text-primary'

  const gridClass =
    variant === 'toolbar'
      ? 'grid grid-cols-3 gap-0.5'
      : 'grid h-full min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-px bg-gray-200'

  if (variant === 'compact') {
    const H_ALIGNS = GRID_ALIGNS.slice(0, 3)
    const V_ALIGNS = GRID_ALIGNS.slice(3, 6)

    const segBtn = (
      { id, label, Icon }: typeof GRID_ALIGNS[0],
      pos: 'start' | 'mid' | 'end',
    ) => (
      <button
        key={id}
        type="button"
        title={label}
        aria-label={label}
        onMouseDown={onStopBubble}
        onClick={() => applyAlign(id)}
        className={cn(
          'flex flex-1 items-center justify-center transition-colors hover:bg-primary/10 hover:text-primary',
          pos === 'start' && 'rounded-l-full',
          pos === 'end'   && 'rounded-r-full',
        )}
      >
        <Icon className="h-2.5 w-2.5" />
      </button>
    )

    return (
      <div
        className="inline-flex shrink-0 items-center gap-1 px-1"
        role="group"
        aria-label="Align in section"
      >
        {/* Two stacked segmented pills: H align + V align */}
        <div className="flex flex-col gap-1">
          <div className="flex h-5 overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-gray-500">
            {segBtn(H_ALIGNS[0], 'start')}
            <span className="w-px self-stretch bg-gray-200" aria-hidden />
            {segBtn(H_ALIGNS[1], 'mid')}
            <span className="w-px self-stretch bg-gray-200" aria-hidden />
            {segBtn(H_ALIGNS[2], 'end')}
          </div>
          <div className="flex h-5 overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-gray-500">
            {segBtn(V_ALIGNS[0], 'start')}
            <span className="w-px self-stretch bg-gray-200" aria-hidden />
            {segBtn(V_ALIGNS[1], 'mid')}
            <span className="w-px self-stretch bg-gray-200" aria-hidden />
            {segBtn(V_ALIGNS[2], 'end')}
          </div>
        </div>

        {/* Center-in-section button */}
        <button
          type="button"
          title="Center in section"
          aria-label="Center in section"
          onMouseDown={onStopBubble}
          onClick={() => applyAlign('center')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <Move className="h-3 w-3" />
        </button>
      </div>
    )
  }

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
        className={cn(cell, 'h-6 w-full gap-1 text-[9px] font-semibold')}
        onMouseDown={onStopBubble}
        onClick={() => applyAlign('center')}
      >
        <AlignCenter className="h-3 w-3 shrink-0" />
        Center
      </button>
    </div>
  )
}
