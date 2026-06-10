import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasHScrollbarProps {
  /** The scroll container whose horizontal scroll this bar drives. */
  targetRef: React.RefObject<HTMLElement | null>
  /** Bump to force a re-measure (e.g. when zoom / canvas width changes). */
  refreshKey?: number | string
  className?: string
}

const ARROW_STEP_PX = 160

/**
 * A compact horizontal scrollbar that drives `targetRef`'s scrollLeft.
 * Used for panning a zoomed builder canvas without the native browser bar.
 */
export function CanvasHScrollbar({ targetRef, refreshKey, className }: CanvasHScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startScroll: number; usable: number; maxScroll: number } | null>(null)
  const [m, setM] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0, trackWidth: 0 })

  const measure = useCallback(() => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    setM({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      trackWidth: track.clientWidth,
    })
  }, [targetRef])

  useLayoutEffect(() => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(track)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [targetRef, measure])

  // Re-measure when an external dependency (zoom, device width…) changes.
  useLayoutEffect(() => {
    measure()
  }, [refreshKey, measure])

  const maxScroll = Math.max(0, m.scrollWidth - m.clientWidth)
  const hasOverflow = maxScroll > 1
  const ratio = m.scrollWidth > 0 ? Math.min(1, m.clientWidth / m.scrollWidth) : 1
  const thumbW = hasOverflow ? Math.max(28, Math.round(m.trackWidth * ratio)) : m.trackWidth
  const usable = Math.max(0, m.trackWidth - thumbW)
  const thumbX = hasOverflow && maxScroll > 0 ? Math.round(usable * (m.scrollLeft / maxScroll)) : 0

  const scrollByPx = useCallback((dx: number, smooth = true) => {
    const el = targetRef.current
    if (!el) return
    const next = Math.max(0, Math.min(maxScroll, el.scrollLeft + dx))
    el.scrollTo({ left: next, behavior: smooth ? 'smooth' : 'auto' })
  }, [targetRef, maxScroll])

  const onThumbPointerDown = (e: React.PointerEvent) => {
    const el = targetRef.current
    if (!hasOverflow || !el) return
    e.preventDefault()
    e.stopPropagation()
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startScroll: el.scrollLeft, usable, maxScroll }
  }
  const onThumbPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const el = targetRef.current
    if (!drag || !el || drag.usable <= 0) return
    const dx = e.clientX - drag.startX
    el.scrollLeft = Math.max(0, Math.min(drag.maxScroll, drag.startScroll + (dx / drag.usable) * drag.maxScroll))
  }
  const onThumbPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
      dragRef.current = null
    }
  }

  const onTrackPointerDown = (e: React.PointerEvent) => {
    const track = trackRef.current
    if (!hasOverflow || !track) return
    const rect = track.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    scrollByPx(clickX < thumbX ? -m.clientWidth * 0.85 : m.clientWidth * 0.85)
  }

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      title={hasOverflow ? 'Scroll the zoomed page sideways' : 'Zoom in to pan the page sideways'}
    >
      <button
        type="button"
        disabled={!hasOverflow || m.scrollLeft <= 0}
        onClick={() => scrollByPx(-ARROW_STEP_PX)}
        aria-label="Scroll left"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        className="group relative h-1 flex-1 rounded-full bg-gray-200/80"
      >
        <div
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          onPointerCancel={onThumbPointerUp}
          style={{ width: thumbW, transform: `translateX(${thumbX}px)` }}
          className={cn(
            'absolute left-0 top-0 h-1 rounded-full transition-colors',
            hasOverflow
              ? 'cursor-grab bg-gray-400 hover:bg-gray-500 active:cursor-grabbing'
              : 'cursor-default bg-gray-300',
          )}
        />
      </div>

      <button
        type="button"
        disabled={!hasOverflow || m.scrollLeft >= maxScroll - 1}
        onClick={() => scrollByPx(ARROW_STEP_PX)}
        aria-label="Scroll right"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
