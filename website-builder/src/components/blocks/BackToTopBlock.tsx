import { ArrowUp } from 'lucide-react'
import { BACK_TO_TOP_POSITION_CLASS, backToTopButtonStyle } from '../../lib/backToTopStyles'
import type { Block } from '../../types/builder'

interface BackToTopBlockProps {
  block: Block
  interactive?: boolean
}

export function BackToTopBlock({ block, interactive }: BackToTopBlockProps) {
  const { props, styles } = block
  const position = props.backToTopPosition ?? 'bottom-right'
  const showIcon = props.showBackToTopIcon !== false
  const label = props.buttonText ?? 'Back to top'
  const btnStyle = backToTopButtonStyle(styles)
  const positionClass = BACK_TO_TOP_POSITION_CLASS[position]

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!interactive) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const button = (
    <button
      type="button"
      onClick={handleClick}
      style={btnStyle}
      className="inline-flex items-center gap-2 font-semibold transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
      aria-label={label}
    >
      {showIcon && <ArrowUp className="h-4 w-4 shrink-0" aria-hidden />}
      <span>{label}</span>
    </button>
  )

  if (interactive) {
    return (
      <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
        <div className={`pointer-events-auto fixed z-50 ${positionClass}`}>{button}</div>
      </div>
    )
  }

  const alignClass =
    position === 'bottom-left'
      ? 'items-start'
      : position === 'bottom-center'
        ? 'items-center'
        : 'items-end'

  return (
    <div className={`flex w-full flex-col gap-2 ${alignClass}`} style={{ margin: styles.margin }}>
      {button}
      <p className="text-xs text-gray-400">
        Pins to {position.replace('bottom-', '').replace('-', ' ')} in preview and live site
      </p>
    </div>
  )
}
