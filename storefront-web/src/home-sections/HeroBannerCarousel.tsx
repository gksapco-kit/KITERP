import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'

const DEFAULT_INTERVAL_MS = 5000

type Props = {
  urls: string[]
  className?: string
  imageClassName?: string
  intervalMs?: number
}

export function HeroBannerCarousel({
  urls,
  className,
  imageClassName = 'h-full w-full object-cover object-center',
  intervalMs = DEFAULT_INTERVAL_MS,
}: Props) {
  const slides = urls.map((u) => imgUrl(u)).filter(Boolean)
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = useCallback(
    (next: number) => {
      if (count <= 1) return
      setIndex(((next % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    setIndex(0)
  }, [slides.join('|')])

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
        <img src={slides[0]} alt="" className={imageClassName} />
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
          key={src}
          src={src}
          alt=""
          aria-hidden={i !== index}
          className={cn(
            imageClassName,
            'absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}

      <button
        type="button"
        aria-label="Previous banner"
        onClick={() => go(index - 1)}
        className="absolute left-3 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/60 group-hover:opacity-100 sm:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next banner"
        onClick={() => go(index + 1)}
        className="absolute right-3 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/60 sm:opacity-100 sm:bg-black/25"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        className="pointer-events-none absolute bottom-3 left-1/2 z-[2] flex -translate-x-1/2 gap-1.5"
        aria-hidden
      >
        {slides.map((src, i) => (
          <span
            key={src}
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
