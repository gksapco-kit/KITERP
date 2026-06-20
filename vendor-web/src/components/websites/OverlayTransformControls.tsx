import { useEffect, useRef } from 'react'
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
import {
  collectOverlayTargets,
  snapOverlayDrag,
  type OverlayBox,
  type OverlayGuideLine,
} from '@/lib/overlayAlignmentSnap'
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
// Keyboard arrow nudge: small, even pixel steps (Shift = larger jump).
const KEY_NUDGE_STEP = 2
const KEY_NUDGE_STEP_LARGE = 10

type OverlayPatch = Partial<Pick<OverlayLayerItem, 'x' | 'y' | 'w' | 'h' | 'zIndex' | 'objectFit' | 'imageScale'>>

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function isTypingElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
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

export function ToolbarStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
  onStopBubble,
  compact = false,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onCommit: (n: number) => void
  onStopBubble: (e: React.SyntheticEvent) => void
  compact?: boolean
}) {
  const current = Number.isFinite(value) ? value : min
  const bump = (delta: number) => onCommit(clamp(current + delta, min, max))
  const cell = compact
    ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
    : 'flex h-6 w-6 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'

  return (
    <div className={cn('flex min-w-0 flex-col', compact ? 'gap-0' : 'gap-0.5')} onMouseDown={onStopBubble}>
      <span className={cn(
        'truncate font-semibold uppercase tracking-wider text-gray-500',
        compact ? 'text-center text-[8px]' : 'text-[9px]',
      )}>
        {label}
      </span>
      <div className={cn('flex items-center', compact ? 'justify-center gap-px' : 'gap-0.5')}>
        <button type="button" className={cell} onClick={() => bump(-step)} aria-label={`Decrease ${label}`}>
          <Minus className="h-2.5 w-2.5" />
        </button>
        <span className={cn(
          'text-center font-bold tabular-nums text-gray-800 dark:text-gray-100',
          compact ? 'min-w-[1.65rem] text-[10px]' : 'min-w-[1.75rem] text-[10px]',
        )}>
          {current}
        </span>
        <button type="button" className={cell} onClick={() => bump(step)} aria-label={`Increase ${label}`}>
          <Plus className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}

function ToolbarPositionMatrix({
  x,
  y,
  w,
  h,
  onUpdate,
  onNudge,
  onStopBubble,
}: {
  x: number
  y: number
  w: number
  h: number
  onUpdate: (patch: OverlayPatch) => void
  onNudge: (dx: number, dy: number) => void
  onStopBubble: (e: React.SyntheticEvent) => void
}) {
  const arrowCell =
    'flex h-full min-h-[2.25rem] w-full items-center justify-center bg-white text-gray-600 transition-colors hover:bg-primary/10 hover:text-primary dark:bg-gray-800 dark:text-gray-300'
  const cornerCell =
    'flex min-h-[2.25rem] items-center justify-center border-gray-300 bg-gray-50/80 p-1 dark:border-gray-600 dark:bg-gray-900/40'
  const edgeBorder = 'border-gray-300 dark:border-gray-600'

  const nudgeBtn = (dx: number, dy: number, label: string, Icon: typeof ArrowUp) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={arrowCell}
      onMouseDown={onStopBubble}
      onClick={() => onNudge(dx, dy)}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <div
      className={cn('grid grid-cols-3 overflow-hidden rounded-lg border', edgeBorder)}
      role="group"
      aria-label="Position and size"
    >
      <div className={cn(cornerCell, 'border-r border-b', edgeBorder)}>
        <ToolbarStepper
          label="X"
          value={x}
          min={0}
          max={4000}
          step={NUDGE}
          onCommit={n => onUpdate({ x: n })}
          onStopBubble={onStopBubble}
          compact
        />
      </div>
      <div className={cn('border-b', edgeBorder)}>
        {nudgeBtn(0, -NUDGE, 'Move up', ArrowUp)}
      </div>
      <div className={cn(cornerCell, 'border-b border-l', edgeBorder)}>
        <ToolbarStepper
          label="Y"
          value={y}
          min={0}
          max={4000}
          step={NUDGE}
          onCommit={n => onUpdate({ y: n })}
          onStopBubble={onStopBubble}
          compact
        />
      </div>

      <div className={cn('border-r', edgeBorder)}>
        {nudgeBtn(-NUDGE, 0, 'Move left', ArrowLeft)}
      </div>
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100/80 text-[7px] font-bold uppercase tracking-wider text-gray-400 dark:bg-gray-900/60',
          edgeBorder,
        )}
        aria-hidden
      >
        Move
      </div>
      <div className={cn('border-l', edgeBorder)}>
        {nudgeBtn(NUDGE, 0, 'Move right', ArrowRight)}
      </div>

      <div className={cn(cornerCell, 'border-r border-t', edgeBorder)}>
        <ToolbarStepper
          label="Width"
          value={w}
          min={40}
          max={4000}
          step={SIZE_STEP}
          onCommit={n => onUpdate({ w: n })}
          onStopBubble={onStopBubble}
          compact
        />
      </div>
      <div className={cn('border-t', edgeBorder)}>
        {nudgeBtn(0, NUDGE, 'Move down', ArrowDown)}
      </div>
      <div className={cn(cornerCell, 'border-l border-t', edgeBorder)}>
        <ToolbarStepper
          label="Height"
          value={h}
          min={20}
          max={4000}
          step={SIZE_STEP}
          onCommit={n => onUpdate({ h: n })}
          onStopBubble={onStopBubble}
          compact
        />
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
      ? 'flex h-6 w-6 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
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
      <div className={variant === 'compact' ? cn(cell, 'border-r border-b border-gray-200') : 'invisible h-6 w-6'} aria-hidden />
      {wrap(0, -NUDGE, 'Move up', ArrowUp)}
      <div className={variant === 'compact' ? cn(cell, 'border-b border-gray-200') : 'invisible h-6 w-6'} aria-hidden />
      {wrap(-NUDGE, 0, 'Move left', ArrowLeft)}
      {variant === 'compact' ? (
        <span className={cn(visualStepperValue, 'h-6 w-6 border-b-0 px-0 text-[6px] font-bold uppercase text-gray-400')}>Mv</span>
      ) : (
        <div className="invisible h-6 w-6" aria-hidden />
      )}
      {wrap(NUDGE, 0, 'Move right', ArrowRight)}
      <div className={variant === 'compact' ? cn(cell, 'border-r border-gray-200') : 'invisible h-6 w-6'} aria-hidden />
      {wrap(0, NUDGE, 'Move down', ArrowDown)}
      <div className={variant === 'compact' ? cell : 'invisible h-6 w-6'} aria-hidden />
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
  siblings,
  containerWidth,
  containerHeight,
  onShowGuides,
  keyboardShortcuts = false,
  showNudgePad = false,
}: {
  item: Pick<OverlayLayerItem, 'x' | 'y' | 'w' | 'h' | 'type' | 'objectFit' | 'imageScale'>
  onUpdate: (patch: OverlayPatch) => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  variant?: 'compact' | 'toolbar'
  onStopBubble?: (e: React.SyntheticEvent) => void
  /** When set, arrow nudges snap to siblings and section edges. */
  siblings?: OverlayBox[]
  containerWidth?: number
  containerHeight?: number
  onShowGuides?: (guides: OverlayGuideLine[]) => void
  /** Move the layer with the keyboard arrow keys (Shift = larger step). */
  keyboardShortcuts?: boolean
  /** Show the on-screen 3×3 directional pad (off by default; arrows + steppers cover it). */
  showNudgePad?: boolean
}) {
  const x = item.x ?? 0
  const y = item.y ?? 0
  const w = item.w ?? 100
  const h = item.h ?? 100
  const isImage = item.type === 'image'
  const zoom = Number.isFinite(item.imageScale) ? Math.min(400, Math.max(25, Math.round(item.imageScale!))) : 100

  const nudge = (dx: number, dy: number) => {
    // Move by the EXACT delta and only prevent negative coordinates. We intentionally
    // do NOT clamp to the measured container size here: that size comes from a
    // canvas measurement that can be stale or 0, and clamping to it yanks the layer
    // back toward the top/left (e.g. pressing "down" jumps it up). Snapping is also
    // skipped on purpose — it belongs to free mouse-drag, not discrete nudges.
    const nextX = Math.max(0, x + dx)
    const nextY = Math.max(0, y + dy)
    // Flash alignment guides purely as a visual hint, without moving the layer.
    if (onShowGuides && containerWidth && containerHeight) {
      const targets = collectOverlayTargets(siblings ?? [], containerWidth, containerHeight)
      const { guides } = snapOverlayDrag({ x: nextX, y: nextY, w, h }, targets)
      onShowGuides(guides)
      window.setTimeout(() => onShowGuides?.([]), 600)
    }
    onUpdate({ x: nextX, y: nextY })
  }

  // Keep a ref to the latest nudge so the capture-phase key listener always uses
  // current geometry without re-binding on every position change.
  const nudgeRef = useRef(nudge)
  nudgeRef.current = nudge

  useEffect(() => {
    if (!keyboardShortcuts) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingElement(e.target)) return
      let dx = 0
      let dy = 0
      switch (e.key) {
        case 'ArrowUp':
          dy = -1
          break
        case 'ArrowDown':
          dy = 1
          break
        case 'ArrowLeft':
          dx = -1
          break
        case 'ArrowRight':
          dx = 1
          break
        default:
          return
      }
      // Small, even steps; hold Shift for a larger jump.
      const step = e.shiftKey ? KEY_NUDGE_STEP_LARGE : KEY_NUDGE_STEP
      e.preventDefault()
      e.stopPropagation()
      nudgeRef.current(dx * step, dy * step)
    }
    // Capture phase so the layer move wins over section reorder / tab switching.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [keyboardShortcuts])

  if (variant === 'toolbar' && onStopBubble) {
    return (
      <div className="space-y-1">
        <ToolbarPositionMatrix
          x={x}
          y={y}
          w={w}
          h={h}
          onUpdate={onUpdate}
          onNudge={nudge}
          onStopBubble={onStopBubble}
        />
        <div className="flex flex-wrap items-center gap-1">
          {onBringToFront ? (
            <button
              type="button"
              title="Bring to front"
              onMouseDown={onStopBubble}
              onClick={onBringToFront}
              className="flex h-7 items-center gap-0.5 rounded-md border border-gray-300 bg-white px-1.5 text-[9px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
            >
              <ChevronUp className="h-3 w-3" /> Front
            </button>
          ) : null}
          {onSendToBack ? (
            <button
              type="button"
              title="Send to back"
              onMouseDown={onStopBubble}
              onClick={onSendToBack}
              className="flex h-7 items-center gap-0.5 rounded-md border border-gray-300 bg-white px-1.5 text-[9px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
            >
              <ChevronDown className="h-3 w-3" /> Back
            </button>
          ) : null}
          {isImage ? (
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
              {(['cover', 'contain', 'fill'] as const).map(fit => (
                <button
                  key={fit}
                  type="button"
                  onMouseDown={onStopBubble}
                  onClick={() => onUpdate({ objectFit: fit })}
                  className={cn(
                    'px-1.5 py-1 text-[8px] font-bold uppercase transition-colors border-r border-gray-300 last:border-r-0 dark:border-gray-600',
                    (item.objectFit || 'cover') === fit
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800',
                  )}
                >
                  {fit === 'cover' ? 'Cover' : fit === 'contain' ? 'Fit' : 'Fill'}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={visualRow}>
      {showNudgePad ? <NudgePad onNudge={nudge} variant="compact" /> : null}
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
