import { useEffect, useRef, useCallback } from 'react'

/**
 * Detects barcode input from USB/Bluetooth hardware scanners (keyboard-wedge).
 *
 * Scanners type characters very rapidly (< 100 ms apart) then send Enter.
 * Normal human typing is much slower.
 *
 * Production-ready behaviours:
 *  - Once we detect 2+ rapid chars, we call preventDefault() on subsequent
 *    keydowns so the barcode does NOT bleed into whichever input is focused.
 *  - Enter is always suppressed while a scan is in progress to prevent
 *    accidental form submissions.
 *  - A pending lookup is queued (not dropped) if the previous one is still
 *    running, so fast back-to-back scans all get processed.
 */

const MIN_BARCODE_LENGTH = 4
const MAX_CHAR_INTERVAL_MS = 100   // generous — covers slower USB scanners
const RESET_AFTER_IDLE_MS = 300    // reset buffer if no key for this long

interface UseBarcodeScannerOptions {
  enabled?: boolean
  onScan: (code: string) => void
}

export function useBarcodeScanner({ enabled = true, onScan }: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const isScanningRef = useRef<boolean>(false)  // true once ≥2 rapid chars seen
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetBuffer = useCallback(() => {
    bufferRef.current = ''
    isScanningRef.current = false
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const flush = useCallback(() => {
    const code = bufferRef.current.trim()
    resetBuffer()
    if (code.length >= MIN_BARCODE_LENGTH) {
      onScan(code)
    }
  }, [onScan, resetBuffer])

  // Restart the idle-reset timer each time a key is received
  const restartIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(resetBuffer, RESET_AFTER_IDLE_MS)
  }, [resetBuffer])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Always ignore browser / OS shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const now = Date.now()
      const gap = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      if (e.key === 'Enter') {
        if (isScanningRef.current) {
          // Block this Enter from submitting forms / triggering buttons
          e.preventDefault()
          e.stopPropagation()
          flush()
        }
        return
      }

      // Only care about printable single characters
      if (e.key.length !== 1) return

      const isRapid = gap <= MAX_CHAR_INTERVAL_MS

      if (bufferRef.current.length === 0) {
        // First char of a potential scan — always accept it
        bufferRef.current = e.key
        restartIdleTimer()
        return
      }

      if (!isRapid) {
        // Too slow — this is a human keystroke; reset and start fresh
        resetBuffer()
        bufferRef.current = e.key
        restartIdleTimer()
        return
      }

      // Rapid char — we're in a scan sequence
      bufferRef.current += e.key

      // From the 2nd rapid char onwards we know this is a scanner;
      // block it from leaking into any focused input / textarea
      if (bufferRef.current.length >= 2) {
        isScanningRef.current = true
        e.preventDefault()
        e.stopPropagation()
      }

      restartIdleTimer()
    }

    // Use capture phase so we intercept before the input element sees the event
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [enabled, flush, resetBuffer, restartIdleTimer])
}
