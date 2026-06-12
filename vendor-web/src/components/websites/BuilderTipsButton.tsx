import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, HelpCircle, Mail, MapPin, MessageCircle, X } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { cn } from '@/lib/utils'
import { resetAllBuilderCoachMarks } from '@/lib/builderCoachMarks'

const TIPS = [
  { area: 'Toolbar chips', text: 'Save · Preview · Go live — always shown next to Tips.' },
  { area: 'Left panel → Sections', text: '“Start here” quick guide and catalog to add sections.' },
  { area: 'Canvas', text: 'Click a section to select it; green ↑/↓ space handles adjust spacing.' },
  { area: 'Device icons', text: 'Desktop / Tablet / Phone — preview each screen size.' },
  { area: 'Right panel', text: 'Section Edit, Search (Google), Store data (catalog link).' },
  { area: 'Website Management menu', text: 'Website Builder is in the sidebar under Website Management.' },
] as const

const MENU_WIDTH = 320

export function BuilderTipsButton({
  className,
  isPublished = false,
  onRestoreCoachMarks,
}: {
  className?: string
  isPublished?: boolean
  onRestoreCoachMarks: () => void
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  useEscapeToClose(() => setOpen(false), open)

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const update = () => {
      const rect = buttonRef.current!.getBoundingClientRect()
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
      setMenuPos({ top: rect.bottom + 6, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          data-builder-tips-menu
          data-builder-floating-ui
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 100000 }}
          className="w-[min(100vw-1rem,320px)] rounded-xl border border-gray-200 bg-white text-gray-800 shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Where things are
            </span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-200 text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-gray-100 bg-amber-50/80 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/70">Draft vs live</p>
            <p className="text-[11px] text-gray-700 leading-snug">
              <strong>Save draft</strong> — private working copy.
              <strong> Preview</strong> — safe browser check.
              <strong> {isPublished ? 'Publish' : 'Go live'}</strong> — {isPublished ? 'updates what customers see' : 'makes the store public'}.
            </p>
          </div>

          <ul className="px-3 py-2 space-y-2 max-h-[min(40vh,240px)] overflow-y-auto">
            {TIPS.map(({ area, text }) => (
              <li key={area} className="text-[11px] leading-snug">
                <span className="font-semibold text-gray-800">{area}</span>
                <span className="text-gray-500"> — {text}</span>
              </li>
            ))}
          </ul>
          {/* Quick-access action buttons */}
          <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50 space-y-2">
            {/* Help docs + Contact + Chat row */}
            <div className="grid grid-cols-3 gap-1.5">
              <a
                href="https://help.kiterp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-center text-[10px] font-semibold text-gray-700 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                Help docs
              </a>
              <a
                href="mailto:support@kiterp.com"
                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-center text-[10px] font-semibold text-gray-700 transition-colors hover:border-blue-400/40 hover:bg-blue-50 hover:text-blue-600"
              >
                <Mail className="h-4 w-4 text-blue-500" />
                Contact
              </a>
              <button
                type="button"
                onClick={() => {
                  if (typeof (window as any).$crisp !== 'undefined') {
                    ;(window as any).$crisp.push(['do', 'chat:open'])
                  }
                  setOpen(false)
                }}
                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-center text-[10px] font-semibold text-gray-700 transition-colors hover:border-emerald-400/40 hover:bg-emerald-50 hover:text-emerald-600"
              >
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                Chat
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                resetAllBuilderCoachMarks()
                onRestoreCoachMarks()
                setOpen(false)
              }}
              className="w-full py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              Show all tips again
            </button>
            <p className="text-[10px] text-gray-500 leading-snug text-center">
              Hard refresh (Ctrl+Shift+R) if UI still looks old after an update.
            </p>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Help & tips — where to find everything in the builder"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-center rounded-lg border transition-colors shrink-0',
          open
            ? 'border-primary/50 bg-primary/20 text-white'
            : 'border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700',
          className,
        )}
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
      </button>
      {menu}
    </>
  )
}
