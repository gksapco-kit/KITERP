import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type DemoCursorState = {
  x: number
  y: number
  pressing: boolean
}

export function useDemoCursor(
  frameRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const posRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const pressingRef = useRef(false)
  const insideRef = useRef(false)
  const rafRef = useRef(0)

  const [cursor, setCursor] = useState<DemoCursorState | null>(null)
  const [hovering, setHovering] = useState(false)

  const setTarget = useCallback((x: number, y: number) => {
    targetRef.current = { x, y }
    if (!cursor) {
      posRef.current = { x, y }
      setCursor({ x, y, pressing: pressingRef.current })
    }
  }, [cursor])

  const pulsePress = useCallback((ms = 140) => {
    pressingRef.current = true
    window.setTimeout(() => {
      pressingRef.current = false
    }, ms)
  }, [])

  const clearCursor = useCallback(() => {
    insideRef.current = false
    setHovering(false)
    setCursor(null)
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearCursor()
    }
  }, [enabled, clearCursor])

  useEffect(() => {
    const tick = () => {
      if (!enabled || !insideRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const pos = posRef.current
      const target = targetRef.current
      const dx = target.x - pos.x
      const dy = target.y - pos.y
      const dist = Math.hypot(dx, dy)
      const speed = Math.min(0.55, 0.24 + dist * 0.011)

      if (dist > 0.4) {
        pos.x += dx * speed
        pos.y += dy * speed
      } else {
        pos.x = target.x
        pos.y = target.y
      }

      setCursor({ x: pos.x, y: pos.y, pressing: pressingRef.current })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !enabled) return

    const onMove = (e: MouseEvent) => {
      const f = frame.getBoundingClientRect()
      setTarget(e.clientX - f.left, e.clientY - f.top)
    }

    const onEnter = () => {
      insideRef.current = true
      setHovering(true)
    }

    const onLeave = () => clearCursor()

    frame.addEventListener('mousemove', onMove)
    frame.addEventListener('mouseenter', onEnter)
    frame.addEventListener('mouseleave', onLeave)
    return () => {
      frame.removeEventListener('mousemove', onMove)
      frame.removeEventListener('mouseenter', onEnter)
      frame.removeEventListener('mouseleave', onLeave)
    }
  }, [frameRef, enabled, setTarget, clearCursor])

  return { cursor, hovering, setTarget, pulsePress, clearCursor }
}
