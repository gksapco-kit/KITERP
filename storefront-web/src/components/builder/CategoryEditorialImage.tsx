import { useEffect, useState } from 'react'
import { imgUrl } from '@/lib/utils'

/** Category card hero image with fallback when URL is missing or fails to load. */
export function CategoryEditorialImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string
  fallback: string
  alt: string
  className?: string
}) {
  const primary = imgUrl(src) || imgUrl(fallback) || fallback
  const safeFallback = imgUrl(fallback) || fallback
  const [current, setCurrent] = useState(primary)

  useEffect(() => {
    setCurrent(imgUrl(src) || safeFallback)
  }, [src, safeFallback])

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (current !== safeFallback) setCurrent(safeFallback)
      }}
    />
  )
}
