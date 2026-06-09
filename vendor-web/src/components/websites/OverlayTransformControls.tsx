import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FIELD_OFFSET_STEP_PX } from '@storefront/lib/fieldTextStyles'
import type { OverlayLayerItem } from '@/lib/builderOverlayVisual'
import {
  visualActionBtn,
  visualPanel,
  visualRow,
  visualSegmentBtn,
  visualSegmentTrack,
  visualStepperCell,
  visualStepperValue,
} from '@/components/websites/designBarVisualUi'

const NUDGE = FIELD_OFFSET_STEP_PX
const SIZE_STEP = 8

type OverlayPatch = Partial<Pick<OverlayLayerItem, 'x' | 'y' | 'w' | 'h' | 'zIndex' | 'objectFit' | 'imageScale'>>

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function CompactStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onCommit: (n: number) => void
}) {
  const current = Number.isFinite(value) ? value : min
  const bump = (delta: number) => onCommit(clamp(current + delta, min, max))

  return (
    <div className={cn(visualPanel, 'relative')} title={label}>
      <button type="button" className={visualStepperCell} onClick={() => bump(-step)} aria-label={`Decrease ${label}`}>
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className={cn(visualStepperValue, 'min-w-[1.35rem] max-w-[2.1rem]')}>{current}</span>
      <button type="button" className={visualStepperCell} onClick={() => bump(step)} aria-label={`Increase ${label}`}>
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function ToolbarStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
  onStopBubble,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onCommit: (n: number) => void
  onStopBubble: (e: React.SyntheticEvent) => void
}) {
  const current = Number.isFinite(value) ? value : min
  const bump = (delta: number) => onCommit(clamp(current + delta, min, max))
  const cell =
    'flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'

  return (
    <div className="flex min-w-0 flex-col gap-1" onMouseDown={onStopBubble}>
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <div className="flex items-center gap-0.5">
        <button type="button" className={cell} onClick={() => bump(-step)} aria-label={`Decrease ${label}`}>
          <Minus className="h-3 w-3" />
        </button>
        <span className="min-w-[2rem] text-center text-[11px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{current}</span>
        <button type="button" className={cell} onClick={() => bump(step)} aria-label={`Increase ${label}`}>
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function NudgePad({
  onNudge,
  variant,
  onStopBubble,
}: {
  onNudge: (dx: number, dy: number) => void
  variant: 'compact' | 'toolbar'
  onStopBubble?: (e: React.SyntheticEvent) => void
}) {
  const cell =
    variant === 'toolbar'
      ? 'flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-primary/10 hover:text-primary dark:border-gray-600 dark:bg-gray-800'
      : cn(visualStepperCell, 'h-6 w-6 border-b-0 last:border-b-0')

  const wrap = (dx: number, dy: number, label: string, Icon: typeof ArrowUp) => (
    <button
      type="button"
      title={label}
      className={cell}
      onMouseDown={onStopBubble}
      onClick={() => onNudge(dx, dy)}
    >
      <Icon className="h-3 w-3" />
    </button>
  )

  return (
    <div
      className={cn(
        variant === 'toolbar' ? 'grid grid-cols-3 gap-0.5' : visualPanel,
        variant === 'compact' && 'grid h-[4.5rem] w-[4.5rem] grid-cols-3 gap-0 overflow-hidden p-0',
      )}
      role="group"
      aria-label="Move layer"
    >
      <div className={variant === 'compact' ? cn(cell, 'border-r border-b border-gray-200') : 'invisible h-7 w-7'} aria-hidden />
      {wrap(0, -NUDGE, 'Move up', ArrowUp)}
      <div className={variant === 'compact' ? cn(cell, 'border-b border-gray-200') : 'invisible h-7 w-7'} aria-hidden />
      {wrap(-NUDGE, 0, 'Move left', ArrowLeft)}
      {variant === 'compact' ? (
        <span className={cn(visualStepperValue, 'h-6 w-6 border-b-0 px-0 text-[6px] font-bold uppercase text-gray-400')}>Mv</span>
      ) : (
        <div className="invisible h-7 w-7" aria-hidden />
      )}
      {wrap(NUDGE, 0, 'Move right', ArrowRight)}
      <div className={variant === 'compact' ? cn(cell, 'border-r border-gray-200') : 'invisible h-7 w-7'} aria-hidden />
      {wrap(0, NUDGE, 'Move down', ArrowDown)}
      <div className={variant === 'compact' ? cell : 'invisible h-7 w-7'} aria-hidden />
    </div>
  )
}

export function OverlayTransformControls({
  item,
  onUpdate,
  onBringToFront,
  onSendToBack,
  variant = 'compact',
  onStopBubble,
}: {
  item: Pick<OverlayLayerItem, 'x' | 'y' | 'w' | 'h' | 'type' | 'objectFit' | 'imageScale'>
  onUpdate: (patch: OverlayPatch) => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  variant?: 'compact' | 'toolbar'
  onStopBubble?: (e: React.SyntheticEvent) => void
}) {
  const x = item.x ?? 0
  const y = item.y ?? 0
  const w = item.w ?? 100
  const h = item.h ?? 100
  const isImage = item.type === 'image'
  const zoom = Number.isFinite(item.imageScale) ? Math.min(400, Math.max(25, Math.round(item.imageScale!))) : 100

  const nudge = (dx: number, dy: number) => {
    onUpdate({
      x: Math.max(0, x + dx),
      y: Math.max(0, y + dy),
    })
  }

  if (variant === 'toolbar' && onStopBubble) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <NudgePad onNudge={nudge} variant="toolbar" onStopBubble={onStopBubble} />
          <div className="grid grid-cols-2 gap-2">
            <ToolbarStepper label="X" value={x} min={0} max={4000} step={NUDGE} onCommit={n => onUpdate({ x: n })} onStopBubble={onStopBubble} />
            <ToolbarStepper label="Y" value={y} min={0} max={4000} step={NUDGE} onCommit={n => onUpdate({ y: n })} onStopBubble={onStopBubble} />
            <ToolbarStepper label="Width" value={w} min={40} max={4000} step={SIZE_STEP} onCommit={n => onUpdate({ w: n })} onStopBubble={onStopBubble} />
            <ToolbarStepper label="Height" value={h} min={20} max={4000} step={SIZE_STEP} onCommit={n => onUpdate({ h: n })} onStopBubble={onStopBubble} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {onBringToFront ? (
            <button
              type="button"
              title="Bring to front"
              onMouseDown={onStopBubble}
              onClick={onBringToFront}
              className="flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
            >
              <ChevronUp className="h-3.5 w-3.5" /> Front
            </button>
          ) : null}
          {onSendToBack ? (
            <button
              type="button"
              title="Send to back"
              onMouseDown={onStopBubble}
              onClick={onSendToBack}
              className="flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
            >
              <ChevronDown className="h-3.5 w-3.5" /> Back
            </button>
          ) : null}
          {isImage ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <ToolbarStepper
                label="Zoom %"
                value={zoom}
                min={25}
                max={400}
                step={10}
                onCommit={n => onUpdate({ imageScale: n })}
                onStopBubble={onStopBubble}
              />
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
              {(['cover', 'contain', 'fill'] as const).map(fit => (
                <button
                  key={fit}
                  type="button"
                  onMouseDown={onStopBubble}
                  onClick={() => onUpdate({ objectFit: fit })}
                  className={cn(
                    'px-2 py-1.5 text-[9px] font-bold uppercase transition-colors border-r border-gray-300 last:border-r-0 dark:border-gray-600',
                    (item.objectFit || 'cover') === fit
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800',
                  )}
                >
                  {fit === 'cover' ? 'Cover' : fit === 'contain' ? 'Fit' : 'Fill'}
                </button>
              ))}
            </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={visualRow}>
      <NudgePad onNudge={nudge} variant="compact" />
      <CompactStepper label="X" value={x} min={0} max={4000} step={NUDGE} onCommit={n => onUpdate({ x: n })} />
      <CompactStepper label="Y" value={y} min={0} max={4000} step={NUDGE} onCommit={n => onUpdate({ y: n })} />
      <CompactStepper label="W" value={w} min={40} max={4000} step={SIZE_STEP} onCommit={n => onUpdate({ w: n })} />
      <CompactStepper label="H" value={h} min={20} max={4000} step={SIZE_STEP} onCommit={n => onUpdate({ h: n })} />
      {isImage ? (
        <CompactStepper label="Z" value={zoom} min={25} max={400} step={10} onCommit={n => onUpdate({ imageScale: n })} />
      ) : null}
      {onBringToFront ? (
        <button type="button" title="Bring to front" onClick={onBringToFront} className={cn(visualActionBtn('muted'), 'w-7 px-0')}>
          <ChevronUp className="h-3 w-3" />
        </button>
      ) : null}
      {onSendToBack ? (
        <button type="button" title="Send to back" onClick={onSendToBack} className={cn(visualActionBtn('muted'), 'w-7 px-0')}>
          <ChevronDown className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}
