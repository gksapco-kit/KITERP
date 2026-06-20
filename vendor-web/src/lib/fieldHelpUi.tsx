import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FieldDbMeta } from '@/lib/fieldDbRegistry'

export const FIELD_HELP_TOOLTIP_FOOTER = (
  <>
    Click the label or press{' '}
    <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-[10px]">F1</kbd> for more
    details
  </>
)

const TOOLTIP_Z = 1200
const DIALOG_Z = 1300

type ActiveFieldHelp = { openHelp: () => void } | null
let activeFieldHelp: ActiveFieldHelp = null

function bindGlobalFieldHelpF1() {
  if (typeof window === 'undefined') return
  const w = window as Window & { __kiterpFieldHelpF1?: boolean }
  if (w.__kiterpFieldHelpF1) return
  w.__kiterpFieldHelpF1 = true
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'F1' || !activeFieldHelp) return
      e.preventDefault()
      e.stopPropagation()
      activeFieldHelp.openHelp()
    },
    true,
  )
}

bindGlobalFieldHelpF1()

type FieldHelpUiOptions = {
  hoverHint: string
  fullHelp: string
  title?: string
  footerNote?: string
  dbMeta?: FieldDbMeta | null
  enabled?: boolean
}

function tooltipStyle(rect: DOMRect) {
  const width = Math.min(Math.max(rect.width, 240), 320)
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  const placeAbove = rect.top >= 88
  if (placeAbove) {
    return {
      left,
      top: rect.top - 8,
      width,
      transform: 'translateY(-100%)',
    }
  }
  return {
    left,
    top: rect.bottom + 8,
    width,
    transform: 'none',
  }
}

export function useFieldHelpUi({
  hoverHint,
  fullHelp,
  title,
  footerNote,
  dbMeta = null,
  enabled = true,
}: FieldHelpUiOptions) {
  const titleId = useId()
  const anchorRef = useRef<HTMLElement>(null)
  const openHelpRef = useRef<() => void>(() => {})
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showDbMeta, setShowDbMeta] = useState(false)

  const openHelp = () => {
    if (!enabled) return
    setHelpOpen(true)
  }

  openHelpRef.current = openHelp

  const syncTooltipRect = () => {
    if (anchorRef.current) setTooltipRect(anchorRef.current.getBoundingClientRect())
  }

  const activate = () => {
    if (!enabled) return
    activeFieldHelp = { openHelp: () => openHelpRef.current() }
    syncTooltipRect()
  }

  const deactivate = () => {
    if (activeFieldHelp?.openHelp === openHelpRef.current) activeFieldHelp = null
  }

  const handlePointerEnter = () => {
    if (!enabled) return
    setHovered(true)
    activate()
  }

  const handlePointerLeave = () => {
    setHovered(false)
    if (!focused) deactivate()
  }

  const handleFocus = () => {
    if (!enabled) return
    setFocused(true)
    activate()
  }

  const handleBlur = () => {
    setFocused(false)
    if (!hovered) deactivate()
  }

  const handleClick = (e: MouseEvent<HTMLSpanElement>) => {
    if (!enabled) return
    e.preventDefault()
    e.stopPropagation()
    openHelp()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!enabled) return
    if (e.key === 'F1') {
      e.preventDefault()
      openHelp()
      return
    }
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    openHelp()
  }

  useEffect(() => {
    if (!enabled || (!hovered && !focused)) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        e.stopPropagation()
        openHelp()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, hovered, focused])

  useEffect(() => {
    if (!enabled || (!hovered && !focused)) return
    const onScrollOrResize = () => syncTooltipRect()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [enabled, hovered, focused])

  useEffect(() => {
    if (!helpOpen) setShowDbMeta(false)
  }, [helpOpen])

  useEffect(() => () => deactivate(), [])

  const showHoverHelp = enabled && (hovered || focused) && !helpOpen

  const hoverTooltip =
    showHoverHelp && tooltipRect && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-snug text-gray-900 shadow-xl"
            style={{ ...tooltipStyle(tooltipRect), zIndex: TOOLTIP_Z }}
          >
            <p>{hoverHint}</p>
            <p className="mt-1.5 text-[10px] font-medium text-gray-500">{FIELD_HELP_TOOLTIP_FOOTER}</p>
          </div>,
          document.body,
        )
      : null

  const helpDialog =
    helpOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            style={{ zIndex: DIALOG_Z }}
            onClick={() => setHelpOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
              role="dialog"
              aria-labelledby={titleId}
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-base font-semibold text-gray-900">
                    {title ?? 'Field help'}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">{hoverHint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {enabled ? (
                    <button
                      type="button"
                      onClick={() => setShowDbMeta((open) => !open)}
                      className={`rounded-md p-1.5 transition-colors ${
                        showDbMeta
                          ? 'bg-gray-200 text-gray-900'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      aria-label="Show database field details"
                      aria-pressed={showDbMeta}
                      title="Database field details"
                    >
                      <Wrench className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setHelpOpen(false)}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-3 px-5 py-4">
                {showDbMeta ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs">
                    <p className="font-medium text-gray-700">Database mapping</p>
                    {dbMeta ? (
                      <dl className="mt-2 space-y-1.5 font-mono text-[11px] text-gray-800">
                        <div className="flex gap-2">
                          <dt className="w-14 shrink-0 text-gray-500">Table</dt>
                          <dd>{dbMeta.table}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="w-14 shrink-0 text-gray-500">Column</dt>
                          <dd>{dbMeta.column}</dd>
                        </div>
                        {dbMeta.note ? (
                          <div className="flex gap-2">
                            <dt className="w-14 shrink-0 text-gray-500">Note</dt>
                            <dd className="font-sans text-gray-600">{dbMeta.note}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : (
                      <div className="mt-2 space-y-2 font-sans text-[11px] text-gray-700">
                        <p>
                          No column linked to this label yet. In{' '}
                          <span className="font-medium">System → Models</span>, add a mapping with UI
                          label:
                        </p>
                        <p className="rounded border border-gray-200 bg-white px-2 py-1 font-mono text-gray-900">
                          {title ?? 'Field label'}
                        </p>
                        <Link
                          to="/system/models"
                          className="inline-flex font-medium text-primary hover:underline"
                          onClick={() => setHelpOpen(false)}
                        >
                          Open Models →
                        </Link>
                      </div>
                    )}
                  </div>
                ) : null}
                <p className="text-sm leading-relaxed text-gray-800">{fullHelp}</p>
                {footerNote ? <p className="text-xs text-gray-500">{footerNote}</p> : null}
                <Button type="button" className="w-full" onClick={() => setHelpOpen(false)}>
                  Got it
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  const interactiveProps = enabled
    ? {
        role: 'button' as const,
        // Keep labels out of sequential tab order — inputs, buttons, and links only.
        tabIndex: -1,
        className:
          'inline-flex cursor-pointer items-center gap-1 rounded-sm outline-none hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary/40',
        onMouseEnter: handlePointerEnter,
        onMouseLeave: handlePointerLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onMouseDown: (e: MouseEvent<HTMLSpanElement>) => e.preventDefault(),
        onClick: handleClick,
        onKeyDown: handleKeyDown,
      }
    : {
        className: 'inline-flex items-center gap-1 rounded-sm',
      }

  return {
    anchorRef: anchorRef as RefObject<HTMLElement>,
    interactiveProps,
    hoverTooltip,
    helpDialog,
    openHelp,
    handlePointerEnter,
    handlePointerLeave,
    handleClick,
  }
}
