import { useState, useEffect, useCallback, useRef } from 'react'

const LS_PREFIX = 'col-widths-'

function loadWidths(tableId: string, defaults: number[]): number[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + tableId)
    if (raw) {
      const parsed: number[] = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === defaults.length) return parsed
    }
  } catch {}
  return defaults
}

function saveWidths(tableId: string, widths: number[]) {
  try {
    localStorage.setItem(LS_PREFIX + tableId, JSON.stringify(widths))
  } catch {}
}

export function useColumnResize(tableId: string, defaultWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(() =>
    loadWidths(tableId, defaultWidths),
  )

  // Keep a ref so mouse-move handlers always see the latest values without stale closure
  const dragRef = useRef<{
    colIndex: number
    startX: number
    startWidth: number
  } | null>(null)

  const widthsRef = useRef(widths)
  useEffect(() => { widthsRef.current = widths }, [widths])

  // Reset if column count changes (e.g. conditional columns)
  useEffect(() => {
    if (widths.length !== defaultWidths.length) {
      const next = loadWidths(tableId, defaultWidths)
      setWidths(next)
    }
  }, [defaultWidths.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const startResize = useCallback((colIndex: number, clientX: number) => {
    dragRef.current = {
      colIndex,
      startX: clientX,
      startWidth: widthsRef.current[colIndex],
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const { colIndex: ci, startX, startWidth } = dragRef.current
      const delta = e.clientX - startX
      const next = Math.max(40, startWidth + delta)
      setWidths(prev => {
        const updated = [...prev]
        updated[ci] = next
        return updated
      })
    }

    const onMouseUp = () => {
      if (dragRef.current) {
        // Persist after drag ends
        saveWidths(tableId, widthsRef.current)
      }
      dragRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [tableId])

  const resetWidths = useCallback(() => {
    setWidths(defaultWidths)
    saveWidths(tableId, defaultWidths)
  }, [tableId, defaultWidths])

  return { widths, startResize, resetWidths }
}
