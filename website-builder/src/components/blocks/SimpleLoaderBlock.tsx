import { SIMPLE_LOADER_DEFAULTS, SIMPLE_LOADER_SIZE } from '../../lib/simpleLoaderDefaults'
import type { Block } from '../../types/builder'

interface SimpleLoaderBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

const ALIGN_CLASS = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const

function SpinnerIcon({ size, color }: { size: keyof typeof SIMPLE_LOADER_SIZE; color: string }) {
  const px = SIMPLE_LOADER_SIZE[size].box
  return (
    <div
      className="animate-spin rounded-full border-[3px] border-solid"
      style={{
        width: px,
        height: px,
        borderColor: `${color}33`,
        borderTopColor: color,
      }}
      role="status"
      aria-label="Loading"
    />
  )
}

function RingIcon({ size, color }: { size: keyof typeof SIMPLE_LOADER_SIZE; color: string }) {
  const px = SIMPLE_LOADER_SIZE[size].box
  return (
    <div
      className="animate-spin rounded-full"
      style={{
        width: px,
        height: px,
        background: `conic-gradient(from 0deg, transparent 0deg, transparent 240deg, ${color} 360deg)`,
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
      }}
      role="status"
      aria-label="Loading"
    />
  )
}

function DotsIcon({ size, color }: { size: keyof typeof SIMPLE_LOADER_SIZE; color: string }) {
  const { dot, gap } = SIMPLE_LOADER_SIZE[size]
  return (
    <div className="flex items-center" style={{ gap }} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-[loaderDot_1.2s_ease-in-out_infinite] rounded-full"
          style={{
            width: dot,
            height: dot,
            backgroundColor: color,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  )
}

function BarsIcon({ size, color }: { size: keyof typeof SIMPLE_LOADER_SIZE; color: string }) {
  const { barW, barH, gap } = SIMPLE_LOADER_SIZE[size]
  return (
    <div className="flex items-end" style={{ gap, height: barH }} role="status" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="animate-[loaderBar_1s_ease-in-out_infinite] rounded-full"
          style={{
            width: barW,
            height: barH,
            backgroundColor: color,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}

function LoaderIcon({
  style,
  size,
  color,
}: {
  style: string
  size: keyof typeof SIMPLE_LOADER_SIZE
  color: string
}) {
  if (style === 'dots') return <DotsIcon size={size} color={color} />
  if (style === 'ring') return <RingIcon size={size} color={color} />
  if (style === 'bars') return <BarsIcon size={size} color={color} />
  return <SpinnerIcon size={size} color={color} />
}

export function SimpleLoaderBlock({ block, layoutStyle }: SimpleLoaderBlockProps) {
  const { props } = block
  const style = props.simpleLoaderStyle ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderStyle
  const size = props.simpleLoaderSize ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderSize
  const color = props.simpleLoaderColor ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderColor
  const align = props.simpleLoaderAlign ?? SIMPLE_LOADER_DEFAULTS.simpleLoaderAlign
  const showLabel = props.showLoaderLabel ?? SIMPLE_LOADER_DEFAULTS.showLoaderLabel
  const labelClass = SIMPLE_LOADER_SIZE[size].label

  return (
    <section style={layoutStyle} className="w-full">
      <style>{`
        @keyframes loaderDot {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.45; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes loaderBar {
          0%, 100% { transform: scaleY(0.35); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      <div className={`flex flex-col gap-3 py-2 ${ALIGN_CLASS[align]}`}>
        <LoaderIcon style={style} size={size} color={color} />
        {showLabel && props.text && (
          <p className={`font-medium text-gray-600 dark:text-gray-300 ${labelClass}`}>{props.text}</p>
        )}
        {props.subtitle && (
          <p className={`text-gray-400 dark:text-gray-500 ${labelClass}`}>{props.subtitle}</p>
        )}
      </div>
    </section>
  )
}
