import { useLayoutEffect } from 'react'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'

/** Register Escape to dismiss toasts first, then close the topmost open modal. */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useLayoutEffect(() => {
    if (!enabled) return
    return registerEscapeHandler(onClose)
  }, [onClose, enabled])
}
