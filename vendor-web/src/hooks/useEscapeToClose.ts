import { useEffect } from 'react'
import { toast } from 'sonner'

const stack: Array<() => void> = []
let listenerAttached = false

function hasVisibleToasts() {
  if (typeof document === 'undefined') return false

  const visibleInDom = document.querySelector(
    '[data-sonner-toast][data-mounted="true"]:not([data-removed="true"]):not([data-visible="false"])',
  )
  if (visibleInDom) return true

  try {
    return (toast.getToasts?.()?.length ?? 0) > 0
  } catch {
    return false
  }
}

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return

  if (hasVisibleToasts()) {
    toast.dismiss()
    e.preventDefault()
    e.stopPropagation()
    return
  }

  const close = stack[stack.length - 1]
  if (!close) return
  e.preventDefault()
  e.stopPropagation()
  close()
}

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return
  window.addEventListener('keydown', onGlobalKeyDown, true)
  listenerAttached = true
}

function pushEscapeHandler(onClose: () => void) {
  ensureListener()
  stack.push(onClose)
  return () => {
    const idx = stack.lastIndexOf(onClose)
    if (idx >= 0) stack.splice(idx, 1)
  }
}

// Always listen for Escape so toasts dismiss even when no modal is open.
ensureListener()

/** Register Escape to dismiss toasts first, then close the topmost open modal. */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    return pushEscapeHandler(onClose)
  }, [onClose, enabled])
}
