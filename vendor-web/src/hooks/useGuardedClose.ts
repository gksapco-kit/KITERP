import { useState, useCallback } from 'react'
import { useEscapeToClose } from './useEscapeToClose'

/**
 * Guards a modal/panel close action when the user has unsaved input.
 * - If `isDirty` is false → calls `onClose` immediately.
 * - If `isDirty` is true  → opens a confirmation dialog instead.
 *
 * @param registerEscape - Set to false when the parent modal (e.g. ModalOverlay) already
 *   registers its own Escape handler using the returned `handleClose`.
 */
export function useGuardedClose(
  onClose: () => void,
  isDirty: boolean,
  registerEscape = true,
) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true)
    } else {
      onClose()
    }
  }, [isDirty, onClose])

  const cancelConfirm = useCallback(() => setConfirmOpen(false), [])

  const forceClose = useCallback(() => {
    setConfirmOpen(false)
    onClose()
  }, [onClose])

  useEscapeToClose(handleClose, registerEscape)

  return { handleClose, confirmOpen, cancelConfirm, forceClose }
}
