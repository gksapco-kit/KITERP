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
import { cn } from '@/lib/utils'

const SCALE_MIN = 0.5
const SCALE_MAX = 2
/** Each tap on −/+ nudges the section by this many percent. */
const STEP_PCT = 1
/** Press-and-hold: wait this long, then repeat the nudge every interval. */
const HOLD_DELAY_MS = 300
const HOLD_INTERVAL_MS = 60
/** Keep the pill from hugging the very top/bottom edge of the visible canvas. */
const VIEWPORT_PAD = 16
/** Estimated pill height (px) — used to decide inline vs above/below placement. */
const PILL_HEIGHT_PX = 34
/** Gap between the pill and the section edge when placed outside. */
const EXTERNAL_GAP_PX = 8
/** Sections shorter than this get the pill above or below instead of beside. */
const INLINE_MIN_HEIGHT_PX = PILL_HEIGHT_PX + 12

type PillPlacement = 'inline' | 'above' | 'below'

type PillFrame = { top: number; left: number; placement: PillPlacement }

function findBlockEl(
  containerRef: RefObject<HTMLElement | null>,
  blockId: string,
): HTMLElement | null {
  const root = containerRef.current
  if (!root) return null
  return root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null
}

/**
 * Floating "section size" stepper.
 *
 * Rendered as a fixed-position portal pinned to the centre of the section's
 * *visible* region (clamped to the canvas viewport) rather than the section's
 * own centre. The section's height grows when scaled (CSS `zoom`), so a control
 * anchored to the section centre drifts downward on every `+` click — sliding
 * out from under the cursor. Anchoring to the visible-region centre keeps the
 * buttons stationary while the section grows below the fold.
 */
export function SectionSizeControl({
  blockId,
  containerRef,
  scrollRootRef,
  scale,
  canvasScale,
  onPreview,
  onCommit,
}: {
  blockId: string
  containerRef: RefObject<HTMLElement | null>
  scrollRootRef?: RefObject<HTMLElement | null>
  scale: number
  canvasScale: number
  onPreview: (scale: number) => void
  onCommit: (scale: number) => void
}) {
  const [frame, setFrame] = useState<PillFrame | null>(null)
  const onPreviewRef = useRef(onPreview)
  const onCommitRef = useRef(onCommit)
  onPreviewRef.current = onPreview
  onCommitRef.current = onCommit

  const curScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const pct = Math.round(curScale * 100)

  // Press-and-hold state. The live value lives in a ref so the repeating timer
  // (a stale closure) always reads/writes the latest scale; each tick previews
  // (no undo spam) and a single commit fires when the press ends.
  const liveScaleRef = useRef(curScale)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const heldRef = useRef(false)

  // While the user is actively pressing/dragging, the section is growing or
  // shrinking under the cursor. Freeze the pill at its current screen position
  // so the button stays put — otherwise re-anchoring to the section's centre
  // slides it out from under the pointer between clicks and during a hold.
  const frozenRef = useRef(false)
  const unfreezeTimerRef = useRef<number | null>(null)
  const updateRef = useRef<() => void>(() => {})

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

  const freezePosition = useCallback(() => {
    if (unfreezeTimerRef.current != null) {
      window.clearTimeout(unfreezeTimerRef.current)
      unfreezeTimerRef.current = null
    }
    frozenRef.current = true
  }, [])

  const releasePosition = useCallback(() => {
    if (unfreezeTimerRef.current != null) window.clearTimeout(unfreezeTimerRef.current)
    // Stay frozen briefly so rapid, separate clicks keep the button stationary;
    // re-snap to the section once the user is clearly done interacting.
    unfreezeTimerRef.current = window.setTimeout(() => {
      unfreezeTimerRef.current = null
      frozenRef.current = false
      updateRef.current()
    }, 600)
  }, [])

  useEffect(() => () => {
    clearHoldTimers()
    if (unfreezeTimerRef.current != null) window.clearTimeout(unfreezeTimerRef.current)
  }, [clearHoldTimers])

  useLayoutEffect(() => {
    const update = () => {
      // Held in place while the user is pressing/dragging (see freezePosition).
      if (frozenRef.current) return
      const el = findBlockEl(containerRef, blockId)
      if (!el) {
        setFrame(null)
        return
      }
      const rect = el.getBoundingClientRect()
      const scrollRoot = scrollRootRef?.current
      const vp = scrollRoot
        ? scrollRoot.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }

      // Centre of the slice of the section that is actually on screen, clamped
      // so the pill never leaves the visible canvas. This makes the buttons hold
      // still when scaling grows the section past the bottom of the viewport.
      const visibleTop = Math.max(rect.top, vp.top)
      const visibleBottom = Math.min(rect.bottom, vp.bottom)
      const visibleHeight = visibleBottom - visibleTop
      // Section scrolled out of the canvas viewport — hide the pill entirely.
      if (visibleHeight <= 1 || rect.right <= vp.left || rect.left >= vp.right) {
        setFrame(null)
        return
      }

      const right = Math.min(rect.right, vp.right) - 12
      const spaceAbove = visibleTop - vp.top
      const spaceBelow = vp.bottom - visibleBottom

      let placement: PillPlacement = 'inline'
      let top: number

      if (visibleHeight < INLINE_MIN_HEIGHT_PX) {
        // Short section (nav bar, announcement, etc.) — park the pill just
        // outside the section so it never covers the content.
        const preferBelow = spaceBelow >= spaceAbove
        const fitsBelow = spaceBelow >= PILL_HEIGHT_PX + EXTERNAL_GAP_PX + VIEWPORT_PAD
        const fitsAbove = spaceAbove >= PILL_HEIGHT_PX + EXTERNAL_GAP_PX + VIEWPORT_PAD

        if (preferBelow && fitsBelow) {
          placement = 'below'
          top = visibleBottom + EXTERNAL_GAP_PX
        } else if (fitsAbove) {
          placement = 'above'
          top = visibleTop - EXTERNAL_GAP_PX
        } else if (fitsBelow) {
          placement = 'below'
          top = visibleBottom + EXTERNAL_GAP_PX
        } else {
          // Tight viewport — still place outside; clamp into canvas.
          placement = preferBelow ? 'below' : 'above'
          top = placement === 'below'
            ? visibleBottom + EXTERNAL_GAP_PX
            : visibleTop - EXTERNAL_GAP_PX
        }
      } else {
        // Tall enough — anchor to the visible-region vertical centre (right edge).
        top = Math.min(
          Math.max((visibleTop + visibleBottom) / 2, vp.top + VIEWPORT_PAD),
          vp.bottom - VIEWPORT_PAD,
        )
      }

      setFrame({ top, left: right, placement })
    }

    updateRef.current = update
    update()
    const el = findBlockEl(containerRef, blockId)
    const root = containerRef.current
    const ro = new ResizeObserver(update)
    if (el) ro.observe(el)
    if (root) ro.observe(root)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    const scrollRoot = scrollRootRef?.current
    scrollRoot?.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      scrollRoot?.removeEventListener('scroll', update)
    }
  }, [blockId, containerRef, scrollRootRef, scale])

  if (!frame) return null

  /** Nudge the live value by deltaPct; returns false when already at a limit. */
  const applyStep = (deltaPct: number): boolean => {
    const next = Number(
      Math.max(SCALE_MIN, Math.min(SCALE_MAX, liveScaleRef.current + deltaPct / 100)).toFixed(2),
    )
    if (next === liveScaleRef.current) return false
    liveScaleRef.current = next
    onPreviewRef.current(next)
    return true
  }

  const stopHold = () => {
    clearHoldTimers()
    if (heldRef.current) {
      heldRef.current = false
      onCommitRef.current(liveScaleRef.current)
    }
    releasePosition()
  }

  const startHold = (deltaPct: number) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    clearHoldTimers()
    freezePosition()
    liveScaleRef.current = curScale
    heldRef.current = true
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* unsupported */ }
    // Immediate first nudge, then accelerate into a repeat after a short delay.
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
      className={cn(
        'group/scale pointer-events-auto fixed z-[100000] flex -translate-x-full items-center gap-0.5 rounded-full border border-primary/20 bg-white/95 p-0.5 shadow-lg ring-1 ring-black/5 backdrop-blur-sm',
        frame.placement === 'inline' && '-translate-y-1/2',
        frame.placement === 'above' && '-translate-y-full',
      )}
      style={{ top: frame.top, left: frame.left }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
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
        className="flex h-6 w-6 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:scale-90 disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div
        title="Drag to scale the whole section (content + media)"
        className="flex cursor-ew-resize select-none items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-primary/5"
        onMouseDown={e => {
          e.preventDefault()
          e.stopPropagation()
          freezePosition()
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
          const onMove = (mv: MouseEvent) => onPreviewRef.current(clampScale(mv.clientX))
          const onUp = (up: MouseEvent) => {
            document.body.style.cursor = ''
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            onCommitRef.current(clampScale(up.clientX))
            releasePosition()
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-white shadow-sm">
          <Maximize2 className="h-2.5 w-2.5" />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[6.5px] font-bold uppercase tracking-[0.08em] text-primary/50">Section size</span>
          <span className="text-[12px] font-extrabold tabular-nums text-gray-900">
            {pct}<span className="text-[9px] font-bold text-gray-400">%</span>
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
        className="flex h-6 w-6 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:scale-90 disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  )
}
