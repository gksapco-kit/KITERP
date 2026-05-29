import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import {
  TOAST_POSITION_CLASS,
  TOAST_VARIANT_STYLES,
  toastNotificationStyle,
  type ToastPosition,
  type ToastVariant,
} from '../../lib/toastNotificationStyles'
import type { Block } from '../../types/builder'

const VARIANT_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const

interface ToastNotificationBlockProps {
  block: Block
  interactive?: boolean
}

function ToastCard({
  block,
  onClose,
  showClose,
}: {
  block: Block
  onClose?: () => void
  showClose: boolean
}) {
  const { props, styles } = block
  const variant = (props.toastVariant ?? 'success') as ToastVariant
  const v = TOAST_VARIANT_STYLES[variant]
  const Icon = VARIANT_ICONS[variant]
  const showIcon = props.showToastIcon !== false
  const toastStyle = toastNotificationStyle(styles, variant)

  return (
    <div
      role="status"
      aria-live="polite"
      style={toastStyle}
      className="flex items-start gap-3"
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: v.iconBg, color: v.accent }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        {props.text && <p className="text-sm font-semibold leading-snug">{props.text}</p>}
        {props.subtitle && <p className="mt-1 text-xs opacity-80">{props.subtitle}</p>}
      </div>
      {showClose && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="shrink-0 rounded-md p-1 opacity-50 transition hover:bg-black/5 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function ToastNotificationBlock({ block, interactive }: ToastNotificationBlockProps) {
  const position = (block.props.toastPosition ?? 'top-right') as ToastPosition
  const positionClass = TOAST_POSITION_CLASS[position]
  const showClose = block.props.showToastClose !== false
  const autoShow = block.props.toastAutoShow !== false
  const [visible, setVisible] = useState(autoShow)

  useEffect(() => {
    if (!interactive || !autoShow) return
    setVisible(true)
  }, [interactive, autoShow, block.props.text, block.props.subtitle, block.props.toastVariant])

  const toast = (
    <ToastCard
      block={block}
      showClose={showClose !== false && !!interactive}
      onClose={interactive ? () => setVisible(false) : undefined}
    />
  )

  if (interactive) {
    if (!visible) {
      return (
        <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
          <div className={`pointer-events-auto fixed z-50 ${positionClass}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setVisible(true)
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-md hover:border-brand-300 hover:text-brand-600"
            >
              Show notification preview
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
        <div className={`pointer-events-auto fixed z-50 ${positionClass}`}>{toast}</div>
      </div>
    )
  }

  const alignClass =
    position.includes('left')
      ? 'items-start'
      : position.includes('center')
        ? 'items-center'
        : 'items-end'

  return (
    <div className={`flex w-full flex-col gap-2 ${alignClass}`} style={{ margin: block.styles.margin }}>
      {toast}
      <p className="text-xs text-gray-400">
        Pins to {position.replace(/-/g, ' ')} in preview and live site
        {autoShow ? ' · auto-shows on load' : ' · use trigger in preview'}
      </p>
    </div>
  )
}
