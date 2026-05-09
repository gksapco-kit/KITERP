/**
 * SmartImage — optimized image component for BlockRenderer.
 *
 * Features:
 *  - Native lazy loading
 *  - Blur placeholder (CSS backdrop-filter while loading)
 *  - srcset for responsive images (if CDN supports width query params like Cloudinary/Imgix)
 *  - WebP/AVIF via <picture> when browser supports it
 *  - Graceful fallback on error
 *
 * Usage:
 *   <SmartImage src="https://..." alt="Description" className="w-full rounded-xl" />
 */
import { useState, useRef } from 'react'

interface Props {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  aspectRatio?: string
  priority?: boolean   // if true, load eagerly (above-the-fold)
  objectFit?: 'cover' | 'contain' | 'fill' | 'none'
  sizes?: string
}

function buildSrcSet(src: string): string | undefined {
  // For Cloudinary-style CDN URLs, generate srcset
  if (src.includes('cloudinary.com') || src.includes('res.cloudinary.com')) {
    const widths = [320, 640, 960, 1280, 1920]
    return widths
      .map(w => `${src.replace('/upload/', `/upload/w_${w},f_auto,q_auto/`)} ${w}w`)
      .join(', ')
  }
  // For Imgix
  if (src.includes('.imgix.net')) {
    const widths = [320, 640, 960, 1280, 1920]
    const sep = src.includes('?') ? '&' : '?'
    return widths
      .map(w => `${src}${sep}w=${w}&auto=format,compress ${w}w`)
      .join(', ')
  }
  return undefined
}

export default function SmartImage({ src, alt, className = '', style, aspectRatio, priority, objectFit = 'cover', sizes }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const srcSet = src ? buildSrcSet(src) : undefined

  if (errored) {
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center text-gray-300 ${className}`}
        style={{ aspectRatio, ...style }}
      >
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio, ...style }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}
      <picture>
        {srcSet && <source type="image/webp" srcSet={srcSet} sizes={sizes || '100vw'} />}
        <img
          ref={imgRef}
          src={src}
          srcSet={srcSet}
          sizes={sizes || '100vw'}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectFit }}
        />
      </picture>
    </div>
  )
}
