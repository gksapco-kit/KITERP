import { useCallback, useEffect, useRef, useState } from 'react'

const SHOW_DELAY_MS = 140
const HIDE_DELAY_MS = 220

export function useModuleHoverPreview() {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewOpenRef = useRef(false)
  const showTimer = useRef<ReturnType<typeof setTimeout>>()
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    previewOpenRef.current = previewId !== null
  }, [previewId])

  useEffect(() => {
    return () => {
      clearTimeout(showTimer.current)
      clearTimeout(hideTimer.current)
    }
  }, [])

  const clearTimers = useCallback(() => {
    clearTimeout(showTimer.current)
    clearTimeout(hideTimer.current)
  }, [])

  const hoverModule = useCallback(
    (id: string | null) => {
      setHighlightedId(id)
      clearTimers()

      if (id) {
        if (previewOpenRef.current) {
          setPreviewId(id)
          return
        }
        showTimer.current = setTimeout(() => setPreviewId(id), SHOW_DELAY_MS)
        return
      }

      hideTimer.current = setTimeout(() => setPreviewId(null), HIDE_DELAY_MS)
    },
    [clearTimers],
  )

  const selectModule = useCallback(
    (id: string) => {
      clearTimers()
      setHighlightedId(id)
      setPreviewId(id)
    },
    [clearTimers],
  )

  const keepPreview = useCallback(() => {
    clearTimers()
  }, [clearTimers])

  const dismissPreview = useCallback(() => {
    clearTimers()
    setHighlightedId(null)
    setPreviewId(null)
  }, [clearTimers])

  const leaveInteractive = useCallback(() => {
    hoverModule(null)
  }, [hoverModule])

  return {
    highlightedId,
    previewId,
    hoverModule,
    selectModule,
    keepPreview,
    leaveInteractive,
    dismissPreview,
  }
}
