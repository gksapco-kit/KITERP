import { useCallback, useRef } from 'react'
import {
  clampResizeWidth,
  getCanvasContentWidth,
  parseSizePx,
  resolveResizedWidth,
} from '../../lib/blockResize'

const MIN_WIDTH_PX = 48
const MIN_HEIGHT_PX = 22

export { parseSizePx }

/** @deprecated Use parseSizePx */
export const parseHeightPx = parseSizePx

export interface BlockSizePatch {
  width?: string
  height?: string
}

interface UseBlockSizeResizeOptions {
  containerRef: React.RefObject<HTMLElement | null>
  currentWidth?: string
  currentHeight?: string
  onResizeStart: () => void
  onResize: (size: BlockSizePatch) => void
  onResizeEnd: (size: BlockSizePatch) => void
  onResizeCancel: () => void
}

export function useBlockSizeResize({
  containerRef,
  currentWidth,
  currentHeight,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeCancel,
}: UseBlockSizeResizeOptions) {
  const sessionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    lastWidth: number
    lastHeight: number
    hadExplicitWidth: boolean
    hadExplicitHeight: boolean
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

      if (!commit) {
        onResizeCancel()
        return
      }

      const el = containerRef.current
      const resolvedWidth = resolveResizedWidth(el, session.lastWidth)
      const heightChanged = Math.abs(session.lastHeight - session.startHeight) > 2

      const patch: BlockSizePatch = { width: resolvedWidth }

      if (session.hadExplicitHeight || heightChanged) {
        patch.height = `${session.lastHeight}px`
      }

      onResizeEnd(patch)
    },
    [containerRef, onResizeEnd, onResizeCancel],
  )

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (sessionRef.current?.active) return

      const el = containerRef.current
      if (!el) return

      const maxW = getCanvasContentWidth(el)
      const outer = el.querySelector('[data-block-size]') as HTMLElement | null
      const heightEl = el.querySelector('[data-block-height]') as HTMLElement | null
      const parsedW = parseSizePx(currentWidth)
      const parsedH = parseSizePx(currentHeight)

      const naturalWidth = outer?.offsetWidth ?? el.offsetWidth
      const startWidth = parsedW ?? (maxW > 0 ? maxW : naturalWidth)
      const startHeight =
        parsedH ?? heightEl?.offsetHeight ?? outer?.offsetHeight ?? el.offsetHeight

      const session = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth,
        startHeight,
        lastWidth: startWidth,
        lastHeight: startHeight,
        hadExplicitWidth: !!parsedW,
        hadExplicitHeight: !!parsedH,
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
        const deltaX = ev.clientX - s.startX
        const deltaY = ev.clientY - s.startY
        const rawWidth = Math.max(MIN_WIDTH_PX, Math.round(s.startWidth + deltaX))
        s.lastWidth = clampResizeWidth(el, rawWidth)
        s.lastHeight = Math.max(MIN_HEIGHT_PX, Math.round(s.startHeight + deltaY))

        const resolvedWidth = resolveResizedWidth(el, s.lastWidth)
        onResize({
          width: resolvedWidth,
          height: `${s.lastHeight}px`,
        })
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
    [containerRef, currentWidth, currentHeight, onResize, onResizeStart, endSession],
  )

  return { onResizePointerDown, isResizing: () => sessionRef.current?.active ?? false }
}
