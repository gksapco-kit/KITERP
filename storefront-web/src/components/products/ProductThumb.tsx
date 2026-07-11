import { useEffect, useState } from 'react'
import { imgUrl, cn } from '@/lib/utils'

type Props = {
  src?: string | null
  alt: string
  className?: string
  /** Hide the caption under the cube (very small thumbs). */
  hideLabel?: boolean
  /** `lg` for product detail hero; default for cards / cart thumbs. */
  size?: 'sm' | 'md' | 'lg'
  /** Extra classes for the img when an image is shown. */
  imgClassName?: string
}

/** Isometric product-box mark matching the storefront empty-image placeholder. */
export function ProductBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path d="M24 8L38 16V32L24 40L10 32V16L24 8Z" fill="#CBD5E1" />
      <path d="M24 24V40L38 32V16L24 24Z" fill="#94A3B8" />
      <path d="M24 24V40L10 32V16L24 24Z" fill="#A8B4C4" />
      <path d="M24 8L38 16L24 24L10 16L24 8Z" fill="#E2E8F0" />
      <path
        d="M24 8L38 16V32L24 40L10 32V16L24 8Z"
        stroke="#94A3B8"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M10 16L24 24L38 16" stroke="#94A3B8" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M24 24V40" stroke="#94A3B8" strokeWidth="1.25" />
    </svg>
  )
}

const SIZE = {
  sm: {
    icon: 'h-5 w-5 max-h-none max-w-none',
    label: 'text-[9px]',
    gap: 'gap-1',
  },
  md: {
    icon: 'h-10 w-10 max-h-none max-w-none',
    label: 'text-[11px]',
    gap: 'gap-1.5',
  },
  lg: {
    icon: 'h-16 w-16 max-h-none max-w-none',
    label: 'text-sm',
    gap: 'gap-2',
  },
} as const

/** Empty-state tile: cube + “No product image”. */
export function ProductImagePlaceholder({
  className,
  hideLabel = false,
  size = 'md',
}: {
  className?: string
  hideLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const s = SIZE[size]
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center bg-[#F1F5F9] px-2 text-center',
        s.gap,
        className,
      )}
    >
      <ProductBoxIcon className={cn('shrink-0', s.icon)} />
      {!hideLabel && (
        <span className={cn('max-w-full font-medium leading-tight text-slate-400', s.label)}>
          No product image
        </span>
      )}
      <span className="sr-only">No product image</span>
    </div>
  )
}

/**
 * Product thumbnail with a default “No product image” placeholder
 * when the URL is missing or fails to load.
 */
export function ProductThumb({
  src,
  alt,
  className,
  hideLabel = false,
  size = 'sm',
  imgClassName,
}: Props) {
  const resolved = src ? imgUrl(src) : ''
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [resolved])

  const showImage = Boolean(resolved) && !failed

  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]',
        className,
      )}
    >
      {showImage ? (
        <img
          src={resolved}
          alt={alt}
          className={cn('h-full w-full object-cover', imgClassName)}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <ProductImagePlaceholder hideLabel={hideLabel} size={size} />
      )}
    </div>
  )
}
