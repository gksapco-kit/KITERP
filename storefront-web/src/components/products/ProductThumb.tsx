import { useEffect, useState, type CSSProperties } from 'react'
import { imgUrl, cn } from '@/lib/utils'

/** Bundled default when a product has no photo. */
export const PRODUCT_NO_IMAGE_SRC = '/product-no-image.png'

type Props = {
  src?: string | null
  alt: string
  className?: string
  /** Kept for callers; text overlay is no longer shown. */
  hideLabel?: boolean
  /** Kept for callers; placeholder is full-bleed graphic. */
  size?: 'sm' | 'md' | 'lg'
  /** Extra classes for the img when an image is shown. */
  imgClassName?: string
  imgStyle?: CSSProperties
  /** Load immediately (main card / selected variant photo). */
  priority?: boolean
}

/** Shopping-cart mark matching the storefront empty-image placeholder. */
export function ProductBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 18h6l4.5 22h24l5-16H22"
        stroke="#546E7A"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="48" r="3.5" fill="#546E7A" />
      <circle cx="42" cy="48" r="3.5" fill="#546E7A" />
      <circle cx="38" cy="30" r="8" stroke="#546E7A" strokeWidth="2.5" />
      <path d="M32.5 24.5L43.5 35.5" stroke="#546E7A" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/** Empty-state tile: default cart graphic (no text overlay). */
export function ProductImagePlaceholder({
  className,
}: {
  className?: string
  hideLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-[#F0F0F0]',
        className,
      )}
      role="img"
      aria-label="No Image"
    >
      <img
        src={PRODUCT_NO_IMAGE_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <span className="sr-only">No Image</span>
    </div>
  )
}

/**
 * Product thumbnail with a default cart placeholder
 * when the URL is missing or fails to load.
 */
export function ProductThumb({
  src,
  alt,
  className,
  imgClassName,
  imgStyle,
  priority = false,
}: Props) {
  const resolved = src ? imgUrl(src) : ''
  const [failed, setFailed] = useState(false)
  const [shown, setShown] = useState(resolved)

  useEffect(() => {
    setFailed(false)
    if (!resolved) {
      setShown('')
      return
    }
    if (resolved === shown) return

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
        setFailed(true)
      }
    }
    probe.src = resolved
    if (probe.complete && probe.naturalWidth > 0) apply()
    return () => {
      cancelled = true
    }
  }, [resolved, shown])

  const showImage = Boolean(shown) && !failed

  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] bg-white',
        className,
      )}
    >
      {showImage ? (
        <img
          src={shown}
          alt={alt}
          className={cn(
            imgClassName
              ? imgClassName
              : 'absolute inset-0 h-full w-full object-contain object-center bg-white',
            'bg-white',
          )}
          style={{ backgroundColor: '#ffffff', ...imgStyle }}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <ProductImagePlaceholder />
      )}
    </div>
  )
}
