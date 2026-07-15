import { useEffect, useState } from 'react'

/** True while any `[data-kiterp-modal]` overlay is mounted (portaled or inline). */
export function useKiterpModalOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setOpen(Boolean(document.querySelector('[data-kiterp-modal]')))
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return open
}
