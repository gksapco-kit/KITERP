import { useEffect, useState } from 'react'

const MODAL_OPEN_SELECTOR = [
  '[data-kiterp-modal]',
  '[data-radix-dialog-overlay]',
  '[data-state="open"][role="dialog"]',
].join(',')

/** True while any app modal / dialog overlay is mounted (portaled or inline). */
export function useKiterpModalOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setOpen(Boolean(document.querySelector(MODAL_OPEN_SELECTOR)))
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'class'],
    })
    return () => observer.disconnect()
  }, [])

  return open
}
