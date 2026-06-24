import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

function clampStep(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round(value / step) * step
  const precision = step < 1 ? String(step).split('.')[1]?.length ?? 1 : 0
  const clamped = Math.min(max, Math.max(min, snapped))
  return precision > 0 ? Number(clamped.toFixed(precision)) : clamped
}

export function useHoldRepeat(onStep: () => void, disabled = false) {
  const onStepRef = useRef(onStep)
  const disabledRef = useRef(disabled)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  onStepRef.current = onStep
  disabledRef.current = disabled

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    timeoutRef.current = null
    intervalRef.current = null
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    if (disabledRef.current) return
    stop()
    onStepRef.current()
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (disabledRef.current) {
          stop()
          return
        }
        onStepRef.current()
      }, 65)
    }, 280)
  }, [stop])

  return {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabledRef.current) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      start()
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      stop()
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      stop()
    },
  }
}

const stepBtnSizes = {
  sm: 'h-5 w-5 text-[11px]',
  md: 'h-6 w-6 text-sm',
} as const

const stepBtnClass =
  'flex shrink-0 select-none items-center justify-center rounded-md border border-neutral-400 bg-white font-semibold leading-none text-neutral-800 shadow-sm transition-colors hover:border-neutral-500 hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 touch-none'

export function BuilderStepButton({
  direction,
  disabled,
  onStep,
  className,
  size = 'sm',
  'aria-label': ariaLabel,
}: {
  direction: 'decrease' | 'increase'
  disabled?: boolean
  onStep: () => void
  className?: string
  size?: keyof typeof stepBtnSizes
  'aria-label'?: string
}) {
  const hold = useHoldRepeat(onStep, disabled)

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? (direction === 'decrease' ? 'Decrease' : 'Increase')}
      className={cn(stepBtnClass, stepBtnSizes[size], className)}
      {...hold}
    >
      {direction === 'decrease' ? '−' : '+'}
    </button>
  )
}

type BuilderStepSliderProps = {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  onInput?: (value: number) => void
  disabled?: boolean
  className?: string
  sliderClassName?: string
  formatValue?: (value: number) => ReactNode
  showValue?: boolean
  buttonSize?: keyof typeof stepBtnSizes
  'aria-label'?: string
}

export function BuilderStepSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onInput,
  disabled = false,
  className,
  sliderClassName,
  formatValue,
  showValue = true,
  buttonSize = 'sm',
  'aria-label': ariaLabel,
}: BuilderStepSliderProps) {
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onInputRef = useRef(onInput)

  valueRef.current = value
  onChangeRef.current = onChange
  onInputRef.current = onInput

  const apply = useCallback((next: number, live = false) => {
    const clamped = clampStep(next, min, max, step)
    valueRef.current = clamped
    if (live && onInputRef.current) onInputRef.current(clamped)
    else onChangeRef.current(clamped)
  }, [min, max, step])

  const decrease = useCallback(() => {
    if (valueRef.current <= min) return
    apply(valueRef.current - step)
  }, [apply, min, step])

  const increase = useCallback(() => {
    if (valueRef.current >= max) return
    apply(valueRef.current + step)
  }, [apply, max, step])

  const atMin = value <= min
  const atMax = value >= max

  return (
    <div className={cn('flex min-w-0 items-center gap-0.5', className)}>
      <BuilderStepButton
        direction="decrease"
        size={buttonSize}
        disabled={disabled || atMin}
        onStep={decrease}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onInput={e => apply(Number(e.target.value), true)}
        onChange={e => apply(Number(e.target.value))}
        className={cn(
          'min-w-0 flex-1 cursor-pointer accent-primary',
          disabled && 'cursor-not-allowed opacity-40',
          sliderClassName ?? 'h-1.5',
        )}
      />
      <BuilderStepButton
        direction="increase"
        size={buttonSize}
        disabled={disabled || atMax}
        onStep={increase}
      />
      {showValue && (
        <span className="min-w-[1.75rem] shrink-0 rounded border border-neutral-300 bg-white px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums text-neutral-800">
          {formatValue ? formatValue(value) : value}
        </span>
      )}
    </div>
  )
}
