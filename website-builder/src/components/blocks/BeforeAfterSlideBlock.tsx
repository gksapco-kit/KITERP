import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsLeftRight, ChevronsUpDown, MoveHorizontal, Sparkles } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import {
  BEFORE_AFTER_ASPECT_CLASS,
  BEFORE_AFTER_DEFAULTS,
  clampBeforeAfterPosition,
} from '../../lib/beforeAfterSlideDefaults'
import { softThemeGradientShellStyle } from '../../lib/themeGradientUtils'
import type { Block } from '../../types/builder'

interface BeforeAfterSlideBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

type Theme = 'premium' | 'minimal' | 'bold'
type HandleStyle = 'bar' | 'circle' | 'pill'

function ComparisonHandle({
  orientation,
  style,
  theme,
  dragging,
}: {
  orientation: 'horizontal' | 'vertical'
  style: HandleStyle
  theme: Theme
  dragging: boolean
}) {
  const isHorizontal = orientation === 'horizontal'
  const Icon = isHorizontal ? ChevronsLeftRight : ChevronsUpDown

  const pulseClass = dragging ? 'scale-110' : 'animate-[handlePulse_2.4s_ease-in-out_infinite]'

  if (style === 'bar') {
    return (
      <div
        className={`absolute z-30 ${isHorizontal ? 'top-0 bottom-0 w-[3px] -translate-x-1/2' : 'left-0 right-0 h-[3px] -translate-y-1/2'} ${
          theme === 'bold' ? 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'bg-white/95 shadow-lg'
        }`}
        aria-hidden
      />
    )
  }

  if (style === 'pill') {
    return (
      <div
        className={`absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-3 py-2 shadow-2xl transition-transform ${pulseClass} ${
          theme === 'premium'
            ? 'border border-white/80 bg-gradient-to-br from-white to-gray-50 ring-4 ring-white/30'
            : theme === 'bold'
              ? 'bg-brand-600 text-white'
              : 'bg-white ring-1 ring-black/5'
        }`}
        style={isHorizontal ? { top: '50%' } : { left: '50%' }}
        aria-hidden
      >
        <Icon className={`h-4 w-4 ${theme === 'bold' ? 'text-white' : 'text-gray-700'}`} />
      </div>
    )
  }

  return (
    <div
      className={`absolute z-30 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform ${pulseClass} ${
        theme === 'premium'
          ? 'border-[3px] border-white bg-gradient-to-br from-brand-500 to-violet-600 shadow-[0_8px_32px_rgba(79,70,229,0.45)]'
          : theme === 'bold'
            ? 'h-14 w-14 border-4 border-white bg-gray-900 shadow-2xl'
            : 'border-2 border-white bg-white/95 shadow-xl backdrop-blur-sm'
      }`}
      style={isHorizontal ? { top: '50%' } : { left: '50%' }}
      aria-hidden
    >
      {theme === 'premium' ? (
        <Icon className="h-5 w-5 text-white" />
      ) : (
        <div className={`grid gap-1 ${isHorizontal ? 'grid-cols-2' : 'grid-rows-2'}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`rounded-full ${theme === 'bold' ? 'h-1.5 w-1.5 bg-white' : 'h-1 w-1 bg-gray-400'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function SideLabel({
  label,
  side,
  theme,
  visible,
}: {
  label: string
  side: 'before' | 'after'
  theme: Theme
  visible: boolean
}) {
  if (!visible) return null

  const isBefore = side === 'before'

  const base =
    theme === 'premium'
      ? isBefore
        ? 'border border-white/10 bg-black/50 text-white backdrop-blur-md'
        : 'border border-brand-200/30 bg-gradient-to-r from-brand-600/90 to-violet-600/90 text-white shadow-lg backdrop-blur-md'
      : theme === 'bold'
        ? isBefore
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-900 shadow-md'
        : isBefore
          ? 'bg-black/45 text-white backdrop-blur-sm'
          : 'bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm'

  return (
    <span
      className={`pointer-events-none absolute z-20 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-opacity ${base} ${
        isBefore ? 'bottom-4 left-4' : 'bottom-4 right-4'
      }`}
    >
      {theme === 'premium' && !isBefore && <Sparkles className="h-3 w-3 opacity-90" aria-hidden />}
      {label}
    </span>
  )
}

export function BeforeAfterSlideBlock({ block, layoutStyle }: BeforeAfterSlideBlockProps) {
  const { props, styles } = block
  const orientation = props.beforeAfterOrientation ?? BEFORE_AFTER_DEFAULTS.beforeAfterOrientation
  const aspect = props.beforeAfterAspect ?? BEFORE_AFTER_DEFAULTS.beforeAfterAspect
  const startPosition = props.beforeAfterPosition ?? BEFORE_AFTER_DEFAULTS.beforeAfterPosition
  const showLabels = props.showBeforeAfterLabels !== false
  const handleStyle = (props.beforeAfterHandleStyle ?? BEFORE_AFTER_DEFAULTS.beforeAfterHandleStyle) as HandleStyle
  const theme = (props.beforeAfterTheme ?? BEFORE_AFTER_DEFAULTS.beforeAfterTheme) as Theme
  const beforeUrl = props.beforeImageUrl ?? ''
  const afterUrl = props.afterImageUrl ?? ''
  const isHorizontal = orientation === 'horizontal'

  const [position, setPosition] = useState(clampBeforeAfterPosition(startPosition))
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPosition(clampBeforeAfterPosition(startPosition))
  }, [startPosition])

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pct = isHorizontal
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100
      setPosition(clampBeforeAfterPosition(pct))
    },
    [isHorizontal],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPointer(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.stopPropagation()
    updateFromPointer(e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const clipStyle: React.CSSProperties = isHorizontal
    ? { clipPath: `inset(0 ${100 - position}% 0 0)` }
    : { clipPath: `inset(0 0 ${100 - position}% 0)` }

  const handlePositionStyle: React.CSSProperties = isHorizontal
    ? { left: `${position}%`, top: 0, bottom: 0, width: 0 }
    : { top: `${position}%`, left: 0, right: 0, height: 0 }

  const dividerPos = isHorizontal ? { left: `${position}%` } : { top: `${position}%` }
  const radius = styles.borderRadius ?? '20px'
  const frameClass =
    theme === 'premium'
      ? 'p-1.5 sm:p-2 shadow-[0_20px_60px_-20px_rgba(79,70,229,0.25)]'
      : theme === 'bold'
        ? 'p-1 bg-gray-900 shadow-2xl'
        : 'shadow-xl ring-1 ring-black/5'
  const frameStyle = theme === 'premium' ? softThemeGradientShellStyle(styles, 0.22) : undefined

  const showBeforeLabel = showLabels && position > 12
  const showAfterLabel = showLabels && position < 88

  return (
    <section style={layoutStyle} className="w-full">
      <style>{`
        @keyframes handlePulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(79,70,229,0.35); }
          50% { box-shadow: 0 8px 40px rgba(124,58,237,0.55); }
        }
      `}</style>

      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8 text-center" />
      )}

      <div className={`mx-auto max-w-4xl overflow-hidden rounded-[1.35rem] ${frameClass}`} style={{ borderRadius: radius, ...frameStyle }}>
        <div
          ref={containerRef}
          className={`group relative select-none overflow-hidden bg-gray-950 ${BEFORE_AFTER_ASPECT_CLASS[aspect]} ${
            isHorizontal ? (dragging ? 'cursor-col-resize' : 'cursor-ew-resize') : dragging ? 'cursor-row-resize' : 'cursor-ns-resize'
          }`}
          style={{ borderRadius: `calc(${radius} - 4px)`, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-label="Before and after comparison slider"
        >
          {/* Before layer */}
          <div className="absolute inset-0">
            {beforeUrl ? (
              <>
                <img
                  src={beforeUrl}
                  alt={props.beforeImageAlt ?? 'Before'}
                  className="h-full w-full object-cover scale-[1.02] saturate-[0.85] brightness-[0.92]"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 text-sm font-medium text-gray-500">
                Add before image
              </div>
            )}
          </div>

          {/* After layer (clipped) */}
          <div className="absolute inset-0" style={clipStyle}>
            {afterUrl ? (
              <>
                <img
                  src={afterUrl}
                  alt={props.afterImageAlt ?? 'After'}
                  className="h-full w-full object-cover scale-[1.02] saturate-110"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950/20 via-transparent to-transparent" />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-violet-100 text-sm font-medium text-brand-700">
                Add after image
              </div>
            )}
          </div>

          <SideLabel label={props.beforeLabel ?? BEFORE_AFTER_DEFAULTS.beforeLabel} side="before" theme={theme} visible={showBeforeLabel} />
          <SideLabel label={props.afterLabel ?? BEFORE_AFTER_DEFAULTS.afterLabel} side="after" theme={theme} visible={showAfterLabel} />

          {/* Divider glow */}
          <div
            className={`pointer-events-none absolute z-10 ${
              isHorizontal
                ? 'top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.65)]'
                : 'left-0 right-0 h-[2px] -translate-y-1/2 bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.65)]'
            } ${dragging ? '' : 'transition-[left,top] duration-75'}`}
            style={dividerPos}
            aria-hidden
          />

          <div className="pointer-events-none absolute z-20" style={handlePositionStyle}>
            <ComparisonHandle orientation={orientation} style={handleStyle} theme={theme} dragging={dragging} />
          </div>

          {/* Drag hint */}
          <div
            className={`pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3.5 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md transition-opacity ${
              dragging ? 'opacity-0' : 'opacity-100 group-hover:opacity-100'
            }`}
          >
            <MoveHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Drag to compare
          </div>
        </div>
      </div>
    </section>
  )
}
