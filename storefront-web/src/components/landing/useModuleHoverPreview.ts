import { useCallback, useEffect, useRef, useState } from 'react'

const SHOW_DELAY_MS = 140
const HIDE_DELAY_MS = 220

export function useModuleHoverPreview() {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const pinnedIdRef = useRef<string | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout>>()
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

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
      clearTimers()

      // After a click selection, ignore hover — keep showing that module's detail
      // until another app is clicked or the user clicks outside the panel.
      if (pinnedIdRef.current) {
        setHighlightedId(pinnedIdRef.current)
        return
      }

      setHighlightedId(id)

      if (id) {
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
      pinnedIdRef.current = id
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
    pinnedIdRef.current = null
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
