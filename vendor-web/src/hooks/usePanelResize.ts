/**
 * usePanelResize
 *
 * Drag-to-resize for flex/div column layouts (not tables).
 *
 * Usage:
 *   const { widths, startResize, resetWidths } = usePanelResize(
 *     'booking-modal',          // unique localStorage key
 *     [260, 240],               // default pixel widths (only fixed panels; last col fills)
 *     { min: 160, max: 480 },   // optional clamp
 *   )
 *
 *   // In JSX:
 *   <div style={{ width: widths[0] }} ... />
 *   <DragHandle onMouseDown={e => startResize(0, e.clientX)} />
 *   <div style={{ width: widths[1] }} ... />
 *   <DragHandle onMouseDown={e => startResize(1, e.clientX)} />
 *   <div className="flex-1" ... />   ← fills remaining space
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const LS_PREFIX = 'panel-widths-'

function load(key: string, defaults: number[]): number[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) {
      const parsed: number[] = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === defaults.length) return parsed
    }
  } catch {}
  return defaults
}

function save(key: string, widths: number[]) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(widths)) } catch {}
}

type MaxOption = number | number[] | ((idx: number) => number)

interface Options {
  min?: number | number[]  // per-panel minimums, or a single value for all
  max?: MaxOption          // per-panel maximums, single value, or live getter (e.g. container room)
}

export function usePanelResize(key: string, defaultWidths: number[], options: Options = {}) {
  const [widths, setWidths] = useState<number[]>(() => load(key, defaultWidths))
  const widthsRef = useRef(widths)
  useEffect(() => { widthsRef.current = widths }, [widths])

  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options }, [options])

  const dragRef = useRef<{ panelIdx: number; startX: number; startWidth: number } | null>(null)

  // Reset if panel count changes
  useEffect(() => {
    if (widths.length !== defaultWidths.length) setWidths(load(key, defaultWidths))
  }, [defaultWidths.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const getMin = (idx: number) => {
    const m = optionsRef.current.min
    if (m === undefined) return 120
    return Array.isArray(m) ? (m[idx] ?? 120) : m
  }
  const getMax = (idx: number) => {
    const m = optionsRef.current.max
    if (m === undefined) return 800
    if (typeof m === 'function') return m(idx)
    return Array.isArray(m) ? (m[idx] ?? 800) : m
  }

  const clampWidths = useCallback((next: number[]) => {
    return next.map((w, i) => Math.min(getMax(i), Math.max(getMin(i), w)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startResize = useCallback((panelIdx: number, clientX: number) => {
    dragRef.current = { panelIdx, startX: clientX, startWidth: widthsRef.current[panelIdx] }

    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const { panelIdx: pi, startX, startWidth } = dragRef.current
      const delta = e.clientX - startX
      const next = Math.min(getMax(pi), Math.max(getMin(pi), startWidth + delta))
      setWidths(prev => { const u = [...prev]; u[pi] = next; return u })
    }

    const onUp = () => {
      if (dragRef.current) save(key, widthsRef.current)
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetWidths = useCallback(() => {
    setWidths(defaultWidths)
    save(key, defaultWidths)
  }, [key, defaultWidths])

  /** Re-apply min/max (e.g. after the container shrinks) and persist if changed. */
  const reclamp = useCallback(() => {
    setWidths(prev => {
      const next = clampWidths(prev)
      if (next.every((w, i) => w === prev[i])) return prev
      save(key, next)
      return next
    })
  }, [clampWidths, key])

  return { widths, startResize, resetWidths, reclamp }
}
