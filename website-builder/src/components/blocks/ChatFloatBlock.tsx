import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { CHAT_FLOAT_DEFAULTS } from '../../lib/chatFloatDefaults'
import {
  CHAT_FLOAT_POSITION_CLASS,
  chatFloatButtonStyle,
  resolveChatFloatUrl,
  type ChatFloatPosition,
} from '../../lib/chatFloatStyles'
import type { Block } from '../../types/builder'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface ChatFloatBlockProps {
  block: Block
  interactive?: boolean
}

export function ChatFloatBlock({ block, interactive }: ChatFloatBlockProps) {
  const { props, styles } = block
  const [bubbleDismissed, setBubbleDismissed] = useState(false)

  const position = (props.chatFloatPosition ?? CHAT_FLOAT_DEFAULTS.chatFloatPosition) as ChatFloatPosition
  const variant = props.chatFloatVariant ?? CHAT_FLOAT_DEFAULTS.chatFloatVariant
  const provider = props.chatFloatProvider ?? CHAT_FLOAT_DEFAULTS.chatFloatProvider
  const showPulse = props.showChatPulse !== false
  const showIcon = props.showChatIcon !== false
  const label = props.buttonText ?? CHAT_FLOAT_DEFAULTS.buttonText
  const greeting = props.chatGreeting ?? CHAT_FLOAT_DEFAULTS.chatGreeting
  const href = resolveChatFloatUrl(
    provider,
    props.chatPhoneNumber,
    props.chatPrefillMessage,
    props.chatUrl,
  )

  const btnStyle = chatFloatButtonStyle(styles)
  const positionClass = CHAT_FLOAT_POSITION_CLASS[position]
  const isIconOnly = variant === 'icon'
  const showBubble = variant === 'bubble' && !bubbleDismissed && greeting.trim().length > 0

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!interactive) return
    if (href === '#') return
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const Icon = provider === 'whatsapp' ? WhatsAppIcon : MessageCircle

  const button = (
    <button
      type="button"
      onClick={handleClick}
      style={btnStyle}
      className={`relative inline-flex items-center justify-center gap-2 font-semibold transition hover:scale-105 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
        isIconOnly ? 'h-14 w-14 p-0' : 'px-5 py-3.5'
      }`}
      aria-label={label}
    >
      {showPulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" aria-hidden />
      )}
      {showIcon && (
        <Icon className={`relative shrink-0 ${isIconOnly ? 'h-7 w-7' : 'h-5 w-5'}`} aria-hidden />
      )}
      {!isIconOnly && <span className="relative">{label}</span>}
    </button>
  )

  const widget = (
    <div className={`flex flex-col gap-3 ${position === 'bottom-left' ? 'items-start' : 'items-end'}`}>
      {showBubble && (
        <div className="relative max-w-[240px] rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {interactive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setBubbleDismissed(true)
              }}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 shadow hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <p className="leading-snug text-gray-700 dark:text-gray-200">{greeting}</p>
          <span className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 border-b border-r border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-900" />
        </div>
      )}
      {button}
    </div>
  )

  if (interactive) {
    return (
      <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
        <div className={`pointer-events-auto fixed z-50 ${positionClass}`}>{widget}</div>
      </div>
    )
  }

  const alignClass = position === 'bottom-left' ? 'items-start' : 'items-end'

  return (
    <div className={`flex w-full flex-col gap-2 ${alignClass}`} style={{ margin: styles.margin }}>
      {widget}
      <p className="text-xs text-gray-400">
        Pins to {position.replace('bottom-', '').replace('-', ' ')} in preview and live site
      </p>
    </div>
  )
}
