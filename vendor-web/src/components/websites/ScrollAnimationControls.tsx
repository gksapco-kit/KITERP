import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ANIMATION_DELAY_MAX_MS,
  ANIMATION_DELAY_PRESETS_MS,
  BLOCK_SCROLL_ANIMATIONS,
  formatAnimationDelay,
  type BlockScrollAnimationId,
} from '@storefront/lib/builderScrollAnimations'

type ScrollAnimationControlsProps = {
  animation: string | null | undefined
  animationDelay: number
  onAnimationChange: (id: BlockScrollAnimationId) => void
  /** Compact icon grid for the canvas design bar dropdown */
  variant?: 'compact' | 'panel'
  onDelayChange: (ms: number) => void
}

function clampDelay(ms: number): number {
  return Math.max(0, Math.min(ANIMATION_DELAY_MAX_MS, Math.round(ms / 50) * 50))
}

export function ScrollAnimationDelayControl({
  animation,
  animationDelay,
  onDelayChange,
  className,
}: Pick<ScrollAnimationControlsProps, 'animation' | 'animationDelay' | 'onDelayChange'> & {
  className?: string
}) {
  const hasAnimation = Boolean(animation && animation !== 'none')
  const delay = clampDelay(animationDelay || 0)

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-gray-50/80 p-2.5 space-y-2',
        !hasAnimation && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white border border-gray-200 text-primary">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-700 leading-none">Start delay</p>
            <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
              {hasAnimation ? 'Wait before the section animates in' : 'Choose an animation first'}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-white border border-gray-200 px-2 py-1 text-xs font-bold tabular-nums text-gray-800">
          {formatAnimationDelay(delay)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={ANIMATION_DELAY_MAX_MS}
          step={50}
          value={delay}
          disabled={!hasAnimation}
          onChange={e => onDelayChange(clampDelay(Number(e.target.value)))}
          className="flex-1 h-2 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Animation start delay"
        />
        <input
          type="number"
          min={0}
          max={ANIMATION_DELAY_MAX_MS}
          step={50}
          value={delay}
          disabled={!hasAnimation}
          onChange={e => onDelayChange(clampDelay(Number(e.target.value)))}
          className="w-[4.25rem] shrink-0 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs font-semibold tabular-nums text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Animation delay in milliseconds"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {ANIMATION_DELAY_PRESETS_MS.map(preset => (
          <button
            key={preset}
            type="button"
            disabled={!hasAnimation}
            onClick={() => onDelayChange(preset)}
            className={cn(
              'rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors',
              delay === preset
                ? 'border-primary bg-primary text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:bg-accent',
              !hasAnimation && 'cursor-not-allowed opacity-40',
            )}
          >
            {formatAnimationDelay(preset)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ScrollAnimationControls({
  animation,
  animationDelay,
  onAnimationChange,
  onDelayChange,
  variant = 'panel',
}: ScrollAnimationControlsProps) {
  const activeId = (animation || 'none') as BlockScrollAnimationId
  const compact = variant === 'compact'

  return (
    <div className={cn('space-y-2', compact ? 'w-[11.5rem]' : '')}>
      <div className={cn('text-xs font-bold text-gray-400 uppercase tracking-wide', compact ? 'mb-1' : '')}>
        Scroll Animation
      </div>

      <div className={cn('grid gap-1', compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4')}>
        {BLOCK_SCROLL_ANIMATIONS.map(({ id, glyph, label, title }) => {
          const active = activeId === id
          return (
            <button
              key={id}
              type="button"
              title={title}
              onMouseDown={compact ? e => e.stopPropagation() : undefined}
              onClick={() => onAnimationChange(id)}
              className={cn(
                'rounded-lg border transition-colors flex flex-col items-center justify-center gap-0.5',
                compact ? 'h-9 w-9 text-sm' : 'py-2 px-1 text-xs font-medium min-h-[2.75rem]',
                active
                  ? 'bg-primary text-white border-primary'
                  : 'text-gray-600 border-gray-200 hover:border-primary/40 hover:bg-accent',
              )}
            >
              <span className="leading-none">{glyph}</span>
              {!compact && (
                <span className="text-[9px] opacity-80 leading-none truncate max-w-full">{label}</span>
              )}
            </button>
          )
        })}
      </div>

      <ScrollAnimationDelayControl
        animation={animation}
        animationDelay={animationDelay}
        onDelayChange={onDelayChange}
      />
    </div>
  )
}
