import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'

const DEFAULT_INTERVAL_MS = 5000

type Props = {
  urls: string[]
  className?: string
  imageClassName?: string
  /** Fit / focal / zoom from section image controls. */
  imageStyle?: CSSProperties
  intervalMs?: number
  onIndexChange?: (index: number) => void
  /** Dim / gradient layer painted above slides and below the arrow controls. */
  overlay?: ReactNode
}

export function HeroBannerCarousel({
  urls,
  className,
  imageClassName = 'h-full w-full object-contain object-center',
  imageStyle,
  intervalMs = DEFAULT_INTERVAL_MS,
  onIndexChange,
  overlay,
}: Props) {
  const slides = urls.map((u) => imgUrl(u)).filter(Boolean)
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return
      setIndex((prev) => ((prev + delta) % count + count) % count)
    },
    [count],
  )

  useEffect(() => {
    setIndex(0)
  }, [slides.join('|')])

  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  useEffect(() => {
    if (count <= 1 || paused) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [count, paused, intervalMs])

  if (count === 0) return null

  if (count === 1) {
    return (
      <div className={cn('absolute inset-0', className)}>
        <img src={slides[0]} alt="" className={cn(imageClassName, 'pointer-events-none')} style={imageStyle} />
        {overlay ? (
          <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
            {overlay}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn('group absolute inset-0', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          aria-hidden={i !== index}
          className={cn(
            imageClassName,
            'pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
          style={imageStyle}
        />
      ))}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          {overlay}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Previous banner"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          go(-1)
        }}
        className="pointer-events-auto absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/60 group-hover:opacity-100 sm:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next banner"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          go(1)
        }}
        className="pointer-events-auto absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/60 sm:opacity-100 sm:bg-black/25"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5"
        aria-hidden
      >
        {slides.map((src, i) => (
          <span
            key={`${src}-dot-${i}`}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-all',
              i === index ? 'scale-125 bg-white' : 'bg-white/45',
            )}
          />
        ))}
      </div>
    </div>
  )
}
