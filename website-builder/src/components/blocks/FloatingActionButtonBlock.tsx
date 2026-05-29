import { useState } from 'react'
import { Edit3, MessageCircle, Plus, ShoppingCart, X } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { FAB_DEFAULTS, FAB_POSITION_CLASS } from '../../lib/fabDefaults'
import type { Block, Page } from '../../types/builder'

interface FloatingActionButtonBlockProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
  pages: Pick<Page, 'slug'>[]
}

const ICONS = {
  plus: Plus,
  cart: ShoppingCart,
  message: MessageCircle,
  edit: Edit3,
}

export function FloatingActionButtonBlock({ block, interactive = false, onNavigate, pages }: FloatingActionButtonBlockProps) {
  const { props, styles } = block
  const position = props.fabPosition ?? FAB_DEFAULTS.fabPosition
  const variant = props.fabVariant ?? FAB_DEFAULTS.fabVariant
  const iconKey = props.fabIcon ?? FAB_DEFAULTS.fabIcon
  const theme = props.fabTheme ?? FAB_DEFAULTS.fabTheme
  const showMenu = props.showFabMenu !== false
  const actions = (props.fabActions ?? []).filter((a) => a.enabled !== false)
  const [menuOpen, setMenuOpen] = useState(false)

  const Icon = ICONS[iconKey] ?? Plus
  const positionClass = FAB_POSITION_CLASS[position] ?? FAB_POSITION_CLASS['bottom-right']

  const btnClass =
    theme === 'dark'
      ? 'bg-gray-900 text-white shadow-xl ring-1 ring-white/10'
      : theme === 'light'
        ? 'bg-white text-gray-900 shadow-xl ring-1 ring-gray-200'
        : 'bg-brand-600 text-white shadow-lg shadow-brand-500/30'

  const linkClick = (link?: string) =>
    createLinkClickHandler({ interactive: !!interactive, link, pages, onNavigate })

  const mainBtn = (
    <button
      type="button"
      onClick={() => showMenu && setMenuOpen((v) => !v)}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition hover:scale-105 ${btnClass} ${
        variant === 'icon' ? 'h-14 w-14' : 'px-5 py-3.5'
      }`}
      aria-label={props.buttonText ?? 'Actions'}
    >
      {menuOpen && showMenu ? <X className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
      {variant === 'extended' && <span className="pr-1">{props.buttonText ?? 'Actions'}</span>}
    </button>
  )

  const menu =
    menuOpen && showMenu && actions.length > 0 ? (
      <div
        className={`absolute bottom-full mb-3 flex flex-col gap-2 ${position.includes('right') ? 'right-0 items-end' : position.includes('left') ? 'left-0 items-start' : 'left-1/2 -translate-x-1/2 items-center'}`}
      >
        {actions.map((action) => (
          <a
            key={action.id ?? action.label}
            href={action.link ?? '#'}
            onClick={(e) => {
              linkClick(action.link)(e as unknown as React.MouseEvent<HTMLAnchorElement>)
              setMenuOpen(false)
            }}
            className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-lg ring-1 ring-gray-200 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
          >
            {action.label}
          </a>
        ))}
      </div>
    ) : null

  const cluster = (
    <div className="relative">
      {menu}
      {mainBtn}
    </div>
  )

  if (interactive) {
    return (
      <div className="pointer-events-none h-0 overflow-visible">
        <div className={`pointer-events-auto fixed z-50 ${positionClass}`}>{cluster}</div>
      </div>
    )
  }

  return (
    <div className={`relative flex min-h-[120px] w-full flex-col gap-2 ${position.includes('left') ? 'items-start' : position.includes('center') ? 'items-center' : 'items-end'}`} style={{ margin: styles.margin }}>
      {cluster}
      <p className="text-xs text-gray-400">FAB pins to {position.replace('bottom-', '')} on live site</p>
    </div>
  )
}
