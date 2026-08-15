import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'

const DEFAULT_INTERVAL_MS = 5000
const MANUAL_PAUSE_MS = 8000

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
  const slides = useMemo(() => urls.map((u) => imgUrl(u)).filter(Boolean), [urls])
  const slideKey = slides.join('|')
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef<number | null>(null)

  const clearResumeTimer = () => {
    if (resumeTimer.current != null) {
      window.clearTimeout(resumeTimer.current)
      resumeTimer.current = null
    }
  }

  const pauseForInteraction = useCallback(() => {
    setPaused(true)
    clearResumeTimer()
    resumeTimer.current = window.setTimeout(() => {
      setPaused(false)
      resumeTimer.current = null
    }, MANUAL_PAUSE_MS)
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (count <= 1) return
      pauseForInteraction()
      setIndex(((next % count) + count) % count)
    },
    [count, pauseForInteraction],
  )

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return
      pauseForInteraction()
      setIndex((prev) => ((prev + delta) % count + count) % count)
    },
    [count, pauseForInteraction],
  )

  useEffect(() => {
    setIndex((prev) => (prev < count ? prev : 0))
  }, [slideKey, count])

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

  useEffect(() => () => clearResumeTimer(), [])

  if (count === 0) return null

  const controlBtnClass =
    'pointer-events-auto absolute top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'

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
      onMouseLeave={() => {
        if (resumeTimer.current == null) setPaused(false)
      }}
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
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          go(-1)
        }}
        className={cn(controlBtnClass, 'left-3')}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        aria-label="Next banner"
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          go(1)
        }}
        className={cn(controlBtnClass, 'right-3')}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div
        className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-1.5"
        role="tablist"
        aria-label="Banner slides"
      >
        {slides.map((src, i) => (
          <button
            key={`${src}-dot-${i}`}
            type="button"
            role="tab"
            aria-label={`Show banner ${i + 1}`}
            aria-selected={i === index}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goTo(i)
            }}
            className={cn(
              'h-2.5 rounded-full transition-all',
              i === index ? 'w-5 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80',
            )}
          />
        ))}
      </div>
    </div>
  )
}
