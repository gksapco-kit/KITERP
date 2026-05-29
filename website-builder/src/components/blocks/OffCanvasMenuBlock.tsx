import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { OFF_CANVAS_MENU_DEFAULTS, OFF_CANVAS_SIDE_CLASS } from '../../lib/offCanvasMenuDefaults'
import type { Block, Page } from '../../types/builder'

interface OffCanvasMenuBlockProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
  pages: Pick<Page, 'slug'>[]
}

export function OffCanvasMenuBlock({ block, interactive = false, onNavigate, pages }: OffCanvasMenuBlockProps) {
  const { props, styles } = block
  const side = props.offCanvasSide ?? OFF_CANVAS_MENU_DEFAULTS.offCanvasSide
  const theme = props.offCanvasTheme ?? 'light'
  const links = (props.offCanvasLinks ?? []).filter((l) => l.enabled !== false)
  const [open, setOpen] = useState(props.offCanvasPreviewOpen !== false)

  const isDark = theme === 'dark'
  const sideClass = OFF_CANVAS_SIDE_CLASS[side]
  const panelClass = isDark
    ? 'bg-gray-950 text-white border-white/10'
    : 'bg-white text-gray-900 border-gray-200 dark:bg-gray-900 dark:text-white dark:border-gray-700'

  const linkClick = (link?: string) =>
    createLinkClickHandler({ interactive: !!interactive, link, pages, onNavigate })

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md ${
        isDark ? 'bg-gray-800 text-white' : 'bg-brand-600 text-white'
      }`}
    >
      <Menu className="h-4 w-4" />
      {props.buttonText ?? 'Menu'}
    </button>
  )

  const panelInner = (
    <aside
      className={`flex h-full w-[min(320px,85vw)] flex-col border shadow-2xl ${panelClass}`}
      style={{ borderRadius: styles.borderRadius }}
    >
      <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
        <p className="font-semibold">{props.text ?? 'Menu'}</p>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 opacity-70 hover:opacity-100" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.id ?? link.label}>
              <a
                href={link.link ?? '#'}
                onClick={(e) => {
                  linkClick(link.link)(e as unknown as React.MouseEvent<HTMLAnchorElement>)
                  if (interactive) setOpen(false)
                }}
                className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )

  if (interactive) {
    return (
      <div className="pointer-events-none h-0 overflow-visible">
        <div className="pointer-events-auto">{trigger}</div>
        {open && (
          <>
            <div className="pointer-events-auto fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <div className={`pointer-events-auto fixed top-0 z-[95] h-full ${sideClass}`}>{panelInner}</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative min-h-[280px] overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/40"
      style={{ margin: styles.margin }}
    >
      <div className="relative z-10 flex items-start p-4">{trigger}</div>
      {open && (
        <>
          <div className="absolute inset-0 z-20 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <div className={`absolute top-0 z-30 h-full ${sideClass}`}>{panelInner}</div>
        </>
      )}
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400">Off-canvas panel slides from {side}</p>
    </div>
  )
}
