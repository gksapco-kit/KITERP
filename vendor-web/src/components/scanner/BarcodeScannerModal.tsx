import { useEffect, useRef, useState, useCallback } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { X, Camera, AlertCircle, Loader2, ScanLine, Zap, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BarcodeScannerModalProps {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
  title?: string
}

// ── Engine type declaration ──────────────────────────────────────────────────

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>
    }
  }
}

type Engine = 'native' | 'library' | null

const NATIVE_FORMATS = [
  'ean_13', 'ean_8', 'upc_a', 'upc_e',
  'code_128', 'code_39', 'code_93',
  'qr_code', 'data_matrix', 'itf',
]

const LIB_FORMATS = [
  'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E',
  'CODE_128', 'CODE_39', 'QR_CODE', 'ITF', 'DATA_MATRIX',
]

// Unique DOM ID for html5-qrcode to mount its video inside
const H5_CONTAINER_ID = 'h5qr-scanner-container'

// ── Beep helper ──────────────────────────────────────────────────────────────

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1800
    gain.gain.value = 0.25
    osc.start()
    setTimeout(() => { osc.stop(); ctx.close() }, 120)
  } catch { /* audio not critical */ }
}

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodeScannerModal({
 open, onClose, onScan, title = 'Scan Barcode' }: BarcodeScannerModalProps) {
  useEscapeToClose(onClose, open)

  const [engine, setEngine] = useState<Engine>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  // Native engine refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null)

  // Library engine ref
  const h5qrRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)

  // Shared cooldown
  const cooldownRef = useRef(false)
  const lastScannedRef = useRef('')

  // ── Shared: handle a detected code (both engines call this) ────────────────

  const handleDetected = useCallback((code: string) => {
    if (cooldownRef.current || code === lastScannedRef.current) return
    cooldownRef.current = true
    lastScannedRef.current = code
    setLastResult(code)
    playBeep()
    onScan(code)
    setTimeout(() => {
      cooldownRef.current = false
      lastScannedRef.current = ''
    }, 2000)
  }, [onScan])

  // ── Native engine ─────────────────────────────────────────────────────────

  const stopNative = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startNative = useCallback(async () => {
    setEngine('native')
    try {
      detectorRef.current = new window.BarcodeDetector!({ formats: NATIVE_FORMATS })
    } catch {
      detectorRef.current = new window.BarcodeDetector!()
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('scanning')
      const tick = async () => {
        if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick); return
        }
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current)
          for (const bc of barcodes) { if (bc.rawValue) { handleDetected(bc.rawValue); break } }
        } catch { /* ignore decode errors on intermediate frames */ }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('NotAllowed') || msg.includes('Permission')
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : `Could not access camera: ${msg}`)
      setStatus('error')
    }
  }, [handleDetected])

  // ── Library engine (html5-qrcode) ─────────────────────────────────────────

  const stopLibrary = useCallback(async () => {
    if (h5qrRef.current) {
      try { await h5qrRef.current.stop() } catch { /* may throw if already stopped */ }
      h5qrRef.current = null
    }
  }, [])

  const startLibrary = useCallback(async () => {
    setEngine('library')
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

      const supportedFormats = LIB_FORMATS
        .map(f => (Html5QrcodeSupportedFormats as unknown as Record<string, number>)[f])
        .filter((v): v is number => v !== undefined)

      const h5qr = new Html5Qrcode(H5_CONTAINER_ID)
      h5qrRef.current = h5qr

      await h5qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 140 }, formatsToSupport: supportedFormats } as any,
        (decodedText) => { handleDetected(decodedText) },
        undefined, // error callback — silent
      )
      setStatus('scanning')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('NotAllowed') || msg.includes('Permission')
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : `Could not start camera scanner: ${msg}`)
      setStatus('error')
    }
  }, [handleDetected])

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  const stopAll = useCallback(async () => {
    stopNative()
    await stopLibrary()
  }, [stopNative, stopLibrary])

  const startScan = useCallback(async () => {
    setError(null)
    setStatus('starting')
    setEngine(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.')
      setStatus('error')
      return
    }

    if (window.BarcodeDetector) {
      // Native engine available — use it (fastest)
      await startNative()
    } else {
      // Fall back to html5-qrcode library (works everywhere)
      await startLibrary()
    }
  }, [startNative, startLibrary])

  useEffect(() => {
    if (open) {
      setLastResult(null)
      startScan()
    } else {
      stopAll()
    }
    return () => { stopAll() }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Viewfinder area */}
        <div className="relative bg-black overflow-hidden" style={{ minHeight: 200 }}>

          {/* Native engine: raw <video> element */}
          {(engine === 'native' || engine === null) && (
            <video
              ref={videoRef}
              className="w-full object-cover"
              style={{ display: engine === 'native' ? 'block' : 'none', maxHeight: 240 }}
              playsInline
              muted
            />
          )}

          {/* Library engine: html5-qrcode mounts its own video inside this div */}
          <div
            id={H5_CONTAINER_ID}
            className="w-full"
            style={{ display: engine === 'library' ? 'block' : 'none' }}
          />

          {/* Scan region overlay (shown only for native; library draws its own) */}
          {status === 'scanning' && engine === 'native' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-32">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br" />
                <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-blue-400 opacity-80 animate-pulse" />
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2" style={{ minHeight: 200 }}>
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-white text-sm">Starting camera…</p>
            </div>
          )}
        </div>

        {/* Status / result / error */}
        <div className="px-4 py-3 space-y-2">

          {/* Engine badge */}
          {engine && status === 'scanning' && (
            <div className="flex justify-center">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                engine === 'native'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {engine === 'native'
                  ? <><Zap className="w-2.5 h-2.5" /> Native scanner (GPU-accelerated)</>
                  : <><Package className="w-2.5 h-2.5" /> Library scanner (universal)</>}
              </span>
            </div>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {status === 'scanning' && !lastResult && (
            <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              Point the camera at a barcode
            </p>
          )}

          {lastResult && (
            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-600 text-sm font-mono font-semibold truncate">{lastResult}</span>
              <span className="text-xs text-green-600 ml-auto shrink-0">Detected ✓</span>
            </div>
          )}

          <Button variant="outline" className="w-full text-sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
