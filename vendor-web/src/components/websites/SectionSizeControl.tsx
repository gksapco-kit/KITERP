import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { resolveSectionChromePortalFrame } from '@/components/websites/BuilderSectionOverlay'
import { BUILDER_SECTION_CHROME_Z } from '@/components/websites/builderPanelUi'
import { cn } from '@/lib/utils'

const SCALE_MIN = 0.5
const SCALE_MAX = 2
/** Each tap on −/+ nudges the section by this many percent. */
const STEP_PCT = 1
/** Press-and-hold: wait this long, then repeat the nudge every interval. */
const HOLD_DELAY_MS = 300
const HOLD_INTERVAL_MS = 60
const SECTION_CHROME_TOOLBAR_HEIGHT_EST = 30
const SECTION_CHROME_INSET = 6
const PILL_HEIGHT_EST = 24
const PILL_BELOW_TOOLBAR_GAP = 4

type PillFrame = { top: number; right: number }

function findBlockEl(
  containerRef: RefObject<HTMLElement | null>,
  blockId: string,
): HTMLElement | null {
  const root = containerRef.current
  if (!root) return null
  return root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null
}

/** Top-right anchor — same placement rules as the section chrome toolbar. */
function measureSectionSizePillFrame(
  blockEl: HTMLElement,
  canvasRect: DOMRect | null,
): PillFrame | null {
  const blockRect = blockEl.getBoundingClientRect()

  if (canvasRect) {
    if (
      blockRect.bottom <= canvasRect.top
      || blockRect.top >= canvasRect.bottom
      || blockRect.right <= canvasRect.left
      || blockRect.left >= canvasRect.right
    ) {
      return null
    }
  }

  const chrome = resolveSectionChromePortalFrame(
    {
      top: blockRect.top,
      left: blockRect.left,
      right: blockRect.right,
      height: blockRect.height,
    },
    canvasRect,
  )

  // Sit just below the section toolbar row (never at the section's vertical centre).
  let top = chrome.transform
    ? blockRect.top + PILL_BELOW_TOOLBAR_GAP
    : chrome.top + SECTION_CHROME_TOOLBAR_HEIGHT_EST + PILL_BELOW_TOOLBAR_GAP

  if (canvasRect) {
    top = Math.max(
      canvasRect.top + SECTION_CHROME_INSET,
      Math.min(top, canvasRect.bottom - PILL_HEIGHT_EST - SECTION_CHROME_INSET),
    )
  }

  return { top, right: chrome.right }
}

/**
 * Floating "section size" stepper — anchored below the section toolbar (top-right).
 */
export function SectionSizeControl({
  blockId,
  containerRef,
  scrollRootRef,
  portalContainerRef,
  scale,
  canvasScale,
  onPreview,
  onCommit,
  onActivate,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  scrollRootRef?: RefObject<HTMLElement | null>
  /** Portal target — keep inside the builder root so header menus stack above this control. */
  portalContainerRef?: RefObject<HTMLElement | null>
  scale: number
  canvasScale: number
  onPreview: (scale: number) => void
  onCommit: (scale: number) => void
  /** Select the section when the user starts adjusting size (e.g. from hover-only chrome). */
  onActivate?: () => void
}) {
  const [frame, setFrame] = useState<PillFrame | null>(null)
  const onPreviewRef = useRef(onPreview)
  const onCommitRef = useRef(onCommit)
  onPreviewRef.current = onPreview
  onCommitRef.current = onCommit

  const curScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const pct = Math.round(curScale * 100)

  const liveScaleRef = useRef(curScale)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const heldRef = useRef(false)
  const updateRef = useRef<() => void>(() => {})

  const [portalTarget, setPortalTarget] = useState<HTMLElement>(() =>
    typeof document !== 'undefined' ? document.body : (null as unknown as HTMLElement),
  )

  useLayoutEffect(() => {
    const el = portalContainerRef?.current
    if (el) setPortalTarget(el)
  }, [portalContainerRef])

  const clearHoldTimers = useCallback(() => {
    if (holdTimeoutRef.current != null) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (holdIntervalRef.current != null) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearHoldTimers()
  }, [clearHoldTimers])

  useLayoutEffect(() => {
    const update = () => {
      const el = findBlockEl(containerRef, blockId)
      if (!el) {
        setFrame(null)
        return
      }
      const scrollRoot = scrollRootRef?.current
      const canvasRect = scrollRoot?.getBoundingClientRect() ?? null

      setFrame(measureSectionSizePillFrame(el, canvasRect))
    }

    updateRef.current = update
    update()
    const el = findBlockEl(containerRef, blockId)
    const root = containerRef.current
    const ro = new ResizeObserver(update)
    if (el) ro.observe(el)
    if (root) ro.observe(root)
    const scrollRoot = scrollRootRef?.current
    if (scrollRoot) ro.observe(scrollRoot)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    scrollRoot?.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      scrollRoot?.removeEventListener('scroll', update)
    }
  }, [blockId, containerRef, scrollRootRef, scale])

  if (!frame) return null

  const applyStep = (deltaPct: number): boolean => {
    const next = Number(
      Math.max(SCALE_MIN, Math.min(SCALE_MAX, liveScaleRef.current + deltaPct / 100)).toFixed(2),
    )
    if (next === liveScaleRef.current) return false
    liveScaleRef.current = next
    onPreviewRef.current(next)
    requestAnimationFrame(() => updateRef.current())
    return true
  }

  const stopHold = () => {
    clearHoldTimers()
    if (heldRef.current) {
      heldRef.current = false
      onCommitRef.current(liveScaleRef.current)
    }
    requestAnimationFrame(() => updateRef.current())
  }

  const startHold = (deltaPct: number) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onActivate?.()
    clearHoldTimers()
    liveScaleRef.current = curScale
    heldRef.current = true
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* unsupported */ }
    applyStep(deltaPct)
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        if (!applyStep(deltaPct)) stopHold()
      }, HOLD_INTERVAL_MS)
    }, HOLD_DELAY_MS)
  }

  return createPortal(
    <div
      data-section-scale-handle
      data-builder-floating-ui
      className={cn(
        'group/scale pointer-events-auto fixed flex items-center gap-0 rounded-full border border-primary/20 bg-white/95 p-0.5 shadow-md ring-1 ring-black/5 backdrop-blur-sm',
      )}
      style={{ top: frame.top, right: frame.right, zIndex: BUILDER_SECTION_CHROME_Z }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => { e.stopPropagation(); onActivate?.() }}
    >
      <button
        type="button"
        title="Smaller (−1%, hold to keep shrinking)"
        disabled={pct <= SCALE_MIN * 100}
        onPointerDown={startHold(-STEP_PCT)}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onPointerLeave={stopHold}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
        onClick={e => e.stopPropagation()}
        className="flex h-4 w-4 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:scale-90 disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <Minus className="h-2.5 w-2.5" />
      </button>
      <div
        title="Drag to scale the whole section (content + media)"
        className="flex cursor-ew-resize select-none items-center gap-1 rounded-full px-1 py-0.5 transition-colors hover:bg-primary/5"
        onMouseDown={e => {
          e.preventDefault()
          e.stopPropagation()
          onActivate?.()
          const startX = e.clientX
          const startScale = curScale
          const scaleFactor = canvasScale > 0 ? canvasScale : 1
          document.body.style.cursor = 'ew-resize'
          const clampScale = (clientX: number) =>
            Number(
              Math.max(
                SCALE_MIN,
                Math.min(SCALE_MAX, startScale + ((clientX - startX) / scaleFactor) / 320),
              ).toFixed(2),
            )
          const onMove = (mv: MouseEvent) => {
            onPreviewRef.current(clampScale(mv.clientX))
            requestAnimationFrame(() => updateRef.current())
          }
          const onUp = (up: MouseEvent) => {
            document.body.style.cursor = ''
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            onCommitRef.current(clampScale(up.clientX))
            requestAnimationFrame(() => updateRef.current())
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-white shadow-sm">
          <Maximize2 className="h-2 w-2" />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[5.5px] font-bold uppercase tracking-[0.08em] text-primary/50">Section size</span>
          <span className="text-[10px] font-extrabold tabular-nums text-gray-900">
            {pct}<span className="text-[8px] font-bold text-gray-400">%</span>
          </span>
        </span>
      </div>
      <button
        type="button"
        title="Bigger (+1%, hold to keep growing)"
        disabled={pct >= SCALE_MAX * 100}
        onPointerDown={startHold(STEP_PCT)}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onPointerLeave={stopHold}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
        onClick={e => e.stopPropagation()}
        className="flex h-4 w-4 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:scale-90 disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>,
    portalTarget,
  )
}
