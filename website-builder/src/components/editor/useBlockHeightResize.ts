import { useCallback, useRef } from 'react'

const MIN_HEIGHT_PX = 22

export function parseHeightPx(value?: string): number | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : null
}

interface UseBlockHeightResizeOptions {
  containerRef: React.RefObject<HTMLElement | null>
  currentHeight?: string
  onResizeStart: () => void
  onResize: (height: string) => void
  onResizeEnd: (height: string) => void
  onResizeCancel: () => void
}

export function useBlockHeightResize({
  containerRef,
  currentHeight,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeCancel,
}: UseBlockHeightResizeOptions) {
  const sessionRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
    lastHeight: number
    active: boolean
  } | null>(null)

  const endSession = useCallback(
    (commit: boolean) => {
      const session = sessionRef.current
      if (!session?.active) return
      session.active = false
      sessionRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (commit) onResizeEnd(`${session.lastHeight}px`)
      else onResizeCancel()
    },
    [onResizeEnd, onResizeCancel],
  )

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (sessionRef.current?.active) return

      const el = containerRef.current
      if (!el) return

      const outer = el.querySelector('[data-block-height]') as HTMLElement | null
      const parsed = parseHeightPx(currentHeight)
      const startHeight = parsed ?? outer?.offsetHeight ?? el.offsetHeight

      const session = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startHeight,
        lastHeight: startHeight,
        active: true,
      }
      sessionRef.current = session

      onResizeStart()

      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)
      document.body.style.cursor = 'nwse-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current
        if (!s?.active || ev.pointerId !== s.pointerId) return
        const delta = ev.clientY - s.startY
        s.lastHeight = Math.max(MIN_HEIGHT_PX, Math.round(s.startHeight + delta))
        onResize(`${s.lastHeight}px`)
      }

      const onUp = (ev: PointerEvent) => {
        if (sessionRef.current?.pointerId !== ev.pointerId) return
        cleanup()
        endSession(true)
      }

      const onCancel = (ev: PointerEvent) => {
        if (sessionRef.current?.pointerId !== ev.pointerId) return
        cleanup()
        endSession(false)
      }

      const cleanup = () => {
        try {
          handle.releasePointerCapture(e.pointerId)
        } catch {
          /* already released */
        }
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onCancel)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onCancel)
    },
    [containerRef, currentHeight, onResize, onResizeStart, endSession],
  )

  return { onResizePointerDown, isResizing: () => sessionRef.current?.active ?? false }
}
