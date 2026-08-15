import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ZoomIn } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'

type ImageHoverZoomProps = {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  zoomScale?: number
  /** Disable lens zoom (e.g. while dragging 360°). */
  disabled?: boolean
  /**
   * `fill` — absolute cover/contain inside a sized parent (default).
   * `intrinsic` — image sets the frame height (full flyer visible, no crop).
   */
  sizing?: 'fill' | 'intrinsic'
  onClick?: () => void
  onError?: () => void
  children?: ReactNode
}

/** Magnify product image on hover — cursor position drives transform origin. */
export function ImageHoverZoom({
  src,
  alt,
  className,
  imgClassName,
  zoomScale = 2.25,
  disabled = false,
  sizing = 'fill',
  onClick,
  onError,
  children,
}: ImageHoverZoomProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const intrinsic = sizing === 'intrinsic'
  const resolved = imgUrl(src)
  const [shown, setShown] = useState(resolved)

  useEffect(() => {
    if (!resolved || resolved === shown) return
    let cancelled = false
    const probe = new Image()
    probe.decoding = 'async'
    const apply = () => {
      if (!cancelled) setShown(resolved)
    }
    probe.onload = apply
    probe.onerror = () => {
      if (!cancelled) {
        setShown(resolved)
        onError?.()
      }
    }
    probe.src = resolved
    if (probe.complete && probe.naturalWidth > 0) apply()
    return () => {
      cancelled = true
    }
  }, [resolved, shown, onError])

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || disabled) return
    const rect = el.getBoundingClientRect()
    setOrigin({
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    })
  }

  const showZoom = hovered && !disabled

  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden',
        intrinsic ? 'w-full' : 'h-full w-full',
        disabled ? 'cursor-grabbing' : 'cursor-zoom-in',
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMove}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <img
        src={shown}
        alt={alt}
        draggable={false}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onError={onError}
        className={cn(
          'pointer-events-none transition-transform duration-150 ease-out',
          intrinsic
            ? 'relative block h-auto w-full'
            : 'absolute inset-0 h-full w-full',
          imgClassName,
        )}
        style={
          showZoom
            ? {
                transform: `scale(${zoomScale})`,
                transformOrigin: `${origin.x}% ${origin.y}%`,
              }
            : undefined
        }
      />
      {showZoom && (
        <span className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          Zoom
        </span>
      )}
      {children}
    </div>
  )
}
